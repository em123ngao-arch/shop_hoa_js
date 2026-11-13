import { requestAuthJson, showAuthToast } from './auth-flow.js';

const form = document.getElementById('forgotPasswordForm');
const submitButton = document.getElementById('forgotSubmitBtn');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email')?.value.trim().toLowerCase() || '';
  const errorElement = document.getElementById('emailError');
  if (errorElement) errorElement.textContent = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errorElement) errorElement.textContent = 'Vui lòng nhập email hợp lệ.';
    return;
  }

  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Đang gửi...'; }
  try {
    const response = await requestAuthJson('/api/auth/forgot-password', { email });
    showAuthToast(response.message, 'success');
    form.hidden = true;
    const result = document.getElementById('forgotResult');
    if (result) { result.textContent = response.message; result.hidden = false; }
    const loginLink = document.getElementById('forgotLoginLink');
    if (loginLink) loginLink.hidden = false;
  } catch (error) {
    const message = error.data?.error?.message || 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.';
    showAuthToast(message, 'error');
  } finally {
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = 'Gửi hướng dẫn'; }
  }
});
