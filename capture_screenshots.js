/**
 * capture_screenshots.js - Tự động chụp ảnh màn hình toàn bộ các tính năng của Shop Hoa
 * Sử dụng Microsoft Edge thông qua Playwright
 */

import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\d18f1589-b1b1-44e3-ae1e-098a2a6a4d5d\\screenshots';
const BASE_URL = 'http://localhost:4000';

async function capture() {
  console.log('🚀 Đang khởi động Microsoft Edge để chụp ảnh giao diện...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5 // Ảnh chụp sắc nét Retina 1.5x
  });

  const page = await context.newPage();

  try {
    // 1. TRANG CHỦ: HERO & NAVIGATION
    console.log('📸 1. Chụp Trang chủ (Hero & Header)...');
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_homepage_hero.png'),
      clip: { x: 0, y: 0, width: 1440, height: 850 }
    });

    // 2. TRANG CHỦ: DANH SÁCH 15 HOA TỪ MYSQL
    console.log('📸 2. Chụp Danh sách 15 sản phẩm hoa từ MySQL 8.0...');
    const productGrid = await page.$('#productGrid, .product-grid, .products-container');
    if (productGrid) {
      await page.evaluate(() => {
        const el = document.querySelector('#productGrid, .product-grid, .products-container');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '02_homepage_products.png'),
        clip: { x: 0, y: 400, width: 1440, height: 950 }
      });
    }

    // 3. GIỎ HÀNG: CART DRAWER SLIDE-OVER
    console.log('📸 3. Chụp Giỏ hàng slide-over drawer...');
    // Đảm bảo không bị popup sinh nhật che và chuẩn bị giỏ hàng có 2 món
    await page.evaluate(() => {
      // Ẩn modal popup nếu có
      const modal = document.querySelector('.birthday-popup-overlay, #birthdayModal, .modal-backdrop');
      if (modal) modal.remove();

      // Cài đặt 2 sản phẩm vào SHOP_HOA_CART để drawer hiển thị đầy đủ
      const sampleCart = [
        {
          id: 'PROD-001',
          name: 'Bó Hoa Kẽm Nhung Tulip Pastel',
          price: 350000,
          originalPrice: 400000,
          quantity: 2,
          imageUrl: '/images/bloom-of-spring.png'
        },
        {
          id: 'PROD-002',
          name: 'Bó Hoa Hồng Kẽm Nhung Sunset',
          price: 420000,
          originalPrice: 450000,
          quantity: 1,
          imageUrl: '/images/bloom-of-spring.png'
        }
      ];
      localStorage.setItem('SHOP_HOA_CART', JSON.stringify(sampleCart));

      // Mở Drawer giỏ hàng
      const drawer = document.querySelector('#cartDrawer, .cart-drawer');
      const overlay = document.querySelector('#cartDrawerOverlay, .cart-drawer-overlay');
      if (drawer) drawer.classList.add('open', 'active');
      if (overlay) overlay.classList.add('open', 'active');
      document.body.classList.add('cart-drawer-open');

      // Kích hoạt render lại nếu có hàm
      window.dispatchEvent(new Event('cartUpdated'));
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_cart_drawer.png')
    });

    // Đóng giỏ hàng
    await page.evaluate(() => {
      const drawer = document.querySelector('#cartDrawer, .cart-drawer');
      const overlay = document.querySelector('#cartDrawerOverlay, .cart-drawer-overlay');
      if (drawer) drawer.classList.remove('open', 'active');
      if (overlay) overlay.classList.remove('open', 'active');
      document.body.classList.remove('cart-drawer-open');
    });
    await page.waitForTimeout(500);

    // 4. TRANG CHI TIẾT HOA (PROD-001)
    console.log('📸 4. Chụp Trang chi tiết hoa (detail.html?id=PROD-001)...');
    await page.goto(`${BASE_URL}/detail.html?id=PROD-001`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04_detail_product.png'),
      clip: { x: 0, y: 0, width: 1440, height: 850 }
    });

    // 5. TRANG CHI TIẾT: PHÂN HỆ ĐÁNH GIÁ (REVIEWS TỪ MYSQL)
    console.log('📸 5. Chụp Phân hệ đánh giá & bình luận sản phẩm (detail.html?id=PROD-002)...');
    await page.goto(`${BASE_URL}/detail.html?id=PROD-002`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const reviewBox = document.querySelector('#reviewContainer, #reviews, .reviews-section, .detail-reviews, .customer-reviews');
      if (reviewBox) {
        reviewBox.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else {
        window.scrollTo(0, 950);
      }
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05_detail_reviews.png'),
      clip: { x: 0, y: 150, width: 1440, height: 750 }
    });

    // 6. TRANG ĐĂNG NHẬP (LOGIN.HTML)
    console.log('📸 6. Chụp Trang đăng nhập & Nút điền tài khoản mẫu...');
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06_login_page.png')
    });

    // 7. TRANG ĐĂNG KÝ (REGISTER.HTML)
    console.log('📸 7. Chụp Trang đăng ký tài khoản mới...');
    await page.goto(`${BASE_URL}/register.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07_register_page.png')
    });

    // 8. ĐĂNG NHẬP VỚI TƯ CÁCH ADMIN VÀO ADMIN.HTML
    console.log('📸 8. Đăng nhập Admin và chụp Dashboard thống kê KPI...');
    // Đăng nhập qua API lấy token
    const adminLoginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@shophoa.example', password: 'admin123' }
    });
    const adminData = await adminLoginRes.json();

    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'commit' });
    await page.evaluate((auth) => {
      localStorage.setItem('token', auth.token);
      localStorage.setItem('user', JSON.stringify(auth.user));
      sessionStorage.setItem('admin_authenticated', 'true');
    }, adminData);

    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08_admin_dashboard.png')
    });

    // 9. ADMIN: QUẢN LÝ SẢN PHẨM (CATALOG CRUD TỪ MYSQL)
    console.log('📸 9. Chụp Quản lý sản phẩm trong Admin...');
    await page.evaluate(() => {
      const prodNav = document.querySelector('.nav-item[data-tab="products"]');
      if (prodNav) prodNav.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09_admin_products.png')
    });

    // 10. ADMIN: QUẢN LÝ ĐƠN HÀNG (STATE MACHINE TỪ MYSQL)
    console.log('📸 10. Chụp Quản lý đơn hàng trong Admin...');
    await page.evaluate(() => {
      const ordersNav = document.querySelector('.nav-item[data-tab="orders"]');
      if (ordersNav) ordersNav.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10_admin_orders.png')
    });

    // 11. ADMIN: QUẢN LÝ ĐÁNH GIÁ (REVIEWS TỪ MYSQL)
    console.log('📸 11. Chụp Quản lý đánh giá trong Admin...');
    await page.evaluate(() => {
      const revNav = document.querySelector('#navItemReviews, .nav-item[data-tab="reviews"]');
      if (revNav) revNav.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11_admin_reviews.png')
    });

    // 12. ADMIN: QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG (USERS TỪ MYSQL)
    console.log('📸 12. Chụp Quản lý người dùng trong Admin...');
    await page.evaluate(() => {
      const userNav = document.querySelector('#navItemUsers, .nav-item[data-tab="users"]');
      if (userNav) userNav.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12_admin_users.png')
    });

    // 13. TRANG ĐƠN HÀNG CÁ NHÂN & LỊCH SỬ (ORDERS.HTML)
    console.log('📸 13. Đăng nhập Customer và chụp Lịch sử đơn hàng (orders.html)...');
    const custLoginRes = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'customer1@shophoa.example', password: '123456' }
    });
    const custData = await custLoginRes.json();

    await page.goto(`${BASE_URL}/orders.html`, { waitUntil: 'commit' });
    await page.evaluate((auth) => {
      localStorage.setItem('token', auth.token);
      localStorage.setItem('user', JSON.stringify(auth.user));
      sessionStorage.removeItem('admin_authenticated');
    }, custData);

    await page.goto(`${BASE_URL}/orders.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '13_orders_tracking.png')
    });

    console.log('🎉 Hoàn thành chụp 13 ảnh chất lượng cao cho toàn bộ các phân hệ!');
  } catch (err) {
    console.error('Lỗi khi chụp màn hình:', err);
  } finally {
    await browser.close();
  }
}

capture();
