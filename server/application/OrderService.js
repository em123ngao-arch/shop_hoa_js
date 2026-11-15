/**
 * OrderService.js - Application Service quan ly nghiep vu don hang (Pricing, Validation, Voucher)
 * Thuoc tang Application (Clean / Hexagonal Architecture: 0 Express, 0 Prisma dependencies)
 * Quyết định toàn bộ logic tính toán giá hoa, phụ kiện và voucher trước khi gọi Persistence Port
 */

import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '../domain/errors/DomainErrors.js';
import { normalizeVnPhone } from '../domain/utils/phone.js';
import { DeliveryService } from './DeliveryService.js';

function maskPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length <= 3) return digits ? '***' : '';
  return `${'*'.repeat(Math.max(4, digits.length - 3))}${digits.slice(-3)}`;
}

function maskName(raw) {
  const name = String(raw || '').trim();
  if (!name) return 'Khách đặt hoa';
  const parts = name.split(/\s+/);
  const first = parts[0];
  return `${first.charAt(0).toUpperCase()}${first.slice(1, 2)}***${parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0)}***` : ''}`;
}

function maskAddress(raw) {
  const addr = String(raw || '').trim();
  if (!addr) return 'Thông tin giao hàng được ẩn để bảo mật';
  const segments = addr.split(',').map(s => s.trim()).filter(Boolean);
  if (segments.length >= 2) {
    return `***, ${segments[segments.length - 1]}`;
  }
  return 'Thông tin giao hàng được ẩn để bảo mật';
}

function toGuestLookupDTO(order) {
  return {
    id: order.id,
    orderCode: order.orderCode || order.order_code,
    order_code: order.orderCode || order.order_code,
    isGuestLookup: true,
    customerName: maskName(order.customerName),
    recipientName: maskName(order.recipientName || order.customerName),
    phone: maskPhone(order.customerPhone || order.phone),
    customerPhone: maskPhone(order.customerPhone || order.phone),
    recipientPhone: maskPhone(order.recipientPhone || order.customerPhone || order.phone),
    isGift: Boolean(order.isGift),
    address: maskAddress(order.shippingAddress || order.address),
    shippingAddress: maskAddress(order.shippingAddress || order.address),
    deliveryArea: order.deliveryArea || '',
    deliverySlot: order.deliverySlot || 'Giao trong ngày',
    hasGreetingCard: Boolean(order.hasGreetingCard),
    cardMessage: '',
    note: '',
    shippingFee: order.shippingFee,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentPlan: order.paymentPlan || 'legacy_cod',
    paymentStatus: order.paymentStatus,
    paymentIntent: order.paymentIntent || null,
    amountReceived: Number(order.amountReceived || 0),
    amountToCollectAtDelivery: Number(order.amountToCollectAtDelivery || 0),
    amountCredit: Number(order.amountCredit || 0),
    changeRequests: order.changeRequests || [],
    cancellationRequests: order.cancellationRequests || [],
    voucherCode: order.voucherCode || null,
    createdAt: order.createdAt,
    completedAt: order.completedAt || null,
    items: (order.items || []).map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName || item.name,
      name: item.name || item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? item.price,
      price: item.price ?? item.unitPrice,
      imageUrl: item.imageUrl || item.image || '/images/bloom-of-spring.png',
      categoryId: item.categoryId,
      addons: item.addons || [],
      addonsText: item.addonsText || ''
    }))
  };
}

export class OrderService {
  /**
   * @param {import('../ports/out/OrderRepositoryPort.js').OrderRepositoryPort} orderRepository
   */
  constructor(orderRepository, deliveryService = new DeliveryService(), deliveryQuoteTtlHours = 24, notificationRepository = null) {
    this.orderRepo = orderRepository;
    this.deliveryService = deliveryService;
    this.deliveryQuoteTtlHours = Math.max(1, Number(deliveryQuoteTtlHours) || 24);
    this.notifRepo = notificationRepository;
  }

  /** Tạo báo giá giao hàng; endpoint xem phí và tạo đơn cùng gọi một nguồn quy tắc. */
  async quoteDelivery(addressData = {}) {
    const area = String(addressData.area || addressData.deliveryArea || '').trim();
    if (!area) throw new ValidationError('Vui lòng chọn phường/xã giao hàng');
    const quote = await this.deliveryService.quote({
      address: addressData.address || addressData.shippingAddress,
      addressDetails: addressData.addressDetails || addressData.address_details || '',
      area,
      latitude: addressData.latitude ?? addressData.deliveryLatitude ?? addressData.delivery_latitude ?? addressData.lat,
      longitude: addressData.longitude ?? addressData.deliveryLongitude ?? addressData.delivery_longitude ?? addressData.lng
    });
    if (!quote.serviceable) {
      throw new ValidationError(quote.message || 'Địa chỉ này ngoài phạm vi giao hiện tại');
    }
    return quote;
  }

  getDeliveryMapConfig() {
    return this.deliveryService.getMapConfig();
  }

  async suggestDeliveryAddresses(query = '', area = '') {
    return this.deliveryService.suggest(query, area);
  }

  /** Lưu yêu cầu thủ công cho dữ liệu cũ/ngoại lệ; đơn mới dùng phí cố định theo phường. */
  async createManualDeliveryQuoteRequest({ orderData, userId = null }) {
    const quote = await this.quoteDelivery(orderData);
    if (!quote.pinProvided) throw new ValidationError('Ghim vị trí nhận hàng trước khi yêu cầu shop báo phí');
    if (!quote.manualQuoteRequired && !quote.requiresShopConfirmation) {
      throw new ValidationError('Địa chỉ đã có phí tự động. Hãy quay lại bước thanh toán để tiếp tục.');
    }
    if (!['sepay_full', 'sepay_deposit'].includes(orderData.paymentPlan)) {
      throw new ValidationError('Báo giá thủ công chỉ hỗ trợ chuyển khoản đủ hoặc trả trước 50%');
    }
    if (orderData.deliveryDate) this.validateDeliveryDate(orderData.deliveryDate);
    return this.orderRepo.createDeliveryQuoteRequest({
      userId,
      customerName: orderData.customerName,
      customerPhone: orderData.phone,
      customerEmail: orderData.email,
      shippingAddress: orderData.address,
      deliveryArea: orderData.deliveryArea,
      deliveryLatitude: quote.latitude,
      deliveryLongitude: quote.longitude,
      deliveryDistanceMeters: quote.distanceMeters,
      deliverySnapOffsetMeters: quote.snappedOffsetMeters,
      deliveryRouteProvider: quote.provider,
      deliveryDate: orderData.deliveryDate,
      deliverySlot: orderData.deliverySlot,
      paymentPlan: orderData.paymentPlan,
      payload: orderData,
      quote,
      ttlHours: this.deliveryQuoteTtlHours
    });
  }

  /** Khách vãng lai xác thực yêu cầu bằng mã báo giá và số điện thoại người đặt. */
  async getManualDeliveryQuote({ requestCode, phone }) {
    const normalizedPhone = normalizeVnPhone(phone || '');
    if (!/^0\d{8,10}$/.test(normalizedPhone)) throw new ValidationError('Nhập số điện thoại người đặt hợp lệ');
    const request = await this.orderRepo.findDeliveryQuoteRequestByCode(requestCode);
    if (!request || normalizeVnPhone(request.customer_phone) !== normalizedPhone) {
      throw new NotFoundError('Không tìm thấy báo giá khớp với mã và số điện thoại');
    }
    if (request.status === 'quoted' && request.quote_expires_at && request.quote_expires_at <= new Date()) {
      await this.orderRepo.expireDeliveryQuoteRequest(request.id);
      request.status = 'expired';
    }
    return {
      requestCode: request.request_code,
      status: request.status,
      shippingAddress: request.shipping_address,
      deliveryArea: request.delivery_area,
      deliveryDate: request.delivery_date,
      deliverySlot: request.quoted_delivery_slot || request.delivery_slot,
      quotedDeliveryDate: request.quoted_delivery_date || request.delivery_date,
      distanceMeters: request.delivery_distance_meters,
      routeProvider: request.delivery_route_provider,
      shippingFee: request.quoted_shipping_fee,
      shopNote: request.shop_note || '',
      expiresAt: request.quote_expires_at,
      orderId: request.orders?.id || null,
      orderCode: request.orders?.order_code || null,
      orderStatus: request.orders?.status || null,
      paymentStatus: request.orders?.payment_status || null,
      paymentPlan: request.orders?.payment_plan || request.payment_plan,
      totalAmount: request.orders?.total_amount ?? null,
      paymentIntent: (() => {
        const intent = request.orders?.payment_intents?.find(item => item.status === 'pending') || request.orders?.payment_intents?.[0];
        return intent ? { id: intent.id, purpose: intent.purpose, referenceCode: intent.reference_code, amount: intent.amount, status: intent.status } : null;
      })()
    };
  }

  async listManualDeliveryQuoteRequests() {
    return this.orderRepo.listDeliveryQuoteRequests();
  }

  async declineManualDeliveryQuote({ requestCode, phone }) {
    const normalizedPhone = normalizeVnPhone(phone || '');
    if (!/^0\d{8,10}$/.test(normalizedPhone)) throw new ValidationError('Nhập số điện thoại người đặt hợp lệ');
    const request = await this.orderRepo.findDeliveryQuoteRequestByCode(requestCode);
    if (!request || normalizeVnPhone(request.customer_phone) !== normalizedPhone) {
      throw new NotFoundError('Không tìm thấy báo giá khớp với mã và số điện thoại');
    }
    if (request.status !== 'quoted') throw new ValidationError('Báo giá không còn ở trạng thái chờ khách phản hồi');
    await this.orderRepo.declineDeliveryQuoteRequest({ requestId: request.id, reviewerId: null, shopNote: 'Khách không đồng ý báo giá' });
    return { success: true, status: 'declined' };
  }

  /** Shop báo phí hoặc từ chối; phí và thời hạn do server kiểm tra, không nhận từ khách. */
  async updateManualDeliveryQuote({ requestId, action, shippingFee, shopNote = '', deliveryDate = '', deliverySlot = '', user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được xử lý yêu cầu báo giá');
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (normalizedAction === 'quoted') {
      const fee = Number(shippingFee);
      if (!Number.isSafeInteger(fee) || fee < 0 || fee > 500000) throw new ValidationError('Phí giao phải từ 0 đến 500.000đ');
      if (String(shopNote || '').length > 1000) throw new ValidationError('Ghi chú báo giá tối đa 1.000 ký tự');
      const acceptedDate = String(deliveryDate || '').trim() || null;
      if (!acceptedDate) throw new ValidationError('Chọn ngày giao shop đã kiểm tra sức chứa trước khi gửi báo giá');
      this.validateDeliveryDate(acceptedDate);
      const acceptedSlot = String(deliverySlot || '').trim().slice(0, 100) || null;
      const allowedSlots = ['Sáng (08:00 - 12:00)', 'Chiều (13:00 - 17:00)', 'Tối (18:00 - 21:00)', 'Hỏa tốc trong 2h'];
      if (!allowedSlots.includes(acceptedSlot)) throw new ValidationError('Chọn khung giao shop đã kiểm tra trước khi gửi báo giá');
      return this.orderRepo.quoteDeliveryRequest({ requestId, shippingFee: fee, shopNote: String(shopNote || '').trim(), reviewerId: user.id,
        deliveryDate: acceptedDate, deliverySlot: acceptedSlot, ttlHours: this.deliveryQuoteTtlHours });
    }
    if (normalizedAction === 'reviewing') return this.orderRepo.markDeliveryQuoteReviewing({ requestId, reviewerId: user.id });
    if (normalizedAction === 'declined') return this.orderRepo.declineDeliveryQuoteRequest({ requestId, reviewerId: user.id, shopNote: String(shopNote || '').trim() });
    throw new ValidationError('Thao tác báo giá không hợp lệ');
  }

  /** Xác nhận báo giá rồi tạo đơn bằng giá đã duyệt, tính lại toàn bộ giá hàng/voucher trên server. */
  async acceptManualDeliveryQuote({ requestCode, phone, paymentPlan, userId = null }) {
    const normalizedPhone = normalizeVnPhone(phone || '');
    if (!/^0\d{8,10}$/.test(normalizedPhone)) throw new ValidationError('Nhập số điện thoại người đặt hợp lệ');
    if (!['sepay_full', 'sepay_deposit'].includes(paymentPlan)) throw new ValidationError('Phương thức thanh toán không hợp lệ');
    const request = await this.orderRepo.findDeliveryQuoteRequestByCode(requestCode);
    if (!request || normalizeVnPhone(request.customer_phone) !== normalizedPhone) {
      throw new NotFoundError('Không tìm thấy báo giá khớp với mã và số điện thoại');
    }
    if (request.status === 'accepted' && request.orders) {
      if (request.orders.status === 'cancelled') throw new ValidationError('Đơn từ báo giá này đã hết hạn hoặc bị hủy. Vui lòng liên hệ shop để được hỗ trợ.');
      return this.orderRepo.findOrderById(request.orders.id);
    }
    if (request.status === 'quoted' && request.quote_expires_at && request.quote_expires_at <= new Date()) {
      await this.orderRepo.expireDeliveryQuoteRequest(request.id);
      throw new ValidationError('Báo giá đã hết hạn. Vui lòng gửi yêu cầu báo giá mới.');
    }
    if (request.status !== 'quoted' || !Number.isSafeInteger(Number(request.quoted_shipping_fee))) {
      throw new ValidationError('Yêu cầu chưa có báo giá còn hiệu lực để xác nhận');
    }
    let orderData;
    try { orderData = JSON.parse(request.payload_json); }
    catch { throw new ValidationError('Dữ liệu yêu cầu báo giá bị lỗi; vui lòng liên hệ shop'); }
    orderData.paymentPlan = paymentPlan;
    orderData.paymentMethod = 'sepay';
    orderData.phone = request.customer_phone;
    orderData.termsAccepted = true;
    orderData.deliveryQuoteOverride = {
      serviceable: true,
      requiresShopConfirmation: false,
      manualQuoteRequired: false,
      zoneId: 'manual-approved',
      zoneName: 'Phí do shop báo thủ công',
      area: request.delivery_area,
      fee: Number(request.quoted_shipping_fee),
      latitude: request.delivery_latitude,
      longitude: request.delivery_longitude,
      distanceMeters: request.delivery_distance_meters,
      snappedOffsetMeters: request.delivery_snap_offset_meters,
      pinProvided: true,
      provider: 'shop-manual',
      rateVersion: 'manual-quote-v1',
      quotedAt: request.reviewed_at || new Date()
    };
    orderData.deliveryDate = request.quoted_delivery_date || request.delivery_date || orderData.deliveryDate;
    orderData.deliverySlot = request.quoted_delivery_slot || request.delivery_slot || orderData.deliverySlot;
    return this.createOrder({ orderData, userId: request.user_id || userId, deliveryQuoteRequestId: request.id });
  }

  async recordCashCollection({ orderId, amount, note = '', user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được ghi nhận tiền thu khi giao');
    return this.orderRepo.recordCashCollection({ orderId, amount, note, actorId: user.id });
  }

  async requestOrderChange({ orderId, changeType, value, user, phone = '' }) {
    const customerPhone = user ? '' : normalizeVnPhone(phone || '');
    if (!user && !/^0\d{8,10}$/.test(customerPhone)) throw new AuthenticationError('Tra cứu đơn bằng mã đơn và số điện thoại đã đặt để đổi thông tin');
    if (!['address', 'phone', 'recipient'].includes(changeType)) throw new ValidationError('Loại thông tin cần đổi không hợp lệ');
    let deliveryQuote = null;
    if (changeType === 'address') {
      const streetAddress = String(value.address || '').trim();
      const addressDetails = String(value.addressDetails || '').trim();
      const area = String(value.area || '').trim();
      if (!streetAddress) throw new ValidationError('Nhập số nhà và tên đường cho địa chỉ giao mới');
      const fullAddress = [streetAddress, addressDetails, area, 'Thành phố Hồ Chí Minh'].filter(Boolean).join(', ');
      if (fullAddress.length > 255) throw new ValidationError('Địa chỉ giao mới quá dài; vui lòng rút gọn thông tin chỉ dẫn');
      deliveryQuote = await this.quoteDelivery({
        address: streetAddress, addressDetails, area,
        latitude: value.latitude ?? value.deliveryLatitude,
        longitude: value.longitude ?? value.deliveryLongitude
      });
      if (!deliveryQuote.pinProvided) {
        throw new ValidationError('Ghim vị trí nhận hàng trên bản đồ trước khi gửi yêu cầu đổi địa chỉ');
      }
      if (deliveryQuote.requiresShopConfirmation) {
        throw new ValidationError(deliveryQuote.message || 'Shop cần xác nhận vị trí giao mới trước khi áp dụng');
      }
      value = {
        ...value, address: fullAddress, area, addressDetails: '', placeId: '',
        latitude: deliveryQuote.latitude, longitude: deliveryQuote.longitude
      };
    }
    if (['phone', 'recipient'].includes(changeType)) {
      const phone = normalizeVnPhone(value.phone || '');
      if (!/^0\d{8,10}$/.test(phone)) throw new ValidationError('Số điện thoại mới không hợp lệ');
      value.phone = phone;
    }
    return this.orderRepo.requestOrderChange({ orderId, userId: user?.id || null, customerPhone, changeType, value, deliveryQuote });
  }

  async reviewOrderChange({ requestId, approved, user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được duyệt yêu cầu đổi đơn');
    return this.orderRepo.reviewOrderChange({ requestId, approved: Boolean(approved), reviewerId: user.id });
  }

  async requestOrderCancellation({ orderId, reason, user, phone = '' }) {
    const customerPhone = user ? '' : normalizeVnPhone(phone || '');
    if (!user && !/^0\d{8,10}$/.test(customerPhone)) throw new AuthenticationError('Tra cứu đơn bằng mã đơn và số điện thoại đã đặt để yêu cầu hủy');
    return this.orderRepo.requestOrderCancellation({ orderId, userId: user?.id || null, customerPhone, reason });
  }

  async reviewCancellationRequest({ requestId, approved, deductibleAmount, costBreakdown, evidenceNote, user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được xử lý yêu cầu hủy');
    if (!Array.isArray(costBreakdown)) throw new ValidationError('Danh sách chi phí phát sinh không hợp lệ');
    return this.orderRepo.reviewCancellationRequest({ requestId, approved: Boolean(approved), reviewerId: user.id,
      deductibleAmount, costBreakdown, evidenceNote });
  }

  async recordDeliveryAttempt({ orderId, action, reason, contactLog, user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên giao hàng được ghi nhận lần giao');
    return this.orderRepo.recordDeliveryAttempt({ orderId, action, actorId: user.id, actorRole: user.role, reason, contactLog });
  }

  async createRedeliveryPaymentIntent({ orderId, user }) {
    if (!user || !['admin', 'staff'].includes(user.role)) throw new ForbiddenError('Chỉ nhân viên được tạo khoản phí giao lại');
    return this.orderRepo.createRedeliveryPaymentIntent({ orderId, actorId: user.id });
  }

  /**
   * Tinh toan nghiep vu don gia, phu kien, voucher va tong tien don hang (Pricing Engine)
   * Dam bao toan bo quy tac nghiep vu tinh tien nam o tang Application
   * @param {Object} orderData
   * @returns {Promise<Object>}
   */
  async calculateOrderPricing(orderData) {
    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new ValidationError('Danh sách sản phẩm trong đơn hàng không được để trống');
    }

    // 1. Thu thap toan bo Product IDs va Addon IDs
    const productIds = orderData.items.map(i => String(i.productId || i.product_id || i.id || '').trim());
    const allAddonIds = [];
    for (const item of orderData.items) {
      const rawAddons = Array.isArray(item.addonIds || item.addons)
        ? (item.addonIds || item.addons).map(a => typeof a === 'object' && a !== null ? String(a.id || a.addonId || '') : String(a)).map(s => s.trim()).filter(Boolean)
        : [];
      // Deduplicate theo tung item
      const uniqueAddonIds = [...new Set(rawAddons)];
      allAddonIds.push(...uniqueAddonIds);
    }
    const distinctAddonIds = [...new Set(allAddonIds)];

    // 2. Tra cuu du lieu san pham va phu kien tu Outbound Port
    const dbProducts = await this.orderRepo.findProductsForPricing(productIds);
    const dbAddons = distinctAddonIds.length > 0 ? await this.orderRepo.findActiveAddonsByIds(distinctAddonIds) : [];

    let subtotal = 0;
    const verifiedItems = [];

    // 3. Tinh toan tung dong san pham kem phu kien
    for (const item of orderData.items) {
      const prodId = String(item.productId || item.product_id || item.id || '').trim();
      const qty = Number(item.quantity);
      if (!Number.isSafeInteger(qty) || qty < 1 || qty > 25) {
        throw new ValidationError('Số lượng sản phẩm phải là số nguyên từ 1 đến 25');
      }

      const prod = dbProducts.find(p => p.id === prodId || (p.id && /^\d+$/.test(prodId) && p.id === `PROD-${prodId.padStart(3, '0')}`));
      if (!prod || !prod.is_active) {
        throw new ValidationError(`Sản phẩm '${item.name || prodId}' không tồn tại hoặc đã ngừng kinh doanh`);
      }

      // Xu ly phu kien (Co Deduplication loai trung)
      const rawAddons = Array.isArray(item.addonIds || item.addons)
        ? (item.addonIds || item.addons).map(a => typeof a === 'object' && a !== null ? String(a.id || a.addonId || '') : String(a)).map(s => s.trim()).filter(Boolean)
        : [];
      const itemAddonIds = [...new Set(rawAddons)];

      let itemAddonsTotal = 0;
      const verifiedItemAddons = [];

      for (const addonId of itemAddonIds) {
        const dbAddon = dbAddons.find(a => a.id === addonId);
        if (!dbAddon || !dbAddon.is_active) {
          throw new ValidationError(`Phụ kiện '${addonId}' không tồn tại hoặc đã ngừng kinh doanh`);
        }
        itemAddonsTotal += Number(dbAddon.price);
        verifiedItemAddons.push({
          id: `ADDON-ITEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          addonId: dbAddon.id,
          addonName: dbAddon.name,
          unitPrice: Number(dbAddon.price)
        });
      }

      const unitPrice = Number(prod.price) + itemAddonsTotal;
      subtotal += unitPrice * qty;

      verifiedItems.push({
        id: `ITEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        productId: prod.id,
        productName: prod.name,
        unitPrice: unitPrice,
        basePrice: Number(prod.price),
        quantity: qty,
        originalPrice: Number(prod.original_price || prod.price) + itemAddonsTotal,
        categoryId: prod.category_id,
        imageUrl: prod.image_url,
        addons: verifiedItemAddons
      });
    }

    // 4. Kiem tra & Tinh toan Voucher giam gia tren Application Layer
    let discountAmount = 0;
    let appliedVoucherCode = null;
    let voucherSnapshot = null;
    const rawCode = orderData.voucherCode || orderData.voucher_code;

    if (rawCode && typeof rawCode === 'string') {
      const cleanCode = rawCode.trim().toUpperCase();
      const voucher = await this.orderRepo.findVoucherByCode(cleanCode);

      if (voucher && voucher.is_active) {
        const now = new Date();
        const isStarted = !voucher.start_date || voucher.start_date <= now;
        const isNotExpired = !voucher.end_date || voucher.end_date >= now;
        const hasLimit = voucher.usage_limit === null || voucher.used_count < voucher.usage_limit;

        if (isStarted && isNotExpired && hasLimit && subtotal >= voucher.min_order) {
          let eligibleItems = verifiedItems;
          let targetIds = [];
          try {
            targetIds = JSON.parse(voucher.scope === 'category'
              ? (voucher.target_category_ids || '[]')
              : (voucher.target_product_ids || '[]'));
          } catch (e) {
            targetIds = [];
          }
          if (voucher.scope === 'category') {
            eligibleItems = verifiedItems.filter(item => targetIds.includes(String(item.categoryId)));
          } else if (voucher.scope === 'product') {
            eligibleItems = verifiedItems.filter(item => targetIds.includes(String(item.productId)));
          }

          const eligibleAmount = eligibleItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

          if (eligibleAmount > 0) {
            appliedVoucherCode = voucher.code;
            if (voucher.discount_type === 'percent') {
              const rawDiscount = Math.round((eligibleAmount * voucher.discount_value) / 100);
              discountAmount = voucher.max_discount ? Math.min(rawDiscount, voucher.max_discount) : rawDiscount;
            } else {
              discountAmount = Math.min(Number(voucher.discount_value), eligibleAmount);
            }

            voucherSnapshot = {
              code: voucher.code,
              name: voucher.name,
              discountType: voucher.discount_type,
              discountValue: Number(voucher.discount_value),
              scope: voucher.scope,
              maxDiscount: voucher.max_discount ? Number(voucher.max_discount) : null,
              discountAmount,
              eligibleAmount
            };
          }
        }
      }
    }

    // 5. Phí tra theo vùng/phường do server cấu hình; không dùng giá hay quãng đường từ trình duyệt.
    const deliveryQuote = orderData.deliveryQuoteOverride || await this.quoteDelivery(orderData);
    if (!deliveryQuote.pinProvided) {
      throw new ValidationError('Chọn vị trí nhận hàng trên bản đồ để tiệm có thể giao đúng địa chỉ');
    }
    if (deliveryQuote.requiresShopConfirmation || deliveryQuote.manualQuoteRequired) {
      throw new ValidationError(deliveryQuote.message || 'Shop cần xác nhận vị trí ghim trước khi nhận đơn');
    }
    if (!Number.isSafeInteger(Number(deliveryQuote.fee)) || Number(deliveryQuote.fee) < 0) {
      throw new ValidationError('Chưa có phí giao hợp lệ; vui lòng yêu cầu shop báo giá');
    }
    const shippingFee = deliveryQuote.fee;
    const totalAmount = Math.max(0, subtotal - discountAmount) + shippingFee;

    return {
      verifiedItems,
      subtotal,
      discountAmount,
      shippingFee,
      deliveryQuote,
      totalAmount,
      appliedVoucherCode,
      voucherSnapshot
    };
  }

  validateDeliveryDate(deliveryDate) {
    if (!deliveryDate) {
      throw new ValidationError('Vui lòng chọn ngày hẹn giao hoa (trong vòng 7 ngày tới)');
    }
    const deliveryDateStr = String(deliveryDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateStr)) {
      throw new ValidationError('Định dạng ngày hẹn giao hoa không hợp lệ (chuẩn YYYY-MM-DD)');
    }
    const dateObj = new Date(`${deliveryDateStr}T00:00:00.000Z`);
    if (!Number.isFinite(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== deliveryDateStr) {
      throw new ValidationError('Ngày hẹn giao hoa không tồn tại trên lịch');
    }
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const todayByVietnam = `${todayParts.find(part => part.type === 'year')?.value}-${todayParts.find(part => part.type === 'month')?.value}-${todayParts.find(part => part.type === 'day')?.value}`;
    const todayOrdinal = Date.parse(`${todayByVietnam}T00:00:00.000Z`);
    const targetOrdinal = Date.parse(`${deliveryDateStr}T00:00:00.000Z`);
    const targetDayOffset = (targetOrdinal - todayOrdinal) / (24 * 60 * 60 * 1000);
    if (targetDayOffset < 0) {
      throw new ValidationError('Ngày hẹn giao hoa không thể ở trong quá khứ');
    }
    if (targetDayOffset > 7) {
      throw new ValidationError('Tiệm chỉ nhận đặt hoa hẹn trước tối đa trong vòng 7 ngày (1 tuần) để đảm bảo hoa mới và đẹp nhất');
    }
    return deliveryDateStr;
  }

  /**
   * Tao don hang moi: Tinh toan nghiep vu tai Service va ghi vao CSDL qua Port
   * @param {Object} params
   * @param {Object} params.orderData
   * @param {string|null} params.userId
   * @returns {Promise<Object>}
   */
  async createOrder({ orderData, userId, deliveryQuoteRequestId = null }) {
    // 0. Kiem tra ngay hen giao hoa (Delivery Date validation)
    if (orderData?.deliveryDate) {
      this.validateDeliveryDate(orderData.deliveryDate);
    }

    // 1. Tinh gia, phu kien, voucher o tang Application
    const pricing = await this.calculateOrderPricing(orderData);

    // 2. Chuyen specification da duoc tinh toan sang Repository de thuc thi ACID Transaction
    const createdOrder = await this.orderRepo.createOrder({
      orderData: {
        ...orderData,
        verifiedItems: pricing.verifiedItems,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        shippingFee: pricing.shippingFee,
        deliveryQuote: pricing.deliveryQuote,
        totalAmount: pricing.totalAmount,
        appliedVoucherCode: pricing.appliedVoucherCode,
        voucherSnapshot: pricing.voucherSnapshot
      },
      deliveryQuoteRequestId,
      userId
    });

    if (userId && this.notifRepo) {
      const code = createdOrder.orderCode || createdOrder.id;
      this.notifRepo.createNotification({
        userId,
        orderId: createdOrder.id,
        title: 'Đặt hàng thành công',
        message: `Đơn hàng #${code} của bạn đã được tiếp nhận và đang chờ xử lý.`
      }).catch(err => console.error('[OrderService] Lỗi tạo thông báo đơn mới:', err.message));
    }

    return createdOrder;
  }

  /**
   * Cap nhat don nhap pending chua thanh toan (khi khach quay lai sua thong tin / doi COD-SePay)
   * @param {Object} params
   * @param {string} params.orderId
   * @param {Object} params.orderData
   * @param {string|null} params.userId
   * @returns {Promise<Object>}
   */
  async updateDraftOrder({ orderId, orderData, userId }) {
    if (orderData?.deliveryDate) {
      this.validateDeliveryDate(orderData.deliveryDate);
    }
    const pricing = await this.calculateOrderPricing(orderData);

    return this.orderRepo.updateDraftOrder({
      orderId,
      orderData: {
        ...orderData,
        verifiedItems: pricing.verifiedItems,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        shippingFee: pricing.shippingFee,
        deliveryQuote: pricing.deliveryQuote,
        totalAmount: pricing.totalAmount,
        appliedVoucherCode: pricing.appliedVoucherCode,
        voucherSnapshot: pricing.voucherSnapshot
      },
      userId
    });
  }

  /**
   * Lay danh sach don hang
   */
  async getOrders({ userId, role }) {
    return this.orderRepo.findOrders({ userId, role });
  }

  /**
   * Tra cuu don hang theo ID co kiem tra quyen xem (IDOR)
   */
  async getOrderById(orderId, user) {
    const order = await this.orderRepo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
    }

    if (!user) {
      throw new AuthenticationError('Yêu cầu đăng nhập');
    }
    if (user.role !== 'admin' && user.role !== 'staff' && order.userId !== user.id) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin đơn hàng này');
    }

    return order;
  }

  /**
   * Tra cuu don guest bang ma don + so dien thoai (chuan hoa +84 & che PII nhay cam)
   */
  async lookupGuestOrder(orderCode, phone) {
    const cleanPhone = normalizeVnPhone(phone);
    if (!cleanPhone) {
      throw new NotFoundError('Không tìm thấy đơn phù hợp với mã đơn và số điện thoại');
    }
    const order = await this.orderRepo.findOrderById(orderCode);

    const phoneMatches = [order?.customerPhone, order?.recipientPhone]
      .filter(Boolean)
      .some(savedPhone => normalizeVnPhone(savedPhone) === cleanPhone);

    if (!order || !phoneMatches) {
      throw new NotFoundError('Không tìm thấy đơn phù hợp với mã đơn và số điện thoại');
    }

    return toGuestLookupDTO(order);
  }

  /**
   * Cap nhat trang thai don hang hoac huy don
   */
  async updateOrderStatus(orderId, status, user) {
    if (!user) {
      throw new AuthenticationError('Yêu cầu đăng nhập');
    }
    if (!status) {
      throw new ValidationError('Vui lòng cung cấp trạng thái mới');
    }

    if (user.role === 'admin' || user.role === 'staff') {
      const updatedOrder = await this.orderRepo.updateOrderStatus(orderId, status);
      if (updatedOrder?.userId && this.notifRepo) {
        const code = updatedOrder.orderCode || updatedOrder.id;
        const statusMessages = {
          confirmed: { title: 'Đơn hàng đã được xác nhận', msg: `Tiệm đang chuẩn bị hoa cho đơn hàng #${code}.` },
          shipping: { title: 'Đơn hàng đang giao', msg: `Shipper đang trên đường mang hoa đến cho bạn (Đơn #${code}).` },
          completed: { title: 'Giao hàng thành công', msg: `Đơn hàng #${code} đã được giao hoàn tất. Cảm ơn bạn đã lựa chọn ShopHoa!` },
          cancelled: { title: 'Đơn hàng đã hủy', msg: `Đơn hàng #${code} đã được hủy.` }
        };
        const info = statusMessages[status];
        if (info) {
          this.notifRepo.createNotification({
            userId: updatedOrder.userId,
            orderId: updatedOrder.id,
            title: info.title,
            message: info.msg
          }).catch(err => console.error('[OrderService] Lỗi tạo thông báo trạng thái:', err.message));
        }
      }
      return updatedOrder;
    } else if (status === 'cancelled') {
      const order = await this.orderRepo.findOrderById(orderId);
      if (order && ['paid', 'partially_paid'].includes(order.paymentStatus)) {
        const cancellationRequest = await this.orderRepo.requestOrderCancellation({ orderId, userId: user.id, reason: 'Khách yêu cầu hủy đơn' });
        return { order, cancellationRequest, notification: null };
      }
      return this.orderRepo.cancelCustomerOrder(orderId, user.id);
    } else {
      throw new ForbiddenError('Khách hàng chỉ được hủy đơn chưa xử lý');
    }
  }
}

