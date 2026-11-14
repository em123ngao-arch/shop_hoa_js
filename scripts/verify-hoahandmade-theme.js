import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';
const BASE_URL = 'http://localhost:4000';

async function main() {
  console.log('[Playwright] Starting visual audit for hoahandmade.vn UI/UX upgrade...');
  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP VIEW AUDIT (1366 x 800)
    // -------------------------------------------------------------
    console.log('[Audit 1] Desktop Home & 3-Tier Header & Mega Menu...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1366, height: 800 },
      deviceScaleFactor: 2
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });

    // Wait for products to load
    await desktopPage.waitForSelector('.product-card');

    // Screenshot 1: Desktop Header 3 Tầng + Hero + 2-Column Catalog
    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, '28_desktop_hoahandmade_overview.png'),
      fullPage: false
    });
    console.log('Saved 28_desktop_hoahandmade_overview.png');

    // Hover over "MÀU SẮC" in Mega Nav to show color dots dropdown
    const colorDropdown = desktopPage.locator('.has-dropdown').filter({ hasText: 'MÀU SẮC' });
    await colorDropdown.hover();
    await desktopPage.waitForTimeout(400);

    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, '29_desktop_mega_menu_colors_hover.png'),
      clip: { x: 0, y: 0, width: 1366, height: 480 }
    });
    console.log('Saved 29_desktop_mega_menu_colors_hover.png');

    // Scroll down to 2-Column Catalog
    const catalogSection = desktopPage.locator('#products');
    await catalogSection.scrollIntoViewIfNeeded();
    await desktopPage.waitForTimeout(400);

    // Screenshot 3: 2-Column Catalog Layout (Sidebar 7 price tiers + Grid + Online price + Quick Add)
    await catalogSection.screenshot({
      path: path.join(ARTIFACTS_DIR, '30_desktop_2column_catalog_layout.png')
    });
    console.log('Saved 30_desktop_2column_catalog_layout.png');

    // Click "Màu Cam" on Sidebar
    const orangeColorBtn = desktopPage.locator('.sidebar-color-btn[data-color="cam"]');
    if (await orangeColorBtn.isVisible()) {
      await orangeColorBtn.click();
      await desktopPage.waitForTimeout(500);

      // Screenshot 4: Active tag for color cam + filtered products
      await catalogSection.screenshot({
        path: path.join(ARTIFACTS_DIR, '31_desktop_filter_cam_active_tags.png')
      });
      console.log('Saved 31_desktop_filter_cam_active_tags.png');
    }

    // -------------------------------------------------------------
    // 2. MOBILE VIEW AUDIT (375 x 812 - iPhone X/12/13)
    // -------------------------------------------------------------
    console.log('[Audit 2] Mobile Viewport & Navigation Drawer...');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
    await mobilePage.waitForSelector('.product-card');

    // Screenshot 5: Mobile Home Overview (Clean Header + Hamburger + 3-Button Mini Contact Stack at bottom-right)
    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, '32_mobile_home_clean_header_contact_stack.png'),
      fullPage: false
    });
    console.log('Saved 32_mobile_home_clean_header_contact_stack.png');

    // Click Hamburger Button to open Mobile Navigation Drawer
    const hamburgerBtn = mobilePage.locator('#mobileHamburgerBtn');
    await hamburgerBtn.click();
    await mobilePage.waitForTimeout(500);

    // Open accordion "MÀU SẮC" and "CHẤT LIỆU" inside Drawer
    const colorAccordionBtn = mobilePage.locator('.drawer-accordion-group').filter({ hasText: 'MÀU SẮC' }).locator('.drawer-accordion-btn');
    if (await colorAccordionBtn.isVisible()) {
      await colorAccordionBtn.click();
      await mobilePage.waitForTimeout(300);
    }

    // Screenshot 6: Mobile Navigation Drawer (matching hoahandmade Image 2)
    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, '33_mobile_navigation_drawer_open.png'),
      fullPage: false
    });
    console.log('Saved 33_mobile_navigation_drawer_open.png');

    // Close drawer
    const closeDrawerBtn = mobilePage.locator('#closeDrawerBtn');
    if (await closeDrawerBtn.isVisible()) {
      await closeDrawerBtn.click();
      await mobilePage.waitForTimeout(300);
    }

    // Scroll to products on mobile and open Mobile Filter Drawer
    await mobilePage.locator('#products').scrollIntoViewIfNeeded();
    await mobilePage.waitForTimeout(300);

    const openFilterBtn = mobilePage.locator('#btnOpenMobileFilter');
    if (await openFilterBtn.isVisible()) {
      await openFilterBtn.click();
      await mobilePage.waitForTimeout(400);

      // Screenshot 7: Mobile Filter Sidebar Drawer
      await mobilePage.screenshot({
        path: path.join(ARTIFACTS_DIR, '34_mobile_filter_sidebar_drawer.png'),
        fullPage: false
      });
      console.log('Saved 34_mobile_filter_sidebar_drawer.png');
    }

    console.log('All 7 visual audit screenshots successfully generated!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[Error in visual audit]:', err);
  process.exit(1);
});
