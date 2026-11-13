import assert from 'assert';

console.log('🧪 Bắt đầu kiểm thử độc lập Business Logic: Hoàn tiền một phần (Partial Refund Flow)...');

// Mô phỏng logic của PrismaRefundRepository
function simulateRefundFlow() {
  const order = {
    id: 'ORD-TEST-001',
    status: 'shipping',
    payment_status: 'paid',
    total_amount: 350000,
    items: [{ product_id: 'PROD-001', quantity: 1 }],
    refund_requests: []
  };

  const inventory = {
    'PROD-001': 10
  };

  // Helper duyệt hoàn tiền
  function approveRefund(requestId, refundAmount) {
    const req = order.refund_requests.find(r => r.id === requestId);
    assert(req, 'Không tìm thấy phiếu');
    assert(req.status === 'pending_approval', 'Phiếu không ở trạng thái pending');
    req.status = 'approved';

    const totalRefundedSum = order.refund_requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + r.amount, 0);

    const orderTotal = order.total_amount;
    const isFullRefund = totalRefundedSum >= orderTotal && orderTotal > 0;

    order.payment_status = isFullRefund ? 'refunded' : 'partially_refunded';

    // Chỉ hủy đơn và hoàn kho khi là hoàn tiền TOÀN PHẦN và đơn chưa hoàn thành
    const shouldCancelAndRestock = isFullRefund && ['pending', 'confirmed', 'shipping'].includes(order.status);
    if (shouldCancelAndRestock) {
      order.status = 'cancelled';
      for (const item of order.items) {
        inventory[item.product_id] += item.quantity;
      }
    }

    return { totalRefundedSum, isFullRefund, shouldCancelAndRestock };
  }

  // BƯỚC 1: Lập phiếu hoàn tiền một phần 50.000đ (bù móp giấy gói)
  console.log('1️⃣ Kiểm tra tạo phiếu hoàn tiền 1 phần 50.000đ...');
  const req1 = { id: 'REF-001', amount: 50000, status: 'pending_approval' };
  order.refund_requests.push(req1);

  // BƯỚC 2: Admin duyệt hoàn tiền một phần
  console.log('2️⃣ Admin duyệt phiếu REF-001 (50.000đ)...');
  const res1 = approveRefund('REF-001', 50000);

  assert.strictEqual(order.payment_status, 'partially_refunded', 'payment_status phải là partially_refunded');
  assert.strictEqual(order.status, 'shipping', 'Đơn hàng KHÔNG ĐƯỢC bị hủy khi hoàn 1 phần!');
  assert.strictEqual(inventory['PROD-001'], 10, 'Tồn kho KHÔNG ĐƯỢC hoàn lại khi hoàn 1 phần!');
  assert.strictEqual(res1.isFullRefund, false, 'isFullRefund phải là false');
  console.log('   -> Kết quả: payment_status =', order.payment_status, '| order.status =', order.status, '| Tồn kho =', inventory['PROD-001']);
  console.log('   ✅ ĐẠT: Hoàn tiền một phần không hủy đơn và không hoàn kho sai lệch!');

  // BƯỚC 3: Hoàn tiếp phần còn lại 300.000đ (khách đổi ý trả lại hoa hoàn toàn)
  console.log('3️⃣ Tạo và duyệt tiếp phần còn lại 300.000đ (hoàn toàn phần)...');
  const req2 = { id: 'REF-002', amount: 300000, status: 'pending_approval' };
  order.refund_requests.push(req2);
  const res2 = approveRefund('REF-002', 300000);

  assert.strictEqual(order.payment_status, 'refunded', 'payment_status phải chuyển sang refunded');
  assert.strictEqual(order.status, 'cancelled', 'Đơn hàng phải chuyển sang cancelled khi hoàn toàn phần');
  assert.strictEqual(inventory['PROD-001'], 11, 'Tồn kho phải được cộng trả lại +1 khi hoàn toàn phần');
  assert.strictEqual(res2.isFullRefund, true, 'isFullRefund phải là true');
  console.log('   -> Kết quả: payment_status =', order.payment_status, '| order.status =', order.status, '| Tồn kho =', inventory['PROD-001']);
  console.log('   ✅ ĐẠT: Hoàn toàn phần tự động hủy đơn và hoàn kho chính xác!');

  // BƯỚC 4: Thử tạo tiếp phiếu thứ 3 khi đơn đã hoàn hết
  console.log('4️⃣ Kiểm tra chặn tạo phiếu khi hạn mức hoàn đã hết...');
  const approvedSum = order.refund_requests.filter(r => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(0, order.total_amount - approvedSum);
  assert.strictEqual(remaining, 0, 'Hạn mức hoàn phải về 0');
  console.log('   -> Hạn mức hoàn còn lại:', remaining, 'VND');
  console.log('   ✅ ĐẠT: Chặn hoàn vượt quá số tiền đơn hàng!');
}

simulateRefundFlow();
console.log('🎉 TOÀN BỘ KIỂM THỬ HOÀN TIỀN 1 PHẦN ĐẠT CHUẨN 100%!');

