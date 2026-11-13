/**
 * scripts/test-hotfix-business-rules.js - Unit test cho 3 lỗi Hotfix trước Giai đoạn C:
 * 1. Kiểu ID danh mục (string '1' vs number 1, ID chuỗi 'CAT-xxx', '0', 'all')
 * 2. Nhãn Voucher phần trăm & cố định VND (chống "Giảm undefined%")
 * 3. Logic Doanh thu & Hóa đơn PDF (tách rõ đơn SePay chưa thanh toán, đã hủy, phí ship)
 */

import assert from 'node:assert/strict';
import {
  matchesCategoryId,
  filterCatalogProducts,
  formatVoucherDisplay,
  isUnpaidSepayOrder,
  isOrderPaid,
  isRevenueRecognizedOrder,
  calculateRevenueStats,
  resolveInvoicePdfMeta
} from '../public/js/business-rules.js';

function test(name, fn) {
  fn();
  console.log(`✅ [PASS] ${name}`);
}

console.log('================================================================');
console.log('🧪 UNIT TESTS: HOTFIX BUSINESS RULES (ID / VOUCHER / REVENUE)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// 1. TIÊU CHÍ KIỂM THỬ KIỂU ID DANH MỤC
// ----------------------------------------------------------------------------
test('Kiểu ID: matchesCategoryId khớp chuỗi "1" với số 1 và chuỗi "1"', () => {
  const prodStringCat = { id: 'PROD-001', categoryId: '1', name: 'Bó Hoa Tulip' };
  const prodNumberCat = { id: 'PROD-002', categoryId: 2, name: 'Hoa Sinh Nhật' };
  const prodCustomCat = { id: 'PROD-099', category_id: 'CAT-VIP-01', name: 'Hoa Thiết Kế' };

  assert.equal(matchesCategoryId(prodStringCat, '0'), true);
  assert.equal(matchesCategoryId(prodStringCat, 0), true);
  assert.equal(matchesCategoryId(prodStringCat, 'all'), true);
  assert.equal(matchesCategoryId(prodStringCat, 1), true);
  assert.equal(matchesCategoryId(prodStringCat, '1'), true);
  assert.equal(matchesCategoryId(prodStringCat, '2'), false);
  assert.equal(matchesCategoryId(prodNumberCat, '2'), true);
  assert.equal(matchesCategoryId(prodCustomCat, 'CAT-VIP-01'), true);
  assert.equal(matchesCategoryId(prodCustomCat, 'CAT-VIP-02'), false);
});

test('Kiểu ID: filterCatalogProducts lọc đúng danh mục & từ khóa và không mutate mảng gốc', () => {
  const sampleProducts = [
    { id: 'PROD-001', name: 'Tulip Kẽm Nhung', categoryId: '1', price: 350000, soldCount: 20 },
    { id: 'PROD-002', name: 'Hồng Sinh Nhật', categoryId: '2', price: 280000, soldCount: 50 },
    { id: 'PROD-003', name: 'Hướng Dương Thiết Kế', categoryId: 'CAT-VIP-01', price: 420000, soldCount: 5 }
  ];

  const cat1 = filterCatalogProducts(sampleProducts, { categoryId: '1' });
  assert.equal(cat1.length, 1);
  assert.equal(cat1[0].id, 'PROD-001');

  const customCat = filterCatalogProducts(sampleProducts, { categoryId: 'CAT-VIP-01' });
  assert.equal(customCat.length, 1);
  assert.equal(customCat[0].id, 'PROD-003');

  const byPriceAsc = filterCatalogProducts(sampleProducts, { categoryId: '0', sort: 'price-asc' });
  assert.deepEqual(byPriceAsc.map(p => p.id), ['PROD-002', 'PROD-001', 'PROD-003']);
  assert.deepEqual(sampleProducts.map(p => p.id), ['PROD-001', 'PROD-002', 'PROD-003']);
});

// ----------------------------------------------------------------------------
// 2. TIÊU CHÍ KIỂM THỬ VOUCHER PHẦN TRĂM & CỐ ĐỊNH
// ----------------------------------------------------------------------------
test('Voucher %: hiển thị đúng % và trần giảm, không có chuỗi "undefined"', () => {
  const pctVoucher = {
    code: 'HOAXUAN20',
    name: 'Ưu đãi mùa xuân',
    discountType: 'percent',
    discountValue: 20,
    minOrder: 200000,
    maxDiscount: 100000
  };
  const meta = formatVoucherDisplay(pctVoucher);
  assert.equal(meta.isPercent, true);
  assert.equal(meta.badgeText, 'Giảm 20%');
  assert.equal(meta.shortTag, '-20%');
  assert.equal(meta.badgeText.includes('undefined'), false);
  assert.equal(meta.conditionText.includes('undefined'), false);
  assert.ok(meta.conditionText.includes('200.000'));
  assert.ok(meta.conditionText.includes('100.000'));
});

test('Voucher cố định (fixed VND): hiển thị đúng số tiền VND, không gắn "%"', () => {
  const fixedVoucher = {
    code: 'GIAM50K',
    name: 'Giảm thẳng 50K',
    discountType: 'fixed',
    discountValue: 50000,
    minOrder: 300000
  };
  const meta = formatVoucherDisplay(fixedVoucher);
  assert.equal(meta.isPercent, false);
  assert.equal(meta.badgeText.includes('%'), false);
  assert.equal(meta.badgeText.includes('undefined'), false);
  assert.ok(meta.badgeText.startsWith('Giảm 50.000'));
  assert.ok(meta.shortTag.startsWith('-50.000'));
  assert.ok(meta.conditionText.includes('300.000'));
});

test('Voucher kiểu cũ (chỉ có discountPercent) vẫn tương thích', () => {
  const legacyVoucher = { code: 'OLD15', name: 'Legacy', discountPercent: 15, desc: 'Đơn từ 100k' };
  const meta = formatVoucherDisplay(legacyVoucher);
  assert.equal(meta.isPercent, true);
  assert.equal(meta.badgeText, 'Giảm 15%');
  assert.equal(meta.conditionText, 'Đơn từ 100k');
});

// ----------------------------------------------------------------------------
// 3. TIÊU CHÍ KIỂM THỬ DOANH THU, HÓA ĐƠN & ĐƠN SEPAY CHƯA THANH TOÁN
// ----------------------------------------------------------------------------
test('Doanh thu: calculateRevenueStats loại bỏ đơn SePay chưa thanh toán, đơn pending và đơn đã hủy', () => {
  const orders = [
    { id: 'O1', status: 'completed', paymentMethod: 'cod', paymentStatus: 'paid', totalAmount: 450000, createdAt: '2026-11-01T10:00:00Z' },
    { id: 'O2', status: 'completed', paymentMethod: 'sepay', paymentStatus: 'paid', totalAmount: 600000, createdAt: '2026-11-05T10:00:00Z' },
    { id: 'O3', status: 'pending', paymentMethod: 'sepay', paymentStatus: 'pending', totalAmount: 900000, createdAt: '2026-11-06T10:00:00Z' },
    { id: 'O4', status: 'completed', paymentMethod: 'sepay', paymentStatus: 'pending', totalAmount: 800000, createdAt: '2026-11-07T10:00:00Z' }, // Dữ liệu lệch cũng phải bị chặn
    { id: 'O5', status: 'shipping', paymentMethod: 'sepay', paymentStatus: 'paid', totalAmount: 740000, createdAt: '2026-11-08T10:00:00Z' }, // Chưa hoàn thành giao
    { id: 'O6', status: 'pending', paymentMethod: 'cod', paymentStatus: 'pending', totalAmount: 350000, createdAt: '2026-11-09T10:00:00Z' },
    { id: 'O7', status: 'cancelled', paymentMethod: 'cod', paymentStatus: 'pending', totalAmount: 500000, createdAt: '2026-11-10T10:00:00Z' }
  ];

  assert.equal(isUnpaidSepayOrder(orders[2]), true);
  assert.equal(isOrderPaid(orders[2]), false);
  assert.equal(isRevenueRecognizedOrder(orders[2]), false);
  assert.equal(isRevenueRecognizedOrder(orders[3]), false);

  const monthly = calculateRevenueStats(orders, 'month', 2026);
  const nov = monthly[10]; // Tháng 11 (index 10)
  assert.equal(nov.orderCount, 2);
  assert.equal(nov.revenue, 1050000); // 450.000 + 600.000

  const quarterly = calculateRevenueStats(orders, 'quarter', 2026);
  const q4 = quarterly[3];
  assert.equal(q4.orderCount, 2);
  assert.equal(q4.revenue, 1050000);
});

test('Hóa đơn PDF: đơn SePay chưa thanh toán không bị gắn nhãn PAID/E-RECEIPT hoặc COD', () => {
  const unpaidSepay = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    orderCode: 'DH-SEPAY-PENDING',
    status: 'pending',
    paymentMethod: 'sepay',
    paymentStatus: 'pending',
    subtotal: 280000,
    shippingFee: 30000,
    discountAmount: 50000,
    totalAmount: 260000
  };

  // Kể cả có truyền nhầm isReceipt: true cũng phải xuất thành Phiếu đơn chưa thanh toán
  const meta = resolveInvoicePdfMeta(unpaidSepay, { isReceipt: true });
  assert.equal(meta.canExport, true);
  assert.equal(meta.orderCode, 'DH-SEPAY-PENDING');
  assert.equal(meta.isPaid, false);
  assert.equal(meta.docKind, 'order_slip');
  assert.equal(meta.titleText, 'PHIEU DON HANG (CHUA THANH TOAN)');
  assert.equal(meta.stamp.badge, '[ CHO CHUYEN KHOAN SEPAY ]');
  assert.equal(meta.stamp.badge.includes('COD'), false);
  assert.deepEqual(meta.totals, {
    subtotal: 280000,
    shippingFee: 30000,
    discountAmount: 50000,
    totalAmount: 260000
  });
});

