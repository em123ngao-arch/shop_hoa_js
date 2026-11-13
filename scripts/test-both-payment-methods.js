import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPayments() {
  console.log('================================================================');
  console.log('TEST COMPLETE PAYMENT WORKFLOW: COD & SEPAY VIETQR');
  console.log('================================================================\n');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
  });

  // ============================================================================
  // TEST 1: THANH TOÁN TIỀN MẶT KHI NHẬN HOA (COD)
  // ============================================================================
  console.log('--- TEST 1: THANH TOÁN TIỀN MẶT KHI NHẬN HOA (COD) ---');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Click Thêm Nhanh vào giỏ
  const quickAddBtn = page.locator('.quick-add-btn').first();
  await quickAddBtn.click();
  await page.waitForTimeout(1000);

  // Mở Checkout từ Cart Drawer
  const drawerCheckoutBtn = page.locator('#drawerCheckoutBtn');
  await drawerCheckoutBtn.click();
  await page.waitForTimeout(1000);

  // Điền form đặt hàng COD
  await page.fill('#checkoutSenderName', 'Khách Thử Nghiệm COD');
  await page.fill('#checkoutSenderPhone', '0911223344');
  await page.fill('#checkoutAddress', '789 Đường Hoa Mai, Quận 3, TP.HCM');

  // Chọn thanh toán COD
  const codLabel = page.locator('#labelPaymentCod');
  if (await codLabel.count() > 0) await codLabel.click();

  // Bấm Đặt Hàng Ngay
  await page.click('#checkoutSubmitBtn');
  await page.waitForTimeout(3000);

  // Kiểm tra màn hình thành công
  const successVisible = await page.locator('#checkoutStepSuccess').isVisible();
  const codOrderId = (await page.locator('#successOrderId').textContent()).trim();
  const codTotal = (await page.locator('#successTotalAmount').textContent()).trim();
  console.log('Màn hình đặt hàng COD thành công:', successVisible);
  console.log('Mã đơn hàng COD:', codOrderId);
  console.log('Tổng thanh toán:', codTotal);

  if (!successVisible || !codOrderId.startsWith('#DH')) {
    throw new Error('Thanh toán COD thất bại!');
  }
  console.log('✅ TEST 1 (COD): THÀNH CÔNG 100%!\n');

  // ============================================================================
  // TEST 2: THANH TOÁN CHUYỂN KHOẢN TỰ ĐỘNG VIETQR SEPAY
  // ============================================================================
  console.log('--- TEST 2: THANH TOÁN CHUYỂN KHOẢN VIETQR SEPAY ---');
  await page.goto('http://localhost:4000/detail.html?id=PROD-002', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Bấm Mua Ngay
  await page.click('#btnBuyNow');
  await page.waitForTimeout(1000);

  // Điền form thông tin nhận hoa
  await page.fill('#checkoutSenderName', 'Khách Thử Nghiệm VietQR');
  await page.fill('#checkoutSenderPhone', '0988998877');
  await page.fill('#checkoutAddress', '12 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM');

  // Chọn phương thức SePay VietQR
  const sepayLabel = page.locator('#labelPaymentSepay');
  if (await sepayLabel.count() > 0) await sepayLabel.click();

  // Bấm Tiếp Tục Thanh Toán VietQR
  await page.click('#checkoutSubmitBtn');
  await page.waitForTimeout(2500);

  // Kiểm tra Step 2 (Màn hình quét VietQR) hiển thị
  const stepSepayVisible = await page.locator('#checkoutStepSepay').isVisible();
  console.log('Màn hình quét mã VietQR (#checkoutStepSepay) hiển thị:', stepSepayVisible);

  const qrSrc = await page.locator('#sepayQrImage').getAttribute('src');
  console.log('URL Ảnh VietQR sinh tự động:', qrSrc.slice(0, 65) + '...');

  const transferContent = await page.locator('#sepayTransferContent').textContent();
  const bankAccount = await page.locator('#sepayAccountNumber').textContent();
  console.log('Số tài khoản đích:', bankAccount);
  console.log('Cú pháp chuyển khoản:', transferContent.trim());

  if (!stepSepayVisible || !qrSrc.includes('sepay.vn')) {
    throw new Error('Màn hình VietQR SePay không hiển thị hoặc URL ảnh QR bị lỗi!');
  }

  // Bấm nút "Mô Phỏng Thanh Toán Thành Công"
  console.log('Bấm nút "#btnSimulateSepayPaid" để giả lập giao dịch chuyển khoản thành công...');
  const simulateBtn = page.locator('#btnSimulateSepayPaid');
  await simulateBtn.click();
  await page.waitForTimeout(3000);

  // Kiểm tra màn hình thành công sau khi chuyển khoản
  const sepaySuccessVisible = await page.locator('#checkoutStepSuccess').isVisible();
  const sepayOrderId = (await page.locator('#successOrderId').textContent()).trim();
  const sepayPaymentMethodText = (await page.locator('#successPaymentMethod').textContent()).trim();
  console.log('Chuyển sang màn hình thành công:', sepaySuccessVisible);
  console.log('Mã đơn SePay:', sepayOrderId);
  console.log('Trạng thái phương thức:', sepayPaymentMethodText);

  if (!sepaySuccessVisible || !sepayPaymentMethodText.includes('SePay')) {
    throw new Error('Mô phỏng thanh toán SePay thất bại!');
  }

  // Đối soát trong CSDL MySQL
  const cleanOrderCode = sepayOrderId.replace('#', '');
  const dbOrder = await prisma.orders.findFirst({
    where: { order_code: cleanOrderCode },
    include: { payment_transactions: true }
  });

  console.log('\n--- ĐỐI SOÁT DỮ LIỆU CSDL MYSQL ---');
  console.log('Mã đơn trong MySQL:', dbOrder?.order_code);
  console.log('Trạng thái đơn (Status):', dbOrder?.status);
  console.log('Trạng thái thanh toán (PaymentStatus):', dbOrder?.payment_status);
  console.log('Phương thức thanh toán:', dbOrder?.payment_method);
  console.log('Số giao dịch thanh toán:', dbOrder?.payment_transactions?.length);

  if (dbOrder?.status !== 'confirmed' || dbOrder?.payment_status !== 'paid') {
    throw new Error('Trạng thái đơn hàng trong MySQL không khớp (Kỳ vọng: status="confirmed", payment_status="paid")!');
  }

  console.log('\n================================================================');
  console.log('🎉 TOÀN BỘ 2 LUỒNG THANH TOÁN (COD & VIETQR SEPAY) ĐẠT CHUẨN 100%!');
  console.log('================================================================\n');

  await browser.close();
  await prisma.$disconnect();
}

testPayments().catch(async (err) => {
  console.error('❌ LỖI KIỂM THỬ THANH TOÁN:', err);
  await prisma.$disconnect();
  process.exit(1);
});
