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
  constructor(orderRepository, sepayApiToken = '', bankConfig = {}) {
    this.orderRepo = orderRepository;
    this.sepayApiToken = sepayApiToken;
    this.bankConfig = bankConfig;
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
  async checkPaymentStatus(orderId, { user, phone }) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
    }

    // IDOR Protection Check
    this.authorizeOrderAccess(order, user, phone);

    // A11: Neu don hang khong phai phuong thuc sepay (vi du COD), khong kiem tra cong truc tuyen, luon tra paid: false
    if (order.paymentMethod !== 'sepay') {
      return {
        paid: false,
        order,
        message: 'Đơn hàng không áp dụng cổng thanh toán trực tuyến SePay'
      };
    }

    // A11: Xac nhan da thanh toan khi paymentStatus la 'paid' hoac 'partially_refunded' (khong gop status === 'confirmed')
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') {
      return {
        paid: true,
        order,
        transaction: order.paymentTransactions?.[0] || null
      };
    }

    // A12: Don da huy thi tra ve ngay de client dung polling
    if (order.status === 'cancelled') {
      return {
        paid: false,
        cancelled: true,
        order,
        message: 'Đơn hàng đã bị hủy'
      };
    }

    // Neu khong co API Token SePay: tra ve che do Sandbox / chua thanh toan
    if (!this.sepayApiToken) {
      return { paid: false, order, message: 'SePay Sandbox Mode (No API Token)' };
    }

    // Neu co API Token SePay: Goi SePay de doi soat truc tiep
    try {
      const orderCode = order.orderCode || order.id;
      const res = await fetch(`https://my.sepay.vn/userapi/transactions/list?search=${encodeURIComponent(orderCode)}`, {
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
          if (inAmount >= order.totalAmount) {
            const recordRes = await this.recordPayment(
              order.id,
              String(tx.id || tx.transaction_id),
              inAmount,
              {
                bankBrand: tx.bank_brand_name || 'SePay',
                accountNumber: tx.account_number || '',
                transactionDate: tx.transaction_date
              }
            );
            if (recordRes.processed) {
              const refreshedOrder = await this.orderRepo.findOrderById(order.id);
              return { paid: true, order: refreshedOrder || order, transaction: tx };
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
  async simulatePayment(orderId, { user, phone }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Chế độ mô phỏng thanh toán bị vô hiệu hóa trong môi trường production');
    }

    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
    }

    // Kiem tra quyen IDOR
    this.authorizeOrderAccess(order, user, phone);

    if (order.paymentMethod !== 'sepay' || order.status !== 'pending' || order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') {
      throw new ValidationError('Đơn hàng không ở trạng thái chờ thanh toán SePay');
    }

    const simTxId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const result = await this.recordPayment(order.id, simTxId, order.totalAmount, {
      bankBrand: this.bankConfig?.bankCode || process.env.SEPAY_BANK_CODE || 'SePay Bank',
      accountNumber: this.bankConfig?.accountNumber || process.env.SEPAY_ACCOUNT_NUMBER || '',
      transactionDate: new Date()
    });

    if (!result.processed) {
      throw new ValidationError('Không thể ghi nhận mô phỏng thanh toán cho đơn hàng này');
    }

    const updatedOrder = await this.orderRepo.findOrderById(order.id);
    return { paid: true, order: updatedOrder };
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

    // Tim don hang phu hop voi noi dung chuyen khoan (pending hoac cancelled)
    const candidate = await this.orderRepo.findSepayOrderByContent(content);
    if (!candidate) {
      return { success: true, processed: false };
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
}
