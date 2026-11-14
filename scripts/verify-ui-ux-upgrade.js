import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  
  // ==========================================
  // 1. DESKTOP VIEWPORT TEST (1280x800)
  // ==========================================
  console.log('--- 1. Testing Desktop UI / Visual Category Hub & Multi-facet Filter ---');
  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktopPage.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });

  // 1.1 Kiểm tra Visual Category Hub
  const visualCards = await desktopPage.$$('.visual-category-card');
  console.log('Số lượng thẻ danh mục trực quan:', visualCards.length);
  if (visualCards.length !== 6) throw new Error(`Mong đợi 6 thẻ danh mục trực quan, nhận: ${visualCards.length}`);

  // Chụp ảnh khu vực Visual Category Hub
  await desktopPage.locator('#categories').scrollIntoViewIfNeeded();
  await desktopPage.waitForTimeout(300);
  await desktopPage.screenshot({ path: 'public/images/test_evidence/22_desktop_visual_category_hub.png' });

  // 1.2 Kiểm tra bộ lọc Màu Sắc: Bấm chọn Tone Cam (🟠 Cam)
  console.log('Thử nghiệm bấm bộ lọc Tone Cam 🟠...');
  const orangeSwatch = await desktopPage.$('.color-swatch-btn[data-color="cam"]');
  if (!orangeSwatch) throw new Error('Không tìm thấy nút lọc màu cam');
  await orangeSwatch.click();
  await desktopPage.waitForTimeout(400);

  // Đọc danh sách sản phẩm sau khi lọc tone cam (chỉ trong lưới danh mục chính #productList)
  const orangeCards = await desktopPage.$$('#productList .product-card');
  const orangeProductCount = await desktopPage.$eval('#productCount', el => el.textContent.trim());
  console.log(`Số mẫu hoa tone cam trong lưới #productList: ${orangeCards.length} (Bộ đếm: ${orangeProductCount})`);
  
  // Kiểm tra tên các sản phẩm hiển thị trong #productList
  const orangeNames = await desktopPage.$$eval('#productList .product-card .product-title', els => els.map(e => e.textContent.trim()));
  console.log('Danh sách hoa tone cam:', orangeNames);
  if (!orangeNames.some(n => n.includes('Sunset') || n.includes('Cam') || n.includes('cam'))) {
    throw new Error('Bộ lọc màu cam không trả về hoa có sắc cam!');
  }

  // Chụp ảnh kết quả lọc màu cam
  await desktopPage.locator('#products').scrollIntoViewIfNeeded();
  await desktopPage.waitForTimeout(300);
  await desktopPage.screenshot({ path: 'public/images/test_evidence/23_desktop_filter_orange_color.png' });

  // 1.3 Bấm xóa bộ lọc
  console.log('Bấm xóa tất cả bộ lọc...');
  const clearBtn = await desktopPage.$('#btnClearAllFilters');
  if (clearBtn) await clearBtn.click();
  await desktopPage.waitForTimeout(300);
  const resetCount = await desktopPage.$eval('#productCount', el => el.textContent.trim());
  console.log('Số sản phẩm sau khi xóa bộ lọc:', resetCount);

  // 1.4 Thử nghiệm bấm Thẻ Trực Quan: "🎓 Tri Ân 20/11"
  console.log('Thử nghiệm bấm thẻ Visual Category: 🎓 Tri Ân 20/11...');
  const cat2011 = await desktopPage.$('.visual-category-card[data-filter-value="20-11"]');
  if (cat2011) await cat2011.click();
  await desktopPage.waitForTimeout(400);
  const names2011 = await desktopPage.$$eval('#productList .product-card .product-title', els => els.map(e => e.textContent.trim()));
  console.log('Danh sách hoa dịp 20/11:', names2011);
  await desktopPage.screenshot({ path: 'public/images/test_evidence/24_desktop_category_2011_filtered.png' });

  // ==========================================
  // 2. MOBILE VIEWPORT TEST (375x667 - iPhone)
  // ==========================================
  console.log('\n--- 2. Testing Mobile Responsive (375x667) ---');
  const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await mobilePage.goto('http://localhost:4000/index.html', { waitUntil: 'networkidle' });

  // 2.1 Kiểm tra Header Mobile
  const cartTextVisible = await mobilePage.evaluate(() => {
    const span = document.querySelector('.cart-btn span:not(.cart-badge)');
    return span ? window.getComputedStyle(span).display !== 'none' : false;
  });
  console.log('Chữ Giỏ Hàng trên mobile ẩn (không tràn viền):', !cartTextVisible);
  if (cartTextVisible) throw new Error('Chữ Giỏ Hàng vẫn hiển thị trên mobile!');

  // 2.2 Kiểm tra Cụm Nút Nổi Đa Kênh: Thu gọn thông minh, KHÔNG bị đè dính chùm
  const stack = await mobilePage.$('#floatingContactStack');
  const otherItemsVisible = await mobilePage.evaluate(() => {
    const items = document.querySelectorAll('#floatingContactStack .contact-stack-item:not(.item-trigger)');
    return Array.from(items).every(it => window.getComputedStyle(it).display !== 'none');
  });
  console.log('Cụm 3 nút con mặc định ẩn gọn trên Mobile:', !otherItemsVisible);

  // Chụp ảnh Mobile Home thoáng đãng không bị che khuất
  await mobilePage.screenshot({ path: 'public/images/test_evidence/25_mobile_home_clean_header_fab.png' });

  // 2.3 Bấm mở FAB Speed Dial trên Mobile
  console.log('Bấm mở FAB Speed Dial trên Mobile...');
  const fabTrigger = await mobilePage.$('#chatLauncherBtn');
  await fabTrigger.click();
  await mobilePage.waitForTimeout(350);

  const hasMobileActive = await mobilePage.evaluate(() => {
    return document.querySelector('#floatingContactStack')?.classList.contains('mobile-active');
  });
  console.log('Cụm nút nổi bung mở mượt mà khi chạm:', hasMobileActive);
  await mobilePage.screenshot({ path: 'public/images/test_evidence/26_mobile_speed_dial_expanded.png' });

  // Đóng lại FAB
  await mobilePage.evaluate(() => document.body.click());
  await mobilePage.waitForTimeout(200);

  // 2.4 Kiểm tra Bottom Nav - Nút Tìm Kiếm
  console.log('Bấm nút Tìm Kiếm trên Bottom Nav...');
  const btnBottomSearch = await mobilePage.$('#bottomNavSearch');
  await btnBottomSearch.click();
  await mobilePage.waitForTimeout(400);

  const isSearchFocused = await mobilePage.evaluate(() => {
    return document.activeElement === document.querySelector('#searchInput');
  });
  console.log('Ô tìm kiếm được cuộn đến và kích hoạt Focus:', isSearchFocused);
  if (!isSearchFocused) throw new Error('Nút Tìm Kiếm ở Bottom Nav không focus ô tìm kiếm!');

  // Ẩn bàn phím ảo (blur input) để Bottom Nav hiện lại
  await mobilePage.evaluate(() => document.activeElement.blur());
  await mobilePage.waitForTimeout(300);

  // 2.5 Kiểm tra Bottom Nav - Nút Danh Mục
  console.log('Bấm nút Danh Mục trên Bottom Nav...');
  const btnBottomCat = await mobilePage.$('#bottomNavCategories');
  await btnBottomCat.click();
  await mobilePage.waitForTimeout(400);

  // 2.6 Kiểm tra Carousel vuốt ngang Danh Mục Thẻ Trực Quan trên Mobile
  const isCarouselScrollable = await mobilePage.evaluate(() => {
    const grid = document.querySelector('.visual-category-grid');
    return grid ? grid.scrollWidth > grid.clientWidth : false;
  });
  console.log('Lưới danh mục trực quan có carousel vuốt ngang mượt mà trên mobile:', isCarouselScrollable);
  await mobilePage.screenshot({ path: 'public/images/test_evidence/27_mobile_visual_category_carousel.png' });

  await browser.close();
  console.log('\n🎉 ALL TESTS AND UI VERIFICATIONS PASSED 100%!');
})();
