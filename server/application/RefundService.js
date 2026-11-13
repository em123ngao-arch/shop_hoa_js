/**
 * RefundService.js - Application Service quan ly quy trinh Hoan tien 2 cap (Maker-Checker)
 * Thuoc tang Application (0 Express, 0 Prisma dependencies):
 *  - Thu ngan / Nhan vien (staff) hoac Admin lap de nghi hoan tien (pending_approval)
 *  - CHI Quan tri vien (admin) moi co quyen Duyet hoan tien (approved -> payment_status='refunded') hoac Tu choi (rejected)
 */

import { ValidationError, ForbiddenError, AuthenticationError, NotFoundError } from '../domain/errors/DomainErrors.js';

export class RefundService {
  constructor(refundRepository) {
    this.refundRepo = refundRepository;
  }

  async listRefunds(filters = {}, user) {
    if (!user) throw new AuthenticationError('Yêu cầu đăng nhập');
    if (!['staff', 'admin'].includes(user.role)) {
      throw new ForbiddenError('Chỉ Thu ngân hoặc Quản trị viên mới được xem danh sách hoàn tiền');
    }
    return this.refundRepo.findAll(filters);
  }

  async createRefundRequest({ orderId, amount, reason, bankInfo }, user) {
    if (!user) throw new AuthenticationError('Yêu cầu đăng nhập');
    if (!['staff', 'admin'].includes(user.role)) {
      throw new ForbiddenError('Chỉ Thu ngân hoặc Quản trị viên mới được lập phiếu yêu cầu hoàn tiền');
    }

    const cleanOrderId = String(orderId || '').trim();
    const cleanReason = String(reason || '').trim();
    const cleanBankInfo = String(bankInfo || '').trim();
    const numericAmount = amount !== undefined && amount !== null && amount !== ''
      ? Math.round(Number(amount))
      : null;

    if (!cleanOrderId) {
      throw new ValidationError('Thiếu mã đơn hàng cần hoàn tiền');
    }
    if (cleanReason.length < 3) {
      throw new ValidationError('Vui lòng nhập rõ lý do hoàn tiền (tối thiểu 3 ký tự)');
    }
    if (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount <= 0)) {
      throw new ValidationError('Số tiền hoàn phải lớn hơn 0 đ');
    }

    return this.refundRepo.createRequest({
      orderId: cleanOrderId,
      amount: numericAmount,
      reason: cleanReason,
      bankInfo: cleanBankInfo,
      requestedBy: user
    });
  }

  async approveRefund(refundId, { adminNote = '', refundTxRef = '', restock = false } = {}, user) {
    if (!user) throw new AuthenticationError('Yêu cầu đăng nhập');
    if (user.role !== 'admin') {
      throw new ForbiddenError('Chỉ Quản trị viên (Admin) mới có quyền duyệt hoàn tiền');
    }
    if (!refundId) throw new ValidationError('Thiếu mã phiếu hoàn tiền');

    const result = await this.refundRepo.approveRequest(String(refundId), {
      adminUser: user,
      adminNote: String(adminNote || '').trim(),
      refundTxRef: String(refundTxRef || '').trim(),
      restock: Boolean(restock)
    });
    if (!result) throw new NotFoundError('Không tìm thấy phiếu hoàn tiền');
    return result;
  }

  async rejectRefund(refundId, { adminNote = '' } = {}, user) {
    if (!user) throw new AuthenticationError('Yêu cầu đăng nhập');
    if (user.role !== 'admin') {
      throw new ForbiddenError('Chỉ Quản trị viên (Admin) mới có quyền từ chối phiếu hoàn tiền');
    }
    if (!refundId) throw new ValidationError('Thiếu mã phiếu hoàn tiền');

    const cleanNote = String(adminNote || '').trim();
    if (cleanNote.length < 2) {
      throw new ValidationError('Vui lòng nhập lý do từ chối phiếu hoàn tiền');
    }

    const result = await this.refundRepo.rejectRequest(String(refundId), {
      adminUser: user,
      adminNote: cleanNote
    });
    if (!result) throw new NotFoundError('Không tìm thấy phiếu hoàn tiền');
    return result;
  }
}

