import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity/brain/c70abf47-c7ec-4bca-b324-d5ccc408b82e';
const EVIDENCE_DIR = path.resolve(__dirname, '../public/images/test_evidence');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Bắt đầu kịch bản kiểm thử giao diện & chụp ảnh bằng chứng Playwright...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    deviceScaleFactor: 1.5 // Ảnh chụp sắc nét Retina 1.5x
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Danh sách sản phẩm mẫu chuẩn nghiệp vụ tiệm hoa handmade
  let mockProducts = [
    {
      id: 'PROD-001',
      name: 'Bó Hoa Baby Trắng Tinh Khôi',
      price: 280000,
      originalPrice: 320000,
      costPrice: 120000,
      cost_price: 120000,
      stock: 25,
      image: './images/300.png',
      categoryId: '1',
      categoryName: 'Hoa Kẽm Nhung',
      categorySlug: 'kem-nhung',
      badge: 'Bán chạy',
      description: 'Hoa kẽm nhung mềm mịn màu trắng thanh khiết, bền đẹp theo thời gian',
      isActive: true,
      is_active: true
    },
    {
      id: 'PROD-002',
      name: 'Giỏ Hoa Hướng Dương May Mắn',
      price: 390000,
      originalPrice: 450000,
      costPrice: 165000,
      cost_price: 165000,
      stock: 15,
      image: './images/350.png',
      categoryId: '2',
      categoryName: 'Giỏ & Hộp Hoa',
      categorySlug: 'gio-hop-hoa',
      badge: 'Hot',
      description: 'Món quà rực rỡ thích hợp chúc mừng sinh nhật, khai trương hồng phát',
      isActive: true,
      is_active: true
    },
    {
      id: 'PROD-003',
      name: 'Bó Hoa Hồng Đỏ Kẽm Nhung Lãng Mạn',
      price: 350000,
      originalPrice: 400000,
      costPrice: 150000,
      cost_price: 150000,
      stock: 0,
      image: './images/402.png',
      categoryId: '1',
      categoryName: 'Hoa Kẽm Nhung',
      categorySlug: 'kem-nhung',
      badge: '',
      description: 'Tone đỏ nhung quyến rũ cho các dịp kỷ niệm và lễ tình nhân',
      isActive: false, // Mẫu này đã tạm ngừng bán
      is_active: false
    },
    {
      id: 'PROD-004',
      name: 'Bó Cúc Họa Mi Handmade Tinh Tế',
      price: 260000,
      originalPrice: 260000,
      costPrice: 105000,
      cost_price: 105000,
      stock: 8,
      image: './images/300.png',
      categoryId: '1',
      categoryName: 'Hoa Kẽm Nhung',
      categorySlug: 'kem-nhung',
      badge: 'Mới',
      description: 'Bó cúc họa mi kẽm nhung thủ công nhụy vàng cánh trắng',
      isActive: true,
      is_active: true
    }
  ];

  const mockCategories = [
    { id: '1', name: 'Hoa Kẽm Nhung', slug: 'kem-nhung' },
    { id: '2', name: 'Giỏ & Hộp Hoa', slug: 'gio-hop-hoa' },
    { id: '3', name: 'Bó Hoa Sinh Nhật', slug: 'bo-hoa-sinh-nhat' }
  ];

  // Intercept API routes
  await page.route('**/api/auth/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'USR-ADMIN-01',
          name: 'Quản Trị Viên Tiệm Hoa',
          email: 'admin@tiemhoa.vn',
          role: 'admin'
        }
      })
    });
  });

  await page.route('**/api/categories', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCategories)
    });
  });

  await page.route('**/api/banners**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.route('**/api/promotions**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.route('**/api/orders**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'ORD-001', code: 'HD001', status: 'completed', payment_status: 'paid', total_amount: 390000, items: [{ product_id: 'PROD-002', quantity: 1 }] }
      ])
    });
  });

  await page.route('**/api/admin/users**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  let mockRefunds = [
    {
      id: 'REF-001',
      orderId: 'ORD-001',
      order_id: 'ORD-001',
      orderCode: 'HD001',
      order_code: 'HD001',
      amount: 50000,
      reason: 'Bồi thường móp nơ gói hoa khi giao hàng',
      bankInfo: 'MBBank 0987654321',
      bank_info: 'MBBank 0987654321',
      status: 'pending_approval',
      requestedBy: { id: 'STAFF-01', name: 'Thu ngân A' },
      requestedByName: 'Thu ngân A',
      requested_by_name: 'Thu ngân A',
      requestedAt: new Date().toISOString(),
      requested_at: new Date().toISOString()
    }
  ];

  await page.route('**/api/refunds**', async route => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRefunds)
      });
    }
    if (method === 'POST' && url.includes('/approve')) {
      const parts = url.split('/');
      const rIdx = parts.indexOf('refunds');
      const refId = parts[rIdx + 1];
      const item = mockRefunds.find(r => r.id === refId);
      if (item) {
        item.status = 'approved';
        item.reviewed_by_name = 'Quản Trị Viên';
        item.reviewed_at = new Date().toISOString();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(item || { success: true })
      });
    }
    return route.continue();
  });

  await page.route('**/api/products**', async route => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === 'GET') {
      const activeOnly = url.searchParams.get('activeOnly') !== 'false';
      const filtered = activeOnly ? mockProducts.filter(p => p.isActive) : mockProducts;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered)
      });
    }

    if (method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const newProd = {
        id: `PROD-${Date.now().toString(36).toUpperCase()}`,
        ...body,
        isActive: body.isActive !== undefined ? body.isActive : true
      };
      mockProducts.push(newProd);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newProd)
      });
    }

    return route.continue();
  });

  await page.route('**/api/products/**', async route => {
    const method = route.request().method();
    const urlParts = route.request().url().split('/');
    const id = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);

    if (method === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      console.log(`[API MOCK] Nhận PUT /api/products/${id}:`, body);
      const prodIndex = mockProducts.findIndex(p => String(p.id) === String(id));
      if (prodIndex !== -1) {
        if (body.stockDelta !== undefined) {
          const delta = Number(body.stockDelta);
          mockProducts[prodIndex].stock = Math.max(0, (mockProducts[prodIndex].stock || 0) + delta);
        } else if (body.stock !== undefined) {
          mockProducts[prodIndex].stock = Number(body.stock);
        }
        mockProducts[prodIndex] = {
          ...mockProducts[prodIndex],
          ...body,
          stock: mockProducts[prodIndex].stock
        };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProducts[prodIndex])
        });
      }
      return route.fulfill({ status: 404, body: JSON.stringify({ error: { message: 'Not found' } }) });
    }

    if (method === 'DELETE') {
      console.log(`[API MOCK] Nhận DELETE /api/products/${id}`);
      // Giả lập từ chối xóa vì sản phẩm PROD-002 đã có đơn hàng trong hệ thống
      if (id === 'PROD-002') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Mẫu hoa này đã có 3 đơn hàng liên quan, không thể xóa vĩnh viễn. Vui lòng chuyển sang trạng thái "Ngừng kinh doanh" để bảo toàn lịch sử kế toán và giao dịch!'
            }
          })
        });
      }

      mockProducts = mockProducts.filter(p => String(p.id) !== String(id));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Đã xóa sản phẩm' })
      });
    }

    return route.continue();
  });

  // Điều hướng tới Admin
  console.log('🌐 Đang tải trang Admin...');
  await page.goto('http://localhost:4000/admin.html', { waitUntil: 'networkidle' });

  // Nhấn vào tab "Sản phẩm" trên sidebar
  const productsMenu = await page.waitForSelector('.nav-item[data-tab="products"]', { timeout: 8000 });
  await productsMenu.click();
  await page.waitForTimeout(800);

  // 1. Chụp màn hình Bảng Sản Phẩm hiển thị Giá Vốn & Trạng Thái Mở Bán
  console.log('📸 1. Chụp Bảng Quản Lý Sản Phẩm (Giá Vốn + Trạng Thái Mở Bán)...');
  const pathTable = path.join(EVIDENCE_DIR, '01_admin_products_table_cost_and_status.png');
  const pathTableArtifact = path.join(ARTIFACT_DIR, '01_admin_products_table_cost_and_status.png');
  await page.screenshot({ path: pathTable, fullPage: false });
  fs.copyFileSync(pathTable, pathTableArtifact);
  console.log(`   -> Đã lưu: ${pathTable}`);

  // 2. Mở Modal Chỉnh Sửa Sản Phẩm (#PROD-001)
  console.log('🔍 2. Mở Modal Chỉnh Sửa Sản Phẩm PROD-001...');
  const editBtn = await page.waitForSelector('.edit-product-btn[data-id="PROD-001"]');
  await editBtn.click();
  await page.waitForTimeout(500);

  // Nhập thử giá vốn mới để kiểm tra live VND hint
  const costInput = await page.waitForSelector('#prodCostPriceInput');
  await costInput.fill('135000');
  await page.waitForTimeout(400);

  console.log('📸 2. Chụp Modal Sửa Sản Phẩm (Ô Giá Vốn + Dropdown Trạng Thái Mở Bán)...');
  const pathModal = path.join(EVIDENCE_DIR, '02_admin_product_modal_cost_and_active_toggle.png');
  const pathModalArtifact = path.join(ARTIFACT_DIR, '02_admin_product_modal_cost_and_active_toggle.png');
  await page.screenshot({ path: pathModal, fullPage: false });
  fs.copyFileSync(pathModal, pathModalArtifact);
  console.log(`   -> Đã lưu: ${pathModal}`);

  // Đóng modal
  const closeBtn = await page.waitForSelector('#productModalClose');
  await closeBtn.click();
  await page.waitForTimeout(400);

  // 3. Test thao tác nhanh "Ngừng bán" trên dòng PROD-001
  console.log('🔄 3. Bấm nút "Ngừng bán" nhanh trên dòng PROD-001...');
  const toggleBtn = await page.waitForSelector('.toggle-active-btn[data-id="PROD-001"]');
  await toggleBtn.click();
  await page.waitForTimeout(600);

  console.log('📸 3. Chụp kết quả sau khi Ngừng Bán (Trở thành đỏ & nút chuyển thành Mở Bán)...');
  const pathToggled = path.join(EVIDENCE_DIR, '03_admin_product_toggled_inactive.png');
  const pathToggledArtifact = path.join(ARTIFACT_DIR, '03_admin_product_toggled_inactive.png');
  await page.screenshot({ path: pathToggled, fullPage: false });
  fs.copyFileSync(pathToggled, pathToggledArtifact);
  console.log(`   -> Đã lưu: ${pathToggled}`);

  // 4. Test xóa sản phẩm đã có đơn hàng (PROD-002) -> kiểm tra Toast báo lỗi thân thiện thay vì 500
  console.log('⚠️ 4. Thử Xóa sản phẩm PROD-002 đã có đơn hàng...');
  const deleteBtn = await page.waitForSelector('.delete-product-btn[data-id="PROD-002"]');
  await deleteBtn.click();
  await page.waitForTimeout(400);

  // Bấm Xác nhận xóa trong Confirm Dialog
  const confirmOkBtn = await page.waitForSelector('#confirmOkBtn');
  await confirmOkBtn.click();
  await page.waitForTimeout(800);

  console.log('📸 4. Chụp Toast từ chối xóa để bảo vệ toàn vẹn đơn hàng...');
  const pathDeleteToast = path.join(EVIDENCE_DIR, '04_admin_delete_order_protected_toast.png');
  const pathDeleteToastArtifact = path.join(ARTIFACT_DIR, '04_admin_delete_order_protected_toast.png');
  await page.screenshot({ path: pathDeleteToast, fullPage: false });
  fs.copyFileSync(pathDeleteToast, pathDeleteToastArtifact);
  console.log(`   -> Đã lưu: ${pathDeleteToast}`);

  // 5. Test Stepper (+) tăng kho nguyên tử trên PROD-004
  console.log('➕ 5. Thử nút tăng kho (+) nguyên tử trên PROD-004...');
  const plusBtn = await page.waitForSelector('.btn-stepper-plus[data-id="PROD-004"]');
  await plusBtn.click();
  await page.waitForTimeout(600);

  // 6. Test Tab "Duyệt Hoàn Tiền" & Phê duyệt hoàn 1 phần
  console.log('💳 6. Chuyển sang Tab Duyệt Hoàn Tiền & Duyệt hoàn tiền 1 phần (50.000đ)...');
  const refundTab = await page.waitForSelector('.nav-item[data-tab="refunds"]');
  await refundTab.click();
  await page.waitForTimeout(600);

  const approveRefundBtn = await page.waitForSelector('.btn-refund-approve[data-id="REF-001"]', { timeout: 8000 });
  await approveRefundBtn.click();
  await page.waitForTimeout(400);

  const txRefInput = await page.waitForSelector('#refundTxRefInput');
  await txRefInput.fill('VNPAY-REF-50K');
  const confirmRefundBtn = await page.waitForSelector('#refundActionSubmitBtn');
  await confirmRefundBtn.click();
  await page.waitForTimeout(800);

  console.log('📸 6. Chụp Bảng Hoàn Tiền với phiếu hoàn 1 phần đã được duyệt...');
  const pathRefund = path.join(EVIDENCE_DIR, '05_admin_partial_refund_approved.png');
  const pathRefundArtifact = path.join(ARTIFACT_DIR, '05_admin_partial_refund_approved.png');
  await page.screenshot({ path: pathRefund, fullPage: false });
  fs.copyFileSync(pathRefund, pathRefundArtifact);
  console.log(`   -> Đã lưu: ${pathRefund}`);

  await browser.close();
  console.log('✅ Hoàn thành 100% kịch bản kiểm thử giao diện & chụp ảnh bằng chứng!');
}

run().catch(err => {
  console.error('❌ Lỗi kịch bản kiểm thử:', err);
  process.exit(1);
});
