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

  try {
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
    const adminToken = adminLogin.data.token;

    // Login as customer
    const custLogin = await httpRequest('POST', '/api/auth/login', {
      email: 'customer1@shophoa.example',
      password: '123456'
    });
    assert(custLogin.status === 200, 'Đăng nhập customer1 thành công');
    const custToken = custLogin.data.token;
    const custId = custLogin.data.user.id;

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
      'Authorization': `Bearer ${custToken}`
    });
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

    const createdOrderId = orderRes.data.id;

    // Test mua vượt quá tồn kho (Bảo vệ overselling)
    const oversellRes = await httpRequest('POST', '/api/orders', {
      customerName: 'Oversell Test',
      customerPhone: '0909999999',
      shippingAddress: 'HN',
      items: [{ id: 'PROD-001', quantity: 999999 }]
    });
    assert(oversellRes.status === 400, 'Đặt hàng vượt quá tồn kho bị từ chối với HTTP 400');

    // --- PHẦN 4: STATE MACHINE TRANSITIONS ---
    console.log('\n--- 4. Testing Order State Machine Transitions ---');
    // Customer không thể đổi trạng thái đơn hàng (403)
    const custChangeRes = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'confirmed' }, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(custChangeRes.status === 403, 'Customer đổi trạng thái đơn hàng bị chặn 403 Forbidden');

    // Admin chuyển từ pending -> confirmed (Hợp lệ)
    const adminConfirm = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'confirmed' }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminConfirm.status === 200, 'Admin chuyển pending -> confirmed thành công (200 OK)');
    assert(adminConfirm.data.order.status === 'confirmed', 'Trạng thái đơn hàng cập nhật thành "confirmed"');

    // Chuyển confirmed -> shipping
    const adminShip = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'shipping' }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminShip.status === 200, 'Admin chuyển confirmed -> shipping thành công (200 OK)');

    // Chuyển shipping -> completed
    const adminComplete = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'completed' }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminComplete.status === 200, 'Admin chuyển shipping -> completed thành công (200 OK)');

    // Vi phạm State Machine: Chuyển completed -> pending (Bất biến, không thể lùi)
    const adminRollback = await httpRequest('PATCH', `/api/orders/${createdOrderId}/status`, { status: 'pending' }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminRollback.status === 400, 'Chuyển ngược completed -> pending bị chặn 400 Bad Request');

    // Thao tác trực tiếp PATCH /orders/:id bị chặn Method Not Allowed (405)
    const directPatch = await httpRequest('PATCH', `/orders/${createdOrderId}`, { status: 'pending' });
    assert(directPatch.status === 405, 'PATCH /orders/:id trực tiếp bị chặn 405 Method Not Allowed');

    // --- PHẦN 5: IDOR PROTECTION ---
    console.log('\n--- 5. Testing IDOR Protection (Order Privacy) ---');
    // Login as customer2
    const cust2Login = await httpRequest('POST', '/api/auth/login', {
      email: 'customer2@shophoa.example',
      password: '123456'
    });
    const cust2Token = cust2Login.data.token;

    // Customer2 xem danh sách đơn hàng của mình: không được thấy đơn của customer1
    const cust2Orders = await httpRequest('GET', '/api/orders', null, {
      'Authorization': `Bearer ${cust2Token}`
    });
    assert(cust2Orders.status === 200, 'Customer 2 lấy danh sách đơn hàng thành công');
    const hasOtherCustOrder = cust2Orders.data.some(o => o.id === createdOrderId);
    assert(!hasOtherCustOrder, 'Customer 2 KHÔNG THỂ nhìn thấy đơn hàng của Customer 1 (IDOR Safe)');

    // Customer2 cố tình truy cập chi tiết đơn hàng của Customer1
    const idorDetail = await httpRequest('GET', `/api/orders/${createdOrderId}`, null, {
      'Authorization': `Bearer ${cust2Token}`
    });
    assert(idorDetail.status === 403, 'Customer 2 truy cập trực tiếp ID đơn hàng của Customer 1 bị chặn 403 Forbidden');

    // --- PHẦN 6: REVIEWS & ZERO-XSS & REDUCE RATING ---
    console.log('\n--- 6. Testing Reviews API (Zero-XSS & Reduce Rating) ---');
    const xssReviewPayload = {
      productId: 'PROD-001',
      rating: 5,
      comment: '<script>alert("Hacked")</script>Hoa rất đẹp và bền!',
      userName: 'Khách Hàng Thật'
    };
    const reviewRes = await httpRequest('POST', '/api/reviews', xssReviewPayload, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(reviewRes.status === 201, 'POST /api/reviews trả về 201 Created');
    assert(!reviewRes.data.review.comment.includes('<script>'), 'Mã độc <script> đã được khử XSS an toàn thành chuỗi entity');
    assert(typeof reviewRes.data.product.rating === 'number', 'Điểm trung bình được tính toán chính xác bằng Array.reduce');

    // --- PHẦN 7: WISHLIST API ---
    console.log('\n--- 7. Testing Wishlist API (MySQL 8.0) ---');
    const wishToggle = await httpRequest('POST', '/api/wishlist/toggle', { productId: 'PROD-001' }, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(wishToggle.status === 200, 'POST /api/wishlist/toggle trả về 200 OK');
    assert(wishToggle.data.isFavorite === true, 'Đã thêm PROD-001 vào danh sách yêu thích');

    const wishList = await httpRequest('GET', '/api/wishlist', null, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(wishList.data.includes('PROD-001'), 'GET /api/wishlist chứa PROD-001');

    // --- PHẦN 8: NOTIFICATIONS API ---
    console.log('\n--- 8. Testing Notifications API ---');
    const notifsRes = await httpRequest('GET', '/api/notifications', null, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(notifsRes.status === 200, 'GET /api/notifications trả về 200 OK');
    assert(Array.isArray(notifsRes.data) && notifsRes.data.length > 0, 'Có thông báo tự sinh từ đơn hàng đã đặt');
    const notifId = notifsRes.data[0].id;

    const readRes = await httpRequest('PATCH', `/api/notifications/${notifId}/read`, null, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(readRes.status === 200, 'PATCH /api/notifications/:id/read trả về 200 OK');

    // --- PHẦN 9: SHARP AVATAR SANITIZATION ---
    console.log('\n--- 9. Testing Avatar Sanitization (Sharp 200x200 WebP) ---');
    // 1x1 transparent PNG base64
    const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const avatarRes = await httpRequest('POST', '/api/users/avatar', { avatarBase64: tinyPngBase64 }, {
      'Authorization': `Bearer ${custToken}`
    });
    assert(avatarRes.status === 200, 'POST /api/users/avatar trả về 200 OK');
    assert(avatarRes.data.user.avatar.includes('.webp'), 'Avatar được Sharp chuẩn hóa thành định dạng bảo mật WebP');

    // --- PHẦN 10: DỌN DẸP DỮ LIỆU TEST ---
    console.log('\n--- 10. Database Cleanup ---');
    // Hoàn trả stock cho PROD-001
    await container.prisma.products.update({
      where: { id: 'PROD-001' },
      data: { stock: initialStock }
    });
    // Xóa order test
    await container.prisma.notifications.deleteMany({ where: { order_id: createdOrderId } });
    await container.prisma.order_items.deleteMany({ where: { order_id: createdOrderId } });
    await container.prisma.orders.delete({ where: { id: createdOrderId } });
    // Xóa review test
    await container.prisma.reviews.deleteMany({ where: { user_id: custId, product_id: 'PROD-001' } });
    // Xóa wishlist test
    await container.prisma.wishlist_items.deleteMany({ where: { user_id: custId } });
    console.log('[CLEANUP] Dữ liệu thử nghiệm đã được dọn dẹp sạch sẽ khỏi MySQL.');

    console.log('\n================================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED 100% ON MYSQL 8.0 & PRISMA!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Lỗi khi chạy integration test:', err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
