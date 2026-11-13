import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../server.js';
import { container } from '../server/infrastructure/config/container.js';

let serverInstance = null;
let BASE_URL = '';

function httpRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = null;

    if (body !== null && body !== undefined) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            json = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!Array.isArray(setCookie)) return '';
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runRefundHttpTests() {
  const prisma = container.prisma;
  const createdOrderIds = [];
  const createdRefundIds = [];
  let tempStaffId = null;
  let tempCustId = null;
  let testFailed = false;

  try {
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(0, '127.0.0.1', resolve));
    const { port } = serverInstance.address();
    BASE_URL = `http://127.0.0.1:${port}`;

    console.log('================================================================');
    console.log('🧪 HTTP INTEGRATION TEST: MAKER-CHECKER REFUND WORKFLOW (2-CAP)');
    console.log('================================================================\n');

    // 1. Tạo tài khoản Staff (Thu ngân) & Customer tạm cho test
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const staffEmail = `cashier_test_${uniqueSuffix}@shophoa.example`;
    const custEmail = `cust_refund_${uniqueSuffix}@shophoa.example`;
    const passHash = await bcrypt.hash('TestPass123!', 10);

    tempStaffId = `USR-STAFF-${uniqueSuffix}`;
    tempCustId = `USR-CUST-${uniqueSuffix}`;

    await prisma.users.createMany({
      data: [
        { id: tempStaffId, name: 'Thu Ngân Test', email: staffEmail, password_hash: passHash, role: 'staff', phone: '0901112233' },
        { id: tempCustId, name: 'Khách Refund Test', email: custEmail, password_hash: passHash, role: 'customer', phone: '0903334455' }
      ]
    });

    // Đăng nhập 3 vai trò: Customer, Staff (Thu ngân), Admin
    const custLogin = await httpRequest('POST', '/api/auth/login', { email: custEmail, password: 'TestPass123!' });
    assert(custLogin.status === 200, 'Customer đăng nhập thành công');
    const custCookie = extractCookie(custLogin.headers);

    const staffLogin = await httpRequest('POST', '/api/auth/login', { email: staffEmail, password: 'TestPass123!' });
    assert(staffLogin.status === 200, 'Thu ngân (staff) đăng nhập thành công');
    const staffCookie = extractCookie(staffLogin.headers);

    const adminLogin = await httpRequest('POST', '/api/auth/login', { email: 'admin@shophoa.example', password: 'admin123' });
    assert(adminLogin.status === 200, 'Admin đăng nhập thành công');
    const adminCookie = extractCookie(adminLogin.headers);

    // 2. Tạo 2 đơn SePay trong DB:
    //    - Đơn #1: Đã hủy nhưng có giao dịch SePay thanh toán trễ (Late Payment -> cần hoàn tiền)
    //    - Đơn #2: Đã thanh toán SePay & completed (khách yêu cầu đổi trả -> test từ chối hoàn tiền)
    const sampleProd = await prisma.products.findFirst({ where: { is_active: true } });
    assert(Boolean(sampleProd), 'Có sản phẩm active trong CSDL để tạo đơn test');

    const order1Id = `ORD-REF1-${uniqueSuffix}`;
    const order1Code = `DHREF1${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const order2Id = `ORD-REF2-${uniqueSuffix}`;
    const order2Code = `DHREF2${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    createdOrderIds.push(order1Id, order2Id);

    await prisma.orders.create({
      data: {
        id: order1Id,
        order_code: order1Code,
        customer_name: 'Khách Chuyển Nhầm Đơn Hủy',
        customer_phone: '0909888777',
        shipping_address: '123 Đường Test, Q1',
        payment_method: 'sepay',
        payment_status: 'pending',
        status: 'cancelled',
        subtotal: 420000,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 420000,
        order_items: {
          create: [{
            id: `OI-REF1-${uniqueSuffix}`,
            product_id: sampleProd.id,
            product_name: sampleProd.name,
            unit_price: 420000,
            quantity: 1
          }]
        },
        payment_transactions: {
          create: [{
            id: `TX-REF1-${uniqueSuffix}`,
            provider: 'sepay',
            provider_tx_id: `FT-REF1-${uniqueSuffix}`,
            amount: 420000,
            bank_brand: 'TPBank',
            account_number: '70207003455',
            transaction_date: new Date()
          }]
        }
      }
    });

    await prisma.orders.create({
      data: {
        id: order2Id,
        order_code: order2Code,
        customer_name: 'Khách Đổi Trả Đã Thanh Toán',
        customer_phone: '0909666555',
        shipping_address: '456 Đường Test, Q3',
        payment_method: 'sepay',
        payment_status: 'paid',
        status: 'completed',
        subtotal: 350000,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 350000,
        order_items: {
          create: [{
            id: `OI-REF2-${uniqueSuffix}`,
            product_id: sampleProd.id,
            product_name: sampleProd.name,
            unit_price: 350000,
            quantity: 1
          }]
        },
        payment_transactions: {
          create: [{
            id: `TX-REF2-${uniqueSuffix}`,
            provider: 'sepay',
            provider_tx_id: `FT-REF2-${uniqueSuffix}`,
            amount: 350000,
            bank_brand: 'TPBank',
            account_number: '70207003455',
            transaction_date: new Date()
          }]
        }
      }
    });

    // 3. Kiểm tra Customer bị chặn 403 trên API hoàn tiền
    const custListRes = await httpRequest('GET', '/api/refunds', null, { Cookie: custCookie });
    assert(custListRes.status === 403, 'Customer gọi GET /api/refunds bị chặn 403 Forbidden');
    const custCreateRes = await httpRequest('POST', '/api/refunds', {
      orderId: order1Id,
      reason: 'Customer tự lập phiếu hoàn tiền'
    }, { Cookie: custCookie });
    assert(custCreateRes.status === 403, 'Customer gọi POST /api/refunds bị chặn 403 Forbidden');

    // 4. Kiểm tra GET /api/orders DTO trả về đầy đủ paymentTransactions & refundRequests
    const ordersRes = await httpRequest('GET', '/api/orders', null, { Cookie: adminCookie });
    const dtoOrder1 = Array.isArray(ordersRes.data) ? ordersRes.data.find(o => o.id === order1Id) : null;
    assert(Boolean(dtoOrder1 && Array.isArray(dtoOrder1.paymentTransactions) && dtoOrder1.paymentTransactions.length === 1),
      'Order DTO từ GET /api/orders trả về đủ mảng paymentTransactions (fix hiển thị banner hoàn tiền Admin)');

    // 5. Thu ngân (staff) lập phiếu yêu cầu hoàn tiền cho Đơn #1 -> 201 Created
    const staffCreateRes = await httpRequest('POST', '/api/refunds', {
      orderId: order1Id,
      amount: 420000,
      reason: 'Khách chuyển khoản VietQR sau khi đơn tự động hủy',
      bankInfo: 'VCB 0123456789 - Nguyen Van A'
    }, { Cookie: staffCookie });
    assert(staffCreateRes.status === 201 && staffCreateRes.data.status === 'pending_approval',
      'Thu ngân (staff) lập phiếu yêu cầu hoàn tiền trả 201 Created với status=pending_approval');
    const refund1Id = staffCreateRes.data.id;
    createdRefundIds.push(refund1Id);

    // 6. Chặn trùng phiếu đang chờ duyệt trên cùng 1 đơn -> 400 Bad Request
    const dupRes = await httpRequest('POST', '/api/refunds', {
      orderId: order1Id,
      reason: 'Lập phiếu trùng khi phiếu cũ đang pending_approval'
    }, { Cookie: staffCookie });
    assert(dupRes.status === 400, 'Chặn lập phiếu trùng cho đơn hàng đang có phiếu pending_approval (400 Bad Request)');

    // 7. Thu ngân (staff) tự bấm Duyệt hoặc Từ chối -> PHẢI bị chặn 403 Forbidden (Maker-Checker)
    const staffApproveSelf = await httpRequest('POST', `/api/refunds/${refund1Id}/approve`, {
      adminNote: 'Staff tự duyệt trái phép',
      refundTxRef: 'FT-ILLEGAL'
    }, { Cookie: staffCookie });
    assert(staffApproveSelf.status === 403, 'Thu ngân (staff) tự duyệt hoàn tiền bị chặn 403 Forbidden (Maker-Checker)');

    const staffRejectSelf = await httpRequest('POST', `/api/refunds/${refund1Id}/reject`, {
      adminNote: 'Staff tự từ chối'
    }, { Cookie: staffCookie });
    assert(staffRejectSelf.status === 403, 'Thu ngân (staff) tự từ chối hoàn tiền bị chặn 403 Forbidden');

    // 8. Admin duyệt phiếu #1 -> 200 OK & orders.payment_status = 'refunded'
    const adminApproveRes = await httpRequest('POST', `/api/refunds/${refund1Id}/approve`, {
      adminNote: 'Đã chuyển hoàn đủ tiền cho khách qua VCB',
      refundTxRef: 'FT-OUT-889900'
    }, { Cookie: adminCookie });
    assert(adminApproveRes.status === 200 && adminApproveRes.data.status === 'approved',
      'Admin duyệt phiếu hoàn tiền thành công (200 OK -> status=approved)');

    const dbOrder1After = await prisma.orders.findUnique({ where: { id: order1Id } });
    assert(dbOrder1After.payment_status === 'refunded',
      'CSDL cập nhật orders.payment_status = "refunded" nguyên tử sau khi Admin duyệt');

    // 9. Thu ngân tạo phiếu #2 cho Đơn #2 -> Admin từ chối (reject) -> payment_status giữ nguyên 'paid'
    const staffCreate2 = await httpRequest('POST', '/api/refunds', {
      orderId: order2Id,
      amount: 350000,
      reason: 'Khách báo nhầm mẫu nhưng hoa đã giao thành công đúng mẫu',
      bankInfo: 'MB 99887766'
    }, { Cookie: staffCookie });
    assert(staffCreate2.status === 201, 'Thu ngân lập phiếu hoàn tiền #2 thành công');
    const refund2Id = staffCreate2.data.id;
    createdRefundIds.push(refund2Id);

    const adminRejectRes = await httpRequest('POST', `/api/refunds/${refund2Id}/reject`, {
      adminNote: 'Đã kiểm tra ảnh giao hoa hợp lệ, từ chối hoàn tiền'
    }, { Cookie: adminCookie });
    assert(adminRejectRes.status === 200 && adminRejectRes.data.status === 'rejected',
      'Admin từ chối phiếu hoàn tiền #2 thành công (200 OK -> status=rejected)');

    const dbOrder2After = await prisma.orders.findUnique({ where: { id: order2Id } });
    assert(dbOrder2After.payment_status === 'paid',
      'Khi Admin từ chối phiếu hoàn tiền, orders.payment_status vẫn giữ nguyên "paid"');

    console.log('\n🎉 TOÀN BỘ TEST MAKER-CHECKER HOÀN TIỀN 2 CẤP (STAFF -> ADMIN) ĐẠT 100%!');
  } catch (err) {
    testFailed = true;
    console.error('\n❌ [REFUND HTTP TEST FAILED]:', err);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$transaction(async (tx) => {
        if (createdRefundIds.length > 0) {
          await tx.refund_requests.deleteMany({ where: { id: { in: createdRefundIds } } });
        }
        if (createdOrderIds.length > 0) {
          await tx.payment_transactions.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.order_items.deleteMany({ where: { order_id: { in: createdOrderIds } } });
          await tx.orders.deleteMany({ where: { id: { in: createdOrderIds } } });
        }
        const userIds = [tempStaffId, tempCustId].filter(Boolean);
        if (userIds.length > 0) {
          await tx.users.deleteMany({ where: { id: { in: userIds } } });
        }
      });
      console.log('[CLEANUP] Đã dọn sạch phiếu hoàn tiền, đơn hàng và tài khoản test trong 1 ACID Transaction.');
    } catch (cleanupErr) {
      console.error('❌ [CLEANUP ERROR]:', cleanupErr);
      process.exitCode = 1;
    }

    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    if (typeof container?.orderExpiryService?.stopBackgroundJob === 'function') {
      container.orderExpiryService.stopBackgroundJob();
    }
    await prisma.$disconnect();
    process.exit(testFailed || process.exitCode ? (process.exitCode || 1) : 0);
  }
}

runRefundHttpTests();
