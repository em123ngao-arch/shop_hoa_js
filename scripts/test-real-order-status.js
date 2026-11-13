import assert from 'assert';
import { OrderStatus, ORDER_STATUSES } from '../server/domain/state-machines/OrderStatus.js';

console.log('🧪 [TEST 1] Kiểm tra thực tế: State Machine OrderStatus với trạng thái partially_refunded...');

// 1. Đơn SePay đang ở trạng thái pending (chưa thanh toán) -> Phải bị chặn duyệt/giao/hoàn tất
assert.throws(() => {
  OrderStatus.assertCanTransition({
    fromStatus: ORDER_STATUSES.PENDING,
    toStatus: ORDER_STATUSES.CONFIRMED,
    paymentMethod: 'sepay',
    paymentStatus: 'pending'
  });
}, /chưa nhận được tiền từ ngân hàng/);
console.log('  ✓ Đạt: Chặn duyệt đơn SePay khi payment_status = pending');

// 2. Đơn SePay đã thanh toán (paid) -> Được phép duyệt
assert.doesNotThrow(() => {
  OrderStatus.assertCanTransition({
    fromStatus: ORDER_STATUSES.PENDING,
    toStatus: ORDER_STATUSES.CONFIRMED,
    paymentMethod: 'sepay',
    paymentStatus: 'paid'
  });
});
console.log('  ✓ Đạt: Cho phép duyệt đơn SePay khi payment_status = paid');

// 3. Đơn SePay ĐÃ HOÀN TIỀN MỘT PHẦN (partially_refunded) -> Vẫn phải được phép giao hàng (shipping) và hoàn tất (completed)
assert.doesNotThrow(() => {
  OrderStatus.assertCanTransition({
    fromStatus: ORDER_STATUSES.CONFIRMED,
    toStatus: ORDER_STATUSES.SHIPPING,
    paymentMethod: 'sepay',
    paymentStatus: 'partially_refunded'
  });
});
console.log('  ✓ Đạt: Cho phép chuyển sang SHIPPING khi payment_status = partially_refunded');

assert.doesNotThrow(() => {
  OrderStatus.assertCanTransition({
    fromStatus: ORDER_STATUSES.SHIPPING,
    toStatus: ORDER_STATUSES.COMPLETED,
    paymentMethod: 'sepay',
    paymentStatus: 'partially_refunded'
  });
});
console.log('  ✓ Đạt: Cho phép chuyển sang COMPLETED khi payment_status = partially_refunded');

// 4. Chuyển sang cancelled luôn được phép bất kể payment_status
assert.doesNotThrow(() => {
  OrderStatus.assertCanTransition({
    fromStatus: ORDER_STATUSES.CONFIRMED,
    toStatus: ORDER_STATUSES.CANCELLED,
    paymentMethod: 'sepay',
    paymentStatus: 'partially_refunded'
  });
});
console.log('  ✓ Đạt: Cho phép hủy đơn sang CANCELLED khi payment_status = partially_refunded');

console.log('🎉 TEST 1 HOÀN TẤT: State Machine tương thích 100% với partially_refunded!\n');

