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
  console.log('🚀 Bắt đầu chụp minh chứng giao diện: Banner Đang Giao Hàng & Chuông Thông Báo...');
  
  // 1. Lấy thông tin user Bảo Nguyễn & tạo JWT token
  const user = await prisma.users.findFirst({ where: { phone: '0789632362' } });
  if (!user) throw new Error('Không tìm thấy user Bảo Nguyễn!');
  
  const token = container.tokenPort.generate({
    id: user.id,
    role: user.role,
    email: user.email,
    tokenVersion: user.token_version || 0
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5
  });

  // Gắn cookie xác thực HttpOnly
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

  const page = await context.newPage();

  // 2. Mở orders.html
  await page.goto('http://localhost:4000/orders.html', { waitUntil: 'domcontentloaded' });
  
  // Đặt localStorage để đồng bộ UI
  await page.evaluate((u) => {
    localStorage.setItem('user', JSON.stringify({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role
    }));
  }, user);

  // Reload nhẹ để nạp đầy đủ phiên và dữ liệu
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 3. Chờ hiển thị thẻ đơn hàng và banner đang giao
  await page.waitForSelector('.order-craft-card');
  await page.waitForSelector('.shipping-alert-banner');

  // Chụp ảnh 1: Toàn bộ thẻ đơn hàng có Banner Đang Giao Hàng nổi bật
  const p1 = path.join(EVIDENCE_DIR, '11_shipping_alert_banner_customer_orders.png');
  const a1 = path.join(ARTIFACT_DIR, '11_shipping_alert_banner_customer_orders.png');
  const cardLocator = page.locator('.order-craft-card').first();
  await cardLocator.screenshot({ path: p1 });
  fs.copyFileSync(p1, a1);
  console.log('📸 [SAVED]: 11_shipping_alert_banner_customer_orders.png');

  // Chụp ảnh toàn trang orders.html để thấy tổng thể layout
  const p1Full = path.join(EVIDENCE_DIR, '11b_shipping_orders_page_full.png');
  const a1Full = path.join(ARTIFACT_DIR, '11b_shipping_orders_page_full.png');
  await page.screenshot({ path: p1Full });
  fs.copyFileSync(p1Full, a1Full);
  console.log('📸 [SAVED]: 11b_shipping_orders_page_full.png');

  // 4. Mở chuông thông báo (Notification Bell)
  await page.waitForSelector('#headerNotifBellBtn');
  await page.click('#headerNotifBellBtn');
  await page.waitForTimeout(600);

  // Chụp ảnh 2: Chuông thông báo mở ra hiển thị thông điệp "Bó hoa của bạn đang trên đường giao!"
  const p2 = path.join(EVIDENCE_DIR, '12_shipping_notification_bell_dropdown.png');
  const a2 = path.join(ARTIFACT_DIR, '12_shipping_notification_bell_dropdown.png');
  
  await page.waitForSelector('#headerNotifDropdown:not(.hidden)');
  await page.locator('#headerNotifDropdown').screenshot({ path: p2 });
  fs.copyFileSync(p2, a2);
  console.log('📸 [SAVED]: 12_shipping_notification_bell_dropdown.png');

  await browser.close();
  await prisma.$disconnect();
  console.log('🎉 Hoàn tất chụp ảnh minh chứng thành công 100%!');
  process.exit(0);
}

capture().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
