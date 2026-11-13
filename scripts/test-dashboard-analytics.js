import {
  calculateDailyRevenueStats,
  calculateYearlyRevenueStats,
  calculateRevenueStats,
  getDayMonthYearSummary,
  getTodayVsYesterdaySummary,
  aggregateProductDeliveryAndRevenue,
  calculateCategoryRevenueBreakdown,
  orderNeedsRefund,
  isGmvOrder,
  isRevenueRecognizedOrder,
  resolveInvoicePdfMeta
} from '../public/js/business-rules.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log('================================================================');
console.log('🧪 UNIT TESTS: DASHBOARD ANALYTICS, PRODUCT MATRIX & REFUNDS');
console.log('================================================================\n');

const sampleCategories = [
  { id: '1', name: 'Hoa Kẽm Nhung' },
  { id: '2', name: 'Bó Hoa Sinh Nhật' }
];

const sampleProducts = [
  { id: 'P1', name: 'Hoa Hướng Dương', categoryId: '1', price: 300000, costPrice: 150000, stock: 12 },
  { id: 'P2', name: 'Bó Tulip Hồng', categoryId: '2', price: 200000, costPrice: 0, stock: 8 }, // costPrice=0 -> fallback 65%
  { id: 'P3', name: 'Giỏ Hoa Mini', categoryId: '1', price: 400000, costPrice: 200000, stock: 5 }
];

// Giả định các mốc thời gian rõ ràng theo giờ địa phương
const ordersFixture = [
  // Đơn 1: Năm 2025, hoàn thành & thu tiền -> doanh thu năm 2025
  {
    id: 'O-2025',
    status: 'completed',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    totalAmount: 500000,
    createdAt: '2025-11-10T10:00:00',
    items: [{ productId: 'P1', quantity: 1, unitPrice: 300000 }]
  },
  // Đơn 2: Ngày 2026-11-10, hoàn thành, có voucher giảm nên totalAmount = 450.000 đ (P1 300k + P2 200k = 500k)
  {
    id: 'O-1110-OK',
    status: 'completed',
    paymentMethod: 'sepay',
    paymentStatus: 'paid',
    totalAmount: 450000,
    createdAt: '2026-11-10T09:30:00',
    items: [
      { productId: 'P1', quantity: 1, unitPrice: 300000 },
      { productId: 'P2', quantity: 1, unitPrice: 200000 }
    ]
  },
  // Đơn 3: Ngày 2026-11-11, hoàn thành (P2 giá vốn = 0 -> dùng 65% = 130.000đ)
  {
    id: 'O-1111-OK',
    status: 'completed',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    totalAmount: 200000,
    createdAt: '2026-11-11T14:00:00',
    items: [{ productId: 'P2', quantity: 1, unitPrice: 200000 }]
  },
  // Đơn 4: Ngày 2026-11-12 (hôm nay), đang giao hàng (P1 x2) -> tính GMV, KHÔNG tính Revenue, shippingQty += 2
  {
    id: 'O-1112-SHIP',
    status: 'shipping',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    totalAmount: 600000,
    createdAt: '2026-11-12T08:00:00',
    items: [{ productId: 'P1', quantity: 2, unitPrice: 300000 }]
  },
  // Đơn 5: Ngày 2026-11-12, đã xác nhận chưa giao (P3 x1) -> tính GMV, undeliveredQty += 1
  {
    id: 'O-1112-CONF',
    status: 'confirmed',
    paymentMethod: 'sepay',
    paymentStatus: 'paid',
    totalAmount: 400000,
    createdAt: '2026-11-12T10:15:00',
    items: [{ productId: 'P3', quantity: 1, unitPrice: 400000 }]
  },
  // Đơn 6: Ngày 2026-11-12, SePay NHƯNG đã hủy & có giao dịch SePay trễ -> KHÔNG tính GMV, KHÔNG Revenue, orderNeedsRefund=true
  {
    id: 'O-1112-LATEPAY',
    status: 'cancelled',
    paymentMethod: 'sepay',
    paymentStatus: 'pending',
    totalAmount: 300000,
    createdAt: '2026-11-12T11:00:00',
    paymentTransactions: [{ id: 'TX1', providerTxId: 'FT999', amount: 300000 }],
    items: [{ productId: 'P1', quantity: 1, unitPrice: 300000 }]
  },
  // Đơn 7: Ngày 2026-11-12, đã hoàn tiền (paymentStatus = 'refunded') -> KHÔNG tính GMV & KHÔNG tính Revenue, chặn xuất PDF
  {
    id: 'O-1112-REFUNDED',
    status: 'completed',
    paymentMethod: 'sepay',
    paymentStatus: 'refunded',
    totalAmount: 300000,
    createdAt: '2026-11-12T12:00:00',
    paymentTransactions: [{ id: 'TX2', providerTxId: 'FT888', amount: 300000 }],
    items: [{ productId: 'P1', quantity: 1, unitPrice: 300000 }]
  }
];

