import {
  getCartSummary,
  updateCartQuantity,
  removeCartItem,
  applyVoucher,
  removeVoucher,
  fetchPromotions,
  calculateVoucherDiscount
} from './storage.js';
import { formatPrice, showToast, updateCartBadge, escapeHTML } from './utils.js';
import { formatVoucherDisplay } from './business-rules.js';

/**
 * cart-drawer.js - Universal Cart Drawer Component
 * Giỏ hàng trượt mượt mà dùng chung cho MỌI trang (index, detail, orders)
 * Không bao giờ bị giật tải lại trang hoặc nhảy về trang chủ
 */

let isDrawerInitialized = false;

/**
 * 1. TỰ ĐỘNG CHÈN MARKUP GIỎ HÀNG NẾU TRANG CHƯA CÓ
 */
function ensureCartDrawerMarkup() {
  const existingDrawer = document.getElementById('cartDrawer');
  const existingBackdrop = document.getElementById('cartBackdrop');

  if (existingDrawer && existingBackdrop) {
    // Đảm bảo nếu drawer đã có sẵn trong HTML tĩnh thì tự động bổ sung phần Ví Voucher nếu chưa có
    const voucherBox = existingDrawer.querySelector('.drawer-voucher-box');
    if (voucherBox && !existingDrawer.querySelector('#btnToggleVoucherWallet')) {
      const walletWrap = document.createElement('div');
      walletWrap.className = 'voucher-wallet-trigger-wrap';
      walletWrap.innerHTML = `
        <button type="button" class="btn-toggle-voucher-wallet" id="btnToggleVoucherWallet" title="Bấm để xem các mã ưu đãi đang mở">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
          <span>Xem Ví Voucher (Mã có sẵn)</span>
          <svg class="arrow-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      `;
      voucherBox.appendChild(walletWrap);
    }
    if (voucherBox && !existingDrawer.querySelector('#drawerAvailableVouchers')) {
      const vouchersList = document.createElement('div');
      vouchersList.id = 'drawerAvailableVouchers';
      vouchersList.className = 'available-vouchers-list hidden';
      voucherBox.appendChild(vouchersList);
    }
    return;
  }

  // Tạo phần tử Backdrop làm mờ nền
  let backdrop = document.getElementById('cartBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'cart-backdrop';
    backdrop.id = 'cartBackdrop';
    document.body.appendChild(backdrop);
  }

  // Tạo khung Cart Drawer trượt từ bên phải
  let drawer = document.getElementById('cartDrawer');
  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.className = 'cart-drawer';
    drawer.id = 'cartDrawer';
    drawer.setAttribute('aria-label', 'Giỏ hàng của bạn');
    drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-wrap">
          <h3>Giỏ Hàng Của Bạn</h3>
          <span class="drawer-count-tag" id="drawerCartCountTag">0 sản phẩm</span>
        </div>
        <button type="button" class="drawer-close-btn" id="drawerCloseBtn" aria-label="Đóng giỏ hàng">&times;</button>
      </div>

      <!-- Danh sách sản phẩm trong giỏ -->
      <div class="drawer-body" id="drawerCartBody">
        <div class="drawer-items-list" id="drawerCartItems">
          <!-- Đổ động bằng JS -->
        </div>

        <div class="drawer-empty-state hidden" id="drawerCartEmpty">
          <div class="empty-icon" style="margin-bottom: 12px; color: var(--text-muted); display: flex; justify-content: center;">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <h4 style="font-size: 16px; margin-bottom: 6px; font-weight: 700; color: var(--text-main);">Giỏ hàng của bạn đang trống</h4>
          <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 18px; line-height: 1.5;">
            Hãy khám phá các mẫu hoa kẽm nhung tinh tế của chúng tôi nhé!
          </p>
          <a href="./index.html#products" class="hero-cta" id="emptyCartExploreBtn" style="display: inline-block; padding: 10px 22px; font-size: 13px; text-decoration: none;">
            Khám Phá Mẫu Hoa
          </a>
        </div>
      </div>

      <!-- Khung nhập Voucher & Tính tiền -->
      <div class="drawer-footer" id="drawerCartFooter">
        <!-- Voucher Box -->
        <div class="drawer-voucher-box">
          <div class="voucher-input-wrap">
            <input type="text" id="voucherInput" placeholder="Nhập mã: KEMNHUNG15..." autocomplete="off">
            <button type="button" id="applyVoucherBtn">Áp Dụng</button>
          </div>
          <div id="appliedVoucherInfo" class="applied-voucher-info hidden"></div>

          <!-- Quick Voucher Wallet Trigger -->
          <div class="voucher-wallet-trigger-wrap">
            <button type="button" class="btn-toggle-voucher-wallet" id="btnToggleVoucherWallet" title="Bấm để xem các mã ưu đãi đang mở">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
              <span>Xem Ví Voucher (Mã có sẵn)</span>
              <svg class="arrow-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          <!-- Danh sách Voucher có sẵn -->
          <div id="drawerAvailableVouchers" class="available-vouchers-list hidden">
            <!-- Render động bằng JS -->
          </div>
        </div>

        <!-- Summary -->
        <div class="drawer-summary">
          <div class="summary-row">
            <span>Tạm tính:</span>
            <span id="drawerSubtotal">0 ₫</span>
          </div>
          <div class="summary-row discount-row hidden" id="drawerDiscountRow">
            <span id="drawerDiscountLabel">Giảm giá:</span>
            <span class="discount-val" id="drawerDiscount">-0 ₫</span>
          </div>
          <div class="summary-row total-row">
            <span>Tổng thanh toán:</span>
            <strong class="total-price" id="drawerTotal">0 ₫</strong>
          </div>
        </div>

        <!-- Nút hành động -->
        <button type="button" class="drawer-checkout-btn" id="drawerCheckoutBtn">
          Tiến Hành Đặt Hàng
        </button>
        <button type="button" class="drawer-continue-btn" id="drawerContinueBtn">
          Tiếp tục xem hoa
        </button>
      </div>
    `;
    document.body.appendChild(drawer);
  }
}

/**
 * 2. MỞ GIỎ HÀNG
 */
export function openCartDrawer() {
  ensureCartDrawerMarkup();
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');
  const birthdayModal = document.getElementById('birthdayModal');
  if (birthdayModal) birthdayModal.classList.add('hidden');
  sessionStorage.setItem('birthday_shown', 'true');

  if (!drawer || !backdrop) return;

  drawer.classList.add('open');
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';

  renderCartDrawer();
}

/**
 * 3. ĐÓNG GIỎ HÀNG
 */
export function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('cartBackdrop');

  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * 4. RENDER NỘI DUNG GIỎ HÀNG THỜI GIAN THỰC
 */
export function renderCartDrawer() {
  ensureCartDrawerMarkup();
  const summary = getCartSummary();

  const countTag = document.getElementById('drawerCartCountTag');
  const itemsContainer = document.getElementById('drawerCartItems');
  const emptyState = document.getElementById('drawerCartEmpty');
  const footerEl = document.getElementById('drawerCartFooter');
  const subtotalEl = document.getElementById('drawerSubtotal');
  const discountRow = document.getElementById('drawerDiscountRow');
  const discountLabel = document.getElementById('drawerDiscountLabel');
  const discountEl = document.getElementById('drawerDiscount');
  const totalEl = document.getElementById('drawerTotal');
  const appliedInfo = document.getElementById('appliedVoucherInfo');

  const totalCount = summary.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  if (countTag) countTag.textContent = `${totalCount} sản phẩm`;

  // Nếu giỏ trống
  if (summary.items.length === 0) {
    if (itemsContainer) itemsContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (subtotalEl) subtotalEl.textContent = '0 ₫';
    if (discountRow) discountRow.classList.add('hidden');
    if (totalEl) totalEl.textContent = '0 ₫';
    if (appliedInfo) appliedInfo.classList.add('hidden');
    if (footerEl) footerEl.style.display = 'none';
    return;
  }

  // Nếu có sản phẩm
  if (footerEl) footerEl.style.display = 'block';
  if (emptyState) emptyState.classList.add('hidden');

  if (itemsContainer) {
    itemsContainer.innerHTML = summary.items.map(item => `
      <div class="drawer-item" data-id="${item.id}">
        <img src="${item.image || './images/300.webp'}" alt="${item.name || item.title}" class="drawer-item-img" onerror="this.src='./images/300.webp'">
        <div class="drawer-item-info">
          <div class="drawer-item-title" title="${item.name || item.title}">${item.name || item.title}</div>
          ${item.addonsText ? `<div class="cart-item-addons" style="margin: 3px 0 5px 0;">+ Phụ kiện: ${item.addonsText}</div>` : ''}
          <div class="drawer-item-price">${formatPrice(item.price || 0)}</div>
          <div class="drawer-item-actions">
            <div class="drawer-qty-control">
              <button type="button" class="qty-btn qty-minus" data-id="${item.id}">&minus;</button>
              <span class="qty-value">${item.quantity || 1}</span>
              <button type="button" class="qty-btn qty-plus" data-id="${item.id}">+</button>
            </div>
            <button type="button" class="drawer-item-delete" data-id="${item.id}" title="Xóa mẫu hoa này khỏi giỏ">Xóa</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Tạm tính
  if (subtotalEl) subtotalEl.textContent = formatPrice(summary.subtotal);

  // Voucher giảm giá
  if (summary.discountAmount > 0 && summary.appliedVoucher) {
    if (discountRow) {
      discountRow.classList.remove('hidden');
      if (discountLabel) {
        const v = summary.appliedVoucher;
        const vMeta = formatVoucherDisplay(v, formatPrice);
        let vTag = `${v.code} (${vMeta.shortTag})`;
        if (summary.voucherCalculation && summary.voucherCalculation.isCapped) {
          vTag += ' [Tối đa]';
        }
        discountLabel.textContent = `Giảm giá (${vTag}):`;
      }
      if (discountEl) {
        discountEl.textContent = `-${formatPrice(summary.discountAmount)}`;
      }
    }
    if (appliedInfo) {
      appliedInfo.classList.remove('hidden');
      const v = summary.appliedVoucher;
      const vMeta = formatVoucherDisplay(v, formatPrice);
      const descText = vMeta.conditionText || `Mã ${v.code}`;
      appliedInfo.innerHTML = `
        <span class="voucher-tag" title="${escapeHTML(descText)}">
          <span>${escapeHTML(v.code)} (-${formatPrice(summary.discountAmount)})</span>
          <button type="button" class="btn-remove-voucher" id="btnRemoveVoucher" title="Gỡ mã giảm giá">&times;</button>
        </span>
      `;
      const btnRemoveVoucher = appliedInfo.querySelector('#btnRemoveVoucher');
      if (btnRemoveVoucher) {
        btnRemoveVoucher.addEventListener('click', () => {
          removeVoucher();
          showToast('Đã gỡ bỏ mã giảm giá');
          renderCartDrawer();
        });
      }
    }
  } else {
    if (discountRow) discountRow.classList.add('hidden');
    if (appliedInfo) appliedInfo.classList.add('hidden');
  }

  // Tổng tiền
  if (totalEl) totalEl.textContent = formatPrice(summary.total);

  // Nếu ví voucher đang mở, cập nhật lại trạng thái các nút
  const vouchersContainer = document.getElementById('drawerAvailableVouchers');
  if (vouchersContainer && !vouchersContainer.classList.contains('hidden')) {
    renderAvailableVouchersList();
  }
}

