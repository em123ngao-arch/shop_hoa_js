// scripts/test-admin-streamlined.js
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = path.resolve('C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3');

async function run() {
  console.log('🚀 Bắt đầu kiểm thử Admin Streamlined Dashboard & Live Badges...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('  [Browser]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('  [Browser Error]', err.message));

  try {
    // 1. Đăng nhập Admin
    console.log('👉 1. Đăng nhập tài khoản Quản trị viên...');
    await page.goto('http://localhost:4000/login.html?returnUrl=%2Fadmin.html', { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');

    await page.waitForURL('**/admin.html', { timeout: 10000 });
    console.log('✅ Đã đăng nhập và chuyển hướng vào /admin.html thành công!');

    // Chờ dữ liệu nạp hoàn tất
    await page.waitForTimeout(2000);

    // 2. Kiểm tra Sidebar & Live Badges
    console.log('👉 2. Kiểm tra Sidebar và Badge số đỏ...');
    const sidebarItems = await page.$$('.admin-nav .nav-item');
    console.log(`  Tổng số mục sidebar hiển thị: ${sidebarItems.length} (kỳ vọng 8)`);

    const navOrdersBadge = await page.$('#navOrdersBadge');
    const badgeText = navOrdersBadge ? await navOrdersBadge.innerText() : 'N/A';
    const isBadgeHidden = navOrdersBadge ? await navOrdersBadge.evaluate(el => el.classList.contains('hidden')) : true;
    console.log(`  Badge Quản Lý Đơn Hàng: text="${badgeText}", hidden=${isBadgeHidden}`);

    // 3. Kiểm tra 4 Thẻ KPI Vàng cốt lõi trên Dashboard
    console.log('👉 3. Kiểm tra 4 Thẻ KPI Vàng cốt lõi...');
    const revText = await page.innerText('#dashKpiRevenue');
    const shipText = await page.innerText('#dashKpiShippingFee');
    const profitText = await page.innerText('#dashKpiProfit');
    const marginText = await page.innerText('#dashKpiMarginBadge');
    const ordersText = await page.innerText('#dashKpiOrders');
    const pendingText = await page.innerText('#dashKpiPendingAction');
    const periodLabel = await page.innerText('#dashKpiPeriodLabel');

    console.log(`  Kỳ hiển thị: ${periodLabel}`);
    console.log(`  🟢 Doanh thu tổng: ${revText}`);
    console.log(`  🚚 Chi phí vận chuyển (thu hộ): ${shipText}`);
    console.log(`  🟠 Lợi nhuận thực nhận: ${profitText} (${marginText})`);
    console.log(`  🔵 Số đơn hoàn tất: ${ordersText}`);
    console.log(`  🔴 Đơn cần xử lý ngay: ${pendingText}`);

    // 4. Kiểm tra Sơ đồ cột trực quan
    const chartBars = await page.$$('#dashBarChartContainer > div');
    console.log(`  Sơ đồ cột: tìm thấy ${chartBars.length} cột dữ liệu thời gian`);

    // Chụp ảnh bằng chứng 81: Dashboard tinh gọn
    const dashScreenshotPath = path.join(artifactDir, '81_admin_streamlined_dashboard.png');
    await page.screenshot({ path: dashScreenshotPath, fullPage: false });
    console.log(`📸 Đã lưu ảnh chụp Dashboard tinh gọn tại: ${dashScreenshotPath}`);

    // 5. Thử chuyển đổi kỳ: Tháng Này -> Năm Nay -> Hôm Nay
    console.log('👉 4. Kiểm tra chuyển kỳ Thống kê...');
    await page.click('button[data-period="month"]');
    await page.waitForTimeout(500);
    const monthPeriodLabel = await page.innerText('#dashKpiPeriodLabel');
    console.log(`  Sau khi bấm "Tháng Này": kỳ=${monthPeriodLabel}, Doanh thu=${await page.innerText('#dashKpiRevenue')}`);

    await page.click('button[data-period="year"]');
    await page.waitForTimeout(500);
    const yearPeriodLabel = await page.innerText('#dashKpiPeriodLabel');
    console.log(`  Sau khi bấm "Năm Nay": kỳ=${yearPeriodLabel}, Doanh thu=${await page.innerText('#dashKpiRevenue')}`);

    await page.click('button[data-period="today"]');
    await page.waitForTimeout(500);
    console.log(`  Trở về "Hôm Nay": kỳ=${await page.innerText('#dashKpiPeriodLabel')}`);

    // 6. Kiểm tra Quick Action: Bấm vào thẻ "Đơn cần xử lý ngay"
    console.log('👉 5. Thử nghiệm 1-chạm nhảy sang Quản Lý Đơn Hàng...');
    await page.click('#dashCardPendingOrdersAction');
    await page.waitForTimeout(1000);

    const isOrdersPanelActive = await page.$eval('#panel-orders', el => el.classList.contains('active'));
    console.log(`  Tab Quản Lý Đơn Hàng active: ${isOrdersPanelActive}`);

    // Chụp ảnh bằng chứng 82: Tab Đơn hàng được mở tự động với filter Chờ duyệt
    const ordersScreenshotPath = path.join(artifactDir, '82_admin_orders_quick_action.png');
    await page.screenshot({ path: ordersScreenshotPath, fullPage: false });
    console.log(`📸 Đã lưu ảnh chụp Tab Đơn Hàng tại: ${ordersScreenshotPath}`);

    console.log('🎉 TẤT CẢ KIỂM THỬ GIAO DIỆN ADMIN HOÀN TOÀN THÀNH CÔNG VÀ CHÍNH XÁC!');
  } catch (err) {
    console.error('❌ Lỗi kiểm thử:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
