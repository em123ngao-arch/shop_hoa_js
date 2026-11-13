/** Chỉ trả về đường dẫn cùng origin; chặn URL tuyệt đối và protocol-relative. */
export function getSafeReturnUrl(fallback = null) {
  const raw = new URLSearchParams(window.location.search).get('returnUrl');
  if (!raw) return fallback;
  if (raw.startsWith('//') || raw.includes('\\') || !raw.startsWith('/') && !raw.startsWith('./')) return fallback;

  try {
    const target = new URL(raw, window.location.origin);
    if (target.origin !== window.location.origin) return fallback;
    if (['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'].includes(target.pathname)) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

/** Giữ trang đích khi chuyển đổi giữa trang đăng nhập và đăng ký. */
export function preserveReturnUrl(link, pageName) {
  const returnUrl = getSafeReturnUrl(null);
  if (!link || !returnUrl) return;
  link.href = `./${pageName}?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** Khởi tạo nút ẩn/hiện mật khẩu bằng Vanilla JS và trạng thái trợ năng. */
export function initPasswordToggles(root = document) {
  root.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input || button.dataset.toggleInitialized === 'true') return;
    button.dataset.toggleInitialized = 'true';
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      button.title = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
      input.focus({ preventScroll: true });
    });
  });
}

export function currentInternalReturnUrl() {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (['/login.html', '/register.html', '/forgot-password.html', '/reset-password.html'].includes(window.location.pathname)) return '/';
  return current.startsWith('/') && !current.startsWith('//') ? current : '/';
}

/** Gọi endpoint same-origin cho màn hình reset để không nạp thư viện ngoài trang chứa token. */
export async function requestAuthJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Không thể hoàn tất yêu cầu.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/** Thông báo ngắn dùng DOM thuần, không phụ thuộc thư viện bên thứ ba. */
export function showAuthToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
