import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Capture slide 1
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/52_desktop_banner_slide_1.png' });

  // Next slide (20/11)
  const nextBtn = await page.$('#heroNextBtn');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/53_desktop_banner_slide_2_20_11.png' });
  }

  await browser.close();
  console.log('Desktop banner screenshots captured.');
})();

