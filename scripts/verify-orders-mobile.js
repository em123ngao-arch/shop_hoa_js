import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  
  // 1. Mobile viewport as Guest
  const contextGuest = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const pageGuest = await contextGuest.newPage();

  console.log('--- Navigating to orders.html (Guest Mobile 375x812) ---');
  await pageGuest.goto('http://localhost:4000/orders.html', { waitUntil: 'networkidle' });

  // Capture top
  await pageGuest.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/38_orders_mobile_guest_top.png' });

  // Scroll to show order content
  await pageGuest.evaluate(() => window.scrollBy(0, 320));
  await pageGuest.waitForTimeout(300);
  await pageGuest.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/39_orders_mobile_guest_tabs.png' });

  // Scroll to show the assistance card at the bottom
  await pageGuest.evaluate(() => window.scrollBy(0, 450));
  await pageGuest.waitForTimeout(300);
  await pageGuest.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/40_orders_mobile_assistance_card.png' });

  // 2. Mobile viewport as Logged-in User (Trường)
  const contextUser = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const pageUser = await contextUser.newPage();

  // Set user in localStorage before load
  await pageUser.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({
      id: 'usr-admin-01',
      name: 'Quản Trị Viên Trưởng',
      email: 'admin@shophoa.com',
      phone: '0908889999',
      role: 'admin'
    }));
  });

  console.log('--- Navigating to orders.html (Logged In User Mobile 375x812) ---');
  await pageUser.goto('http://localhost:4000/orders.html', { waitUntil: 'networkidle' });
  await pageUser.waitForTimeout(600);

  // Capture top with logged in header & profile
  await pageUser.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/41_orders_mobile_user_top.png' });

  // Scroll down to check assistance card zoom
  const assistanceCard = await pageUser.$('.assistance-card');
  if (assistanceCard) {
    await assistanceCard.scrollIntoViewIfNeeded();
    await pageUser.waitForTimeout(300);
    await pageUser.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/42_orders_mobile_user_assistance_zoomed.png' });
  }

  await browser.close();
  console.log('All mobile verification screenshots completed.');
})();