// 1. Kiểm tra isGmvOrder, isRevenueRecognizedOrder, orderNeedsRefund
assert(isGmvOrder(ordersFixture[3]) === true, 'Đơn shipping được tính vào GMV');
assert(isGmvOrder(ordersFixture[5]) === false, 'Đơn cancelled không tính vào GMV');
assert(isGmvOrder(ordersFixture[6]) === false, 'Đơn đã hoàn tiền (refunded) bị loại khỏi GMV');
assert(isRevenueRecognizedOrder(ordersFixture[1]) === true, 'Đơn completed + SePay paid ghi nhận Doanh Thu');
assert(isRevenueRecognizedOrder(ordersFixture[6]) === false, 'Đơn completed nhưng paymentStatus=refunded KHÔNG tính vào Doanh Thu');
assert(orderNeedsRefund(ordersFixture[5]) === true, 'orderNeedsRefund bắt đúng đơn hủy có paymentTransactions');
assert(orderNeedsRefund(ordersFixture[6]) === false, 'orderNeedsRefund trả về false sau khi đơn đã refunded');

// 2. Theo ngày ("ngày nào ra ngày đó", ngày trống phải hiện 0)
const dailyStats = calculateDailyRevenueStats(ordersFixture, '2026-11-09', '2026-11-12', { products: sampleProducts });
assert(dailyStats.length === 4, 'calculateDailyRevenueStats tạo đủ 4 dòng liên tiếp (09, 10, 11, 12)');
assert(dailyStats[0].dateKey === '2026-11-09' && dailyStats[0].revenue === 0 && dailyStats[0].gmv === 0, 'Ngày 09/11 không có đơn vẫn giữ dòng 0đ');
assert(dailyStats[1].revenue === 450000 && dailyStats[1].orderCount === 1, 'Ngày 10/11 ghi nhận đúng 450.000đ');
// Kiểm tra giá vốn lai: O-1110-OK có P1 (costPrice=150k) + P2 (costPrice=0 -> 65% của 180k? hay 65% của item):
// Vì O-1110-OK dùng P1(cost 150k) + P2(costPrice=0 -> 65% * unitPrice 200k = 130k) => cost = 280.000đ, profit = 450k - 280k = 170.000đ
assert(dailyStats[1].cost === 280000 && dailyStats[1].profit === 170000, 'Giá vốn kết hợp costPrice thật (P1: 150k) và fallback 65% (P2: 130k) tính chuẩn xác');
assert(dailyStats[2].revenue === 200000 && dailyStats[2].cost === 130000 && dailyStats[2].profit === 70000, 'Ngày 11/11 fallback 65% trên 200k ra vốn 130k / lãi 70k');
assert(dailyStats[3].gmv === 1000000 && dailyStats[3].revenue === 0, 'Ngày 12/11 GMV = 1.000.000đ (600k shipping + 400k confirmed), Revenue = 0đ');

// 3. Theo tháng, quý, năm ("tháng nào ra tháng đó", "năm nào ra năm đó")
const monthly2026 = calculateRevenueStats(ordersFixture, 'month', 2026, { products: sampleProducts });
assert(monthly2026.length === 12, 'Chế độ month trả về đủ 12 tháng');
assert(monthly2026[10].revenue === 650000 && monthly2026[10].gmv === 1650000, 'Tháng 11/2026: Revenue = 650.000đ, GMV = 1.650.000đ');

const novDaysDrilldown = calculateRevenueStats(ordersFixture, 'month', 2026, { monthIndex: 11, products: sampleProducts });
assert(novDaysDrilldown.length === 30, 'Chọn riêng Tháng 11 trả về đủ 30 ngày trong tháng');

const quarterly2026 = calculateRevenueStats(ordersFixture, 'quarter', 2026, { products: sampleProducts });
assert(quarterly2026.length === 4 && quarterly2026[3].revenue === 650000, 'Chế độ quarter tách đúng Q4/2026 = 650.000đ');

