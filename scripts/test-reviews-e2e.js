/**
 * scripts/test-reviews-e2e.js - Playwright E2E Test & Visual Capture cho Hệ thống Đánh Giá Chuẩn TMĐT
 */

import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import app, { stopServer } from '../server.js';
import { container } from '../server/infrastructure/config/container.js';

const prisma = container.prisma;
const ARTIFACTS_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function loginViaUi(page, baseUrl, email, password, expectedDestination) {
  await page.goto(`${baseUrl}/login.html`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL(url => url.toString().includes(expectedDestination), { timeout: 10000 }),
    page.click('#loginForm button[type="submit"]')
  ]);
}

async function runReviewE2E() {
  console.log('================================================================');
  console.log('🧪 RUNNING PLAYWRIGHT E2E TEST SUITE FOR REVIEWS (E-COMMERCE STANDARD)');
  console.log('================================================================\n');

  let serverInstance = null;
  let browser = null;
  let baseUrl = '';
  let testFailed = false;
  let testPhotoTempPath = null;
  const createdImageUrls = new Set();
  const createdNotifStart = new Date();

  try {
    await new Promise((resolve) => {
      serverInstance = app.listen(0, '127.0.0.1', () => {
        const { port } = serverInstance.address();
        baseUrl = `http://127.0.0.1:${port}`;
        console.log(`[E2E Server] Listening at ${baseUrl}`);
        resolve();
      });
    });

    // Tạo 1 ảnh PNG màu hoa hồng pastel hợp lệ qua Sharp để test upload ảnh đánh giá
    testPhotoTempPath = path.join(os.tmpdir(), `shophoa-review-sample-${Date.now()}.png`);
    await sharp({
      create: {
        width: 480,
        height: 360,
        channels: 3,
        background: { r: 244, g: 184, b: 196 }
      }
    }).png().toFile(testPhotoTempPath);

    browser = await chromium.launch({ headless: true });

    // ------------------------------------------------------------------
    // SCENARIO R1: Guest / Khách chưa mua PROD-003 -> Kiểm tra Half-star 3.5, Phân bố sao, Chặn viết review & Nút Hữu ích
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO R1: PROD-003 Half-star 3.5, Distribution & Verified Buyer Only ---');
    const cust2Ctx = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const cust2Page = await cust2Ctx.newPage();

    await loginViaUi(cust2Page, baseUrl, 'customer2@shophoa.example', '123456', 'index.html');
    await cust2Page.goto(`${baseUrl}/detail.html?id=PROD-003#productReviewsSection`, { waitUntil: 'networkidle' });
    await cust2Page.waitForSelector('#productReviewsSection .review-item-card');

    const scoreText = await cust2Page.locator('.reviews-big-score').innerText();
    assert(scoreText.includes('3.5'), `Hiển thị đúng điểm 3.5/5 (Thực tế: ${scoreText})`);

    const fullStars = await cust2Page.locator('.reviews-star-line .star-icon.star-full').count();
    const halfStars = await cust2Page.locator('.reviews-star-line .star-icon.star-half').count();
    const emptyStars = await cust2Page.locator('.reviews-star-line .star-icon.star-empty').count();
    assert(fullStars === 3 && halfStars === 1 && emptyStars === 1, `Hiển thị đúng 3 sao đầy + 1 nửa sao + 1 sao rỗng cho điểm 3.5`);

    const distVisible = await cust2Page.locator('.review-summary-distribution').isVisible();
    assert(distVisible, 'Thanh phân bố sao hiển thị ngay cả khi chỉ có 2 đánh giá');

    const chipCount = await cust2Page.locator('#reviewQuickFilters .review-filter-chip').count();
    assert(chipCount >= 7, 'Cụm lọc nhanh (Tất cả, Có hình ảnh, 5->1 sao) hiển thị đầy đủ');

    const eligibilityNoticeVisible = await cust2Page.locator('.review-eligibility-notice').isVisible();
    const openFormCount = await cust2Page.locator('#btnOpenReviewForm').count();
    assert(eligibilityNoticeVisible && openFormCount === 0, 'Khách chưa hoàn tất mua PROD-003 không được mở form viết đánh giá');

    await cust2Page.locator('#productReviewsSection').scrollIntoViewIfNeeded();
    await cust2Page.waitForTimeout(300);
    await cust2Page.locator('#productReviewsSection').screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_review_section_prod003.png')
    });

    // Test toggle Hữu ích persist trong MySQL
    const firstHelpfulBtn = cust2Page.locator('.btn-review-helpful').first();
    await firstHelpfulBtn.click();
    await cust2Page.waitForFunction(() => document.querySelector('.btn-review-helpful')?.innerText.includes('(1)'));
    assert((await firstHelpfulBtn.innerText()).includes('Đã hữu ích (1)'), 'Bấm Hữu ích cập nhật trạng thái và số đếm (1)');

    await cust2Page.reload({ waitUntil: 'networkidle' });
    await cust2Page.waitForSelector('.btn-review-helpful');
    assert((await cust2Page.locator('.btn-review-helpful').first().innerText()).includes('Đã hữu ích (1)'), 'Trạng thái Hữu ích lưu bền vững sau khi F5');

    // Toggle lại về 0 để giữ DB sạch
    await cust2Page.locator('.btn-review-helpful').first().click();
    await cust2Page.waitForFunction(() => !document.querySelector('.btn-review-helpful')?.innerText.includes('(1)'));
    await cust2Ctx.close();

    // ------------------------------------------------------------------
    // SCENARIO R2: Verified Buyer (customer1) đi từ orders.html -> Viết review kèm ảnh + kiểm tra không bị double-escape + Lightbox + Admin Reply
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO R2: Verified Buyer Orders -> Photo Review -> Lightbox -> Admin Reply ---');
    const cust1Ctx = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const cust1Page = await cust1Ctx.newPage();

    await loginViaUi(cust1Page, baseUrl, 'customer1@shophoa.example', '123456', 'index.html');
    await cust1Page.goto(`${baseUrl}/orders.html`, { waitUntil: 'networkidle' });
    await cust1Page.waitForSelector('.btn-rate-order-item');

    const rateBtn = cust1Page.locator('.btn-rate-order-item').first();
    assert(await rateBtn.isVisible(), 'Đơn đã hoàn thành trên orders.html hiển thị nút "Đánh Giá Hoa"');

    await rateBtn.locator('xpath=ancestor::article').screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_orders_rate_button.png')
    });

    await Promise.all([
      cust1Page.waitForURL(url => url.toString().includes('detail.html?id=PROD-001'), { timeout: 10000 }),
      rateBtn.click()
    ]);

    await cust1Page.waitForSelector('#btnOpenReviewForm');
    await cust1Page.click('#btnOpenReviewForm');
    await cust1Page.waitForSelector('#reviewComposer:not(.hidden)');

    // Hover sao 4 -> check label -> Click sao 5
    await cust1Page.locator('.star-picker-btn[data-rating="4"]').hover();
    assert((await cust1Page.locator('#starPickerLabel').innerText()).includes('Hài lòng'), 'Hover sao 4 hiện nhãn "Hài lòng"');
    await cust1Page.locator('.star-picker-btn[data-rating="5"]').click();
    assert((await cust1Page.locator('#starPickerLabel').innerText()).includes('Tuyệt vời'), 'Chọn sao 5 hiện nhãn "Tuyệt vời"');

    const reviewText = 'Hoa "tulip kẽm nhung" rất đẹp & giao đúng hẹn, \'cực kỳ ưng ý\'!';
    await cust1Page.fill('#reviewCommentInput', reviewText);
    assert((await cust1Page.locator('#reviewCharCounter').innerText()).includes('/ 1200'), 'Bộ đếm ký tự cập nhật theo thời gian thực');

    await cust1Page.setInputFiles('#reviewPhotoInput', testPhotoTempPath);
    await cust1Page.waitForSelector('.review-photo-preview-item img');
    assert((await cust1Page.locator('.review-photo-preview-item').count()) === 1, 'Upload ảnh hiển thị preview trong khung soạn');

    await cust1Page.locator('#reviewComposer').scrollIntoViewIfNeeded();
    await cust1Page.waitForTimeout(250);
    await cust1Page.locator('#reviewComposer').screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_review_composer.png')
    });

    await cust1Page.click('#btnSubmitReview');
    await cust1Page.waitForSelector('#productReviewsSection .review-photo-thumb-btn');

    const savedReviewRow = await prisma.reviews.findUnique({
      where: { product_id_user_id: { product_id: 'PROD-001', user_id: 'USR-CUST-01' } }
    });
    assert(Boolean(savedReviewRow), 'Review mới được lưu vào MySQL');
    const savedImgs = JSON.parse(savedReviewRow.images_json || '[]');
    savedImgs.forEach(u => createdImageUrls.add(u));
    assert(savedImgs.length === 1 && savedImgs[0].startsWith('/uploads/reviews/rev-'), 'Ảnh review lưu chuẩn đường dẫn /uploads/reviews/rev-*.webp');

    const renderedBodyText = await cust1Page.locator(`.review-item-card[data-review-id="${savedReviewRow.id}"] .review-comment-body`).innerText();
    assert(renderedBodyText === reviewText, `Không bị double-escape dấu nháy và dấu & (Thực tế: ${renderedBodyText})`);

    await cust1Page.locator('#productReviewsSection').evaluate(el => {
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo(0, Math.max(0, top));
    });
    await cust1Page.waitForTimeout(250);
    await cust1Page.locator('#productReviewsSection').screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_review_with_photo_prod001.png')
    });

    // Click ảnh mở Lightbox
    await cust1Page.locator(`.review-item-card[data-review-id="${savedReviewRow.id}"] .review-photo-thumb-btn`).first().click();
    await cust1Page.waitForSelector('#reviewLightboxModal:not(.hidden)');
    assert(await cust1Page.locator('#reviewLightboxImg').isVisible(), 'Bấm ảnh đánh giá mở hộp xem ảnh lớn (Lightbox)');
    await cust1Page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_review_lightbox.png')
    });
    await cust1Page.click('#btnCloseReviewLightbox');
    await cust1Page.waitForSelector('#reviewLightboxModal.hidden', { state: 'attached' });

    // Kiểm tra nút Sửa đánh giá không bị double-escape trong textarea
    await cust1Page.click('#btnOpenReviewForm');
    const textareaVal = await cust1Page.inputValue('#reviewCommentInput');
    assert(textareaVal === reviewText, 'Mở lại form Sửa đánh giá giữ nguyên dấu nháy chuẩn, không hiện &quot;');
    await cust1Ctx.close();

    // ------------------------------------------------------------------
    // SCENARIO R3: Admin Reviews Tab (Lọc, Ảnh, Mẫu trả lời nhanh & Thông báo)
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO R3: Admin Reviews Tab, Photo Preview & Quick Reply ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
    const adminPage = await adminCtx.newPage();
    await loginViaUi(adminPage, baseUrl, 'admin@shophoa.example', 'admin123', 'admin.html');

    await adminPage.click('.nav-item[data-tab="reviews"]');
    await adminPage.waitForSelector('#reviewsTableBody tr[data-id]');
    await adminPage.selectOption('#reviewStatusFilter', 'unreplied');
    await adminPage.waitForTimeout(250);

    const targetReplyBtn = adminPage.locator(`#reviewsTableBody tr[data-id="${savedReviewRow.id}"] .btn-reply-review`);
    assert(await targetReplyBtn.isVisible(), 'Bộ lọc "Chưa phản hồi" ở Admin hiển thị đúng đánh giá mới');

    await targetReplyBtn.click();
    await adminPage.waitForSelector('#replyReviewModal:not(.hidden)');
    await adminPage.locator('.btn-quick-reply-chip').first().click();
    const filledReply = await adminPage.inputValue('#replyReviewInput');
    assert(filledReply.includes('Tiệm Hoa Kẽm Nhung'), 'Nút mẫu trả lời nhanh điền đúng nội dung phản hồi vào modal Admin');

    await adminPage.click('#btnConfirmReplyReview');
    await adminPage.waitForSelector('#replyReviewModal.hidden', { state: 'attached' });
    await adminPage.selectOption('#reviewStatusFilter', 'all');
    await adminPage.waitForSelector(`#reviewsTableBody tr[data-id="${savedReviewRow.id}"]`);
    await adminPage.locator('#panel-reviews').screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_admin_reviews_tab.png')
    });

    const replyNotif = await prisma.notifications.findFirst({
      where: {
        user_id: 'USR-CUST-01',
        order_id: null,
        created_at: { gte: createdNotifStart }
      }
    });
    assert(Boolean(replyNotif), 'Admin phản hồi đánh giá tự động sinh thông báo cho khách hàng');

    // ------------------------------------------------------------------
    // SCENARIO R4: Admin trả lời trực tiếp trên detail.html & Người dùng phản hồi qua lại
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO R4: Admin Direct Reply & Two-Way User Comments on detail.html ---');
    await adminPage.goto(`${baseUrl}/detail.html?id=PROD-001#productReviewsSection`, { waitUntil: 'networkidle' });
    await adminPage.waitForSelector('.review-admin-mode-pill');
    assert(await adminPage.locator('.review-admin-mode-notice').isVisible(), 'Admin trên trang sản phẩm thấy chế độ Quản trị viên trả lời trực tiếp');

    const cardOnAdminPage = adminPage.locator(`.review-item-card[data-review-id="${savedReviewRow.id}"]`);
    await cardOnAdminPage.locator('.btn-review-official-reply').click();
    await adminPage.waitForSelector(`#officialReplyComposer-${savedReviewRow.id}`);
    await adminPage.fill(`#officialReplyInput-${savedReviewRow.id}`, 'Cảm ơn chị Mai đã gửi ảnh thực tế rất đẹp cho mẫu Tulip Pastel!');
    await adminPage.click(`[data-save-official="${savedReviewRow.id}"]`);
    await adminPage.waitForFunction((rid) => {
      const card = document.querySelector(`.review-item-card[data-review-id="${rid}"]`);
      return card && card.querySelector('.shop-reply-content')?.textContent.includes('Cảm ơn chị Mai');
    }, savedReviewRow.id);
    assert(true, 'Admin sửa/gửi phản hồi chính thức trực tiếp ngay trên trang chi tiết sản phẩm');

    await cardOnAdminPage.locator('.btn-review-reply-thread').click();
    await adminPage.waitForSelector(`#threadReplyInput-${savedReviewRow.id}`);
    await adminPage.fill(`#threadReplyInput-${savedReviewRow.id}`, 'Shop gửi tặng kèm thiệp viết tay miễn phí cho đơn sau của chị nhé!');
    await adminPage.click(`[data-save-thread="${savedReviewRow.id}"]`);
    await adminPage.waitForSelector(`.review-item-card[data-review-id="${savedReviewRow.id}"] .thread-badge-admin`);
    assert(true, 'Admin gửi bình luận trao đổi trực tiếp kèm huy hiệu Quản Trị Viên');
    await adminCtx.close();

    // Khách hàng khác (customer2) vào phản hồi qua lại
    const cust2ReplyCtx = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const cust2ReplyPage = await cust2ReplyCtx.newPage();
    await loginViaUi(cust2ReplyPage, baseUrl, 'customer2@shophoa.example', '123456', 'index.html');
    await cust2ReplyPage.goto(`${baseUrl}/detail.html?id=PROD-001#productReviewsSection`, { waitUntil: 'networkidle' });
    await cust2ReplyPage.waitForSelector(`.review-item-card[data-review-id="${savedReviewRow.id}"] .btn-review-reply-thread`);

    await cust2ReplyPage.click(`.review-item-card[data-review-id="${savedReviewRow.id}"] .btn-review-reply-thread`);
    await cust2ReplyPage.fill(`#threadReplyInput-${savedReviewRow.id}`, 'Mình cũng từng đặt mẫu này tặng bạn gái, kẽm nhung mềm mịn giữ bền màu lắm!');
    await cust2ReplyPage.click(`[data-save-thread="${savedReviewRow.id}"]`);
    await cust2ReplyPage.waitForFunction((rid) => {
      const card = document.querySelector(`.review-item-card[data-review-id="${rid}"]`);
      return card && card.querySelectorAll('.review-thread-item').length >= 2;
    }, savedReviewRow.id);
    assert(true, 'Khách hàng khác phản hồi vào đánh giá thành công');

    await cust2ReplyPage.locator(`.review-item-card[data-review-id="${savedReviewRow.id}"]`).scrollIntoViewIfNeeded();
    await cust2ReplyPage.waitForTimeout(250);
    await cust2ReplyPage.locator(`.review-item-card[data-review-id="${savedReviewRow.id}"]`).screenshot({
      path: path.join(ARTIFACTS_DIR, 'after_review_two_way_admin_and_users.png')
    });
    await cust2ReplyCtx.close();

    console.log('\n🎉 ALL REVIEW E2E SCENARIOS PASSED 100%!');
  } catch (err) {
    console.error('\n❌ Review E2E Failed:', err);
    testFailed = true;
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (testPhotoTempPath && fs.existsSync(testPhotoTempPath)) {
      try { fs.unlinkSync(testPhotoTempPath); } catch {}
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.reviews.deleteMany({
          where: { product_id: 'PROD-001', user_id: 'USR-CUST-01' }
        });
        await tx.notifications.deleteMany({
          where: {
            user_id: 'USR-CUST-01',
            order_id: null,
            created_at: { gte: createdNotifStart }
          }
        });
      });
      for (const relUrl of createdImageUrls) {
        if (typeof relUrl === 'string' && relUrl.startsWith('/uploads/reviews/')) {
          const full = path.resolve(process.cwd(), relUrl.replace(/^\//, ''));
          if (fs.existsSync(full)) fs.unlinkSync(full);
        }
      }
      console.log('🧹 Đã dọn dẹp sạch review test, notification test và ảnh test.');
    } catch (cleanupErr) {
      console.error('Lỗi cleanup E2E:', cleanupErr.message);
      testFailed = true;
    }

    stopServer();
    if (serverInstance) serverInstance.close();
    await prisma.$disconnect();
    process.exit(testFailed || process.exitCode ? (process.exitCode || 1) : 0);
  }
}

runReviewE2E();

