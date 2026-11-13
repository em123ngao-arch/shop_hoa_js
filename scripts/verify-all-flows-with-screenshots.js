import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/d18f1589-b1b1-44e3-ae1e-098a2a6a4d5d/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const BASE_URL = 'http://localhost:5173';

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN VÀ CHỤP ẢNH BÁO CÁO 14 TÍNH NĂNG');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 868 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('🔴 CONSOLE ERROR:', msg.text());
  });

  try {
    // -------------------------------------------------------------
    // FLOW 1: TRANG CHỦ & HERO BANNER SLIDER
    // -------------------------------------------------------------
    console.log('[1/7] Kiểm tra Trang Chủ & Banner...');
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_01_homepage_hero_banners.png') });
    console.log('  📸 Đã chụp: report_01_homepage_hero_banners.png');

    // Test Search & Filter
    console.log('  Kiểm tra Tìm kiếm thời gian thực & Lọc hoa...');
    const searchInput = page.locator('#headerSearchInput, #searchInput').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Tulip');
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_02_homepage_search_filter.png') });
    console.log('  📸 Đã chụp: report_02_homepage_search_filter.png');

    // -------------------------------------------------------------
    // FLOW 2: TRANG CHI TIẾT SẢN PHẨM & MUA NGAY (SẠCH LỖI UNDEFINED)
    // -------------------------------------------------------------
    console.log('\n[2/7] Kiểm tra Trang Chi Tiết & Mua Ngay...');
    await page.goto(`${BASE_URL}/detail.html?id=PROD-001`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Chọn phụ kiện thiệp/hộp nếu có
    const addonCheck = page.locator('input[name="addon"]').first();
    if (await addonCheck.isVisible()) {
      await addonCheck.check();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_03_detail_page_addons.png') });
    console.log('  📸 Đã chụp: report_03_detail_page_addons.png');

    // Bấm nút Mua Ngay
    console.log('  Bấm Mua Ngay để mở Modal Thanh Toán...');
    const btnBuyNow = page.locator('#btnBuyNow');
    await btnBuyNow.click();
    await page.waitForTimeout(1000);

    const checkoutModal = page.locator('#checkoutModal');
    const isModalVisible = await checkoutModal.isVisible();
    console.log('  Modal Thanh Toán hiển thị:', isModalVisible);

    // Kiểm tra xem có dòng "undefined" không
    const itemsPreviewText = await page.locator('#checkoutItemsPreview').innerText();
    const hasUndefined = itemsPreviewText.includes('undefined');
    console.log('  Có dòng undefined không?:', hasUndefined ? '❌ CÓ LỖI' : '✅ SẠCH 100%');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_04_detail_buy_now_modal.png') });
    console.log('  📸 Đã chụp: report_04_detail_buy_now_modal.png');

    // -------------------------------------------------------------
    // FLOW 3: ĐẶT HÀNG COD THÀNH CÔNG
    // -------------------------------------------------------------
    console.log('\n[3/7] Kiểm tra Luồng Đặt Hàng COD...');
    await page.fill('#checkoutSenderName', 'Nguyễn Duy Bảo');
    await page.fill('#checkoutSenderPhone', '0908889999');
    await page.fill('#checkoutAddress', '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM');
    await page.fill('#checkoutEmail', 'duybao.test@shophoa.example');

    // Chọn phương thức COD
    const labelCod = page.locator('#labelPaymentCod');
    if (await labelCod.isVisible()) {
      await labelCod.click();
      await page.waitForTimeout(300);
    }

    console.log('  Bấm nút Xác Nhận Đặt Hàng (COD)...');
    await page.click('#checkoutSubmitBtn');
    await page.waitForTimeout(3000);

    const isCodSuccess = await page.locator('#checkoutStepSuccess').isVisible();
    let codOrderCode = '#DH...';
    if (await page.locator('#successOrderId').isVisible()) {
      codOrderCode = await page.locator('#successOrderId').innerText();
    }
    console.log('  Đặt hàng COD thành công:', isCodSuccess);
    console.log('  Mã đơn COD:', codOrderCode);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_05_checkout_cod_success.png') });
    console.log('  📸 Đã chụp: report_05_checkout_cod_success.png');

    // Đóng modal sau COD
    const btnSuccessClose = page.locator('#btnSuccessClose, #checkoutModalClose').first();
    if (await btnSuccessClose.isVisible()) await btnSuccessClose.click();
    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // FLOW 4: ĐẶT HÀNG CHUYỂN KHOẢN VIETQR SEPAY
    // -------------------------------------------------------------
    console.log('\n[4/7] Kiểm tra Luồng Chuyển Khoản VietQR SePay...');
    await page.goto(`${BASE_URL}/detail.html?id=PROD-002`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.click('#btnBuyNow');
    await page.waitForTimeout(1000);

    await page.fill('#checkoutSenderName', 'Trần Thị Lan');
    await page.fill('#checkoutSenderPhone', '0912345678');
    await page.fill('#checkoutAddress', '456 Hai Bà Trưng, Phường Tân Định, Quận 1, TP.HCM');

    const labelSepay = page.locator('#labelPaymentSepay');
    if (await labelSepay.isVisible()) {
      await labelSepay.click();
      await page.waitForTimeout(300);
    }

    console.log('  Bấm nút Tiến Hành Chuyển Khoản VietQR...');
    await page.click('#checkoutSubmitBtn');
    await page.waitForTimeout(3000);

    const isSepayStepVisible = await page.locator('#checkoutStepSepay').isVisible();
    let sepayOrderCode = 'DH...';
    const codeEl = page.locator('#sepayOrderCodeText, #sepayTransferContent').first();
    if (await codeEl.isVisible()) {
      sepayOrderCode = await codeEl.innerText();
    }
    console.log('  Màn hình VietQR hiển thị:', isSepayStepVisible);
    console.log('  Mã đơn SePay:', sepayOrderCode);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_06_checkout_vietqr_step.png') });
    console.log('  📸 Đã chụp: report_06_checkout_vietqr_step.png');

    // Giả lập thanh toán thành công
    console.log('  Bấm nút Mô phỏng thanh toán thành công...');
    const btnSimulate = page.locator('#btnSimulateSepayPaid');
    if (await btnSimulate.isVisible()) {
      await btnSimulate.click();
      await page.waitForTimeout(3500);
    }

    const isSepayPaidSuccess = await page.locator('#checkoutStepSuccess').isVisible();
    console.log('  Nhận diện thanh toán thành công:', isSepayPaidSuccess);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_07_checkout_vietqr_paid.png') });
    console.log('  📸 Đã chụp: report_07_checkout_vietqr_paid.png');

    // -------------------------------------------------------------
    // FLOW 5: ĐĂNG NHẬP & TRANG ĐƠN HÀNG CÁ NHÂN (ORDERS.HTML)
    // -------------------------------------------------------------
    console.log('\n[5/7] Kiểm tra Trang Đơn Hàng Cá Nhân & Tra Cứu...');
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');
    await page.waitForTimeout(1500);

    // Vào orders.html
    await page.goto(`${BASE_URL}/orders.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_08_orders_tracking_page.png') });
    console.log('  📸 Đã chụp: report_08_orders_tracking_page.png');

    // Tra cứu đơn khách vãng lai
    const inputGuestCode = page.locator('#guestOrderCode');
    const inputGuestPhone = page.locator('#guestOrderPhone');
    if (await inputGuestCode.isVisible() && await inputGuestPhone.isVisible()) {
      const cleanCode = codOrderCode.replace('#', '').trim();
      await inputGuestCode.fill(cleanCode);
      await inputGuestPhone.fill('0908889999');
      const formLookup = page.locator('#guestOrderLookupForm');
      await formLookup.evaluate(f => f.requestSubmit());
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_09_guest_order_lookup.png') });
    console.log('  📸 Đã chụp: report_09_guest_order_lookup.png');

    // -------------------------------------------------------------
    // FLOW 6: PHÂN HỆ QUẢN TRỊ ADMIN (ADMIN.HTML)
    // -------------------------------------------------------------
    console.log('\n[6/7] Kiểm tra Toàn Bộ Phân Hệ Quản Trị Admin...');
    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Tab 1: Dashboard Stats
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_10_admin_dashboard_stats.png') });
    console.log('  📸 Đã chụp: report_10_admin_dashboard_stats.png');

    // Tab 2: Quản lý Sản phẩm
    await page.click('.nav-item[data-tab="products"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_11_admin_products_crud.png') });
    console.log('  📸 Đã chụp: report_11_admin_products_crud.png');

    // Tab 3: Quản lý Banner
    await page.click('.nav-item[data-tab="banners"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_12_admin_banners_manager.png') });
    console.log('  📸 Đã chụp: report_12_admin_banners_manager.png');

    // Tab 4: Quản lý Đơn hàng
    await page.click('.nav-item[data-tab="orders"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_13_admin_orders_management.png') });
    console.log('  📸 Đã chụp: report_13_admin_orders_management.png');

    // Tab 5: Quản lý Đánh giá & Người dùng
    const navUsers = page.locator('#navItemUsers, .nav-item[data-tab="users"]');
    if (await navUsers.isVisible()) {
      await navUsers.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_14_admin_reviews_and_users.png') });
    console.log('  📸 Đã chụp: report_14_admin_reviews_and_users.png');

    // -------------------------------------------------------------
    // FLOW 7: CHATBOT TRỢ LÝ ẢO EM LY
    // -------------------------------------------------------------
    console.log('\n[7/7] Kiểm tra Chatbot Em Ly & Thêm Giỏ Hàng...');
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const chatLauncher = page.locator('#chatLauncherBtn');
    if (await chatLauncher.isVisible()) {
      await chatLauncher.click();
      await page.waitForTimeout(600);

      // Bấm nút gợi ý câu hỏi nhanh
      const quickBtn = page.locator('.quick-prompt-btn').first();
      if (await quickBtn.isVisible()) {
        await quickBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_15_chatbot_consultation.png') });
    console.log('  📸 Đã chụp: report_15_chatbot_consultation.png');

    console.log('\n================================================================');
    console.log('🎉 TẤT CẢ 15 HÌNH ẢNH MINH CHỨNG ĐÃ ĐƯỢC CHỤP THÀNH CÔNG 100%!');
    console.log('================================================================');

  } catch (error) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', error);
  } finally {
    await browser.close();
  }
}

runComprehensiveVerification();
