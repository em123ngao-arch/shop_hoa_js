import { chromium } from 'playwright';

async function testFilterDebug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:4000/index.html#products?price=200-300&color=cam');
  await page.goto('http://localhost:4000/index.html#products?price=200-300&color=cam');
  await page.waitForTimeout(2000);

  const productCount = await page.$eval('#productCount', el => el.textContent);
  console.log('Product Count on page:', productCount);

  const activeTags = await page.$$eval('.active-filter-tag', els => els.map(e => e.textContent.trim()));
  console.log('Active Filter Tags:', activeTags);

  const checkedPrice = await page.$$eval('input[name="sidebarPrice"]', els => {
    const checked = els.find(e => e.checked);
    return checked ? checked.value : 'none';
  });
  console.log('Checked sidebar price:', checkedPrice);

  const activeColor = await page.$$eval('.sidebar-color-btn.active', els => els.map(e => e.dataset.color));
  console.log('Active sidebar color button:', activeColor);

  const productTitles = await page.$$eval('.card-product-title', els => els.map(e => e.textContent.trim()));
  console.log('Rendered product titles (first 4):', productTitles.slice(0, 4));

  await browser.close();
}

testFilterDebug().catch(console.error);

