// scripts/test-delivery-date-7days.js
import assert from 'node:assert/strict';
import { OrderService } from '../server/application/OrderService.js';
import { OrderController } from '../server/adapters/in/web/OrderController.js';
import { chromium } from 'playwright';
import path from 'path';

async function testBackendValidation() {
  console.log('🧪 1. Kiểm tra Backend Service & Controller Validation cho giới hạn 7 ngày...');
  const orderService = new OrderService();
  const orderController = new OrderController();

  // 1.1. Chặn khi không có ngày giao
  assert.throws(() => {
    orderService.validateDeliveryDate(null);
  }, /Vui lòng chọn ngày hẹn giao hoa/i, 'OrderService phải ném ValidationError khi deliveryDate = null');

  assert.throws(() => {
    orderService.validateDeliveryDate('');
  }, /Vui lòng chọn ngày hẹn giao hoa/i, 'OrderService phải ném ValidationError khi deliveryDate rỗng');

  assert.throws(() => {
    orderController._parseOrderPayload({
      customerName: 'A',
      phone: '0901234567',
      address: '123 Test',
      deliveryArea: 'Phường Tân Phú',
      deliveryLatitude: 10.77,
      deliveryLongitude: 106.63,
      items: [{ productId: 'PROD-001', quantity: 1 }]
      // Thiếu deliveryDate
    });
  }, /Vui lòng chọn ngày hẹn giao hoa/i, 'OrderController._parseOrderPayload phải chặn khi thiếu deliveryDate');
  console.log('  ✓ Đạt: Bắt buộc deliveryDate, không cho phép bỏ trống');

  // 1.2. Chặn ngày trong quá khứ
  assert.throws(() => {
    orderService.validateDeliveryDate('2020-01-01');
  }, /quá khứ/i, 'Phải chặn ngày giao trong quá khứ');
  console.log('  ✓ Đạt: Chặn ngày hẹn giao trong quá khứ');

  // Hàm helper tính ngày chuẩn theo múi giờ Việt Nam
  const getVnDate = (offsetDays = 0) => {
    const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    return `${p.find(x => x.type === 'year')?.value}-${p.find(x => x.type === 'month')?.value}-${p.find(x => x.type === 'day')?.value}`;
  };

  // 1.3. Chặn ngày vượt quá 7 ngày (ví dụ 8 ngày và 30 ngày sau)
  const future8Days = getVnDate(8);
  const future30Days = getVnDate(30);

  assert.throws(() => {
    orderService.validateDeliveryDate(future8Days);
  }, /7 ngày/i, 'Phải chặn ngày giao vượt quá 7 ngày');

  assert.throws(() => {
    orderService.validateDeliveryDate(future30Days);
  }, /7 ngày/i, 'Phải chặn ngày giao vượt quá 30 ngày');
  console.log('  ✓ Đạt: Chặn ngày hẹn giao vượt quá 7 ngày (1 tuần)');

  // 1.4. Chấp nhận ngày hợp lệ trong vòng 7 ngày (ví dụ 2 ngày sau)
  const valid2Days = getVnDate(2);
  const validated = orderService.validateDeliveryDate(valid2Days);
  assert.equal(validated, valid2Days, 'Ngày hợp lệ trong 7 ngày phải được chấp thuận');
  console.log(`  ✓ Đạt: Chấp nhận ngày hợp lệ trong vòng 7 ngày (${valid2Days})`);
}

async function testFrontendDateConstraint() {
  console.log('\n🌐 2. Kiểm tra giao diện Checkout (Date Picker Min/Max 7 ngày & Banner thông báo)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log('👉 Mở trang chi tiết hoa PROD-001...');
    await page.goto('http://localhost:4000/detail.html?id=PROD-001', { waitUntil: 'networkidle', timeout: 15000 });

    console.log('👉 Click Mua Ngay để mở Checkout Modal...');
    const buyNowBtn = page.locator('#btnBuyNow, .btn-buy-now').first();
    if (await buyNowBtn.isVisible()) {
      await buyNowBtn.click();
    } else {
      await page.evaluate(() => window.openCheckoutModal && window.openCheckoutModal());
    }

    await page.waitForSelector('#checkoutModal:not(.hidden)', { timeout: 8000 });
    console.log('✅ Đã mở modal Checkout');

    // Kiểm tra thông báo chính sách giao hoa
    const bannerText = await page.$eval('.delivery-policy-banner', el => el.textContent.trim());
    console.log('📢 Banner thông báo:', bannerText);
    assert.ok(bannerText.includes('7 ngày tới'), 'Banner phải thông báo rõ nhận lịch trong vòng 7 ngày tới');

    // Kiểm tra dateInput min & max
    const dateInput = page.locator('#checkoutDeliveryDate');
    const minVal = await dateInput.getAttribute('min');
    const maxVal = await dateInput.getAttribute('max');
    const currentVal = await dateInput.inputValue();

    console.log(`📅 Date Picker: min="${minVal}", max="${maxVal}", default="${currentVal}"`);
    assert.ok(minVal, 'dateInput phải có thuộc tính min');
    assert.ok(maxVal, 'dateInput phải có thuộc tính max');

    // Tính độ lệch ngày giữa min và max
    const minD = new Date(minVal);
    const maxD = new Date(maxVal);
    const diffDays = Math.round((maxD - minD) / (24 * 60 * 60 * 1000));
    console.log(`⏱️ Khoảng cách giữa min và max: ${diffDays} ngày (kỳ vọng 7 ngày)`);
    assert.equal(diffDays, 7, 'Khoảng cách cho phép chọn lịch giao phải đúng tròn 7 ngày');

    // Chụp ảnh bằng chứng
    const artifactDir = path.resolve('C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3');
    await page.screenshot({ path: path.join(artifactDir, '87_checkout_7days_date_constraint.png'), fullPage: false });
    console.log('📸 Đã chụp: 87_checkout_7days_date_constraint.png');

    console.log('🎉 KIỂM THỬ RÀNG BUỘC NGÀY GIAO 7 NGÀY THÀNH CÔNG 100%!');
  } finally {
    await browser.close();
  }
}

async function runAll() {
  try {
    await testBackendValidation();
    await testFrontendDateConstraint();
    console.log('\n=============================================================');
    console.log('🏆 TẤT CẢ KIỂM THỬ BACKEND & FRONTEND ĐỀU VƯỢT QUA 100%!');
    console.log('=============================================================');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exitCode = 1;
  }
}

runAll();
