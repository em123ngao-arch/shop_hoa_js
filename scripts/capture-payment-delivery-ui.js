/**
 * scripts/capture-payment-delivery-ui.js
 * Chụp ảnh bằng chứng trực quan cho luồng thanh toán và tự giao hàng:
 * 1. Modal đặt hàng với 2 lựa chọn (100% full & 50% cọc), không còn COD
 * 2. Tính phí giao hàng động theo tuyến (0-3km free, 3-10km 25k, >10-20km 40k)
 * 3. Màn hình SePay QR thanh toán đủ 100%
 * 4. Màn hình thông báo đặt hoa thành công
 * 5. Màn hình SePay QR trả trước cọc 50%
 * 6. Modal Mua Ngay trên trang chi tiết (detail.html) đồng bộ 100%
 * 7. Bảng quản trị Admin: chi tiết đơn trả trước 50% & chức năng thu tiền mặt khi giao
 * 8. Bảng đối soát SePay các giao dịch chưa khớp mã thanh toán
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import app from '../server.js';
import { container } from '../server/infrastructure/config/container.js';

const EVIDENCE_DIR = path.resolve('public/images/test_evidence');
const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function saveEvidenceScreenshot(page, filename, selector = null) {
  const publicPath = path.join(EVIDENCE_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  
  if (selector) {
    const el = page.locator(selector).first();
    await el.screenshot({ path: publicPath });
  } else {
    await page.screenshot({ path: publicPath });
  }
  
  // Copy sang artifact dir
  fs.copyFileSync(publicPath, artifactPath);
  console.log(`📸 [EVIDENCE SAVED]: ${filename}`);
}

async function runCapture() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU CHỤP ẢNH MINH CHỨNG THANH TOÁN & GIAO HÀNG (PLAYWRIGHT)');
  console.log('================================================================\n');

  let serverInstance = null;
  let browser = null;
  let baseUrl = '';

  try {
    // 1. Tạo bản ghi giao dịch chưa khớp để bảng đối soát Admin có dữ liệu thực tế
    try {
      const existing = await container.prisma.unmatched_payment_transactions.findFirst({
        where: { provider_tx_id: 'SP_UNMATCHED_DEMO_999' }
      });
      if (!existing) {
        await container.orderRepo.recordUnmatchedPayment({
          providerTxId: 'SP_UNMATCHED_DEMO_999',
          content: 'CHUYEN TIEN MUA HOA KHONG KEM MA DON',
          amount: 320000,
          bankBrand: 'Sacombank',
          accountNumber: '70207003455',
          transactionDate: new Date()
        });
        console.log('✅ Đã tạo mẫu giao dịch chưa khớp vào bảng unmatched_payment_transactions');
      } else {
        console.log('ℹ️ Giao dịch unmatched SP_UNMATCHED_DEMO_999 đã có trong DB');
      }
    } catch (e) {
      console.log('ℹ️ Bỏ qua tạo giao dịch unmatched:', e.message);
    }

    // 2. Khởi động server trên port ngẫu nhiên
    await new Promise((resolve) => {
      serverInstance = app.listen(0, '127.0.0.1', () => {
        const port = serverInstance.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[Local Server] Running on ${baseUrl}`);
        resolve();
      });
    });

    // 3. Khởi chạy Playwright
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1.5
    });
    const page = await context.newPage();

    // -----------------------------------------------------------------
    // SCREENSHOT 1: MODAL ĐẶT HÀNG VỚI 2 KẾ HOẠCH THANH TOÁN (NO COD)
    // -----------------------------------------------------------------
    console.log('\n[1/8] Chụp Modal Đặt Hàng & 2 Kế Hoạch Thanh Toán...');
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Bấm Thêm Nhanh ở sản phẩm đầu tiên bằng class .quick-add-btn / .add-cart
    const addCartBtn = page.locator('.quick-add-btn, .add-cart').first();
    await addCartBtn.click({ force: true });
    await page.waitForTimeout(600);

    // Mở Cart Drawer nếu chưa mở và bấm Tiến Hành Đặt Hàng
    const cartDrawer = page.locator('#cartDrawer');
    if (!(await cartDrawer.isVisible())) {
      await page.click('#headerCartBtn');
      await page.waitForTimeout(500);
    }

    const drawerCheckoutBtn = page.locator('#drawerCheckoutBtn');
    await drawerCheckoutBtn.click();
    await page.waitForTimeout(800);

    // Modal xuất hiện
    await page.waitForSelector('#checkoutModal:not(.hidden)');
    await saveEvidenceScreenshot(page, '01_checkout_modal_payment_plans.png', '#checkoutModal .checkout-modal-card');

    // -----------------------------------------------------------------
    // SCREENSHOT 2: KIỂM TRA KHU VỰC VÀ BÁO PHÍ GIAO HÀNG THEO TUYẾN
    // -----------------------------------------------------------------
    console.log('\n[2/8] Chụp Báo Phí Giao Hàng Tuyến 5km (25.000₫)...');
    const options = await page.$$eval('#checkoutDeliveryArea option', opts => opts.map(o => o.value));
    const targetArea = options.find(v => v && v.includes('Bến Nghé')) || options[1] || 'Phường Bến Nghé';
    await page.selectOption('#checkoutDeliveryArea', targetArea);
    
    await page.fill('#checkoutAddress', '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM #route:5km');
    await page.click('#btnQuoteDelivery');
    await page.waitForTimeout(800);

    await saveEvidenceScreenshot(page, '02_checkout_delivery_quote_calculated.png', '#checkoutModal .checkout-modal-card');

    // -----------------------------------------------------------------
    // SCREENSHOT 3: MÀN HÌNH SEPAY QR CHUYỂN KHOẢN ĐỦ 100%
    // -----------------------------------------------------------------
    console.log('\n[3/8] Chụp Màn Hình SePay VietQR Chuyển Khoản Đủ 100%...');
    await page.fill('#checkoutSenderName', 'Nguyễn Văn An');
    await page.fill('#checkoutSenderPhone', '0901234567');
    await page.fill('#checkoutEmail', 'an.nguyen@example.com');
    await page.evaluate(() => {
      const el = document.querySelector('#checkoutTermsAccepted');
      if (el) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Đảm bảo chọn trả đủ 100%
    await page.click('#labelPaymentFull');
    await page.waitForTimeout(300);

    // Bấm thanh toán
    await page.click('#checkoutSubmitBtn');
    await page.waitForTimeout(1500);

    await page.waitForSelector('#checkoutStepSepay:not(.hidden)');
    await saveEvidenceScreenshot(page, '03_sepay_qr_100_percent_full.png', '#checkoutModal .checkout-modal-card');

    // -----------------------------------------------------------------
    // SCREENSHOT 4: ĐẶT HÀNG THÀNH CÔNG SAU KHI MÔ PHỎNG THANH TOÁN
    // -----------------------------------------------------------------
    console.log('\n[4/8] Chụp Màn Hình Đặt Hoa Thành Công (100% Paid)...');
    await page.click('#btnSimulateSepayPaid');
    await page.waitForTimeout(1800);

    await page.waitForSelector('#checkoutStepSuccess:not(.hidden)');
    await saveEvidenceScreenshot(page, '04_sepay_payment_success.png', '#checkoutModal .checkout-modal-card');

    // Đóng modal
    await page.click('#checkoutModalClose');
    await page.waitForTimeout(600);

    // -----------------------------------------------------------------
    // SCREENSHOT 5: SEPAY QR TRẢ TRƯỚC 50% VÀ THU TIỀN MẶT KHI GIAO
    // -----------------------------------------------------------------
    console.log('\n[5/8] Chụp Màn Hình SePay QR Trả Trước Cọc 50%...');
    // Thêm giỏ hàng lần 2
    const addCartBtn2 = page.locator('.quick-add-btn, .add-cart').first();
    await addCartBtn2.click({ force: true });
    await page.waitForTimeout(600);
    
    if (!(await cartDrawer.isVisible())) {
      await page.click('#headerCartBtn');
      await page.waitForTimeout(500);
    }
    await page.click('#drawerCheckoutBtn');
    await page.waitForTimeout(800);

    await page.selectOption('#checkoutDeliveryArea', targetArea);
    await page.fill('#checkoutAddress', '456 Hai Bà Trưng, Phường Bến Nghé, Quận 1 #route:2km');
    await page.click('#btnQuoteDelivery');
    await page.waitForTimeout(600);

    await page.fill('#checkoutSenderName', 'Trần Thị Mai');
    await page.fill('#checkoutSenderPhone', '0988776655');
    await page.fill('#checkoutEmail', 'mai.tran@example.com');
    await page.evaluate(() => {
      const el = document.querySelector('#checkoutTermsAccepted');
      if (el) {
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Chọn Trả trước 50%
    await page.click('#labelPaymentDeposit');
    await page.waitForTimeout(400);

    await page.click('#checkoutSubmitBtn');
    await page.waitForTimeout(1500);

    await page.waitForSelector('#checkoutStepSepay:not(.hidden)');
    await saveEvidenceScreenshot(page, '05_sepay_qr_50_percent_deposit.png', '#checkoutModal .checkout-modal-card');

    // Bấm mô phỏng thanh toán thành công để đơn được ghi nhận cọc 50% vào DB
    await page.click('#btnSimulateSepayPaid');
    await page.waitForTimeout(1800);
    await page.click('#checkoutModalClose');
    await page.waitForTimeout(600);

    // -----------------------------------------------------------------
    // SCREENSHOT 6: MODAL MUA NGAY TRÊN TRANG CHI TIẾT (detail.html)
    // -----------------------------------------------------------------
    console.log('\n[6/8] Chụp Modal Mua Ngay Trên Trang Chi Tiết (detail.html)...');
    await page.goto(`${baseUrl}/detail.html?id=PROD-001`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const btnBuyNow = page.locator('#btnBuyNow');
    await btnBuyNow.waitFor({ state: 'visible' });
    await btnBuyNow.click();
    await page.waitForTimeout(1000);

    await page.waitForSelector('#checkoutModal:not(.hidden)');
    await saveEvidenceScreenshot(page, '06_detail_page_checkout_modal.png', '#checkoutModal .checkout-modal-card');

    // -----------------------------------------------------------------
    // SCREENSHOT 7: ADMIN QUẢN TRỊ ĐƠN HÀNG & THU TIỀN MẶT CÒN LẠI (50%)
    // -----------------------------------------------------------------
    console.log('\n[7/8] Chụp Bảng Quản Trị Đơn Hàng & Thu Tiền Mặt Khi Giao...');
    // Đăng nhập Admin
    await page.goto(`${baseUrl}/login.html`, { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');
    await page.waitForTimeout(1500);

    // Vào trang admin
    await page.goto(`${baseUrl}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Vào tab Quản Lý Đơn Hàng
    await page.click('[data-tab="orders"]');
    await page.waitForTimeout(1500);

    // Mở chi tiết đơn hàng cọc 50%
    const viewButtons = page.locator('.view-order-btn');
    if (await viewButtons.count() > 0) {
      await viewButtons.first().click();
      await page.waitForTimeout(1200);
      await saveEvidenceScreenshot(page, '07_admin_orders_payment_plan_table.png', '#orderDetailModal .modal-card');
      
      const closeDetail = page.locator('#orderDetailModalClose');
      if (await closeDetail.isVisible()) await closeDetail.click();
      await page.waitForTimeout(600);
    } else {
      await saveEvidenceScreenshot(page, '07_admin_orders_payment_plan_table.png');
    }

    // -----------------------------------------------------------------
    // SCREENSHOT 8: BẢNG ĐỐI SOÁT GIAO DỊCH SEPAY CHƯA KHỚP
    // -----------------------------------------------------------------
    console.log('\n[8/8] Chụp Bảng Đối Soát Giao Dịch SePay Chưa Khớp...');
    await page.click('[data-tab="refunds"]');
    await page.waitForTimeout(1500);

    // Cuộn xuống bảng đối soát SePay
    const unmatchedSection = page.locator('#adminUnmatchedPaymentsTable');
    await unmatchedSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    await saveEvidenceScreenshot(page, '08_admin_unmatched_reconciliation_tab.png');

    console.log('\n================================================================');
    console.log('🎉 ĐÃ CHỤP THÀNH CÔNG ĐỦ 8 ẢNH BẰNG CHỨNG GIAO DIỆN!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH CHỤP ẢNH:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverInstance) serverInstance.close();
  }
}

runCapture();
