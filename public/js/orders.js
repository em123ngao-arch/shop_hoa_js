import { exportOrderInvoicePdf } from './excel-pdf.js';
import { fetchOrders, addToCart, uploadUserAvatarStorage, updateOrderStatus } from './storage.js';
import { formatPrice, showToast, renderHeaderAuth, updateCartBadge, compressImageFileToCanvasBase64, escapeHTML } from './utils.js';
import { isOrderPaid, isUnpaidSepayOrder } from './business-rules.js';
import { initUniversalCartDrawer, openCartDrawer } from './cart-drawer.js';
import { initMobileBottomNav } from './bottom-nav.js';
import api, { authApi, reviewApi } from './api.js';
import { DELIVERY_AREA_GROUPS } from './delivery-areas.js?v=20261115_area_rates_v2';
import { createDeliveryPinMap } from './delivery-map.js?v=20261115_google_maps_v2';

/**
 * orders.js - Logic Quản Lý & Tra Cứu Lịch Sử Đơn Hàng (Dedicated Page)
 * Chuẩn ES6+ sạch đẹp, bảo vệ đồ án với 4 hàm độc lập
 */

// Trạng thái dữ liệu cục bộ (State)
let allUserOrders = [];
let activeTab = 'all';
let ordersPagination = {
  currentPage: 1,
  limit: 10 // Chuẩn TMĐT thực tế: 10 đơn / trang, tránh xé nhỏ trang lặt vặt
};
let currentPollingInterval = null;
let cachedCurrentUser = null;
let reviewedProductIds = null;
let verifiedGuestPhone = '';
const orderAddressMaps = new WeakMap();
const orderAddressQuoteRequestIds = new WeakMap();

async function refreshOrderAddressQuote(card) {
  const area = card?.querySelector('.order-change-area')?.value || '';
  const address = card?.querySelector('.order-change-address')?.value.trim() || '';
  const addressDetails = card?.querySelector('.order-change-address-details')?.value.trim() || '';
  const mapElement = card?.querySelector('.order-change-delivery-map');
  const mapState = mapElement ? orderAddressMaps.get(mapElement) : null;
  const pin = mapState?.pin || null;
  const quoteElement = card?.querySelector('.order-change-delivery-quote');
  if (!quoteElement) return;
  const requestId = (orderAddressQuoteRequestIds.get(card) || 0) + 1;
  orderAddressQuoteRequestIds.set(card, requestId);
  if (!area) {
    quoteElement.textContent = 'Chọn phường để xem phí theo khu vực.';
    return;
  }

  quoteElement.textContent = 'Đang tra phí theo khu vực…';
  try {
    const response = await fetch('/api/delivery/quote', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, address, addressDetails, latitude: pin?.latitude, longitude: pin?.longitude })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'Không tra được phí giao.');
    if (!data.serviceable) throw new Error(data.message || 'Vị trí nằm ngoài vùng tự giao.');
    if (orderAddressQuoteRequestIds.get(card) !== requestId) return;
    quoteElement.textContent = `${data.zoneName}: ${data.fee === 0 ? 'miễn phí' : formatPrice(data.fee)}${data.requiresShopConfirmation ? ' • Shop cần xác nhận vị trí.' : ''}`;
  } catch (error) {
    if (orderAddressQuoteRequestIds.get(card) === requestId) quoteElement.textContent = error.message;
  }
}

let currentSepayConfig = null;

/**
 * ==========================================================================
 * 1. HÀM KHỞI CHẠY & NẠP DỮ LIỆU ĐƠN HÀNG (LOAD ORDERS)
 * ==========================================================================
 */
async function initOrdersPage() {
  // 1. Cập nhật thanh điều hướng Header (Auth + Cart Badge + Cart Drawer)
  renderHeaderAuth();
  updateCartBadge();
  initUniversalCartDrawer();
  initMobileBottomNav();

  // 2. Nhận diện tài khoản người dùng đăng nhập
  const currentUserJson = localStorage.getItem('user');
  cachedCurrentUser = null;
  if (currentUserJson) {
    try {
      cachedCurrentUser = JSON.parse(currentUserJson);
    } catch (e) {
      console.error('Lỗi giải mã user từ localStorage:', e);
    }
  }

  // Kiểm chứng cookie với backend; nếu chưa đăng nhập vẫn cho phép dùng chế độ tra cứu khách vãng lai
  try {
    const profileResponse = await authApi.getMe();
    cachedCurrentUser = profileResponse.data?.user || null;
    if (!cachedCurrentUser) throw new Error('Missing authenticated user');
    localStorage.setItem('user', JSON.stringify(cachedCurrentUser));
  } catch {
    cachedCurrentUser = null;
    localStorage.removeItem('user');
    renderHeaderAuth(false);
  }

  const avatarTriggerBtn = document.getElementById('btnUploadAvatarTrigger');
  const avatarDragHint = document.getElementById('avatarDragHint');
  if (avatarTriggerBtn) {
    avatarTriggerBtn.style.display = cachedCurrentUser ? '' : 'none';
  }
  if (avatarDragHint) {
    avatarDragHint.style.display = cachedCurrentUser ? 'block' : 'none';
  }
  const searchWrapper = document.querySelector('.orders-search-wrapper');
  if (searchWrapper) {
    searchWrapper.style.display = cachedCurrentUser ? '' : 'none';
  }

  // 3. Hiển thị thông tin Profile ban đầu bên cột trái
  renderUserProfileSidebar();

  // 4. Lấy danh sách đơn hàng nếu đã đăng nhập (khách vãng lai dùng form #guestOrderLookupForm)
  if (cachedCurrentUser) {
    try {
      const rawOrders = await fetchOrders();
      // Tin tưởng danh sách từ Server đã lọc theo user_id qua cookie phiên HttpOnly.
      allUserOrders = rawOrders.filter(order => {
        if (order.userId || order.user_id) {
          return String(order.userId || order.user_id) === String(cachedCurrentUser.id);
        }
        return Boolean(cachedCurrentUser.email && (order.email === cachedCurrentUser.email || order.customerEmail === cachedCurrentUser.email));
      });
      allUserOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (err) {
      console.error('Lỗi nạp đơn hàng:', err);
      allUserOrders = [];
    }
  } else {
    allUserOrders = [];
  }

  // Nạp trạng thái đánh giá theo lô cho sản phẩm trong các đơn đã hoàn tất.
  reviewedProductIds = null;
  if (cachedCurrentUser) {
    const completedProductIds = [...new Set(allUserOrders
      .filter(order => order.status === 'completed')
      .flatMap(order => Array.isArray(order.items) ? order.items : [])
      .map(item => item.productId || item.product_id)
      .filter(Boolean)
      .map(String))];
    if (completedProductIds.length) {
      try {
        const productIdBatches = Array.from(
          { length: Math.ceil(completedProductIds.length / 100) },
          (_, index) => completedProductIds.slice(index * 100, (index + 1) * 100)
        );
        const results = await Promise.all(productIdBatches.map(ids => reviewApi.getReviewedProductIds(ids)));
        reviewedProductIds = new Set(results.flatMap(result => result.data?.reviewedProductIds || []));
      } catch (err) {
        console.warn('Không tải được trạng thái đánh giá:', err);
      }
    } else {
      reviewedProductIds = new Set();
    }
  }

  // 6. Cập nhật lại số liệu Profile và số đếm trên các Tab sau khi đã có dữ liệu thực tế
  renderUserProfileSidebar();
  updateTabCountBadges();

  // 7. Nhận diện tham số ?orderCode=DH... hoặc ?id=... để điền sẵn ô tìm kiếm / tra cứu khách
  const urlParams = new URLSearchParams(window.location.search);
  const targetOrderRef = (urlParams.get('orderCode') || urlParams.get('id') || '').trim();
  if (targetOrderRef) {
    if (cachedCurrentUser) {
      const searchInput = document.getElementById('orderSearchInput');
      if (searchInput) {
        searchInput.value = targetOrderRef;
        const clearBtn = document.getElementById('orderSearchClear');
        if (clearBtn) clearBtn.style.display = 'block';
      }
    } else {
      const guestCodeInput = document.getElementById('guestOrderCode');
      const guestPhoneInput = document.getElementById('guestOrderPhone');
      if (guestCodeInput && /^(?:DH[A-Z0-9]{6,40}|ORD-[A-Z0-9-]{6,45})$/i.test(targetOrderRef)) {
        guestCodeInput.value = targetOrderRef.toUpperCase();
        setTimeout(() => guestPhoneInput?.focus(), 60);
      }
    }
  }

  // 8. Lọc và render danh sách đơn
  applyFiltersAndRender();

  // 9. Gán các sự kiện tương tác (luôn chạy cho cả khách vãng lai)
  setupOrdersPageEvents();

  // 10. Tự động đồng bộ trạng thái đơn hàng khi có đơn đang xử lý / đang giao
  startOrdersAutoSync();
}

let ordersAutoSyncTimer = null;
/**
 * Tự động đồng bộ dữ liệu đơn hàng khi có đơn chưa hoàn tất (mỗi 12 giây hoặc khi đổi tab về)
 */
function startOrdersAutoSync() {
  if (ordersAutoSyncTimer) clearInterval(ordersAutoSyncTimer);
  ordersAutoSyncTimer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || !cachedCurrentUser) return;
    const hasActiveOrders = allUserOrders.some(o => ['pending', 'confirmed', 'shipping'].includes(o.status));
    if (!hasActiveOrders) return;

    try {
      const rawOrders = await fetchOrders();
      const updatedUserOrders = rawOrders.filter(order => {
        if (order.userId || order.user_id) {
          return String(order.userId || order.user_id) === String(cachedCurrentUser.id);
        }
        return Boolean(cachedCurrentUser.email && (order.email === cachedCurrentUser.email || order.customerEmail === cachedCurrentUser.email));
      }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const oldSig = allUserOrders.map(o => `${o.id}:${o.status}:${o.paymentStatus}`).join('|');
      const newSig = updatedUserOrders.map(o => `${o.id}:${o.status}:${o.paymentStatus}`).join('|');

      if (oldSig !== newSig) {
        allUserOrders = updatedUserOrders;
        updateTabCountBadges();
        applyFiltersAndRender();
      }
    } catch {
      // Yên lặng khi có lỗi mạng tạm thời
    }
  }, 12000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cachedCurrentUser) {
    const hasActiveOrders = allUserOrders.some(o => ['pending', 'confirmed', 'shipping'].includes(o.status));
    if (hasActiveOrders) {
      fetchOrders().then(rawOrders => {
        const updatedUserOrders = rawOrders.filter(order => {
          if (order.userId || order.user_id) {
            return String(order.userId || order.user_id) === String(cachedCurrentUser.id);
          }
          return Boolean(cachedCurrentUser.email && (order.email === cachedCurrentUser.email || order.customerEmail === cachedCurrentUser.email));
        }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const oldSig = allUserOrders.map(o => `${o.id}:${o.status}:${o.paymentStatus}`).join('|');
        const newSig = updatedUserOrders.map(o => `${o.id}:${o.status}:${o.paymentStatus}`).join('|');
        if (oldSig !== newSig) {
          allUserOrders = updatedUserOrders;
          updateTabCountBadges();
          applyFiltersAndRender();
        }
      }).catch(() => {});
    }
  }
});

