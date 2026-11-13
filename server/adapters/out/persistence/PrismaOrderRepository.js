/**
 * PrismaOrderRepository.js - Xu ly don hang giao dich ACID va ton kho tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

import { ValidationError, NotFoundError, ForbiddenError } from '../../../domain/errors/DomainErrors.js';
import { OrderStateMachine } from '../../../domain/state-machines/OrderStatus.js';
import { OrderRepositoryPort } from '../../../ports/out/OrderRepositoryPort.js';
import crypto from 'crypto';

export class PrismaOrderRepository extends OrderRepositoryPort {
  constructor(prismaClient) {
    super();
    this.prisma = prismaClient;
  }

  /**
   * Tra cuu danh sach phu kien hoat dong theo ID
   */
  async findActiveAddonsByIds(addonIds) {
    if (!Array.isArray(addonIds) || addonIds.length === 0) return [];
    return this.prisma.addons.findMany({
      where: { id: { in: addonIds }, is_active: true }
    });
  }

  /**
   * Tra cuu danh sach san pham hoat dong de tinh gia
   */
  async findProductsForPricing(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) return [];
    return this.prisma.products.findMany({
      where: {
        OR: [
          { id: { in: productIds } },
          { id: { in: productIds.map(id => /^\d+$/.test(id) ? `PROD-${id.padStart(3, '0')}` : id) } }
        ]
      }
    });
  }

  /**
   * Tra cuu voucher hop le theo ma
   */
  async findVoucherByCode(code) {
    if (!code || typeof code !== 'string') return null;
    return this.prisma.vouchers.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
  }

  /**
   * Tru kho nguyen tu va giu luot dung voucher ben trong transaction
   */
  async _reserveStockAndVoucher(tx, verifiedItems, appliedVoucherCode) {
    for (const item of verifiedItems) {
      const prod = await tx.products.findUnique({ where: { id: item.productId } });
      if (!prod || !prod.is_active) {
        throw new ValidationError(`Sản phẩm '${item.productName || item.productId}' không tồn tại hoặc đã ngừng kinh doanh`);
      }
      if (prod.stock < item.quantity) {
        throw new ValidationError(`Sản phẩm "${prod.name}" chỉ còn ${prod.stock} bó trong kho, không đủ đáp ứng số lượng ${item.quantity}`);
      }

      // Snapshot giá vốn thực tế của sản phẩm tại thời điểm đặt hàng để bảo toàn kế toán lịch sử
      item.costPrice = Number(prod.cost_price || 0);
      item.cost_price = Number(prod.cost_price || 0);

      const stockUpdate = await tx.products.updateMany({
        where: { id: item.productId, is_active: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (stockUpdate.count !== 1) {
        throw new ValidationError(`Sản phẩm "${prod.name}" vừa hết số lượng yêu cầu. Vui lòng tải lại giỏ hàng.`);
      }
    }

    if (appliedVoucherCode) {
      const voucher = await tx.vouchers.findUnique({ where: { code: appliedVoucherCode } });
      if (voucher) {
        const voucherClaim = await tx.vouchers.updateMany({
          where: {
            id: voucher.id,
            is_active: true,
            ...(voucher.usage_limit === null ? {} : { used_count: { lt: voucher.usage_limit } })
          },
          data: { used_count: { increment: 1 } }
        });
        if (voucherClaim.count !== 1) {
          throw new ValidationError('Mã ưu đãi vừa hết lượt sử dụng. Vui lòng thử lại không áp dụng mã.');
        }
      }
    }
  }

  /**
   * Luu danh sach order_items va order_item_addons
   */
  async _insertOrderItemsAndAddons(tx, orderId, verifiedItems) {
    await tx.order_items.createMany({
      data: verifiedItems.map(item => ({
        id: item.id,
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        cost_price: Number(item.costPrice ?? item.cost_price ?? 0)
      }))
    });

    const allItemAddons = [];
    for (const item of verifiedItems) {
      if (Array.isArray(item.addons) && item.addons.length > 0) {
        for (const addon of item.addons) {
          allItemAddons.push({
            id: addon.id,
            order_item_id: item.id,
            addon_id: addon.addonId,
            addon_name: addon.addonName,
            unit_price: addon.unitPrice
          });
        }
      }
    }
    if (allItemAddons.length > 0) {
      await tx.order_item_addons.createMany({
        data: allItemAddons
      });
    }
  }

  /**
   * Chuan hoa cac truong du lieu ghi vao bang orders
   */
  _buildOrderWriteFields(orderData) {
    const subtotal = Number(orderData.subtotal || 0);
    const discountAmount = Number(orderData.discountAmount || 0);
    const shippingFee = Number(orderData.shippingFee || 0);
    const totalAmount = Number(orderData.totalAmount !== undefined ? orderData.totalAmount : Math.max(0, subtotal + shippingFee - discountAmount));

    return {
      customer_name: (orderData.customerName || orderData.customer_name || 'Khách Hàng').trim(),
      customer_phone: (orderData.customerPhone || orderData.customer_phone || orderData.phone || '').trim(),
      customer_email: (orderData.email || orderData.customerEmail || orderData.customer_email || '').trim() || null,
      recipient_name: (orderData.recipientName || orderData.recipient_name || orderData.customerName || '').trim() || null,
      recipient_phone: (orderData.recipientPhone || orderData.recipient_phone || orderData.phone || '').trim() || null,
      is_gift: Boolean(orderData.isGift || orderData.is_gift),
      is_anonymous: Boolean(orderData.isAnonymous || orderData.is_anonymous),
      shipping_address: (orderData.shippingAddress || orderData.shipping_address || orderData.address || '').trim(),
      delivery_date: (orderData.deliveryDate || orderData.delivery_date || '').trim() || null,
      delivery_slot: (orderData.deliverySlot || orderData.delivery_slot || '').trim() || null,
      has_greeting_card: Boolean(orderData.hasGreetingCard || orderData.has_greeting_card),
      card_message: (orderData.cardMessage || orderData.card_message || '').trim() || null,
      customer_note: (orderData.note || orderData.customerNote || orderData.customer_note || '').trim() || null,
      shipping_fee: shippingFee,
      subtotal,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      payment_method: orderData.paymentMethod,
      voucher_code: orderData.appliedVoucherCode || null
    };
  }

  /**
   * Tao don hang moi voi giao dich ACID, thuc thi khoa tru kho nguyen tu va luu tru ban ghi
   * Tuan thu Hexagonal: Nhan specifications da qua kiem duyet tu OrderService (Application Layer)
   */
  async createOrder({ orderData, userId = null }) {
    const verifiedItems = orderData?.verifiedItems;
    if (!Array.isArray(verifiedItems) || verifiedItems.length === 0) {
      throw new ValidationError('Danh sách sản phẩm hợp lệ trong đơn hàng không được để trống');
    }

    const appliedVoucherCode = orderData.appliedVoucherCode || null;
    const voucherSnapshot = orderData.voucherSnapshot || null;
    const writeFields = this._buildOrderWriteFields(orderData);

    // Thuc thi ben trong Prisma Transaction (ACID Isolation)
    return await this.prisma.$transaction(async (tx) => {
      await this._reserveStockAndVoucher(tx, verifiedItems, appliedVoucherCode);

      // Sinh ma don hang duy nhat (12 ky tu gon de khong bi cat ngan khi chuyen khoan Ngan hang)
      const orderId = crypto.randomUUID();
      const orderCode = `DH${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // Luu don hang vao bang orders (khong chap nhan status/payment_status tu client)
      const createdOrder = await tx.orders.create({
        data: {
          id: orderId,
          order_code: orderCode,
          user_id: userId,
          ...writeFields,
          status: 'pending',
          payment_status: 'pending'
        }
      });

      await this._insertOrderItemsAndAddons(tx, createdOrder.id, verifiedItems);

      // Tu dong sinh thong bao dau tien neu co user_id
      if (userId) {
        await tx.notifications.create({
          data: {
            id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            user_id: userId,
            order_id: createdOrder.id,
            title: `Tạo đơn hàng thành công #${createdOrder.order_code}`,
            message: `Đơn hàng #${createdOrder.order_code} (${writeFields.total_amount.toLocaleString()}đ) đã được gửi tới Tiệm Hoa Kẽm Nhung.`,
            is_read: false
          }
        });
      }

      return this._mapToDTO(createdOrder, verifiedItems, voucherSnapshot);
    });
  }

  /**
   * Cap nhat don hang nhap dang pending & chua thanh toan trong cung ACID transaction
   */
  async updateDraftOrder({ orderId, userId = null, orderData }) {
    const verifiedItems = orderData?.verifiedItems;
    if (!Array.isArray(verifiedItems) || verifiedItems.length === 0) {
      throw new ValidationError('Danh sách sản phẩm hợp lệ trong đơn hàng không được để trống');
    }

    const appliedVoucherCode = orderData.appliedVoucherCode || null;
    const voucherSnapshot = orderData.voucherSnapshot || null;
    const writeFields = this._buildOrderWriteFields(orderData);

    return await this.prisma.$transaction(async (tx) => {
      const existingOrder = await tx.orders.findFirst({
        where: { OR: [{ id: orderId }, { order_code: orderId }] },
        include: { order_items: true, payment_transactions: true }
      });

      if (!existingOrder) {
        throw new NotFoundError(`Không tìm thấy đơn hàng nháp #${orderId}`);
      }
      if (existingOrder.user_id && existingOrder.user_id !== userId) {
        throw new ForbiddenError('Bạn không có quyền chỉnh sửa đơn hàng này');
      }
      if (existingOrder.payment_status === 'paid' || (existingOrder.payment_transactions && existingOrder.payment_transactions.length > 0)) {
        throw new ValidationError('Đơn hàng này đã được thanh toán, không thể chỉnh sửa.');
      }
      if (existingOrder.status !== 'pending' || existingOrder.payment_status !== 'pending') {
        throw new ValidationError('Đơn hàng nháp trước đó đã hết hạn hoặc đã bị hủy, vui lòng đặt lại.');
      }

      // Hoan ton kho & voucher cu truoc khi giu cho moi (an toan trong ACID transaction)
      for (const oldItem of existingOrder.order_items) {
        await tx.products.update({
          where: { id: oldItem.product_id },
          data: { stock: { increment: oldItem.quantity } }
        });
      }
      if (existingOrder.voucher_code) {
        await tx.vouchers.updateMany({
          where: { code: existingOrder.voucher_code, used_count: { gt: 0 } },
          data: { used_count: { decrement: 1 } }
        });
      }

      await tx.order_items.deleteMany({ where: { order_id: existingOrder.id } });
      await this._reserveStockAndVoucher(tx, verifiedItems, appliedVoucherCode);

      const claimed = await tx.orders.updateMany({
        where: {
          id: existingOrder.id,
          status: 'pending',
          payment_status: 'pending'
        },
        data: {
          ...writeFields,
          ...(existingOrder.user_id === null && userId ? { user_id: userId } : {})
        }
      });
      if (claimed.count !== 1) {
        throw new ValidationError('Đơn hàng vừa được xử lý ở một yêu cầu khác. Hãy tải lại trang.');
      }

      await this._insertOrderItemsAndAddons(tx, existingOrder.id, verifiedItems);

      const effectiveUserId = existingOrder.user_id || userId;
      if (effectiveUserId) {
        await tx.notifications.updateMany({
          where: { order_id: existingOrder.id, user_id: effectiveUserId },
          data: {
            message: `Đơn hàng #${existingOrder.order_code} (${writeFields.total_amount.toLocaleString()}đ) đã được cập nhật tới Tiệm Hoa Kẽm Nhung.`
          }
        });
      }

      const updatedOrder = await tx.orders.findUnique({ where: { id: existingOrder.id } });
      return this._mapToDTO(updatedOrder, verifiedItems, voucherSnapshot);
    });
  }

  /**
   * Lay danh sach don hang (co phan quyen admin/staff hoac customer)
   */
  async findOrders({ userId = null, role = 'customer' } = {}) {
    const where = {};
    if (role !== 'admin' && role !== 'staff') {
      if (!userId) return [];
      where.user_id = userId;
    }

    const rawOrders = await this.prisma.orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        order_items: {
          include: {
            products: {
              select: { image_url: true, category_id: true }
            },
            order_item_addons: true
          }
        },
        payment_transactions: true,
        refund_requests: {
          orderBy: { requested_at: 'desc' }
        }
      }
    });

    return rawOrders.map(o => this._mapToDTO(o, o.order_items.map(i => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      name: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      price: i.unit_price,
      costPrice: i.cost_price ?? 0,
      cost_price: i.cost_price ?? 0,
      imageUrl: i.products?.image_url || '/images/bloom-of-spring.png',
      categoryId: i.products?.category_id,
      addons: (i.order_item_addons || []).map(a => ({
        id: a.id,
        addonId: a.addon_id,
        name: a.addon_name,
        price: a.unit_price
      })),
      addonsText: (i.order_item_addons || []).map(a => a.addon_name).join(', ')
    }))));
  }

  /**
   * Tim chi tiet don hang theo ID
   */
  async findOrderById(orderId) {
    const order = await this.prisma.orders.findFirst({
      where: {
        OR: [
          { id: orderId },
          { order_code: orderId }
        ]
      },
      include: {
        order_items: {
          include: {
            products: {
              select: { image_url: true, category_id: true }
            },
            order_item_addons: true
          }
        },
        payment_transactions: true,
        refund_requests: {
          orderBy: { requested_at: 'desc' }
        }
      }
    });

    if (!order) return null;

    return this._mapToDTO(order, order.order_items.map(i => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      name: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      price: i.unit_price,
      costPrice: i.cost_price ?? 0,
      cost_price: i.cost_price ?? 0,
      imageUrl: i.products?.image_url || '/images/bloom-of-spring.png',
      categoryId: i.products?.category_id,
      addons: (i.order_item_addons || []).map(a => ({
        id: a.id,
        addonId: a.addon_id,
        name: a.addon_name,
        price: a.unit_price
      })),
      addonsText: (i.order_item_addons || []).map(a => a.addon_name).join(', ')
    })));
  }

  /**
   * Huy don chua thanh toan cua chinh khach hang trong mot transaction.
   * Kho duoc hoan lai cung luc cap nhat trang thai de tranh mat hang khi huy don.
   */
  async cancelCustomerOrder(orderId, userId) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findFirst({
        where: { OR: [{ id: orderId }, { order_code: orderId }] },
        include: { order_items: true }
      });

      if (!order || (userId && order.user_id !== userId)) {
        throw new NotFoundError(`Khong tim thay don hang #${orderId}`);
      }
      // Khach hang chi duoc tu huy don khi con o trang thai pending va chua thanh toan.
      // Admin / Nhan vien (!userId) co quyen huy don khi don chua hoan tat (completed hoac cancelled).
      if (userId) {
        if (order.status !== 'pending' || order.payment_status === 'paid') {
          throw new ValidationError('Đơn hàng đã được xử lý hoặc đã thanh toán, vui lòng liên hệ tiệm để được hỗ trợ');
        }
      } else {
        if (order.status === 'completed' || order.status === 'cancelled') {
          throw new ValidationError(`Không thể hủy đơn hàng đã ở trạng thái "${order.status}"`);
        }
      }

      const claimed = await tx.orders.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: 'cancelled' }
      });
      if (claimed.count !== 1) {
        throw new ValidationError('Đơn hàng vừa được xử lý ở một yêu cầu khác. Hãy tải lại trạng thái đơn.');
      }

      for (const item of order.order_items) {
        await tx.products.update({
          where: { id: item.product_id },
          data: { stock: { increment: item.quantity } }
        });
      }

      if (order.voucher_code) {
        await tx.vouchers.updateMany({
          where: { code: order.voucher_code, used_count: { gt: 0 } },
          data: { used_count: { decrement: 1 } }
        });
      }

      const updated = await tx.orders.findUnique({
        where: { id: order.id },
        include: { order_items: true }
      });

      if (order.user_id) {
        await tx.notifications.create({
          data: {
            id: crypto.randomUUID(),
            user_id: order.user_id,
            order_id: order.id,
            title: `Đã hủy đơn hàng #${order.order_code}`,
            message: 'Đơn hàng đã hủy và tồn kho đã được hoàn lại.',
            is_read: false
          }
        });
      }

      return {
        order: this._mapToDTO(updated, order.order_items.map(item => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          price: item.unit_price
        }))),
        notification: null
      };
    });
  }

  /**
   * Cap nhat trang thai don hang tuan thu State Machine + sinh Notification
   */
  async updateOrderStatus(orderId, newStatus) {
    if (newStatus === 'cancelled') {
      return this.cancelCustomerOrder(orderId, null);
    }
    const order = await this.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
    }

    const currentStatus = order.status;
    OrderStateMachine.assertCanTransition({
      fromStatus: currentStatus,
      toStatus: newStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus
    });

    const data = { status: newStatus };
    if (newStatus === 'completed') {
      data.completed_at = new Date();
      if (order.paymentMethod === 'cod') data.payment_status = 'paid';
    }

    const { updated, notification } = await this.prisma.$transaction(async tx => {
      const claimed = await tx.orders.updateMany({
        where: {
          id: order.id,
          status: currentStatus,
          ...(order.paymentMethod === 'sepay' && newStatus !== 'cancelled' && newStatus !== currentStatus
            ? { payment_status: 'paid' }
            : {})
        },
        data
      });
      if (claimed.count !== 1) {
        throw new ValidationError('Đơn hàng vừa được cập nhật ở một yêu cầu khác. Hãy tải lại trạng thái đơn.');
      }
      const currentOrder = await tx.orders.findUnique({ where: { id: order.id }, include: { order_items: true } });
      let currentNotification = null;
      if (currentOrder.user_id) {
        currentNotification = await tx.notifications.create({
          data: {
            id: crypto.randomUUID(),
            user_id: currentOrder.user_id,
            order_id: currentOrder.id,
            title: `Cập nhật đơn hàng #${currentOrder.order_code}`,
            message: OrderStateMachine.getStatusMessage(newStatus),
            is_read: false
          }
        });
      }
      return { updated: currentOrder, notification: currentNotification };
    });

    return {
      order: this._mapToDTO(updated, order.items),
      notification
    };
  }

  /**
   * Tim danh sach don hang SePay dang cho thanh toan da vuot qua thoi gian cho phep (TTL)
   * Chi lay don co payment_method = 'sepay', status = 'pending', payment_status = 'pending'
   * @param {Date} cutoffDate
   * @returns {Promise<Array<{ id: string, order_code: string, created_at: Date }>>}
   */
  async findExpiredPendingSepayOrders(cutoffDate) {
    return this.prisma.orders.findMany({
      where: {
        payment_method: 'sepay',
        status: 'pending',
        payment_status: 'pending',
        created_at: { lte: cutoffDate }
      },
      select: {
        id: true,
        order_code: true,
        created_at: true
      }
    });
  }

  /**
   * Huy nguyen tu don SePay da het han thanh toan.
   * Dieu kien nghiem ngat: Chi huy khi CA status = 'pending' VA payment_status = 'pending'.
   * Tuyet doi khong huy don da confirmed, shipping hoac paid.
   * Hoan tra ton kho va voucher ve CSDL trong cung transaction ACID.
   * @param {string} orderId
   * @returns {Promise<Object|null>} Don hang da huy hoac null neu don da duoc xu ly truoc
   */
  async cancelExpiredPendingOrder(orderId) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findFirst({
        where: {
          id: orderId,
          payment_method: 'sepay',
          status: 'pending',
          payment_status: 'pending'
        },
        include: { order_items: true }
      });

      if (!order) {
        // Don hang da thanh toan hoac da huy boi khach hang truoc do
        return null;
      }

      const claimed = await tx.orders.updateMany({
        where: {
          id: order.id,
          status: 'pending',
          payment_status: 'pending'
        },
        data: { status: 'cancelled' }
      });

      if (claimed.count !== 1) {
        // Tranh chap race condition voi tien trinh khac
        return null;
      }

      // Hoan ton kho san pham
      for (const item of order.order_items) {
        await tx.products.update({
          where: { id: item.product_id },
          data: { stock: { increment: item.quantity } }
        });
      }

      // Hoan voucher neu co ap dung
      if (order.voucher_code) {
        await tx.vouchers.updateMany({
          where: { code: order.voucher_code, used_count: { gt: 0 } },
          data: { used_count: { decrement: 1 } }
        });
      }

      // Sinh notification neu don gan voi nguoi dung
      if (order.user_id) {
        await tx.notifications.create({
          data: {
            id: crypto.randomUUID(),
            user_id: order.user_id,
            order_id: order.id,
            title: `Đơn hàng #${order.order_code} đã hết hạn thanh toán`,
            message: 'Đơn hàng SePay chưa được thanh toán trong thời gian quy định nên đã tự động hủy và hoàn lại tồn kho.',
            is_read: false
          }
        });
      }

      return order;
    });
  }

  /**
   * Tim don hang SePay phu hop co order_code xuat hien trong noi dung chuyen khoan (pending hoac cancelled)
   * @param {string} content
   * @returns {Promise<Object|null>}
   */
  async findSepayOrderByContent(content) {
    if (!content || typeof content !== 'string') return null;
    const upperContent = content.toUpperCase();
    const candidates = await this.prisma.orders.findMany({
      where: {
        payment_method: 'sepay',
        payment_status: 'pending',
        status: { in: ['pending', 'cancelled'] }
      },
      select: { id: true, order_code: true, user_id: true, total_amount: true, status: true, payment_status: true }
    });
    return candidates.find(candidate => upperContent.includes(candidate.order_code.toUpperCase())) || null;
  }

  /**
   * Alias tuong thich nguoc cho findSepayOrderByContent
   */
  async findPendingSepayOrderByContent(content) {
    return this.findSepayOrderByContent(content);
  }

  /**
   * Ghi nhận giao dịch thanh toán thành công vào CSDL (ACID transaction)
   * Chuyển trạng thái pending -> confirmed, payment_status -> paid
   * Chặn tuyệt đối không cho đơn đã cancelled bị cập nhật sang confirmed
   * Ghi nhận bản ghi payment_transactions cho cả đơn đã cancelled để phục vụ đối soát hoàn tiền
   * Xử lý race condition P2002 bên ngoài transaction đã rollback, đối soát trùng khớp đơn hàng
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.providerTxId
   * @param {number} params.amount
   * @param {Object} [params.transaction={}]
   * @returns {Promise<{ processed: boolean, duplicate: boolean, cancelled?: boolean, recorded?: boolean, order?: Object }>}
   */
  async recordPayment({ orderId, providerTxId, amount, transaction = {} }) {
    if (!providerTxId || providerTxId.length > 100 || !Number.isSafeInteger(amount)) {
      throw new ValidationError('Dữ liệu giao dịch thanh toán không hợp lệ');
    }
    const transactionDate = new Date(transaction.transactionDate || Date.now());
    if (Number.isNaN(transactionDate.getTime())) {
      throw new ValidationError('Ngày giao dịch không hợp lệ');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payment_transactions.findUnique({ where: { provider_tx_id: providerTxId } });
        if (existing) return { processed: false, duplicate: true };

        const order = await tx.orders.findFirst({
          where: { OR: [{ id: orderId }, { order_code: orderId }] }
        });
        if (!order) {
          throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
        }

        if (amount < order.total_amount) {
          throw new ValidationError('Số tiền thanh toán nhỏ hơn tổng giá trị đơn hàng');
        }

        // Nếu đơn hàng đã bị hủy trước đó: Lưu vết giao dịch đến muộn vào payment_transactions để kế toán hoàn tiền
        // TUYỆT ĐỐI không thay đổi trạng thái đơn, không sửa payment_status và không đụng đến tồn kho
        if (order.status === 'cancelled') {
          await tx.payment_transactions.create({
            data: {
              id: crypto.randomUUID(),
              order_id: order.id,
              provider: 'sepay',
              provider_tx_id: providerTxId,
              amount,
              bank_brand: String(transaction.bankBrand || 'SePay').slice(0, 50),
              account_number: String(transaction.accountNumber || '').slice(0, 50),
              transaction_date: transactionDate
            }
          });

          if (order.user_id) {
            await tx.notifications.create({
              data: {
                id: crypto.randomUUID(),
                user_id: order.user_id,
                order_id: order.id,
                title: `Ghi nhận chuyển khoản đơn đã hủy #${order.order_code}`,
                message: `Đơn hàng #${order.order_code} đã bị hủy trước đó nhưng nhận được khoản thanh toán ${amount.toLocaleString()}đ. Nhân viên sẽ liên hệ hoàn tiền.`,
                is_read: false
              }
            });
          }

          return {
            processed: false,
            duplicate: false,
            cancelled: true,
            recorded: true,
            order
          };
        }

        const claimed = await tx.orders.updateMany({
          where: {
            id: order.id,
            payment_method: 'sepay',
            payment_status: 'pending',
            status: 'pending',
            total_amount: { lte: amount }
          },
          data: { payment_status: 'paid', status: 'confirmed' }
        });

        if (claimed.count !== 1) {
          const current = await tx.orders.findUnique({
            where: { id: order.id },
            select: { id: true, order_code: true, status: true, payment_status: true }
          });
          return { processed: false, duplicate: false, cancelled: current?.status === 'cancelled', recorded: false, order: current };
        }

        await tx.payment_transactions.create({
          data: {
            id: crypto.randomUUID(),
            order_id: order.id,
            provider: 'sepay',
            provider_tx_id: providerTxId,
            amount,
            bank_brand: String(transaction.bankBrand || 'SePay').slice(0, 50),
            account_number: String(transaction.accountNumber || '').slice(0, 50),
            transaction_date: transactionDate
          }
        });

        if (order.user_id) {
          await tx.notifications.create({
            data: {
              id: crypto.randomUUID(),
              user_id: order.user_id,
              order_id: order.id,
              title: `Thanh toán thành công #${order.order_code}`,
              message: `Đã nhận chuyển khoản ${amount.toLocaleString()}đ qua SePay.`,
              is_read: false
            }
          });
        }

        const updated = await tx.orders.findUnique({
          where: { id: order.id },
          include: { order_items: true, payment_transactions: true }
        });

        return { processed: true, duplicate: false, order: updated };
      });
    } catch (err) {
      // Xử lý race condition: bắt mã lỗi P2002 bên ngoài transaction đã rollback
      if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
        const existingTx = await this.prisma.payment_transactions.findUnique({
          where: { provider_tx_id: providerTxId }
        });
        if (existingTx) {
          const orderRecord = await this.prisma.orders.findUnique({
            where: { id: existingTx.order_id },
            select: { id: true, order_code: true, status: true, payment_status: true }
          });
          // Đối soát xác nhận khớp đúng mã giao dịch và cùng mã đơn hàng
          if (orderRecord && (orderRecord.id === orderId || orderRecord.order_code === orderId || existingTx.order_id === orderId)) {
            return {
              processed: false,
              duplicate: true,
              cancelled: orderRecord.status === 'cancelled',
              order: orderRecord
            };
          }
        }
      }
      throw err;
    }
  }

  /**
   * Chuan hoa dinh dang DTO thong nhat giua Backend va Frontend
   */
  _mapToDTO(order, items = [], voucherSnapshot = null) {
    return {
      id: order.id,
      orderCode: order.order_code,
      order_code: order.order_code,
      userId: order.user_id,
      user_id: order.user_id,
      customerName: order.customer_name,
      customer_name: order.customer_name,
      customerPhone: order.customer_phone,
      customer_phone: order.customer_phone,
      phone: order.customer_phone,
      email: order.customer_email || '',
      customerEmail: order.customer_email || '',
      recipientName: order.recipient_name || order.customer_name,
      recipientPhone: order.recipient_phone || order.customer_phone,
      isGift: Boolean(order.is_gift),
      is_gift: Boolean(order.is_gift),
      isAnonymous: Boolean(order.is_anonymous),
      is_anonymous: Boolean(order.is_anonymous),
      shippingAddress: order.shipping_address,
      shipping_address: order.shipping_address,
      address: order.shipping_address,
      shippingFee: order.shipping_fee,
      shipping_fee: order.shipping_fee,
      deliveryDate: order.delivery_date || null,
      delivery_date: order.delivery_date || null,
      deliverySlot: order.delivery_slot || 'Giao trong ngày',
      delivery_slot: order.delivery_slot || 'Giao trong ngày',
      hasGreetingCard: Boolean(order.has_greeting_card),
      cardMessage: order.card_message || '',
      note: order.customer_note || '',
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      discount_amount: order.discount_amount,
      totalAmount: order.total_amount,
      total_amount: order.total_amount,
      status: order.status,
      paymentMethod: order.payment_method,
      payment_method: order.payment_method,
      paymentStatus: order.payment_status,
      payment_status: order.payment_status,
      voucherCode: order.voucher_code,
      voucherSnapshot: voucherSnapshot,
      createdAt: order.created_at,
      created_at: order.created_at,
      completedAt: order.completed_at,
      paymentTransactions: Array.isArray(order.payment_transactions)
        ? order.payment_transactions.map(t => ({
            id: t.id,
            provider: t.provider,
            providerTxId: t.provider_tx_id,
            provider_tx_id: t.provider_tx_id,
            amount: t.amount,
            bankBrand: t.bank_brand,
            accountNumber: t.account_number,
            transactionDate: t.transaction_date
          }))
        : [],
      refundRequests: Array.isArray(order.refund_requests)
        ? order.refund_requests.map(r => ({
            id: r.id,
            orderId: r.order_id,
            amount: r.amount,
            reason: r.reason,
            bankInfo: r.bank_info || '',
            status: r.status,
            requestedByName: r.requested_by_name || 'Thu ngân',
            requestedAt: r.requested_at,
            reviewedByName: r.reviewed_by_name || null,
            reviewedAt: r.reviewed_at,
            adminNote: r.admin_note || '',
            refundTxRef: r.refund_tx_ref || ''
          }))
        : [],
      items: items
    };
  }
}

