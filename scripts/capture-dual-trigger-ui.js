import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = path.resolve('public/images/test_evidence');
const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';

async function capture() {
  console.log('🚀 Chụp ảnh minh chứng giao diện mới: Nút Tôi Đã Chuyển Khoản & Cơ chế kép...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5
  });
  const page = await context.newPage();

  // 1. Mở trang chủ và tạo đơn SePay
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    localStorage.setItem('SHOP_HOA_CART', JSON.stringify([
      { id: 'PROD-001', name: 'Bó Hoa Kẽm Nhung Tulip Pastel', price: 350000, quantity: 1, image: 'https://res.cloudinary.com/mobixull/image/upload/f_auto,q_auto/v1794629626/shophoa/catalog/350k.webp' }
    ]));
    window.openCheckoutModal();
  });
  await page.waitForTimeout(600);

  await page.selectOption('#checkoutDeliveryArea', 'Phường Tân Phú (Quận Tân Phú)');
  await page.fill('#checkoutAddress', '14 Trịnh Đình Thảo');
  await page.click('#btnQuoteDelivery');
  await page.waitForTimeout(1000);

  await page.fill('#checkoutSenderName', 'Nguyễn Duy Bảo');
  await page.fill('#checkoutSenderPhone', '0901234567');
  await page.evaluate(() => {
    const el = document.querySelector('#checkoutTermsAccepted');
    if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  await page.click('#checkoutSubmitBtn');
  await page.waitForSelector('#checkoutStepSepay:not(.hidden)');
  await page.waitForTimeout(1000);

  // Ảnh 1: Màn hình VietQR có nút "Tôi Đã Chuyển Khoản (Kiểm Tra Ngay)"
  const p1 = path.join(EVIDENCE_DIR, '06_vietqr_confirm_paid_button.png');
  const a1 = path.join(ARTIFACT_DIR, '06_vietqr_confirm_paid_button.png');
  await page.locator('#checkoutModal .checkout-modal-card').screenshot({ path: p1 });
  fs.copyFileSync(p1, a1);
  console.log('📸 [SAVED]: 06_vietqr_confirm_paid_button.png');

  // Ảnh 2: Click vào nút "Tôi Đã Chuyển Khoản (Kiểm Tra Ngay)" để kiểm tra trạng thái loading & đối soát tức thì
  await page.click('#btnConfirmTransfer');
  await page.waitForTimeout(400);

  const p2 = path.join(EVIDENCE_DIR, '07_vietqr_checking_with_bank_state.png');
  const a2 = path.join(ARTIFACT_DIR, '07_vietqr_checking_with_bank_state.png');
  await page.locator('#checkoutModal .checkout-modal-card').screenshot({ path: p2 });
  fs.copyFileSync(p2, a2);
  console.log('📸 [SAVED]: 07_vietqr_checking_with_bank_state.png');

  await browser.close();
  console.log('🎉 Đã hoàn tất chụp toàn bộ minh chứng giao diện mới!');
  process.exit(0);
}

capture().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

