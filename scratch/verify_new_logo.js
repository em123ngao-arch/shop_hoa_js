const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/66c428cf-d0e1-4650-9770-ff95e6911723';
const BASE_URL = 'http://localhost:4000';

async function verifyLogo() {
  console.log('🚀 Khởi chạy kiểm thử tự động xác minh Logo mới trên hệ thống...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    favicon: false,
    desktopLogo: false,
    mobileLogo: false,
    adminLogo: false,
    loginLogo: false,
    noHorizontalOverflowMobile: false
  };

  try {
    // 1. Kiểm tra Favicon nạp thành công 200 OK
    const faviconRes = await page.goto(`${BASE_URL}/images/favicon-flower.png`);
    if (faviconRes && faviconRes.status() === 200) {
      console.log('✅ Favicon hoa kẽm nhung (240x240): HTTP 200 OK');
      results.favicon = true;
    }

    // 2. Kiểm tra Desktop Header (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });

    const logoImg = page.locator('.header .logo-img');
    await logoImg.waitFor({ state: 'visible', timeout: 5000 });
    const desktopBox = await logoImg.boundingBox();
    console.log(`✅ Desktop Logo hiển thị: width=${Math.round(desktopBox.width)}px, height=${Math.round(desktopBox.height)}px`);
    results.desktopLogo = desktopBox.height >= 38 && desktopBox.height <= 50;

    // Chụp ảnh Desktop Header
    const desktopShotPath = path.join(ARTIFACTS_DIR, 'verify_new_logo_desktop.png');
    await page.screenshot({ path: desktopShotPath, fullPage: false });
    console.log(`📸 Chụp ảnh Desktop: ${desktopShotPath}`);

    // 3. Kiểm tra Mobile Header (375x812) & Chống tràn viền
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
    await logoImg.waitFor({ state: 'visible', timeout: 5000 });
    const mobileBox = await logoImg.boundingBox();
    console.log(`✅ Mobile Logo hiển thị: width=${Math.round(mobileBox.width)}px, height=${Math.round(mobileBox.height)}px`);
    results.mobileLogo = mobileBox.height >= 30 && mobileBox.height <= 40;

    const overflowCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        isClean: doc.scrollWidth <= doc.clientWidth
      };
    });
    console.log(`✅ Mobile scroll check: clientWidth=${overflowCheck.clientWidth}, scrollWidth=${overflowCheck.scrollWidth}, isClean=${overflowCheck.isClean}`);
    results.noHorizontalOverflowMobile = overflowCheck.isClean;

    // Chụp ảnh Mobile
    const mobileShotPath = path.join(ARTIFACTS_DIR, 'verify_new_logo_mobile.png');
    await page.screenshot({ path: mobileShotPath, fullPage: false });
    console.log(`📸 Chụp ảnh Mobile: ${mobileShotPath}`);

    // 4. Kiểm tra Admin Sidebar & Brand Icon (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle' });

    // Bấm Demo Admin để vào dashboard
    const quickDemoBtn = page.locator('#quickDemoBtn');
    if (await quickDemoBtn.isVisible()) {
      await quickDemoBtn.click();
      await page.waitForTimeout(600);
    }

    const adminBrandIcon = page.locator('.sidebar-brand .admin-brand-icon');
    await adminBrandIcon.waitFor({ state: 'visible', timeout: 5000 });
    const adminIconBox = await adminBrandIcon.boundingBox();
    console.log(`✅ Admin Brand Icon hiển thị: width=${Math.round(adminIconBox.width)}px, height=${Math.round(adminIconBox.height)}px`);
    results.adminLogo = adminIconBox.width > 0 && adminIconBox.height > 0;

    // Chụp ảnh Admin
    const adminShotPath = path.join(ARTIFACTS_DIR, 'verify_new_logo_admin.png');
    await page.screenshot({ path: adminShotPath, fullPage: false });
    console.log(`📸 Chụp ảnh Admin: ${adminShotPath}`);

    // 5. Kiểm tra Trang Login (1000x800)
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
    const loginLogoImg = page.locator('.auth-brand-logo-img');
    await loginLogoImg.waitFor({ state: 'visible', timeout: 5000 });
    const loginLogoBox = await loginLogoImg.boundingBox();
    console.log(`✅ Login Logo hiển thị: width=${Math.round(loginLogoBox.width)}px, height=${Math.round(loginLogoBox.height)}px`);
    results.loginLogo = loginLogoBox.width > 0 && loginLogoBox.height > 0;

    const loginShotPath = path.join(ARTIFACTS_DIR, 'verify_new_logo_login.png');
    await page.screenshot({ path: loginShotPath, fullPage: false });
    console.log(`📸 Chụp ảnh Login: ${loginShotPath}`);

    console.log('\n📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ LOGO MỚI:');
    console.table(results);

    const allPassed = Object.values(results).every(Boolean);
    if (allPassed) {
      console.log('🎉 TOÀN BỘ 100% TIÊU CHÍ LOGO MỚI ĐÃ ĐẠT CHUẨN XUẤT SẮC!');
    } else {
      console.warn('⚠️ Có tiêu chí chưa đạt, vui lòng rà soát lại kết quả.');
    }
  } catch (err) {
    console.error('❌ Lỗi trong quá trình kiểm thử:', err);
  } finally {
    await browser.close();
  }
}

verifyLogo();
