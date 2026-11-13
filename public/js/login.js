import { authApi } from './api.js';
import { showToast } from './utils.js';
import { mergeGuestWishlistToUser } from './storage.js';
import { getSafeReturnUrl, initPasswordToggles, preserveReturnUrl } from './auth-flow.js';

initPasswordToggles();
preserveReturnUrl(document.querySelector('.auth-switch a[href*="register"]'), 'register.html');

// 1. Lấy form đăng nhập từ DOM
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    login();
  });
}
// 2. Viết hàm login gọi API POST /api/auth/login
async function login() {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const rememberMe = Boolean(document.getElementById('rememberMe')?.checked);

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
    const response = await authApi.login({ email, password, rememberMe });
    const { user } = response.data;
    localStorage.setItem('user', JSON.stringify(user));

    // 2.4 Hợp nhất danh sách yêu thích từ khách vãng lai (guest) vào tài khoản vừa đăng nhập
    mergeGuestWishlistToUser(user.id);

    showToast(`Đăng nhập thành công! Xin chào ${user.name || user.email}`, 'success');

    // 2.5 Phân quyền điều hướng theo 3 vai trò (Role)
    const role = user.role || 'customer';

    const returnUrl = getSafeReturnUrl(null);
    const defaultUrl = role === 'admin' || role === 'staff' ? './admin.html' : './index.html';
    setTimeout(() => window.location.replace(returnUrl || defaultUrl), 350);

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    const msg = error.response?.data?.error?.message || error.response?.data?.error || 'Tài khoản hoặc mật khẩu không chính xác!';
    showToast(msg, 'error');
  } finally {
    const submitBtn = loginForm.querySelector('button[type="submit"]') || document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng Nhập';
    }
  }
}
