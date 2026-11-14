/**
 * PrismaOrderRepository.js - Xu ly don hang giao dich ACID va ton kho tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

import { ValidationError, NotFoundError, ForbiddenError } from '../../../domain/errors/DomainErrors.js';
import { OrderStateMachine } from '../../../domain/state-machines/OrderStatus.js';
import { OrderRepositoryPort } from '../../../ports/out/OrderRepositoryPort.js';
import { calculateAdditionalPaymentDue, calculatePaymentAmounts, calculateRefundableReceived, calculateSettledAmount } from '../../../application/PaymentRules.js';
import { normalizeVnPhone } from '../../../domain/utils/phone.js';
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
      delivery_area: (orderData.deliveryArea || orderData.delivery_area || '').trim() || null,
      delivery_zone: orderData.deliveryQuote?.zoneId || null,
      delivery_place_id: (orderData.deliveryPlaceId || orderData.delivery_place_id || '').trim() || null,
      delivery_latitude: orderData.deliveryQuote?.latitude == null ? null : Number(orderData.deliveryQuote.latitude),
      delivery_longitude: orderData.deliveryQuote?.longitude == null ? null : Number(orderData.deliveryQuote.longitude),
      // Giữ km cho mock local; ở production chỉ lưu Place ID và phí đã áp dụng, tránh lưu Routes content.
      delivery_distance_meters: orderData.deliveryQuote?.provider === 'local-mock' && Number.isSafeInteger(orderData.deliveryQuote?.distanceMeters)
        ? orderData.deliveryQuote.distanceMeters : null,
      delivery_quote_at: orderData.deliveryQuote?.quotedAt ? new Date(orderData.deliveryQuote.quotedAt) : null,
      delivery_date: (orderData.deliveryDate || orderData.delivery_date || '').trim() || null,
      delivery_slot: (orderData.deliverySlot || orderData.delivery_slot || '').trim() || null,
      has_greeting_card: Boolean(orderData.hasGreetingCard || orderData.has_greeting_card),
      card_message: (orderData.cardMessage || orderData.card_message || '').trim() || null,
      customer_note: (orderData.note || orderData.customerNote || orderData.customer_note || '').trim() || null,
      shipping_fee: shippingFee,
      subtotal,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      payment_method: String(orderData.paymentMethod || orderData.payment_method || 'sepay').toLowerCase(),
      payment_plan: orderData.paymentPlan,
      terms_version: orderData.termsVersion || 'payment-delivery-v1',
      terms_accepted_at: orderData.termsAccepted ? new Date() : null,
      voucher_code: orderData.appliedVoucherCode || null
    };
  }

  /** Tạo mã thanh toán độc lập với mã đơn, tránh webhook đoán loại khoản thu từ mã đơn. */
  async _createPaymentIntent(tx, orderId, paymentPlan, totalAmount, purpose = null, relatedRequestId = null) {
    const intentPurpose = purpose || (paymentPlan === 'sepay_deposit' ? 'advance_50' : 'full_payment');
    const amount = purpose ? Number(totalAmount) : calculatePaymentAmounts(totalAmount, paymentPlan).amountDueNow;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new ValidationError('Tổng đơn quá nhỏ để tạo khoản thanh toán trực tuyến');
    }
    const intent = await tx.payment_intents.create({
      data: {
        id: crypto.randomUUID(),
        order_id: orderId,
        purpose: intentPurpose,
        related_request_id: relatedRequestId,
        reference_code: `PAY${Date.now().toString(36).slice(-5).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        amount,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
    return intent;
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
          ...(userId ? { users: { connect: { id: userId } } } : {}),
          ...writeFields,
          status: 'pending',
          payment_status: 'pending'
        }
      });

      const paymentIntent = writeFields.payment_plan === 'legacy_cod'
        ? null
        : await this._createPaymentIntent(
            tx,
            createdOrder.id,
            writeFields.payment_plan,
            writeFields.total_amount
          );

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

      return this._mapToDTO({ ...createdOrder, payment_intents: paymentIntent ? [paymentIntent] : [], payment_entries: [] }, verifiedItems, voucherSnapshot);
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
        include: { order_items: true, payment_transactions: true, payment_entries: true, payment_intents: true }
      });

      if (!existingOrder) {
        throw new NotFoundError(`Không tìm thấy đơn hàng nháp #${orderId}`);
      }
      if (existingOrder.user_id && existingOrder.user_id !== userId) {
        throw new ForbiddenError('Bạn không có quyền chỉnh sửa đơn hàng này');
      }
      if (existingOrder.payment_status !== 'pending' || (existingOrder.payment_transactions && existingOrder.payment_transactions.length > 0) || (existingOrder.payment_entries && existingOrder.payment_entries.length > 0)) {
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

      await tx.payment_intents.updateMany({ where: { order_id: existingOrder.id, status: 'pending' }, data: { status: 'cancelled' } });
      const paymentIntent = writeFields.payment_plan === 'legacy_cod'
        ? null
        : await this._createPaymentIntent(
            tx,
            existingOrder.id,
            writeFields.payment_plan,
            writeFields.total_amount
          );

      const effectiveUserId = existingOrder.user_id || userId;
      if (effectiveUserId) {
        await tx.notifications.updateMany({
          where: { order_id: existingOrder.id, user_id: effectiveUserId },
          data: {
            message: `Đơn hàng #${existingOrder.order_code} (${writeFields.total_amount.toLocaleString()}đ) đã được cập nhật tới Tiệm Hoa Kẽm Nhung.`
          }
        });
      }

      const updatedOrder = await tx.orders.findUnique({ where: { id: existingOrder.id }, include: { payment_intents: true, payment_entries: true } });
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
        payment_intents: { orderBy: { created_at: 'desc' } },
        payment_entries: { orderBy: { created_at: 'asc' } },
        delivery_attempts: { orderBy: { attempt_number: 'asc' } },
        change_requests: { orderBy: { requested_at: 'desc' } },
        cancellation_requests: { orderBy: { requested_at: 'desc' } },
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
        payment_intents: { orderBy: { created_at: 'desc' } },
        payment_entries: { orderBy: { created_at: 'asc' } },
        delivery_attempts: { orderBy: { attempt_number: 'asc' } },
        change_requests: { orderBy: { requested_at: 'desc' } },
        cancellation_requests: { orderBy: { requested_at: 'desc' } },
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
        include: { order_items: true, payment_entries: true, payment_transactions: true }
      });

      if (!order || (userId && order.user_id !== userId)) {
        throw new NotFoundError(`Khong tim thay don hang #${orderId}`);
      }
      // Khach hang chi duoc tu huy don khi con o trang thai pending va chua thanh toan.
      // Admin / Nhan vien (!userId) co quyen huy don khi don chua hoan tat (completed hoac cancelled).
      if (userId) {
        const hasReceivedMoney = (order.payment_entries || []).some(entry =>
          entry.direction === 'in' && entry.entry_type !== 'redelivery_fee'
        ) || (order.payment_transactions || []).length > 0;
        if (hasReceivedMoney) {
          const pendingCancellation = await tx.order_cancellation_requests.findFirst({ where: { order_id: order.id, status: 'pending' } });
          if (pendingCancellation) throw new ValidationError('Đơn đã có yêu cầu hủy đang chờ xử lý');
          const cancellationRequest = await tx.order_cancellation_requests.create({ data: {
            id: crypto.randomUUID(), order_id: order.id, requested_by: 'customer', reason: 'Khách yêu cầu hủy đơn có khoản thanh toán cần đối soát'
          } });
          return { order: this._mapToDTO(order, []), cancellationRequest, notification: null };
        }
        if (order.status !== 'pending' || order.payment_status === 'paid') {
          throw new ValidationError('Đơn hàng đã được xử lý hoặc đã thanh toán, vui lòng liên hệ tiệm để được hỗ trợ');
        }
      } else {
        if (order.status === 'completed' || order.status === 'cancelled') {
          throw new ValidationError(`Không thể hủy đơn hàng đã ở trạng thái "${order.status}"`);
        }
        if (order.status === 'shipping') {
          throw new ValidationError('Đơn đã xuất phát; hãy ghi nhận kết quả giao thất bại để áp dụng chính sách giao lại và hoàn tiền');
        }
        const hasReceivedMoney = (order.payment_entries || []).some(entry => entry.direction === 'in' && entry.entry_type !== 'redelivery_fee') ||
          (order.payment_transactions || []).length > 0;
        if (['sepay_full', 'sepay_deposit'].includes(order.payment_plan) &&
          (hasReceivedMoney || ['paid', 'partially_paid'].includes(order.payment_status))) {
          const existingRequest = await tx.order_cancellation_requests.findFirst({ where: { order_id: order.id, status: 'pending' } });
          if (existingRequest) throw new ValidationError('Đơn đã có yêu cầu hủy đang chờ xử lý');
          const cancellationRequest = await tx.order_cancellation_requests.create({ data: {
            id: crypto.randomUUID(), order_id: order.id, requested_by: 'shop', reason: 'Shop không thể thực hiện đơn và yêu cầu hoàn đủ khoản đã nhận'
          } });
          return { order: this._mapToDTO(order, []), cancellationRequest, notification: null };
        }
      }

      const claimed = await tx.orders.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: 'cancelled' }
      });
      if (claimed.count !== 1) {
        throw new ValidationError('Đơn hàng vừa được xử lý ở một yêu cầu khác. Hãy tải lại trạng thái đơn.');
      }
      await tx.payment_intents.updateMany({ where: { order_id: order.id, status: 'pending' }, data: { status: 'cancelled' } });

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

    if (['confirmed', 'shipping', 'completed'].includes(newStatus) &&
      (order.changeRequests || []).some(item => item.status === 'awaiting_payment' || item.status === 'pending')) {
      throw new ValidationError('Đơn đang chờ xử lý yêu cầu đổi thông tin hoặc khoản phí điều chỉnh; chưa thể giao tiếp');
    }
    if (['confirmed', 'shipping', 'completed'].includes(newStatus) &&
      (order.cancellationRequests || []).some(item => item.status === 'pending')) {
      throw new ValidationError('Đơn đang có yêu cầu hủy chờ xử lý; chưa thể tiếp tục giao');
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
      if (newStatus === 'completed' && ['sepay_full', 'sepay_deposit'].includes(order.paymentPlan)) {
        const activeDeliveryAttempt = await tx.delivery_attempts.findFirst({
          where: { order_id: order.id, status: 'started' }
        });
        if (!activeDeliveryAttempt) {
          throw new ValidationError('Hãy ghi nhận bắt đầu chuyến giao trước khi xác nhận đã giao thành công');
        }
      }
      const claimed = await tx.orders.updateMany({
        where: {
          id: order.id,
          status: currentStatus,
          ...(order.paymentMethod === 'sepay' && newStatus !== 'cancelled' && newStatus !== currentStatus
            ? { payment_status: { in: ['paid', 'partially_paid', 'partially_refunded'] } }
            : {})
        },
        data
      });
      if (claimed.count !== 1) {
        throw new ValidationError('Đơn hàng vừa được cập nhật ở một yêu cầu khác. Hãy tải lại trạng thái đơn.');
      }
      const currentOrder = await tx.orders.findUnique({ where: { id: order.id }, include: { order_items: true } });
      if (newStatus === 'completed') {
        await tx.delivery_attempts.updateMany({
          where: { order_id: order.id, status: 'started' },
          data: { status: 'delivered', completed_at: new Date() }
        });
      }
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
      await tx.payment_intents.updateMany({ where: { order_id: order.id, status: 'pending' }, data: { status: 'cancelled' } });

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
        payment_plan: 'legacy_sepay_full',
        payment_status: 'pending',
        status: { in: ['pending', 'cancelled'] }
      },
      select: { id: true, order_code: true, user_id: true, total_amount: true, status: true, payment_status: true }
    });
    const cleanContent = upperContent.replace(/[^A-Z0-9]/g, '');
    const matches = candidates.filter(candidate => {
      const cleanOrderCode = String(candidate.order_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cleanContent.includes(cleanOrderCode);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  /**
   * Alias tuong thich nguoc cho findSepayOrderByContent
   */
  async findPendingSepayOrderByContent(content) {
    return this.findSepayOrderByContent(content);
  }

  /** Tìm chính xác mã thanh toán riêng; không dùng mã đơn để suy đoán mục đích. */
  async findSepayPaymentIntentByContent(content) {
    const normalized = String(content || '').toUpperCase();
    if (!normalized) return null;
    const intents = await this.prisma.payment_intents.findMany({
      where: {
        status: { in: ['pending', 'needs_review', 'cancelled'] },
        OR: [
          {
            purpose: { in: ['advance_50', 'full_payment', 'order_adjustment'] },
            orders: { is: { payment_method: 'sepay', payment_plan: { in: ['sepay_full', 'sepay_deposit'] }, status: { in: ['pending', 'confirmed', 'shipping', 'cancelled'] } } }
          },
          {
            purpose: 'redelivery_fee',
            orders: { is: { status: { in: ['shipping', 'cancelled'] } } }
          }
        ]
      },
      include: { orders: true }
    });
    const cleanNormalized = normalized.replace(/[^A-Z0-9]/g, '');
    const matches = intents.filter(intent => {
      const cleanRef = String(intent.reference_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cleanNormalized.includes(cleanRef);
    });
    if (matches.length > 1) return { ambiguous: true };
    const match = matches[0];
    if (!match) return null;
    return {
      id: match.id,
      orderId: match.order_id,
      referenceCode: match.reference_code,
      purpose: match.purpose,
      amount: match.amount,
      status: match.status,
      order: match.orders
    };
  }

  /** Lưu webhook chưa gắn được mã đơn để nhân viên tra soát; không cộng vào số tiền của đơn nào. */
  async recordUnmatchedPayment({ providerTxId, content = '', amount, bankBrand = 'SePay', accountNumber = '', transactionDate = Date.now() }) {
    if (!providerTxId || providerTxId.length > 100 || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new ValidationError('Dữ liệu giao dịch chưa khớp không hợp lệ');
    }
    const date = new Date(transactionDate);
    if (Number.isNaN(date.getTime())) throw new ValidationError('Ngày giao dịch không hợp lệ');
    try {
      const row = await this.prisma.unmatched_payment_transactions.create({ data: {
        id: crypto.randomUUID(), provider_tx_id: providerTxId, amount,
        payment_content: String(content || '').slice(0, 255),
        bank_brand: String(bankBrand || 'SePay').slice(0, 50),
        account_suffix: String(accountNumber || '').replace(/\D/g, '').slice(-4) || null,
        transaction_date: date, status: 'unmatched'
      } });
      return { ...this._mapUnmatchedPayment(row), duplicate: false };
    } catch (error) {
      if (error.code === 'P2002' || error.message?.includes('Unique constraint failed')) {
        const existing = await this.prisma.unmatched_payment_transactions.findUnique({ where: { provider_tx_id: providerTxId } });
        if (existing) return { ...this._mapUnmatchedPayment(existing), duplicate: true };
      }
      throw error;
    }
  }

  _mapUnmatchedPayment(row) {
    if (!row) return null;
    return {
      id: row.id, providerTxId: row.provider_tx_id, amount: row.amount,
      content: row.payment_content, bankBrand: row.bank_brand || '', accountSuffix: row.account_suffix || '',
      transactionDate: row.transaction_date, status: row.status, resolutionNote: row.resolution_note || '',
      reviewedById: row.reviewed_by_id || null, reviewedAt: row.reviewed_at || null, createdAt: row.created_at
    };
  }

  async findUnmatchedPayments() {
    const rows = await this.prisma.unmatched_payment_transactions.findMany({
      where: { status: 'unmatched' }, orderBy: { created_at: 'desc' }, take: 200
    });
    return rows.map(row => this._mapUnmatchedPayment(row));
  }

  async reviewUnmatchedPayment({ id, note, actorId }) {
    const result = await this.prisma.unmatched_payment_transactions.updateMany({
      where: { id: String(id), status: 'unmatched' },
      data: { status: 'reviewed', resolution_note: String(note).trim().slice(0, 500), reviewed_by_id: actorId || null, reviewed_at: new Date() }
    });
    if (result.count !== 1) throw new ValidationError('Giao dịch đã được đối soát hoặc không còn tồn tại');
    const row = await this.prisma.unmatched_payment_transactions.findUnique({ where: { id: String(id) } });
    return this._mapUnmatchedPayment(row);
  }

  /** Đối soát một intent; số tiền sai/đến muộn được lưu để kiểm tra nhưng không xác nhận đơn. */
  async recordPaymentIntent({ paymentIntentId, providerTxId, amount, transaction = {} }) {
    if (!providerTxId || providerTxId.length > 100 || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new ValidationError('Dữ liệu giao dịch thanh toán không hợp lệ');
    }
    const transactionDate = new Date(transaction.transactionDate || Date.now());
    if (Number.isNaN(transactionDate.getTime())) throw new ValidationError('Ngày giao dịch không hợp lệ');
    try {
      return await this.prisma.$transaction(async tx => {
        const duplicate = await tx.payment_transactions.findUnique({ where: { provider_tx_id: providerTxId } });
        if (duplicate) return { processed: false, duplicate: true };
        const intent = await tx.payment_intents.findUnique({ where: { id: paymentIntentId }, include: { orders: true } });
        if (!intent) throw new NotFoundError('Không tìm thấy mã thanh toán');
        const order = intent.orders;
        const relatedChange = intent.purpose === 'order_adjustment' && intent.related_request_id
          ? await tx.order_change_requests.findUnique({ where: { id: intent.related_request_id } })
          : null;
        const relatedDeliveryAttempt = intent.purpose === 'redelivery_fee' && intent.related_request_id
          ? await tx.delivery_attempts.findUnique({ where: { id: intent.related_request_id } })
          : null;
        const exactAmount = amount === intent.amount;
        const validPurposeTarget = intent.purpose === 'order_adjustment'
          ? relatedChange?.status === 'awaiting_payment'
          : intent.purpose === 'redelivery_fee'
            ? ['failed', 'exception_required'].includes(relatedDeliveryAttempt?.status)
            : ['advance_50', 'full_payment'].includes(intent.purpose);
        const beforeExpiry = !intent.expires_at || transactionDate <= intent.expires_at;
        const legacyRedeliveryFee = order.payment_plan === 'legacy_cod' && intent.purpose === 'redelivery_fee';
        let canApply = intent.status === 'pending' && beforeExpiry && exactAmount && order.status !== 'cancelled' &&
          (order.payment_plan !== 'legacy_cod' || legacyRedeliveryFee) && validPurposeTarget;
        if (canApply) {
          const claimedIntent = await tx.payment_intents.updateMany({
            where: { id: intent.id, status: 'pending' },
            data: { status: 'paid', received_amount: amount, paid_at: transactionDate }
          });
          canApply = claimedIntent.count === 1;
        }
        const reviewReason = order.status === 'cancelled'
          ? 'Giao dịch đến sau khi đơn đã hủy'
          : (!exactAmount ? `Sai số tiền; cần ${intent.amount}, nhận ${amount}` : 'Mã thanh toán không còn ở trạng thái chờ');

        await tx.payment_transactions.create({
          data: {
            id: crypto.randomUUID(), order_id: order.id, payment_intent_id: intent.id,
            provider: 'sepay', provider_tx_id: providerTxId, amount,
            bank_brand: String(transaction.bankBrand || 'SePay').slice(0, 50),
            account_number: String(transaction.accountNumber || '').slice(0, 50),
            transaction_date: transactionDate
          }
        });

        await tx.order_payment_entries.create({
          data: {
            id: crypto.randomUUID(), order_id: order.id, payment_intent_id: intent.id,
            entry_type: canApply ? intent.purpose : 'payment_review', direction: 'in', channel: 'sepay', amount,
            external_ref: `SEPAY:${providerTxId}`.slice(0, 120),
            note: canApply ? `Đã nhận ${intent.purpose}` : reviewReason
          }
        });

        if (!canApply) {
          await tx.payment_intents.updateMany({
            where: { id: intent.id, status: 'pending' },
            data: { status: 'needs_review', received_amount: { increment: amount } }
          });
          if (order.user_id) {
            await tx.notifications.create({
              data: { id: crypto.randomUUID(), user_id: order.user_id, order_id: order.id,
                title: `Cần đối soát thanh toán #${order.order_code}`,
                message: `Đã nhận ${amount.toLocaleString()}đ nhưng khoản này cần shop kiểm tra: ${reviewReason}.`, is_read: false }
            });
          }
          return { processed: false, duplicate: false, recorded: true, needsReview: true, cancelled: order.status === 'cancelled', order };
        }

        const entries = await tx.order_payment_entries.findMany({ where: { order_id: order.id } });
        const netReceived = calculateSettledAmount(entries);
        if (intent.purpose === 'order_adjustment' && intent.related_request_id) {
          if (relatedChange?.status === 'awaiting_payment') {
            const change = JSON.parse(relatedChange.new_value || '{}');
            const adjustedTotal = Number(change.totalAmount || (order.total_amount + amount));
            const nextPaymentStatus = netReceived >= adjustedTotal ? 'paid' : (netReceived > 0 ? 'partially_paid' : 'pending');
            await tx.orders.update({ where: { id: order.id }, data: {
              ...(relatedChange.change_type === 'address' ? {
                shipping_address: change.address,
                delivery_area: change.area || null,
                delivery_zone: change.zoneId || null,
                delivery_place_id: change.placeId || null,
                delivery_latitude: change.latitude ?? null,
                delivery_longitude: change.longitude ?? null,
                delivery_distance_meters: change.distanceMeters,
                delivery_quote_at: change.quotedAt ? new Date(change.quotedAt) : new Date(),
                shipping_fee: change.shippingFee
              } : relatedChange.change_type === 'phone' ? { customer_phone: change.phone } : { recipient_phone: change.phone }),
              total_amount: adjustedTotal,
              payment_status: nextPaymentStatus
            } });
            await tx.order_change_requests.update({ where: { id: relatedChange.id }, data: { status: 'applied', reviewed_at: new Date() } });
          }
        } else if (intent.purpose !== 'redelivery_fee') {
          const nextPaymentStatus = netReceived >= order.total_amount ? 'paid' : (netReceived > 0 ? 'partially_paid' : 'pending');
          const claimed = await tx.orders.updateMany({
            where: { id: order.id, status: { in: ['pending', 'confirmed'] }, payment_status: { in: ['pending', 'partially_paid'] } },
            data: { status: order.status === 'pending' ? 'confirmed' : order.status, payment_status: nextPaymentStatus }
          });
          if (claimed.count !== 1) throw new ValidationError('Đơn hàng vừa đổi trạng thái; giao dịch đã được lưu để shop đối soát');
        }
        if (order.user_id) {
          await tx.notifications.create({
            data: { id: crypto.randomUUID(), user_id: order.user_id, order_id: order.id,
              title: `Đã nhận khoản thanh toán #${order.order_code}`,
              message: `SePay đã ghi nhận ${amount.toLocaleString()}đ (${intent.purpose}).`, is_read: false }
          });
        }
        const updated = await tx.orders.findUnique({ where: { id: order.id }, include: { payment_transactions: true, payment_intents: true, payment_entries: true } });
        return { processed: true, duplicate: false, order: updated };
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
        const existing = await this.prisma.payment_transactions.findUnique({ where: { provider_tx_id: providerTxId } });
        if (existing && existing.payment_intent_id === paymentIntentId) return { processed: false, duplicate: true };
      }
      throw err;
    }
  }

  /** Tạo yêu cầu đổi địa chỉ hoặc số điện thoại sau thanh toán; phí tăng có intent riêng. */
  async requestOrderChange({ orderId, userId, customerPhone = '', changeType, value, deliveryQuote = null }) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.orders.findFirst({ where: { OR: [{ id: orderId }, { order_code: orderId }] }, include: { payment_entries: true, change_requests: { select: { status: true } } } });
      const guestAuthorized = Boolean(order && customerPhone &&
        String(order.order_code).toUpperCase() === String(orderId).trim().toUpperCase() &&
        [order.customer_phone, order.recipient_phone].filter(Boolean).some(saved => normalizeVnPhone(saved) === normalizeVnPhone(customerPhone)));
      const accountAuthorized = Boolean(order && userId && order.user_id === userId);
      if (!order || (!guestAuthorized && !accountAuthorized)) throw new NotFoundError('Không tìm thấy đơn thuộc tài khoản hoặc mã đơn/số điện thoại không khớp');
      if (['cancelled', 'completed'].includes(order.status)) throw new ValidationError('Đơn đã kết thúc, vui lòng liên hệ shop');
      if (!['paid', 'partially_paid'].includes(order.payment_status)) throw new ValidationError('Chỉ có thể gửi yêu cầu đổi sau khi đã nhận khoản thanh toán đầu tiên');
      if (!['address', 'phone', 'recipient'].includes(changeType)) throw new ValidationError('Loại thông tin cần đổi không hợp lệ');
      if ((order.change_requests || []).some(request => ['pending', 'awaiting_payment'].includes(request.status))) {
        throw new ValidationError('Đơn đã có yêu cầu đổi đang chờ xử lý hoặc thanh toán');
      }

      const currentValue = changeType === 'address'
        ? { address: order.shipping_address, area: order.delivery_area, zoneId: order.delivery_zone, placeId: order.delivery_place_id,
          latitude: order.delivery_latitude, longitude: order.delivery_longitude,
          distanceMeters: order.delivery_distance_meters, shippingFee: order.shipping_fee, totalAmount: order.total_amount }
        : { phone: changeType === 'phone' ? order.customer_phone : order.recipient_phone };
      const targetShippingFee = changeType === 'address' ? Number(deliveryQuote?.fee) : order.shipping_fee;
      if (changeType === 'address' && (!deliveryQuote || !deliveryQuote.serviceable || !Number.isSafeInteger(targetShippingFee))) {
        throw new ValidationError('Địa chỉ mới chưa có báo giá tuyến hợp lệ');
      }
      const newTotal = order.total_amount + targetShippingFee - order.shipping_fee;
      if (newTotal <= 0) throw new ValidationError('Địa chỉ mới tạo tổng đơn không hợp lệ');
      const newValue = changeType === 'address'
        ? { address: value.address, area: value.area, zoneId: deliveryQuote.zoneId, placeId: value.placeId || '',
          latitude: deliveryQuote.latitude, longitude: deliveryQuote.longitude,
          distanceMeters: deliveryQuote.provider === 'local-mock' ? deliveryQuote.distanceMeters : null,
          shippingFee: targetShippingFee, totalAmount: newTotal, quotedAt: deliveryQuote.quotedAt }
        : { phone: value.phone };
      const delta = calculateAdditionalPaymentDue(order.total_amount, newTotal, calculateSettledAmount(order.payment_entries || []));
      const requiresAdmin = order.status === 'shipping';
      const requestId = crypto.randomUUID();
      const request = await tx.order_change_requests.create({ data: {
        id: requestId, order_id: order.id, change_type: changeType,
        old_value: JSON.stringify(currentValue), new_value: JSON.stringify(newValue), added_fee: delta,
        status: requiresAdmin ? 'pending' : (delta > 0 ? 'awaiting_payment' : 'applied'),
        customer_confirmed_at: new Date(), ...(requiresAdmin || delta > 0 ? {} : { reviewed_at: new Date() })
      } });

      if (!requiresAdmin && delta === 0) {
        await this._applyOrderChange(tx, order, request, newValue, newTotal, targetShippingFee);
      } else if (!requiresAdmin && delta > 0) {
        const intent = await this._createPaymentIntent(tx, order.id, order.payment_plan, delta, 'order_adjustment', request.id);
        return { request, paymentIntent: intent, amountDueNow: delta };
      }
      return { request, paymentIntent: null, amountDueNow: 0 };
    });
  }

  async _applyOrderChange(tx, order, request, newValue, newTotal, shippingFee) {
    const settled = calculateSettledAmount(order.payment_entries || []);
    const update = { total_amount: newTotal, payment_status: settled >= newTotal ? 'paid' : (settled > 0 ? 'partially_paid' : 'pending') };
    if (request.change_type === 'address') Object.assign(update, {
      shipping_address: newValue.address, delivery_area: newValue.area || null, delivery_zone: newValue.zoneId || null,
      delivery_place_id: newValue.placeId || null, delivery_latitude: newValue.latitude ?? null, delivery_longitude: newValue.longitude ?? null,
      delivery_distance_meters: newValue.distanceMeters, delivery_quote_at: new Date(newValue.quotedAt), shipping_fee: shippingFee
    });
    if (request.change_type === 'phone') update.customer_phone = newValue.phone;
    if (request.change_type === 'recipient') update.recipient_phone = newValue.phone;
    await tx.orders.update({ where: { id: order.id }, data: update });
    await tx.order_change_requests.update({ where: { id: request.id }, data: { status: 'applied', reviewed_at: new Date() } });
  }

  /** Nhân viên duyệt/từ chối yêu cầu đổi phát sinh khi đơn đang giao. */
  async reviewOrderChange({ requestId, approved, reviewerId }) {
    return this.prisma.$transaction(async tx => {
      const request = await tx.order_change_requests.findUnique({ where: { id: requestId }, include: { orders: { include: { payment_entries: true } } } });
      if (!request || request.status !== 'pending') throw new ValidationError('Yêu cầu đổi không còn chờ duyệt');
      if (!approved) {
        const rejected = await tx.order_change_requests.update({ where: { id: request.id }, data: { status: 'rejected', reviewed_at: new Date(), reviewed_by_id: reviewerId } });
        return { request: rejected, paymentIntent: null };
      }
      const order = request.orders;
      const value = JSON.parse(request.new_value || '{}');
      const fee = request.change_type === 'address' ? Number(value.shippingFee) : order.shipping_fee;
      const total = order.total_amount + fee - order.shipping_fee;
      const delta = calculateAdditionalPaymentDue(order.total_amount, total, calculateSettledAmount(order.payment_entries || []));
      if (delta > 0) {
        const updated = await tx.order_change_requests.update({ where: { id: request.id }, data: { status: 'awaiting_payment', reviewed_at: new Date(), reviewed_by_id: reviewerId, added_fee: delta } });
        const intent = await this._createPaymentIntent(tx, order.id, order.payment_plan, delta, 'order_adjustment', request.id);
        return { request: updated, paymentIntent: intent };
      }
      await tx.order_change_requests.update({ where: { id: request.id }, data: { reviewed_at: new Date(), reviewed_by_id: reviewerId } });
      await this._applyOrderChange(tx, order, request, value, total, fee);
      const applied = await tx.order_change_requests.findUnique({ where: { id: request.id } });
      return { request: applied, paymentIntent: null };
    });
  }

  /** Ghi yêu cầu hủy; hoàn và khấu trừ chỉ được quyết định ở bước nhân viên xử lý. */
  async requestOrderCancellation({ orderId, userId, customerPhone = '', reason }) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.orders.findFirst({ where: { OR: [{ id: orderId }, { order_code: orderId }] } });
      const guestAuthorized = Boolean(order && customerPhone &&
        String(order.order_code).toUpperCase() === String(orderId).trim().toUpperCase() &&
        [order.customer_phone, order.recipient_phone].filter(Boolean).some(saved => normalizeVnPhone(saved) === normalizeVnPhone(customerPhone)));
      const accountAuthorized = Boolean(order && userId && order.user_id === userId);
      if (!order || (!guestAuthorized && !accountAuthorized)) throw new NotFoundError('Không tìm thấy đơn thuộc tài khoản hoặc mã đơn/số điện thoại không khớp');
      if (['cancelled', 'completed', 'shipping'].includes(order.status)) throw new ValidationError('Đơn đã xuất phát hoặc kết thúc; hãy liên hệ shop để xử lý theo chính sách giao hàng');
      const pending = await tx.order_cancellation_requests.findFirst({ where: { order_id: order.id, status: 'pending' } });
      if (pending) throw new ValidationError('Đơn đã có yêu cầu hủy đang chờ shop xử lý');
      return tx.order_cancellation_requests.create({ data: {
        id: crypto.randomUUID(), order_id: order.id, requested_by: 'customer', reason: String(reason || '').slice(0, 2000) || 'Khách yêu cầu hủy đơn'
      } });
    });
  }

  /** Hủy đơn trong giao dịch ACID; khấu trừ phải có bằng chứng và không vượt số tiền đã nhận. */
  async reviewCancellationRequest({ requestId, approved, reviewerId, deductibleAmount = 0, costBreakdown = [], evidenceNote = '' }) {
    return this.prisma.$transaction(async tx => {
      const request = await tx.order_cancellation_requests.findUnique({ where: { id: requestId }, include: { orders: { include: {
        order_items: true, payment_entries: true, payment_transactions: true, delivery_attempts: true, refund_requests: true
      } } } });
      if (!request || request.status !== 'pending') throw new ValidationError('Yêu cầu hủy không còn chờ xử lý');
      if (!approved) {
        return tx.order_cancellation_requests.update({ where: { id: request.id }, data: { status: 'rejected', reviewed_by_id: reviewerId, reviewed_at: new Date(), evidence_note: evidenceNote || null } });
      }
      const order = request.orders;
      if (['shipping', 'completed', 'cancelled'].includes(order.status)) throw new ValidationError('Đơn đang giao/đã kết thúc; cần xử lý như một lần giao thất bại hoặc liên hệ shop');
      const ledgerReceived = calculateRefundableReceived(order.payment_entries || []);
      const legacyReceived = (order.payment_transactions || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const hasLedgerReceipt = (order.payment_entries || []).some(entry => entry.direction === 'in' && entry.entry_type !== 'redelivery_fee');
      const pendingRefunds = (order.refund_requests || []).filter(item => item.status === 'pending_approval').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const received = Math.max(0, (hasLedgerReceipt ? ledgerReceived : legacyReceived) - pendingRefunds);
      const deduction = request.requested_by === 'shop' ? 0 : Number(deductibleAmount);
      if (!Number.isSafeInteger(deduction) || deduction < 0 || deduction > received) throw new ValidationError('Khoản khấu trừ không hợp lệ hoặc vượt số tiền đã nhận');
      if (deduction > 0 && (!Array.isArray(costBreakdown) || costBreakdown.length === 0 || !String(evidenceNote || '').trim())) {
        throw new ValidationError('Khoản khấu trừ cần danh sách chi phí và ghi chú/bằng chứng');
      }
      const normalizedCosts = (Array.isArray(costBreakdown) ? costBreakdown : []).map(item => ({
        description: String(item?.description || '').trim().slice(0, 255),
        amount: Number(item?.amount)
      }));
      if (deduction > 0 && (normalizedCosts.some(item => !item.description || !Number.isSafeInteger(item.amount) || item.amount <= 0) ||
        normalizedCosts.reduce((sum, item) => sum + item.amount, 0) !== deduction)) {
        throw new ValidationError('Tổng các khoản vật liệu/chi phí phải là số nguyên dương và khớp đúng số tiền khấu trừ');
      }
      if (order.delivery_attempts?.length) throw new ValidationError('Đơn đã có lần giao; hãy xử lý theo chính sách giao thất bại');
      const cancelled = await tx.orders.updateMany({ where: { id: order.id, status: order.status }, data: { status: 'cancelled' } });
      if (cancelled.count !== 1) throw new ValidationError('Đơn vừa được xử lý ở một yêu cầu khác');
      await tx.payment_intents.updateMany({ where: { order_id: order.id, status: 'pending' }, data: { status: 'cancelled' } });
      for (const item of order.order_items) await tx.products.update({ where: { id: item.product_id }, data: { stock: { increment: item.quantity } } });
      if (order.voucher_code) await tx.vouchers.updateMany({ where: { code: order.voucher_code, used_count: { gt: 0 } }, data: { used_count: { decrement: 1 } } });
      const refundAmount = Math.max(0, received - deduction);
      const updatedRequest = await tx.order_cancellation_requests.update({ where: { id: request.id }, data: {
        status: 'approved', reviewed_by_id: reviewerId, reviewed_at: new Date(), deductible_amount: deduction, refund_amount: refundAmount,
        cost_breakdown_json: JSON.stringify(normalizedCosts), evidence_note: String(evidenceNote || '').slice(0, 2000) || null
      } });
      if (deduction > 0) await tx.order_payment_entries.create({
        data: {
          id: crypto.randomUUID(), order_id: order.id, entry_type: 'cancellation_cost', direction: 'out', channel: 'internal',
          amount: deduction, external_ref: `CANCELCOST:${request.id}`, actor_id: reviewerId,
          note: `Chi phí đã phát sinh không thể thu hồi khi hủy đơn; ${String(evidenceNote || '').slice(0, 300)}`
        }
      });
      if (refundAmount > 0) {
        await tx.refund_requests.create({ data: {
          id: `REF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          order_id: order.id, amount: refundAmount, reason: `Hoàn tiền do hủy đơn #${order.order_code}`,
          status: 'pending_approval', requested_by_id: reviewerId, requested_by_name: 'Xử lý yêu cầu hủy'
        } });
      }
      return { request: updatedRequest, refundAmount };
    });
  }

  /** Tạo/ghi nhận lần giao; lần hai phải có phí giao lại đã thanh toán trước. */
  async recordDeliveryAttempt({ orderId, action, actorId, actorRole = 'staff', reason = '', contactLog = '' }) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.orders.findFirst({ where: { OR: [{ id: orderId }, { order_code: orderId }] }, include: { delivery_attempts: { orderBy: { attempt_number: 'asc' } }, payment_entries: true, payment_intents: true } });
      if (!order) throw new NotFoundError(`Không tìm thấy đơn #${orderId}`);
      if (order.status !== 'shipping') throw new ValidationError('Đơn phải ở trạng thái đang giao để ghi nhận lần giao');
      const latest = order.delivery_attempts.at(-1);
      const firstFailed = order.delivery_attempts.find(attempt => attempt.attempt_number === 1 && attempt.status === 'failed');
      if (action === 'start') {
        let number = latest ? latest.attempt_number + 1 : 1;
        if (number > 2 && !(latest?.status === 'exception_required' && actorRole === 'admin')) {
          throw new ValidationError('Đã hết một lần giao lại tự động; lần sau cần bạn duyệt ngoại lệ');
        }
        if (latest && ['failed', 'exception_required'].includes(latest.status)) {
          const deadline = firstFailed?.reschedule_deadline || latest.reschedule_deadline;
          if (!deadline || deadline < new Date()) throw new ValidationError('Đã hết hạn 7 ngày để hẹn giao lại');
          const redeliveryPaid = order.payment_intents.some(item => item.purpose === 'redelivery_fee' && item.related_request_id === latest.id && item.status === 'paid');
          if (!redeliveryPaid) throw new ValidationError('Khách cần thanh toán phí giao lại trước khi xuất phát');
          if (number > 2 && latest.status === 'exception_required' && actorRole !== 'admin') {
            throw new ValidationError('Lần giao tiếp theo cần quản trị viên duyệt ngoại lệ');
          }
        } else if (latest) throw new ValidationError('Lần giao trước chưa kết thúc');
        return tx.delivery_attempts.create({ data: { id: crypto.randomUUID(), order_id: order.id, attempt_number: number, status: 'started', created_by_id: actorId || null } });
      }
      if (action === 'failed') {
        if (!latest || latest.status !== 'started') throw new ValidationError('Cần bắt đầu lần giao trước khi ghi nhận thất bại');
        if (!String(contactLog || '').trim()) throw new ValidationError('Ghi lại ít nhất một lần liên hệ với khách trước khi kết luận giao thất bại');
        const now = new Date();
        if (now.getTime() - latest.started_at.getTime() < 30 * 60 * 1000) throw new ValidationError('Cần chờ đủ tối đa 30 phút và ghi lại liên hệ trước khi kết luận khách vắng');
        const zoneFee = Number(order.shipping_fee || 0);
        const available = Math.max(0, calculateSettledAmount(order.payment_entries));
        const charged = Math.min(zoneFee, available);
        if (charged > 0) await tx.order_payment_entries.create({ data: {
          id: crypto.randomUUID(), order_id: order.id, entry_type: 'delivery_failure_fee', direction: 'out', channel: 'internal', amount: charged,
          external_ref: `FAILDELIVERY:${latest.id}`, actor_id: actorId || null, note: 'Cấn phí chuyến giao thất bại theo vùng đã công bố'
        } });
        const deadline = latest.attempt_number === 1 ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
        return tx.delivery_attempts.update({ where: { id: latest.id }, data: {
          status: latest.attempt_number === 1 ? 'failed' : 'exception_required', failed_at: now,
          fail_reason: String(reason || 'Không gặp được người nhận').slice(0, 255), contact_log: String(contactLog || '').slice(0, 4000),
          fee_charged: charged, reschedule_deadline: deadline
        } });
      }
      throw new ValidationError('Thao tác giao hàng không hợp lệ');
    });
  }

  /** Tạo mã thanh toán riêng cho chuyến giao lại, không cộng khoản này vào tiền hàng. */
  async createRedeliveryPaymentIntent({ orderId, actorId }) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.orders.findFirst({ where: { OR: [{ id: orderId }, { order_code: orderId }] }, include: { delivery_attempts: { orderBy: { attempt_number: 'asc' } }, payment_intents: true } });
      if (!order || order.status !== 'shipping') throw new ValidationError('Chỉ tạo phí giao lại cho đơn đang giao');
      const failed = order.delivery_attempts.at(-1);
      const firstFailed = order.delivery_attempts.find(attempt => attempt.attempt_number === 1 && attempt.status === 'failed');
      if (!failed || !['failed', 'exception_required'].includes(failed.status)) throw new ValidationError('Đơn chưa đủ điều kiện tạo phí giao lại');
      const deadline = firstFailed?.reschedule_deadline || failed.reschedule_deadline;
      if (!deadline || deadline < new Date()) throw new ValidationError('Đã hết hạn 7 ngày để hẹn giao lại');
      const existing = order.payment_intents.find(item => item.purpose === 'redelivery_fee' && item.related_request_id === failed.id && ['pending', 'paid', 'needs_review'].includes(item.status));
      if (existing) return existing;
      const fee = Number(order.shipping_fee || 0) === 0 ? 15000 : Number(order.shipping_fee);
      if (!fee) throw new ValidationError('Không tính được phí giao lại cho khu vực này');
      return this._createPaymentIntent(tx, order.id, order.payment_plan, fee, 'redelivery_fee', failed.id);
    });
  }

  /** Gửi nhắc trước 24 giờ và đóng đơn hết hạn giữ 7 ngày; refund vẫn qua maker-checker. */
  async processDeliveryDeadlines(now = new Date()) {
    const expiredIntents = await this.prisma.payment_intents.findMany({
      where: { status: 'pending', expires_at: { lte: now } },
      select: { id: true, purpose: true, related_request_id: true }
    });
    for (const intent of expiredIntents) {
      await this.prisma.$transaction(async tx => {
        const expired = await tx.payment_intents.updateMany({
          where: { id: intent.id, status: 'pending', expires_at: { lte: now } },
          data: { status: 'expired' }
        });
        if (expired.count === 1 && intent.purpose === 'order_adjustment' && intent.related_request_id) {
          await tx.order_change_requests.updateMany({
            where: { id: intent.related_request_id, status: 'awaiting_payment' },
            data: { status: 'expired', reviewed_at: now }
          });
        }
      });
    }

    // Giữ phí giao lịch sử để đối soát, xóa quãng đường do Google sau 30 ngày.
    const routeDataExpiry = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await this.prisma.orders.updateMany({
      where: { delivery_distance_meters: { not: null }, delivery_quote_at: { lte: routeDataExpiry } },
      data: { delivery_distance_meters: null, delivery_quote_at: null }
    });
    // Xóa ghim vị trí sau 30 ngày khi đơn đã kết thúc; giữ vùng và phí để đối soát lịch sử.
    await this.prisma.orders.updateMany({
      where: {
        delivery_latitude: { not: null },
        status: { in: ['completed', 'cancelled'] },
        delivery_quote_at: { lte: routeDataExpiry }
      },
      data: { delivery_latitude: null, delivery_longitude: null }
    });

    const reminderEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminders = await this.prisma.delivery_attempts.findMany({
      where: { status: 'failed', attempt_number: 1, reminder_sent_at: null, reschedule_deadline: { gt: now, lte: reminderEnd } },
      include: { orders: true }
    });
    for (const attempt of reminders) {
      await this.prisma.$transaction(async tx => {
        const sent = await tx.delivery_attempts.updateMany({ where: { id: attempt.id, reminder_sent_at: null }, data: { reminder_sent_at: now } });
        if (sent.count !== 1 || !attempt.orders.user_id) return;
        await tx.notifications.create({ data: {
          id: crypto.randomUUID(), user_id: attempt.orders.user_id, order_id: attempt.orders.id,
          title: `Nhắc hẹn giao lại đơn #${attempt.orders.order_code}`,
          message: 'Thời hạn hẹn giao lại còn khoảng 24 giờ. Vui lòng liên hệ shop để thống nhất chuyến giao; quá hạn đơn sẽ được đóng và shop xử lý hoàn phần tiền còn lại.', is_read: false
        } });
      });
    }

    const expired = await this.prisma.delivery_attempts.findMany({
      where: { status: 'failed', attempt_number: 1, reschedule_deadline: { lte: now }, orders: { is: { status: 'shipping' } } },
      include: { orders: { include: { payment_entries: true, payment_transactions: true, refund_requests: true } } }
    });
    let closedCount = 0;
    for (const attempt of expired) {
      await this.prisma.$transaction(async tx => {
        const order = attempt.orders;
        const closed = await tx.orders.updateMany({ where: { id: order.id, status: 'shipping' }, data: { status: 'cancelled' } });
        if (closed.count !== 1) return;
        await tx.payment_intents.updateMany({ where: { order_id: order.id, status: 'pending' }, data: { status: 'cancelled' } });
        const receivedFromLedger = calculateRefundableReceived(order.payment_entries || []);
        const hasLedgerReceipt = (order.payment_entries || []).some(entry => entry.direction === 'in' && entry.entry_type !== 'redelivery_fee');
        const legacyReceived = (order.payment_transactions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const alreadyPending = (order.refund_requests || []).filter(item => item.status === 'pending_approval').reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const approvedLegacy = hasLedgerReceipt ? 0 : (order.refund_requests || []).filter(item => item.status === 'approved').reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const refundAmount = Math.max(0, (hasLedgerReceipt ? receivedFromLedger : legacyReceived) - alreadyPending - approvedLegacy);
        if (refundAmount > 0) {
          await tx.refund_requests.create({ data: {
            id: `REF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            order_id: order.id, amount: refundAmount, reason: 'Hoàn phần tiền còn lại do hết hạn hẹn giao lại',
            status: 'pending_approval', requested_by_name: 'Tác vụ tự động giao hàng'
          } });
        }
        if (order.user_id) await tx.notifications.create({ data: {
          id: crypto.randomUUID(), user_id: order.user_id, order_id: order.id,
          title: `Đơn #${order.order_code} đã hết hạn hẹn giao lại`,
          message: refundAmount > 0
            ? `Thời hạn hẹn giao đã hết. Shop đã đóng đơn và tạo yêu cầu hoàn ${refundAmount.toLocaleString()}đ để nhân viên đối soát.`
            : 'Thời hạn hẹn giao đã hết và đơn đã được đóng. Vui lòng liên hệ shop nếu cần hỗ trợ.',
          is_read: false
        } });
        closedCount += 1;
      });
    }
    return { remindersSent: reminders.length, expiredOrdersClosed: closedCount };
  }

  /** Ghi nhận số dư thu tiền mặt khi giao; không dùng trạng thái giao để tự kết luận đã thu. */
  async recordCashCollection({ orderId, amount, actorId = null, note = '' }) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError('Số tiền thu tiền mặt không hợp lệ');
    return this.prisma.$transaction(async tx => {
      const order = await tx.orders.findFirst({ where: { OR: [{ id: orderId }, { order_code: orderId }] } });
      if (!order) throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
      if (order.payment_plan !== 'sepay_deposit') throw new ValidationError('Chỉ thu tiền mặt phần còn lại của đơn trả trước 50%');
      const entries = await tx.order_payment_entries.findMany({ where: { order_id: order.id } });
      const collected = calculateSettledAmount(entries);
      const balance = Math.max(0, order.total_amount - collected);
      if (amount > balance) throw new ValidationError(`Số tiền vượt quá số còn phải thu (${balance.toLocaleString()}đ)`);
      if (!['shipping', 'completed'].includes(order.status)) throw new ValidationError('Chỉ ghi nhận tiền mặt khi đơn đang giao hoặc đã giao');
      await tx.order_payment_entries.create({
        data: { id: crypto.randomUUID(), order_id: order.id, entry_type: 'cod_cash', direction: 'in', channel: 'cash', amount,
          external_ref: `CASH:${crypto.randomUUID()}`, actor_id: actorId, note: String(note || '').slice(0, 500) || 'Thu tiền mặt khi giao' }
      });
      const updatedStatus = collected + amount >= order.total_amount ? 'paid' : 'partially_paid';
      await tx.orders.update({ where: { id: order.id }, data: { payment_status: updatedStatus } });
      const updated = await tx.orders.findUnique({
        where: { id: order.id },
        include: { order_items: true, payment_transactions: true, payment_intents: true, payment_entries: true, delivery_attempts: true }
      });
      return this._mapToDTO(updated, updated.order_items.map(item => ({
        id: item.id, productId: item.product_id, productName: item.product_name, name: item.product_name,
        quantity: item.quantity, unitPrice: item.unit_price, price: item.unit_price
      })));
    }, { isolationLevel: 'Serializable' });
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
    const totalAmount = Number(order.total_amount || 0);
    const amountReceived = Array.isArray(order.payment_entries)
      ? calculateSettledAmount(order.payment_entries)
      : (Array.isArray(order.payment_transactions) && !String(order.payment_plan || '').startsWith('sepay_')
        ? order.payment_transactions.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) : 0);
    const amountToCollectAtDelivery = Math.max(0, totalAmount - amountReceived);
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
      deliveryArea: order.delivery_area || '',
      deliveryZone: order.delivery_zone || '',
      deliveryPlaceId: order.delivery_place_id || '',
      deliveryLatitude: order.delivery_latitude ?? null,
      deliveryLongitude: order.delivery_longitude ?? null,
      deliveryDistanceMeters: order.delivery_distance_meters ?? null,
      deliveryDistanceKm: order.delivery_distance_meters == null ? null : Number((order.delivery_distance_meters / 1000).toFixed(2)),
      deliveryQuoteAt: order.delivery_quote_at || null,
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
      paymentPlan: order.payment_plan || 'legacy_cod',
      termsVersion: order.terms_version || null,
      termsAcceptedAt: order.terms_accepted_at || null,
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
      paymentIntents: Array.isArray(order.payment_intents) ? order.payment_intents.filter(Boolean).map(intent => ({
        id: intent.id, purpose: intent.purpose, referenceCode: intent.reference_code, amount: intent.amount,
        receivedAmount: intent.received_amount, status: intent.status, expiresAt: intent.expires_at, paidAt: intent.paid_at
      })) : [],
      paymentEntries: Array.isArray(order.payment_entries) ? order.payment_entries.map(entry => ({
        id: entry.id, type: entry.entry_type, direction: entry.direction, channel: entry.channel,
        amount: entry.amount, note: entry.note, createdAt: entry.created_at, externalRef: entry.external_ref
      })) : [],
      deliveryAttempts: Array.isArray(order.delivery_attempts) ? order.delivery_attempts.map(attempt => ({
        id: attempt.id, number: attempt.attempt_number, status: attempt.status, startedAt: attempt.started_at,
        failedAt: attempt.failed_at, completedAt: attempt.completed_at, failReason: attempt.fail_reason,
        contactLog: attempt.contact_log, feeCharged: attempt.fee_charged, rescheduleDeadline: attempt.reschedule_deadline,
        reminderSentAt: attempt.reminder_sent_at
      })) : [],
      changeRequests: Array.isArray(order.change_requests) ? order.change_requests.map(request => ({
        id: request.id, type: request.change_type, oldValue: request.old_value, newValue: request.new_value,
        addedFee: request.added_fee, status: request.status, requestedAt: request.requested_at, reviewedAt: request.reviewed_at
      })) : [],
      cancellationRequests: Array.isArray(order.cancellation_requests) ? order.cancellation_requests.map(request => ({
        id: request.id, requestedBy: request.requested_by, reason: request.reason, status: request.status,
        deductibleAmount: request.deductible_amount, refundAmount: request.refund_amount, requestedAt: request.requested_at,
        reviewedAt: request.reviewed_at
      })) : [],
      amountReceived,
      amountToCollectAtDelivery,
      amountCredit: Math.max(0, amountReceived - totalAmount),
      amountDueNow: Array.isArray(order.payment_intents) ? (order.payment_intents.find(intent => intent.status === 'pending')?.amount || 0) : 0,
      paymentIntent: Array.isArray(order.payment_intents) ? (() => {
        const intent = order.payment_intents.find(item => item.status === 'pending') || order.payment_intents[0];
        return intent ? { id: intent.id, purpose: intent.purpose, referenceCode: intent.reference_code, amount: intent.amount, status: intent.status, expiresAt: intent.expires_at } : null;
      })() : null,
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

