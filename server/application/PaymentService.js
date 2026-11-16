/**
 * PaymentService.js - Application Service quan ly nghiep vu thanh toan SePay & VietQR
 * Thuoc tang Application (Clean / Hexagonal Architecture: 0 Express, 0 Prisma dependencies)
 * Dieu phoi giua Inbound Web Controllers va Outbound OrderRepositoryPort
 */

import { ValidationError, NotFoundError, ForbiddenError, UnauthorizedError, AuthenticationError } from '../domain/errors/DomainErrors.js';
import { normalizeVnPhone } from '../domain/utils/phone.js';

export class PaymentService {
  /**
   * @param {import('../ports/out/OrderRepositoryPort.js').OrderRepositoryPort} orderRepository
   * @param {string} [sepayApiToken='']
   * @param {Object} [bankConfig={}]
   */
  constructor(orderRepository, sepayApiToken = '', bankConfig = {}, notificationRepository = null) {
    this.orderRepo = orderRepository;
    this.sepayApiToken = sepayApiToken;
    this.bankConfig = bankConfig;
    this.liveEnabled = bankConfig.liveEnabled === true || String(process.env.SEPAY_LIVE_ENABLED || '').toLowerCase() === 'true';
    this.notifRepo = notificationRepository;
  }

  /**
   * Xac thuc quyen xem don hang cua nguoi yeu cau (IDOR Protection)
   * @param {Object} order
   * @param {Object|null} user - Thong tin nguoi dung dang nhap tu JWT
   * @param {string} [phone=''] - So dien thoai xac minh khach vang lai
   */
  authorizeOrderAccess(order, user, phone = '') {
    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng');
    }

    // Neu la admin hoac staff thi luon co quyen
    if (user && (user.role === 'admin' || user.role === 'staff')) {
      return true;
    }

    const orderUserId = order.userId || order.user_id;

    // 1. Neu co token dang nhap va la chu don hang
    if (user && orderUserId && user.id === orderUserId) {
      return true;
    }

    // 2. Neu co so dien thoai trung voi nguoi dat hoac nguoi nhan (chuan hoa +84 / 9-11 so)
    const cleanPhone = normalizeVnPhone(phone);
    const orderCustomerPhone = normalizeVnPhone(order.customerPhone || order.customer_phone || '');
    const orderRecipientPhone = normalizeVnPhone(order.recipientPhone || order.recipient_phone || '');

    if (cleanPhone && (cleanPhone === orderCustomerPhone || cleanPhone === orderRecipientPhone)) {
      return true;
    }

    // 3. Neu khong co token hop le va khong khop so dien thoai
    if (orderUserId) {
      if (!user && !cleanPhone) {
        throw new AuthenticationError('Đăng nhập hoặc cung cấp số điện thoại để kiểm tra đơn hàng này');
      }
      throw new ForbiddenError('Bạn không có quyền truy cập đơn hàng này');
    }

    if (!cleanPhone) {
      throw new AuthenticationError('Cần cung cấp số điện thoại để kiểm tra đơn guest');
    }