/**
 * Render danh sách các Voucher đang có sẵn trong hệ thống (Ví Voucher)
 */
export async function renderAvailableVouchersList() {
  const container = document.getElementById('drawerAvailableVouchers');
  if (!container) return;

  const summary = getCartSummary();
  const currentCode = summary.appliedVoucher?.code?.toUpperCase();

  try {
    const promotions = await fetchPromotions();
    const now = new Date();

    // Lọc nghiêm ngặt: Chỉ hiện các mã đang Active, còn hạn và còn số lượt dùng
    const activePromos = (promotions || []).filter(v => {
      if (!v.active) return false;
      if (v.startDate && new Date(v.startDate) > now) return false;
      if (v.endDate) {
        const end = new Date(v.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      if (typeof v.usageLimit === 'number' && typeof v.usedCount === 'number' && v.usedCount >= v.usageLimit) {
        return false;
      }
      return true;
    });

    if (activePromos.length === 0) {
      container.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); text-align: center; padding: 10px;">Hiện không có mã giảm giá nào còn hiệu lực.</div>';
      return;
    }

    container.innerHTML = activePromos.map(v => {
      const isApplied = currentCode === v.code.toUpperCase();
      const vMeta = formatVoucherDisplay(v, formatPrice);
      const discountText = vMeta.shortTag;

      let scopeText = 'Toàn Shop';
      if (v.scope === 'category') {
        if (v.targetCategoryIds?.map(String).includes('1')) scopeText = 'Hoa Kẽm Nhung';
        else if (v.targetCategoryIds?.map(String).includes('2')) scopeText = 'Bó Hoa Sinh Nhật';
        else scopeText = 'Theo Danh Mục';
      } else if (v.scope === 'product') {
        scopeText = 'Theo Mẫu Hoa';
      }

      const minOrderHint = vMeta.minOrder > 0 ? `Đơn từ ${formatPrice(vMeta.minOrder)}` : 'Mọi đơn hàng';
      const capHint = vMeta.isPercent && vMeta.maxDiscount ? ` • Tối đa ${formatPrice(vMeta.maxDiscount)}` : '';
      const saleHint = v.excludeSaleItems ? ' • Chặn hàng Flash Sale' : '';

      // ĐÁNH GIÁ ĐIỀU KIỆN ÁP DỤNG TRÊN GIỎ HÀNG HIỆN TẠI (SINGLE SOURCE OF TRUTH)
      const check = calculateVoucherDiscount(summary.items, v);
      const canApply = check.isValid;

      const cardClass = isApplied
        ? 'mini-voucher-card is-applied'
        : (canApply ? 'mini-voucher-card' : 'mini-voucher-card is-disabled');

      let btnText = 'Áp Dụng';
      let btnDisabled = '';
      let btnExtraClass = '';

      if (isApplied) {
        btnText = 'Đang Dùng';
        btnDisabled = 'disabled';
      } else if (!canApply) {
        btnText = 'Chưa Đủ ĐK';
        btnDisabled = 'disabled';
        btnExtraClass = 'btn-disabled';
      }

      const ineligibilityHint = (!canApply && !isApplied && check.reasonText)
        ? `<div class="mini-voucher-ineligible-hint">⚠️ ${check.reasonText}</div>`
        : '';

      return `
        <div class="${cardClass}">
          <div class="mini-voucher-left">
            <div class="mini-voucher-top">
              <span class="mini-voucher-code">${v.code}</span>
              <span class="mini-voucher-scope-badge">${scopeText}</span>
            </div>
            <div class="mini-voucher-desc">${v.name || v.desc} (${discountText}${capHint}) • ${minOrderHint}${saleHint}</div>
            ${ineligibilityHint}
          </div>
          <button type="button" class="btn-quick-apply-voucher ${isApplied ? 'is-applied' : ''} ${btnExtraClass}" data-code="${v.code}" ${btnDisabled}>
            ${btnText}
          </button>
        </div>
      `;
    }).join('');

    // Gắn sự kiện click nút "Áp Dụng" nhanh (chỉ cho các mã ĐỦ ĐIỀU KIỆN)
    const quickBtns = container.querySelectorAll('.btn-quick-apply-voucher:not(.is-applied):not([disabled])');
    quickBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        const res = await applyVoucher(code);
        if (res.success) {
          showToast(res.message, 'success');
          renderCartDrawer();
        } else {
          showToast(res.message, 'error');
        }
      });
    });
  } catch (err) {
    console.warn('Không thể nạp danh sách ví voucher:', err);
  }
}

