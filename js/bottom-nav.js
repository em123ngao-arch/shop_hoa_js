import { updateCartBadge } from './utils.js';
import { openCartDrawer } from './cart-drawer.js';

/**
 * bottom-nav.js - Mobile Bottom Navigation Bar Component
 * Mang lại trải nghiệm ngón tay cái (Thumb-zone) chuẩn ứng dụng di động cho khách mua hoa
 * Hỗ trợ Safe Area Inset (iPhone Home Bar), chống va chạm Chatbot/Toast, và tự ẩn khi bật bàn phím
 */

export function initMobileBottomNav() {
  ensureBottomNavMarkup();
  setupBottomNavInteractions();
  setupKeyboardDetection();
  updateCartBadge();
}

/**
 * Tự động chèn HTML của Bottom Nav nếu trang chưa có
 */
function ensureBottomNavMarkup() {
  if (document.getElementById('mobileBottomNav')) return;

  const currentPath = window.location.pathname.toLowerCase();
  const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '';
  const isOrders = currentPath.includes('orders.html');

  const nav = document.createElement('nav');
  nav.id = 'mobileBottomNav';
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('aria-label', 'Điều hướng nhanh trên di động');

  nav.innerHTML = `
    <button type="button" class="bottom-nav-item ${isHome ? 'active' : ''}" id="bottomNavHome" title="Trang Chủ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span>Trang Chủ</span>
    </button>

    <button type="button" class="bottom-nav-item" id="bottomNavCategories" title="Danh Mục Hoa">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
        <circle cx="12" cy="7" r="1"></circle>
      </svg>
      <span>Danh Mục</span>
    </button>

    <button type="button" class="bottom-nav-item" id="bottomNavSearch" title="Tìm Kiếm Hoa">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <span>Tìm Kiếm</span>
    </button>

    <button type="button" class="bottom-nav-item" id="bottomNavCart" data-action="open-cart" title="Giỏ Hàng">
      <div class="bottom-nav-cart-icon-wrap" id="bottomNavCartIconWrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <span class="bottom-nav-badge" id="bottomNavCartBadge" style="display: none;">0</span>
      </div>
      <span>Giỏ Hàng</span>
    </button>

    <button type="button" class="bottom-nav-item ${isOrders ? 'active' : ''}" id="bottomNavOrders" title="Đơn Hàng Của Tôi">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
      <span>Đơn Hàng</span>
    </button>
  `;

  document.body.appendChild(nav);
}

/**
 * Xử lý sự kiện bấm cho 5 nút điều hướng
 */
function setupBottomNavInteractions() {
  const currentPath = window.location.pathname.toLowerCase();
  const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '';

  // 1. Nút Trang Chủ
  const btnHome = document.getElementById('bottomNavHome');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      if (!isHome) {
        window.location.href = './index.html';
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // 2. Nút Danh Mục (cuộn mượt tại home, chuyển trang nếu ở trang khác)
  const btnCategories = document.getElementById('bottomNavCategories');
  if (btnCategories) {
    btnCategories.addEventListener('click', () => {
      if (isHome) {
        const catSection = document.getElementById('categories') || document.querySelector('.category-nav') || document.getElementById('products');
        if (catSection) {
          catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        window.location.href = './index.html#categories';
      }
    });
  }

  // 3. Nút Tìm Kiếm (cuộn và focus vào ô search)
  const btnSearch = document.getElementById('bottomNavSearch');
  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      const searchInput = document.getElementById('headerSearchInput');
      if (searchInput) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          searchInput.focus();
        }, 200);
      } else if (!isHome) {
        window.location.href = './index.html?focusSearch=true';
      }
    });
  }

  // 4. Nút Giỏ Hàng (Mở Universal Cart Drawer trực tiếp)
  const btnCart = document.getElementById('bottomNavCart');
  if (btnCart) {
    btnCart.addEventListener('click', (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  }

  // 5. Nút Đơn Hàng (Tra cứu đơn)
  const btnOrders = document.getElementById('bottomNavOrders');
  if (btnOrders) {
    btnOrders.addEventListener('click', () => {
      window.location.href = './orders.html';
    });
  }
}

/**
 * Xử lý ẩn Bottom Nav khi bàn phím ảo hiển thị
 * Kết hợp dual-guard: window.visualViewport resize + focusin/focusout trên input
 */
function setupKeyboardDetection() {
  const bottomNav = document.getElementById('mobileBottomNav');
  if (!bottomNav) return;

  let isInputFocused = false;

  const checkKeyboardVisibility = () => {
    if (window.visualViewport) {
      const isShrunk = window.visualViewport.height < window.innerHeight * 0.85;
      if (isShrunk && isInputFocused) {
        bottomNav.classList.add('keyboard-hidden');
      } else if (!isInputFocused) {
        bottomNav.classList.remove('keyboard-hidden');
      }
    }
  };

  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      isInputFocused = true;
      if (window.innerWidth < 768) {
        bottomNav.classList.add('keyboard-hidden');
      }
    }
  });

  document.addEventListener('focusout', (e) => {
    isInputFocused = false;
    setTimeout(() => {
      if (!isInputFocused) {
        bottomNav.classList.remove('keyboard-hidden');
      }
    }, 150);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', checkKeyboardVisibility);
  }
}
