import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/d18f1589-b1b1-44e3-ae1e-098a2a6a4d5d/screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Listen to console logs and errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('Browser Error:', msg.text());
    }
  });

  console.log('--- Step 1: Testing Registration Flow (Fixing CORS) ---');
  await page.goto('http://localhost:5173/register.html', { waitUntil: 'networkidle' });

  const testEmail = `user_${Date.now()}@test.com`;
  await page.fill('#name', 'Nguyễn Văn Test');
  await page.fill('#email', testEmail);
  await page.fill('#password', 'Password123!');
  await page.fill('#confirmPassword', 'Password123!');

  await page.click('#submitBtn');
  await page.waitForTimeout(1500);

  const regScreenshot = path.join(SCREENSHOTS_DIR, 'report_16_register_success_no_cors.png');
  await page.screenshot({ path: regScreenshot, fullPage: true });
  console.log(`Saved screenshot: ${regScreenshot}`);

  console.log('--- Step 2: Testing Detail Page & Buy Now Order (Fixing 400 Bad Request & undefined item) ---');
  // Log in as customer to test verified purchase & clean checkout
  await page.goto('http://localhost:5173/login.html', { waitUntil: 'networkidle' });
  await page.fill('#email', 'customer1@shophoa.example');
  await page.fill('#password', '123456');
  await page.click('#submitBtn');
  await page.waitForTimeout(1500);

  // Navigate to product detail PROD-001
  await page.goto('http://localhost:5173/detail.html?id=PROD-001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check review section on detail page
  const reviewSection = page.locator('#productReviewsSection');
  await reviewSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const detailReviewsScreenshot = path.join(SCREENSHOTS_DIR, 'report_17_detail_verified_review_and_reply.png');
  await page.screenshot({ path: detailReviewsScreenshot });
  console.log(`Saved screenshot: ${detailReviewsScreenshot}`);

  // Test Buy Now modal
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.click('#btnBuyNow');
  await page.waitForTimeout(800);

  // Fill in order details in checkout modal
  const senderPhone = await page.inputValue('#checkoutSenderPhone');
  if (!senderPhone) await page.fill('#checkoutSenderPhone', '0901234567');
  const senderName = await page.inputValue('#checkoutSenderName');
  if (!senderName) await page.fill('#checkoutSenderName', 'Khách Hàng Thân Thiết');
  await page.fill('#checkoutAddress', '123 Đường Hoa Hồng, Phường 1, Quận 1, TP.HCM');
  await page.selectOption('#checkoutDeliverySlot', { index: 1 });

  const checkoutModalScreenshot = path.join(SCREENSHOTS_DIR, 'report_18_checkout_modal_clean_no_undefined.png');
  await page.screenshot({ path: checkoutModalScreenshot });
  console.log(`Saved screenshot: ${checkoutModalScreenshot}`);

  // Submit order via COD
  await page.click('#checkoutSubmitBtn');
  await page.waitForTimeout(2000);

  const orderSuccessScreenshot = path.join(SCREENSHOTS_DIR, 'report_19_order_created_successfully.png');
  await page.screenshot({ path: orderSuccessScreenshot });
  console.log(`Saved screenshot: ${orderSuccessScreenshot}`);

  console.log('--- Step 3: Testing Admin Reviews & Shop Reply Modal ---');
  // Log in as Admin
  await page.goto('http://localhost:5173/login.html', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@shophoa.example');
  await page.fill('#password', 'admin123');
  await page.click('#submitBtn');
  await page.waitForTimeout(1500);

  // Navigate to Admin Reviews Tab
  await page.goto('http://localhost:5173/admin.html?tab=reviews', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open Reply Modal on the first review
  const firstReplyBtn = page.locator('.btn-reply-review').first();
  if (await firstReplyBtn.isVisible()) {
    await firstReplyBtn.click();
    await page.waitForTimeout(500);
    await page.fill('#replyReviewInput', 'Dạ cảm ơn bạn rất nhiều vì đã tin tưởng đặt hoa tại Tiệm Hoa Nhung! Chúc bạn luôn rạng rỡ và hạnh phúc ạ! 🌸');
  }

  const adminReplyModalScreenshot = path.join(SCREENSHOTS_DIR, 'report_20_admin_reply_modal.png');
  await page.screenshot({ path: adminReplyModalScreenshot });
  console.log(`Saved screenshot: ${adminReplyModalScreenshot}`);

  // Confirm reply
  await page.click('#btnConfirmReplyReview');
  await page.waitForTimeout(1500);

  const adminReviewsListScreenshot = path.join(SCREENSHOTS_DIR, 'report_21_admin_reviews_with_shop_replies.png');
  await page.screenshot({ path: adminReviewsListScreenshot });
  console.log(`Saved screenshot: ${adminReviewsListScreenshot}`);

  await browser.close();
  console.log('=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
