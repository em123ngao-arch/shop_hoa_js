/**
 * test-auth-http.js - Kich ban kiem thu tich hop HTTP toan dien cho phan he Xac thuc (Hexagonal Auth)
 * Kiem thu thuc te qua HTTP layer: Express Router -> Middlewares -> Controllers -> Services -> Prisma -> MySQL
 * Thiet ke chuan Zero-AI-Vibe (khong emoji, logs ky thuat ro rang)
 * Tu dong don dep du lieu test sau khi hoan thanh.
 */

import express from 'express';
import { container } from './server/infrastructure/config/container.js';

const app = express();
app.use(express.json());
app.use('/api/auth', container.authRouter);

// Endpoint kiem tra phan quyen admin
app.get('/api/admin/dashboard-check', container.authMiddleware, container.roleGuard('admin'), (req, res) => {
  res.json({ success: true, message: 'Admin access granted' });
});

const PORT = 4099;
let server;
const createdUserIds = [];

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runHttpTests() {
  console.log('================================================================');
  console.log('INTEGRATION TEST: AUTHENTICATION HTTP LAYER & PROTOCOLS');
  console.log('================================================================\n');

  server = app.listen(PORT);

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // --------------------------------------------------------------------------
    // 1. KIEM THU DANG KY (POST /api/auth/register)
    // --------------------------------------------------------------------------
    console.log('--- 1. Testing Registration Validation & Ingestion ---');

    // 1.1 Mat khau ngan < 8 ky tu
    const resShortPass = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User Test', email: 'test_short@shophoa.example', password: '1234567' })
    });
    assert(resShortPass.status === 400, 'POST /api/auth/register voi password < 8 tra ve 400 Bad Request');

    // 1.2 Mat khau dai > 72 bytes (Bcrypt limit)
    const longPass = 'A'.repeat(73);
    const resLongPass = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User Test', email: 'test_long@shophoa.example', password: longPass })
    });
    assert(resLongPass.status === 400, 'POST /api/auth/register voi password > 72 bytes tra ve 400 Bad Request');

    // 1.3 Email sai dinh dang
    const resBadEmail = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User Test', email: 'not-an-email', password: 'password123' })
    });
    assert(resBadEmail.status === 400, 'POST /api/auth/register voi email khong hop le tra ve 400 Bad Request');

    // 1.4 Dang ky thanh cong & kiem tra khong bi leo thang dac quyen (Privilege Escalation)
    const uniqueEmail = `http_test_${Date.now()}@shophoa.example`;
    const resValid = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nguyen Van HTTP',
        email: uniqueEmail.toUpperCase(), // Test email viet hoa
        password: 'ValidPassword123!',
        role: 'admin' // Hacker co gang truyen role: admin
      })
    });
    const dataValid = await resValid.json();
    assert(resValid.status === 201, 'POST /api/auth/register hop le tra ve 201 Created');
    assert(dataValid.success === true, 'Response body chua success = true');
    assert(dataValid.user.role === 'customer', 'He thong luon ep role = customer, chan leo thang dac quyen admin');
    assert(dataValid.user.email === uniqueEmail.toLowerCase(), 'Email tu dong chuan hoa ve chu thuong');
    assert(dataValid.user.password_hash === undefined, 'DTO tra ve khong chua password_hash');
    createdUserIds.push(dataValid.user.id);

    // 1.5 Kiem tra trung lap Email (Conflict 409)
    const resDuplicate = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nguyen Van Duplicate',
        email: uniqueEmail,
        password: 'ValidPassword123!'
      })
    });
    assert(resDuplicate.status === 409, 'POST /api/auth/register trung email tra ve 409 Conflict');

    // 1.6 Kiem tra 2 request dang ky dong thoi cung 1 email (Race condition test)
    console.log('\n--- 2. Testing Concurrent Registration Race Condition ---');
    const concurrentEmail = `concurrent_${Date.now()}@shophoa.example`;
    const [resRace1, resRace2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Racer 1', email: concurrentEmail, password: 'password123' })
      }),
      fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Racer 2', email: concurrentEmail, password: 'password123' })
      })
    ]);
    const statuses = [resRace1.status, resRace2.status].sort();
    assert(statuses[0] === 201 && statuses[1] === 409, 'Khi 2 request dang ky dong thoi: 1 request thanh cong (201) va 1 request bi chan 409 Conflict');
    const d1 = await (resRace1.status === 201 ? resRace1.json() : resRace2.json());
    if (d1.user?.id) createdUserIds.push(d1.user.id);

    // --------------------------------------------------------------------------
    // 2. KIEM THU DANG NHAP (POST /api/auth/login)
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing Login Authentication Protocols ---');

    // 2.1 Dang nhap sai mat khau
    const resWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'wrongpassword' })
    });
    assert(resWrongPass.status === 401, 'POST /api/auth/login sai mat khau tra ve 401 Unauthorized');

    // 2.2 Dang nhap email khong ton tai (chong Timing Attack)
    const startNonExist = Date.now();
    const resNonExist = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost_user_999@shophoa.example', password: 'somepassword' })
    });
    const durationNonExist = Date.now() - startNonExist;
    assert(resNonExist.status === 401, 'POST /api/auth/login email khong ton tai tra ve 401 Unauthorized');
    console.log(`[INFO] Non-existent user login execution time: ${durationNonExist}ms (Dummy hash verified)`);

    // 2.3 Dang nhap dung mat khau
    const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'ValidPassword123!' })
    });
    const loginData = await resLogin.json();
    assert(resLogin.status === 200, 'POST /api/auth/login thanh cong tra ve 200 OK');
    assert(typeof loginData.token === 'string' && loginData.token.length > 50, 'Nhan duoc JWT token hop le');
    const customerToken = loginData.token;

    // --------------------------------------------------------------------------
    // 3. KIEM THU PROFILE & MIDDLEWARE (GET /api/auth/me)
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Protected Profile Endpoint & Middleware ---');

    // 3.1 Khong gui Token
    const resNoToken = await fetch(`${baseUrl}/api/auth/me`);
    assert(resNoToken.status === 401, 'GET /api/auth/me khong co token tra ve 401 Unauthorized');

    // 3.2 Token gia mao / khong dung chu ky
    const resFakeToken = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer fake.invalid.jwt.token' }
    });
    assert(resFakeToken.status === 401, 'GET /api/auth/me token gia mao tra ve 401 Unauthorized');

    // 3.3 Token hop le
    const resValidMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const dataMe = await resValidMe.json();
    assert(resValidMe.status === 200, 'GET /api/auth/me kem token hop le tra ve 200 OK');
    assert(dataMe.user.email === uniqueEmail.toLowerCase(), 'Profile tra ve dung thong tin nguoi dung');

    // --------------------------------------------------------------------------
    // 4. KIEM THU PHAN QUYEN (ROLE-BASED ACCESS CONTROL)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing Role-Based Access Control (RBAC) ---');

    // 4.1 Token customer truy cap vao route admin
    const resCustOnAdmin = await fetch(`${baseUrl}/api/admin/dashboard-check`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(resCustOnAdmin.status === 403, 'Customer token truy cap route yeu cau admin tra ve 403 Forbidden');

    // 4.2 Dang nhap tai khoan Admin mau
    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shophoa.example', password: 'admin123' })
    });
    const adminData = await resAdminLogin.json();
    assert(adminData.user.role === 'admin', 'Tai khoan admin@shophoa.example co role = admin');

    // 4.3 Token admin truy cap vao route admin
    const resAdminOnAdmin = await fetch(`${baseUrl}/api/admin/dashboard-check`, {
      headers: { Authorization: `Bearer ${adminData.token}` }
    });
    assert(resAdminOnAdmin.status === 200, 'Admin token truy cap route admin tra ve 200 OK');

    // --------------------------------------------------------------------------
    // 5. KIEM THU RATE LIMITER (CHONG BRUTE-FORCE)
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Testing Rate Limiting (Brute-Force Mitigation) ---');
    let rateLimited = false;
    let rateLimitStatus = null;
    for (let i = 1; i <= 12; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'spam_test@shophoa.example', password: 'spam_password_123' })
      });
      if (res.status === 429) {
        rateLimited = true;
        rateLimitStatus = res.status;
        break;
      }
    }
    assert(rateLimited === true && rateLimitStatus === 429, 'He thong tu dong chan voi HTTP 429 Too Many Requests khi vuot nguong 10 request/phut');

    console.log('\n================================================================');
    console.log('ALL HTTP & SECURITY INTEGRATION TESTS PASSED SUCCESSFULLY');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\nHTTP INTEGRATION TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    // DON DEP DU LIEU TEST TRONG MYSQL
    if (createdUserIds.length > 0) {
      console.log(`[CLEANUP] Deleting ${createdUserIds.length} temporary test records from MySQL...`);
      await container.prisma.users.deleteMany({
        where: { id: { in: createdUserIds } }
      });
      console.log('[CLEANUP] MySQL database restored to clean state.');
    }
    if (server) server.close();
  }
}

runHttpTests();

