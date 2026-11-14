import { ValidationError } from '../domain/errors/DomainErrors.js';

/**
 * Tính số tiền trả trước và còn lại.
 * @param {number} totalAmount - Tổng cuối đã gồm voucher và phí giao, tính bằng VND.
 * @param {'sepay_full'|'sepay_deposit'} paymentPlan - Kế hoạch thanh toán của đơn mới.
 * @returns {{amountDueNow:number,amountDueAtDelivery:number}} Hai khoản luôn cộng đúng tổng.
 */
export function calculatePaymentAmounts(totalAmount, paymentPlan) {
  const total = Number(totalAmount);
  if (!Number.isSafeInteger(total) || total <= 0) throw new ValidationError('Tổng thanh toán phải lớn hơn 0');
  if (paymentPlan === 'sepay_full') return { amountDueNow: total, amountDueAtDelivery: 0 };
  if (paymentPlan === 'sepay_deposit') {
    const amountDueNow = Math.floor(total / 2);
    if (amountDueNow <= 0) throw new ValidationError('Tổng đơn quá nhỏ để tạo khoản thanh toán trực tuyến');
    return { amountDueNow, amountDueAtDelivery: total - amountDueNow };
  }
  if (paymentPlan === 'legacy_cod') {
    return { amountDueNow: 0, amountDueAtDelivery: total };
  }
  throw new ValidationError('Kế hoạch thanh toán không hợp lệ');
}

/** Tính khoản tăng thêm cần thu sau khi đã tính phần tiền khách trả dư từ lần đổi trước. */
export function calculateAdditionalPaymentDue(currentTotal, newTotal, amountSettled) {
  const current = Number(currentTotal);
  const next = Number(newTotal);
  const settled = Number(amountSettled);
  if (![current, next, settled].every(Number.isSafeInteger) || current < 0 || next < 0 || settled < 0) {
    throw new ValidationError('Dữ liệu đổi tổng đơn không hợp lệ');
  }
  const increase = Math.max(0, next - current);
  const existingCredit = Math.max(0, settled - current);
  return Math.max(0, increase - existingCredit);
}

/**
 * Tính số tiền đơn đã thanh toán ròng; reduce chỉ cộng các khoản áp dụng vào tiền hàng.
 * @param {Array<{entry_type:string,direction:string,amount:number}>} entries - Sổ tiền của một đơn.
 * @returns {number} Số tiền đã được cấn vào tổng đơn.
 */
export function calculateSettledAmount(entries = []) {
  const qualifyingTypes = new Set(['full_payment', 'advance_50', 'cod_cash', 'order_adjustment']);
  return entries.reduce((sum, entry) => {
    if (qualifyingTypes.has(entry.entry_type)) return sum + (entry.direction === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0));
    if (['refund', 'delivery_failure_fee'].includes(entry.entry_type)) return sum - Number(entry.amount || 0);
    return sum;
  }, 0);
}

/**
 * Tính tiền thực shop giữ có thể hoàn lại; reduce loại phí giao lại riêng khỏi tiền hàng.
 * @param {Array<{entry_type:string,direction:string,amount:number}>} entries - Các khoản thu/chi đã ghi sổ.
 * @returns {number} Tiền khách đã chuyển/đưa shop trừ phí đã cấn và khoản hoàn đã ghi.
 */
export function calculateRefundableReceived(entries = []) {
  return entries.reduce((sum, entry) => {
    if (entry.entry_type === 'redelivery_fee') return sum;
    return sum + (entry.direction === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0));
  }, 0);
}
