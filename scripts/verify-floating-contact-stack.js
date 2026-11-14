import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('--- 1. Testing index.html ---');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });

  const stack = await page.$('#floatingContactStack');
  const btnHotline = await page.$('.btn-hotline-call');
  const btnZalo = await page.$('.btn-zalo-chat');
  const btnMessenger = await page.$('.btn-messenger-chat');
  const btnAi = await page.$('#chatLauncherBtn');

  console.log('Stack visible:', await stack.isVisible());
  console.log('Hotline visible:', await btnHotline.isVisible());
  console.log('Zalo visible:', await btnZalo.isVisible());
  console.log('Messenger visible:', await btnMessenger.isVisible());
  console.log('AI visible:', await btnAi.isVisible());

  // Check hrefs
  const hotlineHref = await btnHotline.getAttribute('href');
  const zaloHref = await btnZalo.getAttribute('href');
  const messengerHref = await btnMessenger.getAttribute('href');
  console.log('Hotline href:', hotlineHref);
  console.log('Zalo href:', zaloHref);
  console.log('Messenger href:', messengerHref);

  // Take screenshot of index.html bottom right
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/17_floating_contact_stack_visible.png' });

  // Hover on Zalo to test tooltip
  const zaloItem = await page.$('.contact-stack-item:has(.btn-zalo-chat)');
  if (zaloItem) {
    await zaloItem.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/18_floating_contact_tooltip_hover.png' });
  }

  // Click AI Em Ly to open chat window
  await btnAi.click();
  await page.waitForTimeout(400);
  const chatWindow = await page.$('#chatWindow');
  const chatWindowVisible = await chatWindow.isVisible();
  console.log('Chat window visible after click:', chatWindowVisible);
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/19_floating_contact_chat_window_open.png' });

  // Close chat window
  const closeBtn = await page.$('#chatCloseBtn');
  await closeBtn.click();
  await page.waitForTimeout(300);
  console.log('Chat window visible after close:', await chatWindow.isVisible());

  console.log('--- 2. Testing detail.html ---');
  await page.goto('http://localhost:4000/detail.html?id=PROD-011', { waitUntil: 'networkidle' });
  const detailStack = await page.$('#floatingContactStack');
  console.log('Detail page stack visible:', await detailStack.isVisible());
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/20_detail_page_contact_stack.png' });

  console.log('--- 3. Testing mobile viewport ---');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/21_mobile_contact_stack.png' });

  await browser.close();
  console.log('ALL CHECKS COMPLETED SUCCESSFULLY!');
})();

