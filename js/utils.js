/**
 * utils.js - Các hàm tiện ích dùng chung
 * Viết bằng JavaScript thuần & ES6+, kèm chú thích tiếng Việt rõ ràng
 */

/**
 * Định dạng giá tiền theo chuẩn Việt Nam (VND)
 * Kế thừa chuẩn theo hàm formatPrice của Giáo viên trong app.js
 * @param {number|string} price - Số tiền cần định dạng
 * @returns {string} Chuỗi định dạng ví dụ: "350.000 ₫"
 */
export function formatPrice(price = 0) {
  return Number(price).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND'
  });
}

/**
 * Tạo chuỗi hiển thị số sao đánh giá vàng
 * @param {number} rating - Số sao (1 - 5)
 * @returns {string} Chuỗi sao HTML
 */
export function renderStars(rating = 5) {
  const fullStars = Math.floor(rating);
  let starsHtml = '';
  for (let i = 0; i < fullStars; i++) {
    starsHtml += '★';
  }
  for (let i = fullStars; i < 5; i++) {
    starsHtml += '☆';
  }
  return `<span class="stars">${starsHtml}</span>`;
}

/**
 * Hiển thị thông báo Toast góc màn hình (Không dùng alert thô thiển)
 * @param {string} message - Nội dung thông báo
 * @param {string} type - 'success' hoặc 'error'
 */
export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Hiển thị mượt mà
  setTimeout(() => toast.classList.add('show'), 10);

  // Tự động biến mất sau 3 giây
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Cập nhật số lượng sản phẩm hiển thị trên icon giỏ hàng ở Header
 */
export function updateCartBadge() {
  const cartBadge = document.getElementById('cartCount');
  if (!cartBadge) return;

  try {
    const cart = JSON.parse(localStorage.getItem('SHOP_HOA_CART')) || [];
    // Sử dụng reduce() để tính tổng số lượng các mặt hàng trong giỏ
    const totalCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);
    cartBadge.textContent = totalCount;
  } catch (error) {
    cartBadge.textContent = '0';
  }
}

/**
 * Hiển thị trạng thái đăng nhập trên Header
 * Tự động nhận diện 3 Role: Admin, Staff (Kế toán), Customer (Khách hàng)
 * - Nếu đã đăng nhập: Hiển thị "Xin chào, [Tên]", huy hiệu Role, Nút tắt vào Quản trị/Kế toán (nếu có quyền), Nút Đăng xuất
 * - Nếu chưa đăng nhập: Hiển thị 2 liên kết "Đăng nhập" & "Đăng ký"
 */
export function renderHeaderAuth() {
  const authContainer = document.getElementById('headerAuthArea');
  if (!authContainer) return;

  const savedUser = localStorage.getItem('user');
  if (!savedUser) {
    authContainer.innerHTML = `
      <a href="./login.html" class="auth-link">Đăng nhập</a>
      <a href="./register.html" class="auth-link">Đăng ký</a>
    `;
    return;
  }

  try {
    const user = JSON.parse(savedUser);
    const role = user.role || 'customer';

    let roleBadge = '';
    let adminBtn = '';

    if (role === 'admin') {
      roleBadge = `<span class="user-role-badge badge-admin" title="Quyền Quản Trị Viên Toàn Quyền">👑 Quản Trị</span>`;
      adminBtn = `
        <a href="./admin.html" class="admin-quick-btn admin-btn-pulse" title="Truy cập Trang Quản Trị Hệ Thống">
          <span>⚙️ Quản Trị</span>
        </a>
      `;
    } else if (role === 'staff') {
      roleBadge = `<span class="user-role-badge badge-staff" title="Quyền Kế Toán: Hóa Đơn & Thống Kê">📑 Kế Toán</span>`;
      adminBtn = `
        <a href="./admin.html" class="admin-quick-btn staff-btn-pulse" title="Truy cập Báo Cáo Kế Toán & Hóa Đơn">
          <span>📊 Kế Toán</span>
        </a>
      `;
    } else {
      roleBadge = `<span class="user-role-badge badge-cust" title="Tài Khoản Khách Hàng Thân Thiết">🌸 Khách Hàng</span>`;
    }

    authContainer.innerHTML = `
      <div class="user-logged-box">
        <div class="user-greeting">
          <span class="user-hello">Xin chào,</span>
          <strong class="user-display-name" title="${user.email}">${user.name || user.email}</strong>
          ${roleBadge}
        </div>
        ${adminBtn}
        <button type="button" id="btnLogoutHeader" class="btn-logout-header" title="Đăng xuất khỏi tài khoản">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Đăng xuất</span>
        </button>
      </div>
    `;

    // Gắn sự kiện Đăng xuất
    const btnLogout = document.getElementById('btnLogoutHeader');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản này?')) {
          localStorage.removeItem('user');
          sessionStorage.removeItem('admin_authenticated');
          showToast('Đã đăng xuất tài khoản thành công!', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 350);
        }
      });
    }
  } catch (error) {
    console.error('Lỗi khi đọc tài khoản từ localStorage:', error);
    localStorage.removeItem('user');
    authContainer.innerHTML = `
      <a href="./login.html" class="auth-link">Đăng nhập</a>
      <a href="./register.html" class="auth-link">Đăng ký</a>
    `;
  }
}
