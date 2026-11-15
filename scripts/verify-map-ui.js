import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3';

async function run() {
  console.log('--- Bắt đầu kiểm thử giao diện bản đồ ESRI mới & Checkout ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    geolocation: { latitude: 10.7445, longitude: 106.6785 },
    permissions: ['geolocation']
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  console.log('1. Mở trang chi tiết hoa PROD-MWFTAMC6...');
  await page.goto('http://localhost:4000/detail.html?id=PROD-MWFTAMC6', { waitUntil: 'networkidle' });

  console.log('2. Mở modal Đặt hàng / Thanh toán...');
  // Click nút mua ngay
  const buyNowBtn = page.locator('#btnBuyNow, .btn-buy-now').first();
  if (await buyNowBtn.isVisible()) {
    await buyNowBtn.click();
  } else {
    await page.evaluate(() => window.openCheckoutModal());
  }

  await page.waitForSelector('#checkoutModal.active, #checkoutModal[style*="display: block"], #checkoutModal:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(1000);

  console.log('3. Chọn Khu vực: Quận 8 (tên cũ)...');
  await page.selectOption('#checkoutDeliveryRegion', 'Quận 8 (tên cũ)');
  await page.waitForTimeout(500);

  console.log('4. Chọn Phường: Phường Chánh Hưng...');
  await page.selectOption('#checkoutDeliveryArea', 'Phường Chánh Hưng');

  console.log('5. Đợi bản đồ tự động bay (Auto-Fly) tới Phường Chánh Hưng và tải gạch ESRI...');
  await page.waitForTimeout(2500);

  // Nhập thông tin người nhận
  await page.fill('#checkoutSenderName', 'Nguyễn Văn Test');
  await page.fill('#checkoutSenderPhone', '0912345678');
  await page.fill('#checkoutAddress', '86 Phạm Thế Hiển');
  await page.fill('#checkoutAddressDetails', 'Hẻm 12, lầu 2');

  const deliveryDateInput = page.locator('#checkoutDeliveryDate');
  if (await deliveryDateInput.isVisible()) {
    const val = await deliveryDateInput.inputValue();
    if (!val) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      await deliveryDateInput.fill(tomorrow);
    }
  }

  // Cuộn bản đồ vào giữa màn hình để chụp hình rõ nhất
  await page.locator('#checkoutDeliveryMap').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Chụp ảnh bằng chứng bản đồ ESRI mới tại Chánh Hưng
  const shotPath = path.join(ARTIFACT_DIR, '77_checkout_map_esri_chanhhung.png');
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log('✓ Đã chụp ảnh màn hình bản đồ ESRI tại:', shotPath);

  // Kiểm tra tọa độ đã ghim
  const pinHint = await page.textContent('#checkoutMapPinHint');
  console.log('Trạng thái ghim hiển thị:', pinHint);

  // Tích đồng ý điều khoản
  const termsCheckbox = page.locator('#checkoutTermsAccepted');
  if (await termsCheckbox.isVisible()) {
    await termsCheckbox.check();
  } else {
    await page.evaluate(() => {
      const cb = document.querySelector('#checkoutTermsAccepted');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
    });
  }

  console.log('6. Bấm Tiến Hành Thanh Toán để xác nhận luồng đặt hàng không bị lỗi 500...');
  const submitBtn = page.locator('#checkoutSubmitBtn');
  await submitBtn.click();
  await page.waitForTimeout(4000);

  const stepSepayVisible = await page.locator('#checkoutStepSepay:not(.hidden)').isVisible().catch(() => false);
  const stepSuccessVisible = await page.locator('#checkoutStepSuccess:not(.hidden)').isVisible().catch(() => false);
  console.log('Chuyển bước thành công:', { stepSepayVisible, stepSuccessVisible });

  // Kiểm tra xem có lỗi alert hay popup lỗi 500 không
  const hasErrorAlert = await page.locator('.field-error:visible, .alert-danger:visible, [style*="color: rgb(180, 35, 24)"]').count();
  console.log('Số cảnh báo lỗi trên form:', hasErrorAlert);

  await browser.close();
  console.log('--- HOÀN TẤT KIỂM THỬ GIAO DIỆN BẢN ĐỒ ---');
}

run().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
