/**
 * PrismaRefundRepository.js - Outbound Persistence Adapter cho phan he Hoan tien 2 cap
 * Thuoc tang Adapters / Out / Persistence
 */

import crypto from 'crypto';
import { ValidationError, NotFoundError } from '../../../domain/errors/DomainErrors.js';
import { calculateRefundableReceived } from '../../../application/PaymentRules.js';

export class PrismaRefundRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  _mapDTO(r) {
    if (!r) return null;
    const o = r.orders || null;
    const txs = Array.isArray(o?.payment_transactions) ? o.payment_transactions : [];
    return {
      id: r.id,
      orderId: r.order_id,
      orderCode: o?.order_code || r.order_id,
      amount: r.amount,
      reason: r.reason,
      bankInfo: r.bank_info || '',
      status: r.status,
      requestedById: r.requested_by_id,
      requestedByName: r.requested_by_name || 'Thu ngân',
      requestedAt: r.requested_at,
      reviewedById: r.reviewed_by_id,
      reviewedByName: r.reviewed_by_name || null,
      reviewedAt: r.reviewed_at,
      adminNote: r.admin_note || '',
      refundTxRef: r.refund_tx_ref || '',
      order: o ? {
        id: o.id,
        orderCode: o.order_code,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        totalAmount: o.total_amount,
        status: o.status,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
        paymentTransactions: txs.map(t => ({
          id: t.id,
          provider: t.provider,
          providerTxId: t.provider_tx_id,
          amount: t.amount,
          bankBrand: t.bank_brand,
          accountNumber: t.account_number,
          transactionDate: t.transaction_date
        }))
      } : null
    };
  }

  async findAll({ status = null } = {}) {
    const where = {};
    if (status && ['pending_approval', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const rows = await this.prisma.refund_requests.findMany({
      where,
      orderBy: { requested_at: 'desc' },
      include: {
        orders: {
          include: { payment_transactions: true }
        }
      }
    });
    return rows.map(r => this._mapDTO(r));
  }

  async findById(id) {
    const row = await this.prisma.refund_requests.findUnique({
      where: { id: String(id) },
      include: {
        orders: {
          include: { payment_transactions: true }
        }
      }
    });
    return this._mapDTO(row);
  }

  async createRequest({ orderId, amount, reason, bankInfo, requestedBy }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findFirst({
        where: { OR: [{ id: orderId }, { order_code: orderId }] },
        include: {
          payment_transactions: { include: { payment_intents: true } },
          payment_entries: true,
          refund_requests: true
        }
      });

      if (!order) {
        throw new NotFoundError(`Không tìm thấy đơn hàng #${orderId}`);
      }

      const paidViaTransactions = (order.payment_transactions || []).filter(txRow => txRow.payment_intents?.purpose !== 'redelivery_fee').reduce(
        (sum, txRow) => sum + Number(txRow.amount || 0),
        0
      );
      const ledgerReceived = calculateRefundableReceived(order.payment_entries || []);
      const hasLedgerReceipt = (order.payment_entries || []).some(entry => entry.direction === 'in' && entry.entry_type !== 'redelivery_fee');
      const alreadyApprovedTotal = (order.refund_requests || [])
        .filter(r => r.status === 'approved')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const actuallyReceived = hasLedgerReceipt ? ledgerReceived : paidViaTransactions;
      const isPaid = actuallyReceived > 0 || order.payment_status === 'paid' || order.payment_status === 'partially_refunded';
      if (!isPaid && order.status !== 'completed') {
        throw new ValidationError('Chỉ có thể tạo yêu cầu hoàn tiền cho đơn hàng đã thanh toán hoặc đã hoàn thành');
      }

      const maxRefundable = actuallyReceived + (hasLedgerReceipt ? alreadyApprovedTotal : 0);
      const remainingRefundable = Math.max(0, maxRefundable - alreadyApprovedTotal);

      if (order.payment_status === 'refunded' || remainingRefundable <= 0) {
        throw new ValidationError('Đơn hàng này đã được duyệt hoàn trả toàn bộ số tiền thanh toán');
      }

      const hasPending = (order.refund_requests || []).some(
        r => r.status === 'pending_approval'
      );
      if (hasPending) {
        throw new ValidationError('Đơn hàng đang có một phiếu yêu cầu hoàn tiền chờ Quản trị viên duyệt');
      }

      const refundAmount = amount !== null ? amount : remainingRefundable;
      if (refundAmount > remainingRefundable) {
        throw new ValidationError(`Số tiền yêu cầu hoàn (${refundAmount.toLocaleString('vi-VN')}đ) vượt quá số tiền còn lại có thể hoàn (${remainingRefundable.toLocaleString('vi-VN')}đ)`);
      }

      const created = await tx.refund_requests.create({
        data: {
          id: `REF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          order_id: order.id,
          amount: refundAmount,
          reason,
          bank_info: bankInfo || null,
          status: 'pending_approval',
          requested_by_id: requestedBy?.id || null,
          requested_by_name: requestedBy?.name || requestedBy?.email || 'Thu ngân'
        },
        include: {
          orders: {
            include: { payment_transactions: true }
          }
        }
      });

      return this._mapDTO(created);
    }, { isolationLevel: 'Serializable' });
  }

  async approveRequest(id, { adminUser, adminNote, refundTxRef, restock = false }) {
    return this.prisma.$transaction(async (tx) => {
      if (!String(refundTxRef || '').trim()) {
        throw new ValidationError('Chỉ xác nhận hoàn tất sau khi đã chuyển khoản và nhập mã tham chiếu giao dịch hoàn');
      }
      const existing = await tx.refund_requests.findUnique({
        where: { id },
        include: {
          orders: {
            include: { order_items: true, payment_transactions: { include: { payment_intents: true } } }
          }
        }
      });
      if (!existing) return null;

      if (existing.status !== 'pending_approval') {
        throw new ValidationError(`Phiếu hoàn tiền đã ở trạng thái "${existing.status}", không thể duyệt lại`);
      }

      const order = existing.orders;
      const ledgerEntries = order ? await tx.order_payment_entries.findMany({ where: { order_id: order.id } }) : [];
      const hasLedgerReceipt = ledgerEntries.some(entry => entry.direction === 'in' && entry.entry_type !== 'redelivery_fee');
      const sepayReceipts = (order?.payment_transactions || []).filter(item => item.payment_intents?.purpose !== 'redelivery_fee')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const currentAvailable = hasLedgerReceipt ? calculateRefundableReceived(ledgerEntries) : sepayReceipts;
      const approvedBefore = (await tx.refund_requests.findMany({ where: { order_id: existing.order_id, status: 'approved' } }))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const otherPending = (await tx.refund_requests.findMany({
        where: { order_id: existing.order_id, status: 'pending_approval', id: { not: existing.id } }
      })).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const refundableNow = hasLedgerReceipt ? currentAvailable : Math.max(0, currentAvailable - approvedBefore);
      if (Number(existing.amount) > refundableNow - otherPending) {
        throw new ValidationError('Số tiền hoàn đã thay đổi do giao dịch khác; hãy tạo lại phiếu theo số còn có thể hoàn');
      }

      const claimed = await tx.refund_requests.updateMany({
        where: { id, status: 'pending_approval' },
        data: {
          status: 'approved',
          reviewed_by_id: adminUser?.id || null,
          reviewed_by_name: adminUser?.name || adminUser?.email || 'Quản trị viên',
          reviewed_at: new Date(),
          admin_note: adminNote || null,
          refund_tx_ref: refundTxRef || null
        }
      });

      if (claimed.count !== 1) {
        throw new ValidationError('Phiếu hoàn tiền vừa được xử lý ở yêu cầu khác');
      }

      if (order) {
        const ledgerReceived = calculateRefundableReceived(ledgerEntries);

        // Tính tổng tiền hoàn lũy kế của đơn này (bao gồm cả phiếu vừa duyệt)
        const allApproved = await tx.refund_requests.findMany({
          where: { order_id: order.id, status: 'approved' }
        });
        const totalRefundedSum = allApproved.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const hasLedgerReceipt = ledgerEntries.some(entry => entry.direction === 'in' && entry.entry_type !== 'redelivery_fee');
        const refundedBeforeThisRequest = Math.max(0, totalRefundedSum - Number(existing.amount || 0));
        const actuallyReceived = hasLedgerReceipt ? ledgerReceived + refundedBeforeThisRequest : sepayReceipts;
        const isFullRefund = totalRefundedSum >= actuallyReceived && actuallyReceived > 0;

        await tx.order_payment_entries.create({
          data: {
            id: crypto.randomUUID(), order_id: order.id, entry_type: 'refund', direction: 'out', channel: 'sepay',
            amount: Number(existing.amount), external_ref: `REFUND:${String(refundTxRef).trim()}`.slice(0, 120),
            actor_id: adminUser?.id || null, note: adminNote || `Hoàn tiền theo phiếu ${existing.id}`
          }
        });

        const orderUpdateData = {
          payment_status: isFullRefund ? 'refunded' : 'partially_refunded'
        };

        // 1. Chỉ hủy đơn khi là hoàn tiền TOÀN PHẦN và đơn chưa hoàn tất thành công
        const shouldCancel = isFullRefund && ['pending', 'confirmed', 'shipping'].includes(order.status);
        if (shouldCancel) {
          orderUpdateData.status = 'cancelled';
        }

        await tx.orders.update({
          where: { id: order.id },
          data: orderUpdateData
        });
        if (shouldCancel) {
          await tx.payment_intents.updateMany({ where: { order_id: order.id, status: 'pending' }, data: { status: 'cancelled' } });
          await tx.order_change_requests.updateMany({
            where: { order_id: order.id, status: { in: ['pending', 'awaiting_payment'] } },
            data: { status: 'rejected', reviewed_at: new Date(), reviewed_by_id: adminUser?.id || null }
          });
        }

        // 2. Nghiệp vụ tiệm hoa: Chỉ tự động hoàn kho nếu hoa CHƯA rời khỏi tiệm (pending, confirmed).
        // Nếu đơn đang giao (shipping), hoa đang trên đường/ngoài tiệm nên KHÔNG tự động cộng kho,
        // trừ khi Admin/Thu ngân đã xác nhận hoa quay về tiệm nguyên vẹn (restock === true).
        const canAutoRestock = ['pending', 'confirmed'].includes(order.status);
        const shouldRestock = isFullRefund && (canAutoRestock || restock === true);

        if (shouldRestock) {
          for (const item of order.order_items || []) {
            await tx.products.update({
              where: { id: item.product_id },
              data: { stock: { increment: item.quantity } }
            });
          }
        }

        if (shouldCancel && order.voucher_code) {
          await tx.vouchers.updateMany({
            where: { code: order.voucher_code, used_count: { gt: 0 } },
            data: { used_count: { decrement: 1 } }
          });
        }

        if (order.user_id) {
          await tx.notifications.create({
            data: {
              id: crypto.randomUUID(),
              user_id: order.user_id,
              order_id: order.id,
              title: `Đã duyệt hoàn tiền đơn #${order.order_code}`,
              message: `Yêu cầu hoàn tiền ${Number(existing.amount).toLocaleString('vi-VN')}đ cho đơn #${order.order_code} đã được Quản trị viên phê duyệt.${refundTxRef ? ` Mã tham chiếu: ${refundTxRef}.` : ''}`,
              is_read: false
            }
          });
        }
      }

      const updated = await tx.refund_requests.findUnique({
        where: { id },
        include: {
          orders: {
            include: { payment_transactions: true }
          }
        }
      });
      return this._mapDTO(updated);
    }, { isolationLevel: 'Serializable' });
  }

  async rejectRequest(id, { adminUser, adminNote }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.refund_requests.findUnique({ where: { id } });
      if (!existing) return null;

      if (existing.status !== 'pending_approval') {
        throw new ValidationError(`Phiếu hoàn tiền đã ở trạng thái "${existing.status}", không thể từ chối`);
      }

      const claimed = await tx.refund_requests.updateMany({
        where: { id, status: 'pending_approval' },
        data: {
          status: 'rejected',
          reviewed_by_id: adminUser?.id || null,
          reviewed_by_name: adminUser?.name || adminUser?.email || 'Quản trị viên',
          reviewed_at: new Date(),
          admin_note: adminNote
        }
      });
      if (claimed.count !== 1) {
        throw new ValidationError('Phiếu hoàn tiền vừa được xử lý ở yêu cầu khác');
      }

      const updated = await tx.refund_requests.findUnique({
        where: { id },
        include: {
          orders: {
            include: { payment_transactions: true }
          }
        }
      });
      return this._mapDTO(updated);
    });
  }
}

