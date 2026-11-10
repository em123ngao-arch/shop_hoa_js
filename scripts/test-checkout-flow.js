import { chromium } from 'playwright';

async function main() {
  console.log('=== TEST REAL CHECKOUT FLOW IN BROWSER ===');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGE ERROR] ${err.message}`));
  page.on('response', res => {
    if (res.status() >= 400) console.error(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
  });

  // Step 1: Open index.html
  console.log('1. Loading homepage...');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Clear cart
  await page.evaluate(() => localStorage.removeItem('SHOP_HOA_CART'));

  // Step 2: Click "Thêm Nhanh" (quick-add-btn) on first product card
  console.log('2. Clicking "Thêm Nhanh" on first product card...');
  const quickAddBtn = await page.$('.product-card:first-child .quick-add-btn');
  if (!quickAddBtn) throw new Error('Could not find .quick-add-btn on first product card!');
  await quickAddBtn.click();
  console.log('Clicked "Thêm Nhanh" button.');
  await page.waitForTimeout(1500);

  // Check Cart Drawer
  const cartDrawer = await page.$('#cartDrawer');
  const isOpen = await cartDrawer.evaluate(el => el.classList.contains('open'));
  console.log('Is Cart Drawer Open:', isOpen);

  // Step 3: Click Checkout button in Cart Drawer
  console.log('3. Clicking "#drawerCheckoutBtn" in Cart Drawer...');
  const drawerCheckoutBtn = await page.$('#drawerCheckoutBtn');
  if (!drawerCheckoutBtn) throw new Error('Could not find #drawerCheckoutBtn!');
  await drawerCheckoutBtn.click();
  await page.waitForTimeout(1500);

  // Step 4: Check if Checkout Modal is open
  const checkoutModal = await page.$('#checkoutModal');
  const isModalOpen = await checkoutModal.evaluate(el => !el.classList.contains('hidden'));
  console.log('Is Checkout Modal Open:', isModalOpen);

  // Step 5: Fill in Checkout Form
  console.log('4. Filling in customer details...');
  await page.fill('#checkoutSenderName', 'Nguyễn Thị Hoa Khách');
  await page.fill('#checkoutSenderPhone', '0912345678');
  await page.fill('#checkoutAddress', '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM');

  // Select COD Payment
  const codRadio = await page.$('input[name="paymentMethod"][value="cod"]');
  if (codRadio) await codRadio.click();

  // Step 6: Submit Checkout Form
  console.log('5. Clicking Submit Order (#checkoutSubmitBtn)...');
  await page.click('#checkoutSubmitBtn');
  await page.waitForTimeout(3000);

  // Step 7: Check if Success Step is visible
  const successStep = await page.$('#checkoutStepSuccess');
  const isSuccessVisible = await successStep.evaluate(el => !el.classList.contains('hidden'));
  console.log('Is Success Step Visible:', isSuccessVisible);

  if (isSuccessVisible) {
    const successCode = await page.$eval('#successOrderCode', el => el.textContent.trim());
    console.log('✅ ORDER PLACED SUCCESSFULLY! Code:', successCode);
  } else {
    console.error('❌ Order submission did not show success step!');
  }

  await browser.close();
  console.log('=== TEST REAL CHECKOUT FLOW COMPLETED ===');
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
