import { authApi } from './api.js';
import { showToast } from './utils.js';
import { mergeGuestWishlistToUser } from './storage.js';
import { getSafeReturnUrl, initPasswordToggles, preserveReturnUrl } from './auth-flow.js';

initPasswordToggles();
preserveReturnUrl(document.querySelector('.auth-switch a[href*="login"]'), 'login.html');

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
  const phoneInput = document.getElementById('phone');
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // 3.1 Kiểm tra dữ liệu không được để trống (Validation)
  if (!name || !email || !password || !confirmPassword) {
    showToast('Vui lòng điền đầy đủ tất cả các trường bắt buộc!', 'error');
    return;
  }

  // 3.1b Kiểm tra định dạng số điện thoại nếu người dùng nhập (Tùy chọn)
  if (phone) {
    const cleanPhone = phone.replace(/[\s.-]/g, '');
    const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      showToast('Số điện thoại không đúng định dạng Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09)!', 'error');
      return;
    }
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
      password,
      phone: phone ? phone.trim() : null
    });

    const user = response.data.user;
    localStorage.setItem('user', JSON.stringify(user));
    mergeGuestWishlistToUser(user.id);
    showToast(response.data.message || 'Đăng ký thành công! Tài khoản của bạn đã đăng nhập.', 'success');
    const returnUrl = getSafeReturnUrl('./index.html');
    setTimeout(() => window.location.replace(returnUrl), 350);

  } catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    const errorMsg = error.response?.data?.error?.message || error.response?.data?.error || error.message || 'Đăng ký thất bại! Vui lòng thử lại.';
    showToast(errorMsg, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng Ký';
    }
  }
}
