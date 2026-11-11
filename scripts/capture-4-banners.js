import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // 1. Chup anh Trang Chu (Homepage Hero Banner)
  console.log('Navigating to homepage...');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const homeScreenshot = 'C:/Users/ADMIN/.gemini/antigravity/brain/d18f1589-b1b1-44e3-ae1e-098a2a6a4d5d/screenshots/homepage_4_banners.png';
  await page.screenshot({ path: homeScreenshot, fullPage: false });
  console.log('Saved homepage screenshot:', homeScreenshot);

  // 2. Chup anh Admin Banner Tab
  console.log('Navigating to admin banner tab with demo=true...');
  await page.goto('http://localhost:4000/admin.html?demo=true', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Click on Banner tab
  console.log('Clicking on Banner tab in admin...');
  const bannerTab = await page.$('.nav-item[data-tab="banners"]');
  if (bannerTab) {
    await bannerTab.click();
    await page.waitForTimeout(1500);
  }

  const adminScreenshot = 'C:/Users/ADMIN/.gemini/antigravity/brain/d18f1589-b1b1-44e3-ae1e-098a2a6a4d5d/screenshots/admin_4_banners.png';
  await page.screenshot({ path: adminScreenshot, fullPage: false });
  console.log('Saved admin screenshot:', adminScreenshot);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(console.error);
