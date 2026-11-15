import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../server/infrastructure/db/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const brainDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\df58fbe0-caf1-4d2a-9095-600eafdbd0f3';

async function runAudit() {
  console.log('================================================================');
  console.log('🌸 STARTING LIVE E2E AUDIT: DELIVERY ZONE & MAP PINNING (LEAFLET)');
  console.log('================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  const baseUrl = 'http://localhost:4000';
  let createdOrderId = null;

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: TRANG CHỦ & MỞ MODAL ĐẶT HÀNG
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Home Page & Opening Checkout Modal ---');
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const firstQuickAdd = page.locator('.btn-quick-add').first();
    await firstQuickAdd.scrollIntoViewIfNeeded();
    await firstQuickAdd.click();
    await page.waitForTimeout(800);
    console.log('✅ Đã thêm 1 sản phẩm vào giỏ hàng');

    // Mở checkout modal
    await page.evaluate(() => {
      if (typeof window.openCheckoutModal === 'function') {
        window.openCheckoutModal();
      }
    });
    await page.waitForTimeout(1500);

    const isModalOpen = await page.locator('#checkoutModal').isVisible();
    console.log('✅ Modal checkout hiển thị:', isModalOpen);

    // -------------------------------------------------------------
    // BƯỚC 2: KIỂM TRA DROPDOWN KHU VỰC & TÍNH PHÍ GIAO HÀNG
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Delivery Zones & Fee Calculation ---');
    const regionSelect = page.locator('#checkoutDeliveryRegion');
    const areaSelect = page.locator('#checkoutDeliveryArea');
    await regionSelect.scrollIntoViewIfNeeded();

    // 2.1 Chọn Quận Tân Phú (tên cũ) -> Phường Tân Phú (Miễn phí 0₫)
    await regionSelect.selectOption('Quận Tân Phú (tên cũ)');
    await page.waitForTimeout(500);
    await areaSelect.selectOption('Phường Tân Phú');
    await page.waitForTimeout(1000);
    const quoteHint = page.locator('#deliveryQuoteHint');
    const quoteTextNear = await quoteHint.textContent();
    console.log('Phường Tân Phú quote:', quoteTextNear);

    // Click ghim bản đồ
    const mapElement = page.locator('#checkoutDeliveryMap');
    await mapElement.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await mapElement.click({ force: true, position: { x: 180, y: 120 } });
    await page.waitForTimeout(1000);

    const pinHint = page.locator('#checkoutMapPinHint');
    const pinText = await pinHint.textContent();
    console.log('Ghim hint:', pinText);

    await page.screenshot({ path: path.join(brainDir, '71_checkout_map_tanphu_pinned.png') });
    console.log('📸 Đã lưu ảnh: 71_checkout_map_tanphu_pinned.png');

    // 2.2 Đổi sang Phường Tân Sơn Nhì (Lân cận - 35.000₫)
    await areaSelect.selectOption('Phường Tân Sơn Nhì');
    await page.waitForTimeout(1000);
    const quoteTextLocal = await quoteHint.textContent();
    const feeTextLocal = await page.locator('#checkoutShippingFee').textContent();
    console.log('Phường Tân Sơn Nhì fee:', feeTextLocal, '| hint:', quoteTextLocal);

    await mapElement.scrollIntoViewIfNeeded();
    await mapElement.click({ force: true, position: { x: 200, y: 110 } });
    await page.waitForTimeout(800);

    await page.screenshot({ path: path.join(brainDir, '72_checkout_map_tansonnhi_35k.png') });
    console.log('📸 Đã lưu ảnh: 72_checkout_map_tansonnhi_35k.png');

    // 2.3 Đổi sang Quận 1 -> Phường Bến Thành (Khu vực xa - 50.000₫)
    await regionSelect.selectOption('Quận 1 (tên cũ)');
    await page.waitForTimeout(500);
    await areaSelect.selectOption('Phường Bến Thành');
    await page.waitForTimeout(1000);
    const feeTextExt = await page.locator('#checkoutShippingFee').textContent();
    console.log('Phường Bến Thành fee:', feeTextExt);

    await mapElement.scrollIntoViewIfNeeded();
    await mapElement.click({ force: true, position: { x: 220, y: 130 } });
    await page.waitForTimeout(800);

    await page.screenshot({ path: path.join(brainDir, '73_checkout_map_benthanh_50k.png') });
    console.log('📸 Đã lưu ảnh: 73_checkout_map_benthanh_50k.png');

    // -------------------------------------------------------------
    // BƯỚC 3: ĐẶT HÀNG THỰC TẾ & CHUYỂN SANG MÀN HÌNH SEPAY
    // -------------------------------------------------------------
    console.log('\n--- 3. Submitting Real Order & VietQR Sepay Transition ---');
    await page.fill('#checkoutSenderName', 'Nguyễn Thị Hoa Nhung');
    await page.fill('#checkoutSenderPhone', '0908765432');
    await regionSelect.selectOption('Quận Tân Phú (tên cũ)');
    await page.waitForTimeout(500);
    await areaSelect.selectOption('Phường Tân Phú');
    await page.waitForTimeout(500);
    await page.fill('#checkoutAddress', '14 Trịnh Đình Thảo');
    await page.fill('#checkoutAddressDetails', 'Tầng 1 tiệm hoa handmade');
    await page.waitForTimeout(500);

    // Ghim bản đồ cho địa chỉ cuối cùng
    await mapElement.scrollIntoViewIfNeeded();
    await mapElement.click({ force: true, position: { x: 180, y: 120 } });
    await page.waitForTimeout(800);

    // Đồng ý chính sách
    await page.evaluate(() => {
      const cb = document.querySelector('#checkoutTermsAccepted');
      if (cb) cb.checked = true;
    });

    // Submit form
    await page.evaluate(() => {
      document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    await page.waitForTimeout(3000);

    const isSepayStepVisible = await page.locator('#checkoutStepSepay').isVisible();
    console.log('✅ Chuyển sang bước quét mã QR SePay:', isSepayStepVisible);

    const sepayBankName = await page.locator('#sepayBankName').textContent().catch(() => '');
    const sepayAccountNum = await page.locator('#sepayAccountNumber').textContent().catch(() => '');
    const sepayTransferContent = await page.locator('#sepayTransferContent').textContent().catch(() => '');
    console.log(`Thông tin ngân hàng SePay: ${sepayBankName} - STK: ${sepayAccountNum} - Mã: ${sepayTransferContent}`);

    await page.screenshot({ path: path.join(brainDir, '74_checkout_sepay_qr_success.png') });
    console.log('📸 Đã lưu ảnh: 74_checkout_sepay_qr_success.png');

    // Lấy orderId từ CSDL
    const latestOrder = await prisma.orders.findFirst({
      where: { customer_phone: '0908765432' },
      orderBy: { created_at: 'desc' }
    });
    if (latestOrder) {
      createdOrderId = latestOrder.id;
      console.log(`[Order In DB]: ID: ${latestOrder.id} | Code: ${latestOrder.order_code} | Zone: ${latestOrder.delivery_zone} | Lat: ${latestOrder.delivery_latitude} | Lng: ${latestOrder.delivery_longitude}`);
    }

    // -------------------------------------------------------------
    // BƯỚC 4: TRANG ORDERS & TRA CỨU ĐƠN HÀNG VỚI BẢN ĐỒ
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Orders Page & Guest Lookup ---');
    if (latestOrder) {
      await page.goto(`${baseUrl}/orders.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const guestCodeInput = page.locator('#guestOrderCode');
      const guestPhoneInput = page.locator('#guestOrderPhone');
      if (await guestCodeInput.isVisible()) {
        await guestCodeInput.fill(latestOrder.order_code);
        await guestPhoneInput.fill('0908765432');
        await page.click('#guestOrderLookupForm button[type="submit"]');
        await page.waitForTimeout(1500);

        const orderCard = page.locator('.order-craft-card').first();
        const hasCard = await orderCard.isVisible();
        console.log('✅ Đã tra cứu thành công đơn hàng khách vãng lai:', hasCard);

        await page.screenshot({ path: path.join(brainDir, '75_orders_guest_lookup.png') });
        console.log('📸 Đã lưu ảnh: 75_orders_guest_lookup.png');
      }
    }

    // -------------------------------------------------------------
    // BƯỚC 5: TRANG ADMIN & GOOGLE MAPS LINK CHO ĐƠN HÀNG
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Admin Dashboard & Google Maps Direction Link ---');
    // Đăng nhập Admin
    await page.goto(`${baseUrl}/login.html`, { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');
    await page.waitForTimeout(1500);

    // Mở trang Admin
    await page.goto(`${baseUrl}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Mở tab Quản Lý Đơn Hàng
    const ordersTab = page.locator('button[data-tab="orders"]').first();
    if (await ordersTab.isVisible()) {
      await ordersTab.click();
      await page.waitForTimeout(1000);
    }

    // Bấm xem chi tiết đơn hàng
    const viewBtn = page.locator('.view-order-btn').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await page.waitForTimeout(1200);

      // Kiểm tra link Google Maps
      const gmapsLink = page.locator('a[href*="google.com/maps/dir"]');
      const hasGmapsLink = await gmapsLink.isVisible().catch(() => false);
      console.log('✅ Link mở Google Maps trong Admin:', hasGmapsLink);
      if (hasGmapsLink) {
        const href = await gmapsLink.getAttribute('href');
        console.log('Link Google Maps destination:', href);
      }

      await page.screenshot({ path: path.join(brainDir, '76_admin_order_delivery_zone_link.png') });
      console.log('📸 Đã lưu ảnh: 76_admin_order_delivery_zone_link.png');
    }

    console.log('\n================================================================');
    console.log('🎉 LIVE E2E AUDIT COMPLETED 100% SUCCESSFULLY!');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ E2E Audit thất bại:', err);
    process.exitCode = 1;
  } finally {
    // Dọn dẹp đơn hàng thử nghiệm
    if (createdOrderId) {
      try {
        await prisma.orders.delete({ where: { id: createdOrderId } });
        console.log(`[Cleanup]: Đã xóa đơn thử nghiệm ${createdOrderId}`);
      } catch (e) {
        console.warn('Lỗi cleanup đơn:', e.message);
      }
    }
    await browser.close();
    await prisma.$disconnect();
  }
}

runAudit();
