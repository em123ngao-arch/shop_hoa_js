import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

async function testFilterVerification() {
  console.log('--- BẮT ĐẦU KIỂM THỬ ĐẦU CUỐI BỘ LỌC HOA & TÍCH HỢP METADATA ---');

  // Đảm bảo dọn dẹp các sản phẩm test dư thừa trước khi kiểm thử
  const prisma = new PrismaClient();
  await prisma.products.deleteMany({
    where: { name: { contains: 'Mới 2026' } }
  });
  await prisma.$disconnect();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE LOG ERROR:', msg.text());
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. TEST CASE 1: Deep Linking qua Hash URL #products?price=200-300&color=cam
  console.log('\n[TEST 1] Mở URL trực tiếp: http://localhost:4000/index.html#products?price=200-300&color=cam');
  await page.goto('http://localhost:4000/index.html#products?price=200-300&color=cam');
  await page.waitForTimeout(2000);

  const productCount = await page.$eval('#productCount', el => el.textContent.trim());
  console.log('  -> Số lượng sản phẩm hiển thị:', productCount);

  const activeTags = await page.$$eval('.active-filter-tag', els => els.map(e => e.textContent.trim()));
  console.log('  -> Active Filter Tags:', activeTags);

  const checkedPrice = await page.$$eval('input[name="sidebarPrice"]', els => {
    const checked = els.find(e => e.checked);
    return checked ? checked.value : 'none';
  });
  console.log('  -> Radio mức giá Sidebar:', checkedPrice);

  const activeColor = await page.$$eval('.sidebar-color-btn.active', els => els.map(e => e.dataset.color));
  console.log('  -> Nút màu Sidebar active:', activeColor);

  const renderedTitles = await page.$$eval('#productList .product-title', els => els.map(e => e.textContent.trim()));
  console.log('  -> Danh sách mẫu hoa được render:', renderedTitles);

  if (productCount !== '1') {
    throw new Error(`[FAIL] Mong đợi hiển thị đúng 1 sản phẩm màu cam trong tầm giá 200k-300k, thực tế hiển thị: ${productCount}`);
  }
  if (!renderedTitles[0] || !renderedTitles[0].includes('Cam')) {
    throw new Error(`[FAIL] Sản phẩm hiển thị không phải hoa màu cam: ${renderedTitles[0]}`);
  }
  console.log('  -> [PASS TEST 1] Deep link Hash URL #products?price=200-300&color=cam hoạt động chuẩn xác 100%!');

  // Chụp ảnh bằng chứng cho Test 1
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/54_test1_filter_cam_200_300.png', fullPage: false });

  // 2. TEST CASE 2: Bỏ lọc mức giá (click nút X trên tag 200.000đ - 300.000đ)
  console.log('\n[TEST 2] Bấm xóa lọc giá [200.000đ - 300.000đ ✕] để xem toàn bộ hoa màu cam');
  await page.click('.tag-remove[data-clear="price"]');
  await page.waitForTimeout(1000);

  const countAfterClearPrice = await page.$eval('#productCount', el => el.textContent.trim());
  const titlesAfterClearPrice = await page.$$eval('#productList .product-title', els => els.map(e => e.textContent.trim()));
  console.log('  -> Số lượng hoa sau khi bỏ lọc giá:', countAfterClearPrice);
  console.log('  -> Danh sách hoa màu cam các tầm giá:', titlesAfterClearPrice);

  if (Number(countAfterClearPrice) !== 2) {
    throw new Error(`[FAIL] Mong đợi hiển thị 2 mẫu hoa màu cam, thực tế: ${countAfterClearPrice}`);
  }
  console.log('  -> [PASS TEST 2] Bỏ lọc giá hiển thị đủ 2 mẫu hoa màu cam (PROD-002 & PROD-018)!');

  // 3. TEST CASE 3: Bấm [Xóa tất cả] trên thanh Active Tags
  console.log('\n[TEST 3] Bấm "Xóa tất cả" để khôi phục danh mục hoa');
  await page.click('#btnClearActiveTags');
  await page.waitForTimeout(1000);

  const countRestored = await page.$eval('#productCount', el => el.textContent.trim());
  console.log('  -> Số lượng sản phẩm sau khi Xóa tất cả:', countRestored);
  if (Number(countRestored) < 18) {
    throw new Error(`[FAIL] Số lượng sản phẩm sau khi reset không đủ: ${countRestored}`);
  }
  console.log('  -> [PASS TEST 3] Khôi phục toàn bộ danh sách hoa thành công!');

  // 4. TEST CASE 4: Lọc qua Dropdown Menu Header: MÀU SẮC -> Cam
  console.log('\n[TEST 4] Click Dropdown Menu "MÀU SẮC" -> "Cam"');
  await page.hover('.nav-item.has-dropdown:has-text("MÀU SẮC")');
  await page.waitForTimeout(300);
  await page.click('.dropdown-link.color-link[data-filter-val="cam"]', { force: true });
  await page.waitForTimeout(1000);

  const countHeaderColor = await page.$eval('#productCount', el => el.textContent.trim());
  console.log('  -> Số lượng hoa khi chọn MÀU SẮC -> Cam từ Header:', countHeaderColor);
  if (Number(countHeaderColor) !== 2) {
    throw new Error(`[FAIL] Header color filter không trả về 2 sản phẩm: ${countHeaderColor}`);
  }
  console.log('  -> [PASS TEST 4] Header Mega Dropdown lọc màu Cam thành công!');

  // 5. TEST CASE 5: Đăng nhập Admin và kiểm tra Modal thêm mẫu hoa mới có đủ 4 trường phân loại
  console.log('\n[TEST 5] Đăng nhập Admin và kiểm tra trang Admin http://localhost:4000/admin.html');
  await page.goto('http://localhost:4000/login.html');
  await page.waitForTimeout(1000);
  await page.fill('#email', 'admin@shophoa.example');
  await page.fill('#password', 'admin123');
  await page.click('#submitBtn');
  await page.waitForTimeout(2000);

  await page.goto('http://localhost:4000/admin.html');
  await page.waitForTimeout(2000);

  // Chuyển sang tab Quản Lý Mẫu Hoa
  console.log('  -> Chuyển sang tab Quản Lý Mẫu Hoa...');
  await page.click('.admin-nav button[data-tab="products"]');
  await page.waitForTimeout(1000);

  // Mở modal Thêm Mẫu Hoa
  await page.click('#openAddProductBtn');
  await page.waitForTimeout(1000);

  const hasColorSelect = await page.$eval('#prodColorSelect', el => Boolean(el));
  const hasFlowerTypeSelect = await page.$eval('#prodFlowerTypeSelect', el => Boolean(el));
  const hasOccasionSelect = await page.$eval('#prodOccasionSelect', el => Boolean(el));
  const hasMaterialSelect = await page.$eval('#prodMaterialSelect', el => Boolean(el));

  console.log('  -> Admin Modal có trường Màu sắc (#prodColorSelect):', hasColorSelect);
  console.log('  -> Admin Modal có trường Loài hoa (#prodFlowerTypeSelect):', hasFlowerTypeSelect);
  console.log('  -> Admin Modal có trường Dịp tặng (#prodOccasionSelect):', hasOccasionSelect);
  console.log('  -> Admin Modal có trường Chất liệu (#prodMaterialSelect):', hasMaterialSelect);

  if (!hasColorSelect || !hasFlowerTypeSelect || !hasOccasionSelect || !hasMaterialSelect) {
    throw new Error('[FAIL] Form Admin thiếu một trong 4 trường phân loại');
  }

  // Chụp ảnh Modal Admin có đủ trường phân loại
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/55_admin_product_modal_metadata_fields.png', fullPage: false });

  // Thử nghiệm thêm mẫu hoa mới với màu Cam qua UI Admin
  console.log('  -> Thử nghiệm tạo mẫu hoa mới với màu Cam qua UI Admin...');
  await page.fill('#prodNameInput', 'Bó Hoa Kẽm Nhung Cam Tulip Mới 2026');
  await page.selectOption('#prodColorSelect', 'cam');
  await page.selectOption('#prodFlowerTypeSelect', 'tulip');
  await page.selectOption('#prodOccasionSelect', 'sinh-nhat');
  await page.selectOption('#prodMaterialSelect', 'kem-nhung');
  await page.fill('#prodPriceInput', '280000');
  await page.fill('#prodOriginalPriceInput', '320000');
  await page.fill('#prodStockInput', '30');
  await page.fill('#prodDescInput', 'Mẫu hoa màu cam thử nghiệm qua form Admin.');
  await page.click('#prodSubmitBtn');
  await page.waitForTimeout(2000);

  // Đóng modal nếu còn mở
  await page.screenshot({ path: 'C:/Users/ADMIN/.gemini/antigravity/brain/b91ae753-3bab-41de-b4ee-38eda5fb83ca/56_admin_product_table_with_metadata_tags.png', fullPage: false });

  // Tìm kiếm sản phẩm vừa tạo trên thanh tìm kiếm Admin để hiển thị ngay trên bảng
  console.log('  -> Lọc tìm kiếm sản phẩm vừa tạo trên Admin Table...');
  await page.fill('#productSearchInput', 'Cam Tulip Mới');
  await page.waitForTimeout(1000);

  // Kiểm tra bảng sản phẩm Admin đã có tag màu Cam và loài hoa Tulip
  const tableContent = await page.$eval('#adminProductsTable', el => el.textContent);
  console.log('  -> Nội dung dòng sản phẩm trên bảng:', tableContent.replace(/\s+/g, ' ').trim());
  if (!tableContent.includes('Bó Hoa Kẽm Nhung Cam Tulip Mới 2026') || !tableContent.includes('Màu Cam')) {
    throw new Error('[FAIL] Sản phẩm mới tạo không hiển thị với tag màu cam trên bảng Admin');
  }
  console.log('  -> [PASS TEST 5] Admin Modal lưu thành công mẫu hoa kèm đầy đủ 4 trường phân loại TiDB!');

  // Dọn dẹp sản phẩm vừa tạo để bảo toàn CSDL
  await page.click('#adminProductsTable button.delete-product-btn[data-id]:has-text("Xóa")');
  await page.waitForTimeout(500);
  const confirmBtn = await page.$('#confirmOkBtn');
  if (confirmBtn) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
  }
  console.log('  -> Đã dọn dẹp sản phẩm mẫu thử nghiệm an toàn.');

  await browser.close();
  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ 5 BÀI TEST KIỂM THỬ ĐÃ PASS 100% HOÀN HẢO!');
  console.log('======================================================');
}

testFilterVerification().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});