const yearlyStats = calculateYearlyRevenueStats(ordersFixture, { products: sampleProducts });
const y2025 = yearlyStats.find(y => y.year === 2025);
const y2026 = yearlyStats.find(y => y.year === 2026);
assert(y2025 && y2025.revenue === 500000, 'Chế độ year tách đúng Năm 2025 = 500.000đ');
assert(y2026 && y2026.revenue === 650000 && y2026.refundedAmount === 300000, 'Chế độ year tách đúng Năm 2026 = 650.000đ và Hoàn tiền = 300.000đ');

// 4. Tổng hợp Ngày / Tháng / Năm (Today vs Yesterday)
const dmy = getDayMonthYearSummary(ordersFixture, new Date('2026-11-12T15:00:00'));
assert(dmy.today.gmv === 1000000 && dmy.today.revenue === 0, 'Summary Hôm nay (12/11): GMV = 1.000.000đ, Revenue = 0đ');
assert(dmy.yesterday.revenue === 200000, 'Summary Hôm qua (11/11): Revenue = 200.000đ');
assert(dmy.month.revenue === 650000 && dmy.year.revenue === 650000, 'Summary Tháng 11 và Năm 2026 độc lập với Năm 2025');

const pulse = getTodayVsYesterdaySummary(ordersFixture, new Date('2026-11-12T15:00:00'));
assert(pulse.statusCounts.confirmedCount === 1 && pulse.statusCounts.shippingCount === 1, 'Pulse đếm đúng confirmed & shipping');
assert(pulse.statusCounts.refundPendingCount === 1 && pulse.statusCounts.refundedCount === 1, 'Pulse đếm đúng 1 đơn cần hoàn tiền & 1 đơn đã hoàn tiền');

// 5. Ma trận Sản phẩm: chưa giao / đang giao / đã giao / đã hủy / doanh thu phân bổ sau voucher
const matrix = aggregateProductDeliveryAndRevenue(ordersFixture, sampleProducts, sampleCategories, {
  fromDate: '2026-11-01',
  toDate: '2026-11-30'
});
const rowP1 = matrix.find(m => m.productId === 'P1');
const rowP2 = matrix.find(m => m.productId === 'P2');
const rowP3 = matrix.find(m => m.productId === 'P3');

assert(rowP1.shippingQty === 2 && rowP1.deliveredQty === 1 && rowP1.cancelledQty === 2, 'P1 đếm đúng: đang giao=2, đã giao=1, đã hủy/hoàn=2');
assert(rowP3.undeliveredQty === 1 && rowP3.deliveredQty === 0, 'P3 đếm đúng: chưa giao=1 (confirmed)');
const totalProductDeliveredRev = matrix.reduce((s, m) => s + m.deliveredRevenue, 0);
assert(totalProductDeliveredRev === 650000, `Tổng doanh thu theo mặt hàng (${totalProductDeliveredRev}đ) khớp 100% Doanh Thu Thực Nhận tháng 11 (650.000đ)`);
assert(rowP2.deliveredQty === 2 && rowP2.deliveredRevenue === 380000, 'P2 hưởng đúng phần phân bổ voucher 180k (đơn 10/11) + 200k (đơn 11/11) = 380.000đ');

// 6. Cơ cấu doanh thu theo danh mục khớp 100% tổng doanh thu kỳ
const catBreakdown = calculateCategoryRevenueBreakdown(ordersFixture, sampleProducts, sampleCategories, {
  fromDate: '2026-11-01',
  toDate: '2026-11-30'
});
const catSum = catBreakdown.reduce((s, c) => s + c.revenue, 0);
assert(catSum === 650000, `Tổng doanh thu theo danh mục (${catSum}đ) khớp 100% Doanh Thu Thực Nhận (650.000đ)`);

// 7. Chặn xuất hóa đơn PDF cho đơn đã hoàn tiền
const refundedPdfMeta = resolveInvoicePdfMeta(ordersFixture[6]);
assert(refundedPdfMeta.canExport === false && refundedPdfMeta.errorMessage.includes('hoàn tiền'), 'resolveInvoicePdfMeta chặn xuất hóa đơn đối với đơn đã hoàn tiền');

console.log('\n🎉 TẤT CẢ UNIT TEST DASHBOARD, MA TRẬN MẶT HÀNG & HOÀN TIỀN ĐẠT 100%!');

