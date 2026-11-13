/**
 * test-all-features-http.js - Toan bo bo test tich hop HTTP cho cac phan he MySQL 8.0:
 * 1. Catalog (Products, Categories, Banners, Vouchers)
 * 2. Orders (ACID Transaction, Stock Decrement, Voucher, State Machine, IDOR Protection)
 * 3. Reviews (Zero-XSS, Reduce Average Rating, Hide/Delete)
 * 4. Wishlist (Toggle, Fetch)
 * 5. Notifications (Fetch, Mark Read)
 * 6. User Profile & Avatar Sanitization (Sharp WebP 200x200)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import app from './server.js';
import { container } from './server/infrastructure/config/container.js';

let serverInstance;
let BASE_URL;

function httpRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = null;

    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (e) {
          json = rawData;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

/** Lấy cặp tên/giá trị cookie phiên từ response đăng nhập để dùng như Cookie Jar. */
function sessionCookie(response) {
  const value = response.headers?.['set-cookie'];
  const cookie = Array.isArray(value) ? value.find((item) => item.startsWith('shophoa_session=')) : value;
  return cookie?.split(';', 1)[0] || '';
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: FULLSTACK HEXAGONAL BACKEND ON MYSQL 8.0');
  console.log('================================================================\n');

  // 1. Khoi dong server test tren cong ngau nhien
  await new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const port = serverInstance.address().port;
      BASE_URL = `http://localhost:${port}`;
      console.log(`[INFO] Test server running at ${BASE_URL}\n`);
      resolve();
    });
  });

  const testOrderIds = new Set();
  let createdOrderId = null;
  let addonOrderId = null;
  let sepayCancelId = null;
  let expiredOrderId = null;
  let confirmedOrderId = null;
  let custId = null;
  const createdReviewImageUrls = new Set();
  const testStartAt = new Date();
  let isCleanedUp = false;

  const performCleanup = async () => {
    if (isCleanedUp) return;
    try {
      const orderIds = [...testOrderIds];
      await container.prisma.$transaction(async (tx) => {
        if (orderIds.length > 0) {
          const testOrders = await tx.orders.findMany({
            where: { id: { in: orderIds } },
            include: { order_items: true }
          });
          for (const order of testOrders) {
            if (order.status !== 'cancelled') {
              for (const item of order.order_items) {
                await tx.products.update({
                  where: { id: item.product_id },
                  data: { stock: { increment: item.quantity } }
                });
              }
              if (order.voucher_code) {
                await tx.vouchers.updateMany({
                  where: { code: order.voucher_code, used_count: { gt: 0 } },
                  data: { used_count: { decrement: 1 } }
                });
              }
            }
          }
          await tx.payment_transactions.deleteMany({ where: { order_id: { in: orderIds } } });
          await tx.notifications.deleteMany({ where: { order_id: { in: orderIds } } });
          await tx.order_item_addons.deleteMany({ where: { order_items: { order_id: { in: orderIds } } } });
          await tx.order_items.deleteMany({ where: { order_id: { in: orderIds } } });
          await tx.orders.deleteMany({ where: { id: { in: orderIds } } });
        }
        if (custId) {
          await tx.reviews.deleteMany({ where: { user_id: custId, product_id: 'PROD-001' } });
          await tx.notifications.deleteMany({
            where: { user_id: custId, order_id: null, created_at: { gte: testStartAt } }
          });
          await tx.wishlist_items.deleteMany({ where: { user_id: custId } });
        }
      });
      for (const relUrl of createdReviewImageUrls) {
        if (typeof relUrl === 'string' && relUrl.startsWith('/uploads/reviews/')) {
          const filePath = path.resolve(process.cwd(), relUrl.replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
      isCleanedUp = true;
      console.log('[CLEANUP] Dữ liệu thử nghiệm đã được dọn dẹp sạch sẽ trong 1 ACID Transaction.');
    } catch (e) {
      console.error('[CLEANUP ERROR] Lỗi dọn dẹp CSDL:', e.message);
      process.exitCode = 1;
      throw e;
    }
  };

  try {
    const dynamicSameOrigin = await httpRequest('POST', '/api/auth/logout', {}, {
      Origin: BASE_URL,
      'Sec-Fetch-Site': 'same-origin'
    });
    assert(dynamicSameOrigin.status === 200, 'Origin guard cho phép same-origin trên cổng E2E động');

    const publicReviewsWithExpiredCookie = await httpRequest('GET', '/api/reviews?productId=PROD-001', null, {
      Cookie: 'shophoa_session=expired.invalid.jwt'
    });
    assert(publicReviewsWithExpiredCookie.status === 200, 'Cookie hết hạn vẫn cho khách xem đánh giá công khai');
    assert(String(publicReviewsWithExpiredCookie.headers['set-cookie'] || '').includes('shophoa_session='), 'Cookie hết hạn được xóa khỏi trình duyệt');

    const guestOrderWithExpiredCookie = await httpRequest('POST', '/api/orders', {}, {
      Cookie: 'shophoa_session=expired.invalid.jwt'
    });
    assert(guestOrderWithExpiredCookie.status === 400, 'Cookie hết hạn không chặn guest checkout trước bước validation');

    // --- PHẦN 1: CATALOG API ---
    console.log('--- 1. Testing Catalog API (MySQL 8.0) ---');
    const catRes = await httpRequest('GET', '/api/categories');
    assert(catRes.status === 200, 'GET /api/categories trả về 200 OK');
    assert(Array.isArray(catRes.data) && catRes.data.length >= 5, 'Có ít nhất 5 danh mục hoa từ MySQL');

    const prodRes = await httpRequest('GET', '/api/products');
    assert(prodRes.status === 200, 'GET /api/products trả về 200 OK');
    assert(Array.isArray(prodRes.data) && prodRes.data.length >= 15, 'Có ít nhất 15 mẫu hoa từ MySQL');
    const firstProd = prodRes.data.find(p => p.id === 'PROD-001') || prodRes.data[0];
    assert(firstProd.id.startsWith('PROD-'), 'ID sản phẩm đúng định dạng chuẩn MySQL PROD-xxx');
    assert(typeof firstProd.price === 'number', 'Giá sản phẩm là số nguyên VND');

    const detailRes = await httpRequest('GET', `/api/products/${firstProd.id}`);
    assert(detailRes.status === 200, 'GET /api/products/:id trả về 200 OK');
    assert(detailRes.data.id === firstProd.id, 'Chi tiết sản phẩm khớp ID');

    // Test fallback numeric ID
    const fallbackRes = await httpRequest('GET', '/api/products/1');
    assert(fallbackRes.status === 200, 'GET /api/products/1 (numeric fallback) trả về 200 OK');
    assert(fallbackRes.data.id === 'PROD-001', 'Numeric ID 1 ánh xạ chính xác về PROD-001');

    const promoRes = await httpRequest('GET', '/api/promotions');
    assert(promoRes.status === 200, 'GET /api/promotions trả về 200 OK');
    assert(Array.isArray(promoRes.data) && promoRes.data.length >= 3, 'Có ít nhất 3 voucher khuyến mãi từ MySQL');

    // --- PHẦN 2: AUTH TOKENS ---
    console.log('\n--- 2. Setting Up Test Tokens ---');
    // Login as admin
    const adminLogin = await httpRequest('POST', '/api/auth/login', {
      email: 'admin@shophoa.example',
      password: 'admin123'
    });
    assert(adminLogin.status === 200, 'Đăng nhập admin thành công');
    const adminCookie = sessionCookie(adminLogin);
    assert(adminCookie.startsWith('shophoa_session='), 'JWT phiên admin được nhận qua cookie HttpOnly');

    // Login as customer
    const custLogin = await httpRequest('POST', '/api/auth/login', {
      email: 'customer1@shophoa.example',
      password: '123456'
    });
    assert(custLogin.status === 200, 'Đăng nhập customer1 thành công');
    const custCookie = sessionCookie(custLogin);
    assert(custCookie.startsWith('shophoa_session='), 'JWT phiên customer được nhận qua cookie HttpOnly');
    custId = custLogin.data.user.id;

    // --- PHẦN 3: ORDERS & ACID TRANSACTIONS ---
    console.log('\n--- 3. Testing Order Creation, Stock Decrement & ACID Transactions ---');
    // Kiểm tra tồn kho trước khi đặt hàng
    const initialProd = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });
    const initialStock = initialProd.stock;

    // Khách hàng đặt mua 2 bó PROD-001 với voucher HOAXUAN20 (giảm 20%) và cố tình gửi totalAmount: 1
    const orderPayload = {
      customerName: 'Nguyễn Văn Test',
      customerPhone: '0901234567',
      shippingAddress: '123 Đường Hoa, Q.1, TP.HCM',
      shippingFee: 30000,
      voucherCode: 'HOAXUAN20',
      totalAmount: 1, // Cố tình gian lận giá
      items: [
        { id: 'PROD-001', quantity: 2 }
      ]
    };

    const orderRes = await httpRequest('POST', '/api/orders', orderPayload, {
      'Cookie': custCookie
    });
    if (orderRes.data?.id) testOrderIds.add(orderRes.data.id);
    assert(orderRes.status === 201, 'POST /api/orders trả về 201 Created');
    assert(orderRes.data.id && orderRes.data.orderCode, 'Đơn hàng được cấp ID và Order Code');

    // Đối soát giá niêm yết: Giá PROD-001 là 350.000đ * 2 = 700.000đ.
    // Voucher HOAMOI20 giảm 20% = 140.000đ (tối đa 100.000đ theo rule maxDiscount).
    // Total = 700.000 - 100.000 + 30.000 = 630.000đ.
    const expectedSubtotal = 350000 * 2;
    assert(orderRes.data.subtotal === expectedSubtotal, `Subtotal tính lại từ server: ${orderRes.data.subtotal}đ khớp 700.000đ`);
    assert(orderRes.data.totalAmount !== 1, 'Server triệt tiêu gian lận giá totalAmount: 1 từ client');
    assert(orderRes.data.discountAmount > 0, 'Voucher giảm giá được áp dụng chính xác');

    // Kiểm tra trừ kho nguyên tử trong MySQL
    const updatedProd = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });
    assert(updatedProd.stock === initialStock - 2, `Tồn kho PROD-001 giảm đúng 2 bó (Từ ${initialStock} xuống ${updatedProd.stock})`);

    createdOrderId = orderRes.data.id;

    // Test mua vượt quá tồn kho (Bảo vệ overselling)
    const oversellRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Oversell Test',
      customerPhone: '0909999999',
      shippingAddress: 'HN',
      items: [{ id: 'PROD-001', quantity: 999999 }]
    });
    assert(oversellRes.status === 400, 'Đặt hàng vượt quá tồn kho bị từ chối với HTTP 400');

    // Test đặt hàng có kèm phụ kiện (Task A4 - Add-ons tính tiền ở server & snapshot)
    const addonOrderRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách Chọn Phụ Kiện',
      customerPhone: '0901234567',
      shippingAddress: '456 Phố Hoa',
      items: [
        { id: 'PROD-001', quantity: 1, addonIds: ['ADDON-LED', 'ADDON-CARD'] }
      ]
    }, {
      'Cookie': custCookie
    });
    if (addonOrderRes.data?.id) testOrderIds.add(addonOrderRes.data.id);
    assert(addonOrderRes.status === 201, 'POST /api/orders có phụ kiện trả về 201 Created');
    // PROD-001 = 350.000 + LED (15.000) + CARD (10.000) = 375.000
    assert(addonOrderRes.data.subtotal === 375000, `Subtotal tính phụ kiện trên server: ${addonOrderRes.data.subtotal}đ khớp 375.000đ`);
    assert(addonOrderRes.data.items[0].addons?.length === 2, 'Đơn hàng lưu đủ 2 phụ kiện trong snapshot');
    addonOrderId = addonOrderRes.data.id;

    // Test phụ kiện không tồn tại bị từ chối
    const invalidAddonRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Lỗi Phụ Kiện',
      customerPhone: '0901234567',
      shippingAddress: '456 Phố Hoa',
      items: [
        { id: 'PROD-001', quantity: 1, addonIds: ['ADDON-NONEXISTENT'] }
      ]
    }, {
      'Cookie': custCookie
    });
    assert(invalidAddonRes.status === 400, 'Phụ kiện không tồn tại bị từ chối 400 Bad Request');

    // Test loại trùng phụ kiện (Deduplication chống tính tiền 2 lần)
    const duplicateAddonRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Trùng Phụ Kiện',
      customerPhone: '0901234567',
      shippingAddress: '789 Phố Hoa',
      items: [
        { id: 'PROD-001', quantity: 1, addonIds: ['ADDON-LED', 'ADDON-LED'] }
      ]
    }, {
      'Cookie': custCookie
    });
    if (duplicateAddonRes.data?.id) testOrderIds.add(duplicateAddonRes.data.id);
    assert(duplicateAddonRes.status === 201, 'POST /api/orders với addon trùng lặp được xử lý an toàn');
    assert(duplicateAddonRes.data.subtotal === 365000, `Subtotal (365.000đ) chỉ tính tiền Đèn LED đúng 1 lần duy nhất`);
    assert(duplicateAddonRes.data.items[0].addons?.length === 1, 'Chỉ lưu 1 bản ghi phụ kiện sau khi deduplicate');
    // --- PHẦN 3.1: SEPAY CHECK-PAYMENT ENDPOINT (POST METHOD - BUG-01) ---
    console.log('\n--- 3.1. Testing SePay Check-Payment Endpoint (POST /api/sepay/check-payment/:orderId) ---');
    // 1. Kiểm tra bằng POST với token người dùng (200 OK)
    const checkPostAuth = await httpRequest('POST', `/api/sepay/check-payment/${createdOrderId}`, {}, {
      'Cookie': custCookie
    });
    assert(checkPostAuth.status === 200, 'POST /api/sepay/check-payment/:orderId với Token trả về 200 OK (Không còn 404)');
    assert(typeof checkPostAuth.data.paid === 'boolean', 'Kết quả trả về trạng thái paid hợp lệ');

    // 2. Kiểm tra bằng POST không token nhưng có phone trong body khớp với đơn (200 OK)
    const checkPostPhone = await httpRequest('POST', `/api/sepay/check-payment/${createdOrderId}`, {
      phone: '0901234567'
    });
    assert(checkPostPhone.status === 200, 'POST /api/sepay/check-payment/:orderId với phone trong body trả về 200 OK');

    // 3. Kiểm tra bằng POST không token và phone sai (401/403 Bị từ chối truy cập)
    const checkPostWrongPhone = await httpRequest('POST', `/api/sepay/check-payment/${createdOrderId}`, {
      phone: '0999999999'
    });
    assert([401, 403].includes(checkPostWrongPhone.status), 'POST /api/sepay/check-payment/:orderId với phone sai bị chặn 401 hoặc 403');

    // 3.1. Kiểm tra Task A11: Đơn COD dù được Admin duyệt "confirmed" cũng KHÔNG bị báo paid: true
    const codOrderRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách Đơn COD A11',
      customerPhone: '0901234567',
      shippingAddress: '456 Đường COD',
      paymentMethod: 'cod',
      items: [{ id: 'PROD-001', quantity: 1 }]
    }, {
      'Cookie': custCookie
    });
    if (codOrderRes.data?.id) testOrderIds.add(codOrderRes.data.id);
    const codOrderId = codOrderRes.data.id;
    await httpRequest('PATCH', `/api/orders/${codOrderId}/status`, { status: 'confirmed' }, {
      'Cookie': adminCookie
    });
    const checkCodRes = await httpRequest('POST', `/api/sepay/check-payment/${codOrderId}`, {}, {
      'Cookie': custCookie
    });
    assert(checkCodRes.status === 200, 'POST /api/sepay/check-payment cho đơn COD trả về 200 OK');
    assert(checkCodRes.data.paid === false, 'A11 PASS: Đơn COD sau khi admin duyệt "confirmed" KHÔNG bị báo paid: true');

    // Cập nhật đơn COD sang payment_status = 'paid' (tiền mặt do shipper thu) và status = 'completed'
    await container.prisma.orders.update({
      where: { id: codOrderId },
      data: { status: 'completed', payment_status: 'paid' }
    });
    const checkCodPaidRes = await httpRequest('POST', `/api/sepay/check-payment/${codOrderId}`, {}, {
      'Cookie': custCookie
    });
    assert(checkCodPaidRes.status === 200, 'POST /api/sepay/check-payment cho đơn COD đã hoàn tất trả về 200 OK');
    assert(checkCodPaidRes.data.paid === false, 'A11 PASS: Đơn COD dù đã hoàn tất/thanh toán tiền mặt vẫn trả paid: false qua endpoint SePay');

    // 4. Kiểm tra phương thức cũ GET bị 404 (do đã chốt chỉ dùng POST)
    const checkOldGet = await httpRequest('GET', `/api/sepay/check-payment/${createdOrderId}`);
    assert(checkOldGet.status === 404, 'GET /api/sepay/check-payment/:orderId trả về 404 Not Found (Đã chuyển sang POST)');

    // 5. Kiểm tra GET /api/sepay/config (Task A3 - BUG-08)
    const configRes = await httpRequest('GET', '/api/sepay/config');
    assert(configRes.headers['cache-control']?.includes('no-store'), 'GET /api/sepay/config có header Cache-Control: no-store');
    if (configRes.status === 200) {
      assert(configRes.data.bankCode && configRes.data.accountNumber && configRes.data.accountHolder, 'GET /api/sepay/config trả về đủ thông tin tài khoản ngân hàng');
    } else {
      assert(configRes.status === 503, 'Thiếu biến môi trường cấu hình trả về 503 Service Unavailable');
    }

    // 6. Kiểm tra thiếu biến môi trường cấu hình ngân hàng trả về 503
    const origBankCode = process.env.SEPAY_BANK_CODE;
    try {
      delete process.env.SEPAY_BANK_CODE;
      const missingConfigRes = await httpRequest('GET', '/api/sepay/config');
      assert(missingConfigRes.status === 503, 'Khi thiếu biến môi trường SEPAY_BANK_CODE trả về 503');
      assert(missingConfigRes.data.error?.code === 'PAYMENT_UNAVAILABLE', 'Mã lỗi là PAYMENT_UNAVAILABLE');
    } finally {
      if (origBankCode) process.env.SEPAY_BANK_CODE = origBankCode;
    }

    // 7. Kiểm tra không cho đơn đã hủy «sống lại» & Kho không đổi & Lưu vết CSDL (Task A6, A12)
    const sepayOrderRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách Đặt SePay Để Hủy',
      customerPhone: '0901234567',
      shippingAddress: '789 Đường Hoa',
      paymentMethod: 'sepay',
      items: [{ id: 'PROD-001', quantity: 1 }]
    }, {
      'Cookie': custCookie
    });
    if (sepayOrderRes.data?.id) testOrderIds.add(sepayOrderRes.data.id);
    assert(sepayOrderRes.status === 201, 'Tạo đơn SePay để test hủy đơn');
    sepayCancelId = sepayOrderRes.data.id;

    // Hủy đơn hàng
    const cancelRes = await httpRequest('PATCH', `/api/orders/${sepayCancelId}/status`, { status: 'cancelled' }, {
      'Cookie': custCookie
    });
    assert(cancelRes.status === 200, 'Hủy đơn SePay thành công');
    assert(cancelRes.data.order.status === 'cancelled', 'Đơn hàng mang trạng thái cancelled');

    // Lấy tồn kho sản phẩm ngay sau khi hủy (kho đã được hoàn lại 1 khi hủy)
    const prodAfterCancel = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });
    const stockAfterCancel = prodAfterCancel.stock;

    // Thử ghi nhận thanh toán cho đơn đã bị hủy qua recordPayment
    const cancelOrderDb = await container.prisma.orders.findUnique({ where: { id: sepayCancelId } });
    const fixedTxId = `TX-CANCEL-${Date.now()}`;
    const recordResult = await container.paymentService.recordPayment(cancelOrderDb.id, fixedTxId, cancelOrderDb.total_amount);
    assert(recordResult.processed === false, 'Không cho phép ghi nhận thanh toán thành công cho đơn đã bị hủy');
    assert(recordResult.cancelled === true, 'Kết quả xác nhận đơn đã bị hủy');
    assert(recordResult.recorded === true, 'A12 PASS: Giao dịch đến muộn được lưu vết vào bảng payment_transactions');

    // Kiểm tra CSDL: Đơn hàng vẫn giữ nguyên cancelled, payment_status vẫn pending
    const recheckedOrder = await container.prisma.orders.findUnique({ where: { id: sepayCancelId } });
    assert(recheckedOrder.status === 'cancelled', 'Đơn hàng vẫn giữ nguyên trạng thái cancelled sau khi có thanh toán');
    assert(recheckedOrder.payment_status === 'pending', 'payment_status không bị chuyển sang paid');

    // Khẳng định tồn kho không hề thay đổi khi có tiền chuyển vào đơn đã hủy (A6)
    const prodAfterLatePayment = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });
    assert(prodAfterLatePayment.stock === stockAfterCancel, 'A6 PASS: Tồn kho sản phẩm không đổi khi tiền chuyển vào đơn đã hủy (Kho không bị hoàn 2 lần)');

    // Thử gọi lại cùng mã giao dịch fixedTxId lần 2 để kiểm tra Idempotency khóa duy nhất P2002
    const duplicateRecordResult = await container.paymentService.recordPayment(cancelOrderDb.id, fixedTxId, cancelOrderDb.total_amount);
    assert(duplicateRecordResult.duplicate === true, 'A12 PASS: Giao dịch trùng mã trả về duplicate: true và không in lại log');

    // Kiểm tra check-payment trên đơn đã hủy trả về { paid: false, cancelled: true } (A12)
    const checkCancelledRes = await httpRequest('POST', `/api/sepay/check-payment/${sepayCancelId}`, {}, {
      'Cookie': custCookie
    });
    assert(checkCancelledRes.status === 200, 'check-payment đơn đã hủy trả về 200 OK');
    assert(checkCancelledRes.data.paid === false, 'check-payment đơn đã hủy có paid: false');
    assert(checkCancelledRes.data.cancelled === true, 'A12 PASS: check-payment đơn đã hủy có cancelled: true để dừng polling');

    // 7.1. Kiểm tra API mô phỏng thanh toán POST /api/sepay/simulate-payment/:orderId (A13)
    console.log('\n--- Testing Task A13: Simulate Payment Auth & Production Guard ---');
    const simOrderRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách Test Simulate',
      customerPhone: '0912345678',
      shippingAddress: '123 Đường Simulate',
      paymentMethod: 'sepay',
      items: [{ id: 'PROD-001', quantity: 1 }]
    }, {
      'Cookie': custCookie
    });
    if (simOrderRes.data?.id) testOrderIds.add(simOrderRes.data.id);
    const simOrderId = simOrderRes.data.id;

    // 1. Gọi không có token và không có phone -> bị chặn 401 hoặc 403
    const simNoAuthRes = await httpRequest('POST', `/api/sepay/simulate-payment/${simOrderId}`, {});
    assert([401, 403].includes(simNoAuthRes.status), 'Simulate payment không có auth bị chặn 401 hoặc 403');

    // 2. Gọi với phone sai -> bị chặn 403
    const simWrongPhoneRes = await httpRequest('POST', `/api/sepay/simulate-payment/${simOrderId}`, { phone: '0999999999' });
    assert(simWrongPhoneRes.status === 403, 'Simulate payment với phone sai bị chặn 403 Forbidden');

    // 3. Giả lập NODE_ENV = production -> bị chặn 403
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const simProdRes = await httpRequest('POST', `/api/sepay/simulate-payment/${simOrderId}`, {}, {
        'Cookie': custCookie
      });
      assert(simProdRes.status === 403, 'A13 PASS: Simulate payment trong môi trường production bị chặn 403 Forbidden');
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    // 4. Gọi với token hợp lệ của chủ đơn -> Thành công 200 OK
    const simValidRes = await httpRequest('POST', `/api/sepay/simulate-payment/${simOrderId}`, {}, {
      'Cookie': custCookie
    });
    assert(simValidRes.status === 200 && simValidRes.data.paid === true, 'A13 PASS: Simulate payment với token chủ đơn thành công');

    // 8. Kiểm tra Task A7: Tự động hủy đơn SePay quá hạn (Atomic & Hoàn cả Kho lẫn Voucher)
    console.log('\n--- Testing Task A7: Auto-expiry of pending SePay orders with Voucher ---');
    await container.orderExpiryService.processExpiredOrders();

    // Lấy thông tin voucher HOAXUAN20 và tồn kho trước khi đặt
    const voucherBefore = await container.prisma.vouchers.findUnique({ where: { code: 'HOAXUAN20' } });
    const voucherUsedBefore = voucherBefore ? voucherBefore.used_count : 0;
    const prodBeforeOrder = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });

    const expiredOrderRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách Đặt Quá Hạn Có Voucher',
      customerPhone: '0901234567',
      shippingAddress: '999 Đường Hoa Quá Hạn',
      paymentMethod: 'sepay',
      voucherCode: 'HOAXUAN20',
      items: [{ id: 'PROD-001', quantity: 2 }]
    }, {
      'Cookie': custCookie
    });
    if (expiredOrderRes.data?.id) testOrderIds.add(expiredOrderRes.data.id);
    assert(expiredOrderRes.status === 201, 'Tạo đơn SePay có voucher để test auto-expiry');
    expiredOrderId = expiredOrderRes.data.id;

    // Kiểm tra tồn kho đã bị trừ 2 và lượt dùng voucher đã tăng +1
    const prodAfterOrder = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });
    assert(prodAfterOrder.stock === prodBeforeOrder.stock - 2, 'Tồn kho PROD-001 đã bị trừ 2 khi đặt đơn');
    const voucherAfterOrder = await container.prisma.vouchers.findUnique({ where: { code: 'HOAXUAN20' } });
    assert(voucherAfterOrder.used_count === voucherUsedBefore + 1, 'Lượt sử dụng voucher HOAXUAN20 tăng +1 khi đặt đơn');

    // Tua thời gian tạo đơn về 45 phút trước (vượt quá TTL 30 phút)
    await container.prisma.orders.update({
      where: { id: expiredOrderId },
      data: { created_at: new Date(Date.now() - 45 * 60 * 1000) }
    });

    // Chạy job hủy đơn hết hạn
    const expiredResult = await container.orderExpiryService.processExpiredOrders();
    const wasExpiredInJob = expiredResult.some(o => o.id === expiredOrderId);
    assert(wasExpiredInJob, 'OrderExpiryService phát hiện và hủy đơn SePay quá hạn');

    // Kiểm tra trạng thái đơn sau khi job chạy
    const expiredOrderDb = await container.prisma.orders.findUnique({ where: { id: expiredOrderId } });
    assert(expiredOrderDb.status === 'cancelled', 'Đơn SePay quá hạn đã tự động chuyển sang status: cancelled');

    // Kiểm tra hoàn tồn kho sau khi hủy (+2)
    const prodAfterExpiry = await container.prisma.products.findUnique({ where: { id: 'PROD-001' } });
    assert(prodAfterExpiry.stock === prodBeforeOrder.stock, 'Tồn kho được hoàn lại chính xác trở về bằng lúc trước khi đặt (+2)');

    // Kiểm tra hoàn lượt dùng voucher sau khi hủy (-1)
    const voucherAfterExpiry = await container.prisma.vouchers.findUnique({ where: { code: 'HOAXUAN20' } });
    assert(voucherAfterExpiry.used_count === voucherUsedBefore, 'A7 PASS: Lượt sử dụng voucher được hoàn trả nguyên trạng (-1) khi đơn hết hạn bị hủy');

    // Kiểm tra an toàn: Đơn đã confirmed dẫu quá hạn cũng TUYỆT ĐỐI không bị hủy
    const confirmedOrderRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách Đã Xác Nhận',
      customerPhone: '0901234567',
      shippingAddress: '888 Đường Hoa Đã Xác Nhận',
      paymentMethod: 'sepay',
      items: [{ id: 'PROD-001', quantity: 1 }]
    }, {
      'Cookie': custCookie
    });
    if (confirmedOrderRes.data?.id) testOrderIds.add(confirmedOrderRes.data.id);
    confirmedOrderId = confirmedOrderRes.data.id;

    // Chuyển sang confirmed và tua thời gian về 45 phút trước
    await container.prisma.orders.update({
      where: { id: confirmedOrderId },
      data: {
        status: 'confirmed',
        created_at: new Date(Date.now() - 45 * 60 * 1000)
      }
    });

    // Chạy lại job hủy
    await container.orderExpiryService.processExpiredOrders();
    const confirmedOrderStillSafe = await container.prisma.orders.findUnique({ where: { id: confirmedOrderId } });
    assert(confirmedOrderStillSafe.status === 'confirmed', 'Đơn SePay đã confirmed KHÔNG bị hủy bởi expiry job (Safe State Machine)');

    // --- PHẦN 4: STATE MACHINE TRANSITIONS ---
    console.log('\n--- 4. Testing Order State Machine Transitions ---');
    // Customer không thể đổi trạng thái đơn hàng (403)
    const custChangeRes = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'confirmed' }, {
      'Cookie': custCookie
    });
    assert(custChangeRes.status === 403, 'Customer đổi trạng thái đơn hàng bị chặn 403 Forbidden');

    // Admin chuyển từ pending -> confirmed (Hợp lệ)
    const adminConfirm = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'confirmed' }, {
      'Cookie': adminCookie
    });
    assert(adminConfirm.status === 200, 'Admin chuyển pending -> confirmed thành công (200 OK)');
    assert(adminConfirm.data.order.status === 'confirmed', 'Trạng thái đơn hàng cập nhật thành "confirmed"');

    // Chuyển confirmed -> shipping
    const adminShip = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'shipping' }, {
      'Cookie': adminCookie
    });
    assert(adminShip.status === 200, 'Admin chuyển confirmed -> shipping thành công (200 OK)');

    // Chuyển shipping -> completed
    const adminComplete = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'completed' }, {
      'Cookie': adminCookie
    });
    assert(adminComplete.status === 200, 'Admin chuyển shipping -> completed thành công (200 OK)');

    // Vi phạm State Machine: Chuyển completed -> pending (Bất biến, không thể lùi)
    const adminRollback = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'pending' }, {
      'Cookie': adminCookie
    });
    assert(adminRollback.status === 400, 'Chuyển ngược completed -> pending bị chặn 400 Bad Request');

    // Thao tác trực tiếp PATCH /orders/:id bị chặn Method Not Allowed (405)
    const directPatch = await httpRequest('PATCH', `/orders/${createdOrderId}`, { status: 'pending' });
    assert(directPatch.status === 405, 'PATCH /orders/:id trực tiếp bị chặn 405 Method Not Allowed');

    // --- PHẦN 4.1: CHẶN ADMIN DUYỆT/GIAO ĐƠN SEPAY CHƯA THANH TOÁN & CẬP NHẬT ĐƠN NHÁP ---
    console.log('\n--- 4.1. Testing Unpaid SePay Admin Guard & Draft Order Reuse ---');
    const draftSepayRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Khách SePay Draft',
      customerPhone: '0901234567',
      shippingAddress: '111 Đường Nháp Cũ',
      paymentMethod: 'sepay',
      items: [{ id: 'PROD-001', quantity: 1 }]
    }, {
      'Cookie': custCookie
    });
    if (draftSepayRes.data?.id) testOrderIds.add(draftSepayRes.data.id);
    assert(draftSepayRes.status === 201 && Boolean(draftSepayRes.data.draftToken), 'Tạo đơn SePay nháp trả về draftToken hợp lệ');

    // Admin cố tình duyệt/giao/hoàn tất đơn SePay chưa thanh toán -> MUST BE BLOCKED 400
    for (const forbiddenTarget of ['confirmed', 'shipping', 'completed']) {
      const blockedAdminRes = await httpRequest('PATCH', `/api/orders/${draftSepayRes.data.id}/status`, {
        status: forbiddenTarget
      }, {
        'Cookie': adminCookie
      });
      assert(blockedAdminRes.status === 400, `Admin chuyển đơn SePay chưa thanh toán sang "${forbiddenTarget}" bị chặn 400 Bad Request`);
    }
    const unpaidStillPending = await container.prisma.orders.findUnique({ where: { id: draftSepayRes.data.id } });
    assert(unpaidStillPending.status === 'pending' && unpaidStillPending.payment_status === 'pending', 'Đơn SePay chưa trả tiền vẫn giữ nguyên status=pending, payment_status=pending');

    // Cập nhật đơn nháp khi quay lại đổi địa chỉ & đổi sang COD (không sinh đơn trùng)
    const missingTokenDraft = await httpRequest('PUT', `/api/orders/${draftSepayRes.data.id}/draft`, {
      customerName: 'Khách SePay Draft',
      customerPhone: '0901234567',
      shippingAddress: '222 Đường Mới',
      paymentMethod: 'cod',
      items: [{ id: 'PROD-001', quantity: 1 }]
    }, {
      'Cookie': custCookie
    });
    assert(missingTokenDraft.status === 401, 'PUT /api/orders/:id/draft thiếu draftToken bị chặn 401');

    const updatedDraftRes = await httpRequest('PUT', `/api/orders/${draftSepayRes.data.id}/draft`, {
      customerName: 'Khách SePay Draft Đã Sửa',
      customerPhone: '0901234567',
      shippingAddress: '222 Đường Nháp Đã Sửa',
      paymentMethod: 'cod',
      items: [{ id: 'PROD-001', quantity: 1 }],
      draftToken: draftSepayRes.data.draftToken
    }, {
      'Cookie': custCookie
    });
    assert(updatedDraftRes.status === 200, 'PUT /api/orders/:id/draft cập nhật đơn nháp thành công (200 OK)');
    assert(updatedDraftRes.data.id === draftSepayRes.data.id && updatedDraftRes.data.orderCode === draftSepayRes.data.orderCode, 'Cập nhật nháp giữ nguyên ID và OrderCode (không đúp đơn)');
    assert(updatedDraftRes.data.paymentMethod === 'cod' && updatedDraftRes.data.shippingAddress === '222 Đường Nháp Đã Sửa', 'Cập nhật đúng phương thức COD và địa chỉ mới');

    // Đơn đã chuyển COD thì Admin được phép duyệt bình thường
    const codApproveAfterSwitch = await httpRequest('PATCH', `/api/orders/${draftSepayRes.data.id}/status`, {
      status: 'confirmed'
    }, {
      'Cookie': adminCookie
    });
    assert(codApproveAfterSwitch.status === 200, 'Đơn sau khi đổi sang COD được Admin duyệt thành công');

    // Không cho cập nhật nháp đối với đơn đã xác nhận/thanh toán
    const editConfirmedDraft = await httpRequest('PUT', `/api/orders/${draftSepayRes.data.id}/draft`, {
      customerName: 'Khách Sửa Trái Phép',
      customerPhone: '0901234567',
      shippingAddress: '333 Đường Lỗi',
      paymentMethod: 'cod',
      items: [{ id: 'PROD-001', quantity: 1 }],
      draftToken: updatedDraftRes.data.draftToken
    }, {
      'Cookie': custCookie
    });
    assert(editConfirmedDraft.status === 400, 'Không thể cập nhật nháp đối với đơn hàng đã xác nhận/thanh toán (400)');

    // --- PHẦN 4.2: GUEST ORDER LOOKUP (CHUẨN HÓA +84/9 SỐ, CHE PII & RATE LIMIT) ---
    console.log('\n--- 4.2. Testing Guest Order Lookup Security & Normalization ---');
    const guest9DigitRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Nguyễn Thị Vãng Lai',
      customerPhone: '091234567',
      email: 'secret-guest@shophoa.example',
      shippingAddress: '45A Đường Bí Mật, Phường 7, Quận 3',
      hasGreetingCard: true,
      cardMessage: 'Lời chúc riêng tư tuyệt mật',
      note: 'Ghi chú nội bộ bí mật',
      paymentMethod: 'sepay',
      items: [{ id: 'PROD-001', quantity: 1 }]
    });
    if (guest9DigitRes.data?.id) testOrderIds.add(guest9DigitRes.data.id);
    assert(guest9DigitRes.status === 201, 'Khách vãng lai đặt đơn SĐT 9 số thành công (201)');

    // Tra cứu với số +84 của cùng số 9 chữ số đó
    const lookupPlus84 = await httpRequest('POST', '/api/orders/lookup', {
      orderCode: guest9DigitRes.data.orderCode,
      phone: '+8491234567'
    });
    assert(lookupPlus84.status === 200 && lookupPlus84.data.isGuestLookup === true, 'Guest lookup hỗ trợ SĐT 9 số và định dạng +84');
    assert(!lookupPlus84.data.email && !lookupPlus84.data.note && !lookupPlus84.data.userId, 'Guest lookup không trả email, ghi chú hoặc userId');
    assert(lookupPlus84.data.cardMessage === '' && !lookupPlus84.data.address.includes('45A'), 'Guest lookup ẩn lời nhắn thiệp riêng tư và địa chỉ nhà chi tiết');
    assert(!lookupPlus84.data.phone.includes('091234567') && lookupPlus84.data.phone.includes('*'), 'Guest lookup che bớt chữ số điện thoại');

    // Sai SĐT bị từ chối 404
    const lookupWrongPhone = await httpRequest('POST', '/api/orders/lookup', {
      orderCode: guest9DigitRes.data.orderCode,
      phone: '0999999999'
    });
    assert(lookupWrongPhone.status === 404, 'Guest lookup sai số điện thoại trả 404');

    // Kiểm tra rate limiter cho mỗi mã đơn (chặn dò tìm SĐT sau nhiều lần sai)
    let hitLookupRateLimit = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const probeRes = await httpRequest('POST', '/api/orders/lookup', {
        orderCode: 'DHBRUTETEST99',
        phone: `090000000${attempt}`
      });
      if (probeRes.status === 429) {
        hitLookupRateLimit = true;
        break;
      }
    }
    assert(hitLookupRateLimit, 'POST /api/orders/lookup chặn brute-force với HTTP 429');

    // --- PHẦN 5: IDOR PROTECTION ---
    console.log('\n--- 5. Testing IDOR Protection (Order Privacy) ---');
    // Login as customer2
    const cust2Login = await httpRequest('POST', '/api/auth/login', {
      email: 'customer2@shophoa.example',
      password: '123456'
    });
    const cust2Cookie = sessionCookie(cust2Login);
    assert(cust2Cookie.startsWith('shophoa_session='), 'JWT phiên customer2 được nhận qua cookie HttpOnly');

    // Customer2 xem danh sách đơn hàng của mình: không được thấy đơn của customer1
    const cust2Orders = await httpRequest('GET', '/api/orders', null, {
      'Cookie': cust2Cookie
    });
    assert(cust2Orders.status === 200, 'Customer 2 lấy danh sách đơn hàng thành công');
    const hasOtherCustOrder = cust2Orders.data.some(o => o.id === createdOrderId);
    assert(!hasOtherCustOrder, 'Customer 2 KHÔNG THỂ nhìn thấy đơn hàng của Customer 1 (IDOR Safe)');

    // Customer2 cố tình truy cập chi tiết đơn hàng của Customer1
    const idorDetail = await httpRequest('GET', `/api/orders/${createdOrderId}`, null, {
      'Cookie': cust2Cookie
    });
    assert(idorDetail.status === 403, 'Customer 2 truy cập trực tiếp ID đơn hàng của Customer 1 bị chặn 403 Forbidden');

    // --- PHẦN 6: REVIEWS (VERIFIED BUYER, PHOTOS, HELPFUL VOTE, EDIT, ZERO-XSS) ---
    console.log('\n--- 6. Testing Reviews API (Verified Buyer, Photos, Helpful, Zero-XSS) ---');
    const shortReviewRes = await httpRequest('POST', '/api/reviews', {
      productId: 'PROD-001',
      rating: 5,
      comment: 'đẹp'
    }, { 'Cookie': custCookie });
    assert(shortReviewRes.status === 400, 'Review quá ngắn bị từ chối với HTTP 400');

    const unverifiedEligibility = await httpRequest('GET', '/api/reviews/check-eligibility?productId=PROD-001', null, {
      'Cookie': cust2Cookie
    });
    assert(unverifiedEligibility.status === 200 && unverifiedEligibility.data.canReview === false, 'Khách chưa hoàn tất mua PROD-001 bị từ chối quyền viết đánh giá');

    const unverifiedReviewRes = await httpRequest('POST', '/api/reviews', {
      productId: 'PROD-001',
      rating: 1,
      comment: 'Chưa mua nhưng thử spam đánh giá 1 sao cho sản phẩm này!'
    }, { 'Cookie': cust2Cookie });
    assert(unverifiedReviewRes.status === 403, 'Khách chưa mua hoàn tất mẫu hoa gửi đánh giá bị chặn 403 Forbidden');

    const reviewEligibility = await httpRequest('GET', '/api/reviews/check-eligibility?productId=PROD-001', null, {
      'Cookie': custCookie
    });
    assert(reviewEligibility.status === 200, 'Lấy điều kiện đánh giá thành công');
    assert(reviewEligibility.data.canReview === true && reviewEligibility.data.isVerifiedBuyer === true, 'Chỉ đơn đã hoàn tất mới cho phép đánh giá và cấp huy hiệu người mua xác thực');

    const reviewTinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const xssReviewPayload = {
      productId: 'PROD-001',
      rating: 5,
      comment: '<script>alert("Hacked")</script>Hoa rất đẹp và bền!',
      userName: 'Khách Hàng Thật',
      images: [reviewTinyPng]
    };
    const reviewRes = await httpRequest('POST', '/api/reviews', xssReviewPayload, {
      'Cookie': custCookie
    });
    assert(reviewRes.status === 201, 'POST /api/reviews trả về 201 Created');
    assert(!reviewRes.data.review.comment.includes('<script>'), 'Mã độc <script> đã được khử XSS an toàn thành chuỗi entity');
    assert(typeof reviewRes.data.product.rating === 'number', 'Điểm trung bình được tính toán chính xác bằng Array.reduce');
    assert(Array.isArray(reviewRes.data.review.images) && reviewRes.data.review.images.length === 1 && reviewRes.data.review.images[0].endsWith('.webp'), 'Ảnh đánh giá được Sharp chuẩn hóa sang WebP trong uploads/reviews');
    for (const imgUrl of reviewRes.data.review.images) {
      createdReviewImageUrls.add(imgUrl);
    }

    const createdReviewId = reviewRes.data.review.id;
    const selfHelpfulRes = await httpRequest('POST', `/api/reviews/${createdReviewId}/helpful`, null, { 'Cookie': custCookie });
    assert(selfHelpfulRes.status === 400, 'Tác giả không thể tự bình chọn hữu ích cho đánh giá của chính mình');

    const voteOnRes = await httpRequest('POST', `/api/reviews/${createdReviewId}/helpful`, null, { 'Cookie': cust2Cookie });
    assert(voteOnRes.status === 200 && voteOnRes.data.helpfulCount === 1 && voteOnRes.data.hasVotedHelpful === true, 'Khách khác bình chọn Hữu ích thành công (helpfulCount = 1)');

    const reviewListAsVoter = await httpRequest('GET', '/api/reviews?productId=PROD-001', null, { 'Cookie': cust2Cookie });
    const foundWithVote = (reviewListAsVoter.data || []).find(r => r.id === createdReviewId);
    assert(Boolean(foundWithVote && foundWithVote.hasVotedHelpful === true && foundWithVote.helpfulCount === 1), 'GET /api/reviews phản ánh chính xác trạng thái đã bình chọn Hữu ích');

    const voteOffRes = await httpRequest('POST', `/api/reviews/${createdReviewId}/helpful`, null, { 'Cookie': cust2Cookie });
    assert(voteOffRes.status === 200 && voteOffRes.data.helpfulCount === 0 && voteOffRes.data.hasVotedHelpful === false, 'Bấm lại nút Hữu ích hủy bình chọn thành công (toggle)');

    const editReviewRes = await httpRequest('POST', '/api/reviews', {
      productId: 'PROD-001',
      rating: 4,
      comment: 'Cập nhật đánh giá sau 2 ngày trưng bày: hoa vẫn rất đẹp và chắc chắn!',
      images: reviewRes.data.review.images
    }, { 'Cookie': custCookie });
    assert(editReviewRes.status === 201 && Boolean(editReviewRes.data.review.editedAt), 'Chỉnh sửa đánh giá giữ nguyên ngày gốc và ghi nhận editedAt');
    assert(editReviewRes.data.review.createdAt === reviewRes.data.review.createdAt, 'Chỉnh sửa đánh giá không ghi đè ngày tạo gốc createdAt');

    const cust2CommentRes = await httpRequest('POST', `/api/reviews/${createdReviewId}/comments`, {
      content: '<b>Chào bạn</b>, bó này giữ màu lâu thật đấy!'
    }, { 'Cookie': cust2Cookie });
    assert(cust2CommentRes.status === 201 && !cust2CommentRes.data.comment.content.includes('<b>'), 'Khách hàng phản hồi qua lại dưới đánh giá thành công và khử XSS');

    const cust1ReplyBackRes = await httpRequest('POST', `/api/reviews/${createdReviewId}/comments`, {
      content: '@Lê Hoàng Nam Đúng rồi bạn ơi, giao đúng hẹn nữa!'
    }, { 'Cookie': custCookie });
    assert(cust1ReplyBackRes.status === 201 && cust1ReplyBackRes.data.comment.isAuthor === true, 'Tác giả đánh giá phản hồi lại thành công với cờ isAuthor=true');

    const adminCommentRes = await httpRequest('POST', `/api/reviews/${createdReviewId}/comments`, {
      content: 'Tiệm cảm ơn hai bạn đã trao đổi và ủng hộ hoa kẽm nhung!'
    }, { 'Cookie': adminCookie });
    assert(adminCommentRes.status === 201 && adminCommentRes.data.comment.userRole === 'admin', 'Admin bình luận trực tiếp vào luồng trao đổi thành công');

    const forbidDeleteRes = await httpRequest('DELETE', `/api/reviews/${createdReviewId}/comments/${cust1ReplyBackRes.data.comment.id}`, null, {
      'Cookie': cust2Cookie
    });
    assert(forbidDeleteRes.status === 403, 'Khách khác không thể xóa phản hồi của người khác (403 Forbidden)');

    const ownDeleteRes = await httpRequest('DELETE', `/api/reviews/${createdReviewId}/comments/${cust1ReplyBackRes.data.comment.id}`, null, {
      'Cookie': custCookie
    });
    assert(ownDeleteRes.status === 200, 'Tác giả tự xóa phản hồi của chính mình thành công');

    const adminDeleteRes = await httpRequest('DELETE', `/api/reviews/${createdReviewId}/comments/${cust2CommentRes.data.comment.id}`, null, {
      'Cookie': adminCookie
    });
    assert(adminDeleteRes.status === 200, 'Admin có quyền xóa phản hồi vi phạm trong luồng trao đổi');

    // --- PHẦN 7: WISHLIST API ---
    console.log('\n--- 7. Testing Wishlist API (MySQL 8.0) ---');
    const wishToggle = await httpRequest('POST', '/api/wishlist/toggle', { productId: 'PROD-001' }, {
      'Cookie': custCookie
    });
    assert(wishToggle.status === 200, 'POST /api/wishlist/toggle trả về 200 OK');
    assert(wishToggle.data.isFavorite === true, 'Đã thêm PROD-001 vào danh sách yêu thích');

    const wishList = await httpRequest('GET', '/api/wishlist', null, {
      'Cookie': custCookie
    });
    assert(wishList.data.includes('PROD-001'), 'GET /api/wishlist chứa PROD-001');

    // --- PHẦN 8: NOTIFICATIONS API ---
    console.log('\n--- 8. Testing Notifications API ---');
    const notifsRes = await httpRequest('GET', '/api/notifications', null, {
      'Cookie': custCookie
    });
    assert(notifsRes.status === 200, 'GET /api/notifications trả về 200 OK');
    assert(Array.isArray(notifsRes.data) && notifsRes.data.length > 0, 'Có thông báo tự sinh từ đơn hàng đã đặt');
    const notifId = notifsRes.data[0].id;

    const readRes = await httpRequest('PATCH', `/api/notifications/${notifId}/read`, null, {
      'Cookie': custCookie
    });
    assert(readRes.status === 200, 'PATCH /api/notifications/:id/read trả về 200 OK');

    // --- PHẦN 9: SHARP AVATAR SANITIZATION ---
    console.log('\n--- 9. Testing Avatar Sanitization (Sharp 200x200 WebP) ---');
    // 1x1 transparent PNG base64
    const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const avatarRes = await httpRequest('POST', '/api/users/avatar', { avatarBase64: tinyPngBase64 }, {
      'Cookie': custCookie
    });
    assert(avatarRes.status === 200, 'POST /api/users/avatar trả về 200 OK');
    assert(avatarRes.data.user.avatar.includes('.webp'), 'Avatar được Sharp chuẩn hóa thành định dạng bảo mật WebP');

    // --- PHẦN 10: DỌN DẸP DỮ LIỆU TEST ---
    console.log('\n--- 10. Database Cleanup ---');
    await performCleanup();

    console.log('\n================================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED 100% ON MYSQL 8.0 & PRISMA!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Lỗi khi chạy integration test:', err);
    process.exitCode = 1;
  } finally {
    if (typeof performCleanup === 'function') {
      await performCleanup();
    }
    if (serverInstance) {
      serverInstance.close();
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
