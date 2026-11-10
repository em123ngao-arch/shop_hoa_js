import api, { authApi } from './api.js';
import { showToast } from './utils.js';
import { mergeGuestWishlistToUser } from './storage.js';

// 1. Lấy form đăng nhập từ DOM
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    login();
  });
}

// 1.1 Hỗ trợ điền nhanh tài khoản mẫu thử nghiệm khi bảo vệ đồ án (Client-side helper)
document.querySelectorAll('.btn-demo-fill').forEach((btn) => {
  btn.addEventListener('click', () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    if (emailInput && passwordInput) {
      emailInput.value = btn.dataset.email || '';
      passwordInput.value = btn.dataset.pass || '';
      showToast(`Đã điền tài khoản ${btn.textContent.trim()}`, 'info');
    }
  });
});

// 2. Viết hàm login gọi API POST /api/auth/login
async function login() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  // 2.1 Kiểm tra không được để trống
  if (!email || !password) {
    showToast('Vui lòng nhập đầy đủ email và mật khẩu!', 'error');
    return;
  }

  try {
    const submitBtn = loginForm.querySelector('button[type="submit"]') || document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang đăng nhập...';
    }

    // 2.2 Gọi API xác thực chuẩn RESTful
    const response = await authApi.login({ email, password });
    const { token, user } = response.data;

    // 2.3 Lưu token và thông tin người dùng vào storage
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    // 2.4 Hợp nhất danh sách yêu thích từ khách vãng lai (guest) vào tài khoản vừa đăng nhập
    mergeGuestWishlistToUser(user.id);

    showToast(`Đăng nhập thành công! Xin chào ${user.name || user.email}`, 'success');

    // 2.5 Phân quyền điều hướng theo 3 vai trò (Role)
    const role = user.role || 'customer';

    setTimeout(() => {
      if (role === 'admin' || role === 'staff') {
        sessionStorage.setItem('admin_authenticated', 'true');
        window.location.href = 'admin.html';
      } else {
        sessionStorage.removeItem('admin_authenticated');
        window.location.href = 'index.html';
      }
    }, 800);

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    const msg = error.response?.data?.error || 'Tài khoản hoặc mật khẩu không chính xác!';
    showToast(msg, 'error');
  } finally {
    const submitBtn = loginForm.querySelector('button[type="submit"]') || document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng Nhập';
    }
  }
}
