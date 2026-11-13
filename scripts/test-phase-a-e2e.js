/**
 * scripts/test-phase-a-e2e.js - End-to-End Test Suite for Phase A (Playwright)
 * Kiem thu dau cuoi toan dien ca 5 kich ban Giai doan A:
 * 1. Mở qua Loopback IP / LAN không bị dính hardcode localhost:4000 (A2)
 * 2. Đặt hàng COD thành công (A1-A2)
 * 3. Đặt hàng có phụ kiện Add-ons & kiểm tra snapshot + giá server (A4)
 * 4. Đặt hàng SePay VietQR nạp động từ config & mô phỏng thanh toán tự động (A1, A3)
 * 5. Hủy đơn SePay & kiểm tra chặn đơn đã hủy sống lại (A6)
 */

import { chromium } from 'playwright';
import http from 'http';
import app, { getLanIpAddress } from '../server.js';
import { container } from '../server/infrastructure/config/container.js';

const prisma = container.prisma;

// Assert helper
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('🚀 RUNNING PLAYWRIGHT E2E TEST SUITE FOR PHASE A');
  console.log('================================================================\n');

  let serverInstance = null;
  let browser = null;
  let testPort = null;
  let baseUrl = '';
  let testFailed = false;

  const createdOrderCodes = [];

  try {
    // 1. Khởi động server trên ephemeral port (0) và bind 0.0.0.0 để chấp nhận kết nối qua IP LAN
    await new Promise((resolve) => {
      serverInstance = app.listen(0, '0.0.0.0', () => {
        testPort = serverInstance.address().port;
        const lanIp = getLanIpAddress();
        baseUrl = `http://${lanIp}:${testPort}`;
        console.log(`[E2E Server] Listening on 0.0.0.0:${testPort}`);
        console.log(`[E2E Target] Accessing via real LAN IP: ${baseUrl}\n`);
        resolve();
      });
    });

    // 2. Khởi chạy Playwright Chromium
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Giám sát network traffic để đảm bảo KHÔNG CÓ request nào chứa cứng localhost:4000 (BUG-04)
    const interceptedUrls = [];
    page.on('request', req => {
      const url = req.url();
      interceptedUrls.push(url);
      if (url.includes('localhost:4000')) {
        console.warn(`[WARNING: HARDCODED URL DETECTED]: ${url}`);
      }
    });

    // ========================================================================
    // KỊCH BẢN 1: MỞ TRANG QUA ĐỊA CHỈ IP LAN THẬT (LAN NETWORK SIMULATION) (A2)
    // ========================================================================
    console.log(`--- SCENARIO 1: Open Home via Real LAN IP (${baseUrl}) & Relative API URL (A2) ---`);
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const hasHardcodedLocalhost = interceptedUrls.some(u => u.includes('localhost:4000'));
    assert(!hasHardcodedLocalhost, 'Không có bất kỳ network request nào trỏ cứng về localhost:4000');

    // Kiểm tra render sản phẩm từ API
    const productCards = await page.locator('.product-card').count();
    assert(productCards >= 5, `Trang chủ tải thành công ${productCards} sản phẩm từ backend MySQL`);

    // ========================================================================
    // KỊCH BẢN 2: ĐẶT ĐƠN HÀNG COD THÀNH CÔNG (A1, A2)
    // ========================================================================
    console.log('\n--- SCENARIO 2: Create COD Order Flow (A1, A2) ---');
    // Click Thêm Nhanh bó hoa đầu tiên vào giỏ
    const quickAddBtn = page.locator('.quick-add-btn').first();
    await quickAddBtn.click();
    await page.waitForTimeout(1000);

    // Mở drawer checkout
    const drawerCheckoutBtn = page.locator('#drawerCheckoutBtn');
    await drawerCheckoutBtn.click();
    await page.waitForTimeout(800);

    // Điền thông tin đặt hàng COD
    await page.fill('#checkoutSenderName', 'Nguyễn Văn COD');
    await page.fill('#checkoutSenderPhone', '0901234567');
    await page.fill('#checkoutAddress', '123 Đường Hoa Hồng, Phường Bến Nghé, Quận 1');

    // Chọn phương thức COD
    const codLabel = page.locator('#labelPaymentCod');
    await codLabel.click();

    // Bấm Đặt Hàng Ngay
    await page.click('#checkoutSubmitBtn');
    await page.waitForTimeout(2000);

    // Xác nhận màn hình thành công
    const codSuccessVisible = await page.locator('#checkoutStepSuccess').isVisible();
    assert(codSuccessVisible, 'Màn hình đặt hàng COD thành công (#checkoutStepSuccess) hiển thị');

    const codOrderCodeRaw = (await page.locator('#successOrderId').textContent()).trim();
    const codOrderCode = codOrderCodeRaw.replace('#', '');
    createdOrderCodes.push(codOrderCode);
    console.log(`[COD Order Created]: #${codOrderCode}`);

    // Đối soát trong MySQL
    const dbCodOrder = await prisma.orders.findFirst({
      where: { order_code: codOrderCode },
      include: { order_items: true }
    });
    assert(dbCodOrder !== null, 'Đơn hàng COD tồn tại trong CSDL MySQL');
    assert(dbCodOrder.payment_method === 'cod', 'Phương thức thanh toán là "cod"');
    assert(dbCodOrder.status === 'pending', 'Trạng thái đơn hàng là "pending"');
    assert(dbCodOrder.payment_status === 'pending', 'Trạng thái thanh toán là "pending"');

    // ========================================================================
    // KỊCH BẢN 3: MUA NGAY KHÔNG GỘP GIỎ CŨ + PHỤ KIỆN + GIÁ SERVER (A4 & FIX-BUYNOW)
    // ========================================================================
    console.log('\n--- SCENARIO 3: Buy Now Isolation (Keep Cart Intact), Add-ons & Server Pricing ---');
    // Bỏ sẵn 1 bó khác vào giỏ hàng trước để kiểm tra Mua Ngay không được kéo cả giỏ cũ
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.locator('.quick-add-btn').nth(1).click();
    await page.waitForTimeout(600);
    const cartBeforeBuyNow = await page.evaluate(() => JSON.parse(localStorage.getItem('SHOP_HOA_CART') || '[]'));
    assert(cartBeforeBuyNow.length === 1, 'Giỏ hàng đang có sẵn 1 sản phẩm trước khi bấm Mua Ngay');

    await page.goto(`${baseUrl}/detail.html?id=PROD-001`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Chọn 2 phụ kiện: Đèn LED (+15k) và Thiệp viết tay (+10k)
    const ledAddon = page.locator('input[data-id="ADDON-LED"]');
    const cardAddon = page.locator('input[data-id="ADDON-CARD"]');
    if (await ledAddon.count() > 0) await ledAddon.check();
    if (await cardAddon.count() > 0) await cardAddon.check();
    await page.waitForTimeout(500);

    // Bấm Mua Ngay lần 1 rồi đóng, bấm lại lần 2 để chắc chắn số lượng không cộng dồn
    await page.locator('#btnBuyNow').click();
    await page.waitForSelector('#checkoutModal:not(.hidden)');
    assert((await page.locator('#checkoutItemsPreview .checkout-preview-item').count()) === 1, 'Modal Mua Ngay chỉ hiển thị đúng 1 sản phẩm đang xem, không gộp giỏ hàng cũ');
    await page.locator('#checkoutModalClose').click();
    await page.locator('#btnBuyNow').click();
    await page.waitForSelector('#checkoutModal:not(.hidden)');
    const previewQtyText = await page.locator('#checkoutItemsPreview').innerText();
    assert((await page.locator('#checkoutItemsPreview .checkout-preview-item').count()) === 1 && previewQtyText.includes('× 1'), 'Bấm Mua Ngay lặp lại vẫn giữ nguyên số lượng × 1, không cộng dồn');

    // Điền form nhận hàng
    await page.fill('#checkoutSenderName', 'Khách Đặt Kèm Phụ Kiện');
    await page.fill('#checkoutSenderPhone', '0912345678');
    await page.fill('#checkoutAddress', '456 Đường Hoa Lan, Quận Phú Nhuận');

    // Chọn COD để kiểm tra lưu snapshot phụ kiện
    await page.locator('#labelPaymentCod').click();
    await page.click('#checkoutSubmitBtn');
    await page.waitForTimeout(2000);

    const addonSuccessVisible = await page.locator('#checkoutStepSuccess').isVisible();
    assert(addonSuccessVisible, 'Màn hình thành công cho đơn kèm phụ kiện hiển thị');

    const cartAfterBuyNow = await page.evaluate(() => JSON.parse(localStorage.getItem('SHOP_HOA_CART') || '[]'));
    assert(cartAfterBuyNow.length === 1 && cartAfterBuyNow[0].id === cartBeforeBuyNow[0].id, 'Đặt hàng qua Mua Ngay vẫn giữ nguyên giỏ hàng cũ của khách');
    await page.evaluate(() => localStorage.removeItem('SHOP_HOA_CART'));

    const addonOrderCodeRaw = (await page.locator('#successOrderId').textContent()).trim();
    const addonOrderCode = addonOrderCodeRaw.replace('#', '');
    createdOrderCodes.push(addonOrderCode);
    console.log(`[Addon Order Created]: #${addonOrderCode}`);

    // Đối soát trong MySQL: phụ kiện được snapshot và tổng tiền tính đúng ở server
    const dbAddonOrder = await prisma.orders.findFirst({
      where: { order_code: addonOrderCode },
      include: {
        order_items: {
          include: { order_item_addons: true }
        }
      }
    });
    assert(dbAddonOrder !== null, 'Đơn hàng kèm phụ kiện tồn tại trong MySQL');
    const firstItem = dbAddonOrder.order_items[0];
    assert(firstItem.order_item_addons.length === 2, 'Lưu đủ 2 phụ kiện trong bảng order_item_addons');
    const addonNames = firstItem.order_item_addons.map(a => a.addon_name);
    assert(addonNames.some(n => n.includes('LED')) && addonNames.some(n => n.includes('Thiệp')), 'Snapshot phụ kiện chứa đúng tên Đèn LED và Thiệp viết tay');

    // Giá sản phẩm PROD-001 (350.000) + Phụ kiện (15.000 + 10.000 = 25.000) = 375.000
    assert(dbAddonOrder.subtotal === 375000, `Subtotal trên server (${dbAddonOrder.subtotal}đ) tính đúng bằng giá hoa + phụ kiện (375.000đ)`);

    // ========================================================================
    // KỊCH BẢN 4: ĐẶT ĐƠN SEPAY, QUAY LẠI SỬA KHÔNG ĐÚP ĐƠN & MÔ PHỎNG THANH TOÁN
    // ========================================================================
    console.log('\n--- SCENARIO 4: SePay VietQR, Back-Edit No Duplicate & Simulation (A1, A3, A8) ---');
    await page.goto(`${baseUrl}/detail.html?id=PROD-002`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Bấm Mua Ngay
    await page.click('#btnBuyNow');
    await page.waitForTimeout(600);

    // Điền thông tin
    await page.fill('#checkoutSenderName', 'Khách Thanh Toán SePay');
    await page.fill('#checkoutSenderPhone', '0988776655');
    await page.fill('#checkoutAddress', '789 Đường Hoa Sữa, Quận Bình Thạnh');

    // Chọn SePay
    await page.locator('#labelPaymentSepay').click();

    // Bấm Tiếp Tục Thanh Toán VietQR
    await page.click('#checkoutSubmitBtn');
    await page.waitForSelector('#checkoutStepSepay:not(.hidden)');

    const firstQrOrderCode = (await page.locator('#sepayTransferContent').textContent()).trim();
    assert(firstQrOrderCode.startsWith('DH'), `Sinh mã đơn QR đầu tiên #${firstQrOrderCode}`);

    // Quay lại sửa địa chỉ rồi submit lại -> phải tái sử dụng đúng đơn cũ, KHÔNG đúp đơn!
    await page.click('#btnBackToCheckoutForm');
    await page.waitForSelector('#checkoutStepForm:not(.hidden)');
    await page.fill('#checkoutAddress', '789 Đường Hoa Sữa (Đã Sửa), Quận Bình Thạnh');
    await page.click('#checkoutSubmitBtn');
    await page.waitForSelector('#checkoutStepSepay:not(.hidden)');

    const secondQrOrderCode = (await page.locator('#sepayTransferContent').textContent()).trim();
    assert(secondQrOrderCode === firstQrOrderCode, `Quay lại sửa thông tin tái sử dụng đúng mã đơn #${firstQrOrderCode} (không sinh đơn trùng)`);

    const matchedSepayOrders = await prisma.orders.findMany({ where: { order_code: firstQrOrderCode } });
    assert(matchedSepayOrders.length === 1 && matchedSepayOrders[0].shipping_address.includes('Đã Sửa'), 'CSDL chỉ có duy nhất 1 đơn hàng với địa chỉ đã cập nhật');

    // Kiểm tra bước SePay hiển thị
    const stepSepayVisible = await page.locator('#checkoutStepSepay').isVisible();
    assert(stepSepayVisible, 'Màn hình quét VietQR SePay (#checkoutStepSepay) hiển thị');

    // Kiểm tra số tài khoản ngân hàng được nạp động từ config
    const sepayAccount = (await page.locator('#sepayAccountNumber').textContent()).trim();
    assert(sepayAccount.length > 5, `Số tài khoản nhận tiền (${sepayAccount}) được nạp động từ server`);

    // Bấm nút Mô Phỏng Thanh Toán Thành Công
    const simulateBtn = page.locator('#btnSimulateSepayPaid');
    await simulateBtn.click();
    await page.waitForTimeout(3000);

    // Kiểm tra tự động chuyển sang màn hình thành công
    const sepaySuccessVisible = await page.locator('#checkoutStepSuccess').isVisible();
    assert(sepaySuccessVisible, 'Sau khi mô phỏng thanh toán, màn hình tự động chuyển sang #checkoutStepSuccess');

    const sepayOrderCodeRaw = (await page.locator('#successOrderId').textContent()).trim();
    const sepayOrderCode = sepayOrderCodeRaw.replace('#', '');
    createdOrderCodes.push(sepayOrderCode);
    console.log(`[SePay Order Paid]: #${sepayOrderCode}`);

    // Đối soát trong MySQL
    const dbSepayOrder = await prisma.orders.findFirst({
      where: { order_code: sepayOrderCode },
      include: { payment_transactions: true }
    });
    assert(dbSepayOrder.status === 'confirmed', 'Đơn SePay chuyển trạng thái sang "confirmed"');
    assert(dbSepayOrder.payment_status === 'paid', 'Đơn SePay chuyển trạng thái thanh toán sang "paid"');
    assert(dbSepayOrder.payment_transactions.length > 0, 'Giao dịch thanh toán được lưu vết trong payment_transactions');

    // ========================================================================
    // KỊCH BẢN 5: HỦY ĐƠN SEPAY & CHẶN ĐƠN HỦY SỐNG LẠI (A6)
    // ========================================================================
    console.log('\n--- SCENARIO 5: Cancel Order & Prevent Resurrection (A6) ---');
    // Tạo đơn SePay mới qua OrderService (Hexagonal Layer)
    const rawSepayOrder = await container.orderService.createOrder({
      orderData: {
        items: [{ productId: 'PROD-001', quantity: 1, addonIds: [] }],
        customerName: 'Khách Test Hủy Đơn',
        phone: '0977889900',
        email: 'testhuy@shophoa.example',
        address: '101 Đường Hủy Đơn, Quận 10',
        paymentMethod: 'sepay'
      },
      userId: null
    });
    const cancelOrderId = rawSepayOrder.id;
    const cancelOrderCode = rawSepayOrder.orderCode;
    createdOrderCodes.push(cancelOrderCode);

    // Khách hủy đơn hàng
    await container.orderRepo.cancelCustomerOrder(cancelOrderId, null);
    const dbCancelledOrder = await prisma.orders.findUnique({ where: { id: cancelOrderId } });
    assert(dbCancelledOrder.status === 'cancelled', 'Đơn hàng đã được chuyển sang trạng thái "cancelled"');

    // Giả lập webhook/thanh toán gọi vào đơn đã bị hủy
    const recordResult = await container.paymentController.recordPayment(
      dbCancelledOrder,
      `TX-E2E-TEST-${Date.now()}`,
      dbCancelledOrder.total_amount
    );
    assert(recordResult.processed === false, 'Hệ thống từ chối cập nhật thanh toán cho đơn đã bị hủy');

    // Đối soát lại trạng thái đơn hàng
    const recheckedOrder = await prisma.orders.findUnique({ where: { id: cancelOrderId } });
    assert(recheckedOrder.status === 'cancelled', 'Đơn hàng vẫn giữ nguyên trạng thái "cancelled" (Không bị sống lại)');
    assert(recheckedOrder.payment_status === 'pending', 'payment_status vẫn là "pending"');

    // ========================================================================
    // KỊCH BẢN 6: TRANG ADMIN TÁCH TAB SEPAY CHỜ TT & CHẶN DUYỆT ĐƠN CHƯA TRẢ TIỀN
    // ========================================================================
    console.log('\n--- SCENARIO 6: Admin UI & API Block Unpaid SePay Approval ---');
    const unpaidSepayOrder = await container.orderService.createOrder({
      orderData: {
        items: [{ productId: 'PROD-001', quantity: 1, addonIds: [] }],
        customerName: 'Khách Chờ QR Admin E2E',
        phone: '0966554433',
        address: '99 Đường VietQR E2E',
        paymentMethod: 'sepay'
      },
      userId: null
    });
    createdOrderCodes.push(unpaidSepayOrder.orderCode);

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${baseUrl}/login.html?returnUrl=${encodeURIComponent('/admin.html')}`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('#email');
    await adminPage.fill('#email', 'admin@shophoa.example');
    await adminPage.fill('#password', 'admin123');
    await adminPage.click('#submitBtn');
    await adminPage.waitForURL(/admin\.html|index\.html/);
    await adminPage.goto(`${baseUrl}/admin.html?tab=orders`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('#orderSegmentedTabs button[data-segment="unpaid_sepay"]');
    await adminPage.click('#orderSegmentedTabs button[data-segment="unpaid_sepay"]');
    await adminPage.waitForSelector(`tr[data-id="${unpaidSepayOrder.id}"]`);

    const rowHasApproveBtn = await adminPage.locator(`tr[data-id="${unpaidSepayOrder.id}"] .btn-quick-approve`).count();
    assert(rowHasApproveBtn === 0, 'Đơn SePay chưa thanh toán KHÔNG có nút 1-Click ✓ Duyệt trên bảng Admin');

    const rowPrintBtnText = (await adminPage.locator(`tr[data-id="${unpaidSepayOrder.id}"] .export-pdf-row-btn`).textContent()).trim();
    assert(rowPrintBtnText === 'In Phiếu Đơn', `Đơn SePay chưa trả tiền hiển thị "${rowPrintBtnText}" thay vì In Hóa Đơn`);

    await adminPage.click(`tr[data-id="${unpaidSepayOrder.id}"] .view-order-btn`);
    await adminPage.waitForSelector('#unpaidSepayAdminGuardBanner');
    const confirmOptionCount = await adminPage.locator('#orderDetailStatusSelect option[value="confirmed"]').count();
    assert(confirmOptionCount === 0, 'Modal chi tiết đơn SePay chưa thanh toán khóa tùy chọn "Đã xác nhận"');

    const modalPrintText = (await adminPage.locator('#btnExportInvoicePdf').textContent()).trim();
    assert(modalPrintText === 'In Phiếu Đơn PDF', `Nút in trong modal đơn chưa thu tiền là "${modalPrintText}"`);

    const directAdminConfirmStatus = await adminPage.evaluate(async (orderId) => {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
      });
      return res.status;
    }, unpaidSepayOrder.id);
    assert(directAdminConfirmStatus === 400, 'API PATCH /status chặn cứng Admin duyệt đơn SePay chưa thanh toán (HTTP 400)');
    await adminContext.close();

    // ========================================================================
    // KỊCH BẢN 7: KHÁCH VÃNG LAI ĐẶT HÀNG -> TRA CỨU ĐƠN KHÔNG CẦN ĐĂNG NHẬP
    // ========================================================================
    console.log('\n--- SCENARIO 7: Guest Checkout -> Track Order -> Guest Lookup & Pay QR ---');
    const guestContext = await browser.newContext({ viewport: { width: 1366, height: 840 } });
    const guestPage = await guestContext.newPage();

    // 7.1. Kiểm tra nút "Tra cứu đơn" trên header dẫn thẳng tới orders.html (không đá sang login)
    await guestPage.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForSelector('#btnGuestTrackOrder');
    await guestPage.click('#btnGuestTrackOrder');
    await guestPage.waitForURL(/\/orders\.html/);
    assert(guestPage.url().includes('/orders.html') && !guestPage.url().includes('/login.html'), 'Nút Tra cứu đơn đưa khách vãng lai vào thẳng orders.html');

    // 7.2. Đặt đơn SePay qua Mua Ngay nhưng đóng cửa sổ QR bằng dấu × (giữ đơn 30 phút), sau đó tra cứu lại để thanh toán
    await guestPage.goto(`${baseUrl}/detail.html?id=PROD-001`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForSelector('#btnBuyNow');
    await guestPage.click('#btnBuyNow');
    await guestPage.waitForSelector('#checkoutModal:not(.hidden)');
    await guestPage.fill('#checkoutSenderName', 'Khách Vãng Lai Test');
    await guestPage.fill('#checkoutSenderPhone', '0944556677');
    await guestPage.fill('#checkoutAddress', '88 Đường Hai Bà Trưng, Quận 1');
    await guestPage.fill('#checkoutCardMessage', 'Nội dung thiệp riêng tư');
    await guestPage.locator('#labelPaymentSepay').click();
    await guestPage.click('#checkoutSubmitBtn');
    await guestPage.waitForSelector('#checkoutStepSepay:not(.hidden)');

    const guestOrderCode = (await guestPage.locator('#sepayTransferContent').textContent()).trim();
    createdOrderCodes.push(guestOrderCode);

    // Đóng cửa sổ QR bằng nút ×
    await guestPage.click('#checkoutModalClose');

    // Mở orders.html với ?orderCode=DH... -> tự điền mã đơn, không chuyển sang login
    await guestPage.goto(`${baseUrl}/orders.html?orderCode=${encodeURIComponent(guestOrderCode)}`, { waitUntil: 'domcontentloaded' });
    await guestPage.waitForSelector('#guestOrderLookupForm');
    assert(!guestPage.url().includes('/login.html'), 'Khách chưa đăng nhập ở lại orders.html để dùng form tra cứu');
    const prefilledCode = (await guestPage.inputValue('#guestOrderCode')).trim();
    assert(prefilledCode === guestOrderCode, `Form tra cứu tự điền sẵn mã đơn ${guestOrderCode}`);

    // Nhập số điện thoại +84 để test chuẩn hóa và tra cứu đơn
    await guestPage.fill('#guestOrderPhone', '+84944556677');
    await guestPage.click('#guestOrderLookupForm button[type="submit"]');
    await guestPage.waitForSelector('.order-craft-card');
    const lookupCardText = await guestPage.locator('.order-craft-card').first().innerText();
    assert(lookupCardText.includes(guestOrderCode), 'Hiển thị đúng thẻ đơn hàng vừa tra cứu của khách');
    assert(!lookupCardText.includes('88 Đường Hai Bà Trưng') && !lookupCardText.includes('Nội dung thiệp riêng tư'), 'Thẻ tra cứu guest ẩn địa chỉ nhà và lời chúc riêng tư');

    // Khách vãng lai bấm "Quét QR Thanh Toán Ngay" và mô phỏng thanh toán thành công không cần đăng nhập
    await guestPage.click('.btn-order-pay-now');
    await guestPage.waitForSelector('#sepayQrModal:not(.hidden)');
    await guestPage.click('#btnModalSimulatePaid');
    await guestPage.waitForFunction(() => document.getElementById('sepayQrModal')?.classList.contains('hidden'));
    const paidGuestOrderDb = await prisma.orders.findUnique({ where: { order_code: guestOrderCode } });
    assert(paidGuestOrderDb.payment_status === 'paid' && paidGuestOrderDb.status === 'confirmed', 'Khách vãng lai tra cứu đơn và thanh toán QR thành công không cần đăng nhập');
    assert((await guestPage.locator('.btn-order-view-pdf').count()) === 0, 'Khách vãng lai tra cứu ẩn nút xuất hóa đơn PDF đầy đủ PII');
    await guestContext.close();

    console.log('\n================================================================');
    console.log('🎉 TOÀN BỘ 7 KỊCH BẢN PLAYWRIGHT E2E THÀNH CÔNG 100%!');
    console.log('================================================================\n');

  } catch (err) {
    testFailed = true;
    console.error('❌ [E2E ERROR]:', err);
    process.exitCode = 1;
  } finally {
    // CLEANUP CSDL HOÀN TOÀN NGUYÊN TỬ TRONG PRISMA ACID TRANSACTION
    console.log('--- CLEANUP: Dọn dẹp dữ liệu thử nghiệm E2E trong ACID Transaction ---');
    try {
      if (createdOrderCodes.length > 0) {
        // Đọc trạng thái mới nhất và hoàn kho/xóa BÊN TRONG DUY NHẤT 1 TRANSACTION để chống race condition
        await prisma.$transaction(async (tx) => {
          // 1. Đọc danh sách đơn và trạng thái mới nhất trong snapshot giao dịch
          const ordersToDelete = await tx.orders.findMany({
            where: { order_code: { in: createdOrderCodes } },
            include: { order_items: true }
          });
          const orderIds = ordersToDelete.map((o) => o.id);

          if (orderIds.length > 0) {
            // 2. Chỉ hoàn kho theo delta cho các đơn CHƯA bị hủy (đối soát trạng thái thực tế trong tx)
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
            // 3. Xóa các bản ghi liên quan và đơn hàng
            await tx.payment_transactions.deleteMany({ where: { order_id: { in: orderIds } } });
            await tx.notifications.deleteMany({ where: { order_id: { in: orderIds } } });
            await tx.order_item_addons.deleteMany({ where: { order_items: { order_id: { in: orderIds } } } });
            await tx.order_items.deleteMany({ where: { order_id: { in: orderIds } } });
            await tx.orders.deleteMany({ where: { id: { in: orderIds } } });
            console.log(`[CLEANUP] Đã xóa ${orderIds.length} đơn hàng thử nghiệm và hoàn tồn kho thành công trong 1 ACID Transaction.`);
          }
        });
      }
    } catch (cleanErr) {
      testFailed = true;
      process.exitCode = 1;
      console.error('[CLEANUP ERROR]: Không thể dọn dẹp dữ liệu thử nghiệm E2E:', cleanErr.message);
    }

    if (browser) await browser.close();
    if (serverInstance) serverInstance.close();
    container.orderExpiryService.stop();
    await prisma.$disconnect();

    // Giữ nguyên exit code thật: Nếu có assertion thất bại thì thoát với code 1, không ghi đè thành 0
    const finalExitCode = testFailed || process.exitCode ? (process.exitCode || 1) : 0;
    process.exit(finalExitCode);
  }
}

runE2ETests().catch((err) => {
  console.error('[FATAL E2E ERROR]:', err);
  process.exit(1);
});