/**
 * Hiển thị thẻ Profile khách hàng bên cột trái
 */
function renderUserProfileSidebar() {
  const avatarEl = document.getElementById('profileAvatarInitial');
  const nameEl = document.getElementById('profileFullName');
  const phoneEl = document.getElementById('profilePhoneOrEmail');
  const badgeEl = document.getElementById('profileBadgeRole');
  const totalOrdersEl = document.getElementById('profileTotalOrders');
  const pointsEl = document.getElementById('profileRewardPoints');

  const user = cachedCurrentUser;
  if (user) {
    const displayName = user.name || user.email || 'Khách Hàng Thân Thiết';
    if (avatarEl) {
      if (user.avatar) {
        avatarEl.innerHTML = `<img src="${escapeHTML(user.avatar)}" alt="Avatar">`;
      } else {
        avatarEl.textContent = displayName.charAt(0).toUpperCase();
      }
    }
    if (nameEl) nameEl.textContent = displayName;
    if (phoneEl) phoneEl.textContent = user.phone || user.email || 'Thành viên tiệm hoa';
    if (badgeEl) {
      badgeEl.textContent = user.role === 'admin' ? 'Quản Trị Viên' : 'Thành Viên Thân Thiết';
    }
  } else {
    if (avatarEl) avatarEl.textContent = 'K';
    if (nameEl) nameEl.textContent = 'Khách Tra Cứu Đơn';
    if (phoneEl) phoneEl.textContent = 'Đăng nhập để xem lịch sử tích điểm';
    if (badgeEl) badgeEl.textContent = 'Khách Vãng Lai';
  }

  // Tính số đơn hợp lệ (không tính đơn hủy) và điểm tích lũy
  const validOrders = allUserOrders.filter(o => o.status !== 'cancelled');
  if (totalOrdersEl) totalOrdersEl.textContent = `${validOrders.length} đơn`;
  if (pointsEl) pointsEl.textContent = `${validOrders.length * 100} điểm`;
}

/**
 * Cập nhật số lượng đơn cho từng Tab
 */
function updateTabCountBadges() {
  const countAll = allUserOrders.length;
  // Đơn chờ quét QR: Phải là SePay, chưa thanh toán và CHƯA HỦY
  const countUnpaid = allUserOrders.filter(o => isUnpaidSepayOrder(o) && o.status !== 'cancelled').length;
  // Đơn đang cắm hoa: Đã xác nhận / đã trả tiền (gồm cả partially_refunded) và CHƯA HỦY
  const countCrafting = allUserOrders.filter(o => (o.status === 'confirmed' || (isOrderPaid(o) && o.status === 'pending')) && o.status !== 'cancelled').length;
  // Đơn đang giao: Đang vận chuyển và CHƯA HỦY
  const countShipping = allUserOrders.filter(o => o.status === 'shipping' && o.status !== 'cancelled').length;
  // Đơn hoàn tất
  const countCompleted = allUserOrders.filter(o => o.status === 'completed').length;
  // Đơn đã hủy
  const countCancelled = allUserOrders.filter(o => o.status === 'cancelled').length;

  const setBadge = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  };

  setBadge('countAll', countAll);
  setBadge('countUnpaid', countUnpaid);
  setBadge('countCrafting', countCrafting);
  setBadge('countShipping', countShipping);
  setBadge('countCompleted', countCompleted);
  setBadge('countCancelled', countCancelled);
}

/**
 * ==========================================================================
 * 2. HÀM LỌC ĐƠN THEO TAB VÀ TÌM KIẾM (FILTER ORDERS)
 * ==========================================================================
 */
function applyFiltersAndRender() {
  const searchInput = document.getElementById('orderSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = [...allUserOrders].sort((a, b) => {
    // Sắp xếp đơn mới nhất lên đầu tiên theo thời gian hoặc ID
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA && timeB && timeA !== timeB) return timeB - timeA;
    return Number(b.id || 0) - Number(a.id || 0);
  });

  // 1. Lọc theo Tab đang chọn (Đảm bảo không lẫn lộn đơn đã hủy vào các bước đang thực hiện)
  if (activeTab === 'unpaid') {
    filtered = filtered.filter(o => isUnpaidSepayOrder(o) && o.status !== 'cancelled');
  } else if (activeTab === 'crafting') {
    filtered = filtered.filter(o => (o.status === 'confirmed' || (isOrderPaid(o) && o.status === 'pending')) && o.status !== 'cancelled');
  } else if (activeTab === 'shipping') {
    filtered = filtered.filter(o => o.status === 'shipping' && o.status !== 'cancelled');
  } else if (activeTab === 'completed') {
    filtered = filtered.filter(o => o.status === 'completed');
  } else if (activeTab === 'cancelled') {
    filtered = filtered.filter(o => o.status === 'cancelled');
  }

  // 2. Lọc theo từ khóa tìm kiếm (Mã đơn, SĐT, Tên người nhận, Tên hoa)
  if (query) {
    filtered = filtered.filter(order => {
      const matchId = `${order.orderCode || ''} ${order.id || ''}`.toLowerCase().includes(query);
      const matchCust = order.customerName && order.customerName.toLowerCase().includes(query);
      const matchRecip = order.recipientName && order.recipientName.toLowerCase().includes(query);
      const matchPhone = (order.phone && order.phone.includes(query)) || (order.recipientPhone && order.recipientPhone.includes(query));
      const matchItems = Array.isArray(order.items) && order.items.some(item => (item.name || item.title || '').toLowerCase().includes(query));
      return matchId || matchCust || matchRecip || matchPhone || matchItems;
    });
  }

  // 3. Phân trang theo công thức: Math.ceil(tongsp / limit)
  const totalOrders = filtered.length;
  const limit = ordersPagination.limit;
  const totalPages = Math.ceil(totalOrders / limit) || 1;

  if (ordersPagination.currentPage > totalPages) {
    ordersPagination.currentPage = totalPages;
  }

  const startIndex = (ordersPagination.currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  // 4. Hiển thị danh sách kết quả trang hiện tại
  renderOrdersList(paginatedOrders);

  // 5. Hiển thị thanh điều hướng phân trang
  renderOrdersPagination(totalOrders, totalPages);
}

/**
 * 2.1. RENDER THANH ĐIỀU HƯỚNG PHÂN TRANG ĐƠN HÀNG
 */
