import assert from 'assert';
import { isUnpaidSepayOrder, isOrderPaid, calculateOrdersCost } from '../public/js/business-rules.js';

console.log('🧪 [TEST 2] Kiểm tra thực tế: Business Rules (Thanh toán & Giá vốn lịch sử)...');

// 1. Kiểm tra nhận diện thanh toán SePay
const paidSepay = { paymentMethod: 'sepay', paymentStatus: 'paid', status: 'confirmed' };
const partiallyRefundedSepay = { paymentMethod: 'sepay', paymentStatus: 'partially_refunded', status: 'shipping' };
const unpaidSepay = { paymentMethod: 'sepay', paymentStatus: 'pending', status: 'pending' };
const refundedSepay = { paymentMethod: 'sepay', paymentStatus: 'refunded', status: 'cancelled' };

assert.strictEqual(isUnpaidSepayOrder(unpaidSepay), true, 'Đơn pending SePay phải là unpaid');
assert.strictEqual(isUnpaidSepayOrder(paidSepay), false, 'Đơn paid SePay không được là unpaid');
assert.strictEqual(isUnpaidSepayOrder(partiallyRefundedSepay), false, 'Đơn partially_refunded SePay KHÔNG ĐƯỢC bị hiểu nhầm là unpaid!');
assert.strictEqual(isUnpaidSepayOrder(refundedSepay), false, 'Đơn refunded SePay không phải là unpaid (đã hoàn)');
console.log('  ✓ Đạt: isUnpaidSepayOrder nhận diện chính xác partially_refunded');

assert.strictEqual(isOrderPaid(paidSepay), true, 'Đơn paid phải trả về true');
assert.strictEqual(isOrderPaid(partiallyRefundedSepay), true, 'Đơn partially_refunded vẫn được coi là đã thu tiền thành công');
assert.strictEqual(isOrderPaid(refundedSepay), false, 'Đơn refunded trả về false vì đã hoàn toàn bộ');
console.log('  ✓ Đạt: isOrderPaid xác nhận partially_refunded là đơn đã thu tiền hợp lệ');

// 2. Kiểm tra tính giá vốn lịch sử (Historical Cost Snapshot)
// Đơn hàng #1: Đã được snapshot cost_price = 110.000đ lúc khách đặt mua
const orderHistoricalSnapshot = {
  id: 'ORD-001',
  total_amount: 280000,
  items: [
    {
      productId: 'PROD-001',
      quantity: 1,
      unitPrice: 280000,
      costPrice: 110000 // SNAPSHOT LỊCH SỬ THỜI ĐIỂM BÁN
    }
  ]
};

// Sau này, giá nguyên vật liệu tăng, admin sửa giá vốn của PROD-001 thành 160.000đ trong catalog
const catalogProductsCurrent = [
  { id: 'PROD-001', name: 'Hoa Baby', price: 280000, costPrice: 160000 }
];

// Tính giá vốn cho đơn lịch sử: Phải ra 110.000đ (dựa trên snapshot), KHÔNG ĐƯỢC ra 160.000đ (theo catalog mới)!
const calculatedCost = calculateOrdersCost([orderHistoricalSnapshot], catalogProductsCurrent);
assert.strictEqual(calculatedCost, 110000, 'Giá vốn lịch sử phải ưu tiên snapshot 110.000đ thay vì catalog mới 160.000đ!');
console.log('  ✓ Đạt: calculateOrdersCost bảo toàn giá vốn lịch sử 110.000đ không bị thay đổi khi sửa giá catalog');

// Đơn hàng #2: Đơn cũ trước đây (chưa có snapshot costPrice) -> Fallback lấy giá catalog hiện tại (160.000đ)
const orderOldNoSnapshot = {
  id: 'ORD-002',
  total_amount: 280000,
  items: [
    {
      productId: 'PROD-001',
      quantity: 1,
      unitPrice: 280000
      // Không có costPrice trên item
    }
  ]
};
const calculatedCostFallback = calculateOrdersCost([orderOldNoSnapshot], catalogProductsCurrent);
assert.strictEqual(calculatedCostFallback, 160000, 'Đơn cũ thiếu snapshot phải fallback về catalog');
console.log('  ✓ Đạt: calculateOrdersCost fallback về catalog cho đơn chưa có snapshot');

// Đơn hàng #3: Không có snapshot và catalog cũng chưa nhập vốn (costPrice = 0) -> Fallback 65% của 200.000 = 130.000
const orderNoCostAtAll = {
  id: 'ORD-003',
  total_amount: 200000,
  items: [
    {
      productId: 'PROD-UNKNOWN',
      quantity: 1,
      unitPrice: 200000
    }
  ]
};
const calculatedCostRatio = calculateOrdersCost([orderNoCostAtAll], [{ id: 'PROD-UNKNOWN', costPrice: 0 }]);
assert.strictEqual(calculatedCostRatio, 130000, 'Fallback 65% của 200.000đ = 130.000đ');
console.log('  ✓ Đạt: calculateOrdersCost fallback tỷ lệ 65% khi hoàn toàn chưa có giá vốn');

console.log('🎉 TEST 2 HOÀN TẤT: Business Rules thanh toán & kế toán giá vốn lịch sử đạt 100%!\n');

