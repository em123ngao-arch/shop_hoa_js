/**
 * test-auth-hexagonal.js - Kịch bản kiểm thử tích hợp tự động phân hệ Xác thực (Hexagonal Auth)
 * Kiểm tra toàn bộ chuỗi: HTTP Controller -> Auth Service -> Domain User -> Bcrypt -> JWT -> Prisma -> MySQL
 */

import { container } from './server/infrastructure/config/container.js';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ PHÂN HỆ XÁC THỰC HEXAGONAL (AUTH MODULE)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // TEST 1: Đăng ký tài khoản khách hàng mới vào MySQL
    const uniqueEmail = `khachhang_${Date.now()}@shophoa.example`;
    console.log(`\n--- 1. Kiểm tra Đăng ký tài khoản mới: ${uniqueEmail} ---`);
    const regRes = await container.authService.register({
      name: 'Lê Thu Trang',
      email: uniqueEmail,
      password: 'password123',
      phone: '0901234567'
    });
    assert(regRes.success === true, 'Đăng ký trả về success = true');
    assert(regRes.user.id.startsWith('USR-'), 'ID tài khoản sinh đúng định dạng USR-...');
    assert(regRes.user.email === uniqueEmail, 'Email lưu đúng định dạng chữ thường');
    assert(regRes.user.password_hash === undefined, 'Tuyệt đối KHÔNG lộ password_hash trong DTO');

    // TEST 2: Kiểm tra chống trùng lặp Email (Unique / Conflict 409)
    console.log('\n--- 2. Kiểm tra Chống trùng lặp Email ---');
    try {
      await container.authService.register({
        name: 'Người Trùng Email',
        email: uniqueEmail,
        password: 'password999'
      });
      assert(false, 'Hệ thống phải chặn email trùng lặp');
    } catch (err) {
      assert(err.statusCode === 409, 'Bắt đúng mã lỗi Conflict (409)');
      assert(err.message.includes('đã được sử dụng'), 'Thông báo lỗi thân thiện với người dùng');
    }

    // TEST 3: Kiểm tra Đăng nhập sai mật khẩu (Unauthorized 401)
    console.log('\n--- 3. Kiểm tra Đăng nhập sai mật khẩu ---');
    try {
      await container.authService.login({
        email: uniqueEmail,
        password: 'wrong_password_xyz'
      });
      assert(false, 'Hệ thống phải chặn đăng nhập sai mật khẩu');
    } catch (err) {
      assert(err.statusCode === 401, 'Bắt đúng mã lỗi Unauthorized (401)');
      assert(err.message === 'Email hoặc mật khẩu không chính xác', 'Không tiết lộ email hay mật khẩu bị sai (Chống dò quét)');
    }

    // TEST 4: Kiểm tra Đăng nhập đúng mật khẩu & Cấp JWT Token
    console.log('\n--- 4. Kiểm tra Đăng nhập đúng mật khẩu & Cấp JWT ---');
    const loginRes = await container.authService.login({
      email: uniqueEmail,
      password: 'password123'
    });
    assert(loginRes.success === true, 'Đăng nhập thành công');
    assert(typeof loginRes.token === 'string' && loginRes.token.split('.').length === 3, 'Token sinh đúng chuẩn JWT 3 phần');
    assert(loginRes.user.name === 'Lê Thu Trang', 'Họ tên trả về chính xác');

    // TEST 5: Giải mã và xác thực tính toàn vẹn của JWT Token (RFC 7519)
    console.log('\n--- 5. Kiểm tra Xác thực chữ ký JWT Token ---');
    const decoded = container.tokenPort.verify(loginRes.token);
    assert(decoded.id === regRes.user.id, 'Payload JWT chứa đúng ID người dùng');
    assert(decoded.email === uniqueEmail, 'Payload JWT chứa đúng Email');
    assert(decoded.role === 'customer', 'Payload JWT chứa đúng Role = customer');

    // TEST 6: Lấy thông tin cá nhân (Profile / getMe)
    console.log('\n--- 6. Kiểm tra API Lấy thông tin cá nhân (getMe) ---');
    const meRes = await container.authService.getMe(regRes.user.id);
    assert(meRes.success === true, 'Lấy profile thành công');
    assert(meRes.user.email === uniqueEmail, 'Thông tin khớp chính xác');
    assert(meRes.user.password_hash === undefined, 'Profile không chứa mật khẩu băm');

    // TEST 7: Kiểm tra Tài khoản Quản trị viên mẫu (admin@shophoa.example / admin123)
    console.log('\n--- 7. Kiểm tra Đăng nhập Tài khoản Quản Trị Viên (Admin) ---');
    const adminLogin = await container.authService.login({
      email: 'admin@shophoa.example',
      password: 'admin123'
    });
    assert(adminLogin.success === true, 'Admin đăng nhập thành công');
    assert(adminLogin.user.role === 'admin', 'Vai trò tài khoản là admin');
    assert(adminLogin.user.name === 'Quản Trị Viên Trưởng', 'Tên Quản Trị Viên đúng với seed trong MySQL');

    // TEST 8: Kiểm tra Đăng nhập bằng Bí danh tiện lợi ('admin' / 'admin123')
    console.log('\n--- 8. Kiểm tra Đăng nhập bằng Bí danh (Alias: "admin") ---');
    const aliasLogin = await container.authService.login({
      email: 'admin',
      password: 'admin123'
    });
    assert(aliasLogin.success === true, 'Đăng nhập bằng bí danh admin thành công');
    assert(aliasLogin.user.role === 'admin', 'Bí danh tự động map sang admin@shophoa.example');

    // TEST 9: Đối soát trực tiếp trong CSDL MySQL qua Prisma
    console.log('\n--- 9. Đối soát trực tiếp trong CSDL MySQL ---');
    const dbRecord = await container.prisma.users.findUnique({
      where: { email: uniqueEmail }
    });
    assert(dbRecord !== null, 'Bản ghi tồn tại thực tế trong bảng users của MySQL');
    assert(dbRecord.password_hash.startsWith('$2'), 'Mật khẩu trong MySQL được mã hóa Bcrypt bắt đầu bằng $2');
    assert(dbRecord.password_hash !== 'password123', 'Mật khẩu KHÔNG lưu dạng văn bản thô');

    console.log('\n================================================================');
    console.log(`🎉 TẤT CẢ ${passed}/${total} BÀI KIỂM THỬ XÁC THỰC ĐỀU VƯỢT QUA 100%!`);
    console.log('================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ BÀI KIỂM THỬ THẤT BẠI:', err);
    process.exit(1);
  }
}

runTests();