function renderOrdersPagination(totalItems, totalPages) {
  const container = document.getElementById('ordersPagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const currentPage = ordersPagination.currentPage;
  let pageButtonsHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    pageButtonsHtml += `
      <button type="button" class="pagination-btn ${isActive ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  container.innerHTML = `
    <div class="pagination-container">
      <button type="button" class="pagination-btn pagination-nav-btn page-prev" ${currentPage <= 1 ? 'disabled' : ''}>
        « Trước
      </button>
      <div style="display: flex; gap: 6px;">
        ${pageButtonsHtml}
      </div>
      <button type="button" class="pagination-btn pagination-nav-btn page-next" ${currentPage >= totalPages ? 'disabled' : ''}>
        Sau »
      </button>
    </div>
  `;

  // Gắn sự kiện nút Trước
  const prevBtn = container.querySelector('.page-prev');
  if (prevBtn && currentPage > 1) {
    prevBtn.addEventListener('click', () => {
      ordersPagination.currentPage--;
      applyFiltersAndRender();
      document.querySelector('.orders-list-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Gắn sự kiện nút Sau
  const nextBtn = container.querySelector('.page-next');
  if (nextBtn && currentPage < totalPages) {
    nextBtn.addEventListener('click', () => {
      ordersPagination.currentPage++;
      applyFiltersAndRender();
      document.querySelector('.orders-list-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Gắn sự kiện từng số trang
  const pageBtns = container.querySelectorAll('.pagination-btn[data-page]');
  pageBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pageNum = Number(e.currentTarget.getAttribute('data-page'));
      if (pageNum && pageNum !== ordersPagination.currentPage) {
        ordersPagination.currentPage = pageNum;
        applyFiltersAndRender();
        document.querySelector('.orders-list-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/**
 * ==========================================================================
 * 3. HÀM IN GIAO DIỆN DANH SÁCH ĐƠN HÀNG (RENDER ORDERS LIST)
 * ==========================================================================
 */
function renderOrdersList(orders = []) {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;

  // Nếu không có đơn nào khớp
  if (orders.length === 0) {
    const isGuestInitial = !cachedCurrentUser && allUserOrders.length === 0;
    container.innerHTML = `
      <div class="orders-empty-state-card">
        <div class="empty-state-svg-wrap">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </div>
        <h3>${isGuestInitial ? 'Tra Cứu Tiến Độ Đơn Hàng' : 'Không Tìm Thấy Đơn Hàng Phù Hợp'}</h3>
        <p>${isGuestInitial
          ? 'Nhập Mã đơn hàng (VD: DH...) và Số điện thoại đặt hàng ở biểu mẫu phía trên để xem trạng thái đơn hoặc quét lại mã VietQR thanh toán.'
          : 'Hiện không có đơn hoa nào khớp với bộ lọc hoặc từ khóa bạn vừa nhập. Hãy khám phá ngay các bộ sưu tập hoa mới nhất!'}</p>
        <a href="./index.html#products" class="btn-explore-flowers">
          <span>Khám Phá Mẫu Hoa Ngay</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      </div>
    `;
    return;
  }

  // Dùng map() chuyển đổi từng đơn hàng thành thẻ HTML
  container.innerHTML = orders.map(order => {
    const safeOrderId = escapeHTML(order.id);
    const safeOrderCode = escapeHTML(order.orderCode || order.id);
    const isPaid = isOrderPaid(order);
    const isSepay = order.paymentMethod === 'sepay';
    const status = order.status || 'pending';
    const isCancelled = status === 'cancelled';
    const hasPendingCancel = Boolean(order.cancellationRequests?.some(request => request.status === 'pending') || order.cancellationRequest?.status === 'pending');
    const isVerifiedGuestOrder = Boolean(order.isGuestLookup && verifiedGuestPhone && order.orderCode);
    const canManageAsOwner = Boolean(isVerifiedGuestOrder || (cachedCurrentUser && String(order.userId || order.user_id) === String(cachedCurrentUser.id)));
    const canCancelOrder = Boolean(canManageAsOwner && ['pending', 'confirmed'].includes(status) && !hasPendingCancel);
    const cancelButtonText = ['paid', 'partially_paid'].includes(String(order.paymentStatus || '').toLowerCase()) ? 'Yêu Cầu Hủy' : 'Hủy Đơn';
    const isPartialPayment = String(order.paymentStatus || '').toLowerCase() === 'partially_paid';
    const canChangeAddress = Boolean(canManageAsOwner && ['paid', 'partially_paid'].includes(String(order.paymentStatus || '').toLowerCase()) && !['completed', 'cancelled'].includes(status));
    const pendingAddressChange = order.changeRequests?.some(request => ['pending', 'awaiting_payment'].includes(request.status));
    const currentDeliveryRegion = DELIVERY_AREA_GROUPS.find(group => group.areas.includes(order.deliveryArea));
    const deliveryRegionOptions = DELIVERY_AREA_GROUPS.map(group => `
      <option value="${escapeHTML(group.label)}" ${group === currentDeliveryRegion ? 'selected' : ''}>${escapeHTML(group.label)}</option>
    `).join('');
    const deliveryAreaOptions = currentDeliveryRegion?.areas.map(area =>
      `<option value="${escapeHTML(area)}" ${area === order.deliveryArea ? 'selected' : ''}>${escapeHTML(area)}</option>`
    ).join('') || '';
    const addressChangeFormHtml = canChangeAddress && !pendingAddressChange ? `
      <details style="flex-basis:100%;margin-top:10px;padding:10px;border:1px solid #E8E8E8;border-radius:8px;">
        <summary style="cursor:pointer;font-weight:700;">Yêu cầu đổi địa chỉ giao</summary>
        <div style="display:grid;gap:8px;margin-top:8px;">
          <span style="font-size:12px;color:#64748B;">Địa chỉ hiện tại: ${escapeHTML(order.address || 'Thông tin địa chỉ không khả dụng')}</span>
          <span class="delivery-city-fixed">Thành phố Hồ Chí Minh</span>
          <select class="order-change-region" aria-label="Quận/khu vực giao mới"><option value="">Chọn quận/khu vực quen thuộc</option>${deliveryRegionOptions}</select>
          <select class="order-change-area" aria-label="Phường/xã giao mới" ${currentDeliveryRegion ? '' : 'disabled'}><option value="">Chọn phường/xã hiện hành</option>${deliveryAreaOptions}</select>
          <input class="order-change-address" type="text" maxlength="255" placeholder="Số nhà, tên đường mới">
          <input class="order-change-address-details" type="text" maxlength="255" placeholder="Căn hộ, hẻm hoặc chỉ dẫn thêm (không bắt buộc)">
          <button type="button" class="btn-action-secondary btn-order-change-map">Chọn vị trí trên bản đồ</button>
          <div class="order-change-delivery-map delivery-pin-map" hidden role="application" aria-label="Bản đồ chọn địa chỉ giao mới"></div>
          <span class="order-change-map-hint field-hint" aria-live="polite">Cần ghim lại vị trí nếu đổi địa chỉ.</span>
          <span class="order-change-delivery-quote field-hint" aria-live="polite">Phí được tra sẵn theo phường đã chọn; ghim bản đồ không đổi phí.</span>
          <button type="button" class="btn-action-secondary btn-order-change-address" data-order-id="${order.isGuestLookup ? safeOrderCode : safeOrderId}">Gửi yêu cầu đổi địa chỉ</button>
          <label>Số điện thoại người đặt mới
            <input class="order-change-customer-phone" type="tel" maxlength="20" value="${escapeHTML(order.isGuestLookup ? '' : (order.customerPhone || order.phone || ''))}" placeholder="09xxxxxxxx">
          </label>
          <button type="button" class="btn-action-secondary btn-order-change-phone" data-order-id="${order.isGuestLookup ? safeOrderCode : safeOrderId}" data-change-type="phone">Gửi yêu cầu đổi số người đặt</button>
          <label>Số điện thoại người nhận mới
            <input class="order-change-recipient-phone" type="tel" maxlength="20" value="${escapeHTML(order.isGuestLookup ? '' : (order.recipientPhone || order.customerPhone || ''))}" placeholder="09xxxxxxxx">
          </label>
          <button type="button" class="btn-action-secondary btn-order-change-phone" data-order-id="${order.isGuestLookup ? safeOrderCode : safeOrderId}" data-change-type="recipient">Gửi yêu cầu đổi số người nhận</button>
        </div>
      </details>
    ` : (pendingAddressChange ? '<span style="flex-basis:100%;font-size:12px;color:#92400E;">Yêu cầu đổi thông tin đang được xử lý hoặc chờ khoản phí điều chỉnh.</span>' : '');

    // 1. Nhãn phương thức thanh toán & trạng thái (Xử lý dứt khoát trạng thái Đã Hủy)
    let paymentBadge = '';
    if (isCancelled) {
      paymentBadge = `<span class="payment-status-pill cancelled">Đã Hủy Đơn</span>`;
    } else if (isSepay) {
      paymentBadge = String(order.paymentStatus || '').toLowerCase() === 'partially_paid'
        ? `<span class="payment-status-pill cod">Đã trả trước ${formatPrice(order.amountReceived || 0)} • còn thu ${formatPrice(order.amountToCollectAtDelivery || 0)}</span>`
        : (isPaid
        ? `<span class="payment-status-pill paid"><span class="pulse-indicator"></span>SePay (Đã Thanh Toán)</span>`
        : `<span class="payment-status-pill unpaid"><span class="pulse-indicator"></span>SePay (Chờ Quét QR)</span>`);
    } else {
      paymentBadge = isPaid
        ? `<span class="payment-status-pill paid">COD (Đã Thu Tiền)</span>`
        : `<span class="payment-status-pill cod">COD (Thu Khi Nhận Hoa)</span>`;
    }

    // 2. Lộ trình Nghệ Nhân Bó Hoa hoặc Banner Đã Hủy
    let timelineOrBannerHtml = '';
    if (isCancelled) {
      timelineOrBannerHtml = `
        <div class="order-cancelled-banner">
          <div class="order-cancelled-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          <div>
            <h5 class="order-cancelled-title">Đơn Hàng Đã Được Hủy</h5>
            <p class="order-cancelled-desc">Tiệm hoa đã dừng tiến trình cắm và giao đơn này theo yêu cầu của bạn.</p>
          </div>
        </div>
      `;
    } else {
      // Tính toán tiến trình 4 bước bình thường
      let step1Class = 'done';
      let step2Class = 'done';
      let step2Sub = isPaid ? 'Đã nhận tiền' : 'Đã duyệt';
      let step3Class = '';
      let step3Sub = 'Đang uốn kẽm';
      let step4Class = '';
      let step4Sub = 'Dự kiến trong ngày';
      let fillProgress = 0.33;

      if (isSepay && !isPaid) {
        step2Class = 'active';
        step2Sub = 'Chờ quét QR';
        fillProgress = 0.15;
      } else if (status === 'confirmed' || (isPaid && status === 'pending')) {
        step3Class = 'active green-active';
        step3Sub = 'Đang bó hoa';
        fillProgress = 0.66;
      } else if (status === 'shipping') {
        step3Class = 'done';
        step3Sub = 'Đã cắm xong';
        step4Class = 'active green-active';
        step4Sub = 'Đang giao hoa';
        fillProgress = 0.88;
      } else if (status === 'completed') {
        step3Class = 'done';
        step3Sub = 'Đã cắm xong';
        step4Class = 'done';
        step4Sub = 'Đã nhận hoa';
        fillProgress = 1;
      }

      timelineOrBannerHtml = `
        <div class="floral-journey-timeline">
          <div class="floral-stepper-track">
            <div class="stepper-bg-line"></div>
            <div class="stepper-fill-line" style="--progress: ${fillProgress};"></div>

            <!-- Bước 1: Tiếp nhận -->
            <div class="floral-step-node ${step1Class}">
              <div class="floral-step-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <span class="floral-step-title">Đã Tiếp Nhận</span>
              <span class="floral-step-sub">Tiệm đã duyệt</span>
            </div>

            <!-- Bước 2: Khớp tiền / Duyệt COD -->
            <div class="floral-step-node ${step2Class}">
              <div class="floral-step-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </div>
              <span class="floral-step-title">${isSepay ? 'Khớp VietQR' : 'Duyệt COD'}</span>
              <span class="floral-step-sub">${step2Sub}</span>
            </div>

            <!-- Bước 3: Nghệ nhân cắm hoa -->
            <div class="floral-step-node ${step3Class}">
              <div class="floral-step-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <circle cx="6" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                  <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                  <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
                </svg>
              </div>
              <span class="floral-step-title">Nghệ Nhân Bó</span>
              <span class="floral-step-sub">${step3Sub}</span>
            </div>

            <!-- Bước 4: Giao hoa tận tay -->
            <div class="floral-step-node ${step4Class}">
              <div class="floral-step-circle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              </div>
              <span class="floral-step-title">Giao Tận Tay</span>
              <span class="floral-step-sub">${step4Sub}</span>
            </div>
          </div>
        </div>
      `;
    }

    // 3. Danh sách sản phẩm hoa trong đơn
    const items = Array.isArray(order.items) ? order.items : [];

    const itemsHtml = items.map(item => {
      const productId = item.productId || item.product_id;
      const hasReviewed = reviewedProductIds?.has(String(productId));
      const rateLinkHtml = (status === 'completed' && !order.isGuestLookup && productId)
        ? `<a href="./detail.html?id=${encodeURIComponent(productId)}#productReviewsSection" class="btn-rate-order-item">${hasReviewed ? 'Xem / Sửa Đánh Giá' : (reviewedProductIds ? 'Đánh Giá Hoa' : 'Xem / Viết Đánh Giá')}</a>`
        : '';
      return `
      <div class="order-product-row">
        <div class="order-product-info">
        <img src="${escapeHTML(item.image || item.imageUrl || './images/300.webp')}" alt="${escapeHTML(item.name || item.title || item.productName)}" class="order-flower-thumb" onerror="this.src='./images/300.webp'">
          <div>
            <h4 class="order-flower-title">${escapeHTML(item.name || item.title || item.productName)}</h4>
            <p class="order-flower-meta">Phân loại: ${escapeHTML(item.categoryName || 'Hoa Handmade')} &bull; Số lượng: &times;${escapeHTML(item.quantity || 1)}</p>
            ${item.addonsText || (Array.isArray(item.addons) && item.addons.length > 0) ? `<p class="order-flower-meta" style="color: var(--color-primary-dark); font-weight: 600;">+ Phụ kiện: ${escapeHTML(item.addonsText || item.addons.map(a => `${a.name} (+${formatPrice(a.price)})`).join(', '))}</p>` : ''}
          </div>
        </div>
        <div class="order-product-right">
          <div class="order-product-price">
            ${formatPrice((item.price || 0) * (item.quantity || 1))}
          </div>
          ${rateLinkHtml}
        </div>
      </div>
    `;
    }).join('');

    // 4. Thông tin người nhận và bưu thiếp viết tay
    const recipientName = escapeHTML(order.recipientName || order.customerName || order.customer_name || 'Người nhận hoa');
    const recipientPhone = escapeHTML(order.recipientPhone || order.phone || order.customerPhone || '');
    const deliveryAddress = escapeHTML(order.address || order.shippingAddress || order.shipping_address || '');
    const deliverySlot = escapeHTML(order.deliverySlot || 'Giao trong ngày');
    const cardMsg = order.isGuestLookup
      ? (order.hasGreetingCard ? '"Có đính kèm thiệp chúc mừng (nội dung được ẩn bảo mật)"' : '"Không đính kèm thiệp"')
      : (order.cardMessage && order.cardMessage.trim()
        ? `"${escapeHTML(order.cardMessage)}"`
        : '"Kèm thiệp chúc mừng viết tay theo yêu cầu"');

    // 5. Định dạng ngày đặt
    const orderDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      : 'Vừa đặt';

    // 5.1. Khung thông báo Đang giao hàng chuẩn TMĐT (Shopee / Grab / Flower Chimp)
    let shippingAlertBannerHtml = '';
    if (status === 'shipping' && !isCancelled) {
      const isPaidFull = isPaid || (isSepay && !isPartialPayment && Number(order.amountToCollectAtDelivery || 0) === 0);
      const amountToCollect = Number(order.amountToCollectAtDelivery || (isPaidFull ? 0 : (order.totalAmount || order.total_amount || 0)));

      const financialNoticeHtml = isPaidFull
        ? `<div class="shipping-cash-status status-paid">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
             <strong>Đơn đã thanh toán đủ 100% qua SePay:</strong> Quý khách <strong>KHÔNG CẦN</strong> trả thêm bất kỳ khoản phí nào cho shipper khi nhận hoa.
           </div>`
        : `<div class="shipping-cash-status status-cod-due">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="3"></circle></svg>
             <strong>Số tiền mặt cần chuẩn bị gửi shipper khi nhận hoa:</strong> <span class="cash-amount">${formatPrice(amountToCollect)}</span>
           </div>`;

      shippingAlertBannerHtml = `
        <div class="shipping-alert-banner">
          <div class="shipping-alert-header">
            <div class="shipping-badge-pulse">
              <span class="pulse-ring"></span>
              <span class="shipping-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
              </span>
              <strong>ĐANG TRÊN ĐƯỜNG GIAO ĐẾN BẠN</strong>
            </div>
            <span class="shipping-eta">Dự kiến giao: 15 – 45 phút</span>
          </div>

          <div class="shipping-alert-body">
            <p class="shipping-main-msg">
              Nghệ nhân đã chuẩn bị hoa xong, shipper đang vận chuyển bó hoa đến:<br>
              <strong><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${deliveryAddress || 'Địa chỉ giao hàng của bạn'}</strong>
            </p>

            <div class="shipping-phone-remind">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>Shipper sẽ liên hệ số <strong>${recipientPhone || 'số điện thoại của bạn'}</strong> khi tới nơi. Quý khách vui lòng <strong>CHÚ Ý ĐIỆN THOẠI</strong> để nhận hoa tươi đẹp nhất nhé!</span>
            </div>

            ${financialNoticeHtml}
          </div>

          <div class="shipping-alert-footer">
            <a href="https://zalo.me/0374905296" target="_blank" rel="noopener noreferrer" class="btn-shipping-zalo" title="Chat Zalo dặn dò shipper hoặc gửi vị trí">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.5 5.43 3.84 7.03-.17.94-.65 2.53-.74 2.89-.12.48.18.47.37.35.15-.09 2.11-1.4 3.01-2 .5.09 1.01.13 1.52.13 5.52 0 10-4.03 10-9S17.52 2 12 2z"/>
              </svg>
              <span>Chat Zalo Dặn Shipper</span>
            </a>
            <a href="tel:0374905296" class="btn-shipping-hotline" title="Gọi tổng đài hỗ trợ giao nhận">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>Hotline: 0374 905 296</span>
            </a>
          </div>
        </div>
      `;
    }

    // 6. Cụm nút hành động phân cấp chuẩn nghiệp vụ TMĐT thực tế
    let actionButtonsHtml = '';
    const amountCredit = Math.max(0, Number(order.amountCredit || 0));
    const supportSubject = amountCredit > 0
      ? `Yêu cầu hoàn phần tiền dư đơn hàng #${order.orderCode || order.id}`
      : `Hỗ trợ đơn hàng #${order.orderCode || order.id}`;
    const supportLinkHtml = amountCredit > 0 || ['shipping', 'completed'].includes(status)
      ? `<a class="order-support-link" href="mailto:tiemhoakemnhung@gmail.com?subject=${encodeURIComponent(supportSubject)}" aria-label="${amountCredit > 0 ? `Yêu cầu hoàn ${formatPrice(amountCredit)} tiền dư` : `Báo hoa dập móp hoặc cần hỗ trợ cho đơn ${safeOrderCode}`}">${amountCredit > 0 ? `Yêu cầu hoàn phần dư ${formatPrice(amountCredit)}` : 'Báo hoa dập/móp · Cần hỗ trợ'}</a>`
      : '';

    if (isCancelled) {
      // Đơn đã hủy: Không có hóa đơn/biên nhận
      actionButtonsHtml = `
        <span style="font-size: 12.5px; color: #94A3B8; font-style: italic;">Đơn hàng đã được hủy</span>
        <a href="./index.html#products" class="btn-action-secondary">Khám Phá Mẫu Hoa Khác</a>
      `;
    } else if (isSepay && isUnpaidSepayOrder(order)) {
      // Đơn SePay chưa thanh toán: Bắt buộc chỉ hiện Quét QR + Hủy đơn, KHÔNG có hóa đơn/biên nhận!
      actionButtonsHtml = `
      ${canCancelOrder ? `<button type="button" class="btn-action-secondary btn-order-cancel" data-order-id="${order.isGuestLookup ? safeOrderCode : safeOrderId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>${cancelButtonText}</span>
        </button>` : ''}
        <button type="button" class="btn-action-primary btn-order-pay-now" data-order-id="${safeOrderId}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Quét QR Thanh Toán Ngay</span>
        </button>
      `;
    } else if (!isPaid && !isPartialPayment) {
      // Đơn COD đang xử lý/giao (chưa thu tiền): Khách chưa trả tiền nên chưa có biên nhận thu tiền!
      actionButtonsHtml = `
        <a href="https://zalo.me/0374905296" target="_blank" rel="noopener noreferrer" class="btn-action-secondary" title="Liên hệ nghệ nhân đổi thiệp hoặc giờ giao qua Zalo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.5 5.43 3.84 7.03-.17.94-.65 2.53-.74 2.89-.12.48.18.47.37.35.15-.09 2.11-1.4 3.01-2 .5.09 1.01.13 1.52.13 5.52 0 10-4.03 10-9S17.52 2 12 2z"/>
          </svg>
          <span>Đổi Thiệp / Giờ Giao (Zalo)</span>
        </a>
        ${canCancelOrder ? `<button type="button" class="btn-action-secondary btn-order-cancel" data-order-id="${order.isGuestLookup ? safeOrderCode : safeOrderId}">
          <span>${cancelButtonText}</span>
        </button>` : ''}
      `;
    } else {
      // Đơn ĐÃ THANH TOÁN SEPAY hoặc ĐƠN ĐÃ HOÀN TẤT: Đã thu tiền thành công -> Chủ đơn được xem Hóa đơn điện tử
      actionButtonsHtml = `
        ${isPaid && !order.isGuestLookup ? `<button type="button" class="btn-action-secondary btn-order-view-pdf" data-order-id="${safeOrderId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Xem Hóa Đơn Điện Tử</span>
        </button>` : ''}
        <button type="button" class="btn-action-secondary btn-order-reorder" data-order-id="${safeOrderId}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Đặt Lại Đơn Này</span>
        </button>
        ${isPartialPayment ? `<span style="font-size:12px;color:#92400E;">Đã nhận ${formatPrice(order.amountReceived || 0)} • còn thu ${formatPrice(order.amountToCollectAtDelivery || 0)} khi giao</span>` : ''}
      `;
    }

    return `
      <article class="order-craft-card" data-order-id="${safeOrderId}">
        
        <!-- Header Thẻ Đơn Hàng -->
        <div class="order-card-header">
          <div>
            <div class="order-code-group">
              <span class="order-code-title">#${safeOrderCode}</span>
              <button type="button" class="btn-copy-code" data-copy="${safeOrderCode}">Sao chép</button>
            </div>
            <span class="order-date-time">Đặt lúc ${orderDate}</span>
          </div>
          <div>
            ${paymentBadge}
          </div>
        </div>

        <!-- Lộ Trình 4 Bước Nghệ Nhân Hoặc Banner Đã Hủy -->
        ${timelineOrBannerHtml}

        <!-- Thông báo Đang giao hàng nổi bật chuẩn TMĐT -->
        ${shippingAlertBannerHtml}

        <!-- Danh sách hoa trong đơn -->
        <div class="order-items-preview-box">
          ${itemsHtml}
        </div>

        <!-- Khung Thiệp Chúc Mừng & Người Nhận (Postcard Style) -->
        <div class="order-postcard-box">
          <div class="postcard-recipient">
            <div class="postcard-header">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>Người Nhận &amp; Khung Giờ Giao</span>
            </div>
            <p class="postcard-body-text">
              <strong>${recipientName}</strong> &bull; ${recipientPhone}
            </p>
            <p class="postcard-body-text">${deliveryAddress}</p>
            <p class="postcard-note" style="color: #047857; font-weight: 600;">Khung giờ: ${deliverySlot}</p>
          </div>

          <div class="postcard-message">
            <div class="postcard-header">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <span>Thông Điệp Thiệp Viết Tay</span>
            </div>
            <p class="postcard-message-quote">${cardMsg}</p>
            <p class="postcard-note">Nghệ nhân tiệm hoa sẽ nắn nót viết tay bằng mực chuyên dụng</p>
          </div>
        </div>

        <!-- Footer Thẻ Đơn & Cụm Nút Hành Động -->
        <div class="order-card-footer">
          <div class="order-total-block">
            <span class="order-total-label">Tổng thanh toán:</span>
            <span class="order-total-amount">${formatPrice(order.totalAmount || 0)}</span>
            ${order.discountAmount ? `<span style="display: block; font-size: 11.5px; color: var(--color-primary, #108474); font-weight: 600; margin-top: 2px;">(Đã tiết kiệm ${formatPrice(order.discountAmount)}${order.voucherCode ? ` với voucher ${order.voucherCode}` : ''})</span>` : ''}
          </div>
          <div class="order-action-buttons">
            ${actionButtonsHtml}
            ${addressChangeFormHtml}
          </div>
          ${supportLinkHtml}
        </div>

      </article>
    `;
  }).join('');
}

