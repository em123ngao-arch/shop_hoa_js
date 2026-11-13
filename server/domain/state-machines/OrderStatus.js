/**
 * OrderStatus.js - State Machine quan ly vong doi trang thai don hang
 * Thuoc tang Domain / State Machines (Pure JavaScript, 0 dependencies)
 */

import { ValidationError } from '../errors/DomainErrors.js';

export const ORDER_STATUSES = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPING: 'shipping',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
});

export const STATUS_MESSAGES = Object.freeze({
  [ORDER_STATUSES.PENDING]: 'Đơn hàng đang chờ xác nhận từ tiệm hoa.',
  [ORDER_STATUSES.CONFIRMED]: 'Nghệ nhân đang bắt đầu lựa hoa kẽm nhung và kết bó tỉ mỉ cho đơn hàng của bạn.',
  [ORDER_STATUSES.SHIPPING]: 'Bó hoa nghệ thuật đang trên đường giao hỏa tốc đến địa chỉ của bạn.',
  [ORDER_STATUSES.COMPLETED]: 'Đơn hàng đã được giao tận tay thành công. Cảm ơn bạn đã lựa chọn Tiệm Hoa Kẽm Nhung!',
  [ORDER_STATUSES.CANCELLED]: 'Đơn hàng đã được cập nhật trạng thái hủy.'
});

// Ma tran chuyen doi trang thai hop le (Khong the dao nguoc tu trang thai ket thuc)
const VALID_TRANSITIONS = Object.freeze({
  [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.SHIPPING, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.SHIPPING]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.COMPLETED]: [], // Trang thai cuoi - Bat bien
  [ORDER_STATUSES.CANCELLED]: []  // Trang thai cuoi - Bat bien
});

export class OrderStateMachine {
  /**
   * Kiem tra xem co the chuyen tu fromStatus sang toStatus duoc khong
   * @param {string} fromStatus 
   * @param {string} toStatus 
   * @returns {boolean}
   */
  static canTransition(fromStatus, toStatus) {
    if (!fromStatus || !toStatus) return false;
    if (fromStatus === toStatus) return true; // Idempotent
    const allowed = VALID_TRANSITIONS[fromStatus];
    return Array.isArray(allowed) && allowed.includes(toStatus);
  }

  /**
   * Kiem tra quy tac chuyen trang thai don hang kem dieu kien thanh toan
   * Chan tuyet doi duyet/giao/hoan thanh don SePay khi chua nhan duoc thanh toan
   * @param {Object} params
   * @param {string} params.fromStatus
   * @param {string} params.toStatus
   * @param {string} [params.paymentMethod='cod']
   * @param {string} [params.paymentStatus='pending']
   */
  static assertCanTransition({ fromStatus, toStatus, paymentMethod = 'cod', paymentStatus = 'pending' }) {
    if (!this.canTransition(fromStatus, toStatus)) {
      throw new ValidationError(`Luồng chuyển trạng thái không hợp lệ: Không thể chuyển từ "${fromStatus}" sang "${toStatus}"`);
    }

    const isPaidOrPartiallyRefunded = ['paid', 'partially_refunded'].includes(String(paymentStatus).toLowerCase());
    if (
      String(paymentMethod).toLowerCase() === 'sepay' &&
      toStatus !== ORDER_STATUSES.CANCELLED &&
      toStatus !== fromStatus &&
      !isPaidOrPartiallyRefunded
    ) {
      throw new ValidationError(
        'Đơn hàng thanh toán VietQR (SePay) chưa nhận được tiền từ ngân hàng, không thể duyệt, giao hàng hoặc hoàn tất.'
      );
    }
  }

  /**
   * Lay danh sach cac trang thai tiep theo hop le
   * @param {string} currentStatus 
   * @returns {string[]}
   */
  static getAllowedNextStatuses(currentStatus) {
    return VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Lay thong diep trang thai phu hop cho khach hang
   * @param {string} status 
   * @returns {string}
   */
  static getStatusMessage(status) {
    return STATUS_MESSAGES[status] || 'Trạng thái đơn hàng đã được cập nhật.';
  }
}

export const OrderStatus = OrderStateMachine;

