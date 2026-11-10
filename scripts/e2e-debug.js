import { chromium } from 'playwright';

async function main() {
  console.log('=== STARTING E2E BROWSER DEBUG SUITE ===\n');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[CONSOLE ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warn') {
      console.warn(`[CONSOLE WARN] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`[UNHANDLED PAGE ERROR] ${err.message}\n${err.stack}`);
  });

  page.on('requestfailed', req => {
    console.error(`[REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.error(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  // TEST 1: LOGIN FLOW
  console.log('\n--- 1. Testing Login Page (login.html) ---');
  await page.goto('http://localhost:4000/login.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Click demo button for customer
  const custDemoBtn = await page.$('.btn-demo-fill[data-email="customer1@shophoa.example"]');
  if (custDemoBtn) {
    await custDemoBtn.click();
    console.log('Clicked customer demo button.');
    await page.waitForTimeout(500);
  }

  // Submit login
  const submitBtn = await page.$('#submitBtn');
  if (submitBtn) {
    await submitBtn.click();
    console.log('Clicked submit login.');
    await page.waitForTimeout(2000);
    console.log('Current URL after login:', page.url());
  }

  // TEST 2: HOMEPAGE FLOW
  console.log('\n--- 2. Testing Homepage (index.html) ---');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check product cards
  const productCards = await page.$$('.product-card');
  console.log(`Rendered product cards: ${productCards.length}`);

  // Test "Thêm vào giỏ" button
  const addBtn = await page.$('.product-card:first-child .btn-add-cart, .product-card:first-child .add-to-cart-btn, .product-card:first-child [data-action="add-cart"]');
  if (addBtn) {
    await addBtn.click();
    console.log('Clicked Add to Cart on first product.');
    await page.waitForTimeout(1500);
  } else {
    // Try finding any button inside first product card
    const anyBtn = await page.$('.product-card:first-child button');
    if (anyBtn) {
      console.log('Found button in first card:', await anyBtn.textContent());
      await anyBtn.click();
      await page.waitForTimeout(1500);
    } else {
      console.log('No direct button in card, checking card HTML...');
    }
  }

  // TEST 3: DETAIL PAGE FLOW
  console.log('\n--- 3. Testing Detail Page (detail.html?id=PROD-001) ---');
  await page.goto('http://localhost:4000/detail.html?id=PROD-001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const detailTitle = await page.$('#productName, .product-title, h1');
  if (detailTitle) {
    console.log('Product title on detail page:', await detailTitle.textContent());
  }

  // Click Add to Cart on detail page
  const detailAddBtn = await page.$('#addToCartBtn, .btn-add-cart, #btnAddToCart');
  if (detailAddBtn) {
    await detailAddBtn.click();
    console.log('Clicked Add to Cart on detail page.');
    await page.waitForTimeout(1500);
  }

  // Click Buy Now (Mua ngay)
  const buyNowBtn = await page.$('#buyNowBtn, .btn-buy-now, #btnBuyNow');
  if (buyNowBtn) {
    await buyNowBtn.click();
    console.log('Clicked Buy Now on detail page.');
    await page.waitForTimeout(1500);
  }

  // TEST 4: CHECKOUT MODAL
  console.log('\n--- 4. Testing Checkout Modal / Flow ---');
  const checkoutModal = await page.$('#checkoutModal, .checkout-modal, #modalCheckout');
  const isCheckoutVisible = checkoutModal ? await checkoutModal.isVisible() : false;
  console.log('Checkout modal visible:', isCheckoutVisible);

  if (isCheckoutVisible) {
    // Fill in checkout form
    const nameInput = await page.$('#customerName, #checkoutName, input[name="customerName"]');
    if (nameInput) await nameInput.fill('Nguyễn Văn Khách');
    const phoneInput = await page.$('#customerPhone, #checkoutPhone, input[name="customerPhone"]');
    if (phoneInput) await phoneInput.fill('0912345678');
    const addressInput = await page.$('#shippingAddress, #checkoutAddress, input[name="shippingAddress"]');
    if (addressInput) await addressInput.fill('123 Đường Hoa Hồng, TP.HCM');

    // Submit order
    const confirmOrderBtn = await page.$('#confirmOrderBtn, #submitOrderBtn, button[type="submit"]');
    if (confirmOrderBtn) {
      await confirmOrderBtn.click();
      console.log('Clicked Confirm Order button.');
      await page.waitForTimeout(3000);
    }
  }

  // TEST 5: ADMIN PAGE FLOW
  console.log('\n--- 5. Testing Admin Page (admin.html?demo=true) ---');
  await page.goto('http://localhost:4000/admin.html?demo=true', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const adminProducts = await page.$$('.nav-item[data-tab="products"]');
  if (adminProducts.length > 0) {
    await adminProducts[0].click();
    console.log('Clicked Admin Products tab.');
    await page.waitForTimeout(1500);
    const prodRows = await page.$$('#adminProductsTable tr, #productsTable tr');
    console.log(`Admin product rows: ${prodRows.length}`);
  }

  const adminOrders = await page.$$('.nav-item[data-tab="orders"]');
  if (adminOrders.length > 0) {
    await adminOrders[0].click();
    console.log('Clicked Admin Orders tab.');
    await page.waitForTimeout(1500);
    const orderRows = await page.$$('#adminOrdersTable tr, #ordersTable tr');
    console.log(`Admin order rows: ${orderRows.length}`);
  }

  await browser.close();
  console.log('\n=== E2E BROWSER DEBUG SUITE COMPLETED ===');
}

main().catch(console.error);