/**
 * ==========================================================================
 * 4. HÀM THIẾT LẬP SỰ KIỆN TƯƠNG TÁC (SETUP EVENTS)
 * ==========================================================================
 */
function setupOrdersPageEvents() {
  const guestLookupForm = document.getElementById('guestOrderLookupForm');
  if (guestLookupForm) {
    guestLookupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const messageEl = document.getElementById('guestOrderLookupMessage');
      const orderCode = document.getElementById('guestOrderCode')?.value.trim();
      const phone = document.getElementById('guestOrderPhone')?.value.trim();
      const submitButton = guestLookupForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang tra cứu...';
      }
      try {
        const response = await fetch('/api/orders/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderCode, phone })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Không thể tra cứu đơn hàng');
        verifiedGuestPhone = phone || '';
        if (!cachedCurrentUser) allUserOrders = [data];
        else if (!allUserOrders.some(order => String(order.id) === String(data.id))) allUserOrders.unshift(data);
        if (messageEl) {
          messageEl.style.color = '#108474';
          messageEl.textContent = `Đã tìm thấy đơn ${data.orderCode || data.id}.`;
        }
        activeTab = 'all';
        document.querySelectorAll('.orders-tab-pill').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === 'all'));
        updateTabCountBadges();
        applyFiltersAndRender();
      } catch (error) {
        if (messageEl) {
          messageEl.style.color = '#D92D20';
          messageEl.textContent = error.message;
        }
        showToast(error.message, 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Tra cứu đơn';
        }
      }
    });
  }

  // 1. Chuyển đổi Tabs phân loại đơn hàng
  const tabButtons = document.querySelectorAll('.orders-tab-pill');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.filter;
      ordersPagination.currentPage = 1;
      applyFiltersAndRender();
    });
  });

  // 2. Ô tìm kiếm đơn hàng realtime
  const searchInput = document.getElementById('orderSearchInput');
  const searchClear = document.getElementById('orderSearchClear');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchClear) {
        searchClear.style.display = searchInput.value ? 'block' : 'none';
      }
      ordersPagination.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClear.style.display = 'none';
      ordersPagination.currentPage = 1;
      applyFiltersAndRender();
    });
  }

  // 3. Tìm kiếm từ Header
  const headerSearchInput = document.getElementById('headerSearchInput');
  const headerSearchBtn = document.getElementById('headerSearchBtn');
  const handleHeaderSearch = () => {
    const val = headerSearchInput ? headerSearchInput.value.trim() : '';
    if (val) {
      window.location.href = `./index.html?search=${encodeURIComponent(val)}#products`;
    }
  };
  if (headerSearchBtn) headerSearchBtn.addEventListener('click', handleHeaderSearch);
  if (headerSearchInput) {
    headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleHeaderSearch();
    });
  }

  // 3.1. Sự kiện Upload & Kéo Thả Ảnh Đại Diện Cá Nhân (Canvas 200x200 nén WebP < 30KB)
  const avatarDropzone = document.getElementById('avatarDropzoneWrap');
  const avatarTrigger = document.getElementById('btnUploadAvatarTrigger');
  const avatarInput = document.getElementById('userAvatarFileInput');

  if (avatarInput) {
    const handleAvatarFile = async (file) => {
      if (!cachedCurrentUser) {
        showToast('Vui lòng đăng nhập để thay đổi ảnh đại diện!', 'warning');
        return;
      }
      if (!file || !file.type || !file.type.startsWith('image/')) {
        showToast('Vui lòng chọn đúng tệp hình ảnh (JPG, PNG, WebP)!', 'error');
        return;
      }

      try {
        showToast('Đang nén và tối ưu hóa ảnh đại diện...', 'info');
        const base64 = await compressImageFileToCanvasBase64(file, 200, 0.8);
        const updatedUser = await uploadUserAvatarStorage(base64);
        cachedCurrentUser = updatedUser;
        renderUserProfileSidebar();
        renderHeaderAuth(document.getElementById('headerAuthArea'));
        showToast('Đã cập nhật ảnh đại diện thành công!', 'success');
      } catch (err) {
        showToast(err.message || 'Lỗi xử lý ảnh đại diện', 'error');
      } finally {
        avatarInput.value = '';
      }
    };

    // Ngăn chặn trình duyệt mở ảnh toàn trang khi người dùng kéo thả trượt ra ngoài
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
        }
      }, false);
    });

    if (avatarDropzone) {
      let dragCounter = 0;

      avatarDropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (cachedCurrentUser) {
          avatarDropzone.classList.add('drag-active');
        }
      });

      avatarDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (cachedCurrentUser && !avatarDropzone.classList.contains('drag-active')) {
          avatarDropzone.classList.add('drag-active');
        }
      });

      avatarDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) {
          avatarDropzone.classList.remove('drag-active');
        }
      });

      avatarDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        avatarDropzone.classList.remove('drag-active');

        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0];
        if (file) {
          handleAvatarFile(file);
        }
      });

      avatarDropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btnUploadAvatarTrigger')) return;
        if (!cachedCurrentUser) {
          showToast('Vui lòng đăng nhập để thay đổi ảnh đại diện!', 'info');
          return;
        }
        avatarInput.click();
      });
    }

    if (avatarTrigger) {
      avatarTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!cachedCurrentUser) {
          showToast('Vui lòng đăng nhập để thay đổi ảnh đại diện!', 'info');
          return;
        }
        avatarInput.click();
      });
    }

    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleAvatarFile(file);
      }
    });
  }

  // 4. Bắt sự kiện trên các nút hành động (Event Delegation)
  const listContainer = document.getElementById('ordersListContainer');
  if (listContainer) {
    listContainer.addEventListener('toggle', event => {
      if (event.target.matches('.order-craft-card details') && event.target.open) {
        refreshOrderAddressQuote(event.target.closest('.order-craft-card'));
      }
    }, true);

    listContainer.addEventListener('change', event => {
      const card = event.target.closest('.order-craft-card');
      if (event.target.matches('.order-change-region')) {
        const regionSelect = event.target;
        const areaSelect = card?.querySelector('.order-change-area');
        const selectedGroup = DELIVERY_AREA_GROUPS.find(group => group.label === regionSelect.value);
        if (areaSelect) {
          areaSelect.replaceChildren(new Option(selectedGroup ? 'Chọn phường/xã hiện hành' : 'Chọn quận/khu vực trước', ''));
          selectedGroup?.areas.forEach(area => areaSelect.append(new Option(area, area)));
          areaSelect.disabled = !selectedGroup;
        }
      }
      if (event.target.matches('.order-change-region, .order-change-area')) {
        const mapElement = card?.querySelector('.order-change-delivery-map');
        const mapState = mapElement ? orderAddressMaps.get(mapElement) : null;
        if (mapState?.pin) {
          mapState.controller.clearPin(false);
          mapState.pin = null;
        }
        const hint = card?.querySelector('.order-change-map-hint');
        if (hint) hint.textContent = 'Khu vực vừa thay đổi. Hãy ghim lại đúng vị trí nhận hoa.';
        refreshOrderAddressQuote(card);
      }
    });

    listContainer.addEventListener('input', event => {
      if (!event.target.matches('.order-change-address, .order-change-address-details')) return;
      const card = event.target.closest('.order-craft-card');
      const mapElement = card?.querySelector('.order-change-delivery-map');
      const mapState = mapElement ? orderAddressMaps.get(mapElement) : null;
      if (mapState?.pin) {
        mapState.controller.clearPin(false);
        mapState.pin = null;
        const hint = card.querySelector('.order-change-map-hint');
        if (hint) hint.textContent = 'Địa chỉ chữ vừa thay đổi. Hãy ghim lại đúng điểm nhận hoa.';
      }
    });
    listContainer.addEventListener('click', (e) => {
      // A. Nút Sao Chép Mã Đơn
      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const textToCopy = copyBtn.dataset.copy;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast(`Đã sao chép mã đơn ${textToCopy}!`, 'success');
          }).catch(() => {
            showToast(`Mã đơn: ${textToCopy}`, 'info');
          });
        }
        return;
      }

      // B. Nút Xem Hóa Đơn Điện Tử PDF
      const pdfBtn = e.target.closest('.btn-order-view-pdf');
      if (pdfBtn) {
        const orderId = pdfBtn.dataset.orderId;
        const targetOrder = allUserOrders.find(o => String(o.id) === String(orderId));
        if (targetOrder) {
          exportOrderInvoicePdf(targetOrder, { isReceipt: true });
        } else {
          showToast('Không tìm thấy dữ liệu đơn hàng!', 'error');
        }
        return;
      }

      // C. Nút Quét QR Thanh Toán Ngay (SePay)
      const payBtn = e.target.closest('.btn-order-pay-now');
      if (payBtn) {
        const orderId = payBtn.dataset.orderId;
        const targetOrder = allUserOrders.find(o => String(o.id) === String(orderId));
        if (targetOrder) {
          openSepayQrModal(targetOrder);
        }
        return;
      }

      // D. Nút Đặt Lại Đơn Này (Reorder)
      const reorderBtn = e.target.closest('.btn-order-reorder');
      if (reorderBtn) {
        const orderId = reorderBtn.dataset.orderId;
        const targetOrder = allUserOrders.find(o => String(o.id) === String(orderId));
        if (targetOrder && Array.isArray(targetOrder.items)) {
          targetOrder.items.forEach(item => {
            const prodId = item.productId || item.product_id || item.id;
            const prodName = item.name || item.productName || item.title || 'Bó Hoa Kẽm Nhung Handmade';
            const prodPrice = Number(item.price || item.unitPrice || 0);
            if (prodId && prodName && prodPrice > 0) {
              addToCart({
                id: prodId,
                name: prodName,
                price: prodPrice,
                image: item.image || item.imageUrl || './images/300.webp',
                categoryName: item.categoryName || 'Hoa Kẽm Nhung'
              }, item.quantity || 1);
            }
          });
          updateCartBadge();
          showToast('Đã thêm lại các mẫu hoa vào giỏ hàng!', 'success');
          openCartDrawer();
        }
        return;
      }

      // E. Nút Hủy Đơn Hàng
      const cancelBtn = e.target.closest('.btn-order-cancel');
      if (cancelBtn) {
        const orderId = cancelBtn.dataset.orderId;
        if (confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderId} không?`)) {
          handleCancelOrder(orderId);
        }
        return;
      }
    });

    listContainer.addEventListener('click', async (e) => {
      const phoneButton = e.target.closest('.btn-order-change-phone');
      if (phoneButton) {
        const card = phoneButton.closest('.order-craft-card');
        const order = allUserOrders.find(item => String(item.id) === String(phoneButton.dataset.orderId) || String(item.orderCode) === String(phoneButton.dataset.orderId));
        const changeType = phoneButton.dataset.changeType;
        const phoneSelector = changeType === 'recipient' ? '.order-change-recipient-phone' : '.order-change-customer-phone';
        const phone = card?.querySelector(phoneSelector)?.value.trim() || '';
        if (!order || !/^0\d{8,10}$/.test(phone.replace(/[\s.-]/g, ''))) {
          showToast('Nhập số điện thoại Việt Nam hợp lệ trước khi gửi yêu cầu.', 'warning');
          return;
        }
        try {
          phoneButton.disabled = true;
          const orderKey = order.isGuestLookup ? order.orderCode : order.id;
          const response = await api.post(`/api/orders/${encodeURIComponent(orderKey)}/change-requests`, {
            changeType, value: { phone }, ...(order.isGuestLookup ? { phone: verifiedGuestPhone } : {})
          });
          const request = response.data?.request;
          if (order.isGuestLookup) {
            allUserOrders = allUserOrders.map(item => String(item.id) === String(order.id)
              ? { ...item, changeRequests: [...(item.changeRequests || []), request].filter(Boolean) }
              : item);
          } else {
            allUserOrders = await fetchOrders();
          }
          showToast(request?.status === 'pending'
            ? 'Đã gửi yêu cầu đổi số điện thoại; shop sẽ duyệt vì đơn đang giao.'
            : 'Đã cập nhật yêu cầu đổi số điện thoại.', 'success');
          applyFiltersAndRender();
        } catch (error) {
          showToast(error.response?.data?.error?.message || error.message || 'Không thể đổi số điện thoại.', 'error');
        } finally {
          phoneButton.disabled = false;
        }
        return;
      }

      const mapButton = e.target.closest('.btn-order-change-map');
      if (mapButton) {
        const card = mapButton.closest('.order-craft-card');
        const mapElement = card?.querySelector('.order-change-delivery-map');
        const hint = card?.querySelector('.order-change-map-hint');
        if (!mapElement) return;
        mapElement.hidden = false;
        const existingMap = orderAddressMaps.get(mapElement);
        if (existingMap) {
          requestAnimationFrame(() => existingMap.controller.invalidateSize());
          return;
        }
        mapButton.disabled = true;
        mapButton.textContent = 'Đang tải bản đồ…';
        createDeliveryPinMap(mapElement, {
          onChange: pin => {
            const mapState = orderAddressMaps.get(mapElement);
            if (mapState) mapState.pin = pin;
            if (hint) {
              hint.classList.remove('delivery-pin-hint-error');
              hint.textContent = pin
                ? `Đã ghim ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}. Phí vẫn tính theo phường.`
                : 'Chưa ghim vị trí giao mới. Bấm bản đồ để đặt ghim.';
            }
          },
          onError: message => {
            if (hint) {
              hint.textContent = message;
              hint.classList.add('delivery-pin-hint-error');
            }
          }
        }).then(controller => {
          orderAddressMaps.set(mapElement, { controller, pin: null });
          requestAnimationFrame(() => controller.invalidateSize());
        }).catch(error => {
          if (hint) {
            hint.textContent = error.message;
            hint.classList.add('delivery-pin-hint-error');
          }
          showToast(error.message, 'error');
        }).finally(() => {
          mapButton.disabled = false;
          mapButton.textContent = 'Chọn vị trí trên bản đồ';
        });
        return;
      }

      const changeButton = e.target.closest('.btn-order-change-address');
      if (!changeButton) return;
      const card = changeButton.closest('.order-craft-card');
      const order = allUserOrders.find(item => String(item.id) === String(changeButton.dataset.orderId) || String(item.orderCode) === String(changeButton.dataset.orderId));
      const address = card?.querySelector('.order-change-address')?.value.trim() || '';
      const addressDetails = card?.querySelector('.order-change-address-details')?.value.trim() || '';
      const area = card?.querySelector('.order-change-area')?.value || '';
      const mapElement = card?.querySelector('.order-change-delivery-map');
      const deliveryPin = mapElement ? orderAddressMaps.get(mapElement)?.pin : null;
      if (!order || !address || !area) { showToast('Chọn phường/xã và nhập số nhà, tên đường mới.', 'warning'); return; }
      if (!deliveryPin) { showToast('Ghim lại vị trí nhận hàng mới trên bản đồ trước khi gửi.', 'warning'); return; }
      try {
        changeButton.disabled = true;
        changeButton.textContent = 'Đang gửi yêu cầu...';
        const changeOrderKey = order.isGuestLookup ? order.orderCode : order.id;
        const response = await api.post(`/api/orders/${encodeURIComponent(changeOrderKey)}/change-requests`, {
          changeType: 'address', value: { address, addressDetails, area, latitude: deliveryPin.latitude, longitude: deliveryPin.longitude },
          ...(order.isGuestLookup ? { phone: verifiedGuestPhone } : {})
        });
        const result = response.data || {};
        if (result.paymentIntent) {
          showToast(`Địa chỉ mới tăng phí ${formatPrice(result.amountDueNow)}. Thanh toán qua mã riêng để áp dụng.`, 'info');
          await openSepayQrModal({ ...order, paymentIntent: result.paymentIntent });
        } else {
          showToast(result.request?.status === 'pending'
            ? 'Đã gửi yêu cầu đổi; shop cần duyệt vì đơn đang giao.'
            : 'Đã áp dụng địa chỉ mới. Phần chênh lệch giảm được giữ thành tiền đã trả trước.', 'success');
        }
        if (order.isGuestLookup) {
          const updatedGuestOrder = { ...order, changeRequests: [...(order.changeRequests || []), result.request].filter(Boolean) };
          allUserOrders = allUserOrders.map(item => String(item.id) === String(order.id) ? updatedGuestOrder : item);
        } else {
          allUserOrders = await fetchOrders();
        }
        applyFiltersAndRender();
      } catch (error) {
        showToast(error.response?.data?.error?.message || error.message || 'Không thể gửi yêu cầu đổi địa chỉ.', 'error');
      } finally {
        changeButton.disabled = false;
        changeButton.textContent = 'Gửi yêu cầu đổi địa chỉ';
      }
    });
  }

  // 5. Đóng Modal SePay
  const modalCloseBtn = document.getElementById('btnSepayModalClose');
  const sepayModal = document.getElementById('sepayQrModal');
  if (modalCloseBtn && sepayModal) {
    modalCloseBtn.addEventListener('click', closeSepayQrModal);
    sepayModal.addEventListener('click', (e) => {
      if (e.target === sepayModal) closeSepayQrModal();
    });
  }
}

/**
 * ==========================================================================
 * 4.1. HỦY ĐƠN HÀNG KHI CHƯA THANH TOÁN
 * ==========================================================================
 */
async function handleCancelOrder(orderId) {
  try {
    const target = allUserOrders.find(order => String(order.id) === String(orderId) || String(order.orderCode) === String(orderId));
    if (!target) throw new Error('Không tìm thấy đơn hàng cần hủy.');
    let updated;
    if (target.isGuestLookup) {
      const response = await api.post(`/api/orders/${encodeURIComponent(target.orderCode)}/cancellation-requests`, {
        reason: 'Khách yêu cầu hủy đơn', phone: verifiedGuestPhone
      });
      updated = {
        ...target,
        cancellationRequests: [...(target.cancellationRequests || []), response.data?.request].filter(Boolean)
      };
    } else {
      updated = await updateOrderStatus(target.id, 'cancelled');
    }
    const idx = allUserOrders.findIndex(order => String(order.id) === String(target.id));
    if (idx !== -1) allUserOrders[idx] = { ...allUserOrders[idx], ...updated };
    showToast(updated.cancellationRequest
      ? `Đã gửi yêu cầu hủy đơn #${orderId}. Shop sẽ xác nhận khoản hoàn tiền.`
      : `Đã hủy thành công đơn hàng #${orderId}`, 'success');
    renderUserProfileSidebar();
    updateTabCountBadges();
    applyFiltersAndRender();
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message || 'Không thể hủy đơn hàng';
    showToast(message, 'error');
  }
}

