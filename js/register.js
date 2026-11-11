import { authApi } from './api.js';
import { showToast } from './utils.js';

// 1. Lấy phần tử form và nút bấm submit từ giao diện HTML
const registerForm = document.getElementById('registerForm');
const submitBtn = document.getElementById('submitBtn');

// 2. Gắn sự kiện submit khi người dùng nhấn nút "Đăng Ký"
if (registerForm) {
  registerForm.addEventListener('submit', function (event) {
    event.preventDefault();
    registerUser();
  });
}

// 3. Hàm xử lý logic đăng ký tài khoản mới
async function registerUser() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // 3.1 Kiểm tra dữ liệu không được để trống (Validation)
  if (!name || !email || !password || !confirmPassword) {
    showToast('Vui lòng điền đầy đủ tất cả các trường thông tin!', 'error');
    return;
  }

  // 3.2 Kiểm tra độ dài mật khẩu tối thiểu 8 ký tự
  if (password.length < 8) {
    showToast('Mật khẩu phải có độ dài tối thiểu từ 8 ký tự trở lên!', 'warning');
    return;
  }

  // 3.3 Kiểm tra mật khẩu và xác nhận mật khẩu có trùng khớp không
  if (password !== confirmPassword) {
    showToast('Mật khẩu và xác nhận mật khẩu không khớp!', 'error');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xử lý...';
    }

    // Bước 4: Gọi API đăng ký chuẩn Hexagonal RESTful (/api/auth/register)
    // Server tự động kiểm tra trùng lặp email, băm Bcrypt và lưu vào MySQL
    const response = await authApi.register({
      name,
      email,
      password
    });

    showToast(response.data.message || 'Đăng ký tài khoản thành công! Đang chuyển đến trang đăng nhập...', 'success');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1200);

  } catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    const errorMsg = error.response?.data?.error || error.message || 'Đăng ký thất bại! Vui lòng thử lại.';
    showToast(errorMsg, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng Ký';
    }
  }
}
