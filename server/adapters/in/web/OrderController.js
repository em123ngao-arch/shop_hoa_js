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
    const email = String(body.email || body.customerEmail || body.customer_email || '').trim();
    const paymentMethod = String(body.paymentMethod || body.payment_method || 'cod').toLowerCase();

    if (!customerName || customerName.length > 100) throw new ValidationError('Tên người đặt phải có từ 1 đến 100 ký tự');
    if (!/^0\d{8,10}$/.test(phone)) throw new ValidationError('Số điện thoại người đặt không hợp lệ (từ 9 đến 11 số)');
    if (!address || address.length > 255) throw new ValidationError('Địa chỉ giao hàng phải có từ 1 đến 255 ký tự');
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new ValidationError('Email nhận biên nhận không hợp lệ');
    }
    if (!['cod', 'sepay'].includes(paymentMethod)) throw new ValidationError('Phương thức thanh toán không hợp lệ');

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
      paymentMethod,
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
      console.error('Loi createOrder:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Lỗi tạo đơn hàng' } });
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
