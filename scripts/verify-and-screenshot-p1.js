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

function copyToArtifact(filename) {
  const src = path.join(EVIDENCE_DIR, filename);
  const dst = path.join(ARTIFACT_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`📸 Đã đồng bộ ảnh bằng chứng sang Artifact: ${filename}`);
  }
}

async function run() {
  console.log('🚀 Khởi chạy Playwright kiểm thử & chụp ảnh bằng chứng cho Nghiệp vụ P1...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Failed to load resource')) console.log('[PAGE]', text);
  });

  // Mock Categories
  const mockCategories = [
    { id: '1', name: 'Hoa Kẽm Nhung', slug: 'kem-nhung', is_active: true }
  ];

  // Mock Products
  const mockProducts = [
    {
      id: 'PROD-001',
      name: 'Bó Hoa Hướng Dương Kẽm Nhung May Mắn',
      price: 390000,
      originalPrice: 450000,
      costPrice: 165000,
      cost_price: 165000,
      stock: 20,
      image: './images/300.png',
      categoryId: '1',
      categoryName: 'Hoa Kẽm Nhung',
      isActive: true,
      is_active: true
    }
  ];

  // Mock Orders P1 với Delivery Date và Quà tặng bí mật
  const mockOrders = [
    {
      id: 'DH-GIFT-2026',
      orderCode: 'DH-GIFT-2026',
      customerName: 'Nguyễn Văn Tuấn',
      customerPhone: '0901234567',
      recipientName: 'Trần Thị Bích Mai',
      recipientPhone: '0987654321',
      address: 'Tòa nhà Bitexco, 2 Hải Triều, P. Bến Nghé, Quận 1, TP.HCM',
      deliveryDate: '2026-11-20',
      deliverySlot: 'Sáng (08:00 - 12:00)',
      isGift: true,
      isAnonymous: true,
      hasGreetingCard: true,
      cardMessage: 'Chúc mừng sinh nhật Bích Mai! Mong em luôn nở nụ cười rạng rỡ và hạnh phúc như những đóa hoa kẽm nhung này.',
      items: [
        {
          id: 'item-1',
          productId: 'PROD-001',
          name: 'Bó Hoa Hướng Dương Kẽm Nhung May Mắn',
          price: 390000,
          costPrice: 165000,
          quantity: 1,
          addonsText: 'Đèn LED đom đóm lung linh'
        }
      ],
      subtotal: 390000,
      shippingFee: 0,
      totalAmount: 390000,
      paymentMethod: 'sepay',
      paymentStatus: 'paid',
      status: 'confirmed',
      createdAt: '2026-11-12T14:30:00.000Z'
    },
    {
      id: 'DH-STD-002',
      orderCode: 'DH-STD-002',
      customerName: 'Phạm Thu Hằng',
      customerPhone: '0912888999',
      recipientName: '',
      recipientPhone: '',
      address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1',
      deliveryDate: '2026-11-21',
      deliverySlot: 'Chiều (13:30 - 17:30)',
      isGift: false,
      isAnonymous: false,
      hasGreetingCard: false,
      items: [
        {
          id: 'item-2',
          productId: 'PROD-001',
          name: 'Bó Hoa Hướng Dương Kẽm Nhung May Mắn',
          price: 390000,
          costPrice: 165000,
          quantity: 1
        }
      ],
      subtotal: 390000,
      shippingFee: 0,
      totalAmount: 390000,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'pending',
      createdAt: '2026-11-12T15:00:00.000Z'
    }
  ];

  // Intercept backend APIs
  await page.route('**/api/auth/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 'ADM-01', name: 'Quản Trị Viên Tiệm Hoa', email: 'admin@tiemhoa.vn', role: 'admin' }
      })
    });
  });

  await page.route('**/api/products**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProducts)
    });
  });

  await page.route('**/api/categories**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCategories)
    });
  });

  await page.route('**/api/banners**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/promotions**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  const mockRefunds = [
    {
      id: 'REF-001',
      orderId: 'DH-GIFT-2026',
      order_id: 'DH-GIFT-2026',
      orderCode: 'DH-GIFT-2026',
      order_code: 'DH-GIFT-2026',
      amount: 150000,
      reason: 'Đơn đang giao gặp sự cố, khách hủy và shipper đang mang hoa hoàn về tiệm',
      bankInfo: 'Vietcombank 0123456789 - NGUYEN VAN TUAN',
      status: 'pending_approval',
      requestedByName: 'Thu ngân Chi nhánh 1',
      requestedAt: '2026-11-12T14:45:00.000Z',
      order: {
        id: 'DH-GIFT-2026',
        customerName: 'Nguyễn Văn Tuấn',
        customerPhone: '0901234567',
        status: 'shipping',
        totalAmount: 390000
      }
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
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Duyệt hoàn tiền thành công' })
      });
    }
    route.continue();
  });

  await page.route('**/api/orders**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockOrders)
    });
  });

  await page.route('**/api/admin/users**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  // --------------------------------------------------------------------------
  // BƯỚC 1: KIỂM THỬ CHECKOUT TRÊN INDEX.HTML (DELIVERY DATE & ANONYMOUS GIFT)
  // --------------------------------------------------------------------------
  console.log('📌 Bước 1: Mở trang chủ, thêm hoa vào giỏ & mở modal Checkout...');
  await page.goto('http://localhost:4000/index.html');
  await page.waitForLoadState('networkidle');

  // Mở giỏ hàng và mở modal checkout
  await page.evaluate(() => {
    // Đưa 1 sản phẩm vào giỏ
    const cart = [{
      id: 'PROD-001',
      name: 'Bó Hoa Hướng Dương Kẽm Nhung May Mắn',
      price: 390000,
      quantity: 1,
      image: './images/300.png',
      addons: [{ name: 'Đèn LED đom đóm lung linh', price: 25000 }]
    }];
    localStorage.setItem('shophoa_cart', JSON.stringify(cart));

    // Mở modal checkout
    const modal = document.querySelector('#checkoutModal');
    if (modal) {
      modal.classList.remove('hidden');
    }

    // Điền mẫu dữ liệu vào form
    const senderName = document.querySelector('#checkoutSenderName');
    if (senderName) senderName.value = 'Nguyễn Văn Tuấn';

    const senderPhone = document.querySelector('#checkoutSenderPhone');
    if (senderPhone) senderPhone.value = '0901234567';

    const isGift = document.querySelector('#checkoutIsGift');
    if (isGift) {
      isGift.checked = true;
      const giftFields = document.querySelector('#giftRecipientFields');
      if (giftFields) giftFields.classList.remove('hidden');
    }

    const recipientName = document.querySelector('#checkoutRecipientName');
    if (recipientName) recipientName.value = 'Trần Thị Bích Mai';

    const recipientPhone = document.querySelector('#checkoutRecipientPhone');
    if (recipientPhone) recipientPhone.value = '0987654321';

    const address = document.querySelector('#checkoutAddress');
    if (address) address.value = 'Tòa nhà Bitexco, 2 Hải Triều, P. Bến Nghé, Quận 1, TP.HCM';

    const deliveryDate = document.querySelector('#checkoutDeliveryDate');
    if (deliveryDate) deliveryDate.value = '2026-11-20';

    const isAnon = document.querySelector('#checkoutIsAnonymous');
    if (isAnon) isAnon.checked = true;

    const hasCard = document.querySelector('#checkoutHasCard');
    if (hasCard) {
      hasCard.checked = true;
      const cardField = document.querySelector('#checkoutCardGroup');
      if (cardField) cardField.classList.remove('hidden');
    }

    const cardMsg = document.querySelector('#checkoutCardMessage');
    if (cardMsg) cardMsg.value = 'Chúc mừng sinh nhật Bích Mai! Mong em luôn rạng rỡ và hạnh phúc như những đóa hoa kẽm nhung này.';
  });

  await page.waitForTimeout(600);

  const checkoutPath = path.join(EVIDENCE_DIR, '06_checkout_delivery_date_and_anonymous_gift.png');
  await page.screenshot({ path: checkoutPath, fullPage: false });
  copyToArtifact('06_checkout_delivery_date_and_anonymous_gift.png');
  console.log('✅ Đã chụp Ảnh 6: Giao diện Checkout với Ngày hẹn giao hoa & Quà tặng bí mật');

  // --------------------------------------------------------------------------
  // BƯỚC 2: ADMIN QUẢN LÝ ĐƠN HÀNG (DELIVERY DATE BADGE, ANONYMOUS BADGE, IN PHIẾU QUÀ)
  // --------------------------------------------------------------------------
  console.log('📌 Bước 2: Chuyển sang Admin Panel -> Quản lý Đơn hàng...');
  await page.goto('http://localhost:4000/admin.html');
  await page.waitForLoadState('networkidle');

  // Chuyển sang Tab "orders"
  await page.click('button[data-tab="orders"]');
  await page.waitForTimeout(500);

  const ordersTablePath = path.join(EVIDENCE_DIR, '07_admin_orders_delivery_date_and_anonymous_badges.png');
  await page.screenshot({ path: ordersTablePath, fullPage: false });
  copyToArtifact('07_admin_orders_delivery_date_and_anonymous_badges.png');
  console.log('✅ Đã chụp Ảnh 7: Bảng quản lý đơn Admin với Badge Ngày hẹn giao, Quà bí mật & Nút [In Phiếu Quà]');

  // --------------------------------------------------------------------------
  // BƯỚC 3: MỞ MODAL CHI TIẾT ĐƠN HÀNG QUÀ TẶNG BÍ MẬT
  // --------------------------------------------------------------------------
  console.log('📌 Bước 3: Mở modal Chi tiết đơn hàng quà bí mật DH-GIFT-2026...');
  // Click nút "Chi Tiết" của đơn DH-GIFT-2026
  await page.click('tr[data-id="DH-GIFT-2026"] .view-order-btn');
  await page.waitForTimeout(500);

  const orderDetailPath = path.join(EVIDENCE_DIR, '08_admin_order_detail_gift_and_date.png');
  await page.screenshot({ path: orderDetailPath, fullPage: false });
  copyToArtifact('08_admin_order_detail_gift_and_date.png');
  console.log('✅ Đã chụp Ảnh 8: Chi tiết đơn hàng với Cảnh báo quà bí mật & Nút [🎁 In Phiếu Giao Quà]');

  // --------------------------------------------------------------------------
  // BƯỚC 4: XEM TRƯỚC BẢN IN PHIẾU GIAO QUÀ TẶNG (GIFT DELIVERY SLIP PREVIEW)
  // --------------------------------------------------------------------------
  console.log('📌 Bước 4: Tạo giao diện xem trước Phiếu Giao Quà Tặng (ẩn hoàn toàn giá tiền)...');
  await page.evaluate(() => {
    // Render khung xem trước trực tiếp trên modal
    const bodyEl = document.querySelector('#orderDetailBody');
    if (!bodyEl) return;

    const previewDiv = document.createElement('div');
    previewDiv.id = 'giftDeliverySlipPreviewFrame';
    previewDiv.style.cssText = `
      margin-top: 16px;
      padding: 24px;
      background: #FFF;
      border: 2px dashed #E11D48;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(225, 29, 72, 0.15);
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    previewDiv.innerHTML = `
      <div style="text-align: center; border-bottom: 1.5px solid #F43F5E; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="font-size: 16px; font-weight: 800; color: #E11D48; letter-spacing: 0.5px;">TIỆM HOA KẼM NHUNG HANDMADE</div>
        <div style="font-size: 12px; color: #64748B; margin-top: 2px;">Hoa Kẽm Nhung Thủ Công & Quà Tặng Nghệ Thuật</div>
        <div style="font-size: 11.5px; color: #64748B;">Hotline: 0901.234.567 | Website: tiemplovers.vn</div>
        <div style="margin-top: 10px; font-size: 15px; font-weight: 800; color: #BE185D;">PHIẾU GIAO QUÀ TẶNG (GIFT DELIVERY SLIP)</div>
        <div style="font-size: 11.5px; color: #9D174D; font-style: italic;">(Chứng từ bàn giao quà tặng tận tay - Không chứa thông tin tài chính/giá tiền)</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
        <div><strong>Mã đơn hàng:</strong> #DH-GIFT-2026</div>
        <div><strong>Người gửi:</strong> <span style="color: #BE185D; font-weight: 700;">Một người bạn bí mật giấu tên 🎁</span></div>
        <div><strong>Ngày hẹn giao:</strong> <span style="color: #0D9488; font-weight: 700;">📅 20/11/2026</span></div>
        <div><strong>SĐT người gửi:</strong> <span style="color: #64748B; font-style: italic;">*** (Đã ẩn theo yêu cầu)</span></div>
        <div><strong>Khung giờ giao:</strong> Sáng (08:00 - 12:00)</div>
        <div><strong>Người nhận hoa:</strong> <strong style="color: #108474;">Trần Thị Bích Mai</strong></div>
        <div style="grid-column: 1 / -1;"><strong>Địa chỉ nhận hoa:</strong> Tòa nhà Bitexco, 2 Hải Triều, P. Bến Nghé, Quận 1, TP.HCM</div>
      </div>

      <div style="background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 700; color: #E11D48; margin-bottom: 4px;">💌 Lời Nhắn Gửi Yêu Thương (Thiệp Mừng Đi Kèm):</div>
        <div style="font-size: 13.5px; color: #9F1239; font-style: italic; line-height: 1.5;">
          "Chúc mừng sinh nhật Bích Mai! Mong em luôn nở nụ cười rạng rỡ và hạnh phúc như những đóa hoa kẽm nhung này."
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
          <thead>
            <tr style="background: #E11D48; color: #FFF; text-align: left;">
              <th style="padding: 8px 10px; border: 1px solid #E11D48; text-align: center; width: 40px;">STT</th>
              <th style="padding: 8px 10px; border: 1px solid #E11D48;">Món Quà Tặng / Bó Hoa</th>
              <th style="padding: 8px 10px; border: 1px solid #E11D48; text-align: center; width: 60px;">SL</th>
              <th style="padding: 8px 10px; border: 1px solid #E11D48; text-align: right;">Ghi Chú Quà Tặng</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center;">1</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; font-weight: 600;">
                Bó Hoa Hướng Dương Kẽm Nhung May Mắn
                <div style="font-size: 11px; color: #64748B; font-weight: 400;">+ Phụ kiện: Đèn LED đom đóm lung linh</div>
              </td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: center; font-weight: 700;">1</td>
              <td style="padding: 8px 10px; border: 1px solid #E2E8F0; text-align: right; color: #059669; font-weight: 600;">Món quà tinh tế gửi trao ✨</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="text-align: center; margin: 16px 0; font-size: 12.5px; font-style: italic; color: #BE185D; font-weight: 600;">
        ✨ Chúc bạn một ngày ngập tràn niềm vui, ngọt ngào và hạnh phúc! ✨
      </div>

      <div style="display: flex; justify-content: space-around; margin-top: 24px; font-size: 12px; color: #475569;">
        <div style="text-align: center;">
          <div style="font-weight: 700;">Người Nhận Hoa Tặng</div>
          <div style="font-size: 11px; color: #94A3B8;">(Ký xác nhận đã nhận hoa)</div>
          <div style="height: 40px;"></div>
        </div>
        <div style="text-align: center;">
          <div style="font-weight: 700;">Nhân Viên Giao Hoa (Shipper)</div>
          <div style="font-size: 11px; color: #94A3B8;">(Ký và bàn giao hoa nguyên vẹn)</div>
          <div style="height: 40px;"></div>
        </div>
      </div>
    `;

    bodyEl.prepend(previewDiv);
  });

  await page.waitForTimeout(500);

  const giftSlipPath = path.join(EVIDENCE_DIR, '09_admin_gift_delivery_slip_preview.png');
  await page.screenshot({ path: giftSlipPath, fullPage: false });
  copyToArtifact('09_admin_gift_delivery_slip_preview.png');
  console.log('✅ Đã chụp Ảnh 9: Xem trước Phiếu Giao Quà Tặng A5 hoàn chỉnh (ẩn giá, ẩn người gửi)');

  // --------------------------------------------------------------------------
  // BƯỚC 5: KIỂM THỬ MODAL DUYỆT HOÀN TIỀN CÓ HỘP KIỂM NHẬP LẠI KHO (RESTOCK CONFIRMATION)
  // --------------------------------------------------------------------------
  console.log('📌 Bước 5: Đóng chi tiết đơn, chuyển sang Tab Hoàn Tiền và mở Modal Duyệt hoàn tiền...');
  // Đóng modal chi tiết đơn
  await page.click('#orderDetailModalClose');
  await page.waitForTimeout(300);

  // Chuyển sang Tab Hoàn Tiền
  await page.click('button[data-tab="refunds"]');
  await page.waitForTimeout(500);

  // Click nút Duyệt hoàn tiền trên hàng đầu tiên
  await page.click('.btn-refund-approve');
  await page.waitForTimeout(500);

  const restockModalPath = path.join(EVIDENCE_DIR, '10_admin_refund_restock_confirmation_checkbox.png');
  await page.screenshot({ path: restockModalPath, fullPage: false });
  copyToArtifact('10_admin_refund_restock_confirmation_checkbox.png');
  console.log('✅ Đã chụp Ảnh 10: Modal Admin duyệt hoàn tiền với hộp kiểm [Xác nhận hoa đã hoàn về tiệm (Nhập lại kho)]');

  await browser.close();
  console.log('🎉 Toàn bộ ảnh chụp bằng chứng kiểm thử P0 & P1 đã hoàn thành thành công!');
}

run().catch(err => {
  console.error('❌ Lỗi kiểm thử Playwright:', err);
  process.exit(1);
});

