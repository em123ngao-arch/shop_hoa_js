import {
  fetchWishlistStorage,
  toggleWishlistStorage,
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchProducts,
  addToCart
} from './storage.js';

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

  let iconSvg = '';
  if (type === 'error') {
    // Biểu tượng dấu cảnh báo / lỗi (chấm than viền tròn) thay cho dấu tích xanh
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
  } else if (type === 'warning') {
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;
  } else {
    // Biểu tượng thành công (dấu tích)
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
  }

  toast.innerHTML = `
    ${iconSvg}
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
 * Cập nhật số lượng sản phẩm hiển thị trên icon giỏ hàng ở Header và Bottom Nav
 */
export function updateCartBadge() {
  const cartBadge = document.getElementById('cartCount');
  const bottomNavCartBadge = document.getElementById('bottomNavCartBadge');
  try {
    const cart = JSON.parse(localStorage.getItem('SHOP_HOA_CART')) || [];
    // Sử dụng reduce() để tính tổng số lượng các mặt hàng trong giỏ
    const totalCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);
    if (cartBadge) cartBadge.textContent = totalCount;
    if (bottomNavCartBadge) {
      bottomNavCartBadge.textContent = totalCount;
      bottomNavCartBadge.style.display = totalCount > 0 ? 'inline-flex' : 'none';
    }
  } catch (error) {
    if (cartBadge) cartBadge.textContent = '0';
    if (bottomNavCartBadge) {
      bottomNavCartBadge.textContent = '0';
      bottomNavCartBadge.style.display = 'none';
    }
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
      <div class="guest-auth-links">
        <a href="./login.html" class="auth-link">Đăng nhập</a>
        <span class="auth-divider">/</span>
        <a href="./register.html" class="auth-link">Đăng ký</a>
        <button type="button" id="btnGuestTrackOrder" class="guest-track-btn" title="Tra cứu tiến độ đơn hàng">
          Tra cứu đơn
        </button>
      </div>
    `;
    const btnGuestTrack = document.getElementById('btnGuestTrackOrder');
    if (btnGuestTrack) {
      btnGuestTrack.addEventListener('click', () => {
        window.location.href = './orders.html';
      });
    }
    return;
  }

  try {
    const user = JSON.parse(savedUser);
    const role = user.role || 'customer';

    let roleBadge = '';
    let adminItemHtml = '';

    if (role === 'admin') {
      roleBadge = `<span class="user-role-badge badge-admin" title="Quyền Quản Trị Viên">Quản Trị</span>`;
      adminItemHtml = `
        <a href="./admin.html" class="dropdown-item">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Quản trị hệ thống</span>
        </a>
      `;
    } else if (role === 'staff') {
      roleBadge = `<span class="user-role-badge badge-staff" title="Quyền Kế Toán">Kế Toán</span>`;
      adminItemHtml = `
        <a href="./admin.html" class="dropdown-item">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Kế toán & Hóa đơn</span>
        </a>
      `;
    } else {
      roleBadge = `<span class="user-role-badge badge-cust" title="Tài Khoản Khách Hàng">Khách Hàng</span>`;
    }

    const fullName = user.name || user.email || 'Khách hàng';
    const initialChar = fullName.trim().charAt(0).toUpperCase() || 'U';
    // Lấy tên ngắn gọn (từ cuối cùng hoặc tối đa 14 ký tự)
    const nameParts = fullName.trim().split(/\s+/);
    const shortName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fullName;

    const avatarMarkup = user.avatar
      ? `<img src="${user.avatar}" class="user-avatar-img" alt="${fullName}">`
      : `<span class="user-avatar-badge">${initialChar}</span>`;

    const dropdownAvatarMarkup = user.avatar
      ? `<img src="${user.avatar}" class="dropdown-avatar-img" alt="${fullName}">`
      : `<div class="dropdown-avatar">${initialChar}</div>`;

    authContainer.innerHTML = `
      <div class="user-profile-menu" id="userProfileMenu">
        <button type="button" class="user-menu-pill" id="userMenuPillBtn" aria-haspopup="true" aria-expanded="false" title="Tài khoản: ${fullName}">
          ${avatarMarkup}
          <span class="user-short-name">${shortName}</span>
          <svg class="user-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <div class="user-dropdown-menu" id="userDropdownMenu">
          <div class="dropdown-user-header">
            ${dropdownAvatarMarkup}
            <div class="dropdown-user-info">
              <strong class="dropdown-name" title="${fullName}">${fullName}</strong>
              <span class="dropdown-email" title="${user.email || ''}">${user.email || ''}</span>
              <div class="dropdown-role-row">${roleBadge}</div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <a href="./orders.html" class="dropdown-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Đơn hàng của tôi</span>
          </a>
          ${adminItemHtml}
          <div class="dropdown-divider"></div>
          <button type="button" id="btnLogoutDropdown" class="dropdown-item text-danger">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    `;

    // Tự động chèn Nút Wishlist & Chuông thông báo vào Header Actions
    injectHeaderWishlistAndNotifications(authContainer);

    // Tương tác Dropdown: Bấm để mở / đóng
    const profileMenu = document.getElementById('userProfileMenu');
    const pillBtn = document.getElementById('userMenuPillBtn');
    if (profileMenu && pillBtn) {
      pillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileMenu.classList.toggle('is-open');
        pillBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }

    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', (e) => {
      if (profileMenu && !profileMenu.contains(e.target)) {
        profileMenu.classList.remove('is-open');
        if (pillBtn) pillBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Đóng dropdown khi nhấn phím Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && profileMenu && profileMenu.classList.contains('is-open')) {
        profileMenu.classList.remove('is-open');
        if (pillBtn) pillBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Gắn sự kiện Đăng xuất
    const btnLogout = document.getElementById('btnLogoutDropdown');
    if (btnLogout) {
      btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
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
      <div class="guest-auth-links">
        <a href="./login.html" class="auth-link">Đăng nhập</a>
        <span class="auth-divider">/</span>
        <a href="./register.html" class="auth-link">Đăng ký</a>
      </div>
    `;
  }
}

/**
 * Làm sạch chuỗi HTML chống tấn công XSS khi chèn vào innerHTML
 * @param {string} str - Chuỗi đầu vào
 * @returns {string} Chuỗi an toàn
 */
export function escapeHTML(str = '') {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Chuẩn hóa chuỗi tiếng Việt thành không dấu để tìm kiếm thông minh
 * Áp dụng NFD Unicode Normalization kết hợp xử lý chữ đ/Đ
 * @param {string} str - Chuỗi tiếng Việt
 * @returns {string} Chuỗi không dấu, chữ thường
 */
export function removeVietnameseTones(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .toLowerCase()
    .trim();
}

/**
 * Trình quản lý khóa cuộn trang (ScrollLockManager)
 * Hoạt động trơn tru cả trên iOS Safari bằng cách lưu vị trí cuộn scrollY
 */
export const ScrollLockManager = {
  scrollY: 0,
  lockCount: 0,
  lock() {
    this.lockCount++;
    if (this.lockCount === 1) {
      this.scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.classList.add('body-scroll-locked');
    }
  },
  unlock() {
    this.lockCount = Math.max(0, this.lockCount - 1);
    if (this.lockCount === 0) {
      const top = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.classList.remove('body-scroll-locked');
      const scrollY = top ? parseInt(top, 10) * -1 : this.scrollY;
      window.scrollTo(0, scrollY);
    }
  }
};


// ============================================================================
// 5 TÍNH NĂNG NÂNG CAO CHO ĐỒ ÁN MÔN JAVASCRIPT (ZERO-AI-VIBE)
// ============================================================================

/**
 * 1. Nén ảnh đại diện bằng HTML5 Canvas (Chuẩn 200x200px, dung lượng < 30KB)
 * @param {File} file - File ảnh người dùng chọn
 * @param {number} maxDimension - Kích thước vuông
 * @param {number} quality - Tỷ lệ nén JPEG (0.8)
 * @returns {Promise<string>} Chuỗi Base64 an toàn cho LocalStorage
 */
export function compressImageFileToCanvasBase64(file, maxDimension = 200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Vui lòng chọn một file hình ảnh hợp lệ (PNG, JPG, WebP)'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.width;
        const height = img.height;

        // Cắt vuông căn giữa (Center square crop)
        const minSide = Math.min(width, height);
        const startX = (width - minSide) / 2;
        const startY = (height - minSide) / 2;

        canvas.width = maxDimension;
        canvas.height = maxDimension;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, maxDimension, maxDimension);

        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Không thể nạp hình ảnh để xử lý'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

/**
 * 2. Tự động chèn Nút Yêu Thích (Wishlist) và Chuông Thông Báo vào Header
 */
export function injectHeaderWishlistAndNotifications(authContainer) {
  const headerActions = authContainer ? authContainer.closest('.header-actions') : document.querySelector('.header-actions');
  if (!headerActions) return;

  const cartBtn = headerActions.querySelector('#cartButton');

  // Chèn Nút Wishlist nếu chưa có
  if (!headerActions.querySelector('#headerWishlistBtn')) {
    const wishlistBtn = document.createElement('button');
    wishlistBtn.type = 'button';
    wishlistBtn.className = 'header-wishlist-btn';
    wishlistBtn.id = 'headerWishlistBtn';
    wishlistBtn.title = 'Xem danh sách hoa yêu thích';
    wishlistBtn.setAttribute('aria-label', 'Danh sách yêu thích');
    wishlistBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
      <span class="wishlist-badge hidden" id="headerWishlistBadge">0</span>
    `;

    if (cartBtn) headerActions.insertBefore(wishlistBtn, cartBtn);
    else headerActions.appendChild(wishlistBtn);

    wishlistBtn.addEventListener('click', () => openWishlistModal());
    updateWishlistBadge();
  }

  // Chèn Chuông thông báo nếu chưa có
  if (!headerActions.querySelector('#headerNotifWrap')) {
    const notifWrap = document.createElement('div');
    notifWrap.className = 'notif-menu-wrap';
    notifWrap.id = 'headerNotifWrap';
    notifWrap.innerHTML = `
      <button type="button" class="notif-bell-btn" id="headerNotifBellBtn" title="Thông báo tiến trình đơn hàng" aria-label="Xem thông báo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notif-badge hidden" id="headerNotifBadge">0</span>
      </button>
      <div class="notif-dropdown hidden" id="headerNotifDropdown">
        <div class="notif-dropdown-header">
          <h4>Tiến Trình Đơn Hàng</h4>
          <button type="button" class="btn-text-mark-read" id="btnMarkAllNotifsRead">Đã đọc tất cả</button>
        </div>
        <div class="notif-dropdown-list" id="headerNotifList">
          <div class="notif-empty">Đang tải thông báo...</div>
        </div>
      </div>
    `;

    if (cartBtn) headerActions.insertBefore(notifWrap, cartBtn);
    else headerActions.appendChild(notifWrap);

    initNotificationCenter(notifWrap);
  }
}

/**
 * 3. Cập nhật số lượng huy hiệu Yêu Thích
 */
export async function updateWishlistBadge() {
  const badge = document.getElementById('headerWishlistBadge');
  if (!badge) return;
  const list = await fetchWishlistStorage();
  const count = list.length;
  badge.textContent = count;
  if (count > 0) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * 4. Mở Modal hiển thị danh sách hoa yêu thích
 */
export async function openWishlistModal() {
  let modalWrap = document.getElementById('wishlistModalWrap');
  if (!modalWrap) {
    modalWrap = document.createElement('div');
    modalWrap.id = 'wishlistModalWrap';
    modalWrap.className = 'wishlist-modal-backdrop hidden';
    document.body.appendChild(modalWrap);
  }

  modalWrap.classList.remove('hidden');
  await renderWishlistModalContent(modalWrap);
}

async function renderWishlistModalContent(modalWrap) {
  const wishlistIds = await fetchWishlistStorage();
  const allProducts = await fetchProducts();
  const favoriteProducts = allProducts.filter(p => wishlistIds.includes(String(p.id)));

  modalWrap.innerHTML = `
    <div class="wishlist-modal-content">
      <div class="wishlist-modal-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--color-rose)" stroke="var(--color-rose)" stroke-width="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          Mẫu Hoa Bạn Yêu Thích (${favoriteProducts.length})
        </h3>
        <button type="button" class="btn-wishlist-remove" id="btnCloseWishlistModal" title="Đóng">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="wishlist-modal-body">
        ${favoriteProducts.length === 0 ? `
          <div class="notif-empty" style="padding: 40px 20px;">
            <p style="margin-bottom: 10px; color: var(--text-muted);">Bạn chưa lưu mẫu hoa nào vào danh sách yêu thích.</p>
            <a href="./index.html#products" class="btn-wishlist-add-cart" style="display: inline-block; text-decoration: none;" id="btnExploreFlowersFromWishlist">Khám phá các mẫu hoa ngay</a>
          </div>
        ` : favoriteProducts.map(p => `
          <div class="wishlist-item-row" data-id="${p.id}">
            <img src="${p.image}" alt="${escapeHTML(p.name)}" class="wishlist-item-thumb">
            <div class="wishlist-item-info">
              <a href="./detail.html?id=${p.id}" class="wishlist-item-title">${escapeHTML(p.name)}</a>
              <span class="wishlist-item-price">${formatPrice(p.price)}</span>
            </div>
            <div class="wishlist-item-actions">
              <button type="button" class="btn-wishlist-add-cart btn-add-cart-from-wishlist" data-id="${p.id}">
                Thêm vào giỏ
              </button>
              <button type="button" class="btn-wishlist-remove btn-remove-from-wishlist" data-id="${p.id}" title="Bỏ yêu thích">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Gắn sự kiện đóng modal
  const btnClose = modalWrap.querySelector('#btnCloseWishlistModal');
  if (btnClose) {
    btnClose.addEventListener('click', () => modalWrap.classList.add('hidden'));
  }
  modalWrap.addEventListener('click', (e) => {
    if (e.target === modalWrap) modalWrap.classList.add('hidden');
  });

  const btnExplore = modalWrap.querySelector('#btnExploreFlowersFromWishlist');
  if (btnExplore) {
    btnExplore.addEventListener('click', () => modalWrap.classList.add('hidden'));
  }

  // Gắn sự kiện Thêm vào giỏ
  modalWrap.querySelectorAll('.btn-add-cart-from-wishlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pId = btn.dataset.id;
      const prod = allProducts.find(p => String(p.id) === String(pId));
      if (prod) {
        await addToCart(prod, 1);
        showToast(`Đã thêm "${prod.name}" vào giỏ hàng!`, 'success');
        updateCartBadge();
      }
    });
  });

  // Gắn sự kiện Bỏ yêu thích
  modalWrap.querySelectorAll('.btn-remove-from-wishlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pId = btn.dataset.id;
      await toggleWishlistStorage(pId);
      await updateWishlistBadge();
      await renderWishlistModalContent(modalWrap);
      showToast('Đã xóa mẫu hoa khỏi danh sách yêu thích', 'info');
    });
  });
}

