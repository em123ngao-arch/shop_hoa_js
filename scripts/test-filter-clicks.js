import { chromium } from 'playwright';

async function testFilterClicks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:4000/index.html');
  await page.goto('http://localhost:4000/index.html');
  await page.waitForTimeout(2000);

  // Click price label
  console.log('Clicking price label 200-300...');
  await page.locator('#sidebarPriceOptions label:has-text("Từ 200.000đ - 300.000đ")').click();
  await page.waitForTimeout(500);

  // Click color cam button
  console.log('Clicking color cam button...');
  await page.locator('.sidebar-color-btn[data-color="cam"]').click();
  await page.waitForTimeout(500);

  const productCount = await page.$eval('#productCount', el => el.textContent);
  console.log('Product Count on page:', productCount);

  const activeTags = await page.$$eval('.active-filter-tag', els => els.map(e => e.textContent.trim()));
  console.log('Active Filter Tags:', activeTags);

  const url = page.url();
  console.log('Current URL in browser:', url);

  const emptyStateVisible = await page.$eval('#emptyProductState', el => !el.classList.contains('hidden'));
  console.log('Empty state visible:', emptyStateVisible);

  const renderedCardsCount = await page.$$eval('#productList .card', els => els.length);
  console.log('Rendered cards count in #productList:', renderedCardsCount);

  await browser.close();
}

testFilterClicks().catch(console.error);
