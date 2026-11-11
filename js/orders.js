import { exportOrderInvoicePdf } from './excel-pdf.js';
import { fetchOrders, addToCart, uploadUserAvatarStorage, updateOrderStatus } from './storage.js';
import { formatPrice, showToast, renderHeaderAuth, updateCartBadge, compressImageFileToCanvasBase64 } from './utils.js';
import { initUniversalCartDrawer, openCartDrawer } from './cart-drawer.js';
import { initMobileBottomNav } from './bottom-nav.js';

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

// Cấu hình tài khoản Sacombank SePay Napas 247
const SEPAY_CONFIG = {
  bankCode: 'Sacombank',
  bankName: 'Sacombank',
  accountNumber: '70207003455',
  accountHolder: 'NGUYEN DUY BAO'
};

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

  // 3. Hiển thị thông tin Profile ban đầu bên cột trái
  renderUserProfileSidebar();

  // 4. Lấy danh sách toàn bộ đơn hàng từ Backend / LocalStorage
  try {
    const rawOrders = await fetchOrders();

    // 5. Lọc đơn theo quyền: Khách chỉ thấy đơn của chính mình
    if (cachedCurrentUser) {
      allUserOrders = rawOrders.filter(order => {
        if (order.userId || order.user_id) {
          return String(order.userId || order.user_id) === String(cachedCurrentUser.id);
        }
        const matchEmail = cachedCurrentUser.email && order.email === cachedCurrentUser.email;
        const matchPhone = cachedCurrentUser.phone && (order.phone === cachedCurrentUser.phone || order.recipientPhone === cachedCurrentUser.phone);
        return Boolean(matchEmail && matchPhone);
      });

    } else {
      // Khách vãng lai chưa có API tra cứu bằng mã + số điện thoại; không hiển thị dữ liệu mẫu/của người khác.
      allUserOrders = [];
    }

    // Sắp xếp đơn mới nhất lên đầu (Mới đặt -> Đặt lâu hơn)
    allUserOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  } catch (err) {
    console.error('Lỗi nạp đơn hàng:', err);
    allUserOrders = [];
  }

  // 6. Cập nhật lại số liệu Profile và số đếm trên các Tab sau khi đã có dữ liệu thực tế
  renderUserProfileSidebar();
  updateTabCountBadges();

  // 7. Kiểm tra URL param nếu có ?id=DH-7904
  const urlParams = new URLSearchParams(window.location.search);
  const targetOrderId = urlParams.get('id');
  if (targetOrderId) {
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
      searchInput.value = targetOrderId;
      const clearBtn = document.getElementById('orderSearchClear');
      if (clearBtn) clearBtn.style.display = 'block';
    }
  }

  // 8. Lọc và render danh sách đơn
  applyFiltersAndRender();

  // 9. Gán các sự kiện tương tác
  setupOrdersPageEvents();
}

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
        avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar">`;
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
  const countUnpaid = allUserOrders.filter(o => o.paymentMethod === 'sepay' && o.paymentStatus !== 'paid' && o.status !== 'cancelled').length;
  // Đơn đang cắm hoa: Đã xác nhận / đã trả tiền và CHƯA HỦY
  const countCrafting = allUserOrders.filter(o => (o.status === 'confirmed' || (o.paymentStatus === 'paid' && o.status === 'pending')) && o.status !== 'cancelled').length;
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
    filtered = filtered.filter(o => o.paymentMethod === 'sepay' && o.paymentStatus !== 'paid' && o.status !== 'cancelled');
  } else if (activeTab === 'crafting') {
    filtered = filtered.filter(o => (o.status === 'confirmed' || (o.paymentStatus === 'paid' && o.status === 'pending')) && o.status !== 'cancelled');
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
    container.innerHTML = `
      <div class="orders-empty-state-card">
        <div class="empty-state-svg-wrap">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        </div>
        <h3>Không Tìm Thấy Đơn Hàng Phù Hợp</h3>
        <p>Hiện không có đơn hoa nào khớp với bộ lọc hoặc từ khóa bạn vừa nhập. Hãy khám phá ngay các bộ sưu tập hoa mới nhất!</p>
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
    const isPaid = order.paymentStatus === 'paid';
    const isSepay = order.paymentMethod === 'sepay';
    const status = order.status || 'pending';
    const isCancelled = status === 'cancelled';
    const canCancelOrder = Boolean(cachedCurrentUser && String(order.userId || order.user_id) === String(cachedCurrentUser.id) && status === 'pending' && !isPaid);

    // 1. Nhãn phương thức thanh toán & trạng thái (Xử lý dứt khoát trạng thái Đã Hủy)
    let paymentBadge = '';
    if (isCancelled) {
      paymentBadge = `<span class="payment-status-pill cancelled">Đã Hủy Đơn</span>`;
    } else if (isSepay) {
      paymentBadge = isPaid
        ? `<span class="payment-status-pill paid"><span class="pulse-indicator"></span>SePay (Đã Thanh Toán)</span>`
        : `<span class="payment-status-pill unpaid"><span class="pulse-indicator"></span>SePay (Chờ Quét QR)</span>`;
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
      let fillWidth = '33%';

      if (isSepay && !isPaid) {
        step2Class = 'active';
        step2Sub = 'Chờ quét QR';
        fillWidth = '15%';
      } else if (status === 'confirmed' || (isPaid && status === 'pending')) {
        step3Class = 'active green-active';
        step3Sub = 'Đang bó hoa';
        fillWidth = '66%';
      } else if (status === 'shipping') {
        step3Class = 'done';
        step3Sub = 'Đã cắm xong';
        step4Class = 'active green-active';
        step4Sub = 'Đang giao hoa';
        fillWidth = '88%';
      } else if (status === 'completed') {
        step3Class = 'done';
        step3Sub = 'Đã cắm xong';
        step4Class = 'done';
        step4Sub = 'Đã nhận hoa';
        fillWidth = '100%';
      }

      timelineOrBannerHtml = `
        <div class="floral-journey-timeline">
          <div class="floral-stepper-track">
            <div class="stepper-bg-line"></div>
            <div class="stepper-fill-line" style="width: ${fillWidth};"></div>

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

    const itemsHtml = items.map(item => `
      <div class="order-product-row">
        <div class="order-product-info">
          <img src="${item.image || item.imageUrl || './images/300.png'}" alt="${item.name || item.title || item.productName}" class="order-flower-thumb" onerror="this.src='./images/300.png'">
          <div>
          <h4 class="order-flower-title">${item.name || item.title || item.productName}</h4>
            <p class="order-flower-meta">Phân loại: ${item.categoryName || 'Hoa Handmade'} &bull; Số lượng: &times;${item.quantity || 1}</p>
          </div>
        </div>
        <div class="order-product-price">
          ${formatPrice((item.price || 0) * (item.quantity || 1))}
        </div>
      </div>
    `).join('');

    // 4. Thông tin người nhận và bưu thiếp viết tay
    const recipientName = order.recipientName || order.customerName || order.customer_name || 'Người nhận hoa';
    const recipientPhone = order.recipientPhone || order.phone || order.customerPhone || '';
    const deliveryAddress = order.address || order.shippingAddress || order.shipping_address || '';
    const deliverySlot = order.deliverySlot || 'Giao trong ngày';
    const cardMsg = order.cardMessage && order.cardMessage.trim()
      ? `"${order.cardMessage}"`
      : '"Kèm thiệp chúc mừng viết tay theo yêu cầu"';

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

    // 6. Cụm nút hành động phân cấp chuẩn nghiệp vụ TMĐT thực tế
    let actionButtonsHtml = '';

    if (isCancelled) {
      // Đơn đã hủy: Không có hóa đơn/biên nhận
      actionButtonsHtml = `
        <span style="font-size: 12.5px; color: #94A3B8; font-style: italic;">Đơn hàng đã được hủy</span>
        <a href="./index.html#products" class="btn-action-secondary">Khám Phá Mẫu Hoa Khác</a>
      `;
    } else if (isSepay && !isPaid) {
      // Đơn SePay chưa thanh toán: Bắt buộc chỉ hiện Quét QR + Hủy đơn, KHÔNG có hóa đơn/biên nhận!
      actionButtonsHtml = `
      ${canCancelOrder ? `<button type="button" class="btn-action-secondary btn-order-cancel" data-order-id="${order.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>Hủy Đơn</span>
        </button>` : ''}
        <button type="button" class="btn-action-primary btn-order-pay-now" data-order-id="${order.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Quét QR Thanh Toán Ngay</span>
        </button>
      `;
    } else if (status === 'pending' && !isPaid) {
      // Đơn COD đang xử lý/giao (chưa thu tiền): Khách chưa trả tiền nên chưa có biên nhận thu tiền!
      actionButtonsHtml = `
        <a href="tel:0908889999" class="btn-action-secondary" title="Liên hệ nghệ nhân đổi thiệp hoặc giờ giao">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>Đổi Thiệp / Giờ Giao</span>
        </a>
        ${canCancelOrder ? `<button type="button" class="btn-action-secondary btn-order-cancel" data-order-id="${order.id}">
          <span>Hủy Đơn</span>
        </button>` : ''}
      `;
    } else {
      // Đơn ĐÃ THANH TOÁN SEPAY hoặc ĐƠN ĐÃ HOÀN TẤT: Đã thu tiền thành công -> Hiển thị "Xem Hóa Đơn Điện Tử" + "Đặt Lại Đơn Này"
      actionButtonsHtml = `
        <button type="button" class="btn-action-secondary btn-order-view-pdf" data-order-id="${order.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Xem Hóa Đơn Điện Tử</span>
        </button>
        <button type="button" class="btn-action-secondary btn-order-reorder" data-order-id="${order.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Đặt Lại Đơn Này</span>
        </button>
      `;
    }

    return `
      <article class="order-craft-card" data-order-id="${order.id}">
        
        <!-- Header Thẻ Đơn Hàng -->
        <div class="order-card-header">
          <div>
            <div class="order-code-group">
              <span class="order-code-title">#${order.orderCode || order.id}</span>
              <button type="button" class="btn-copy-code" data-copy="${order.orderCode || order.id}">Sao chép</button>
            </div>
            <span class="order-date-time">Đặt lúc ${orderDate}</span>
          </div>
          <div>
            ${paymentBadge}
          </div>
        </div>

        <!-- Lộ Trình 4 Bước Nghệ Nhân Hoặc Banner Đã Hủy -->
        ${timelineOrBannerHtml}

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
          </div>
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
        const response = await fetch('http://localhost:4000/api/orders/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderCode, phone })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Không thể tra cứu đơn hàng');
        if (cachedCurrentUser && data.userId && String(data.userId) !== String(cachedCurrentUser.id)) {
          throw new Error('Đơn hàng này không thuộc tài khoản đang đăng nhập.');
        }
        if (!cachedCurrentUser) allUserOrders = [data];
        else if (!allUserOrders.some(order => String(order.id) === String(data.id))) allUserOrders.unshift(data);
        if (messageEl) messageEl.textContent = `Đã tìm thấy đơn ${data.orderCode || data.id}.`;
        activeTab = 'all';
        document.querySelectorAll('.orders-tab-pill').forEach(tab => tab.classList.toggle('active', tab.dataset.filter === 'all'));
        updateTabCountBadges();
        applyFiltersAndRender();
      } catch (error) {
        if (messageEl) messageEl.textContent = error.message;
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

  // 3.1. Sự kiện Upload Ảnh Đại Diện Cá Nhân (Canvas 200x200 nén < 30KB)
  const avatarTrigger = document.getElementById('btnUploadAvatarTrigger');
  const avatarInput = document.getElementById('userAvatarFileInput');
  if (avatarTrigger && avatarInput) {
    avatarTrigger.addEventListener('click', () => {
      avatarInput.click();
    });

    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

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
    });
  }

  // 4. Bắt sự kiện trên các nút hành động (Event Delegation)
  const listContainer = document.getElementById('ordersListContainer');
  if (listContainer) {
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
            addToCart({
              id: item.id,
              name: item.name || item.title,
              price: item.price,
              image: item.image,
              categoryName: item.categoryName
            }, item.quantity || 1);
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
    const updated = await updateOrderStatus(orderId, 'cancelled');
    const idx = allUserOrders.findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) allUserOrders[idx] = { ...allUserOrders[idx], ...updated };
    showToast(`Đã hủy thành công đơn hàng #${orderId}`, 'success');
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
function openSepayQrModal(order) {
  const modal = document.getElementById('sepayQrModal');
  const qrImg = document.getElementById('modalSepayQrImg');
  const amountEl = document.getElementById('modalSepayAmount');
  const contentEl = document.getElementById('modalSepayContent');
  const simulateBtn = document.getElementById('btnModalSimulatePaid');
  const pollingText = document.getElementById('modalSepayPollingText');

  if (!modal) return;

  const totalAmount = order.totalAmount || 0;
  const paymentContent = order.orderCode || order.order_code || order.id;

  // Tạo URL VietQR SePay Napas 247 chính chủ Sacombank
  const qrUrl = `https://qr.sepay.vn/img?acc=${SEPAY_CONFIG.accountNumber}&bank=${SEPAY_CONFIG.bankCode}&amount=${totalAmount}&des=${paymentContent}&template=compact`;

  if (qrImg) qrImg.src = qrUrl;
  if (amountEl) amountEl.textContent = formatPrice(totalAmount);
  if (contentEl) contentEl.textContent = paymentContent;
  if (pollingText) pollingText.textContent = 'Hệ thống đang tự động kiểm tra giao dịch mỗi 3 giây...';

  // Hiển thị modal
  modal.style.display = 'flex';
  modal.classList.remove('hidden');

  // Xóa interval polling cũ nếu có
  if (currentPollingInterval) clearInterval(currentPollingInterval);

  // Bắt đầu Polling kiểm tra trạng thái thanh toán từ backend mỗi 3 giây
  currentPollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/sepay/check-payment/${order.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.paid) {
          handlePaymentSuccess(order);
        }
      }
    } catch (err) {
      // Bỏ qua lỗi ngắt kết nối tạm thời
    }
  }, 3000);

  // Nút giả lập thanh toán cho giảng viên
  if (simulateBtn) {
    simulateBtn.onclick = () => {
      handlePaymentSuccess(order);
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
  showToast(`Backend đã xác nhận thanh toán đơn #${order.orderCode || order.id}!`, 'success');

  // Cập nhật mảng đơn hàng hiện tại
  const idx = allUserOrders.findIndex(o => String(o.id) === String(order.id));
  if (idx !== -1) {
    allUserOrders[idx].paymentStatus = 'paid';
    allUserOrders[idx].status = 'confirmed';
  }

  renderUserProfileSidebar();
  updateTabCountBadges();
  applyFiltersAndRender();
}

// Bắt đầu chạy khi nạp trang
document.addEventListener('DOMContentLoaded', initOrdersPage);
