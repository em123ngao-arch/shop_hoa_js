import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca';

async function verifyAll() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN BỘ LỌC STOREFRONT & ADMIN');
  console.log('====================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await context.newPage();

  // Bắt log lỗi nếu có
  page.on('pageerror', err => console.error('  [PAGE ERROR]', err.message));

  // --- TEST 1: URL price=200-300&color=cam&flowerType=tulip ---
  console.log('\n--- TEST 1: URL price=200-300&color=cam&flowerType=tulip ---');
  await page.goto('http://localhost:4000/index.html?price=200-300&color=cam&flowerType=tulip', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const count1 = await page.textContent('#productCount');
  const cards1 = await page.$$eval('#productList .product-card', els => els.map(c => ({
    name: c.querySelector('.product-name, h3')?.innerText?.trim(),
    price: c.querySelector('.current-price, .product-price')?.innerText?.trim()
  })));
  const tags1 = await page.$$eval('.active-filter-tag', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));

  console.log('Tags:', tags1);
  console.log('Số lượng hiển thị:', count1);
  console.log('Danh sách thẻ hoa:', cards1);

  if (cards1.length === 1 && cards1[0].name.includes('Cam Sunset Mini')) {
    console.log('✅ TEST 1 ĐẠT: Chỉ hiển thị đúng 1 bó hoa tulip cam trong tầm giá 200k-300k (PROD-018)!');
  } else {
    throw new Error(`TEST 1 THẤT BÀI: Mong đợi 1 thẻ nhưng nhận ${cards1.length} thẻ`);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '57_test1_filter_cam_tulip_200_300.png') });

  // --- TEST 2: URL price=under-50&color=cam&flowerType=tulip (Mẫu Cam tulip 5.000đ) ---
  console.log('\n--- TEST 2: URL price=under-50&color=cam&flowerType=tulip ---');
  await page.goto('http://localhost:4000/index.html?price=under-50&color=cam&flowerType=tulip', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const count2 = await page.textContent('#productCount');
  const cards2 = await page.$$eval('#productList .product-card', els => els.map(c => ({
    name: c.querySelector('.product-name, h3')?.innerText?.trim(),
    price: c.querySelector('.current-price, .product-price')?.innerText?.trim()
  })));
  console.log('Số lượng hiển thị:', count2);
  console.log('Danh sách thẻ hoa:', cards2);

  if (cards2.length === 1 && cards2[0].name.includes('Cam tulip')) {
    console.log('✅ TEST 2 ĐẠT: Hiển thị đúng mẫu hoa "Cam tulip" giá 5.000đ khi chọn Dưới 50k!');
  } else {
    throw new Error(`TEST 2 THẤT BÀI: Mong đợi mẫu "Cam tulip" nhưng nhận ${JSON.stringify(cards2)}`);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '58_test2_filter_cam_tulip_under_50.png') });

  // --- TEST 3: URL color=cam&flowerType=tulip (Tất cả mức giá -> hiển thị cả 2 mẫu) ---
  console.log('\n--- TEST 3: URL color=cam&flowerType=tulip (Tất cả giá) ---');
  await page.goto('http://localhost:4000/index.html?color=cam&flowerType=tulip', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const count3 = await page.textContent('#productCount');
  const cards3 = await page.$$eval('#productList .product-card', els => els.map(c => ({
    name: c.querySelector('.product-name, h3')?.innerText?.trim(),
    price: c.querySelector('.current-price, .product-price')?.innerText?.trim()
  })));
  console.log('Số lượng hiển thị:', count3);
  console.log('Danh sách thẻ hoa:', cards3);

  if (cards3.length === 2) {
    console.log('✅ TEST 3 ĐẠT: Hiển thị đầy đủ cả 2 mẫu hoa tulip cam trên toàn bộ cửa hàng!');
  } else {
    throw new Error(`TEST 3 THẤT BÀI: Mong đợi 2 mẫu nhưng nhận ${cards3.length}`);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '59_test3_filter_cam_tulip_all_prices.png') });

  // --- TEST 4: TƯƠNG TÁC CLICK TRỰC TIẾP TRÊN GIAO DIỆN KHÔNG CẦN F5 ---
  console.log('\n--- TEST 4: Tương tác click trực tiếp trên Sidebar ---');
  await page.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });

  // 1. Click chọn màu Cam
  console.log('  1. Click nút chọn màu Cam trên sidebar...');
  await page.locator('.sidebar-color-btn[data-color="cam"]').click();
  await page.waitForTimeout(400);
  const countColorCam = await page.textContent('#productCount');
  console.log('     -> Số lượng sau khi chọn màu Cam:', countColorCam); // Mong đợi: 3 (Sunset 420k, Sunset Mini 260k, Cam tulip 5k)

  // 2. Click chọn khoảng giá 200k-300k
  console.log('  2. Click chọn radio giá 200k-300k...');
  await page.locator('label.filter-check-label:has(input[value="200-300"])').click();
  await page.waitForTimeout(400);
  const countPrice200 = await page.textContent('#productCount');
  console.log('     -> Số lượng sau khi chọn 200k-300k:', countPrice200); // Mong đợi: 1 (Sunset Mini 260k)

  // 3. Click chuyển sang khoảng giá Dưới 50k
  console.log('  3. Click chuyển sang radio giá Dưới 50.000đ...');
  await page.locator('label.filter-check-label:has(input[value="under-50"])').click();
  await page.waitForTimeout(400);
  const countUnder50 = await page.textContent('#productCount');
  console.log('     -> Số lượng sau khi chọn Dưới 50k:', countUnder50); // Mong đợi: 1 (Cam tulip 5k)

  if (Number(countColorCam) === 3 && Number(countPrice200) === 1 && Number(countUnder50) === 1) {
    console.log('✅ TEST 4 ĐẠT: Tương tác click bộ lọc sidebar phản hồi mượt mà theo thời gian thực!');
  } else {
    throw new Error('TEST 4 THẤT BÀI: Tương tác click sidebar không khớp số lượng dự kiến');
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '60_test4_realtime_sidebar_clicks.png') });

  // --- TEST 5: KIỂM TRA MODAL ADMIN MẪU HOA ---
  console.log('\n--- TEST 5: Kiểm tra Modal Admin mở mẫu Cam tulip #PROD-MWFTAMC6 ---');
  await page.goto('http://localhost:4000/login.html', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@shophoa.example');
  await page.fill('#password', 'admin123');
  await page.click('#submitBtn');
  await page.waitForURL('**/admin.html', { timeout: 8000 });

  await page.click('button[data-tab="products"]');
  await page.waitForTimeout(600);

  // Tìm kiếm mẫu Cam tulip để hiển thị lên đầu bảng (tránh trang 2)
  await page.fill('#productSearchInput', 'Cam tulip');
  await page.waitForTimeout(400);

  // Mở nút Sửa của mẫu PROD-MWFTAMC6
  const editBtn = page.locator('.edit-product-btn[data-id="PROD-MWFTAMC6"]');
  await editBtn.scrollIntoViewIfNeeded();
  await editBtn.click();
  await page.waitForTimeout(500);

  const selectedColor = await page.$eval('#prodColorSelect', el => el.value);
  const selectedFlower = await page.$eval('#prodFlowerTypeSelect', el => el.value);
  console.log(`  Modal thuộc tính: Màu = "${selectedColor}", Loài hoa = "${selectedFlower}"`);

  if (selectedColor === 'cam' && selectedFlower === 'tulip') {
    console.log('✅ TEST 5 ĐẠT: Modal Admin hiển thị đúng thuộc tính Màu Cam & Hoa Tulip!');
  } else {
    throw new Error(`TEST 5 THẤT BÀI: Modal không đổ đúng giá trị (Color: ${selectedColor}, Flower: ${selectedFlower})`);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '61_admin_modal_verified.png') });

  await browser.close();
  console.log('\n====================================================');
  console.log('🎉 TOÀN BỘ 5 BÀI TEST TỰ ĐỘNG ĐÃ PASS 100% HOÀN HẢO!');
  console.log('====================================================');
}

verifyAll().catch(err => {
  console.error('\n❌ LỖI KIỂM THỬ:', err);
  process.exit(1);
});
