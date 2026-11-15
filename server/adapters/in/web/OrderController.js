/**
 * OrderController.js - Express Controller dieu khien don hang tren MySQL 8.0
 * Thuoc tang Adapters / In / Web (Hexagonal Architecture)
 * Nhan HTTP request va dieu huong toi OrderService (Application Service)
 */

import { ValidationError, AuthenticationError, ForbiddenError } from '../../../domain/errors/DomainErrors.js';
import { normalizeVnPhone } from '../../../domain/utils/phone.js';
import { OrderService } from '../../../application/OrderService.js';

export class OrderController {
  /**
   * @param {import('../../../application/OrderService.js').OrderService | import('../../../ports/out/OrderRepositoryPort.js').OrderRepositoryPort} orderServiceOrRepo
   * @param {import('../../../ports/out/TokenPort.js').TokenPort | null} [tokenPort=null]
   */
  constructor(orderServiceOrRepo, tokenPort = null) {
    if (orderServiceOrRepo instanceof OrderService) {
      this.orderService = orderServiceOrRepo;
      this.orderRepo = orderServiceOrRepo.orderRepo;
    } else {
      // Tu dong wrap thanh OrderService neu inject repository
      this.orderService = new OrderService(orderServiceOrRepo);
      this.orderRepo = orderServiceOrRepo;
    }
    this.tokenPort = tokenPort;
  }

  _normalizePhone(raw) {
    return normalizeVnPhone(raw);
  }

  _signDraftToken(orderId) {
    if (!this.tokenPort || !orderId) return null;
    return this.tokenPort.generate({ purpose: 'order-draft', orderId }, { expiresIn: '2h' });
  }

  _parseOrderPayload(body = {}) {
    const customerName = String(body.customerName || body.customer_name || '').trim();
    const phone = this._normalizePhone(body.customerPhone || body.customer_phone || body.phone || '');
    const address = String(body.shippingAddress || body.shipping_address || body.address || '').trim();
    const deliveryArea = String(body.deliveryArea || body.delivery_area || '').trim();
    const email = String(body.email || body.customerEmail || body.customer_email || '').trim();
    let paymentPlan = String(body.paymentPlan || body.payment_plan || '').trim().toLowerCase();
    if (!paymentPlan) {
      const pm = String(body.paymentMethod || body.payment_method || '').trim().toLowerCase();
      if (pm === 'sepay_deposit' || pm === 'deposit') {
        paymentPlan = 'sepay_deposit';
      } else if (pm === 'sepay' || pm === 'sepay_full') {
        paymentPlan = 'sepay_full';
      } else {
        paymentPlan = process.env.NODE_ENV !== 'production' ? 'legacy_cod' : 'sepay_full';
      }
    }

    if (!customerName || customerName.length > 100) throw new ValidationError('Tên người đặt phải có từ 1 đến 100 ký tự');
    if (!/^0\d{8,10}$/.test(phone)) throw new ValidationError('Số điện thoại người đặt không hợp lệ (từ 9 đến 11 số)');
    if (!address || address.length > 255) throw new ValidationError('Địa chỉ giao hàng phải có từ 1 đến 255 ký tự');
    if (!deliveryArea) throw new ValidationError('Vui lòng chọn phường/xã giao hàng');
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new ValidationError('Email nhận biên nhận không hợp lệ');
    }
    if (!['sepay_full', 'sepay_deposit', 'legacy_cod'].includes(paymentPlan)) {
      throw new ValidationError('Đơn mới chỉ hỗ trợ chuyển khoản đủ 100% hoặc chuyển khoản trước 50%, phần còn lại thu tiền mặt khi giao');
    }
    const termsAccepted = body.termsAccepted === true || body.terms_accepted === true || (process.env.NODE_ENV !== 'production' && body.termsAccepted === undefined);
    if (!termsAccepted) {
      throw new ValidationError('Vui lòng xác nhận chính sách thanh toán, giao hàng và hủy đơn');
    }

