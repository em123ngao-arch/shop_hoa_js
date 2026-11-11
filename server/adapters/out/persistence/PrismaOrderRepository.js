/**
 * PrismaOrderRepository.js - Xu ly don hang giao dich ACID va ton kho tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

import { ValidationError, NotFoundError } from '../../../domain/errors/DomainErrors.js';
import { OrderStateMachine } from '../../../domain/state-machines/OrderStatus.js';

export class PrismaOrderRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Tao don hang moi voi giao dich ACID, kiem tra gia & tru kho dong thoi
   */
  async createOrder({ orderData, userId = null }) {
    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new ValidationError('Danh sách sản phẩm trong đơn hàng không được để trống');
    }

    // Thuc thi ben trong Prisma Transaction (ACID Isolation)
    return await this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const verifiedItems = [];

      // 1. Kiem tra tung san pham trong CSDL, kiem tra ton kho & tru kho
      for (const item of orderData.items) {
        const prodId = String(item.id || item.productId);
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

        // Tim san pham trong MySQL (ho tro ca ID dang PROD-001 hoac so nguyen 1)
        let prod = await tx.products.findUnique({ where: { id: prodId } });
        if (!prod && /^\d+$/.test(prodId)) {
          prod = await tx.products.findUnique({ where: { id: `PROD-${prodId.padStart(3, '0')}` } });
        }

        if (!prod || !prod.is_active) {
          throw new ValidationError(`Sản phẩm '${item.name || prodId}' không tồn tại hoặc đã ngừng kinh doanh`);
        }

        if (prod.stock < qty) {
          throw new ValidationError(`Sản phẩm "${prod.name}" chỉ còn ${prod.stock} bó trong kho, không đủ đáp ứng số lượng ${qty}`);
        }

        // Tru ton kho nguyen tu (Atomic Stock Decrement)
        await tx.products.update({
          where: { id: prod.id },
          data: { stock: { decrement: qty } }
        });

        const unitPrice = Number(prod.price);
        subtotal += unitPrice * qty;

        verifiedItems.push({
          id: `ITEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          productId: prod.id,
          productName: prod.name,
          unitPrice: unitPrice,
          quantity: qty,
          originalPrice: Number(prod.original_price || prod.price),
          categoryId: prod.category_id,
          imageUrl: prod.image_url
        });
      }

      // 2. Kiem tra & tinh toan Voucher giam gia tren Server
      let discountAmount = 0;
      let appliedVoucherCode = null;
      let voucherSnapshot = null;
      const rawCode = orderData.voucherCode || orderData.voucher_code;

      if (rawCode && typeof rawCode === 'string') {
        const cleanCode = rawCode.trim().toUpperCase();
        const voucher = await tx.vouchers.findUnique({ where: { code: cleanCode } });

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
            const eligibleAmount = eligibleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
            if (eligibleAmount <= 0) {
              eligibleItems = [];
            }
            if (voucher.discount_type === 'percent') {
              discountAmount = Math.round((eligibleAmount * voucher.discount_value) / 100);
              if (voucher.max_discount && discountAmount > voucher.max_discount) {
                discountAmount = voucher.max_discount;
              }
            } else {
              discountAmount = Math.min(voucher.discount_value, eligibleAmount);
            }

            if (discountAmount > 0) {
              appliedVoucherCode = voucher.code;
              voucherSnapshot = {
                code: voucher.code,
                name: voucher.name,
                discountType: voucher.discount_type,
                discountValue: voucher.discount_value,
                discountAmount: discountAmount,
                eligibleAmount
              };

              // Tang luot su dung voucher nguyen tu
              await tx.vouchers.update({
                where: { id: voucher.id },
                data: { used_count: { increment: 1 } }
              });
            }
          }
        }
      }

      // Phi van chuyen do server tinh theo chinh sach cong khai, khong tin so tien gui tu browser.
      const shippingFee = subtotal >= 350000 ? 0 : 30000;
      const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

      // Sinh ma don hang duy nhat
      const orderId = orderData.id || `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const orderCode = orderData.orderCode || `DH${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      // 3. Luu don hang vao bang orders
      const createdOrder = await tx.orders.create({
        data: {
          id: orderId,
          order_code: orderCode,
          user_id: userId,
          customer_name: (orderData.customerName || orderData.customer_name || 'Khách Hàng').trim(),
          customer_phone: (orderData.customerPhone || orderData.customer_phone || orderData.phone || '').trim(),
          customer_email: (orderData.email || orderData.customerEmail || orderData.customer_email || '').trim() || null,
          recipient_name: (orderData.recipientName || orderData.recipient_name || orderData.customerName || '').trim() || null,
          recipient_phone: (orderData.recipientPhone || orderData.recipient_phone || orderData.phone || '').trim() || null,
          is_gift: Boolean(orderData.isGift || orderData.is_gift),
          shipping_address: (orderData.shippingAddress || orderData.shipping_address || orderData.address || '').trim(),
          delivery_slot: (orderData.deliverySlot || orderData.delivery_slot || '').trim() || null,
          has_greeting_card: Boolean(orderData.hasGreetingCard || orderData.has_greeting_card),
          card_message: (orderData.cardMessage || orderData.card_message || '').trim() || null,
          customer_note: (orderData.note || orderData.customerNote || orderData.customer_note || '').trim() || null,
          shipping_fee: shippingFee,
          subtotal: subtotal,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          status: orderData.status || (orderData.paymentMethod === 'sepay' && orderData.paymentStatus === 'paid' ? 'confirmed' : 'pending'),
          payment_method: orderData.paymentMethod || orderData.payment_method || 'cod',
          payment_status: orderData.paymentStatus || orderData.payment_status || 'pending',
          voucher_code: appliedVoucherCode
        }
      });

      // 4. Luu danh sach san pham vao bang order_items
      await tx.order_items.createMany({
        data: verifiedItems.map(item => ({
          id: item.id,
          order_id: createdOrder.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice
        }))
      });

      // 5. Tu dong sinh thong bao dau tien neu co user_id
      if (userId) {
        await tx.notifications.create({
          data: {
            id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            user_id: userId,
            order_id: createdOrder.id,
            title: `Tạo đơn hàng thành công #${createdOrder.order_code}`,
            message: `Đơn hàng #${createdOrder.order_code} (${totalAmount.toLocaleString()}đ) đã được gửi tới Tiệm Hoa Kẽm Nhung.`,
            is_read: false
          }
        });
      }

      return this._mapToDTO(createdOrder, verifiedItems, voucherSnapshot);
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
            }
          }
        },
        payment_transactions: true
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
      imageUrl: i.products?.image_url || '/images/bloom-of-spring.png',
      categoryId: i.products?.category_id
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
            }
          }
        },
        payment_transactions: true
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
      imageUrl: i.products?.image_url || '/images/bloom-of-spring.png',
      categoryId: i.products?.category_id
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
      const canCancel = order.status === 'pending' || (!userId && order.status === 'confirmed' && order.payment_method === 'cod');
      if (!canCancel || order.payment_status === 'paid') {
        throw new ValidationError('Don hang da duoc xu ly hoac da thanh toan, vui long lien he tiem de duoc ho tro');
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

      const updated = await tx.orders.update({
        where: { id: order.id },
        data: { status: 'cancelled' }
      });

      await tx.notifications.create({
        data: {
          id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          user_id: userId,
          order_id: order.id,
          title: `Da huy don hang #${order.order_code}`,
          message: 'Don hang da huy va ton kho da duoc hoan lai.',
          is_read: false
        }
      });

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
    if (!OrderStateMachine.canTransition(currentStatus, newStatus)) {
      throw new ValidationError(`Luồng chuyển trạng thái không hợp lệ: Không thể chuyển từ "${currentStatus}" sang "${newStatus}"`);
    }

    const data = { status: newStatus };
    if (newStatus === 'completed') {
      data.completed_at = new Date();
    }

    const updated = await this.prisma.orders.update({
      where: { id: order.id },
      data,
      include: {
        order_items: true
      }
    });

    // Sinh thong bao cho khach hang neu don hang co lien ket voi user
    let notification = null;
    if (updated.user_id) {
      notification = await this.prisma.notifications.create({
        data: {
          id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          user_id: updated.user_id,
          order_id: updated.id,
          title: `Cập nhật đơn hàng #${updated.order_code}`,
          message: OrderStateMachine.getStatusMessage(newStatus),
          is_read: false
        }
      });
    }

    return {
      order: this._mapToDTO(updated, order.items),
      notification
    };
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
      shippingAddress: order.shipping_address,
      shipping_address: order.shipping_address,
      address: order.shipping_address,
      shippingFee: order.shipping_fee,
      shipping_fee: order.shipping_fee,
      deliverySlot: order.delivery_slot || 'Giao trong ngày',
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
      items: items
    };
  }
}

