/**
 * scripts/test-hotfix-e2e.js - Playwright E2E Verification cho Đợt Hotfix (trước C1)
 * Kiểm thử trên trình duyệt thật:
 * 1. Lọc danh mục trên index.html với ID chuỗi ('1', '2', 'CAT-...') và nút '0' (Tất cả)
 * 2. Hiển thị Voucher phần trăm & cố định VND (0 lỗi "undefined%") trên trang chủ & Chatbot
 * 3. Thống kê doanh thu Tab 6 Admin & In Phiếu Đơn cho đơn SePay chưa thanh toán vs đơn COD hoàn tất
 */

import { chromium } from 'playwright';
import crypto from 'crypto';
import app from '../server.js';
import { container } from '../server/infrastructure/config/container.js';

const prisma = container.prisma;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

function parseVndDigits(text) {
  const digits = String(text || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

async function runHotfixE2E() {
  console.log('================================================================');
  console.log('🧪 RUNNING PLAYWRIGHT E2E TEST SUITE FOR HOTFIX (BEFORE PHASE C1)');
  console.log('================================================================\n');

  let serverInstance = null;
  let browser = null;
  let baseUrl = '';
  let testFailed = false;

  const tempVoucherId = `vouch-hotfix-${Date.now().toString(36)}`;
  const tempVoucherCode = `HOTFIX50K_${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const createdOrderIds = [];

  try {
    await new Promise((resolve) => {
      serverInstance = app.listen(0, '127.0.0.1', () => {
        const { port } = serverInstance.address();
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[E2E Server] Listening at ${baseUrl}`);
        resolve();
      });
    });

    // Seed voucher giảm cố định 50.000đ để kiểm thử song song với voucher %
    await prisma.vouchers.create({
      data: {
        id: tempVoucherId,
        code: tempVoucherCode,
        name: 'Ưu đãi cố định 50K Hotfix',
        discount_type: 'fixed',
        discount_value: 50000,
        min_order: 300000,
        max_discount: null,
        scope: 'all',
        usage_limit: 50,
        used_count: 0,
        is_active: true
      }
    });

    // Tạo 1 đơn SePay chưa thanh toán và 1 đơn COD đã hoàn tất trong năm hiện tại
    const unpaidSepayOrder = await container.orderService.createOrder({
      orderData: {
        items: [{ productId: 'PROD-002', quantity: 1, addonIds: [] }],
        customerName: 'Khách Hotfix SePay Chưa TT',
        phone: '0911223344',
        address: '100 Đường Hoa Hồng, Q1',
        paymentMethod: 'sepay'
      },
      userId: null
    });
    createdOrderIds.push(unpaidSepayOrder.id);

    const completedCodOrder = await container.orderService.createOrder({
      orderData: {
        items: [{ productId: 'PROD-001', quantity: 1, addonIds: [] }],
        customerName: 'Khách Hotfix COD Hoàn Thành',
        phone: '0911223355',
        address: '200 Đường Hoa Cúc, Q3',
        paymentMethod: 'cod'
      },
      userId: null
    });
    createdOrderIds.push(completedCodOrder.id);
    await prisma.orders.update({
      where: { id: completedCodOrder.id },
      data: {
        status: 'completed',
        payment_status: 'paid',
        completed_at: new Date()
      }
    });

    browser = await chromium.launch({ headless: true });

    // ------------------------------------------------------------------------
    // SCENARIO H1: Homepage Category Filter (String ID) & Voucher Badges (% + Fixed)
    // ------------------------------------------------------------------------
    console.log('\n--- SCENARIO H1: Category Filter String IDs, Vouchers (% & Fixed) & Chatbot ---');
    const guestCtx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const page = await guestCtx.newPage();

    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#productList .product-card');

    const totalShownText = await page.locator('#productCount').innerText();
    const totalCount = Number(totalShownText.trim());
    assert(totalCount >= 15, `Trang chủ ban đầu hiển thị đủ ${totalCount} sản phẩm`);

    const cat1Count = await page.locator('.category-btn[data-category="1"]').count();
    assert(cat1Count === 1, 'Nút danh mục data-category="1" tồn tại trên giao diện');
    await page.click('.category-btn[data-category="1"]');
    await page.waitForTimeout(200);
    const filteredCat1Count = Number((await page.locator('#productCount').innerText()).trim());
    const renderedCat1Cards = await page.locator('#productList .product-card').count();
    assert(filteredCat1Count > 0 && filteredCat1Count < totalCount && renderedCat1Cards > 0, `Lọc danh mục "1" hiển thị ${filteredCat1Count} sản phẩm (> 0, không rỗng vì lệch kiểu Number/String)`);

    await page.click('.category-btn[data-category="2"]');
    await page.waitForTimeout(200);
    const filteredCat2Count = Number((await page.locator('#productCount').innerText()).trim());
    assert(filteredCat2Count > 0 && filteredCat2Count < totalCount, `Lọc danh mục "2" hiển thị ${filteredCat2Count} sản phẩm`);

    await page.click('.category-btn[data-category="0"]');
    await page.waitForTimeout(200);
    const resetCount = Number((await page.locator('#productCount').innerText()).trim());
    assert(resetCount === totalCount, `Chọn lại "Tất cả" khôi phục đủ ${resetCount} sản phẩm`);

    // Kiểm tra nhãn Voucher phần trăm & cố định trên trang chủ
    const voucherCardsText = await page.locator('#voucherList').innerText();
    assert(!voucherCardsText.includes('undefined'), 'Thẻ voucher trang chủ không còn bất kỳ chữ "undefined" nào');
    assert(!voucherCardsText.includes('NaN'), 'Thẻ voucher trang chủ không có giá trị NaN');

    const fixedBadgeText = await page.locator(`.voucher-card[data-code="${tempVoucherCode}"] .voucher-discount-badge`).innerText();
    assert(fixedBadgeText.includes('50.000') && !fixedBadgeText.includes('%'), `Voucher cố định hiển thị đúng số tiền (${fixedBadgeText})`);

    const pctBadgeText = await page.locator('.voucher-card[data-code="HOAXUAN20"] .voucher-discount-badge').innerText();
    assert(pctBadgeText.includes('20%'), `Voucher phần trăm HOAXUAN20 hiển thị đúng "${pctBadgeText}"`);

    // Kiểm tra Chatbot Em Ly khi hỏi về Voucher (test fallback nội bộ không bị "undefined%")
    await page.route('**/api/chat', route => route.abort());
    await page.click('#chatLauncherBtn');
    await page.waitForSelector('.quick-prompt-btn[data-query*="voucher"]');
    await page.click('.quick-prompt-btn[data-query*="voucher"]');
    await page.waitForFunction(() => document.querySelectorAll('#chatMessagesList .chat-msg.bot').length >= 1);
    const botReplyText = await page.locator('#chatMessagesList .chat-msg.bot .chat-msg-bubble').last().innerText();
    assert(!botReplyText.includes('undefined'), 'Chatbot Em Ly trả lời danh sách voucher không có chữ "undefined"');
    assert(botReplyText.includes('HOAXUAN20') && botReplyText.includes('20%') && botReplyText.includes(tempVoucherCode) && botReplyText.includes('50.000'), 'Chatbot Em Ly hiển thị chuẩn cả voucher % và voucher tiền cố định');
    await guestCtx.close();

    // ------------------------------------------------------------------------
    // SCENARIO H2: Admin Revenue (Excludes Unpaid SePay) & Invoice PDF Meta
    // ------------------------------------------------------------------------
    console.log('\n--- SCENARIO H2: Admin Stats Exclude Unpaid SePay & Invoice PDF Meta ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const adminPage = await adminCtx.newPage();

    await adminPage.goto(`${baseUrl}/login.html?returnUrl=${encodeURIComponent('/admin.html')}`, { waitUntil: 'networkidle' });
    await adminPage.fill('#email', 'admin@shophoa.example');
    await adminPage.fill('#password', 'admin123');
    await adminPage.click('#submitBtn');
    await adminPage.waitForURL(/admin\.html|index\.html/);
    if (!adminPage.url().includes('admin.html')) {
      await adminPage.goto(`${baseUrl}/admin.html`, { waitUntil: 'networkidle' });
    }

    await adminPage.waitForSelector('.nav-item[data-tab="statistics"]');
    await adminPage.click('.nav-item[data-tab="statistics"]');
    await adminPage.waitForSelector('#statTotalRevenue');
    await adminPage.click('.stats-preset-btn[data-preset="thisYear"]');
    await adminPage.waitForTimeout(150);

    const completedRaw = (await adminPage.locator('#statCompletedOrders').innerText()).trim();
    const statCompletedCount = Number(completedRaw.split('/')[0].trim());
    const statTotalRevenue = parseVndDigits(await adminPage.locator('#statTotalRevenue').innerText());

    // Đối soát trực tiếp với DB: Tổng tất cả đơn status = 'completed' trong năm hiện tại (KHÔNG bao gồm unpaid SePay / refunded / pending / shipping / cancelled)
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const nextYearStart = new Date(currentYear + 1, 0, 1);
    const dbCompletedOrders = await prisma.orders.findMany({
      where: {
        status: 'completed',
        created_at: { gte: yearStart, lt: nextYearStart },
        payment_status: { not: 'refunded' },
        OR: [{ payment_method: { not: 'sepay' } }, { payment_status: 'paid' }]
      }
    });
    const expectedRecognizedRevenue = dbCompletedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    assert(statCompletedCount === dbCompletedOrders.length, `Tab Thống Kê đếm đúng ${statCompletedCount} đơn hoàn thành (không gộp đơn SePay chưa thanh toán)`);
    assert(statTotalRevenue === expectedRecognizedRevenue, `Tab Thống Kê tính đúng Doanh Thu Ghi Nhận ${statTotalRevenue.toLocaleString('vi-VN')}đ (khớp IFRS 15, không cộng ${unpaidSepayOrder.totalAmount.toLocaleString('vi-VN')}đ đơn SePay chưa thanh toán)`);

    // Kiểm tra bảng Đơn hàng hiển thị mã #DH... và xuất Phiếu Đơn cho đơn SePay chưa thanh toán qua jsPDF hook
    await adminPage.click('.nav-item[data-tab="orders"]');
    await adminPage.waitForSelector(`tr[data-id="${unpaidSepayOrder.id}"]`);
    const rowCodeCell = (await adminPage.locator(`tr[data-id="${unpaidSepayOrder.id}"] td`).first().innerText()).trim();
    assert(rowCodeCell === `#${unpaidSepayOrder.orderCode}`, `Bảng Admin hiển thị mã đơn #${unpaidSepayOrder.orderCode} thay vì UUID`);

    // Hook jsPDF để kiểm tra nội dung PDF xuất ra cho đơn SePay chưa thanh toán (không dùng eval, stub jsPDF constructor trên window)
    const capturedPdf = await adminPage.evaluate(async (orderObj) => {
      const texts = [];
      window.open = () => ({ closed: false });
      const FakeDoc = function () {};
      FakeDoc.prototype.setFont = () => {};
      FakeDoc.prototype.setFontSize = () => {};
      FakeDoc.prototype.setTextColor = () => {};
      FakeDoc.prototype.setDrawColor = () => {};
      FakeDoc.prototype.setLineWidth = () => {};
      FakeDoc.prototype.line = () => {};
      FakeDoc.prototype.roundedRect = () => {};
      FakeDoc.prototype.text = function (t) { texts.push(String(t)); };
      FakeDoc.prototype.autoTable = function () { this.lastAutoTable = { finalY: 95 }; };
      FakeDoc.prototype.output = () => 'blob:mock';
      FakeDoc.prototype.save = () => {};
      window.jspdf = { jsPDF: FakeDoc };

      const mod = await import('./js/excel-pdf.js');
      mod.exportOrderInvoicePdf(orderObj, { isReceipt: true });
      return texts;
    }, unpaidSepayOrder);

    const pdfJoined = capturedPdf.join(' | ');
    assert(pdfJoined.includes(unpaidSepayOrder.orderCode), `PDF in đúng mã đơn ${unpaidSepayOrder.orderCode}`);
    assert(pdfJoined.includes('PHIEU DON HANG (CHUA THANH TOAN)'), 'PDF đơn SePay chưa thanh toán in tiêu đề "PHIEU DON HANG (CHUA THANH TOAN)" (không gán nhầm E-RECEIPT)');
    assert(pdfJoined.includes('[ CHO CHUYEN KHOAN SEPAY ]'), 'PDF đơn SePay chưa thanh toán đóng dấu "[ CHO CHUYEN KHOAN SEPAY ]" (không đóng nhầm COD)');
    assert(pdfJoined.includes('Phi van chuyen:'), 'PDF hóa đơn có dòng hiển thị phí vận chuyển');

    await adminCtx.close();
    console.log('\n🎉 TẤT CẢ KỊCH BẢN E2E HOTFIX ĐẠT 100%!');
  } catch (err) {
    testFailed = true;
    console.error('\n❌ [HOTFIX E2E FAILED]:', err);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$transaction(async (tx) => {
        if (createdOrderIds.length > 0) {
          const ordersToDelete = await tx.orders.findMany({
            where: { id: { in: createdOrderIds } },
            include: { order_items: true }
          });
          for (const order of ordersToDelete) {
            if (order.status !== 'cancelled') {
              for (const item of order.order_items) {
                await tx.products.update({
                  where: { id: item.product_id },
                  data: { stock: { increment: item.quantity } }
                });
              }
            }
          }
          await tx.payment_transactions.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.notifications.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.order_item_addons.deleteMany({ where: { order_items: { order_id: { in: createdOrderIds } } } });
          await tx.order_items.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.orders.deleteMany({ where: { id: { in: createdOrderIds } } });
        }
        await tx.vouchers.deleteMany({ where: { id: tempVoucherId } });
      });
      console.log('[CLEANUP] Đã xóa sạch dữ liệu test Hotfix E2E trong 1 ACID Transaction.');
    } catch (cleanErr) {
      testFailed = true;
      process.exitCode = 1;
      console.error('[CLEANUP ERROR]:', cleanErr.message);
    }

    if (browser) await browser.close();
    if (serverInstance) serverInstance.close();
    container.orderExpiryService.stop();
    await prisma.$disconnect();

    const finalCode = testFailed || process.exitCode ? (process.exitCode || 1) : 0;
    process.exit(finalCode);
  }
}

runHotfixE2E();

