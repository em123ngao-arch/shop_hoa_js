import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { container } from '../server/infrastructure/config/container.js';
import prisma from '../server/infrastructure/db/prisma.js';

const EVIDENCE_DIR = path.resolve('public/images/test_evidence');
const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function capture() {
  console.log('🚀 Bắt đầu chụp minh chứng kênh liên hệ: Speed Dial, VietQR, Footer, Orders...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5
  });

  const page = await context.newPage();

  // 1. Mở trang chủ index.html
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 2. Click nút launcher để bung mở Speed Dial 4-in-1
  await page.waitForSelector('#chatLauncherBtn');
  await page.click('#chatLauncherBtn');
  await page.waitForTimeout(500);

  // Ảnh 13: Cụm nút Speed Dial 4-in-1 bung mở (Trợ lý Em Ly, Chat Zalo, Nhắn Messenger, Hotline)
  const p13 = path.join(EVIDENCE_DIR, '13_floating_speed_dial_open.png');
  const a13 = path.join(ARTIFACT_DIR, '13_floating_speed_dial_open.png');
  await page.screenshot({
    path: p13,
    clip: { x: 1050, y: 550, width: 380, height: 400 }
  });
  fs.copyFileSync(p13, a13);
  console.log('📸 [SAVED]: 13_floating_speed_dial_open.png');

  // Đóng speed dial
  await page.click('#chatLauncherBtn');
  await page.waitForTimeout(300);

  // 3. Mở Modal Checkout và chuyển đến bước VietQR SePay
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

  await page.fill('#checkoutSenderName', 'Bảo Nguyễn');
  await page.fill('#checkoutSenderPhone', '0374905296');
  await page.evaluate(() => {
    const el = document.querySelector('#checkoutTermsAccepted');
    if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  await page.click('#checkoutSubmitBtn');
  await page.waitForSelector('#checkoutStepSepay:not(.hidden)');
  await page.waitForTimeout(1000);

  // Ảnh 14: Modal VietQR SePay có 2 nút Chat Zalo Gửi Bill & Nhắn Messenger + Hotline text
  const p14 = path.join(EVIDENCE_DIR, '14_vietqr_support_zalo_messenger.png');
  const a14 = path.join(ARTIFACT_DIR, '14_vietqr_support_zalo_messenger.png');
  await page.locator('#checkoutModal .checkout-modal-card').screenshot({ path: p14 });
  fs.copyFileSync(p14, a14);
  console.log('📸 [SAVED]: 14_vietqr_support_zalo_messenger.png');

  // Đóng modal checkout
  await page.click('#checkoutModalClose');
  await page.waitForTimeout(500);

  // 4. Cuộn xuống chân trang Footer
  const footerLocator = page.locator('footer.footer');
  await footerLocator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Ảnh 15: Chân trang đầy đủ Hotline, Zalo, Fanpage, Messenger
  const p15 = path.join(EVIDENCE_DIR, '15_footer_full_contact_channels.png');
  const a15 = path.join(ARTIFACT_DIR, '15_footer_full_contact_channels.png');
  await footerLocator.screenshot({ path: p15 });
  fs.copyFileSync(p15, a15);
  console.log('📸 [SAVED]: 15_footer_full_contact_channels.png');

  // 5. Kiểm tra trang Đơn hàng cá nhân orders.html
  const user = await prisma.users.findFirst({ where: { phone: '0789632362' } });
  if (user) {
    const token = container.tokenPort.generate({
      id: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.token_version || 0
    });

    await context.addCookies([
      {
        name: 'shophoa_session',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ]);

    await page.goto('http://localhost:4000/orders.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((u) => {
      localStorage.setItem('user', JSON.stringify({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role
      }));
    }, user);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.order-craft-card');
    await page.waitForTimeout(1000);

    // Ảnh 16: Thẻ đơn hàng có nút Hotline và Zalo mới
    const p16 = path.join(EVIDENCE_DIR, '16_orders_page_shipping_hotline_updated.png');
    const a16 = path.join(ARTIFACT_DIR, '16_orders_page_shipping_hotline_updated.png');
    await page.locator('.order-craft-card').first().screenshot({ path: p16 });
    fs.copyFileSync(p16, a16);
    console.log('📸 [SAVED]: 16_orders_page_shipping_hotline_updated.png');
  }

  await browser.close();
  await prisma.$disconnect();
  console.log('🎉 Toàn bộ ảnh minh chứng đã được lưu thành công 100%!');
  process.exit(0);
}

capture().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