/**
 * 5. Khởi tạo trung tâm thông báo (Notification Center)
 */
export function initNotificationCenter(notifWrap) {
  const bellBtn = notifWrap.querySelector('#headerNotifBellBtn');
  const dropdown = notifWrap.querySelector('#headerNotifDropdown');
  const listEl = notifWrap.querySelector('#headerNotifList');
  const badge = notifWrap.querySelector('#headerNotifBadge');
  const btnMarkAll = notifWrap.querySelector('#btnMarkAllNotifsRead');

  if (!bellBtn || !dropdown || !listEl) return;

  async function loadAndRenderNotifications() {
    const notifs = await fetchUserNotifications();
    const unreadCount = notifs.filter(n => !n.read).length;

    if (badge) {
      badge.textContent = unreadCount;
      if (unreadCount > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }

    if (notifs.length === 0) {
      listEl.innerHTML = `<div class="notif-empty">Hiện tại bạn chưa có thông báo đơn hàng nào.</div>`;
      return;
    }

    listEl.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-icon-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <div class="notif-content">
          <div class="notif-title">${escapeHTML(n.title)}</div>
          <div class="notif-desc">${escapeHTML(n.message)}</div>
          <div class="notif-time">${new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(n.createdAt).toLocaleDateString('vi-VN')}</div>
        </div>
      </div>
    `).join('');

    // Click vào item đánh dấu đã đọc
    listEl.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        await markNotificationRead(id);
        item.classList.remove('unread');
        loadAndRenderNotifications();
      });
    });
  }

  // Toggle mở dropdown
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.classList.toggle('hidden');
    if (!isHidden) {
      loadAndRenderNotifications();
    }
  });

  // Đóng dropdown khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (!notifWrap.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Nút đánh dấu đọc tất cả
  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await markAllNotificationsRead();
      loadAndRenderNotifications();
      showToast('Đã đánh dấu đọc toàn bộ thông báo', 'info');
    });
  }

  // Nạp ban đầu
  loadAndRenderNotifications();

  // Polling ngầm mỗi 10 giây để nhận thông báo thời gian thực khi Admin đổi trạng thái
  let previousUnread = 0;
  setInterval(async () => {
    const notifs = await fetchUserNotifications();
    const unread = notifs.filter(n => !n.read).length;
    if (unread > previousUnread && previousUnread !== 0) {
      // Có thông báo mới xuất hiện -> Bắn Toast thông báo
      const latest = notifs[0];
      if (latest && !latest.read) {
        showToast(latest.message, 'info');
      }
    }
    previousUnread = unread;
    if (badge) {
      badge.textContent = unread;
      if (unread > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }
  }, 10000);
}
