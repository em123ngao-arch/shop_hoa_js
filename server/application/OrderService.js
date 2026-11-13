/**
 * OrderService.js - Application Service quan ly nghiep vu don hang (Pricing, Validation, Voucher)
 * Thuoc tang Application (Clean / Hexagonal Architecture: 0 Express, 0 Prisma dependencies)
 * Quyết định toàn bộ logic tính toán giá hoa, phụ kiện và voucher trước khi gọi Persistence Port
 */

import { ValidationError, NotFoundError, ForbiddenError, AuthenticationError } from '../domain/errors/DomainErrors.js';
import { normalizeVnPhone } from '../domain/utils/phone.js';

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
    paymentStatus: order.paymentStatus,
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
  constructor(orderRepository) {
    this.orderRepo = orderRepository;
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

    // 5. Phi van chuyen do server tinh theo chinh sach cong khai (Mien phi tu 350.000d, duoi 350.000d phi 30.000d)
    const shippingFee = subtotal >= 350000 ? 0 : 30000;
    const totalAmount = Math.max(0, subtotal - discountAmount) + shippingFee;

    return {
      verifiedItems,
      subtotal,
      discountAmount,
      shippingFee,
      totalAmount,
      appliedVoucherCode,
      voucherSnapshot
    };
  }

  validateDeliveryDate(deliveryDate) {
    if (!deliveryDate) return null;
    const deliveryDateStr = String(deliveryDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateStr)) {
      throw new ValidationError('Định dạng ngày hẹn giao hoa không hợp lệ (chuẩn YYYY-MM-DD)');
    }
    const [year, month, day] = deliveryDateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
      throw new ValidationError('Ngày hẹn giao hoa không tồn tại trên lịch');
    }
    const targetDate = new Date(`${deliveryDateStr}T23:59:59`);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (targetDate < todayStart) {
      throw new ValidationError('Ngày hẹn giao hoa không thể ở trong quá khứ');
    }
    const maxFutureDate = new Date(todayStart.getTime() + 60 * 24 * 60 * 60 * 1000);
    if (targetDate > maxFutureDate) {
      throw new ValidationError('Tiệm chỉ nhận đặt hoa hẹn trước tối đa trong vòng 60 ngày');
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
  async createOrder({ orderData, userId }) {
    // 0. Kiem tra ngay hen giao hoa (Delivery Date validation)
    if (orderData?.deliveryDate) {
      this.validateDeliveryDate(orderData.deliveryDate);
    }

    // 1. Tinh gia, phu kien, voucher o tang Application
    const pricing = await this.calculateOrderPricing(orderData);

    // 2. Chuyen specification da duoc tinh toan sang Repository de thuc thi ACID Transaction
    return this.orderRepo.createOrder({
      orderData: {
        ...orderData,
        verifiedItems: pricing.verifiedItems,
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        shippingFee: pricing.shippingFee,
        totalAmount: pricing.totalAmount,
        appliedVoucherCode: pricing.appliedVoucherCode,
        voucherSnapshot: pricing.voucherSnapshot
      },
      userId
    });
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
      return this.orderRepo.updateOrderStatus(orderId, status);
    } else if (status === 'cancelled') {
      return this.orderRepo.cancelCustomerOrder(orderId, user.id);
    } else {
      throw new ForbiddenError('Khách hàng chỉ được hủy đơn chưa xử lý');
    }
  }
}

