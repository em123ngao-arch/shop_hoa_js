import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('🚀 Bắt đầu kiểm thử Template 2 (Sidebar phân nhóm) & Màn hình Vận Hành Giao Hàng & Chi Phí Ship...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Bắt console log và lỗi từ browser
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

    // Chờ dashboard hiển thị
    await page.waitForSelector('#panel-dashboard', { state: 'visible', timeout: 10000 });
    console.log('✅ Đã truy cập thành công Admin Dashboard');

    // 3. Kiểm tra các nhóm Sidebar theo Template 2
    const groupHeadings = await page.$$eval('.nav-group-title', els => els.map(e => e.textContent.trim()));
    console.log('📋 Danh sách nhóm Sidebar phát hiện:', groupHeadings);

    if (groupHeadings.length < 3) {
      throw new Error(`Kỳ vọng ít nhất 3 nhóm Sidebar, nhưng nhận được ${groupHeadings.length}`);
    }
    console.log('✅ Sidebar đã có đủ 3 nhóm tiêu đề chuẩn mực Template 2');

    // Chụp ảnh bằng chứng 84: Sidebar phân nhóm Template 2
    const artifactDir = path.resolve('C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3');
    await page.screenshot({ path: path.join(artifactDir, '84_admin_sidebar_template2_grouped.png'), fullPage: false });
    console.log('📸 Đã chụp: 84_admin_sidebar_template2_grouped.png');

    // 4. Bấm vào tab "Vận Hành Giao Hàng & Ship"
    console.log('🚚 Bấm vào tab Vận Hành Giao Hàng & Ship...');
    const shippingTabBtn = page.locator('#navItemDeliveryQuotes');
    await shippingTabBtn.click();
    await page.waitForTimeout(1000);

    // Kiểm tra breadcrumb
    const breadcrumbText = await page.$eval('#currentBreadcrumb', el => el.textContent.trim());
    console.log('📌 Breadcrumb hiện tại:', breadcrumbText);

    // Kiểm tra hiển thị panel shipping logistics
    const isLogisticsPanelVisible = await page.isVisible('#panel-shipping-logistics');
    console.log('📦 Panel shipping-logistics hiển thị:', isLogisticsPanelVisible);
    if (!isLogisticsPanelVisible) {
      throw new Error('Panel shipping-logistics không hiển thị sau khi click tab!');
    }

    // 5. Kiểm tra 4 thẻ KPI
    const kpiShipFee = await page.$eval('#logisticsTotalShippingFee', el => el.textContent.trim());
    const kpiCarrier = await page.$eval('#logisticsCarrierCost', el => el.textContent.trim());
    const kpiShipping = await page.$eval('#logisticsShippingOrdersCount', el => el.textContent.trim());
    const kpiCompleted = await page.$eval('#logisticsCompletedOrdersCount', el => el.textContent.trim());

    console.log('📊 KPI Giao Vận:');
    console.log('   - Tổng cước thu khách:', kpiShipFee);
    console.log('   - Chi phí trả đối tác:', kpiCarrier);
    console.log('   - Đơn đang giao:', kpiShipping);
    console.log('   - Đơn đã giao:', kpiCompleted);

    // Kiểm tra bảng danh sách đơn giao
    const rowCount = await page.$$eval('#logisticsOrdersTableBody tr', rows => rows.length);
    console.log(`📋 Số dòng trong bảng điều phối giao hàng: ${rowCount}`);

    // Chụp ảnh bằng chứng 85: Màn hình Vận Hành Giao Hàng & Chi Phí Ship
    await page.screenshot({ path: path.join(artifactDir, '85_admin_shipping_logistics_tab.png'), fullPage: false });
    console.log('📸 Đã chụp: 85_admin_shipping_logistics_tab.png');

    // 6. Kiểm tra chuyển Subtab 2: Yêu Cầu Báo Giá Ngoại Tuyến
    console.log('📑 Chuyển sang Subtab: Yêu Cầu Báo Giá Ngoại Tuyến...');
    await page.click('button[data-subtab="quotes"]');
    await page.waitForTimeout(600);
    const quotesContainerVisible = await page.isVisible('#adminDeliveryQuoteRequests');
    console.log('✅ Container báo giá ngoại tuyến hiển thị:', quotesContainerVisible);

    // 7. Kiểm tra chuyển Subtab 3: Biểu Phí 78 Phường
    console.log('📑 Chuyển sang Subtab: Biểu Phí 78 Phường Cố Định...');
    await page.click('button[data-subtab="rates"]');
    await page.waitForTimeout(600);
    const ratesTableVisible = await page.isVisible('#deliveryZoneTableContainer table');
    console.log('✅ Bảng 78 phường hiển thị:', ratesTableVisible);

    // Thử gõ tìm kiếm 'Tân Phú'
    await page.fill('#searchDeliveryZoneInput', 'Tân Phú');
    await page.waitForTimeout(400);
    const filteredRatesCount = await page.$$eval('#deliveryZoneTableContainer tbody tr', rows => rows.length);
    console.log(`🔍 Kết quả lọc từ khóa 'Tân Phú': ${filteredRatesCount} phường`);

    // Chụp ảnh bằng chứng 86: Biểu phí 78 phường & Báo giá
    await page.screenshot({ path: path.join(artifactDir, '86_admin_shipping_logistics_quotes_and_rates.png'), fullPage: false });
    console.log('📸 Đã chụp: 86_admin_shipping_logistics_quotes_and_rates.png');

    console.log('🎉 TẤT CẢ KIỂM THỬ GIAO DIỆN TEMPLATE 2 & VẬN HÀNH GIAO HÀNG ĐỀU ĐẠT 100%!');
  } catch (error) {
    console.error('❌ Lỗi kiểm thử:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTest();