    throw new ForbiddenError('Số điện thoại không khớp với thông tin đơn hàng');
  }

  /**
   * Ghi nhan giao dich thanh toan SePay vao CSDL
   * Dam bao tinh nguyen tu ACID: status -> confirmed, payment_status -> paid
   * Khong cho phep cap nhat don da cancelled (ghi log de hoan tien thu cong)
   * @param {string} orderId
   * @param {string} providerTxId
   * @param {number} amount
   * @param {Object} [transaction={}]
   * @returns {Promise<{ processed: boolean, duplicate: boolean, cancelled?: boolean, order?: Object }>}
   */
  async recordPayment(orderId, providerTxId, amount, transaction = {}) {
    if (!providerTxId || providerTxId.length > 100) {
      throw new ValidationError('Mã giao dịch SePay không hợp lệ');
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new ValidationError('Số tiền thanh toán không hợp lệ');
    }

    const result = await this.orderRepo.recordPayment({
      orderId,
      providerTxId,
      amount,
      transaction
    });

    if (result.cancelled && !result.duplicate && result.recorded) {
      const orderCode = result.order?.order_code || result.order?.orderCode || orderId;
      console.warn(`[SePay Warning] Đơn hàng #${orderCode} đã bị hủy trước đó nhưng nhận được khoản thanh toán ${amount.toLocaleString()}đ (Mã GD: ${providerTxId}). Đã lưu vết payment_transactions để kế toán hoàn tiền thủ công.`);
    }

    if (result.recorded && !result.cancelled && this.notifRepo) {
      this.orderRepo.findOrderById(orderId).then(order => {
        if (order?.userId) {
          const code = order.orderCode || order.id;
          this.notifRepo.createNotification({
            userId: order.userId,
            orderId: order.id,
            title: 'Đã nhận thanh toán VietQR',
            message: `Tiệm đã nhận được khoản thanh toán ${Number(amount).toLocaleString('vi-VN')}₫ cho đơn hàng #${code}.`
          }).catch(err => console.error('[PaymentService] Lỗi tạo thông báo thanh toán:', err.message));
        }
      }).catch(() => {});
    }

    return result;
  }

  /**
   * Kiem tra trang thai thanh toan cua don hang (Polling & Gateway check)
   * @param {string} orderId
   * @param {Object} authContext
   * @param {Object|null} authContext.user
   * @param {string} [authContext.phone]
   * @returns {Promise<{ paid: boolean, order: Object, transaction?: Object, message?: string }>}
   */
  async checkPaymentStatus(orderId, { user, phone, intentId = null }) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
    }

    // IDOR Protection Check
    this.authorizeOrderAccess(order, user, phone);

    if (intentId) {
      const intent = (order.paymentIntents || []).find(item => item.id === intentId);
      if (!intent) throw new NotFoundError('Không tìm thấy mã thanh toán của đơn này');
      if (order.status === 'cancelled') {
        return { paid: false, cancelled: true, order, paymentIntent: intent, message: 'Đơn hàng đã bị hủy; giao dịch đã nhận cần shop đối soát' };
      }
      if (intent.status === 'paid') return { paid: true, settled: true, order, paymentIntent: intent };
      if (['cancelled', 'expired'].includes(intent.status)) {
        return { paid: false, cancelled: order.status === 'cancelled', order, paymentIntent: intent, message: 'Khoản thanh toán cần shop đối soát hoặc đã bị hủy' };
      }
      if ((process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') || !this.liveEnabled) {
        return { paid: false, order, paymentIntent: intent, message: 'Local simulation mode; chưa có giao dịch ngân hàng thật.' };
      }
      if (!this.sepayApiToken) {
        return { paid: false, order, paymentIntent: intent, message: 'SePay Sandbox Mode (Chưa cấu hình API Token)' };
      }
      try {
        const response = await fetch(`https://my.sepay.vn/userapi/transactions/list?search=${encodeURIComponent(intent.referenceCode)}`, {
          headers: { Authorization: `Bearer ${this.sepayApiToken}`, 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const payload = await response.json();
          const cleanRef = String(intent.referenceCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const match = (payload.transactions || []).find(tx => {
            const cleanMemo = String(tx.transaction_content || tx.content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const received = Number(tx.amount_in || tx.amount || 0);
            return cleanMemo.includes(cleanRef) && Number.isSafeInteger(received) && received > 0;
          });
          if (match) {
            const received = Number(match.amount_in || match.amount || 0);
            const record = await this.orderRepo.recordPaymentIntent({ paymentIntentId: intent.id,
              providerTxId: String(match.id || match.transaction_id), amount: received,
              transaction: { bankBrand: match.bank_brand_name || 'SePay', accountNumber: match.account_number || '', transactionDate: match.transaction_date } });
            if (record.processed) return { paid: true, settled: true, order: await this.orderRepo.findOrderById(order.id), paymentIntent: intent };
          }
        }
      } catch (error) {
        console.warn('[SePay Gateway] Lỗi đối soát mã thanh toán:', error.message);
      }
      return { paid: false, order, paymentIntent: intent };
    }

    // A11: Neu don hang khong phai phuong thuc sepay (vi du COD), khong kiem tra cong truc tuyen, luon tra paid: false
    if (order.paymentMethod !== 'sepay') {
      return {
        paid: false,
        order,
        message: 'Đơn hàng không áp dụng cổng thanh toán trực tuyến SePay'
      };
    }

    // A12: Đơn đã hủy phải dừng polling kể cả trước đó đã thu cọc.
    if (order.status === 'cancelled') {
      return { paid: false, cancelled: true, order, message: 'Đơn hàng đã bị hủy' };
    }

    // Với kế hoạch trả trước 50%, settled nghĩa là đã trả xong khoản SePay hiện tại,
    // còn phần tiền mặt lúc giao vẫn được thể hiện riêng trong amountToCollectAtDelivery.
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_paid' || order.paymentStatus === 'partially_refunded') {
      return {
        paid: true,
        order,
        settled: true,
        transaction: order.paymentTransactions?.[0] || null
      };
    }

    // Neu khong co API Token SePay: tra ve che do Sandbox / chua thanh toan
    if (!this.sepayApiToken) {
      return { paid: false, order, message: 'SePay Sandbox Mode (No API Token)' };
    }

    // Neu co API Token SePay: Goi SePay de doi soat truc tiep
    try {
      const activeIntent = order.paymentIntents?.find(intent => intent.status === 'pending');
      const searchCode = activeIntent?.referenceCode || order.orderCode || order.id;
      const res = await fetch(`https://my.sepay.vn/userapi/transactions/list?search=${encodeURIComponent(searchCode)}`, {
        headers: {
          'Authorization': `Bearer ${this.sepayApiToken}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        for (const tx of transactions) {
          const inAmount = Number(tx.amount_in || tx.amount || 0);
          const cleanMemo = String(tx.transaction_content || tx.content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const cleanActiveRef = activeIntent ? String(activeIntent.referenceCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
          const cleanOrderCode = String(order.orderCode || order.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

          if (activeIntent && cleanMemo.includes(cleanActiveRef) && inAmount === activeIntent.amount) {
            const recordRes = await this.orderRepo.recordPaymentIntent({
              paymentIntentId: activeIntent.id,
              providerTxId: String(tx.id || tx.transaction_id),
              amount: inAmount,
              transaction: { bankBrand: tx.bank_brand_name || 'SePay', accountNumber: tx.account_number || '', transactionDate: tx.transaction_date }
            });
            if (recordRes.processed) {
              const refreshedOrder = await this.orderRepo.findOrderById(order.id);
              return { paid: true, settled: true, order: refreshedOrder || order, transaction: tx };
            }
          } else if (!activeIntent && order.paymentPlan === 'legacy_sepay_full' && inAmount >= order.totalAmount) {
            const recordRes = await this.recordPayment(order.id, String(tx.id || tx.transaction_id), inAmount, {
              bankBrand: tx.bank_brand_name || 'SePay', accountNumber: tx.account_number || '', transactionDate: tx.transaction_date
            });
            if (recordRes.processed) {
              const refreshedOrder = await this.orderRepo.findOrderById(order.id);
              return { paid: true, settled: true, order: refreshedOrder || order, transaction: tx };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SePay Gateway] Lỗi kiểm tra API SePay:', err.message);
    }

    return { paid: false, order };
  }

  /**
   * Mo phong thanh toan demo cho moi truong dev/test
   * @param {string} orderId
   * @param {Object} authContext
   * @returns {Promise<{ paid: boolean, order: Object }>}
   */
  async simulatePayment(orderId, { user, phone, intentId = null }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Chế độ mô phỏng thanh toán bị vô hiệu hóa trong môi trường production');
    }

    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
    }

    // Kiem tra quyen IDOR
    this.authorizeOrderAccess(order, user, phone);

    const intent = intentId
      ? order.paymentIntents?.find(item => item.id === intentId)
      : order.paymentIntent;
    const canSimulateRedelivery = intent?.purpose === 'redelivery_fee';
    if ((order.paymentMethod !== 'sepay' && !canSimulateRedelivery) || !intent || intent.status !== 'pending' || order.status === 'cancelled') {
      throw new ValidationError('Đơn hàng không ở trạng thái chờ thanh toán SePay');
    }

    const simTxId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const result = await this.orderRepo.recordPaymentIntent({
      paymentIntentId: intent.id,
      providerTxId: simTxId,
      amount: intent.amount,
      transaction: {
        bankBrand: 'LOCAL-MOCK',
        accountNumber: '',
        transactionDate: new Date()
      }
    });

    if (!result.processed) {
      throw new ValidationError('Không thể ghi nhận mô phỏng thanh toán cho đơn hàng này');
    }

    const updatedOrder = await this.orderRepo.findOrderById(order.id);
    return { paid: true, settled: true, order: updatedOrder };
  }

  /**
   * Xu ly webhook goi tu may chu SePay
   * @param {Object} payload
   * @returns {Promise<{ success: boolean, processed?: boolean, duplicate?: boolean }>}
   */
  async processWebhook(payload) {
    const providerTxId = String(payload.id ?? '').trim();
    const content = String(payload.content || payload.transaction_content || '').toUpperCase();
    const transferType = String(payload.transferType || payload.transfer_type || '').toLowerCase();
    const amount = Number(payload.transferAmount ?? payload.amount_in);

    if (!providerTxId || providerTxId.length > 100 || transferType !== 'in' || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new ValidationError('Dữ liệu webhook không hợp lệ');
    }

    // Mã thanh toán riêng có ưu tiên; không suy đoán mục đích từ mã đơn.
    const intent = await this.orderRepo.findSepayPaymentIntentByContent(content);
    const storeUnmatched = () => this.orderRepo.recordUnmatchedPayment({
      providerTxId,
      content,
      amount,
      bankBrand: payload.gateway || payload.bank_brand_name || 'SePay',
      accountNumber: payload.accountNumber || payload.account_number || '',
      transactionDate: payload.transactionDate || Date.now()
    });
    if (intent?.ambiguous) {
      const recorded = await storeUnmatched();
      return { success: true, processed: false, duplicate: Boolean(recorded.duplicate), unmatched: true, needsReview: true, reason: 'ambiguous_reference' };
    }
    if (intent) {
      const result = await this.orderRepo.recordPaymentIntent({
        paymentIntentId: intent.id,
        providerTxId,
        amount,
        transaction: {
          bankBrand: payload.gateway || payload.bank_brand_name || 'SePay',
          accountNumber: payload.accountNumber || payload.account_number || '',
          transactionDate: payload.transactionDate || Date.now()
        }
      });

      if (result.processed && !result.cancelled && this.notifRepo) {
        const targetOrderId = intent.order_id || intent.orderId;
        if (targetOrderId) {
          this.orderRepo.findOrderById(targetOrderId).then(order => {
            if (order?.userId) {
              const code = order.orderCode || order.order_code || order.id;
              this.notifRepo.createNotification({
                userId: order.userId,
                orderId: order.id,
                title: 'Đã nhận thanh toán VietQR',
                message: `Tiệm đã nhận được khoản thanh toán ${Number(amount).toLocaleString('vi-VN')}₫ cho đơn hàng #${code}.`
              }).catch(err => console.error('[PaymentService] Lỗi tạo thông báo thanh toán intent:', err.message));
            }
          }).catch(() => {});
        }
      }

      return { success: true, processed: result.processed, duplicate: result.duplicate || false, cancelled: result.cancelled || false, needsReview: result.needsReview || false };
    }

    // Hỗ trợ giao dịch còn tồn của đơn SePay cũ trước migration.
    const candidate = await this.orderRepo.findSepayOrderByContent(content);
    if (!candidate) {
      const recorded = await storeUnmatched();
      return { success: true, processed: false, duplicate: Boolean(recorded.duplicate), unmatched: true, needsReview: true };
    }

    const recordResult = await this.recordPayment(candidate.id, providerTxId, amount, {
      bankBrand: payload.gateway || payload.bank_brand_name || 'SePay',
      accountNumber: payload.accountNumber || payload.account_number || '',
      transactionDate: payload.transactionDate || Date.now()
    });

    return {
      success: true,
      processed: recordResult.processed,
      duplicate: recordResult.duplicate || false,
      cancelled: recordResult.cancelled || false
    };
  }

  /** Liệt kê khoản webhook chưa gắn được mã thanh toán; chỉ nhân viên/Admin được gọi. */
  async listUnmatchedPayments(user) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được xem giao dịch cần đối soát');
    return this.orderRepo.findUnmatchedPayments();
  }

  /** Đóng một giao dịch lạ sau khi nhân viên đã kiểm tra và ghi chú cách xử lý. */
  async reviewUnmatchedPayment({ id, note, user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được đối soát giao dịch');
    const cleanNote = String(note || '').trim();
    if (cleanNote.length < 3 || cleanNote.length > 500) throw new ValidationError('Ghi chú đối soát phải có từ 3 đến 500 ký tự');
    return this.orderRepo.reviewUnmatchedPayment({ id, note: cleanNote, actorId: user.id });
  }
}