test('Hóa đơn PDF: phân biệt SePay đã thanh toán, COD đã hoàn tất, và chặn đơn đã hủy', () => {
  const paidSepay = {
    id: 'uuid-paid-sepay',
    orderCode: 'DH-SEPAY-PAID',
    status: 'confirmed',
    paymentMethod: 'sepay',
    paymentStatus: 'paid',
    subtotal: 400000,
    shippingFee: 0,
    discountAmount: 0,
    totalAmount: 400000,
    paymentTransactions: [{ providerTxId: 'TX-2026-888' }]
  };
  const sepayMeta = resolveInvoicePdfMeta(paidSepay, { isReceipt: true });
  assert.equal(sepayMeta.isPaid, true);
  assert.equal(sepayMeta.docKind, 'receipt');
  assert.equal(sepayMeta.stamp.badge, '[ DA THANH TOAN / PAID ]');
  assert.ok(sepayMeta.stamp.line1.includes('SePay'));
  assert.ok(sepayMeta.stamp.line2.includes('TX-2026-888'));

  const completedCod = {
    id: 'ORD-001',
    orderCode: 'DH-1001',
    status: 'completed',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    totalAmount: 450000
  };
  const codMeta = resolveInvoicePdfMeta(completedCod);
  assert.equal(codMeta.isPaid, true);
  assert.equal(codMeta.docKind, 'invoice');
  assert.ok(codMeta.stamp.line1.includes('COD'));
  assert.equal(codMeta.stamp.line1.includes('SePay'), false);

  const cancelledOrder = {
    id: 'uuid-cancelled',
    orderCode: 'DH-CANCEL-1',
    status: 'cancelled',
    paymentMethod: 'sepay',
    paymentStatus: 'pending'
  };
  const cancelMeta = resolveInvoicePdfMeta(cancelledOrder);
  assert.equal(cancelMeta.canExport, false);
});

console.log('\n🎉 TẤT CẢ UNIT TEST HOTFIX (ID / VOUCHER / DOANH THU & SEPAY) ĐẠT 100%!');

