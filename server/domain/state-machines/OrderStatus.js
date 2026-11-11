/**
 * OrderStatus.js - State Machine quan ly vong doi trang thai don hang
 * Thuoc tang Domain / State Machines (Pure JavaScript, 0 dependencies)
 */

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
  [ORDER_STATUSES.SHIPPING]: [ORDER_STATUSES.COMPLETED],
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