/**
 * 5. KHỞI TẠO CÁC SỰ KIỆN TƯƠNG TÁC (CHỈ GÁN 1 LẦN)
 */
export function initUniversalCartDrawer() {
  ensureCartDrawerMarkup();

  // Bắt sự kiện click vào nút Giỏ Hàng trên Header
  const attachHeaderCartButtons = () => {
    const cartButtons = document.querySelectorAll('#cartButton, .cart-btn, [data-action="open-cart"]');
    cartButtons.forEach(btn => {
      // Tránh gán trùng lặp
      if (btn.dataset.cartDrawerAttached) return;
      btn.dataset.cartDrawerAttached = 'true';

      btn.addEventListener('click', (e) => {
        e.preventDefault(); // Ngăn chặn chuyển trang nếu là thẻ <a>
        openCartDrawer();
      });
    });
  };

  attachHeaderCartButtons();

  // Đóng khi click nút X, nút tiếp tục hoặc backdrop
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const drawerContinueBtn = document.getElementById('drawerContinueBtn');
  const cartBackdrop = document.getElementById('cartBackdrop');

  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeCartDrawer);
  if (drawerContinueBtn) drawerContinueBtn.addEventListener('click', closeCartDrawer);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartDrawer);

  const emptyCartExploreBtn = document.getElementById('emptyCartExploreBtn');
  if (emptyCartExploreBtn) {
    emptyCartExploreBtn.addEventListener('click', closeCartDrawer);
  }

  // Đóng khi nhấn phím Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('cartDrawer');
      if (drawer && drawer.classList.contains('open')) {
        closeCartDrawer();
      }
    }
  });

  // Event delegation cho các nút trong giỏ (Tăng, Giảm, Xóa)
  const drawerCartItems = document.getElementById('drawerCartItems');
  if (drawerCartItems && !drawerCartItems.dataset.eventsBound) {
    drawerCartItems.dataset.eventsBound = 'true';

    drawerCartItems.addEventListener('click', (e) => {
      const minusBtn = e.target.closest('.qty-minus');
      const plusBtn = e.target.closest('.qty-plus');
      const deleteBtn = e.target.closest('.drawer-item-delete');

      if (minusBtn) {
        const id = minusBtn.dataset.id;
        updateCartQuantity(id, -1);
        updateCartBadge();
        renderCartDrawer();
        return;
      }

      if (plusBtn) {
        const id = plusBtn.dataset.id;
        updateCartQuantity(id, 1);
        updateCartBadge();
        renderCartDrawer();
        return;
      }

      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        removeCartItem(id);
        updateCartBadge();
        renderCartDrawer();
        showToast('Đã xóa mẫu hoa khỏi giỏ hàng');
        return;
      }
    });
  }

  // Áp dụng Voucher
  const applyVoucherBtn = document.getElementById('applyVoucherBtn');
  const voucherInput = document.getElementById('voucherInput');
  if (applyVoucherBtn && voucherInput && !applyVoucherBtn.dataset.eventsBound) {
    applyVoucherBtn.dataset.eventsBound = 'true';

    const handleApplyVoucher = async () => {
      const code = voucherInput.value;
      if (!code.trim()) {
        showToast('Vui lòng nhập mã giảm giá', 'error');
        return;
      }
      const result = await applyVoucher(code);
      if (result.success) {
        showToast(result.message, 'success');
        voucherInput.value = '';
        renderCartDrawer();
      } else {
        showToast(result.message, 'error');
      }
    };

    applyVoucherBtn.addEventListener('click', handleApplyVoucher);
    voucherInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyVoucher();
      }
    });
  }

  // Bật/tắt Ví Voucher (Danh sách mã có sẵn)
  const toggleWalletBtn = document.getElementById('btnToggleVoucherWallet');
  const vouchersContainer = document.getElementById('drawerAvailableVouchers');
  if (toggleWalletBtn && vouchersContainer && !toggleWalletBtn.dataset.eventsBound) {
    toggleWalletBtn.dataset.eventsBound = 'true';
    toggleWalletBtn.addEventListener('click', () => {
      const isHidden = vouchersContainer.classList.toggle('hidden');
      toggleWalletBtn.classList.toggle('open', !isHidden);
      if (!isHidden) {
        renderAvailableVouchersList();
      }
    });
  }

  // Nút "Tiến Hành Đặt Hàng"
  const drawerCheckoutBtn = document.getElementById('drawerCheckoutBtn');
  if (drawerCheckoutBtn && !drawerCheckoutBtn.dataset.eventsBound) {
    drawerCheckoutBtn.dataset.eventsBound = 'true';

    drawerCheckoutBtn.addEventListener('click', () => {
      const summary = getCartSummary();
      if (summary.items.length === 0) {
        showToast('Giỏ hàng đang trống!', 'error');
        return;
      }

      closeCartDrawer();

      // Mở trực tiếp Modal Thanh Toán ngay tại trang hiện tại nếu có sẵn (cả index.html lẫn detail.html)
      if (typeof window.openCheckoutModal === 'function') {
        window.openCheckoutModal();
        return;
      }

      // Nếu ở trang khác chưa có modal (orders.html), điều hướng mượt mà
      window.location.href = './index.html?openCheckout=true';
    });
  }
}
