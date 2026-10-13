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
