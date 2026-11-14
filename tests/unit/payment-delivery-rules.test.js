import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAdditionalPaymentDue, calculatePaymentAmounts, calculateSettledAmount } from '../../server/application/PaymentRules.js';
import { getDeliveryFee, DeliveryService } from '../../server/application/DeliveryService.js';
import { PaymentService } from '../../server/application/PaymentService.js';

test('trả trước 50% làm tròn xuống và phần còn lại cộng đúng tổng', () => {
  assert.deepEqual(calculatePaymentAmounts(100001, 'sepay_deposit'), {
    amountDueNow: 50000,
    amountDueAtDelivery: 50001
  });
});

test('trả đủ 100% yêu cầu toàn bộ tổng cuối qua SePay', () => {
  assert.deepEqual(calculatePaymentAmounts(250000, 'sepay_full'), {
    amountDueNow: 250000,
    amountDueAtDelivery: 0
  });
});

test('đổi địa chỉ chỉ thu phần tăng thực sau khi cấn số dư khách đã trả dư', () => {
  assert.equal(calculateAdditionalPaymentDue(100000, 115000, 100000), 15000);
  assert.equal(calculateAdditionalPaymentDue(75000, 90000, 100000), 0);
  assert.equal(calculateAdditionalPaymentDue(100000, 75000, 50000), 0);
});

test('không cho tạo khoản thanh toán bằng 0 hoặc kế hoạch lạ', () => {
  assert.throws(() => calculatePaymentAmounts(1, 'sepay_deposit'), /Tổng đơn quá nhỏ/);
  assert.throws(() => calculatePaymentAmounts(1000, 'cod'), /Kế hoạch thanh toán/);
});

test('phí tuyến đúng tại các mốc 3, 10, 20 km và từ chối trên 20 km', () => {
  assert.equal(getDeliveryFee(3000), 0);
  assert.equal(getDeliveryFee(3001), 25000);
  assert.equal(getDeliveryFee(10000), 25000);
  assert.equal(getDeliveryFee(10001), 40000);
  assert.equal(getDeliveryFee(20000), 40000);
  assert.equal(getDeliveryFee(20001), null);
});

test('báo giá local deterministic ghi rõ mock và không gọi dịch vụ ngoài', async () => {
  const delivery = new DeliveryService({ mode: 'mock' });
  const quote = await delivery.quote({ address: '1 test street #route:12km', area: 'Phường Tân Phú' });
  assert.equal(quote.fee, 40000);
  assert.equal(quote.distanceMeters, 12000);
  assert.equal(quote.simulated, true);
});

test('local từ chối Google Routes/Places kể cả khi có API key', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const delivery = new DeliveryService({ mode: 'google', apiKey: 'test-key', originAddress: 'Tiệm test' });
  try {
    await assert.rejects(delivery.quote({ address: 'Địa chỉ test', area: 'Phường Hòa Hưng' }), /báo giá mô phỏng/i);
    assert.deepEqual(await delivery.suggest('Đường test'), []);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('sổ tiền không tính phí giao lại thành tiền hàng đã thanh toán', () => {
  assert.equal(calculateSettledAmount([
    { entry_type: 'advance_50', direction: 'in', amount: 50000 },
    { entry_type: 'redelivery_fee', direction: 'in', amount: 15000 },
    { entry_type: 'delivery_failure_fee', direction: 'out', amount: 10000 },
    { entry_type: 'cod_cash', direction: 'in', amount: 60000 }
  ]), 100000);
});

test('webhook không khớp mã được lưu để nhân viên đối soát, không tự nhận là đã trả', async () => {
  let saved = null;
  const service = new PaymentService({
    findSepayPaymentIntentByContent: async () => null,
    findSepayOrderByContent: async () => null,
    recordUnmatchedPayment: async data => { saved = data; return { duplicate: false }; }
  });
  const result = await service.processWebhook({
    id: 'BANK-123', content: 'NO-ORDER-CODE', transferType: 'in', transferAmount: 120000,
    gateway: 'LOCAL BANK', accountNumber: '1234567890', transactionDate: '2026-11-14T10:00:00Z'
  });
  assert.equal(result.processed, false);
  assert.equal(result.unmatched, true);
  assert.equal(result.needsReview, true);
  assert.equal(saved.providerTxId, 'BANK-123');
  assert.equal(saved.amount, 120000);
  assert.equal(saved.content, 'NO-ORDER-CODE');
});

test('webhook chứa nhiều mã thanh toán cũng được giữ lại để xử lý thủ công', async () => {
  let saved = false;
  const service = new PaymentService({
    findSepayPaymentIntentByContent: async () => ({ ambiguous: true }),
    findSepayOrderByContent: async () => { throw new Error('Không được suy đoán đơn cũ khi mã mơ hồ'); },
    recordUnmatchedPayment: async () => { saved = true; return { duplicate: false }; }
  });
  const result = await service.processWebhook({ id: 'BANK-AMBIGUOUS', content: 'PAY123 PAY456', transferType: 'in', transferAmount: 50000 });
  assert.equal(saved, true);
  assert.equal(result.unmatched, true);
  assert.equal(result.reason, 'ambiguous_reference');
});
