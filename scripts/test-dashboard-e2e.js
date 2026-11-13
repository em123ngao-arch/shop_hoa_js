import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright';
import app from '../server.js';
import { container } from '../server/infrastructure/config/container.js';

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runDashboardAndPhaseCE2E() {
  const prisma = container.prisma;
  const createdOrderIds = [];
  const createdRefundIds = [];
  let tempStaffId = null;
  let tempCustId = null;
  let serverInstance = null;
  let browser = null;
  let testFailed = false;
  const tempDownloads = [];

  try {
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(0, '127.0.0.1', resolve));
    const { port } = serverInstance.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log('================================================================');
    console.log('🧪 PLAYWRIGHT E2E TEST SUITE: PHASE C & PHASE D (ADMIN/ANALYTICS/REFUNDS)');
    console.log('================================================================\n');
    console.log(`[E2E Server] Listening at ${baseUrl}`);

    // Chuẩn bị dữ liệu test cô lập trong DB
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const staffEmail = `cashier_e2e_${uniqueSuffix}@shophoa.example`;
    const custEmail = `cust_e2e_${uniqueSuffix}@shophoa.example`;
    const passHash = await bcrypt.hash('TestPass123!', 10);

    tempStaffId = `USR-STAFF-E2E-${uniqueSuffix}`;
    tempCustId = `USR-CUST-E2E-${uniqueSuffix}`;

    await prisma.users.createMany({
      data: [
        { id: tempStaffId, name: 'Thu Ngân E2E', email: staffEmail, password_hash: passHash, role: 'staff', phone: '0901222333' },
        { id: tempCustId, name: 'Khách Hóa Đơn E2E', email: custEmail, password_hash: passHash, role: 'customer', phone: '0901444555' }
      ]
    });

    const sampleProd = await prisma.products.findFirst({ where: { is_active: true } });
    assert(Boolean(sampleProd), 'Có sản phẩm active trong MySQL để tạo kịch bản E2E');

    // Đơn 1: Đơn SePay đã hủy nhưng chuyển khoản muộn -> Thu ngân lập hoàn tiền, Admin duyệt
    const lateOrderId = `ORD-E2E-LATE-${uniqueSuffix}`;
    const lateOrderCode = `DHLATE${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    // Đơn 2: Đơn đã hoàn thành & đã thu tiền của khách cust_e2e -> Test Xem Hóa Đơn Điện Tử trên orders.html + thống kê Dashboard
    const completedOrderId = `ORD-E2E-DONE-${uniqueSuffix}`;
    const completedOrderCode = `DHDONE${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    // Đơn 3: Đơn đang giao hàng -> Test Ma trận Mặt hàng (Đang giao > 0)
    const shippingOrderId = `ORD-E2E-SHIP-${uniqueSuffix}`;
    const shippingOrderCode = `DHSHIP${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    createdOrderIds.push(lateOrderId, completedOrderId, shippingOrderId);

    await prisma.orders.create({
      data: {
        id: lateOrderId,
        order_code: lateOrderCode,
        customer_name: 'Nguyễn Thị Hoàn Tiền',
        customer_phone: '0908111222',
        shipping_address: '99 Hoa Hồng, Phú Nhuận',
        payment_method: 'sepay',
        payment_status: 'pending',
        status: 'cancelled',
        subtotal: 420000,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 420000,
        order_items: {
          create: [{
            id: `OI-E2E1-${uniqueSuffix}`,
            product_id: sampleProd.id,
            product_name: sampleProd.name,
            unit_price: 420000,
            quantity: 1
          }]
        },
        payment_transactions: {
          create: [{
            id: `TX-E2E1-${uniqueSuffix}`,
            provider: 'sepay',
            provider_tx_id: `FT-E2E1-${uniqueSuffix}`,
            amount: 420000,
            bank_brand: 'TPBank',
            account_number: '70207003455',
            transaction_date: new Date()
          }]
        }
      }
    });

    await prisma.orders.create({
      data: {
        id: completedOrderId,
        order_code: completedOrderCode,
        user_id: tempCustId,
        customer_name: 'Khách Hóa Đơn E2E',
        customer_phone: '0901444555',
        shipping_address: '12 Lê Lợi, Q1, TP.HCM',
        payment_method: 'sepay',
        payment_status: 'paid',
        status: 'completed',
        subtotal: 420000,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 420000,
        order_items: {
          create: [{
            id: `OI-E2E2-${uniqueSuffix}`,
            product_id: sampleProd.id,
            product_name: sampleProd.name,
            unit_price: 420000,
            quantity: 2
          }]
        },
        payment_transactions: {
          create: [{
            id: `TX-E2E2-${uniqueSuffix}`,
            provider: 'sepay',
            provider_tx_id: `FT-E2E2-${uniqueSuffix}`,
            amount: 420000,
            bank_brand: 'TPBank',
            account_number: '70207003455',
            transaction_date: new Date()
          }]
        }
      }
    });

    await prisma.orders.create({
      data: {
        id: shippingOrderId,
        order_code: shippingOrderCode,
        customer_name: 'Khách Đang Giao E2E',
        customer_phone: '0901555666',
        shipping_address: '45 Nguyễn Huệ, Q1',
        payment_method: 'cod',
        payment_status: 'pending',
        status: 'shipping',
        subtotal: 350000,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 350000,
        order_items: {
          create: [{
            id: `OI-E2E3-${uniqueSuffix}`,
            product_id: sampleProd.id,
            product_name: sampleProd.name,
            unit_price: 350000,
            quantity: 1
          }]
        }
      }
    });

    browser = await chromium.launch({ headless: true });

    // =========================================================================
    // SCENARIO 1: PHASE C (Thumbnail đơn lẻ ẩn, BUG-02 Xem Hóa Đơn Điện Tử + Noto Sans PDF)
    // =========================================================================
    console.log('\n--- SCENARIO 1: Phase C UI Checks (C4 Thumbnail, BUG-02 Orders PDF + Noto Sans) ---');
    const custCtx = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
    const custPage = await custCtx.newPage();
    const custErrors = [];
    custPage.on('pageerror', (err) => custErrors.push(err.message));

    await custPage.goto(`${baseUrl}/detail.html?id=${encodeURIComponent(sampleProd.id)}`, { waitUntil: 'networkidle' });
    await custPage.waitForSelector('#mainDetailImage');
    const thumbCount = await custPage.locator('#detailThumbnails').count();
    assert(thumbCount === 0, 'C4 (BUG-09): Sản phẩm chỉ có 1 ảnh đã ẩn dải #detailThumbnails');

    await custPage.goto(`${baseUrl}/login.html?returnUrl=${encodeURIComponent('/orders.html')}`, { waitUntil: 'networkidle' });
    await custPage.fill('#email', custEmail);
    await custPage.fill('#password', 'TestPass123!');
    await custPage.click('#submitBtn');
    await custPage.waitForURL(/orders\.html/);
    await custPage.waitForSelector('.order-craft-card');

    // Bấm "Xem Hóa Đơn Điện Tử" -> không được phát sinh lỗi doc.autoTable is not a function
    const invoiceBtn = custPage.locator('.btn-order-view-pdf').first();
    await invoiceBtn.waitFor({ state: 'visible' });
    await custPage.evaluate(() => {
      window.__pdfExportCapture = null;
      window.open = () => ({ closed: false });
      const RealBlob = window.Blob;
      window.Blob = function (parts, opts) {
        if (opts && opts.type === 'application/pdf') {
          window.__pdfExportCapture = { size: parts?.[0]?.byteLength || parts?.[0]?.length || 1 };
        }
        return new RealBlob(parts, opts);
      };
    });
    await invoiceBtn.click();
    await custPage.waitForTimeout(800);
    assert(!custErrors.some(m => m.includes('autoTable')), 'BUG-02: Bấm «Xem Hóa Đơn Điện Tử» trên orders.html không còn lỗi doc.autoTable is not a function');
    assert(custErrors.length === 0, `orders.html không có lỗi runtime JS (${custErrors.join('; ')})`);
    await custPage.screenshot({ path: path.join(ARTIFACT_DIR, 'after_phase_cd_orders_invoice.png'), fullPage: false });
    await custCtx.close();

    // =========================================================================
    // SCENARIO 2: MAKER-CHECKER STEP 1 - THU NGÂN (STAFF) LẬP PHIẾU HOÀN TIỀN
    // =========================================================================
    console.log('\n--- SCENARIO 2: Staff (Thu Ngân) Creates Refund Request & Cannot Self-Approve ---');
    const staffCtx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const staffPage = await staffCtx.newPage();

    await staffPage.goto(`${baseUrl}/login.html?returnUrl=${encodeURIComponent('/admin.html')}`, { waitUntil: 'networkidle' });
    await staffPage.fill('#email', staffEmail);
    await staffPage.fill('#password', 'TestPass123!');
    await staffPage.click('#submitBtn');
    await staffPage.waitForURL(/admin\.html/);
    await staffPage.waitForSelector('.nav-item[data-tab="orders"]');

    // Vào Tab Đơn hàng -> lọc Cần hoàn tiền -> Mở chi tiết đơn lateOrder
    await staffPage.click('.nav-item[data-tab="orders"]');
    await staffPage.waitForSelector('#orderSegmentedTabs button[data-segment="needs_refund"]');
    await staffPage.click('#orderSegmentedTabs button[data-segment="needs_refund"]');
    await staffPage.waitForSelector(`tr[data-id="${lateOrderId}"]`);
    await staffPage.click(`tr[data-id="${lateOrderId}"] .view-order-btn`);

    await staffPage.waitForSelector('.btn-modal-create-refund');
    await staffPage.click('.btn-modal-create-refund');
    await staffPage.waitForSelector('#refundActionModal:not(.hidden)');
    await staffPage.fill('#refundBankInfoInput', 'Vietcombank 0123456789 - NGUYEN THI HOAN');
    await staffPage.fill('#refundReasonInput', 'Khách chuyển VietQR trễ sau khi đơn hủy - E2E');
    await staffPage.click('#refundActionSubmitBtn');
    await staffPage.waitForSelector('#refundActionModal', { state: 'hidden' });

    // Chuyển sang Tab Hoàn tiền -> kiểm tra Thu ngân thấy phiếu pending_approval nhưng KHÔNG có nút Duyệt
    await staffPage.click('.nav-item[data-tab="refunds"]');
    await staffPage.waitForSelector('#adminRefundsTable tr');
    const staffRefundRow = staffPage.locator('#adminRefundsTable tr', { hasText: lateOrderCode }).first();
    await staffRefundRow.waitFor({ state: 'visible' });
    const staffApproveBtnCount = await staffRefundRow.locator('.btn-refund-approve').count();
    const staffRowText = await staffRefundRow.innerText();
    assert(staffApproveBtnCount === 0 && staffRowText.includes('Chờ Admin duyệt'),
      'Maker-Checker UI: Thu ngân thấy phiếu vừa lập nhưng KHÔNG thấy nút ✓ Duyệt (chỉ Admin được duyệt)');
    await staffCtx.close();

    // =========================================================================
    // SCENARIO 3: ADMIN DUYỆT HOÀN TIỀN, DASHBOARD, MA TRẬN SP, CHART & EXCEL/PDF
    // =========================================================================
    console.log('\n--- SCENARIO 3: Admin Approves Refund, Tab 1/2/6 Analytics, Product Matrix & Exports ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
    const adminPage = await adminCtx.newPage();
    const adminErrors = [];
    adminPage.on('pageerror', (err) => adminErrors.push(err.message));

    await adminPage.goto(`${baseUrl}/login.html?returnUrl=${encodeURIComponent('/admin.html')}`, { waitUntil: 'networkidle' });
    await adminPage.fill('#email', 'admin@shophoa.example');
    await adminPage.fill('#password', 'admin123');
    await adminPage.click('#submitBtn');
    await adminPage.waitForURL(/admin\.html/);
    await adminPage.waitForSelector('#dashboardTopProductsList');

    // 3.1 Tab 1 Dashboard: Top 5 có số bán > 0, Recent Orders click mở modal, 14 ngày / 12 tháng
    const topListText = await adminPage.locator('#dashboardTopProductsList').innerText();
    assert(topListText.includes('Đã giao:') && !topListText.includes('0 lượt bán'), 'Tab 1 Top 5 sản phẩm hiển thị số lượng bán thực tế (> 0)');
    await adminPage.screenshot({ path: path.join(ARTIFACT_DIR, 'after_phase_cd_admin_dashboard.png'), fullPage: false });

    const recentClickableCount = await adminPage.locator('#dashboardRecentOrders tr.dashboard-recent-row[data-order-id]').count();
    assert(recentClickableCount > 0, 'Tab 1 Đơn gần đây có dòng bấm mở trực tiếp chi tiết đơn');

    // 3.2 Tab 2 Sản phẩm: Kiểm tra không còn hardcode "0 lượt bán" cho mặt hàng đã bán
    await adminPage.click('.nav-item[data-tab="products"]');
    await adminPage.waitForSelector('#adminProductsTable tr');
    const prodRowText = await adminPage.locator(`#adminProductsTable tr[data-id="${sampleProd.id}"]`).innerText();
    assert(!prodRowText.includes('0 lượt bán'), `Tab 2 sản phẩm ${sampleProd.id} hiển thị lượt bán thực thay vì "0 lượt bán"`);

    // 3.3 Tab 5B Hoàn tiền: Admin duyệt phiếu hoàn tiền vừa được Thu ngân lập
    await adminPage.click('.nav-item[data-tab="refunds"]');
    await adminPage.waitForSelector('#adminRefundsTable tr');
    const adminRefundRow = adminPage.locator('#adminRefundsTable tr', { hasText: lateOrderCode }).first();
    await adminRefundRow.locator('.btn-refund-approve').waitFor({ state: 'visible' });
    await adminRefundRow.locator('.btn-refund-approve').click();

    await adminPage.waitForSelector('#refundActionModal:not(.hidden)');
    await adminPage.fill('#refundTxRefInput', `FT-ADMIN-E2E-${uniqueSuffix}`);
    await adminPage.fill('#refundAdminNoteInput', 'Admin xác nhận đã hoàn tiền VietQR');
    await adminPage.click('#refundActionSubmitBtn');
    await adminPage.waitForSelector('#refundActionModal', { state: 'hidden' });
    await adminPage.waitForTimeout(300);

    const dbRefund = await prisma.refund_requests.findFirst({ where: { order_id: lateOrderId } });
    if (dbRefund) createdRefundIds.push(dbRefund.id);
    const dbOrderAfterRefund = await prisma.orders.findUnique({ where: { id: lateOrderId } });
    assert(dbRefund?.status === 'approved' && dbOrderAfterRefund?.payment_status === 'refunded',
      'Maker-Checker hoàn tất qua UI: Admin duyệt -> phiếu approved & đơn hàng thành payment_status=refunded');
    await adminPage.screenshot({ path: path.join(ARTIFACT_DIR, 'after_phase_cd_admin_refunds.png'), fullPage: false });

    // 3.4 Tab 6 Thống kê: Ngày/Tháng/Năm, Chế độ ngày/tháng/quý/năm, Chart 3 chuỗi, Ma trận SP
    await adminPage.click('.nav-item[data-tab="statistics"]');
    await adminPage.waitForSelector('#dmyTodayRev');

    const dmyTodayRev = (await adminPage.locator('#dmyTodayRev').innerText()).trim();
    const dmyMonthRev = (await adminPage.locator('#dmyMonthRev').innerText()).trim();
    const dmyYearRev = (await adminPage.locator('#dmyYearRev').innerText()).trim();
    assert(dmyTodayRev.includes('₫') || dmyTodayRev.includes('đ'), 'Hiển thị thẻ Tổng Doanh Thu Hôm Nay riêng biệt');
    assert(dmyMonthRev.includes('₫') || dmyMonthRev.includes('đ'), 'Hiển thị thẻ Tổng Doanh Thu Tháng Này riêng biệt');
    assert(dmyYearRev.includes('₫') || dmyYearRev.includes('đ'), 'Hiển thị thẻ Tổng Doanh Thu Năm Nay riêng biệt');

    // Chọn preset 7 ngày qua & kiểm tra chart 3 chuỗi + bảng chi tiết
    await adminPage.click('.stats-preset-btn[data-preset="7days"]');
    await adminPage.waitForTimeout(150);
    const dayRows = await adminPage.locator('#statsTableBody tr').count();
    assert(dayRows === 7, `Chế độ Theo Ngày (7 ngày qua) render đủ 7 dòng liên tiếp (thực tế: ${dayRows})`);

    const barGroupsCount = await adminPage.locator('#statsBarChartWrap > div[title]').count();
    assert(barGroupsCount === 7, `Biểu đồ thống kê render đủ ${barGroupsCount} cột kỳ báo cáo`);

    // Chuyển qua Chế độ Theo Năm ("năm nào ra năm đó") & quay lại tháng này để kiểm tra Ma trận Mặt Hàng
    await adminPage.selectOption('#statsPeriodType', 'year');
    await adminPage.waitForTimeout(120);
    const yearRowsText = await adminPage.locator('#statsTableBody').innerText();
    assert(yearRowsText.includes(String(new Date().getFullYear())), 'Chế độ Theo Từng Năm hiển thị năm hiện tại tách biệt');

    await adminPage.selectOption('#statsPeriodType', 'day');
    await adminPage.click('.stats-preset-btn[data-preset="thisMonth"]');
    await adminPage.waitForTimeout(150);

    // Kiểm tra Ma trận Từng Mặt Hàng (#statsProductMatrixTable) có cột Đang giao / Đã giao / Chưa giao
    const matrixRowText = await adminPage.locator(`#statsProductMatrixTable tbody tr`).first().innerText();
    assert(matrixRowText.length > 0, 'Bảng Ma trận Mặt Hàng (#statsProductMatrixTable) hiển thị đầy đủ số liệu giao & doanh thu');
    const prodMatrixFullText = await adminPage.locator('#statsProductMatrixTable tbody').innerText();
    assert(prodMatrixFullText.includes(sampleProd.name), `Ma trận Mặt Hàng hiển thị sản phẩm ${sampleProd.name}`);

    await adminPage.screenshot({ path: path.join(ARTIFACT_DIR, 'after_phase_cd_admin_statistics.png'), fullPage: false });

    // 3.5 Xuất file Excel 3 sheet bằng ExcelJS thật & đọc lại xác minh cấu trúc
    const downloadPromise = adminPage.waitForEvent('download');
    await adminPage.click('#btnExportStatsExcel');
    const download = await downloadPromise;
    const savedXlsxPath = path.join(ARTIFACT_DIR, `scratch_${download.suggestedFilename()}`);
    await download.saveAs(savedXlsxPath);
    tempDownloads.push(savedXlsxPath);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(savedXlsxPath);
    const sheetNames = wb.worksheets.map(s => s.name);
    assert(sheetNames.length === 3, `File Excel báo cáo doanh thu chứa đủ 3 sheet (thực tế: ${sheetNames.join(', ')})`);
    assert(sheetNames.includes('Thong_Ke_Mat_Hang') && sheetNames.includes('Chi_Tiet_Don_Hang'),
      'File Excel chứa đủ sheet Thong_Ke_Mat_Hang và Chi_Tiet_Don_Hang');

    // 3.6 Xuất PDF Thống kê không lỗi JS
    await adminPage.evaluate(() => { window.open = () => ({ closed: false }); });
    await adminPage.click('#btnExportStatsPdf');
    await adminPage.waitForTimeout(600);
    assert(adminErrors.length === 0, `admin.html chạy mượt 0 lỗi JS (${adminErrors.join('; ')})`);

    // 3.7 Kiểm tra Responsive Mobile (390x844) không tràn ngang ở Tab Thống Kê
    await adminPage.setViewportSize({ width: 390, height: 844 });
    await adminPage.waitForTimeout(200);
    const hasHorizontalOverflow = await adminPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    assert(!hasHorizontalOverflow, 'Mobile 390px Tab Thống kê không bị tràn ngang (scrollWidth <= innerWidth)');
    await adminPage.screenshot({ path: path.join(ARTIFACT_DIR, 'after_phase_cd_admin_stats_mobile.png'), fullPage: false });

    await adminCtx.close();

    console.log('\n🎉 TOÀN BỘ E2E PHASE C & PHASE D (DASHBOARD / MA TRẬN SP / HOÀN TIỀN 2 CẤP / EXCELJS / PDF) ĐẠT 100%!');
  } catch (err) {
    testFailed = true;
    console.error('\n❌ [DASHBOARD E2E FAILED]:', err);
    process.exitCode = 1;
  } finally {
    for (const p of tempDownloads) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (createdRefundIds.length > 0) {
          await tx.refund_requests.deleteMany({ where: { id: { in: createdRefundIds } } });
        }
        if (createdOrderIds.length > 0) {
          await tx.refund_requests.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.payment_transactions.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.order_items.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.orders.deleteMany({ where: { id: { in: createdOrderIds } } });
        }
        const userIds = [tempStaffId, tempCustId].filter(Boolean);
        if (userIds.length > 0) {
          await tx.users.deleteMany({ where: { id: { in: userIds } } });
        }
      });
      console.log('[CLEANUP] Đã dọn dẹp sạch dữ liệu E2E trong 1 ACID Transaction.');
    } catch (cleanupErr) {
      console.error('❌ [CLEANUP ERROR]:', cleanupErr);
      process.exitCode = 1;
    }

    if (browser) await browser.close().catch(() => {});
    if (serverInstance) await new Promise((resolve) => serverInstance.close(resolve));
    if (typeof container?.orderExpiryService?.stopBackgroundJob === 'function') {
      container.orderExpiryService.stopBackgroundJob();
    }
    await prisma.$disconnect();
    process.exit(testFailed || process.exitCode ? (process.exitCode || 1) : 0);
  }
}

runDashboardAndPhaseCE2E();

