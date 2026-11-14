import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  await page.goto('http://localhost:4000/orders.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/44_orders_desktop_verification.png', fullPage: false });
  await browser.close();
  console.log('Desktop screenshot captured.');
})();

