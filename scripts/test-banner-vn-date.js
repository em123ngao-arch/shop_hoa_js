import { chromium } from 'playwright';

async function testBannerVnDate() {
  console.log('🚀 Starting Banner Vietnamese Date Picker test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Đăng nhập qua login.html để có session admin đầy đủ
    console.log('Logging in via login.html...');
    await page.goto('http://localhost:4000/login.html');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');
    await page.waitForURL('**/admin.html*', { timeout: 8000 });
    console.log('Logged in successfully!');

    // 2. Chuyển sang tab Banners
    await page.waitForSelector('.nav-item[data-tab="banners"]', { timeout: 10000 });
    const bannerNav = await page.$('.nav-item[data-tab="banners"]');
    if (bannerNav) {
      console.log('Navigating to Banners tab...');
      await bannerNav.click();
      await page.waitForTimeout(1000);
    }

    // Đợi bảng banner tải xong
    await page.waitForSelector('#adminBannersTable', { timeout: 10000 });
    console.log('Waiting for banner rows...');
    await page.waitForSelector('.edit-banner-btn', { timeout: 10000 });

    // 3. Mở Modal Chỉnh Sửa Banner đầu tiên
    const firstEditBtn = await page.$('.edit-banner-btn');
    if (firstEditBtn) {
      console.log('Clicking edit banner button...');
      await firstEditBtn.click();
      await page.waitForSelector('#bannerModal:not(.hidden)');
      await page.waitForTimeout(500);

      // Kiểm tra 2 ô input ngày
      const startDateVal = await page.$eval('#bannerStartDateInput', el => el.value);
      const endDateVal = await page.$eval('#bannerEndDateInput', el => el.value);
      console.log('Banner Start Date in Modal:', startDateVal);
      console.log('Banner End Date in Modal:', endDateVal);

      // Thử nhập ngày mới theo chuẩn dd/mm/yyyy
      await page.fill('#bannerStartDateInput', '18/11/2026');
      await page.fill('#bannerEndDateInput', '20/11/2026');

      // Blur để kiểm tra sync
      await page.$eval('#bannerStartDateInput', el => el.blur());
      await page.$eval('#bannerEndDateInput', el => el.blur());

      const syncedStartPicker = await page.$eval('#bannerStartDatePicker', el => el.value);
      const syncedEndPicker = await page.$eval('#bannerEndDatePicker', el => el.value);
      console.log('Synced hidden picker start:', syncedStartPicker);
      console.log('Synced hidden picker end:', syncedEndPicker);

      if (syncedStartPicker !== '2026-11-18' || syncedEndPicker !== '2026-11-20') {
        throw new Error(`Sync to hidden picker failed! Expected 2026-11-18 and 2026-11-20, got ${syncedStartPicker} and ${syncedEndPicker}`);
      }

      // Chụp ảnh bằng chứng trực quan cho user
      await page.screenshot({
        path: 'C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3/91_banner_modal_vn_date_verified.png'
      });
      console.log('Saved screenshot: 91_banner_modal_vn_date_verified.png');

      // Click Lưu Banner để kiểm tra lưu vào DB và hiển thị bảng Admin
      console.log('Saving banner with dates 18/11/2026 -> 20/11/2026...');
      await page.click('#bannerSubmitBtn');
      await page.waitForTimeout(1500);

      // Kiểm tra cột Lịch Chạy trong bảng Admin
      const tableText = await page.$eval('#adminBannersTable', el => el.innerText);
      console.log('Admin Banners Table Text snippet:\n', tableText.slice(0, 300));

      if (tableText.includes('18/11/2026')) {
        console.log('✅ Banner schedule column successfully displays Vietnamese date 18/11/2026!');
      } else {
        throw new Error('Table did not display 18/11/2026!');
      }

      // Chụp màn hình bảng Admin có badge ngày chuẩn VN
      await page.screenshot({
        path: 'C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3/92_banner_table_vn_date_verified.png'
      });
      console.log('Saved screenshot: 92_banner_table_vn_date_verified.png');
      await page.waitForTimeout(400);
      console.log('✅ Modal date inputs and dual-sync verified successfully!');
    }

    console.log('🎉 ALL BANNER VN DATE TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testBannerVnDate();