    const items = (Array.isArray(body.items) ? body.items : [])
      .map(item => {
        const rawId = String(item?.productId || item?.product_id || item?.id || '').trim();
        const cleanProdId = rawId.replace(/__.*$/, '').trim();
        const rawAddons = Array.isArray(item?.addonIds || item?.addons)
          ? (item.addonIds || item.addons).map(a => typeof a === 'object' && a !== null ? String(a.id || a.addonId || '') : String(a)).map(s => s.trim()).filter(Boolean)
          : [];
        return {
          productId: cleanProdId,
          quantity: Number(item?.quantity),
          addonIds: [...new Set(rawAddons)]
        };
      })
      .filter(item => item.productId && item.productId !== 'undefined' && item.productId !== 'null');

    if (items.length < 1 || items.length > 25) {
      throw new ValidationError('Đơn hàng phải có từ 1 đến 25 dòng sản phẩm hợp lệ');
    }
    if (items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 25)) {
      throw new ValidationError('Số lượng sản phẩm trong đơn không hợp lệ');
    }

    const isGift = Boolean(body.isGift || body.is_gift);
    const isAnonymous = Boolean(body.isAnonymous || body.is_anonymous);
    const rawDeliveryDate = body.deliveryDate || body.delivery_date;
    const deliveryDate = rawDeliveryDate ? String(rawDeliveryDate).trim().slice(0, 50) : null;
    if (deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      throw new ValidationError('Định dạng ngày hẹn giao hoa không hợp lệ (chuẩn YYYY-MM-DD)');
    }

    const isGiftDelivery = isGift || isAnonymous;
    const recipientName = String(body.recipientName || body.recipient_name || customerName).trim();
    const recipientPhone = this._normalizePhone(body.recipientPhone || body.recipient_phone || phone);
    if (isGiftDelivery && (!recipientName || recipientName.length > 100 || !/^0\d{8,10}$/.test(recipientPhone))) {
      throw new ValidationError('Thông tin người nhận quà không hợp lệ');
    }
    const cardMessage = String(body.cardMessage || body.card_message || '').trim();
    const note = String(body.note || body.customerNote || body.customer_note || '').trim();
    if (cardMessage.length > 2000 || note.length > 2000) throw new ValidationError('Ghi chú không được vượt quá 2.000 ký tự');
    const voucherCode = body.voucherCode || body.voucher_code || null;
    if (voucherCode !== null && (typeof voucherCode !== 'string' || voucherCode.trim().length > 50)) {
      throw new ValidationError('Mã ưu đãi không hợp lệ');
    }

    return {
      items,
      customerName,
      phone,
      email,
      address,
      paymentMethod: String(body.paymentMethod || body.payment_method || (paymentPlan === 'legacy_cod' ? 'cod' : 'sepay')).toLowerCase(),
      paymentPlan,
      deliveryArea: deliveryArea.slice(0, 100),
      deliveryPlaceId: '',
      // Không tự thay tọa độ thiếu bằng vị trí tiệm; khách phải tự ghim điểm giao trên bản đồ.
      deliveryLatitude: body.deliveryLatitude ?? body.delivery_latitude ?? body.latitude ?? body.lat ?? null,
      deliveryLongitude: body.deliveryLongitude ?? body.delivery_longitude ?? body.longitude ?? body.lng ?? null,
      termsAccepted: true,
      termsVersion: 'payment-delivery-v1',
      voucherCode: voucherCode?.trim() || null,
      isGift: isGiftDelivery,
      isAnonymous,
      recipientName: isGiftDelivery ? recipientName : customerName,
      recipientPhone: isGiftDelivery ? recipientPhone : phone,
      deliveryDate,
      deliverySlot: String(body.deliverySlot || body.delivery_slot || '').trim().slice(0, 100),
      hasGreetingCard: Boolean(body.hasGreetingCard || body.has_greeting_card),
      cardMessage,
      note
    };
  }

  // POST /api/orders
  createOrder = async (req, res) => {
    try {
      // Guest order tao voi userId null; khong chap nhan userId tu body de tranh gan don vao tai khoan khac.
      const userId = req.user ? req.user.id : null;
      const orderData = this._parseOrderPayload(req.body || {});
      const newOrder = await this.orderService.createOrder({
        orderData,
        userId
      });
      const draftToken = this._signDraftToken(newOrder.id);
      return res.status(201).json(draftToken ? { ...newOrder, draftToken } : newOrder);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi createOrder:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi tạo đơn hàng' } });
    }
  };

  // POST /api/delivery/quote — giá tuyến luôn do backend tính.
  quoteDelivery = async (req, res) => {
    try {
      const quote = await this.orderService.quoteDelivery({
        address: req.body?.address,
        addressDetails: req.body?.addressDetails,
        area: req.body?.area || req.body?.deliveryArea || req.body?.delivery_area,
        latitude: req.body?.latitude ?? req.body?.deliveryLatitude ?? req.body?.delivery_latitude ?? req.body?.lat,
        longitude: req.body?.longitude ?? req.body?.deliveryLongitude ?? req.body?.delivery_longitude ?? req.body?.lng
      });
      return res.status(200).json(quote);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi quoteDelivery:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể tính phí giao hàng' } });
    }
  };

  getDeliveryMapConfig = async (_req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.status(200).json(this.orderService.getDeliveryMapConfig());
    } catch (err) {
      console.error('Loi getDeliveryMapConfig:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể tải cấu hình bản đồ giao hàng' } });
    }
  };

  suggestDeliveryAddresses = async (req, res) => {
    try {
      const suggestions = await this.orderService.suggestDeliveryAddresses(req.query?.q || '', req.query?.area || '');
      return res.status(200).json({ suggestions });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi suggestDeliveryAddresses:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể gợi ý địa chỉ' } });
    }
  };

  recordCashCollection = async (req, res) => {
    try {
      const order = await this.orderService.recordCashCollection({
        orderId: req.params.id,
        amount: Number(req.body?.amount),
        note: String(req.body?.note || ''),
        user: req.user
      });
      return res.status(200).json({ success: true, order });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi recordCashCollection:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể ghi nhận tiền thu khi giao' } });
    }
  };

  requestOrderChange = async (req, res) => {
    try {
      const result = await this.orderService.requestOrderChange({
        orderId: req.params.id, changeType: String(req.body?.changeType || ''), value: req.body?.value || {},
        user: req.user, phone: req.body?.phone || ''
      });
      return res.status(201).json(result);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi requestOrderChange:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể gửi yêu cầu đổi đơn' } });
    }
  };

  reviewOrderChange = async (req, res) => {
    try {
      const result = await this.orderService.reviewOrderChange({ requestId: req.params.requestId, approved: req.body?.approved === true, user: req.user });
      return res.status(200).json(result);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi reviewOrderChange:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể xử lý yêu cầu đổi đơn' } });
    }
  };

  requestCancellation = async (req, res) => {
    try {
      const request = await this.orderService.requestOrderCancellation({
        orderId: req.params.id, reason: req.body?.reason, user: req.user, phone: req.body?.phone || ''
      });
      return res.status(201).json({ success: true, request });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi requestCancellation:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể gửi yêu cầu hủy đơn' } });
    }
  };

  reviewCancellation = async (req, res) => {
    try {
      const result = await this.orderService.reviewCancellationRequest({
        requestId: req.params.requestId, approved: req.body?.approved === true,
        deductibleAmount: Number(req.body?.deductibleAmount || 0), costBreakdown: req.body?.costBreakdown || [],
        evidenceNote: String(req.body?.evidenceNote || ''), user: req.user
      });
      return res.status(200).json({ success: true, result });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi reviewCancellation:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể xử lý yêu cầu hủy đơn' } });
    }
  };

  recordDeliveryAttempt = async (req, res) => {
    try {
      const result = await this.orderService.recordDeliveryAttempt({
        orderId: req.params.id, action: String(req.body?.action || ''), reason: req.body?.reason,
        contactLog: req.body?.contactLog, user: req.user
      });
      return res.status(200).json({ success: true, attempt: result });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi recordDeliveryAttempt:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể ghi nhận lần giao' } });
    }
  };

  createRedeliveryPayment = async (req, res) => {
    try {
      const intent = await this.orderService.createRedeliveryPaymentIntent({ orderId: req.params.id, user: req.user });
      return res.status(201).json({ success: true, paymentIntent: intent });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi createRedeliveryPayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể tạo khoản phí giao lại' } });
    }
  };

  // PUT /api/orders/:id/draft
  updateDraftOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const draftToken = body.draftToken;
      if (!draftToken || typeof draftToken !== 'string') {
        throw new AuthenticationError('Thiếu mã xác thực đơn nháp');
      }
      if (!this.tokenPort) {
        throw new Error('OrderController thiếu tokenPort để xác thực đơn nháp');
      }
      const decoded = this.tokenPort.verify(draftToken);
      if (!decoded || decoded.purpose !== 'order-draft' || String(decoded.orderId) !== String(id)) {
        throw new ForbiddenError('Mã xác thực đơn nháp không khớp với đơn hàng này');
      }

      const userId = req.user ? req.user.id : null;
      const orderData = this._parseOrderPayload(body);
      const updatedOrder = await this.orderService.updateDraftOrder({
        orderId: id,
        orderData,
        userId
      });
      const nextDraftToken = this._signDraftToken(updatedOrder.id);
      return res.status(200).json(nextDraftToken ? { ...updatedOrder, draftToken: nextDraftToken } : updatedOrder);
    } catch (err) {
      if (err.name === 'AuthenticationError') {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
      }
      if (err.name === 'ForbiddenError') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi updateDraftOrder:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi cập nhật đơn hàng nháp' } });
    }
  };

  // GET /api/orders
  getOrders = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Yeu cau dang nhap de xem danh sach don hang' } });
      }

      const orders = await this.orderService.getOrders({
        userId: user.id,
        role: user.role
      });
      return res.status(200).json(orders);
    } catch (err) {
      console.error('Loi getOrders:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay danh sach don hang' } });
    }
  };

  // POST /api/orders/lookup: tra cuu don guest bang ma don + so dien thoai nguoi dat/nhan.
  lookupGuestOrder = async (req, res) => {
    try {
      const orderCode = String(req.body.orderCode || '').trim().toUpperCase();
      const phone = this._normalizePhone(req.body.phone || '');
      if (!/^(?:DH[A-Z0-9]{6,40}|ORD-[A-Z0-9-]{6,45})$/.test(orderCode) || !/^0\d{8,10}$/.test(phone)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Vui lòng nhập mã đơn và số điện thoại hợp lệ (9 đến 11 số)' } });
      }

      const order = await this.orderService.lookupGuestOrder(orderCode, phone);
      return res.status(200).json(order);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi lookupGuestOrder:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi tra cứu đơn hàng' } });
    }
  };

  // GET /api/orders/:id
  getOrderById = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await this.orderService.getOrderById(id, req.user || null);
      return res.status(200).json(order);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      if (err.name === 'AuthenticationError') {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
      }
      if (err.name === 'ForbiddenError') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      }
      console.error('Loi getOrderById:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay chi tiet don hang' } });
    }
  };

  // PATCH /api/orders/:id/status
  updateOrderStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user;

      const result = await this.orderService.updateOrderStatus(id, status, user);
      return res.status(200).json({
        success: true,
        order: result.order,
        cancellationRequest: result.cancellationRequest || null,
        notification: result.notification
      });
    } catch (err) {
      if (err.name === 'AuthenticationError') {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
      }
      if (err.name === 'ForbiddenError') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      }
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'INVALID_STATUS_TRANSITION', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi updateOrderStatus:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi cap nhat trang thai don hang' } });
    }
  };
}
