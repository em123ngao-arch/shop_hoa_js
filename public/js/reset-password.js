import { initPasswordToggles, requestAuthJson, showAuthToast } from './auth-flow.js';

initPasswordToggles();

const resetForm = document.getElementById('resetPasswordForm');
const statusElement = document.getElementById('resetStatus');
const params = new URLSearchParams(window.location.hash.slice(1));
const resetToken = params.get('token') || '';
// Remove the one-time token from the address bar and browser history as soon as it is read.
window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);

if (!resetToken || !/^[a-f0-9]{64}$/i.test(resetToken)) {
  if (statusElement) statusElement.textContent = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
  if (resetForm) resetForm.hidden = true;
}

resetForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.getElementById('password')?.value || '';
  const confirmation = document.getElementById('confirmPassword')?.value || '';
  const passwordError = document.getElementById('passwordError');
  const confirmError = document.getElementById('confirmPasswordError');
  if (passwordError) passwordError.textContent = '';
  if (confirmError) confirmError.textContent = '';

  if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
    if (passwordError) passwordError.textContent = 'Mật khẩu cần từ 8 ký tự và không vượt quá giới hạn hỗ trợ.';
    return;
  }
  if (password !== confirmation) {
    if (confirmError) confirmError.textContent = 'Mật khẩu xác nhận chưa khớp.';
    return;
  }

  const button = document.getElementById('resetSubmitBtn');
  if (button) { button.disabled = true; button.textContent = 'Đang cập nhật...'; }
  try {
    const response = await requestAuthJson('/api/auth/reset-password', { token: resetToken, newPassword: password });
    if (statusElement) statusElement.textContent = response.message;
    if (resetForm) {
      resetForm.hidden = true;
    }
    showAuthToast(response.message, 'success');
  } catch (error) {
    const message = error.data?.error?.message || 'Không thể đặt lại mật khẩu. Vui lòng yêu cầu liên kết mới.';
    showAuthToast(message, 'error');
    if (passwordError) passwordError.textContent = message;
    if (button) { button.disabled = false; button.textContent = 'Cập nhật mật khẩu'; }
  }
});
