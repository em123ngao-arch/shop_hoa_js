import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  console.log('--- Navigating to index.html on mobile (375x812) ---');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Capture slide 1
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/48_fixed_hero_slide_1.png' });

  // Click next button to see slide 2 (20/11)
  const nextBtn = await page.$('#heroNextBtn');
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/49_fixed_hero_slide_2_20_11.png' });

    // Slide 3 (350.webp pink flower)
    await nextBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/50_fixed_hero_slide_3_pink.png' });

    // Slide 4 (300.webp orange flower)
    await nextBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/51_fixed_hero_slide_4_orange.png' });
  }

  await browser.close();
  console.log('All fixed banner screenshots captured.');
})();
