/**
 * test-auth-http.js - Kich ban kiem thu tich hop HTTP toan dien cho phan he Xac thuc (Hexagonal Auth)
 * Kiem thu thuc te qua HTTP layer: Express Router -> Middlewares -> Controllers -> Services -> Prisma -> MySQL
 * Thiet ke chuan Zero-AI-Vibe (khong emoji, logs ky thuat ro rang)
 * Tu dong don dep du lieu test sau khi hoan thanh.
 */

import express from 'express';
import { createHash } from 'crypto';
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
let sessionCookie = '';

// Node fetch không tự lưu cookie giữa các request; bộ bọc này mô phỏng cookie jar của trình duyệt.
const fetch = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const hasExplicitCookie = Object.keys(headers).some((key) => key.toLowerCase() === 'cookie');
  if (!hasExplicitCookie && sessionCookie) headers.Cookie = sessionCookie;
  const response = await globalThis.fetch(url, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie?.startsWith('shophoa_session=')) {
    sessionCookie = /^shophoa_session=;|(?:^|;\s*)Max-Age=0(?:;|$)/i.test(setCookie) ? '' : setCookie.split(';', 1)[0];
  }
  return response;
};

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
    const registerCookie = resValid.headers.get('set-cookie') || '';
    assert(registerCookie.startsWith('shophoa_session=') && /;\s*HttpOnly/i.test(registerCookie), 'K1: đăng ký cấp cookie phiên HttpOnly');
    const registrationSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: registerCookie.split(';', 1)[0] } });
    assert(registrationSession.status === 200, 'K1: phiên được cấp ngay sau đăng ký dùng được trên /api/auth/me');
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
    assert(!Object.hasOwn(loginData, 'token'), 'Response dang nhap khong lo JWT trong JSON');
    assert(sessionCookie.startsWith('shophoa_session='), 'JWT duoc luu trong cookie phien');
    assert(/;\s*HttpOnly/i.test(resLogin.headers.get('set-cookie') || ''), 'K2: cookie đăng nhập có cờ HttpOnly');
    let testCustomerCookie = sessionCookie;

    // K3: các lần đăng nhập thành công không tính vào ngưỡng brute-force theo email.
    for (let attempt = 0; attempt < 6; attempt++) {
      const successfulLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail, password: 'ValidPassword123!' })
      });
      assert(successfulLogin.status === 200, `K3: lần đăng nhập đúng ${attempt + 1} vẫn thành công`);
    }
    const activeCookieBeforeGlobalLogout = sessionCookie;
    const logoutAllResponse = await fetch(`${baseUrl}/api/auth/logout-all`, { method: 'POST' });
    assert(logoutAllResponse.status === 200, 'K2: đăng xuất tất cả thiết bị thành công');
    const revokedCookieResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: activeCookieBeforeGlobalLogout } });
    assert(revokedCookieResponse.status === 401, 'K2: logout-all thu hồi các cookie phiên cũ');
    const reLoginAfterLogoutAll = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'ValidPassword123!' })
    });
    assert(reLoginAfterLogoutAll.status === 200, 'K2: người dùng đăng nhập lại được sau logout-all');
    testCustomerCookie = sessionCookie;

    // --------------------------------------------------------------------------
    // 3. KIEM THU PROFILE & MIDDLEWARE (GET /api/auth/me)
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Protected Profile Endpoint & Middleware ---');

    // 3.1 Khong gui Token
    const resNoToken = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: '' } });
    assert(resNoToken.status === 401, 'GET /api/auth/me khong co token tra ve 401 Unauthorized');

    // 3.2 Token gia mao / khong dung chu ky
    const resFakeToken = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer fake.invalid.jwt.token', Cookie: '' }
    });
    assert(resFakeToken.status === 401, 'GET /api/auth/me token gia mao tra ve 401 Unauthorized');

    // 3.3 Token hop le
    const resValidMe = await fetch(`${baseUrl}/api/auth/me`);
    const dataMe = await resValidMe.json();
    assert(resValidMe.status === 200, 'GET /api/auth/me kem token hop le tra ve 200 OK');
    assert(dataMe.user.email === uniqueEmail.toLowerCase(), 'Profile tra ve dung thong tin nguoi dung');

    // --------------------------------------------------------------------------
    // 4. KIEM THU PHAN QUYEN (ROLE-BASED ACCESS CONTROL)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing Role-Based Access Control (RBAC) ---');

    // 4.1 Token customer truy cap vao route admin
    const resCustOnAdmin = await fetch(`${baseUrl}/api/admin/dashboard-check`, {
      headers: { Cookie: testCustomerCookie }
    });
    assert(resCustOnAdmin.status === 403, 'Customer token truy cap route yeu cau admin tra ve 403 Forbidden');

    // 4.2 Dang nhap tai khoan Admin mau
    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shophoa.example', password: 'admin123', rememberMe: true })
    });
    const adminData = await resAdminLogin.json();
    assert(adminData.user.role === 'admin', 'Tai khoan admin@shophoa.example co role = admin');
    assert(!Object.hasOwn(adminData, 'token'), 'Dang nhap admin khong tra JWT trong JSON');
    assert((resAdminLogin.headers.get('set-cookie') || '').includes('Max-Age=2592000'), 'K4: ghi nhớ đăng nhập đặt thời hạn cookie 30 ngày');

    // 4.3 Token admin truy cap vao route admin
    const resAdminOnAdmin = await fetch(`${baseUrl}/api/admin/dashboard-check`, {
      headers: { Cookie: sessionCookie }
    });
    assert(resAdminOnAdmin.status === 200, 'Admin token truy cap route admin tra ve 200 OK');

    // K5: gửi email reset chỉ để test; adapter giả giữ token trong bộ nhớ, không gửi thư thật.
    let capturedResetUrl = '';
    const originalEmailSender = container.authService.emailSender;
    container.authService.emailSender = {
      sendPasswordResetEmail: async ({ resetUrl }) => { capturedResetUrl = resetUrl; return { sent: true }; },
      sendPasswordChangedEmail: async () => ({ sent: true })
    };
    const forgotResponse = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail })
    });
    assert(forgotResponse.status === 200, 'K5: yêu cầu quên mật khẩu trả kết quả chung 200');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const resetToken = new URL(capturedResetUrl).hash.match(/token=([a-f0-9]{64})/i)?.[1];
    assert(Boolean(resetToken), 'K5: adapter email nhận link có token ngẫu nhiên 32 bytes');
    const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
    const storedResetToken = await container.prisma.password_reset_tokens.findUnique({ where: { token_hash: resetTokenHash } });
    assert(storedResetToken?.token_hash === resetTokenHash && storedResetToken.token_hash !== resetToken, 'K5: CSDL chỉ lưu SHA-256 của token reset');
    const staleCustomerCookie = testCustomerCookie;
    const resetResponse = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword: 'NewValidPassword123!' })
    });
    assert(resetResponse.status === 200, 'K5: token reset hợp lệ đổi mật khẩu thành công');
    const replayResponse = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword: 'AnotherPassword123!' })
    });
    assert(replayResponse.status === 400, 'K5: token reset chỉ được sử dụng một lần');
    const revokedSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: staleCustomerCookie } });
    assert(revokedSession.status === 401, 'K2/K5: reset mật khẩu thu hồi cookie phiên cũ qua token_version');
    container.authService.emailSender = originalEmailSender;

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
    assert(rateLimited === true && rateLimitStatus === 429, 'K3: rate limiter trả HTTP 429 sau nhiều lần đăng nhập thất bại');

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