/**
 * ==========================================================================
 * 5. WORKFLOW: QUÉT MÃ VIETQR SEPAY KHI THANH TOÁN LẠI
 * ==========================================================================
 */
async function openSepayQrModal(order) {
  const modal = document.getElementById('sepayQrModal');
  const qrImg = document.getElementById('modalSepayQrImg');
  const amountEl = document.getElementById('modalSepayAmount');
  const contentEl = document.getElementById('modalSepayContent');
  const pollingText = document.getElementById('modalSepayPollingText');

  if (!modal) return;

  const intent = order.paymentIntent || order.paymentIntents?.find(item => item.status === 'pending');
  const totalAmount = Number(intent?.amount || order.totalAmount || 0);
  const paymentContent = intent?.referenceCode || intent?.reference_code || order.orderCode || order.order_code || order.id;

  // Hiển thị modal để người dùng có phản hồi ngay
  modal.style.display = 'flex';
  modal.classList.remove('hidden');

  let config;
  try {
    if (pollingText) pollingText.textContent = 'Đang tải thông tin chuyển khoản từ máy chủ...';
    const res = await fetch('/api/sepay/config');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Cổng thanh toán tạm thời không khả dụng');
    }
    config = await res.json();
    currentSepayConfig = config;
  } catch (err) {
    showToast(err.message || 'Không thể tải thông tin thanh toán từ máy chủ', 'error');
    if (pollingText) pollingText.innerHTML = `<span style="color: #D92D20; font-weight: 600;">${err.message || 'Không thể kết nối cấu hình ngân hàng'}</span>`;
    return;
  }

  // Tạo URL VietQR SePay Napas 247 chính chủ từ cấu hình máy chủ
  const qrUrl = config.simulationOnly ? '' : `https://qr.sepay.vn/img?acc=${encodeURIComponent(config.accountNumber)}&bank=${encodeURIComponent(config.bankCode)}&amount=${totalAmount}&des=${encodeURIComponent(paymentContent)}&template=compact`;

  const bankEl = document.getElementById('modalSepayBank');
  const accEl = document.getElementById('modalSepayAccount');
  const holderEl = document.getElementById('modalSepayHolder');
  if (bankEl) bankEl.textContent = config.bankCode;
  if (accEl) accEl.textContent = config.accountNumber;
  if (holderEl) holderEl.textContent = config.accountHolder;

  if (qrImg) {
    if (config.simulationOnly) qrImg.removeAttribute('src');
    else qrImg.src = qrUrl;
    qrImg.style.display = config.simulationOnly ? 'none' : 'block';
  }
  const localPlaceholder = document.getElementById('modalSepayLocalPlaceholder');
  if (localPlaceholder) localPlaceholder.classList.toggle('hidden', !config.simulationOnly);
  if (amountEl) amountEl.textContent = formatPrice(totalAmount);
  if (contentEl) contentEl.textContent = paymentContent;
      if (pollingText) pollingText.textContent = config.simulationOnly
        ? `LOCAL MOCK: ${formatPrice(totalAmount)} — không chuyển tiền thật.`
        : `Đang kiểm tra mã thanh toán ${paymentContent}...`;

  // Xóa interval polling cũ nếu có
  if (currentPollingInterval) clearInterval(currentPollingInterval);

  // Bắt đầu Polling kiểm tra trạng thái thanh toán từ backend mỗi 3 giây
  currentPollingInterval = setInterval(async () => {
    try {
      const phone = order.isGuestLookup ? (verifiedGuestPhone || '') : (order.phone || order.customerPhone || '');
      const headers = { 'Content-Type': 'application/json' };
      const res = await fetch(`/api/sepay/check-payment/${encodeURIComponent(order.id)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ phone, intentId: intent?.id || null })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.paid) {
          handlePaymentSuccess(data.order || order);
        } else if (data.cancelled) {
          if (currentPollingInterval) {
            clearInterval(currentPollingInterval);
            currentPollingInterval = null;
          }
          if (pollingText) pollingText.innerHTML = '<span style="color: #D92D20; font-weight: 600;">Đơn hàng đã bị hủy. Đã dừng kiểm tra.</span>';
          showToast('Đơn hàng này đã bị hủy', 'warning');
        } else if (data.order?.paymentIntent?.status === 'needs_review') {
          if (currentPollingInterval) { clearInterval(currentPollingInterval); currentPollingInterval = null; }
          if (pollingText) pollingText.textContent = 'Giao dịch đã đến nhưng cần shop đối soát số tiền hoặc mã thanh toán.';
          showToast('Khoản chuyển cần shop đối soát; chưa đánh dấu đã thanh toán.', 'warning');
        }
      }
    } catch (err) {
      // Bỏ qua lỗi ngắt kết nối tạm thời
    }
  }, 3000);

  // Nút Tôi Đã Chuyển Khoản (Kiểm tra tức thì không cần đợi chu kỳ polling)
  const btnCheckNow = document.getElementById('btnModalCheckPaidNow');
  if (btnCheckNow) {
    const defaultHtml = currentSepayConfig?.simulationOnly ? '<span>Mô phỏng thanh toán (local)</span>' : `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Tôi Đã Chuyển Khoản (Kiểm Tra Ngay)</span>
    `;
    btnCheckNow.disabled = false;
    btnCheckNow.innerHTML = defaultHtml;

    btnCheckNow.onclick = async () => {
      btnCheckNow.disabled = true;
      btnCheckNow.innerHTML = `
        <svg class="spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
        </svg>
        <span>Đang kiểm tra với ngân hàng...</span>
      `;
      if (pollingText) pollingText.textContent = currentSepayConfig?.simulationOnly
        ? 'Đang ghi nhận mô phỏng nội bộ. Không có giao dịch ngân hàng thật.'
        : 'Đang đối soát giao dịch qua SePay...';

      try {
        const phone = order.isGuestLookup ? (verifiedGuestPhone || '') : (order.phone || order.customerPhone || '');
        if (currentSepayConfig?.simulationOnly) {
          const simulationResponse = await fetch(`/api/sepay/simulate-payment/${encodeURIComponent(order.id)}`, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, intentId: intent?.id || null })
          });
          const simulation = await simulationResponse.json().catch(() => ({}));
          if (!simulationResponse.ok) throw new Error(simulation.error?.message || 'Không mô phỏng được khoản thanh toán local.');
          if (currentPollingInterval) { clearInterval(currentPollingInterval); currentPollingInterval = null; }
          handlePaymentSuccess(simulation.order || order);
          return;
        }
        const res = await fetch(`/api/sepay/check-payment/${encodeURIComponent(order.id)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, intentId: intent?.id || null })
        });
        const data = await res.json();
        if (data.paid) {
          if (currentPollingInterval) {
            clearInterval(currentPollingInterval);
            currentPollingInterval = null;
          }
          handlePaymentSuccess(data.order || order);
          return;
        }
        if (pollingText) pollingText.innerHTML = '<span style="color: #D97706; font-weight: 600;">⏳ Đang chờ giao dịch từ ngân hàng Sacombank...</span>';
        showToast('Hệ thống đang chờ ngân hàng Sacombank xử lý. Quá trình này thường mất từ 5–30 giây, bạn vui lòng đợi trong giây lát.', 'info');
      } catch (err) {
        showToast('Chưa thể kết nối đối soát lúc này, vui lòng thử lại sau giây lát.', 'warning');
      } finally {
        setTimeout(() => {
          if (btnCheckNow) {
            btnCheckNow.disabled = false;
            btnCheckNow.innerHTML = defaultHtml;
          }
        }, 3000);
      }
    };
  }
}

function closeSepayQrModal() {
  const modal = document.getElementById('sepayQrModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  if (currentPollingInterval) {
    clearInterval(currentPollingInterval);
    currentPollingInterval = null;
  }
}

async function handlePaymentSuccess(order) {
  closeSepayQrModal();
  showToast(order.paymentPlan === 'sepay_deposit'
    ? `Đã xác nhận khoản trả trước; còn thu ${formatPrice(order.amountToCollectAtDelivery || 0)} khi giao.`
    : `Backend đã xác nhận thanh toán mã ${order.paymentIntent?.referenceCode || order.orderCode || order.id}.`, 'success');

  // Cập nhật mảng đơn hàng hiện tại
  const idx = allUserOrders.findIndex(o => String(o.id) === String(order.id));
  if (idx !== -1) {
    allUserOrders[idx] = { ...allUserOrders[idx], ...order };
  }

  renderUserProfileSidebar();
  updateTabCountBadges();
  applyFiltersAndRender();
}

// Bắt đầu chạy khi nạp trang
document.addEventListener('DOMContentLoaded', initOrdersPage);
