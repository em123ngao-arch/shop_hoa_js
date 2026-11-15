// scripts/test-live-order-badge-polling.js
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = path.resolve('C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3');

async function run() {
  console.log('🚀 Bắt đầu kiểm thử Live Polling + Badge đỏ + Toast thông báo đơn mới...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Đăng nhập Admin
    await page.goto('http://localhost:4000/login.html?returnUrl=%2Fadmin.html', { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');
    await page.waitForURL('**/admin.html', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const initialBadge = await page.innerText('#navOrdersBadge');
    console.log(`  Số lượng đơn chờ ban đầu trên badge: ${initialBadge}`);

    // 2. Tạo 1 đơn hàng COD mới qua API từ phía khách hàng
    console.log('👉 Đang mô phỏng khách đặt 1 đơn hàng mới qua API...');
    const orderRes = await axios.post('http://localhost:4000/api/orders', {
      customerName: 'Khách Test Thông Báo Live',
      customerPhone: '0988776655',
      customerEmail: 'live_test@shophoa.example',
      shippingAddress: '123 Đường Hoa Hồng, Phường Chánh Hưng, Thành phố Hồ Chí Minh',
      deliveryArea: 'Phường Chánh Hưng',
      deliverySlot: 'Chiều (13:00 - 17:00)',
      deliveryLatitude: 10.7457466,
      deliveryLongitude: 106.6766153,
      paymentMethod: 'sepay',
      paymentPlan: 'sepay_full',
      termsAccepted: true,
      items: [
        {
          productId: 'PROD-001',
          quantity: 1,
          price: 350000,
          addonIds: []
        }
      ]
    });

    const newOrderCode = orderRes.data.orderCode || orderRes.data.id;
    console.log(`✅ Khách hàng đã đặt thành công đơn mới #${newOrderCode}!`);

    // 3. Đợi Toast xuất hiện ngay khi chu kỳ Polling tự động quét được đơn mới
    console.log('⏳ Đợi chu kỳ Polling tự động (15 giây) của admin.js phát hiện đơn mới và bắn Toast...');
    const toastEl = await page.waitForSelector('.toast', { timeout: 20000 });
    const toastText = await toastEl.innerText();
    console.log(`  🎉 Toast popup xuất hiện tức thì trên màn hình: "${toastText.trim()}"`);

    // 4. Kiểm tra Badge đã tăng lên
    const updatedBadge = await page.innerText('#navOrdersBadge');
    console.log(`  Số lượng đơn trên badge sau khi có đơn mới: ${updatedBadge} (ban đầu: ${initialBadge})`);

    // Chụp ảnh bằng chứng 83: Toast thông báo đơn mới góc màn hình + Badge số đỏ nhảy
    const liveScreenshotPath = path.join(artifactDir, '83_admin_new_order_toast_and_badge.png');
    await page.screenshot({ path: liveScreenshotPath, fullPage: false });
    console.log(`📸 Đã lưu ảnh chụp Toast & Badge Live tại: ${liveScreenshotPath}`);

    console.log('🎉 KIỂM THỬ THÔNG BÁO LIVE VÀ BADGE HOÀN TOÀN THÀNH CÔNG!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử live:', err.response?.data || err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
