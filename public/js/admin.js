import {
  fetchCategories,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  activateBannerTheme,
  fetchAllPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  fetchOrders,
  updateOrderStatus,
  fetchProductReviews,
  toggleHideProductReview,
  deleteProductReview,
  replyProductReview,
  deleteReviewThreadComment
} from './storage.js';
import api, { authApi, refundApi } from './api.js';
import { formatPrice, showToast, escapeHTML, unescapeHTML } from './utils.js';
import {
  matchesCategoryId,
  formatVoucherDisplay,
  isUnpaidSepayOrder,
  isOrderPaid,
  isRevenueRecognizedOrder,
  isGmvOrder,
  orderNeedsRefund,
  toLocalDateKey,
  filterOrdersByDateRange,
  calculateRevenueStats,
  getDayMonthYearSummary,
  getTodayVsYesterdaySummary,
  aggregateProductDeliveryAndRevenue,
  calculateCategoryRevenueBreakdown
} from './business-rules.js';
import {
  initExcelPdf,
  exportOrderInvoicePdf,
  exportGiftDeliverySlipPdf,
  exportRevenueStatisticsPdf,
  exportRevenueStatisticsExcel
} from './excel-pdf.js';

function safeAdminMediaUrl(value, fallback = './images/300.webp') {
  const candidate = String(value || '').trim();
  if (/^(?:\/|\.\/)(?!\/)/.test(candidate)) return escapeHTML(candidate);
  try {
    const parsed = new URL(candidate, window.location.origin);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return escapeHTML(candidate);
  } catch { }
  return fallback;
}

/**
 * admin.js - Module điều khiển toàn bộ Bảng Quản Trị Hệ Thống (admin.html)
 * Đáp ứng tiêu chuẩn đồ án ES6+ (reduce, map, filter, Drag & Drop API, Dual-tier)
 */

// ==========================================================================
// 1. STATE QUẢN LÝ DỮ LIỆU
// ==========================================================================
let allProducts = [];
let allCategories = [];
let allBanners = [];
let allPromotions = [];
let allOrders = [];
let allUsers = []; // Danh sách tài khoản người dùng và vai trò
let allRefunds = []; // Danh sách phiếu hoàn tiền 2 cấp (Thu ngân -> Admin)
let currentUser = null; // Tài khoản đang đăng nhập hiện tại
let currentTab = 'dashboard';
let deleteTarget = { type: null, id: null };
let currentDetailOrderId = null;
let openOrderDetailHandler = null;

// State quản lý phân trang theo công thức của cô
let productsPagination = {
  currentPage: 1,
  limit: 10
};

let ordersPagination = {
  currentPage: 1,
  limit: 10
};

function getDefaultDateRange(daysBack = 29) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
  return {
    fromDate: toLocalDateKey(from),
    toDate: toLocalDateKey(now)
  };
}

const defaultStatsRange = getDefaultDateRange(29);

// State lọc báo cáo thống kê doanh số, doanh thu & mặt hàng
let statsFilter = {
  periodType: 'day', // 'day' | 'month' | 'quarter' | 'year'
  year: new Date().getFullYear(),
  monthIndex: 'all', // 'all' | '1'..'12'
  fromDate: defaultStatsRange.fromDate,
  toDate: defaultStatsRange.toDate,
  preset: '30days',
  series: { gmv: true, revenue: true, profit: true }
};

let dashboardChartMode = '14days'; // '14days' | '12months'

// State lọc bảng Mặt hàng trong Tab Thống Kê
let statsProductFilter = {
  search: '',
  categoryId: 'all',
  status: 'all',
  sort: 'revenue-desc'
};

// State Smart Seller Center (Bộ lọc Phân đoạn Segmented Tabs)
let selectedProductSegment = 'all'; // 'all', catId, hoặc 'low-stock'
let selectedOrderSegment = 'all'; // 'all', 'pending', 'unpaid_sepay', 'confirmed', 'shipping', 'completed', 'cancelled', 'needs_refund', 'refunded'
let selectedRefundSegment = 'all'; // 'all', 'pending_approval', 'approved', 'rejected'

// ==========================================================================
// 2. CỬA NGÕ XÁC THỰC QUẢN TRỊ & PHÂN QUYỀN 3 ROLE (AUTH GATE & ROLE ACCESS)
// ==========================================================================
async function initAuthGate() {
  const authModal = document.querySelector('#authGateModal');
  const adminApp = document.querySelector('#adminApp');
  const logoutBtn = document.querySelector('#adminLogoutBtn');
  const userRoleBadge = document.querySelector('#adminUserRoleBadge');
  const userNameDisplay = document.querySelector('#adminUserNameDisplay');
  const userAvatarDisplay = document.querySelector('#adminAvatarDisplay');

  const applyRolePermissions = (user) => {
    const role = user.role;
    if (userNameDisplay) userNameDisplay.textContent = user.name || user.email || 'Quản Trị Viên';
    if (userAvatarDisplay) {
      userAvatarDisplay.replaceChildren();
      if (user.avatar) {
        const avatar = document.createElement('img');
        avatar.src = user.avatar;
        avatar.alt = 'Avatar';
        avatar.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
        userAvatarDisplay.append(avatar);
      } else {
        userAvatarDisplay.textContent = (user.name || user.email || 'A').charAt(0).toUpperCase();
      }
    }
    if (userRoleBadge) {
      userRoleBadge.textContent = role === 'staff' ? 'Thu Ngân / Kế Toán' : 'Quản Trị Viên';
      userRoleBadge.style.color = role === 'staff' ? '#0284C7' : '#108474';
    }

    const nav = {
      dashboard: document.querySelector('.nav-item[data-tab="dashboard"]'),
      products: document.querySelector('.nav-item[data-tab="products"]'),
      banners: document.querySelector('.nav-item[data-tab="banners"]'),
      vouchers: document.querySelector('.nav-item[data-tab="vouchers"]'),
      orders: document.querySelector('.nav-item[data-tab="orders"]'),
      refunds: document.querySelector('#navItemRefunds'),
      statistics: document.querySelector('#navItemStatistics'),
      users: document.querySelector('#navItemUsers'),
      reviews: document.querySelector('#navItemReviews')
    };
    const todoStrip = document.querySelector('#alertTodoStrip');
    if (role === 'staff') {
      for (const [key, item] of Object.entries(nav)) {
        if (item) item.style.display = (key === 'orders' || key === 'refunds') ? 'flex' : 'none';
      }
      if (todoStrip) todoStrip.style.display = 'none';
      setTimeout(() => nav.orders?.click(), 50);
    } else {
      Object.values(nav).forEach(item => { if (item) item.style.display = 'flex'; });
      if (todoStrip) todoStrip.style.display = 'flex';
    }
  };

  const redirectToLogin = () => {
    localStorage.removeItem('user');
    if (authModal) authModal.classList.remove('hidden');
    if (adminApp) adminApp.style.display = 'none';
    window.location.replace(`./login.html?returnUrl=${encodeURIComponent('/admin.html')}`);
  };

  try {
    // Không tin role/user trong localStorage; xác minh lại phiên và quyền từ backend.
    const response = await authApi.getMe();
    currentUser = response.data?.user || null;
    if (!currentUser || !['admin', 'staff'].includes(currentUser.role)) {
      if (currentUser) window.location.replace('./index.html');
      else redirectToLogin();
      return;
    }
    localStorage.setItem('user', JSON.stringify(currentUser));
    applyRolePermissions(currentUser);
    if (authModal) authModal.classList.add('hidden');
    if (adminApp) adminApp.style.display = 'flex';
    await loadAllData();
  } catch {
    redirectToLogin();
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await authApi.logout(); } catch (error) { console.warn('Không thể đóng phiên từ máy chủ:', error); }
      localStorage.removeItem('user');
      window.location.replace('./login.html');
    });
  }
}

// Đồng hồ thời gian thực
function initClock() {
  const clockEl = document.querySelector('#liveClock');
  if (!clockEl) return;
  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('vi-VN');
  }
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// 3. ĐIỀU HƯỚNG CÁC TAB SIDEBAR (TAB SWITCHER)
// ==========================================================================
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  const breadcrumb = document.querySelector('#currentBreadcrumb');

  const tabTitles = {
    dashboard: 'Tổng Quan & KPI',
    products: 'Quản Lý Mẫu Hoa',
    banners: 'Banner & Chủ Đề',
    vouchers: 'Mã Giảm Giá Voucher',
    orders: 'Quản Lý Đơn Hàng',
    refunds: 'Quản Lý & Duyệt Hoàn Tiền (Thu Ngân → Admin)',
    statistics: 'Báo Cáo Doanh Số, Doanh Thu & Mặt Hàng',
    users: 'Quản Lý Tài Khoản & Phân Quyền',
    reviews: 'Quản Lý Đánh Giá & Phản Hồi'
  };

  // Thiết lập đóng/mở Mobile Off-canvas Drawer
  const toggleBtn = document.querySelector('#mobileSidebarToggle');
  const sidebar = document.querySelector('#adminSidebar');
  const backdrop = document.querySelector('#sidebarBackdrop');
  const closeBtn = document.querySelector('#sidebarCloseBtn');

  const closeMobileSidebar = () => {
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');
  };

  if (toggleBtn && sidebar && backdrop) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.add('sidebar-open');
      backdrop.classList.add('active');
    });

    backdrop.addEventListener('click', closeMobileSidebar);

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileSidebar);
    }
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      currentTab = tab;

      navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      panels.forEach(p => p.classList.remove('active'));
      const activePanel = document.querySelector(`#panel-${tab}`);
      if (activePanel) activePanel.classList.add('active');

      if (breadcrumb) breadcrumb.textContent = tabTitles[tab] || 'Quản Trị';

      // Tự động đóng mobile drawer khi chọn tab
      closeMobileSidebar();

      // Nạp lại dữ liệu tương ứng của từng tab
      if (tab === 'dashboard') renderDashboard();
      else if (tab === 'products') renderProductsTable();
      else if (tab === 'banners') renderBannersTable();
      else if (tab === 'vouchers') renderVouchersTable();
      else if (tab === 'orders') renderOrdersTable();
      else if (tab === 'refunds') renderRefundsTab();
      else if (tab === 'statistics') renderStatistics();
      else if (tab === 'users') renderUsersTable();
      else if (tab === 'reviews') renderReviewsTable();
    });
  });

  // Tự động chuyển tab nếu có query param ?tab=
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  if (initialTab) {
    const targetNavBtn = document.querySelector(`.nav-item[data-tab="${initialTab}"]`);
    if (targetNavBtn) targetNavBtn.click();
  }
}

// ==========================================================================
// 4. KỸ THUẬT KÉO THẢ ẢNH HIỆN ĐẠI (HTML5 DRAG & DROP + FILEREADER)
// ==========================================================================
function setupDropzone({ dropzoneId, contentId, previewWrapId, previewImgId, removeBtnId, fileInputId, hiddenUrlId, urlInputId }) {
  const dropzone = document.querySelector(`#${dropzoneId}`);
  const content = document.querySelector(`#${contentId}`);
  const previewWrap = document.querySelector(`#${previewWrapId}`);
  const previewImg = document.querySelector(`#${previewImgId}`);
  const removeBtn = document.querySelector(`#${removeBtnId}`);
  const fileInput = document.querySelector(`#${fileInputId}`);
  const hiddenUrl = document.querySelector(`#${hiddenUrlId}`);
  const urlInput = document.querySelector(`#${urlInputId}`);

  if (!dropzone || !fileInput) return;

  function setPreview(src) {
    if (!src) {
      if (previewWrap) previewWrap.classList.add('hidden');
      if (content) content.classList.remove('hidden');
      if (hiddenUrl) hiddenUrl.value = '';
      return;
    }
    if (previewImg) previewImg.src = src;
    if (previewWrap) previewWrap.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (hiddenUrl) hiddenUrl.value = src;
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Vui lòng chọn đúng tệp hình ảnh (JPG, PNG, WEBP)!', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      if (urlInput) urlInput.value = '';
    };
    reader.readAsDataURL(file);
  }

  // Sự kiện kéo thả HTML5 Drag & Drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Click vào dropzone để chọn file
  dropzone.addEventListener('click', (e) => {
    if (e.target === removeBtn || (removeBtn && removeBtn.contains(e.target))) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setPreview('');
      fileInput.value = '';
      if (urlInput) urlInput.value = '';
    });
  }

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      const text = urlInput.value.trim();
      if (text) {
        setPreview(text);
      }
    });
  }

  return { setPreview };
}

// Khởi tạo dropzone cho form Sản Phẩm & form Banner
let productDropzoneHelper = null;
let bannerDropzoneHelper = null;

function initDropzones() {
  productDropzoneHelper = setupDropzone({
    dropzoneId: 'prodDropzone',
    contentId: 'prodDropzoneContent',
    previewWrapId: 'prodPreviewWrap',
    previewImgId: 'prodPreviewImg',
    removeBtnId: 'prodRemoveImgBtn',
    fileInputId: 'prodFileInput',
    hiddenUrlId: 'prodImageUrl',
    urlInputId: 'prodImageUrlInput'
  });

  bannerDropzoneHelper = setupDropzone({
    dropzoneId: 'bannerDropzone',
    contentId: 'bannerDropzoneContent',
    previewWrapId: 'bannerPreviewWrap',
    previewImgId: 'bannerPreviewImg',
    removeBtnId: 'bannerRemoveImgBtn',
    fileInputId: 'bannerFileInput',
    hiddenUrlId: 'bannerImageUrl',
    urlInputId: 'bannerImageUrlInput'
  });
}

// ==========================================================================
// 5. TAB 1: RENDER TỔNG QUAN & THỐNG KÊ KPI (ES6 REDUCE + TODAY PULSE + TOP 5)
// ==========================================================================
function renderPeriodBarChartHtml(statsData, { heightPx = 155, showGmv = true, showRevenue = true, showProfit = true, compact = false } = {}) {
  if (!Array.isArray(statsData) || statsData.length === 0) {
    return `<div style="width: 100%; text-align: center; color: var(--text-muted); font-size: 13px; align-self: center;">Chưa có dữ liệu biểu đồ trong kỳ này</div>`;
  }

  const maxCandidates = [];
  statsData.forEach(r => {
    if (showGmv) maxCandidates.push(Number(r.gmv || 0));
    if (showRevenue) maxCandidates.push(Number(r.revenue || 0));
    if (showProfit) maxCandidates.push(Number(r.profit || 0));
  });
  const rawMax = Math.max(...maxCandidates, 0);
  const maxVal = rawMax > 0 ? rawMax : 100000;
  const barWidth = compact ? 7 : (statsData.length > 16 ? 7 : 11);
  const minColWidth = compact ? (statsData.length > 12 ? 26 : 30) : (statsData.length > 16 ? 34 : 46);

  return statsData.map((r) => {
    const gmvH = Math.max(Math.round((Number(r.gmv || 0) / maxVal) * heightPx), 3);
    const revH = Math.max(Math.round((Number(r.revenue || 0) / maxVal) * heightPx), 3);
    const profH = Math.max(Math.round((Number(r.profit || 0) / maxVal) * heightPx), 3);
    const shortLabel = r.shortLabel || (r.label.includes('Tháng') ? `T${r.label.match(/\d+/)?.[0] || ''}` : r.label.split(' ')[0]);
    const tooltip = `${r.label}\n• Doanh số (GMV): ${formatPrice(r.gmv || 0)} (${r.gmvOrderCount ?? r.orderCount ?? 0} đơn)\n• Doanh thu thực: ${formatPrice(r.revenue || 0)} (${r.orderCount || 0} đơn)\n• Lợi nhuận: ${formatPrice(r.profit || 0)}`;

    return `
      <div title="${escapeHTML(tooltip)}" style="flex: 1; min-width: ${minColWidth}px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; cursor: pointer;">
        <div style="display: flex; gap: 3px; align-items: flex-end; width: 100%; justify-content: center;">
          ${showGmv ? `<div style="width: ${barWidth}px; height: ${gmvH}px; background: #0284C7; border-radius: 3px 3px 0 0; transition: height 0.3s ease;"></div>` : ''}
          ${showRevenue ? `<div style="width: ${barWidth}px; height: ${revH}px; background: #108474; border-radius: 3px 3px 0 0; transition: height 0.3s ease;"></div>` : ''}
          ${showProfit ? `<div style="width: ${barWidth}px; height: ${profH}px; background: #D97706; border-radius: 3px 3px 0 0; transition: height 0.3s ease;"></div>` : ''}
        </div>
        <span style="font-size: 10.5px; font-weight: 600; color: var(--text-muted); margin-top: 6px; white-space: nowrap;">${escapeHTML(shortLabel)}</span>
      </div>
    `;
  }).join('');
}

function updateNavRefundBadge() {
  const badge = document.querySelector('#navRefundBadge');
  if (!badge) return;
  const pendingApproval = allRefunds.filter(r => r.status === 'pending_approval').length;
  const unrequested = allOrders.filter(orderNeedsRefund).filter(o => {
    const hasOpen = Array.isArray(o.refundRequests) && o.refundRequests.some(r => r.status === 'pending_approval');
    return !hasOpen;
  }).length;
  const totalAlert = pendingApproval + unrequested;
  badge.textContent = totalAlert;
  badge.style.display = totalAlert > 0 ? 'inline-flex' : 'none';
}

function renderDashboard() {
  const totalProductsEl = document.querySelector('#kpiTotalProducts');
  const totalOrdersEl = document.querySelector('#kpiTotalOrders');
  const totalRevenueEl = document.querySelector('#kpiTotalRevenue');
  const recentOrdersTbody = document.querySelector('#dashboardRecentOrders');
  const categoryBreakdown = document.querySelector('#dashboardCategoryBreakdown');

  updateNavRefundBadge();

  if (totalProductsEl) totalProductsEl.textContent = allProducts.length;
  if (totalOrdersEl) totalOrdersEl.textContent = allOrders.length;

  // 1. Chỉ số tài chính chuẩn IFRS 15 (loại trừ đơn đã hoàn tiền)
  const completedOrders = allOrders.filter(isRevenueRecognizedOrder);
  const recognizedRevenue = completedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const paidOrders = allOrders.filter(order => {
    if (order.status === 'cancelled') return false;
    const st = String(order.paymentStatus || '').toLowerCase();
    return st === 'paid' || st === 'partially_refunded';
  });
  const cashCollected = paidOrders.reduce((sum, order) => {
    const total = Number(order.totalAmount || 0);
    const refunds = Array.isArray(order.refundRequests) ? order.refundRequests : [];
    const approvedRefund = refunds.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0);
    return sum + Math.max(0, total - approvedRefund);
  }, 0);

  const validOrders = allOrders.filter(isGmvOrder);
  const gmv = validOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  if (totalRevenueEl) {
    totalRevenueEl.textContent = formatPrice(recognizedRevenue);
    const subEl = totalRevenueEl.nextElementSibling;
    if (subEl && subEl.classList.contains('kpi-sub')) {
      subEl.innerHTML = `Đã thu: <strong>${formatPrice(cashCollected)}</strong> | GMV: ${formatPrice(gmv)}`;
    }
  }

  const aov = validOrders.length > 0 ? Math.round(gmv / validOrders.length) : 0;
  const kpiAovEl = document.querySelector('#kpiAovValue');
  if (kpiAovEl) kpiAovEl.textContent = formatPrice(aov);

  // 2. Nhịp đập hôm nay & Dải trạng thái 1-chạm
  const pulse = getTodayVsYesterdaySummary(allOrders);
  const pulseOrdersEl = document.querySelector('#pulseTodayOrders');
  const pulseOrdersSubEl = document.querySelector('#pulseTodayOrdersSub');
  const pulseRevEl = document.querySelector('#pulseTodayRevenue');
  const pulseRevGrowthEl = document.querySelector('#pulseTodayRevenueGrowth');
  const pulseGmvEl = document.querySelector('#pulseTodayGmv');
  const pulseGmvSubEl = document.querySelector('#pulseTodayGmvSub');
  const pulseSepayEl = document.querySelector('#pulseSepayRefundVal');
  const pulseSepaySubEl = document.querySelector('#pulseSepayRefundSub');

  if (pulseOrdersEl) pulseOrdersEl.textContent = `${pulse.today.gmvOrderCount} đơn`;
  if (pulseOrdersSubEl) pulseOrdersSubEl.textContent = `${pulse.today.orderCount} đơn hoàn tất hôm nay`;
  if (pulseRevEl) pulseRevEl.textContent = formatPrice(pulse.today.revenue);
  if (pulseRevGrowthEl) {
    if (pulse.revenueGrowthPercent === null) {
      pulseRevGrowthEl.textContent = `Hôm qua: ${formatPrice(pulse.yesterday.revenue)}`;
    } else {
      const sign = pulse.revenueGrowthPercent >= 0 ? '+' : '';
      pulseRevGrowthEl.innerHTML = `So với hôm qua: <strong style="color: ${pulse.revenueGrowthPercent >= 0 ? '#108474' : '#DC2626'};">${sign}${pulse.revenueGrowthPercent}%</strong>`;
    }
  }
  if (pulseGmvEl) pulseGmvEl.textContent = formatPrice(pulse.today.gmv);
  if (pulseGmvSubEl) pulseGmvSubEl.textContent = `Doanh số hôm qua: ${formatPrice(pulse.yesterday.gmv)}`;

  const pendingRefundTickets = allRefunds.filter(r => r.status === 'pending_approval').length;
  const refundOrderNeedCount = allOrders.filter(orderNeedsRefund).length;
  if (pulseSepayEl) pulseSepayEl.textContent = `${pulse.statusCounts.unpaidSepayCount + Math.max(pendingRefundTickets, refundOrderNeedCount)} đơn`;
  if (pulseSepaySubEl) pulseSepaySubEl.textContent = `${pulse.statusCounts.unpaidSepayCount} chờ VietQR • ${Math.max(pendingRefundTickets, refundOrderNeedCount)} cần hoàn tiền`;

  const statusStrip = document.querySelector('#dashboardStatusStrip');
  if (statusStrip) {
    const chips = [
      { seg: 'pending', label: 'Chờ duyệt ngay', count: pulse.statusCounts.pendingReadyCount },
      { seg: 'unpaid_sepay', label: 'Chờ TT SePay', count: pulse.statusCounts.unpaidSepayCount },
      { seg: 'confirmed', label: 'Đã xác nhận', count: pulse.statusCounts.confirmedCount },
      { seg: 'shipping', label: 'Đang giao', count: pulse.statusCounts.shippingCount },
      { seg: 'completed', label: 'Đã giao hoàn tất', count: pulse.statusCounts.completedCount },
      { seg: 'needs_refund', label: 'Cần hoàn tiền', count: refundOrderNeedCount }
    ];
    statusStrip.innerHTML = chips.map(c => `
      <button type="button" class="status-quick-chip" data-order-segment="${c.seg}">
        <span>${c.label}</span>
        <span class="chip-count">${c.count}</span>
      </button>
    `).join('');

    if (!statusStrip.dataset.bound) {
      statusStrip.dataset.bound = 'true';
      statusStrip.addEventListener('click', (e) => {
        const chip = e.target.closest('.status-quick-chip');
        if (!chip) return;
        selectedOrderSegment = chip.dataset.orderSegment || 'all';
        ordersPagination.currentPage = 1;
        const ordersNav = document.querySelector('.nav-item[data-tab="orders"]');
        if (ordersNav) ordersNav.click();
      });
    }
  }

  // 3. Thanh cảnh báo Seller To-Do Strip (ẩn từng pill khi count === 0)
  const pendingOrders = allOrders.filter(o => o.status === 'pending' && !isUnpaidSepayOrder(o));
  const lowStockProducts = allProducts.filter(p => Number(p.stock || 0) <= 10);
  const refundAlertCount = Math.max(pendingRefundTickets, refundOrderNeedCount);

  const todoPendingPill = document.querySelector('#todoPendingOrders');
  const todoLowStockPill = document.querySelector('#todoLowStock');
  const todoRefundPill = document.querySelector('#todoRefundPending');
  const todoPendingCount = document.querySelector('#todoPendingCount');
  const todoLowStockCount = document.querySelector('#todoLowStockCount');
  const todoRefundCount = document.querySelector('#todoRefundCount');

  if (todoPendingCount) todoPendingCount.textContent = pendingOrders.length;
  if (todoLowStockCount) todoLowStockCount.textContent = lowStockProducts.length;
  if (todoRefundCount) todoRefundCount.textContent = refundAlertCount;

  if (todoPendingPill) todoPendingPill.style.display = pendingOrders.length > 0 ? 'flex' : 'none';
  if (todoLowStockPill) todoLowStockPill.style.display = lowStockProducts.length > 0 ? 'flex' : 'none';
  if (todoRefundPill) todoRefundPill.style.display = refundAlertCount > 0 ? 'flex' : 'none';

  const alertTodoStrip = document.querySelector('#alertTodoStrip');
  if (alertTodoStrip) {
    alertTodoStrip.style.display = (pendingOrders.length > 0 || lowStockProducts.length > 0 || refundAlertCount > 0)
      ? 'flex'
      : 'none';
  }

  const todoQuickApproveBtn = document.querySelector('#todoQuickApproveBtn');
  if (todoQuickApproveBtn && !todoQuickApproveBtn.dataset.bound) {
    todoQuickApproveBtn.dataset.bound = 'true';
    todoQuickApproveBtn.addEventListener('click', () => {
      selectedOrderSegment = 'pending';
      document.querySelector('.nav-item[data-tab="orders"]')?.click();
    });
  }

  const todoQuickRestockBtn = document.querySelector('#todoQuickRestockBtn');
  if (todoQuickRestockBtn && !todoQuickRestockBtn.dataset.bound) {
    todoQuickRestockBtn.dataset.bound = 'true';
    todoQuickRestockBtn.addEventListener('click', () => {
      selectedProductSegment = 'low-stock';
      document.querySelector('.nav-item[data-tab="products"]')?.click();
    });
  }

  const todoQuickRefundBtn = document.querySelector('#todoQuickRefundBtn');
  if (todoQuickRefundBtn && !todoQuickRefundBtn.dataset.bound) {
    todoQuickRefundBtn.dataset.bound = 'true';
    todoQuickRefundBtn.addEventListener('click', () => {
      document.querySelector('#navItemRefunds')?.click();
    });
  }

  // 4. Top 5 Mẫu Hoa Bán Chạy Nhất tính trực tiếp từ đơn hàng thực tế (fix 0 lượt bán)
  const topListEl = document.querySelector('#dashboardTopProductsList');
  if (topListEl) {
    const productStats = aggregateProductDeliveryAndRevenue(allOrders, allProducts, allCategories);
    const top5 = productStats.slice(0, 5);
    if (top5.length === 0) {
      topListEl.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); margin: 0;">Chưa có dữ liệu sản phẩm</p>`;
    } else {
      topListEl.innerHTML = top5.map((p, idx) => `
        <div class="top-seller-row">
          <span class="top-seller-rank ${idx === 0 ? 'rank-1' : ''}">${idx + 1}</span>
          <img src="${safeAdminMediaUrl(p.image)}" alt="${escapeHTML(p.name)}" class="top-seller-thumb" onerror="this.src='./images/300.webp'">
          <div class="top-seller-info">
            <div class="top-seller-name">${escapeHTML(p.name)}</div>
            <div class="top-seller-meta">Đã giao: <strong>${p.deliveredQty}</strong> • Đang/Chưa giao: ${p.shippingQty + p.undeliveredQty}</div>
          </div>
          <div class="top-seller-rev">${formatPrice(p.deliveredRevenue)}</div>
        </div>
      `).join('');
    }
  }

  const viewMatrixQuickBtn = document.querySelector('#viewProductMatrixQuickBtn');
  if (viewMatrixQuickBtn && !viewMatrixQuickBtn.dataset.bound) {
    viewMatrixQuickBtn.dataset.bound = 'true';
    viewMatrixQuickBtn.addEventListener('click', () => {
      document.querySelector('#navItemStatistics')?.click();
      setTimeout(() => {
        document.querySelector('#statsProductMatrixSection')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  }

  // 4.1. Biểu đồ Dashboard (14 ngày gần nhất hoặc 12 tháng)
  const chartModeGroup = document.querySelector('#dashboardChartModeGroup');
  if (chartModeGroup && !chartModeGroup.dataset.bound) {
    chartModeGroup.dataset.bound = 'true';
    chartModeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dash-chart]');
      if (!btn) return;
      dashboardChartMode = btn.dataset.dashChart;
      chartModeGroup.querySelectorAll('[data-dash-chart]').forEach(b => b.classList.toggle('active', b === btn));
      renderDashboardRevenueChart();
    });
  }
  renderDashboardRevenueChart();

  // 5. Đơn hàng gần đây ưu tiên đơn cần xử lý + bấm mở thẳng Modal chi tiết
  if (recentOrdersTbody) {
    const priorityScore = (o) => {
      if (orderNeedsRefund(o)) return 0;
      if (o.status === 'pending' && !isUnpaidSepayOrder(o)) return 1;
      if (o.status === 'confirmed') return 2;
      if (o.status === 'shipping') return 3;
      if (o.status === 'pending') return 4;
      return 5;
    };
    const recents = [...allOrders]
      .sort((a, b) => {
        const pDiff = priorityScore(a) - priorityScore(b);
        if (pDiff !== 0) return pDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(0, 5);

    if (recents.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">Chưa có đơn hàng nào</td></tr>`;
    } else {
      recentOrdersTbody.innerHTML = recents.map(order => {
        let badgeClass = 'badge-emerald';
        let statusText = 'Hoàn thành';
        if (orderNeedsRefund(order)) {
          badgeClass = 'badge-rose';
          statusText = 'Cần hoàn tiền';
        } else if (order.status === 'pending') {
          badgeClass = 'badge-amber';
          statusText = isUnpaidSepayOrder(order) ? 'Chờ TT SePay' : 'Chờ xử lý';
        } else if (order.status === 'confirmed') { badgeClass = 'badge-blue'; statusText = 'Đã xác nhận'; }
        else if (order.status === 'shipping') { badgeClass = 'badge-blue'; statusText = 'Đang giao'; }
        else if (order.status === 'cancelled') { badgeClass = 'badge-rose'; statusText = order.paymentStatus === 'refunded' ? 'Đã hoàn tiền' : 'Đã hủy'; }

        return `
          <tr class="dashboard-recent-row" data-order-id="${escapeHTML(order.id)}" title="Nhấn để xem chi tiết & xử lý đơn ngay">
            <td><strong style="white-space: nowrap;">#${escapeHTML(order.orderCode || order.id)}</strong></td>
            <td>${escapeHTML(order.customerName || 'Khách Vãng Lai')}</td>
            <td style="font-weight: 700; color: var(--color-primary);">${formatPrice(order.totalAmount)}</td>
            <td><span class="badge-pill ${badgeClass}">${statusText}</span></td>
          </tr>
        `;
      }).join('');
    }

    if (!recentOrdersTbody.dataset.bound) {
      recentOrdersTbody.dataset.bound = 'true';
      recentOrdersTbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-order-id]');
        if (!row) return;
        const found = allOrders.find(o => String(o.id) === String(row.dataset.orderId));
        if (found && typeof openOrderDetailHandler === 'function') {
          openOrderDetailHandler(found);
        }
      });
    }
  }

  // 6. Phân bổ doanh thu theo danh mục (đơn hoàn tất)
  if (categoryBreakdown) {
    const catList = calculateCategoryRevenueBreakdown(allOrders, allProducts, allCategories);
    categoryBreakdown.innerHTML = catList.map(cat => `
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
          <span>${escapeHTML(cat.categoryName)}</span>
          <span style="color: var(--text-muted);">${formatPrice(cat.revenue)} (${cat.percent}%)</span>
        </div>
        <div style="height: 6px; background-color: var(--border-light); border-radius: 4px; overflow: hidden;">
          <div style="width: ${cat.percent}%; height: 100%; background-color: var(--color-primary); border-radius: 4px;"></div>
        </div>
      </div>
    `).join('');
  }
}

function renderDashboardRevenueChart() {
  const chartWrap = document.querySelector('#dashboardBarChartWrap');
  const subtitleEl = document.querySelector('#dashboardChartSubtitle');
  if (!chartWrap) return;

  const currentYear = new Date().getFullYear();
  let statsData;
  if (dashboardChartMode === '12months') {
    statsData = calculateRevenueStats(allOrders, 'month', currentYear, { products: allProducts });
    if (subtitleEl) subtitleEl.textContent = `Tổng hợp Doanh số, Doanh thu & Lợi nhuận 12 tháng năm ${currentYear}`;
  } else {
    const range14 = getDefaultDateRange(13);
    statsData = calculateRevenueStats(allOrders, 'day', currentYear, {
      fromDate: range14.fromDate,
      toDate: range14.toDate,
      products: allProducts
    });
    if (subtitleEl) subtitleEl.textContent = `Biến động từng ngày trong 14 ngày gần nhất (${range14.fromDate} → ${range14.toDate})`;
  }

  chartWrap.innerHTML = renderPeriodBarChartHtml(statsData, {
    heightPx: 130,
    showGmv: true,
    showRevenue: true,
    showProfit: true,
    compact: true
  });
}

// ==========================================================================
// 6. THUẬT TOÁN PHÂN TRANG TÁI SỬ DỤNG (CÔNG THỨC CHUẨN CỦA CÔ GIÁO)
// Limit: số phần tử 1 trang
// Page: Math.ceil(tongsp / limit)
// Cắt mảng: array.slice((page - 1) * limit, page * limit)
// ==========================================================================
function renderPaginationControls({ containerId, totalItems, currentPage, limit, onPageChange, onLimitChange }) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  // Công thức của cô: Math.ceil(tongsp / limit)
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const startIdx = (currentPage - 1) * limit + 1;
  const endIdx = Math.min(currentPage * limit, totalItems);

  // Tạo các nút trang: 1, 2, 3...
  let pageButtonsHtml = '';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    pageButtonsHtml += `
      <button type="button" class="btn-page ${isActive ? 'active' : ''}" data-page="${i}" style="min-width: 32px; height: 32px; padding: 0 8px; border-radius: 6px; border: 1px solid ${isActive ? '#108474' : 'var(--border-light)'}; background: ${isActive ? '#108474' : '#FFF'}; color: ${isActive ? '#FFF' : 'var(--text-dark)'}; font-weight: 600; font-size: 12.5px; cursor: pointer;">
        ${i}
      </button>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-muted); flex-wrap: wrap;">
      <span>Hiển thị <strong>${startIdx} - ${endIdx}</strong> / tổng <strong>${totalItems}</strong> mục</span>
      <span style="display: flex; align-items: center; gap: 6px;">
        Số dòng:
        <select class="admin-select pagination-limit-select" style="padding: 4px 8px; font-size: 12px; height: 32px;">
          <option value="5" ${limit === 5 ? 'selected' : ''}>5 / trang</option>
          <option value="10" ${limit === 10 ? 'selected' : ''}>10 / trang</option>
          <option value="20" ${limit === 20 ? 'selected' : ''}>20 / trang</option>
        </select>
      </span>
    </div>

    <div style="display: flex; align-items: center; gap: 6px;">
      <button type="button" class="btn-page-nav page-prev" ${currentPage <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} style="height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-light); background: #FFF; font-size: 12.5px; font-weight: 600; cursor: pointer;">
        « Pre
      </button>
      <div style="display: flex; gap: 4px;">
        ${pageButtonsHtml}
      </div>
      <button type="button" class="btn-page-nav page-next" ${currentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} style="height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-light); background: #FFF; font-size: 12.5px; font-weight: 600; cursor: pointer;">
        Next »
      </button>
    </div>
  `;

  // Gắn sự kiện thay đổi limit
  const limitSelect = container.querySelector('.pagination-limit-select');
  if (limitSelect) {
    limitSelect.addEventListener('change', (e) => {
      if (typeof onLimitChange === 'function') onLimitChange(Number(e.target.value));
    });
  }

  // Gắn sự kiện nút Pre
  const prevBtn = container.querySelector('.page-prev');
  if (prevBtn && currentPage > 1) {
    prevBtn.addEventListener('click', () => {
      if (typeof onPageChange === 'function') onPageChange(currentPage - 1);
    });
  }

  // Gắn sự kiện nút Next
  const nextBtn = container.querySelector('.page-next');
  if (nextBtn && currentPage < totalPages) {
    nextBtn.addEventListener('click', () => {
      if (typeof onPageChange === 'function') onPageChange(currentPage + 1);
    });
  }

  // Gắn sự kiện từng trang số
  const pageBtns = container.querySelectorAll('.btn-page');
  pageBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (p !== currentPage && typeof onPageChange === 'function') onPageChange(p);
    });
  });
}

// ==========================================================================
// 7. TAB 2: QUẢN LÝ SẢN PHẨM (CRUD + PHÂN TRANG + SMART SELLER TABS & STEPPER)
// ==========================================================================
function renderProductSegmentedTabs() {
  const container = document.querySelector('#productSegmentedTabs');
  if (!container) return;

  const lowStockCount = allProducts.filter(p => Number(p.stock || 0) <= 10).length;
  const activeCount = allProducts.filter(p => p.isActive !== false && p.is_active !== false).length;
  const inactiveCount = allProducts.filter(p => p.isActive === false || p.is_active === false).length;

  let tabsHtml = `
    <button type="button" class="segmented-tab ${selectedProductSegment === 'all' ? 'active' : ''}" data-segment="all">
      Tất cả <span class="tab-count">${allProducts.length}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedProductSegment === 'active' ? 'active' : ''}" data-segment="active" style="color: #047857;">
      Đang bán <span class="tab-count" style="background: rgba(16,185,129,0.15); color: #047857;">${activeCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedProductSegment === 'inactive' ? 'active' : ''}" data-segment="inactive" style="color: #64748B;">
      Ngừng bán <span class="tab-count" style="background: rgba(100,116,139,0.15); color: #64748B;">${inactiveCount}</span>
    </button>
  `;

  allCategories.forEach(cat => {
    const count = allProducts.filter(p => matchesCategoryId(p, cat.id)).length;
    tabsHtml += `
      <button type="button" class="segmented-tab ${String(selectedProductSegment) === String(cat.id) ? 'active' : ''}" data-segment="${cat.id}">
        ${escapeHTML(cat.name)} <span class="tab-count">${count}</span>
      </button>
    `;
  });

  tabsHtml += `
    <button type="button" class="segmented-tab ${selectedProductSegment === 'low-stock' ? 'active' : ''}" data-segment="low-stock" style="color: #DC2626;">
      Sắp hết hàng <span class="tab-count" style="background: rgba(239,68,68,0.15); color: #DC2626;">${lowStockCount}</span>
    </button>
  `;

  container.innerHTML = tabsHtml;

  container.querySelectorAll('.segmented-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedProductSegment = btn.dataset.segment;
      productsPagination.currentPage = 1;
      renderProductsTable();
    });
  });
}

function renderProductsTable() {
  const tbody = document.querySelector('#adminProductsTable');
  const searchInput = document.querySelector('#productSearchInput');
  const sortSelect = document.querySelector('#productSortSelect');
  if (!tbody) return;

  // Vẽ các tab phân đoạn nhanh
  renderProductSegmentedTabs();

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const sortType = sortSelect ? sortSelect.value : 'default';

  // Lọc sản phẩm bằng filter() kết hợp Segmented Tab trực quan
  let filtered = allProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm) || String(p.id).includes(searchTerm);
    let matchSegment = true;
    if (selectedProductSegment === 'low-stock') {
      matchSegment = Number(p.stock || 0) <= 10;
    } else if (selectedProductSegment === 'active') {
      matchSegment = p.isActive !== false && p.is_active !== false;
    } else if (selectedProductSegment === 'inactive') {
      matchSegment = p.isActive === false || p.is_active === false;
    } else if (selectedProductSegment !== 'all') {
      matchSegment = String(p.categoryId) === String(selectedProductSegment);
    }
    return matchSearch && matchSegment;
  });

  const soldMap = new Map(
    aggregateProductDeliveryAndRevenue(allOrders, allProducts, allCategories).map(item => [String(item.productId), item.deliveredQty])
  );

  // Sắp xếp sản phẩm bằng sort() ES6 chuẩn đề thi Mục 9
  if (sortType === 'price-asc') {
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortType === 'price-desc') {
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sortType === 'name-asc') {
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  } else if (sortType === 'name-desc') {
    filtered.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
  } else if (sortType === 'sold-desc') {
    filtered.sort((a, b) => (soldMap.get(String(b.id)) || 0) - (soldMap.get(String(a.id)) || 0));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">Không tìm thấy mẫu hoa nào phù hợp</td></tr>`;
    renderPaginationControls({
      containerId: 'productsPagination',
      totalItems: 0,
      currentPage: 1,
      limit: productsPagination.limit
    });
    return;
  }

  // Áp dụng thuật toán phân trang
  const totalItems = filtered.length;
  const limit = productsPagination.limit;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  if (productsPagination.currentPage > totalPages) {
    productsPagination.currentPage = totalPages;
  }

  const startIndex = (productsPagination.currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const pagedProducts = filtered.slice(startIndex, endIndex);

  tbody.innerHTML = pagedProducts.map(p => {
    const soldCountReal = soldMap.get(String(p.id)) || 0;
    const isProdActive = p.isActive !== false && p.is_active !== false;
    const originalPriceHtml = (p.originalPrice && p.originalPrice > p.price)
      ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 12px;">${formatPrice(p.originalPrice)}</span>`
      : '-';

    const costPriceNum = Number(p.costPrice || p.cost_price || 0);
    const costPriceHtml = costPriceNum > 0
      ? `<div style="font-size: 11px; color: #64748B; font-weight: 500; margin-top: 2px;" title="Giá vốn NVL & công làm">Vốn: ${formatPrice(costPriceNum)}</div>`
      : `<div style="font-size: 10.5px; color: #94A3B8; font-style: italic; margin-top: 2px;">Chưa nhập vốn</div>`;

    const stockNum = Number(p.stock) || 0;
    let stockBadgeClass = 'badge-stock-safe';
    let stockStatusDot = '<span class="badge-pill badge-emerald" style="font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;"><span class="dot-pulse" style="background:#108474;"></span>Còn hàng</span>';
    if (stockNum <= 0) {
      stockBadgeClass = 'badge-stock-out';
      stockStatusDot = '<span class="badge-pill badge-rose" style="font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;"><span class="dot-pulse" style="background:#EF4444;"></span>Hết hàng</span>';
    } else if (stockNum <= 10) {
      stockBadgeClass = 'badge-stock-low';
      stockStatusDot = '<span class="badge-pill badge-amber" style="font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;"><span class="dot-pulse" style="background:#F59E0B;"></span>Sắp hết</span>';
    }

    const activeStatusBadge = isProdActive
      ? '<span class="badge-pill badge-emerald" style="font-size: 10.5px; padding: 1px 6px;">Đang bán</span>'
      : '<span class="badge-pill" style="background: #FEE2E2; color: #991B1B; font-size: 10.5px; padding: 1px 6px;">Ngừng bán</span>';

    return `
      <tr data-id="${escapeHTML(p.id)}" style="${!isProdActive ? 'opacity: 0.72; background: #F8FAFC;' : ''}">
        <td>
          <img src="${safeAdminMediaUrl(p.image)}" alt="${escapeHTML(p.name)}" class="table-thumb" onerror="this.src='./images/300.webp'">
        </td>
        <td>
          <div class="table-title">${escapeHTML(p.name)}</div>
          <div class="table-subtitle" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span>ID: #${escapeHTML(p.id)}</span>
            ${activeStatusBadge}
            ${p.badge ? `<span class="badge-pill badge-rose" style="font-size: 10px; padding: 1px 6px;">${escapeHTML(p.badge)}</span>` : ''}
          </div>
        </td>
        <td>${escapeHTML(p.categoryName || 'Hoa Kẽm Nhung')}</td>
        <td>
          <div style="font-weight: 700; color: var(--color-sale-price);">${formatPrice(p.price)}</div>
          ${costPriceHtml}
        </td>
        <td>${originalPriceHtml}</td>
        <td>
          <div class="stock-stepper-wrap">
            <button type="button" class="btn-stepper btn-stepper-minus" data-id="${p.id}" title="Giảm 1 kho">-</button>
            <span class="stock-value ${stockBadgeClass}" id="stockVal-${p.id}">${stockNum}</span>
            <button type="button" class="btn-stepper btn-stepper-plus" data-id="${p.id}" title="Tăng 1 kho">+</button>
          </div>
          <div style="margin-top: 5px;">${stockStatusDot}</div>
        </td>
        <td><strong>${soldCountReal}</strong></td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end; gap: 4px;">
            <button type="button" class="btn-action toggle-active-btn" data-id="${p.id}" style="${isProdActive ? 'color: #D97706; border-color: rgba(217,119,6,0.3);' : 'color: #059669; border-color: rgba(5,150,105,0.3);'}" title="${isProdActive ? 'Tạm ngừng kinh doanh mẫu này' : 'Mở bán lại mẫu hoa này'}">
              ${isProdActive ? 'Ngừng bán' : 'Mở bán'}
            </button>
            <button type="button" class="btn-action btn-action-edit edit-product-btn" data-id="${p.id}">Sửa</button>
            <button type="button" class="btn-action btn-action-delete delete-product-btn" data-id="${p.id}">Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vẽ thanh phân trang
  renderPaginationControls({
    containerId: 'productsPagination',
    totalItems: totalItems,
    currentPage: productsPagination.currentPage,
    limit: productsPagination.limit,
    onPageChange: (newPage) => {
      productsPagination.currentPage = newPage;
      renderProductsTable();
    },
    onLimitChange: (newLimit) => {
      productsPagination.limit = newLimit;
      productsPagination.currentPage = 1;
      renderProductsTable();
    }
  });
}

function initProductCrud() {
  const modal = document.querySelector('#productModal');
  const closeBtn = document.querySelector('#productModalClose');
  const cancelBtn = document.querySelector('#productModalCancel');
  const openAddBtn = document.querySelector('#openAddProductBtn');
  const form = document.querySelector('#productForm');
  const modalTitle = document.querySelector('#productModalTitle');
  const catSelect = document.querySelector('#prodCategorySelect');
  const searchInput = document.querySelector('#productSearchInput');
  const catFilter = document.querySelector('#productCategoryFilter');
  const table = document.querySelector('#adminProductsTable');

  // Đổ danh mục vào các ô select
  function populateCategories() {
    if (catSelect) {
      catSelect.innerHTML = allCategories.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
    }
    if (catFilter) {
      catFilter.innerHTML = `<option value="all">Tất cả danh mục</option>` +
        allCategories.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
    }
  }

  // 2-Way Smart Calculator elements
  const origPriceInput = document.querySelector('#prodOriginalPriceInput');
  const discountPctInput = document.querySelector('#prodDiscountPercentInput');
  const priceInput = document.querySelector('#prodPriceInput');
  const costPriceInput = document.querySelector('#prodCostPriceInput');
  const isActiveSelect = document.querySelector('#prodIsActiveSelect');
  const quickPercentGroup = document.querySelector('#quickPercentGroup');
  const previewBadge = document.querySelector('#previewBadgeDiscount');
  const previewSavingText = document.querySelector('#previewSavingText');
  const origPriceHint = document.querySelector('#prodOrigPriceHint');
  const priceHint = document.querySelector('#prodPriceHint');
  const costPriceHint = document.querySelector('#prodCostPriceHint');

  function updateDiscountPreview() {
    const orig = Number(origPriceInput ? origPriceInput.value : 0) || 0;
    const price = Number(priceInput ? priceInput.value : 0) || 0;
    const cost = Number(costPriceInput ? costPriceInput.value : 0) || 0;

    // Cập nhật dòng chữ hiển thị định dạng tiền tệ VND tránh nhầm lẫn số không
    if (origPriceHint) origPriceHint.textContent = orig > 0 ? `≈ ${formatPrice(orig)}` : '≈ 0 ₫';
    if (priceHint) priceHint.textContent = price > 0 ? `≈ ${formatPrice(price)}` : '≈ 0 ₫';
    if (costPriceHint) costPriceHint.textContent = cost > 0 ? `≈ ${formatPrice(cost)}` : '≈ 0 ₫';

    let currentPct = 0;
    if (orig > 0 && orig > price) {
      const diff = orig - price;
      currentPct = Math.round((diff / orig) * 100);
      if (currentPct >= 5) {
        if (previewBadge) {
          previewBadge.textContent = `-${currentPct}%`;
          previewBadge.style.display = 'inline-block';
        }
        if (previewSavingText) {
          previewSavingText.textContent = `Khách tiết kiệm: ${formatPrice(diff)} (-${currentPct}%)`;
        }
      } else {
        if (previewBadge) previewBadge.style.display = 'none';
        if (previewSavingText) {
          previewSavingText.textContent = `Giảm ít hơn 5% (không hiện badge)`;
        }
      }
    } else {
      if (previewBadge) previewBadge.style.display = 'none';
      if (previewSavingText) {
        previewSavingText.textContent = 'Không giảm giá (bán theo giá gốc)';
      }
    }

    // Làm nổi bật nút % được chọn (Active Pill Highlight)
    if (quickPercentGroup) {
      const pills = quickPercentGroup.querySelectorAll('.quick-percent-pill');
      pills.forEach(pill => {
        const p = Number(pill.dataset.percent);
        if ((p === 0 && (orig === price || currentPct === 0)) || (p > 0 && p === currentPct)) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    }
  }

  // Lắng nghe tính toán 2 chiều (Reactive Smart Calculator)
  if (origPriceInput && discountPctInput && priceInput) {
    origPriceInput.addEventListener('input', () => {
      const orig = Number(origPriceInput.value) || 0;
      const pct = Number(discountPctInput.value) || 0;
      if (orig > 0 && pct > 0) {
        priceInput.value = Math.round(orig * (1 - pct / 100));
      } else if (orig > 0 && (!priceInput.value || Number(priceInput.value) === 0)) {
        priceInput.value = orig;
      }
      updateDiscountPreview();
    });

    discountPctInput.addEventListener('input', () => {
      const orig = Number(origPriceInput.value) || Number(priceInput.value) || 0;
      if (!origPriceInput.value && orig > 0) origPriceInput.value = orig;
      const pct = Number(discountPctInput.value) || 0;
      if (orig > 0) {
        priceInput.value = Math.max(0, Math.round(orig * (1 - pct / 100)));
      }
      updateDiscountPreview();
    });

    priceInput.addEventListener('input', () => {
      const price = Number(priceInput.value) || 0;
      const orig = Number(origPriceInput.value) || 0;
      if (orig > 0 && price <= orig) {
        const pct = Math.round(((orig - price) / orig) * 100);
        discountPctInput.value = pct;
      } else if (orig === 0 && price > 0) {
        origPriceInput.value = price;
        discountPctInput.value = 0;
      }
      updateDiscountPreview();
    });

    // Nút bấm nhanh % giảm giá (Quick pills: 0%, 10%, 15%, 20%...)
    if (quickPercentGroup) {
      quickPercentGroup.addEventListener('click', (e) => {
        const pill = e.target.closest('.quick-percent-pill');
        if (!pill) return;
        const pct = Number(pill.dataset.percent) || 0;
        discountPctInput.value = pct;
        const orig = Number(origPriceInput.value) || Number(priceInput.value) || 0;
        if (orig > 0) {
          if (!origPriceInput.value) origPriceInput.value = orig;
          priceInput.value = Math.max(0, Math.round(orig * (1 - pct / 100)));
        }
        updateDiscountPreview();
      });
    }
  }

  if (costPriceInput) {
    costPriceInput.addEventListener('input', updateDiscountPreview);
  }

  let currentEditingProduct = null;

  function openModal(mode = 'create', product = null) {
    if (!modal) return;
    modal.classList.remove('hidden');

    if (mode === 'create') {
      currentEditingProduct = null;
      modalTitle.textContent = 'Thêm Mẫu Hoa Kẽm Nhung Mới';
      form.reset();
      document.querySelector('#prodFormId').value = '';
      if (discountPctInput) discountPctInput.value = '';
      if (costPriceInput) costPriceInput.value = '';
      if (isActiveSelect) isActiveSelect.value = 'true';
      if (productDropzoneHelper) productDropzoneHelper.setPreview('');
      updateDiscountPreview();
    } else if (mode === 'edit' && product) {
      currentEditingProduct = { ...product };
      modalTitle.textContent = `Chỉnh Sửa Mẫu Hoa #${product.id}`;
      document.querySelector('#prodFormId').value = product.id;
      document.querySelector('#prodNameInput').value = product.name;
      document.querySelector('#prodPriceInput').value = product.price;
      const orig = product.originalPrice || product.price;
      document.querySelector('#prodOriginalPriceInput').value = orig;

      const costVal = (product.costPrice !== undefined && product.costPrice !== null)
        ? product.costPrice
        : (product.cost_price ?? '');
      if (costPriceInput) costPriceInput.value = costVal !== '' ? costVal : '';

      if (isActiveSelect) {
        const isProdActive = (product.isActive !== false && product.is_active !== false);
        isActiveSelect.value = isProdActive ? 'true' : 'false';
      }

      // Tự động tính % giảm giá của sản phẩm hiện tại
      const pct = (orig > product.price) ? Math.round(((orig - product.price) / orig) * 100) : 0;
      if (discountPctInput) discountPctInput.value = pct > 0 ? pct : '';

      document.querySelector('#prodCategorySelect').value = product.categoryId;
      document.querySelector('#prodBadgeSelect').value = product.badge || '';
      document.querySelector('#prodStockInput').value = product.stock || 0;
      document.querySelector('#prodDescInput').value = product.description || '';
      if (productDropzoneHelper) productDropzoneHelper.setPreview(product.image || '');
      const urlInput = document.querySelector('#prodImageUrlInput');
      if (urlInput) urlInput.value = product.image || '';
      updateDiscountPreview();
    }
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (openAddBtn) openAddBtn.addEventListener('click', () => openModal('create'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Nút bật/tắt thiết lập Chiến Dịch Lễ
  const toggleCampaignBtn = document.querySelector('#toggleCampaignBtn');
  const campaignPanel = document.querySelector('#campaignBoosterPanel');
  if (toggleCampaignBtn && campaignPanel && !toggleCampaignBtn.dataset.bound) {
    toggleCampaignBtn.dataset.bound = 'true';
    toggleCampaignBtn.addEventListener('click', () => {
      const isHidden = campaignPanel.style.display === 'none' || !campaignPanel.style.display;
      campaignPanel.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (searchInput) searchInput.addEventListener('input', () => {
    productsPagination.currentPage = 1;
    renderProductsTable();
  });
  if (catFilter) catFilter.addEventListener('change', () => {
    productsPagination.currentPage = 1;
    renderProductsTable();
  });
  const sortSelect = document.querySelector('#productSortSelect');
  if (sortSelect) sortSelect.addEventListener('change', () => {
    productsPagination.currentPage = 1;
    renderProductsTable();
  });

  // Submit Form Lưu / Sửa Sản Phẩm
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const origBtnText = submitBtn ? submitBtn.textContent : 'Lưu Sản Phẩm';
      const id = document.querySelector('#prodFormId').value;
      const catId = Number(document.querySelector('#prodCategorySelect').value);
      const catObj = allCategories.find(c => Number(c.id) === catId) || {};

      let image = document.querySelector('#prodImageUrl').value || document.querySelector('#prodImageUrlInput').value;
      if (!image) image = './images/300.webp';

      const costPriceVal = costPriceInput ? (Number(costPriceInput.value) || 0) : 0;
      const isActiveVal = isActiveSelect ? (isActiveSelect.value === 'true') : true;

      const rawStockInput = document.querySelector('#prodStockInput');
      const inputStockVal = Number(rawStockInput ? rawStockInput.value : 0);

      const productData = {
        name: document.querySelector('#prodNameInput').value.trim(),
        price: Number(document.querySelector('#prodPriceInput').value),
        originalPrice: Number(document.querySelector('#prodOriginalPriceInput').value) || Number(document.querySelector('#prodPriceInput').value),
        costPrice: Math.max(0, costPriceVal),
        isActive: isActiveVal,
        categoryId: catId,
        categoryName: catObj.name || 'Hoa Kẽm Nhung',
        categorySlug: catObj.slug || 'kem-nhung',
        badge: document.querySelector('#prodBadgeSelect').value,
        description: document.querySelector('#prodDescInput').value.trim(),
        image
      };

      if (!productData.name || !productData.price) {
        showToast('Vui lòng nhập đầy đủ tên hoa và giá bán!', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu...';
      }

      try {
        if (id) {
          // BẢO VỆ TỒN KHO THỜI GIAN THỰC:
          // Nếu form sửa sản phẩm KHÔNG thay đổi số lượng tồn kho (người dùng chỉ sửa giá/tên/mô tả),
          // TUYỆT ĐỐI KHÔNG GỬI stock để tránh ghi đè số tồn kho vừa bị trừ bởi các đơn hàng đồng thời!
          const origStock = currentEditingProduct ? Number(currentEditingProduct.stock || 0) : null;
          if (origStock === null || inputStockVal !== origStock) {
            productData.stock = Math.max(0, inputStockVal);
          }
          await updateProduct(id, productData);
          showToast(`Đã cập nhật mẫu hoa #${id} thành công!`, 'success');
        } else {
          // Thêm mới: bắt buộc có số lượng tồn khởi tạo
          productData.stock = Math.max(0, inputStockVal);
          const created = await createProduct(productData);
          showToast(`Đã thêm mẫu hoa mới "${created.name}"!`, 'success');
        }

        closeModal();
        allProducts = await fetchProducts({ activeOnly: false });
        renderProductSegmentedTabs();
        renderProductsTable();
        renderDashboard();
      } catch (err) {
        console.error('Lỗi lưu sản phẩm:', err);
        const errMsg = err.response?.data?.error?.message || err.message || 'Có lỗi xảy ra khi lưu mẫu hoa!';
        showToast(errMsg, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origBtnText;
        }
      }
    });
  }

  // Event Delegation cho bảng sản phẩm (Sửa, Xóa, Tăng giảm kho & Ngừng bán)
  if (table) {
    table.addEventListener('click', async (e) => {
      const stepperBtn = e.target.closest('.btn-stepper');
      const toggleActiveBtn = e.target.closest('.toggle-active-btn');
      const editBtn = e.target.closest('.edit-product-btn');
      const deleteBtn = e.target.closest('.delete-product-btn');

      if (stepperBtn) {
        e.stopPropagation();
        const id = stepperBtn.dataset.id;
        const isPlus = stepperBtn.classList.contains('btn-stepper-plus');
        const prod = allProducts.find(p => String(p.id) === String(id));
        if (!prod) return;

        let currentVal = Number(prod.stock) || 0;
        if (!isPlus && currentVal <= 0) return;

        const delta = isPlus ? 1 : -1;
        const optimisticVal = Math.max(0, currentVal + delta);
        const valEl = document.querySelector(`#stockVal-${id}`);
        if (valEl) valEl.textContent = optimisticVal;

        try {
          // GỬI DELTA NGUYÊN TỬ (ATOMIC DELTA), KHÔNG GỬI SỐ TUYỆT ĐỐI LẤY TỪ DOM TRÁNH GHI ĐÈ TỒN KHO ĐỒNG THỜI
          const updated = await updateProduct(id, { stockDelta: delta });
          const realStock = (updated && updated.stock !== undefined) ? updated.stock : optimisticVal;
          prod.stock = realStock;
          if (valEl) valEl.textContent = realStock;
          showToast(`Đã cập nhật kho [${prod.name}]: ${realStock} sản phẩm`, 'success');
          renderDashboard();
          renderProductSegmentedTabs();
          renderProductsTable();
        } catch (err) {
          console.error('Lỗi cập nhật kho:', err);
          showToast('Lỗi cập nhật tồn kho!', 'error');
          renderProductsTable();
        }
        return;
      }

      if (toggleActiveBtn) {
        e.stopPropagation();
        const id = toggleActiveBtn.dataset.id;
        const prod = allProducts.find(p => String(p.id) === String(id));
        if (!prod) return;

        const currentActive = (prod.isActive !== false && prod.is_active !== false);
        const nextActive = !currentActive;

        toggleActiveBtn.disabled = true;
        try {
          await updateProduct(id, { isActive: nextActive });
          prod.isActive = nextActive;
          prod.is_active = nextActive;
          showToast(nextActive ? `Đã mở bán lại mẫu hoa "${prod.name}"!` : `Đã tạm ngừng kinh doanh mẫu hoa "${prod.name}"!`, 'success');
          renderProductSegmentedTabs();
          renderProductsTable();
        } catch (err) {
          console.error('Lỗi cập nhật trạng thái mở bán:', err);
          const errMsg = err.response?.data?.error?.message || err.message || 'Không thể đổi trạng thái!';
          showToast(errMsg, 'error');
        } finally {
          toggleActiveBtn.disabled = false;
        }
        return;
      }

      if (editBtn) {
        const id = editBtn.dataset.id;
        const product = allProducts.find(p => p.id == id);
        if (product) openModal('edit', product);
      } else if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        openConfirmModal('product', id, 'Bạn có chắc chắn muốn xóa mẫu hoa này khỏi cửa hàng không?');
      }
    });
  }

  // ========================================================================
  // BỘ KÍCH HOẠT CHIẾN DỊCH KHUYẾN MÃI NGÀY LỄ (HOLIDAY CAMPAIGN BOOSTER)
  // ========================================================================
  const holidaySelect = document.querySelector('#campaignHolidaySelect');
  const applyHolidayBtn = document.querySelector('#btnApplyHolidayCampaign');
  const restorePricesBtn = document.querySelector('#btnRestoreOriginalPrices');

  // Bản đồ tỷ lệ giảm giá theo từng ngày lễ / chiến dịch
  const HOLIDAY_DISCOUNT_RATES = {
    valentine: { pct: 25, name: 'Đại Lễ Valentine 14/02' },
    women_day: { pct: 20, name: 'Quốc Tế Phụ Nữ 08/03' },
    tet: { pct: 15, name: 'Tết Nguyên Đán & Mùa Xuân' },
    flash_sale: { pct: 30, name: 'Flash Sale Cuối Tuần' },
    clearance: { pct: 35, name: 'Xả Kho Mẫu Cũ' }
  };

  if (applyHolidayBtn && holidaySelect) {
    applyHolidayBtn.addEventListener('click', async () => {
      const selected = holidaySelect.value;
      if (!selected || !HOLIDAY_DISCOUNT_RATES[selected]) {
        showToast('Vui lòng chọn một chiến dịch ngày lễ trong danh sách!', 'error');
        return;
      }

      const campaign = HOLIDAY_DISCOUNT_RATES[selected];
      const confirmed = window.confirm(`Bạn có chắc muốn kích hoạt "${campaign.name}"?\nTất cả hoa sẽ được áp dụng giảm sâu ${campaign.pct}% ngay lập tức.`);
      if (!confirmed) return;

      applyHolidayBtn.disabled = true;
      applyHolidayBtn.textContent = 'Đang xử lý...';

      try {
        for (const p of allProducts) {
          const orig = Number(p.originalPrice) || Number(p.price);
          const newPrice = Math.round(orig * (1 - campaign.pct / 100));
          await updateProduct(p.id, {
            originalPrice: orig,
            price: newPrice
          });
        }
        allProducts = await fetchProducts({ activeOnly: false });
        renderProductSegmentedTabs();
        renderProductsTable();
        renderDashboard();
        showToast(`Đã kích hoạt "${campaign.name}"! Toàn bộ hoa đã giảm sâu ${campaign.pct}%.`, 'success');
      } catch (err) {
        showToast('Có lỗi xảy ra khi kích hoạt chiến dịch!', 'error');
      } finally {
        applyHolidayBtn.disabled = false;
        applyHolidayBtn.textContent = 'Kích Hoạt Lễ';
      }
    });
  }

  if (restorePricesBtn) {
    restorePricesBtn.addEventListener('click', async () => {
      const confirmed = window.confirm('Bạn có chắc muốn KẾT THÚC LỄ và khôi phục toàn bộ hoa về GIÁ GỐC ban đầu?\nTất cả badge giảm giá sẽ được tắt.');
      if (!confirmed) return;

      restorePricesBtn.disabled = true;
      restorePricesBtn.textContent = 'Đang khôi phục...';

      try {
        for (const p of allProducts) {
          if (p.originalPrice && p.price !== p.originalPrice) {
            await updateProduct(p.id, {
              price: p.originalPrice
            });
          }
        }
        allProducts = await fetchProducts({ activeOnly: false });
        renderProductSegmentedTabs();
        renderProductsTable();
        renderDashboard();
        showToast('Đã khôi phục toàn bộ hoa về giá gốc niêm yết!', 'success');
      } catch (err) {
        showToast('Có lỗi xảy ra khi khôi phục giá gốc!', 'error');
      } finally {
        restorePricesBtn.disabled = false;
        restorePricesBtn.textContent = 'Hết Lễ: Khôi Phục Giá Gốc';
      }
    });
  }

  populateCategories();
}

// ==========================================================================
// 7. TAB 3: QUẢN LÝ BANNERS & CHỦ ĐỀ CHIẾN DỊCH (CRUD & THEME SELECTOR)
// ==========================================================================
function renderBannersTable() {
  const tbody = document.querySelector('#adminBannersTable');
  if (!tbody) return;

  if (allBanners.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">Chưa có banner nào</td></tr>`;
    return;
  }

  tbody.innerHTML = allBanners.map(b => {
    let themeBadge = 'badge-emerald';
    let themeLabel = 'Mặc định';
    if (b.theme === 'tet') { themeBadge = 'badge-rose'; themeLabel = 'Tết 2026'; }
    else if (b.theme === 'valentine') { themeBadge = 'badge-rose'; themeLabel = 'Valentine'; }
    else if (b.theme === 'sale') { themeBadge = 'badge-amber'; themeLabel = 'Siêu Sale'; }

    const bannerImg = b.hinhbanner || b.image_url || b.image || './images/350.webp';
    const bannerName = b.tenbanner || b.title || 'Banner';
    const bannerOrder = b.order ?? b.display_order ?? 1;
    const isBannerActive = (b.active !== undefined ? b.active : b.is_active) ?? true;

    return `
      <tr data-id="${escapeHTML(b.id)}">
        <td>
          <img src="${safeAdminMediaUrl(bannerImg, './images/350.webp')}" alt="${escapeHTML(bannerName)}" class="table-thumb" style="width: 70px; height: 42px; object-fit: cover;" onerror="this.src='./images/350.webp'">
        </td>
        <td>
          <div class="table-title">${escapeHTML(bannerName)}</div>
          <div class="table-subtitle">ID: #${escapeHTML(b.id)}</div>
        </td>
        <td><span class="badge-pill badge-gray">${escapeHTML(b.tag || '--')}</span></td>
        <td><span class="badge-pill ${themeBadge}">${themeLabel}</span></td>
        <td><strong>${bannerOrder}</strong></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="banner-active-toggle" data-id="${b.id}" ${isBannerActive ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
            <button type="button" class="btn-action btn-action-edit edit-banner-btn" data-id="${b.id}">Sửa</button>
            <button type="button" class="btn-action btn-action-delete delete-banner-btn" data-id="${b.id}">Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function initBannerCrud() {
  const modal = document.querySelector('#bannerModal');
  const closeBtn = document.querySelector('#bannerModalClose');
  const cancelBtn = document.querySelector('#bannerModalCancel');
  const openAddBtn = document.querySelector('#openAddBannerBtn');
  const form = document.querySelector('#bannerForm');
  const modalTitle = document.querySelector('#bannerModalTitle');
  const themePills = document.querySelector('#themePillGroup');
  const table = document.querySelector('#adminBannersTable');

  // Xử lý chọn chủ đề chiến dịch toàn shop
  if (themePills) {
    themePills.addEventListener('click', async (e) => {
      const btn = e.target.closest('.theme-btn');
      if (!btn) return;

      themePills.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const themeKey = btn.dataset.theme;
      allBanners = await activateBannerTheme(themeKey);
      renderBannersTable();
      showToast(`Đã kích hoạt chiến dịch: "${btn.textContent.trim()}" cho toàn bộ cửa hàng!`);
    });
  }

  function openModal(mode = 'create', banner = null) {
    if (!modal) return;
    modal.classList.remove('hidden');

    if (mode === 'create') {
      modalTitle.textContent = 'Thêm Banner Slider Mới';
      form.reset();
      document.querySelector('#bannerFormId').value = '';
      if (bannerDropzoneHelper) bannerDropzoneHelper.setPreview('');
    } else if (mode === 'edit' && banner) {
      modalTitle.textContent = `Chỉnh Sửa Banner #${banner.id}`;
      document.querySelector('#bannerFormId').value = banner.id;
      document.querySelector('#bannerTenInput').value = banner.tenbanner || banner.title || '';
      document.querySelector('#bannerTagInput').value = banner.tag || '';
      document.querySelector('#bannerThemeSelect').value = banner.theme || 'default';
      document.querySelector('#bannerTitleInput').value = banner.title || banner.tenbanner || '';
      document.querySelector('#bannerDescInput').value = banner.desc || '';
      document.querySelector('#bannerOrderInput').value = banner.order ?? banner.display_order ?? 1;
      document.querySelector('#bannerActiveCheckbox').checked = Boolean(banner.active !== undefined ? banner.active : banner.is_active);
      const bImg = banner.hinhbanner || banner.image_url || banner.image || '';
      if (bannerDropzoneHelper) bannerDropzoneHelper.setPreview(bImg);
      const urlInput = document.querySelector('#bannerImageUrlInput');
      if (urlInput) urlInput.value = bImg;
    }
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (openAddBtn) openAddBtn.addEventListener('click', () => openModal('create'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Nút bật/tắt thiết lập Chiến Dịch Lễ
  const toggleCampaignBtn = document.querySelector('#toggleCampaignBtn');
  const campaignPanel = document.querySelector('#campaignBoosterPanel');
  if (toggleCampaignBtn && campaignPanel && !toggleCampaignBtn.dataset.bound) {
    toggleCampaignBtn.dataset.bound = 'true';
    toggleCampaignBtn.addEventListener('click', () => {
      const isHidden = campaignPanel.style.display === 'none' || !campaignPanel.style.display;
      campaignPanel.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.querySelector('#bannerFormId').value;
      let hinhbanner = document.querySelector('#bannerImageUrl').value || document.querySelector('#bannerImageUrlInput').value;
      if (!hinhbanner) hinhbanner = './images/350.webp';

      const bannerData = {
        tenbanner: document.querySelector('#bannerTenInput').value.trim(),
        tag: document.querySelector('#bannerTagInput').value.trim(),
        theme: document.querySelector('#bannerThemeSelect').value,
        title: document.querySelector('#bannerTitleInput').value.trim(),
        desc: document.querySelector('#bannerDescInput').value.trim(),
        order: Number(document.querySelector('#bannerOrderInput').value) || 1,
        active: document.querySelector('#bannerActiveCheckbox').checked,
        link: '#products',
        ctaText: 'Khám Phá Các Mẫu Hoa',
        hinhbanner
      };

      if (!bannerData.tenbanner) {
        showToast('Vui lòng nhập tên banner!', 'error');
        return;
      }

      if (id) {
        await updateBanner(id, bannerData);
        showToast(`Đã cập nhật banner #${id}!`);
      } else {
        await createBanner(bannerData);
        showToast(`Đã thêm banner mới thành công!`);
      }

      closeModal();
      allBanners = await fetchAllBanners();
      renderBannersTable();
    });
  }

  // Event Delegation cho Bảng Banner (Toggle Active, Sửa & Xóa)
  if (table) {
    table.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-banner-btn');
      const deleteBtn = e.target.closest('.delete-banner-btn');

      if (editBtn) {
        const id = editBtn.dataset.id;
        const banner = allBanners.find(b => String(b.id) === String(id));
        if (banner) openModal('edit', banner);
      } else if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        openConfirmModal('banner', id, 'Bạn có chắc chắn muốn xóa banner này không?');
      }
    });

    table.addEventListener('change', async (e) => {
      const toggle = e.target.closest('.banner-active-toggle');
      if (toggle) {
        const id = toggle.dataset.id;
        const active = toggle.checked;
        await updateBanner(id, { active });
        allBanners = await fetchAllBanners();
        showToast(`Đã ${active ? 'bật' : 'tắt'} hiển thị banner #${id}`);
      }
    });
  }
}

// ==========================================================================
// 8. TAB 4: QUẢN LÝ VOUCHERS (CRUD)
// ==========================================================================
function renderVouchersTable() {
  const tbody = document.querySelector('#adminVouchersTable');
  if (!tbody) return;

  if (allPromotions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">Chưa có mã giảm giá nào</td></tr>`;
    return;
  }

  tbody.innerHTML = allPromotions.map(v => {
    let typeLabel = 'Toàn Shop';
    if (v.scope === 'category') typeLabel = 'Theo Danh Mục';
    else if (v.scope === 'product') typeLabel = 'Theo Sản Phẩm';
    else if (v.type === 'birthday') typeLabel = 'Sinh Nhật';
    else if (v.type === 'flash_sale') typeLabel = 'Giờ Vàng';

    const voucherMeta = formatVoucherDisplay(v, formatPrice);
    const isPercent = voucherMeta.isPercent;
    const discountDisplay = voucherMeta.shortTag;
    const maxDiscountHint = (isPercent && voucherMeta.maxDiscount)
      ? `<br><span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">Trần: ${formatPrice(voucherMeta.maxDiscount)}</span>`
      : '';
    const excludeHint = v.excludeSaleItems
      ? `<br><span style="font-size: 10.5px; color: #b45309; font-weight: 500;">(Chặn sale)</span>`
      : '';

    return `
      <tr data-id="${escapeHTML(v.id)}">
        <td><strong style="font-family: monospace; font-size: 14px; color: var(--color-primary); background: var(--color-primary-light); padding: 3px 8px; border-radius: 4px;">${escapeHTML(v.code)}</strong></td>
        <td><strong>${escapeHTML(voucherMeta.nameText)}</strong><br><span style="font-size: 12px; color: var(--text-muted);">${escapeHTML(voucherMeta.conditionText)}</span></td>
        <td><span class="badge-pill badge-rose" style="font-weight: 800;">${discountDisplay}</span>${maxDiscountHint}</td>
        <td>${v.minOrder > 0 ? formatPrice(v.minOrder) : '<span style="color: var(--text-muted);">Không giới hạn</span>'}${excludeHint}</td>
        <td><span class="badge-pill badge-blue">${typeLabel}</span><br><span style="font-size: 11px; color: var(--text-muted);">Dùng: ${v.usedCount || 0}/${v.usageLimit || '∞'}</span></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="voucher-active-toggle" data-id="${v.id}" ${v.active ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
            <button type="button" class="btn-action btn-action-edit edit-voucher-btn" data-id="${v.id}">Sửa</button>
            <button type="button" class="btn-action btn-action-delete delete-voucher-btn" data-id="${v.id}">Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function initVoucherCrud() {
  const modal = document.querySelector('#voucherModal');
  const closeBtn = document.querySelector('#voucherModalClose');
  const cancelBtn = document.querySelector('#voucherModalCancel');
  const openAddBtn = document.querySelector('#openAddVoucherBtn');
  const form = document.querySelector('#voucherForm');
  const modalTitle = document.querySelector('#voucherModalTitle');
  const table = document.querySelector('#adminVouchersTable');

  const typeSelect = document.querySelector('#voucherDiscountTypeSelect');
  const valueInput = document.querySelector('#voucherDiscountValueInput');
  const valueLabel = document.querySelector('#voucherDiscountValueLabel');
  const maxDiscountGroup = document.querySelector('#voucherMaxDiscountGroup');
  const maxDiscountInput = document.querySelector('#voucherMaxDiscountInput');

  const scopeSelect = document.querySelector('#voucherScopeSelect');
  const targetCategoryGroup = document.querySelector('#voucherTargetCategoryGroup');
  const targetCategorySelect = document.querySelector('#voucherTargetCategorySelect');
  const targetProductGroup = document.querySelector('#voucherTargetProductGroup');
  const targetProductSelect = document.querySelector('#voucherTargetProductSelect');

  // Xử lý chuyển đổi loại giảm giá (% hoặc Tiền mặt)
  function handleDiscountTypeChange() {
    if (!typeSelect || !valueLabel) return;
    if (typeSelect.value === 'fixed') {
      valueLabel.textContent = 'Số Tiền Giảm (₫) (*):';
      valueInput.placeholder = '30000';
      valueInput.removeAttribute('max');
      if (maxDiscountGroup) maxDiscountGroup.style.display = 'none';
    } else {
      valueLabel.textContent = 'Mức Giảm (%) (*):';
      valueInput.placeholder = '15';
      valueInput.max = '100';
      if (maxDiscountGroup) maxDiscountGroup.style.display = 'block';
    }
  }

  // Xử lý chuyển đổi phạm vi áp dụng (Toàn shop, Theo Danh mục, Theo Mẫu hoa)
  function handleScopeChange() {
    if (!scopeSelect) return;
    if (scopeSelect.value === 'category') {
      if (targetCategoryGroup) targetCategoryGroup.style.display = 'block';
      if (targetProductGroup) targetProductGroup.style.display = 'none';
    } else if (scopeSelect.value === 'product') {
      if (targetCategoryGroup) targetCategoryGroup.style.display = 'none';
      if (targetProductGroup) targetProductGroup.style.display = 'block';
    } else {
      if (targetCategoryGroup) targetCategoryGroup.style.display = 'none';
      if (targetProductGroup) targetProductGroup.style.display = 'none';
    }
  }

  if (typeSelect) typeSelect.addEventListener('change', handleDiscountTypeChange);
  if (scopeSelect) scopeSelect.addEventListener('change', handleScopeChange);

  function populateCategoriesSelect(selectedId = '') {
    if (!targetCategorySelect) return;
    targetCategorySelect.innerHTML = allCategories.map(cat => `
      <option value="${cat.id}" ${String(cat.id) === String(selectedId) ? 'selected' : ''}>
        ${escapeHTML(cat.name)} (ID: ${escapeHTML(cat.id)})
      </option>
    `).join('');
  }

  function populateProductsSelect(selectedId = '') {
    if (!targetProductSelect) return;
    targetProductSelect.innerHTML = allProducts.map(p => `
      <option value="${p.id}" ${String(p.id) === String(selectedId) ? 'selected' : ''}>
        ${escapeHTML(p.name)} - ${formatPrice(p.price)} (ID: ${escapeHTML(p.id)})
      </option>
    `).join('');
  }

  function openModal(mode = 'create', voucher = null) {
    if (!modal) return;
    modal.classList.remove('hidden');

    populateCategoriesSelect();
    populateProductsSelect();

    if (mode === 'create') {
      modalTitle.textContent = 'Tạo Mã Giảm Giá Mới (Chuẩn Phân Cấp)';
      form.reset();
      document.querySelector('#voucherFormId').value = '';
      if (typeSelect) typeSelect.value = 'percent';
      if (scopeSelect) scopeSelect.value = 'all';
      if (document.querySelector('#voucherMinOrderInput')) document.querySelector('#voucherMinOrderInput').value = '0';
      if (document.querySelector('#voucherUsageLimitInput')) document.querySelector('#voucherUsageLimitInput').value = '100';
      if (document.querySelector('#voucherActiveCheckbox')) document.querySelector('#voucherActiveCheckbox').checked = true;
      if (document.querySelector('#voucherExcludeSaleCheckbox')) document.querySelector('#voucherExcludeSaleCheckbox').checked = false;
      handleDiscountTypeChange();
      handleScopeChange();
    } else if (mode === 'edit' && voucher) {
      modalTitle.textContent = `Chỉnh Sửa Mã ${voucher.code} (Đã dùng: ${voucher.usedCount || 0} lượt)`;
      document.querySelector('#voucherFormId').value = voucher.id;
      document.querySelector('#voucherCodeInput').value = voucher.code || '';
      document.querySelector('#voucherNameInput').value = voucher.name || '';

      const isPercent = (voucher.discountType || 'percent') === 'percent';
      if (typeSelect) typeSelect.value = isPercent ? 'percent' : 'fixed';
      handleDiscountTypeChange();

      const val = voucher.discountValue ?? voucher.discountPercent ?? 0;
      if (valueInput) valueInput.value = val;
      if (maxDiscountInput) maxDiscountInput.value = voucher.maxDiscount || '';

      if (scopeSelect) scopeSelect.value = voucher.scope || 'all';
      handleScopeChange();

      const targetCatId = Array.isArray(voucher.targetCategoryIds) && voucher.targetCategoryIds.length > 0
        ? voucher.targetCategoryIds[0]
        : (voucher.targetCategoryId || '');
      populateCategoriesSelect(targetCatId);

      const targetProdId = Array.isArray(voucher.targetProductIds) && voucher.targetProductIds.length > 0
        ? voucher.targetProductIds[0]
        : (voucher.targetProductId || '');
      populateProductsSelect(targetProdId);

      if (document.querySelector('#voucherMinOrderInput')) {
        document.querySelector('#voucherMinOrderInput').value = voucher.minOrder || 0;
      }
      if (document.querySelector('#voucherUsageLimitInput')) {
        document.querySelector('#voucherUsageLimitInput').value = voucher.usageLimit || 100;
      }
      if (document.querySelector('#voucherStartDateInput')) {
        document.querySelector('#voucherStartDateInput').value = voucher.startDate || '';
      }
      if (document.querySelector('#voucherEndDateInput')) {
        document.querySelector('#voucherEndDateInput').value = voucher.endDate || '';
      }
      if (document.querySelector('#voucherDescInput')) {
        document.querySelector('#voucherDescInput').value = voucher.desc || '';
      }
      if (document.querySelector('#voucherExcludeSaleCheckbox')) {
        document.querySelector('#voucherExcludeSaleCheckbox').checked = Boolean(voucher.excludeSaleItems);
      }
      if (document.querySelector('#voucherActiveCheckbox')) {
        document.querySelector('#voucherActiveCheckbox').checked = Boolean(voucher.active);
      }
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  if (openAddBtn) openAddBtn.addEventListener('click', () => openModal('create'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Nút bật/tắt thiết lập Chiến Dịch Lễ
  const toggleCampaignBtn = document.querySelector('#toggleCampaignBtn');
  const campaignPanel = document.querySelector('#campaignBoosterPanel');
  if (toggleCampaignBtn && campaignPanel && !toggleCampaignBtn.dataset.bound) {
    toggleCampaignBtn.dataset.bound = 'true';
    toggleCampaignBtn.addEventListener('click', () => {
      const isHidden = campaignPanel.style.display === 'none' || !campaignPanel.style.display;
      campaignPanel.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.querySelector('#voucherFormId').value;
      const code = document.querySelector('#voucherCodeInput').value.trim().toUpperCase();
      const name = document.querySelector('#voucherNameInput').value.trim();
      const discountType = typeSelect ? typeSelect.value : 'percent';
      const discountValue = Number(valueInput.value) || 0;
      const maxDiscount = (discountType === 'percent' && maxDiscountInput && maxDiscountInput.value)
        ? Number(maxDiscountInput.value)
        : null;

      const scope = scopeSelect ? scopeSelect.value : 'all';
      const selectedCatId = targetCategorySelect ? targetCategorySelect.value : '';
      const selectedProdId = targetProductSelect ? targetProductSelect.value : '';
      const targetCategoryIds = scope === 'category' && selectedCatId ? [String(selectedCatId)] : [];
      const targetProductIds = scope === 'product' && selectedProdId ? [String(selectedProdId)] : [];

      const minOrder = Number(document.querySelector('#voucherMinOrderInput').value) || 0;
      const usageLimit = Number(document.querySelector('#voucherUsageLimitInput').value) || 100;
      const startDate = document.querySelector('#voucherStartDateInput').value || null;
      const endDate = document.querySelector('#voucherEndDateInput').value || null;
      const desc = document.querySelector('#voucherDescInput').value.trim();
      const excludeSaleItems = Boolean(document.querySelector('#voucherExcludeSaleCheckbox')?.checked);
      const active = Boolean(document.querySelector('#voucherActiveCheckbox')?.checked);

      // --- VALIDATION NGIÊM NGẶT (CHỐNG LỖI HỆ THỐNG) ---
      if (!code) {
        showToast('Vui lòng nhập Mã Voucher!', 'error');
        return;
      }
      if (!name) {
        showToast('Vui lòng nhập Tên chương trình ưu đãi!', 'error');
        return;
      }

      if (discountType === 'percent') {
        if (discountValue < 1 || discountValue > 100) {
          showToast('Mức giảm phần trăm phải nằm trong khoảng từ 1% đến 100%!', 'error');
          return;
        }
        if (maxDiscount !== null && maxDiscount <= 0) {
          showToast('Trần giảm giá tối đa phải lớn hơn 0đ!', 'error');
          return;
        }
      } else if (discountType === 'fixed') {
        if (discountValue <= 0) {
          showToast('Số tiền giảm cố định phải lớn hơn 0đ!', 'error');
          return;
        }
      }

      if (minOrder < 0) {
        showToast('Đơn hàng tối thiểu không thể là số âm!', 'error');
        return;
      }

      if (usageLimit < 1) {
        showToast('Giới hạn lượt dùng tối thiểu phải là 1!', 'error');
        return;
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
          showToast('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!', 'error');
          return;
        }
      }

      if (scope === 'category' && !selectedCatId) {
        showToast('Vui lòng chọn danh mục hoa áp dụng!', 'error');
        return;
      }

      if (scope === 'product' && !selectedProdId) {
        showToast('Vui lòng chọn mẫu hoa áp dụng!', 'error');
        return;
      }

      // Giữ nguyên số lượt dùng đã có nếu là sửa (Bảo vệ dữ liệu usedCount)
      let usedCount = 0;
      if (id) {
        const existing = allPromotions.find(v => String(v.id) === String(id));
        if (existing && typeof existing.usedCount === 'number') {
          usedCount = existing.usedCount;
        }
      }

      const voucherData = {
        code,
        name,
        discountType,
        discountValue,
        discountPercent: discountType === 'percent' ? discountValue : null, // tương thích ngược
        maxDiscount,
        scope,
        targetCategoryIds,
        targetProductIds,
        minOrder,
        excludeSaleItems,
        startDate,
        endDate,
        usageLimit,
        usedCount,
        desc: desc || `Giảm ${discountType === 'percent' ? discountValue + '%' : formatPrice(discountValue)} cho đơn từ ${formatPrice(minOrder)}`,
        active
      };

      try {
        if (id) {
          await updatePromotion(id, voucherData);
          showToast(`Đã cập nhật thành công voucher ${code}!`);
        } else {
          await createPromotion(voucherData);
          showToast(`Đã tạo voucher mới thành công: ${code}!`);
        }

        closeModal();
        allPromotions = await fetchAllPromotions();
        renderVouchersTable();
      } catch (err) {
        console.error('Lỗi khi lưu voucher:', err);
        showToast('Có lỗi xảy ra khi lưu voucher: ' + err.message, 'error');
      }
    });
  }

  if (table) {
    table.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-voucher-btn');
      const deleteBtn = e.target.closest('.delete-voucher-btn');

      if (editBtn) {
        const id = editBtn.dataset.id;
        const voucher = allPromotions.find(v => String(v.id) === String(id));
        if (voucher) openModal('edit', voucher);
      } else if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        openConfirmModal('voucher', id, 'Bạn có chắc chắn muốn xóa mã giảm giá này không?');
      }
    });

    table.addEventListener('change', async (e) => {
      const toggle = e.target.closest('.voucher-active-toggle');
      if (toggle) {
        const id = toggle.dataset.id;
        const active = toggle.checked;
        try {
          await updatePromotion(id, { active });
          allPromotions = await fetchAllPromotions();
          showToast(active ? 'Đã kích hoạt mã giảm giá' : 'Đã tạm dừng mã giảm giá', 'success');
        } catch (err) {
          toggle.checked = !active;
          showToast('Không thể cập nhật trạng thái: ' + (err.response?.data?.error?.message || err.message), 'error');
        }
      }
    });
  }
}

// ==========================================================================
// 9. TAB 5: QUẢN LÝ ĐƠN HÀNG (ORDERS MANAGEMENT + PHÂN TRANG + XUẤT HÓA ĐƠN PDF + SMART SELLER ACTIONS)
// (isUnpaidSepayOrder được import từ ./business-rules.js)
// ==========================================================================
function renderOrderSegmentedTabs() {
  const container = document.querySelector('#orderSegmentedTabs');
  if (!container) return;

  const unpaidSepayCount = allOrders.filter(o => o.status === 'pending' && isUnpaidSepayOrder(o)).length;
  const pendingCount = allOrders.filter(o => o.status === 'pending' && !isUnpaidSepayOrder(o)).length;
  const confirmedCount = allOrders.filter(o => o.status === 'confirmed').length;
  const shippingCount = allOrders.filter(o => o.status === 'shipping').length;
  const completedCount = allOrders.filter(o => o.status === 'completed').length;
  const cancelledCount = allOrders.filter(o => o.status === 'cancelled').length;
  const needsRefundCount = allOrders.filter(orderNeedsRefund).length;
  const refundedCount = allOrders.filter(o => String(o.paymentStatus || '').toLowerCase() === 'refunded').length;

  container.innerHTML = `
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'all' ? 'active' : ''}" data-segment="all">
      Tất cả <span class="tab-count">${allOrders.length}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'pending' ? 'active' : ''}" data-segment="pending" style="color: #D97706;">
      Chờ duyệt <span class="tab-count" style="background: rgba(245,158,11,0.15); color: #D97706;">${pendingCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'unpaid_sepay' ? 'active' : ''}" data-segment="unpaid_sepay" style="color: #92400E;">
      Chờ TT SePay <span class="tab-count" style="background: rgba(180,83,9,0.12); color: #92400E;">${unpaidSepayCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'confirmed' ? 'active' : ''}" data-segment="confirmed" style="color: #0284C7;">
      Đã xác nhận <span class="tab-count" style="background: rgba(2,132,199,0.15); color: #0284C7;">${confirmedCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'shipping' ? 'active' : ''}" data-segment="shipping" style="color: #6366F1;">
      Đang giao <span class="tab-count" style="background: rgba(99,102,241,0.15); color: #6366F1;">${shippingCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'completed' ? 'active' : ''}" data-segment="completed" style="color: #108474;">
      Đã giao <span class="tab-count" style="background: rgba(16,132,116,0.15); color: #108474;">${completedCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'cancelled' ? 'active' : ''}" data-segment="cancelled" style="color: #EF4444;">
      Đã hủy <span class="tab-count" style="background: rgba(239,68,68,0.15); color: #EF4444;">${cancelledCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'needs_refund' ? 'active' : ''}" data-segment="needs_refund" style="color: #DC2626;">
      Cần hoàn tiền <span class="tab-count" style="background: rgba(220,38,38,0.15); color: #DC2626;">${needsRefundCount}</span>
    </button>
    <button type="button" class="segmented-tab ${selectedOrderSegment === 'refunded' ? 'active' : ''}" data-segment="refunded" style="color: #047857;">
      Đã hoàn tiền <span class="tab-count" style="background: rgba(16,185,129,0.15); color: #047857;">${refundedCount}</span>
    </button>
  `;

  container.querySelectorAll('.segmented-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedOrderSegment = btn.dataset.segment;
      ordersPagination.currentPage = 1;
      renderOrdersTable();
    });
  });
}

function renderOrdersTable() {
  const tbody = document.querySelector('#adminOrdersTable');
  const searchInput = document.querySelector('#orderSearchInput');
  const sortSelect = document.querySelector('#orderSortSelect');
  const deliveryDateFilter = document.querySelector('#orderDeliveryDateFilter');
  if (!tbody) return;

  renderOrderSegmentedTabs();

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const sortType = sortSelect ? sortSelect.value : 'default';
  const selectedDeliveryDate = deliveryDateFilter ? deliveryDateFilter.value.trim() : '';

  let filtered = allOrders.filter(o => {
    const idStr = String(o.id || o.orderCode || o.order_code || '').toLowerCase();
    const nameStr = String(o.customerName || o.customer_name || '').toLowerCase();
    const phoneStr = String(o.phone || o.customerPhone || o.customer_phone || '').toLowerCase();
    const matchSearch = idStr.includes(searchTerm) || nameStr.includes(searchTerm) || phoneStr.includes(searchTerm);
    const matchSegment = (selectedOrderSegment === 'all')
      || (selectedOrderSegment === 'unpaid_sepay' && o.status === 'pending' && isUnpaidSepayOrder(o))
      || (selectedOrderSegment === 'pending' && o.status === 'pending' && !isUnpaidSepayOrder(o))
      || (selectedOrderSegment === 'needs_refund' && orderNeedsRefund(o))
      || (selectedOrderSegment === 'refunded' && String(o.paymentStatus || '').toLowerCase() === 'refunded')
      || (!['all', 'unpaid_sepay', 'pending', 'needs_refund', 'refunded'].includes(selectedOrderSegment) && o.status === selectedOrderSegment);

    let matchDeliveryDate = true;
    if (selectedDeliveryDate) {
      const orderDelivDate = String(o.deliveryDate || o.delivery_date || '').trim();
      matchDeliveryDate = orderDelivDate === selectedDeliveryDate;
    }

    return matchSearch && matchSegment && matchDeliveryDate;
  });

  if (sortType === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (sortType === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } else if (sortType === 'delivery-asc') {
    filtered.sort((a, b) => String(a.deliveryDate || a.delivery_date || '9999').localeCompare(String(b.deliveryDate || b.delivery_date || '9999')));
  } else if (sortType === 'delivery-desc') {
    filtered.sort((a, b) => String(b.deliveryDate || b.delivery_date || '').localeCompare(String(a.deliveryDate || a.delivery_date || '')));
  } else if (sortType === 'total-desc') {
    filtered.sort((a, b) => (Number(b.totalAmount || b.total) || 0) - (Number(a.totalAmount || a.total) || 0));
  } else if (sortType === 'total-asc') {
    filtered.sort((a, b) => (Number(a.totalAmount || a.total) || 0) - (Number(b.totalAmount || b.total) || 0));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">Không tìm thấy đơn hàng nào phù hợp</td></tr>`;
    renderPaginationControls({
      containerId: 'ordersPagination',
      totalItems: 0,
      currentPage: 1,
      limit: ordersPagination.limit
    });
    return;
  }

  // Áp dụng thuật toán phân trang
  const totalItems = filtered.length;
  const limit = ordersPagination.limit;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  if (ordersPagination.currentPage > totalPages) {
    ordersPagination.currentPage = totalPages;
  }

  const startIndex = (ordersPagination.currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const pagedOrders = filtered.slice(startIndex, endIndex);

  tbody.innerHTML = pagedOrders.map(o => {
    let badgeClass = 'badge-emerald';
    let statusText = 'Hoàn thành';
    if (o.status === 'pending') { badgeClass = 'badge-amber'; statusText = 'Chờ xử lý'; }
    else if (o.status === 'confirmed') { badgeClass = 'badge-blue'; statusText = 'Đã xác nhận'; }
    else if (o.status === 'shipping') { badgeClass = 'badge-blue'; statusText = 'Đang giao hàng'; }
    else if (o.status === 'cancelled') { badgeClass = 'badge-rose'; statusText = 'Đã hủy đơn'; }

    const isSepay = o.paymentMethod === 'sepay';
    const isPaid = isOrderPaid(o);
    const isUnpaidSepay = isUnpaidSepayOrder(o);
    const isRefunded = String(o.paymentStatus || '').toLowerCase() === 'refunded';
    const isAnonymous = Boolean(o.isAnonymous || o.is_anonymous);

    if (o.status === 'pending' && isUnpaidSepay) {
      statusText = 'Chờ khách TT';
    } else if (orderNeedsRefund(o)) {
      statusText = 'Cần hoàn tiền';
      badgeClass = 'badge-rose';
    }

    // Nút 1-Click thao tác nhanh theo chuẩn Seller Center (chặn duyệt/giao đơn SePay chưa thanh toán)
    let quickActionBtn = '';
    const safeOrderId = escapeHTML(o.id);
    if (o.status === 'pending') {
      if (isUnpaidSepay) {
        quickActionBtn = `<span class="badge-pill" title="Chờ khách quét VietQR thanh toán trước khi duyệt" style="background: rgba(245, 158, 11, 0.12); color: #92400E; border: 1px solid rgba(245, 158, 11, 0.25); font-size: 11px; padding: 4px 8px; white-space: nowrap;">Chờ VietQR</span>`;
      } else {
        quickActionBtn = `<button type="button" class="btn-inline-action btn-quick-approve" data-id="${safeOrderId}" data-action="confirm" title="1-Click Duyệt đơn ngay">✓ Duyệt</button>`;
      }
    } else if (o.status === 'confirmed' && !isUnpaidSepay) {
      quickActionBtn = `<button type="button" class="btn-inline-action btn-quick-ship" data-id="${safeOrderId}" data-action="ship" title="1-Click Giao cho shipper">Giao hàng</button>`;
    } else if (o.status === 'shipping' && !isUnpaidSepay) {
      quickActionBtn = `<button type="button" class="btn-inline-action btn-quick-approve" data-id="${safeOrderId}" data-action="complete" title="1-Click Xác nhận khách đã nhận">✓ Hoàn tất</button>`;
    }

    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : '--';
    const itemCount = (o.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    const paymentBadge = isRefunded
      ? `<span class="badge-pill" style="background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; font-weight: 700;">Đã hoàn tiền</span>`
      : (isSepay
        ? `<span class="badge-pill" style="background: rgba(142, 30, 45, 0.08); color: #8e1e2d; border: 1px solid rgba(142, 30, 45, 0.2); font-weight: 600;">SePay (${isPaid ? 'Đã TT' : 'Chờ'})</span>`
        : `<span class="badge-pill" style="background: rgba(217, 119, 6, 0.08); color: #b45309; border: 1px solid rgba(217, 119, 6, 0.2); font-weight: 600;">COD</span>`);

    const customerBadge = isAnonymous
      ? `<span class="badge-pill" style="background: #FFF1F2; color: #E11D48; border: 1px solid #FECDD3; font-size: 10px; margin-left: 5px; font-weight: 700; white-space: nowrap;" title="Khách đặt quà tặng giấu tên người gửi">🎁 Quà bí mật</span>`
      : '';

    const exportLabel = o.status === 'cancelled'
      ? 'Đã hủy'
      : (isPaid ? 'In Hóa Đơn' : 'In Phiếu Đơn');
    const exportTitle = o.status === 'cancelled'
      ? 'Đơn đã hủy không phải hóa đơn bán hàng'
      : (isPaid ? 'Xuất hóa đơn bán hàng PDF (Đã thanh toán)' : 'In phiếu đơn nội bộ phục vụ đóng gói/giao hàng (Chưa thu tiền)');
    const exportBtnHtml = o.status === 'cancelled'
      ? `<button type="button" class="btn-action" disabled title="${exportTitle}" style="opacity: 0.45; cursor: not-allowed;">${exportLabel}</button>`
      : `<button type="button" class="btn-action export-pdf-row-btn" data-id="${safeOrderId}" title="${exportTitle}" style="background: rgba(16, 132, 116, 0.08); color: #108474; border-color: rgba(16, 132, 116, 0.25); font-weight: 600;">${exportLabel}</button>`;

    const giftSlipBtnHtml = o.status === 'cancelled'
      ? ''
      : `<button type="button" class="btn-action export-gift-slip-row-btn" data-id="${safeOrderId}" title="In Phiếu Giao Quà Tặng cho người nhận (ẩn giá tiền, ẩn người gửi nếu là quà bí mật)" style="background: rgba(225, 29, 72, 0.08); color: #E11D48; border-color: rgba(225, 29, 72, 0.25); font-weight: 600;">🎁 Phiếu Quà</button>`;

    return `
      <tr data-id="${safeOrderId}">
        <td><strong style="white-space: nowrap;">#${escapeHTML(o.orderCode || o.id)}</strong></td>
        <td><strong>${escapeHTML(o.customerName || 'Khách Vãng Lai')}</strong>${customerBadge}</td>
        <td>${escapeHTML(o.phone || '--')}</td>
        <td>
          <div>${dateStr}</div>
          ${(o.deliveryDate || o.delivery_date) ? `
            <div style="font-size: 11px; color: #0D9488; font-weight: 600; margin-top: 2px;" title="Ngày hẹn giao hoa: ${escapeHTML(o.deliveryDate || o.delivery_date)}">
              📅 ${escapeHTML(o.deliveryDate || o.delivery_date)}
            </div>
          ` : `
            <div style="font-size: 10.5px; color: #94A3B8; margin-top: 2px;">Giao ngay</div>
          `}
        </td>
        <td><strong style="color: var(--color-primary);">${formatPrice(o.totalAmount)}</strong> <span style="font-size: 11.5px; color: var(--text-muted);">(${itemCount} bó hoa)</span></td>
        <td>${paymentBadge}</td>
        <td><span class="badge-pill badge-live-dot ${badgeClass}"><span class="dot-pulse"></span>${statusText}</span></td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
            ${quickActionBtn}
            <button type="button" class="btn-action view-order-btn" data-id="${safeOrderId}">Chi Tiết</button>
            ${giftSlipBtnHtml}
            ${exportBtnHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Vẽ thanh phân trang đơn hàng
  renderPaginationControls({
    containerId: 'ordersPagination',
    totalItems: totalItems,
    currentPage: ordersPagination.currentPage,
    limit: ordersPagination.limit,
    onPageChange: (newPage) => {
      ordersPagination.currentPage = newPage;
      renderOrdersTable();
    },
    onLimitChange: (newLimit) => {
      ordersPagination.limit = newLimit;
      ordersPagination.currentPage = 1;
      renderOrdersTable();
    }
  });
}

function initOrderManagement() {
  const table = document.querySelector('#adminOrdersTable');
  const searchInput = document.querySelector('#orderSearchInput');
  const statusFilter = document.querySelector('#orderStatusFilter');
  const modal = document.querySelector('#orderDetailModal');
  const closeBtn = document.querySelector('#orderDetailModalClose');
  const titleEl = document.querySelector('#orderDetailTitle');
  const bodyEl = document.querySelector('#orderDetailBody');
  const statusSelect = document.querySelector('#orderDetailStatusSelect');
  const saveStatusBtn = document.querySelector('#saveOrderStatusBtn');
  const exportInvoiceBtn = document.querySelector('#btnExportInvoicePdf');
  const exportGiftSlipBtn = document.querySelector('#btnExportGiftDeliverySlipPdf');

  const STATUS_LABELS = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang giao hàng',
    completed: 'Đã hoàn thành',
    cancelled: 'Đã hủy đơn'
  };

  const VALID_NEXT_STATUSES = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipping', 'cancelled'],
    shipping: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  };

  function openOrderDetail(order) {
    if (!modal || !order) return;
    currentDetailOrderId = order.id;
    if (titleEl) titleEl.textContent = `Chi Tiết Đơn Hàng #${order.orderCode || order.id}`;

    if (statusSelect) {
      let allowedNext = VALID_NEXT_STATUSES[order.status] || [];
      if (isUnpaidSepayOrder(order) && order.status !== 'cancelled') {
        allowedNext = allowedNext.filter(st => st === 'cancelled');
      }
      const isTerminal = allowedNext.length === 0;

      // Đổ động các tùy chọn trạng thái: trạng thái hiện tại + các trạng thái hợp lệ tiếp theo
      const allOptionKeys = [order.status, ...allowedNext.filter(s => s !== order.status)];
      statusSelect.innerHTML = allOptionKeys.map(st => `
        <option value="${st}" ${st === order.status ? 'selected' : ''}>
          ${STATUS_LABELS[st] || st} ${st === order.status ? '(Hiện tại)' : ''}
        </option>
      `).join('');

      statusSelect.disabled = isTerminal;
      if (saveStatusBtn) {
        saveStatusBtn.disabled = isTerminal;
        saveStatusBtn.title = isTerminal ? 'Đơn hàng ở trạng thái kết thúc, không thể thay đổi' : 'Lưu cập nhật trạng thái';
        saveStatusBtn.style.opacity = isTerminal ? '0.5' : '1';
        saveStatusBtn.style.cursor = isTerminal ? 'not-allowed' : 'pointer';
      }
    }

    if (bodyEl) {
      const safeItemImage = value => {
        const candidate = String(value || './images/300.webp');
        return escapeHTML(candidate.startsWith('/') || candidate.startsWith('./') || /^https?:\/\//i.test(candidate) ? candidate : './images/300.webp');
      };
      const itemsHtml = (order.items || []).map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--border-light);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${safeItemImage(item.image)}" alt="${escapeHTML(item.name)}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;">
            <div>
              <div style="font-weight: 700; font-size: 13.5px;">${escapeHTML(item.name)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${formatPrice(item.price)} × ${item.quantity}</div>
              ${item.addonsText || (Array.isArray(item.addons) && item.addons.length > 0) ? `<div style="font-size: 11.5px; color: var(--color-primary-dark); margin-top: 2px;">+ Phụ kiện: ${escapeHTML(item.addonsText || item.addons.map(a => `${a.name} (+${formatPrice(a.price)})`).join(', '))}</div>` : ''}
            </div>
          </div>
          <strong>${formatPrice(item.price * item.quantity)}</strong>
        </div>
      `).join('');

      const isSepay = order.paymentMethod === 'sepay';
      const isPaid = isOrderPaid(order);
      const isUnpaidSepay = isUnpaidSepayOrder(order);
      const isRefunded = String(order.paymentStatus || '').toLowerCase() === 'refunded';
      const orderTxs = Array.isArray(order.paymentTransactions) ? order.paymentTransactions : [];
      const orderRefunds = Array.isArray(order.refundRequests) ? order.refundRequests : [];
      const pendingRefund = orderRefunds.find(r => r.status === 'pending_approval');
      const approvedRefund = orderRefunds.find(r => r.status === 'approved');
      const canCreateRefund = !isRefunded && !pendingRefund && (
        String(order.paymentStatus || '').toLowerCase() === 'paid' ||
        String(order.paymentStatus || '').toLowerCase() === 'partially_refunded' ||
        orderTxs.length > 0
      );
      const isAdminRole = currentUser?.role === 'admin';

      const paymentStatusHtml = isRefunded
        ? '<span style="color: #047857; font-weight: 700;">✓ Đã hoàn tiền (Refunded)</span>'
        : (String(order.paymentStatus || '').toLowerCase() === 'partially_refunded'
          ? '<span style="color: #0284C7; font-weight: 700;">✓ Hoàn một phần (Partially Refunded)</span>'
          : (isPaid
            ? '<span style="color: #16a34a; font-weight: 700;">✓ Đã thanh toán (Paid)</span>'
            : (isSepay
              ? '<span style="color: #d97706; font-weight: 700;">Chờ khách chuyển khoản VietQR (SePay)</span>'
              : '<span style="color: #d97706; font-weight: 700;">Chờ thanh toán / Thu hộ (COD)</span>')));
      const paymentMethodText = isSepay ? 'Chuyển khoản nhanh SePay (VietQR)' : 'Tiền mặt khi nhận hoa (COD)';

      const refundSectionHtml = `
        ${order.status === 'cancelled' && orderTxs.length > 0 && !isRefunded ? `
          <div style="margin-top: 8px; padding: 10px 14px; background: rgba(217, 45, 32, 0.08); border: 1px solid rgba(217, 45, 32, 0.25); border-radius: 8px; color: #D92D20; font-size: 13px; font-weight: 600;">
            Cảnh báo hoàn tiền: Đơn đã hủy có nhận chuyển khoản SePay (${formatPrice(orderTxs[0].amount)} — Mã GD: ${escapeHTML(orderTxs[0].providerTxId || orderTxs[0].provider_tx_id || '')}). Cần thu ngân lập phiếu và Admin duyệt hoàn tiền.
          </div>
        ` : ''}
        ${pendingRefund ? `
          <div style="margin-top: 8px; padding: 10px 14px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; font-size: 12.5px; color: #92400E;">
            <div style="font-weight: 700; margin-bottom: 4px;">Phiếu hoàn tiền #${escapeHTML(pendingRefund.id)} đang chờ Admin duyệt</div>
            <div>Số tiền: <strong>${formatPrice(pendingRefund.amount)}</strong> • Thu ngân đề nghị: ${escapeHTML(pendingRefund.requestedByName || 'Thu ngân')}</div>
            <div>Lý do: ${escapeHTML(pendingRefund.reason)}${pendingRefund.bankInfo ? ` • STK: ${escapeHTML(pendingRefund.bankInfo)}` : ''}</div>
            ${isAdminRole ? `
              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button type="button" class="btn-primary btn-modal-approve-refund" data-refund-id="${escapeHTML(pendingRefund.id)}" style="padding: 5px 12px; font-size: 12px;">Admin: Duyệt Hoàn Tiền</button>
                <button type="button" class="btn-action text-danger btn-modal-reject-refund" data-refund-id="${escapeHTML(pendingRefund.id)}" style="padding: 5px 12px; font-size: 12px;">Từ Chối</button>
              </div>
            ` : `<div style="margin-top: 6px; font-style: italic;">(Bạn đang đăng nhập vai trò Thu ngân — chỉ Quản trị viên mới được duyệt hoàn tiền)</div>`}
          </div>
        ` : ''}
        ${approvedRefund ? `
          <div style="margin-top: 8px; padding: 10px 14px; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; font-size: 12.5px; color: #065F46;">
            <strong>Đã hoàn tiền ${formatPrice(approvedRefund.amount)}</strong> — Duyệt bởi: ${escapeHTML(approvedRefund.reviewedByName || 'Admin')}${approvedRefund.refundTxRef ? ` (Mã GD hoàn: ${escapeHTML(approvedRefund.refundTxRef)})` : ''}.
          </div>
        ` : ''}
        ${canCreateRefund ? `
          <div style="margin-top: 8px;">
            <button type="button" class="btn-secondary btn-modal-create-refund" data-order-id="${escapeHTML(order.id)}" style="padding: 6px 12px; font-size: 12.5px; font-weight: 600; color: #D92D20; border-color: rgba(217, 45, 32, 0.35);">
              Thu ngân: Lập Phiếu Đề Nghị Hoàn Tiền
            </button>
          </div>
        ` : ''}
      `;

      bodyEl.innerHTML = `
        <div style="background-color: var(--color-bg); padding: 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; line-height: 1.7;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div><strong>Người đặt:</strong> ${escapeHTML(order.customerName || 'Khách Vãng Lai')}</div>
            <div><strong>Số điện thoại:</strong> ${escapeHTML(order.phone || '--')}</div>
            ${order.isGift && order.recipientName ? `
              <div><strong>Người nhận hoa:</strong> <span style="color: var(--color-primary); font-weight: 600;">${escapeHTML(order.recipientName)}</span></div>
              <div><strong>SĐT người nhận:</strong> ${escapeHTML(order.recipientPhone || '---')}</div>
            ` : ''}
            <div><strong>Khung giờ giao:</strong> ${escapeHTML(order.deliverySlot || 'Trong ngày')}</div>
            <div><strong>Ngày hẹn giao:</strong> <span style="color: #0D9488; font-weight: 700;">📅 ${escapeHTML(order.deliveryDate || order.delivery_date || 'Giao ngay trong ngày')}</span></div>
            <div><strong>Thời gian đặt:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</div>
            ${(order.isAnonymous || order.is_anonymous) ? `
              <div style="grid-column: 1 / -1; margin-top: 4px; padding: 6px 12px; background: #FFF1F2; border: 1px solid #FECDD3; border-radius: 6px; color: #BE185D; font-size: 12.5px; font-weight: 600;">
                🎁 Đơn Hàng Quà Tặng Bí Mật: Khách hàng chọn giấu danh tính khi giao hoa tới người nhận.
              </div>
            ` : ''}
          </div>
          <div style="border-top: 1px dashed var(--border-light); padding-top: 8px; margin-top: 8px;">
            <div><strong>Địa chỉ giao hoa:</strong> ${escapeHTML(order.address || '')}</div>
            <div><strong>Hình thức thanh toán:</strong> ${paymentMethodText} &mdash; ${paymentStatusHtml}</div>
            ${isUnpaidSepay && order.status !== 'cancelled' ? `
              <div id="unpaidSepayAdminGuardBanner" style="margin-top: 8px; padding: 10px 14px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; color: #92400E; font-size: 13px; font-weight: 600;">
                Đơn hàng SePay này đang chờ khách hàng chuyển khoản. Hệ thống khóa nút duyệt, giao hàng và hoàn tất cho đến khi ngân hàng đối soát nhận tiền.
              </div>
            ` : ''}
            ${refundSectionHtml}
            ${order.hasGreetingCard || order.cardMessage ? `
              <div style="margin-top: 4px; padding: 6px 10px; background: rgba(142, 30, 45, 0.05); border-radius: 6px; border-left: 3px solid var(--color-primary);">
                <strong>Thiệp chúc mừng viết tay:</strong> ${order.cardMessage ? `"${escapeHTML(order.cardMessage)}"` : 'Có yêu cầu thiệp mừng kèm bó hoa'}
              </div>
            ` : ''}
            ${order.note ? `<div><strong>Ghi chú đơn hàng:</strong> ${escapeHTML(order.note)}</div>` : ''}
          </div>
        </div>

        <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 8px;">Danh Sách Mẫu Hoa Đã Đặt:</h4>
        <div style="margin-bottom: 16px;">
          ${itemsHtml}
        </div>

        <div style="font-size: 13.5px; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between;">
            <span>Tạm tính tiền hoa:</span>
            <span>${formatPrice(order.subtotal ?? order.totalAmount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Phí vận chuyển:</span>
            <span>${Number(order.shippingFee || 0) > 0 ? formatPrice(order.shippingFee) : 'Miễn phí'}</span>
          </div>
          ${order.discountAmount ? `
            <div style="display: flex; justify-content: space-between; color: var(--color-sale-price); font-weight: 600;">
              <span>Giảm giá voucher:</span>
              <span>-${formatPrice(order.discountAmount)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 1px solid var(--border-light); padding-top: 6px; margin-top: 6px;">
            <span>Tổng thanh toán:</span>
            <span style="color: var(--color-primary);">${formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      `;
    }

    if (exportInvoiceBtn) {
      const paid = isOrderPaid(order);
      const isCancelled = order.status === 'cancelled';
      exportInvoiceBtn.disabled = isCancelled;
      exportInvoiceBtn.style.opacity = isCancelled ? '0.45' : '1';
      exportInvoiceBtn.style.cursor = isCancelled ? 'not-allowed' : 'pointer';
      exportInvoiceBtn.textContent = isCancelled
        ? 'Không Xuất Hóa Đơn'
        : (paid ? 'Xuất Hóa Đơn PDF' : 'In Phiếu Đơn PDF');
      exportInvoiceBtn.title = isCancelled
        ? 'Đơn đã hủy không phải hóa đơn bán hàng'
        : (paid ? 'Xuất hóa đơn bán hàng PDF' : 'In phiếu đơn nội bộ (chưa thanh toán)');
    }

    if (exportGiftSlipBtn) {
      const isCancelled = order.status === 'cancelled';
      exportGiftSlipBtn.disabled = isCancelled;
      exportGiftSlipBtn.style.opacity = isCancelled ? '0.45' : '1';
      exportGiftSlipBtn.style.cursor = isCancelled ? 'not-allowed' : 'pointer';
    }

    modal.classList.remove('hidden');
  }

  function closeOrderDetail() {
    if (modal) modal.classList.add('hidden');
    currentDetailOrderId = null;
  }

  if (closeBtn) closeBtn.addEventListener('click', closeOrderDetail);

  // Sự kiện Xuất Hóa Đơn PDF (Dành cho Kế toán & Quản trị)
  if (exportInvoiceBtn) {
    exportInvoiceBtn.addEventListener('click', () => {
      const order = allOrders.find(o => String(o.id) === String(currentDetailOrderId));
      if (order && order.status === 'cancelled') {
        showToast('Đơn hàng đã hủy không được xuất hóa đơn bán hàng!', 'error');
        return;
      }
      if (order) {
        exportOrderInvoicePdf(order);
      } else {
        showToast('Không tìm thấy thông tin đơn hàng!', 'error');
      }
    });
  }

  // Sự kiện In Phiếu Giao Quà Tặng (Dành cho Người nhận & Shipper: Ẩn giá, ẩn người gửi nếu bí mật)
  if (exportGiftSlipBtn) {
    exportGiftSlipBtn.addEventListener('click', () => {
      const order = allOrders.find(o => String(o.id) === String(currentDetailOrderId));
      if (order && order.status === 'cancelled') {
        showToast('Đơn hàng đã hủy không thể in phiếu giao quà tặng!', 'error');
        return;
      }
      if (order) {
        exportGiftDeliverySlipPdf(order);
      } else {
        showToast('Không tìm thấy thông tin đơn hàng!', 'error');
      }
    });
  }

  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', async () => {
      if (!currentDetailOrderId) return;
      const newStatus = statusSelect.value;
      const targetOrder = allOrders.find(o => String(o.id) === String(currentDetailOrderId));
      if (targetOrder && targetOrder.status === newStatus) {
        showToast('Trạng thái không thay đổi', 'info');
        closeOrderDetail();
        return;
      }
      const originalText = saveStatusBtn.textContent;
      try {
        saveStatusBtn.disabled = true;
        saveStatusBtn.textContent = 'Đang lưu...';
        await updateOrderStatus(currentDetailOrderId, newStatus);
        showToast(`Đã cập nhật đơn #${currentDetailOrderId} sang ${STATUS_LABELS[newStatus] || newStatus}!`, 'success');
        closeOrderDetail();
        allOrders = await fetchOrders();
        renderOrdersTable();
        renderDashboard();
      } catch (err) {
        console.error('Lỗi cập nhật trạng thái đơn:', err);
        const errMsg = err.response?.data?.error?.message || err.message || 'Không thể cập nhật trạng thái đơn hàng!';
        showToast(errMsg, 'error');
        allOrders = await fetchOrders();
        renderOrdersTable();
        renderDashboard();
      } finally {
        saveStatusBtn.disabled = false;
        saveStatusBtn.textContent = originalText;
      }
    });
  }

  if (table) {
    table.addEventListener('click', async (e) => {
      const inlineBtn = e.target.closest('.btn-inline-action');
      const viewBtn = e.target.closest('.view-order-btn');

      if (inlineBtn) {
        e.stopPropagation();
        const id = inlineBtn.dataset.id;
        const action = inlineBtn.dataset.action;
        let newStatus = 'confirmed';
        let actionLabel = 'Duyệt đơn';
        if (action === 'ship') { newStatus = 'shipping'; actionLabel = 'Chuyển sang giao hàng'; }
        else if (action === 'complete') { newStatus = 'completed'; actionLabel = 'Hoàn tất đơn hàng'; }

        const originalText = inlineBtn.textContent;
        try {
          inlineBtn.disabled = true;
          inlineBtn.textContent = '...';
          await updateOrderStatus(id, newStatus);
          allOrders = await fetchOrders();
          showToast(`Đã ${actionLabel} thành công cho đơn #${id}!`, 'success');
          renderDashboard();
          renderOrderSegmentedTabs();
          renderOrdersTable();
        } catch (err) {
          console.error('Lỗi cập nhật trạng thái đơn:', err);
          const errMsg = err.response?.data?.error?.message || err.message || 'Không thể cập nhật trạng thái đơn hàng!';
          showToast(errMsg, 'error');
          allOrders = await fetchOrders();
          renderOrdersTable();
          renderDashboard();
        } finally {
          inlineBtn.disabled = false;
          inlineBtn.textContent = originalText;
        }
        return;
      }

      const exportPdfBtn = e.target.closest('.export-pdf-row-btn');

      if (exportPdfBtn) {
        e.stopPropagation();
        if (exportPdfBtn.disabled) return;
        const id = exportPdfBtn.dataset.id;
        const order = allOrders.find(o => String(o.id) === String(id));
        if (order && order.status !== 'cancelled') {
          exportOrderInvoicePdf(order);
        } else if (order) {
          showToast('Đơn hàng đã hủy không được xuất hóa đơn bán hàng!', 'error');
        } else {
          showToast('Không tìm thấy thông tin đơn hàng!', 'error');
        }
        return;
      }

      const exportGiftSlipRowBtn = e.target.closest('.export-gift-slip-row-btn');

      if (exportGiftSlipRowBtn) {
        e.stopPropagation();
        const id = exportGiftSlipRowBtn.dataset.id;
        const order = allOrders.find(o => String(o.id) === String(id));
        if (order && order.status !== 'cancelled') {
          exportGiftDeliverySlipPdf(order);
        } else if (order) {
          showToast('Đơn hàng đã hủy không thể in phiếu giao quà tặng!', 'error');
        } else {
          showToast('Không tìm thấy thông tin đơn hàng!', 'error');
        }
        return;
      }

      if (viewBtn) {
        const id = viewBtn.dataset.id;
        const order = allOrders.find(o => String(o.id) === String(id));
        if (order) openOrderDetail(order);
      }
    });
  }

  if (searchInput) searchInput.addEventListener('input', () => {
    ordersPagination.currentPage = 1;
    renderOrdersTable();
  });
  if (statusFilter) statusFilter.addEventListener('change', () => {
    ordersPagination.currentPage = 1;
    renderOrdersTable();
  });
  const deliveryDateFilter = document.querySelector('#orderDeliveryDateFilter');
  if (deliveryDateFilter) {
    deliveryDateFilter.addEventListener('change', () => {
      ordersPagination.currentPage = 1;
      renderOrdersTable();
    });
  }
  const orderSortSelect = document.querySelector('#orderSortSelect');
  if (orderSortSelect) orderSortSelect.addEventListener('change', () => {
    ordersPagination.currentPage = 1;
    renderOrdersTable();
  });

  // Cho phép Dashboard mở thẳng Modal Chi tiết đơn hàng
  openOrderDetailHandler = openOrderDetail;

  // Bắt sự kiện Thu ngân lập phiếu hoàn tiền / Admin duyệt hoàn tiền ngay trong Modal Chi tiết đơn
  if (bodyEl && !bodyEl.dataset.refundBound) {
    bodyEl.dataset.refundBound = 'true';
    bodyEl.addEventListener('click', (e) => {
      const createBtn = e.target.closest('.btn-modal-create-refund');
      if (createBtn) {
        const ord = allOrders.find(o => String(o.id) === String(createBtn.dataset.orderId));
        if (ord) openRefundActionModal('create', ord);
        return;
      }
      const approveBtn = e.target.closest('.btn-modal-approve-refund');
      if (approveBtn) {
        const ref = allRefunds.find(r => String(r.id) === String(approveBtn.dataset.refundId));
        if (ref) openRefundActionModal('approve', ref);
        return;
      }
      const rejectBtn = e.target.closest('.btn-modal-reject-refund');
      if (rejectBtn) {
        const ref = allRefunds.find(r => String(r.id) === String(rejectBtn.dataset.refundId));
        if (ref) openRefundActionModal('reject', ref);
      }
    });
  }
}

// ==========================================================================
// 10. MODAL XÁC NHẬN XÓA (CONFIRM DIALOG)
// ==========================================================================
function openConfirmModal(type, id, message) {
  const modal = document.querySelector('#confirmModal');
  const descEl = document.querySelector('#confirmModalDesc');
  deleteTarget = { type, id };
  if (descEl && message) descEl.textContent = message;
  if (modal) modal.classList.remove('hidden');
}

function initConfirmModal() {
  const modal = document.querySelector('#confirmModal');
  const cancelBtn = document.querySelector('#confirmCancelBtn');
  const okBtn = document.querySelector('#confirmOkBtn');

  function close() {
    if (modal) modal.classList.add('hidden');
    deleteTarget = { type: null, id: null };
  }

  if (cancelBtn) cancelBtn.addEventListener('click', close);

  if (okBtn) {
    okBtn.addEventListener('click', async () => {
      const { type, id } = deleteTarget;
      close();

      if (type === 'product') {
        try {
          await deleteProduct(id);
          allProducts = await fetchProducts({ activeOnly: false });
          renderProductSegmentedTabs();
          renderProductsTable();
          renderDashboard();
          showToast(`Đã xóa mẫu hoa #${id} thành công!`, 'success');
        } catch (err) {
          console.error('Lỗi khi xóa mẫu hoa:', err);
          const errMsg = err.response?.data?.error?.message || err.message || 'Không thể xóa mẫu hoa này!';
          showToast(errMsg, 'error');
        }
      } else if (type === 'banner') {
        await deleteBanner(id);
        allBanners = await fetchAllBanners();
        renderBannersTable();
        showToast(`Đã xóa banner #${id}!`);
      } else if (type === 'voucher') {
        try {
          await deletePromotion(id);
          allPromotions = await fetchAllPromotions();
          renderVouchersTable();
          showToast(`Đã xóa mã voucher thành công!`, 'success');
        } catch (err) {
          showToast('Lỗi khi xóa mã voucher: ' + (err.response?.data?.error?.message || err.message), 'error');
        }
      } else if (type === 'review') {
        try {
          await deleteProductReview(id);
          showToast('Đã xóa đánh giá thành công!', 'success');
          await renderReviewsTable();
        } catch (err) {
          showToast('Lỗi khi xóa đánh giá: ' + (err.response?.data?.error?.message || err.message), 'error');
        }
      }
    });
  }
}

// ==========================================================================
// 10B. TAB 5B: QUẢN LÝ & DUYỆT HOÀN TIỀN 2 CẤP (THU NGÂN STAFF -> ADMIN)
// ==========================================================================
async function fetchAllRefunds() {
  try {
    const res = await refundApi.getAll();
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.warn('Lỗi tải danh sách hoàn tiền:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

function openRefundActionModal(mode, target) {
  const modal = document.querySelector('#refundActionModal');
  const titleEl = document.querySelector('#refundActionModalTitle');
  const modeInput = document.querySelector('#refundModalMode');
  const targetIdInput = document.querySelector('#refundModalTargetId');
  const summaryEl = document.querySelector('#refundModalOrderSummary');
  const createFields = document.querySelector('#refundCreateFields');
  const reviewFields = document.querySelector('#refundReviewFields');
  const txRefWrap = document.querySelector('#refundTxRefWrap');
  const restockWrap = document.querySelector('#refundRestockWrap');
  const restockCheckbox = document.querySelector('#refundRestockCheckbox');
  const amountInput = document.querySelector('#refundAmountInput');
  const bankInfoInput = document.querySelector('#refundBankInfoInput');
  const reasonInput = document.querySelector('#refundReasonInput');
  const txRefInput = document.querySelector('#refundTxRefInput');
  const adminNoteInput = document.querySelector('#refundAdminNoteInput');
  const submitBtn = document.querySelector('#refundActionSubmitBtn');

  if (!modal || !target) return;
  modeInput.value = mode;
  targetIdInput.value = target.id;

  if (mode === 'create') {
    if (titleEl) titleEl.textContent = `Thu Ngân Lập Phiếu Hoàn Tiền #${target.orderCode || target.id}`;
    if (createFields) createFields.classList.remove('hidden');
    if (reviewFields) reviewFields.classList.add('hidden');
    if (restockWrap) restockWrap.classList.add('hidden');
    if (summaryEl) {
      summaryEl.innerHTML = `<strong>Đơn hàng #${escapeHTML(target.orderCode || target.id)}</strong> • Khách: ${escapeHTML(target.customerName || '')} (${escapeHTML(target.phone || '')})<br>Tổng giá trị đơn: <strong style="color: #108474;">${formatPrice(target.totalAmount)}</strong>`;
    }
    if (amountInput) {
      amountInput.value = Number(target.totalAmount || 0);
      amountInput.max = Number(target.totalAmount || 0);
    }
    if (bankInfoInput) bankInfoInput.value = '';
    if (reasonInput) reasonInput.value = target.status === 'cancelled'
      ? 'Đơn đã hủy nhưng ghi nhận chuyển khoản, đề nghị hoàn trả khách hàng'
      : 'Khách yêu cầu hoàn tiền đơn hàng';
    if (submitBtn) {
      submitBtn.textContent = 'Gửi Phiếu Chờ Admin Duyệt';
      submitBtn.style.background = '#108474';
    }
  } else if (mode === 'approve') {
    if (titleEl) titleEl.textContent = `Admin Duyệt Hoàn Tiền #${target.id}`;
    if (createFields) createFields.classList.add('hidden');
    if (reviewFields) reviewFields.classList.remove('hidden');
    if (txRefWrap) txRefWrap.classList.remove('hidden');
    if (restockWrap) {
      restockWrap.classList.remove('hidden');
      if (restockCheckbox) {
        restockCheckbox.checked = false;
        const ord = target.order || allOrders.find(o => String(o.id) === String(target.orderId || target.order_id));
        const isShippingOrCompleted = ord && (ord.status === 'shipping' || ord.status === 'completed');
        if (isShippingOrCompleted) {
          restockWrap.style.background = '#FEF3C7';
          restockWrap.style.borderColor = '#FCD34D';
        } else {
          restockWrap.style.background = '#F0FDF4';
          restockWrap.style.borderColor = '#BBF7D0';
        }
      }
    }
    if (summaryEl) {
      summaryEl.innerHTML = `<strong>Phiếu #${escapeHTML(target.id)}</strong> (Đơn #${escapeHTML(target.orderCode)})<br>Số tiền duyệt hoàn: <strong style="color: #108474;">${formatPrice(target.amount)}</strong><br>Lý do Thu ngân gửi: ${escapeHTML(target.reason)}${target.bankInfo ? `<br>STK nhận: ${escapeHTML(target.bankInfo)}` : ''}`;
    }
    if (txRefInput) txRefInput.value = '';
    if (adminNoteInput) adminNoteInput.value = 'Đã kiểm tra giao dịch và duyệt hoàn tiền';
    if (submitBtn) {
      submitBtn.textContent = 'Xác Nhận Duyệt Hoàn Tiền';
      submitBtn.style.background = '#108474';
    }
  } else {
    if (titleEl) titleEl.textContent = `Admin Từ Chối Phiếu Hoàn #${target.id}`;
    if (createFields) createFields.classList.add('hidden');
    if (reviewFields) reviewFields.classList.remove('hidden');
    if (txRefWrap) txRefWrap.classList.add('hidden');
    if (restockWrap) restockWrap.classList.add('hidden');
    if (summaryEl) {
      summaryEl.innerHTML = `<strong>Phiếu #${escapeHTML(target.id)}</strong> (Đơn #${escapeHTML(target.orderCode)}) • Số tiền: <strong>${formatPrice(target.amount)}</strong>`;
    }
    if (adminNoteInput) adminNoteInput.value = '';
    if (submitBtn) {
      submitBtn.textContent = 'Xác Nhận Từ Chối';
      submitBtn.style.background = '#DC2626';
    }
  }

  modal.classList.remove('hidden');
}

function renderRefundsTab() {
  const tbody = document.querySelector('#adminRefundsTable');
  const pendingCountEl = document.querySelector('#refundSummaryPendingCount');
  const pendingAmtEl = document.querySelector('#refundSummaryPendingAmount');
  const approvedCountEl = document.querySelector('#refundSummaryApprovedCount');
  const approvedAmtEl = document.querySelector('#refundSummaryApprovedAmount');
  const unreqCountEl = document.querySelector('#refundSummaryUnrequestedCount');
  const tabsWrap = document.querySelector('#refundSegmentedTabs');

  updateNavRefundBadge();

  const pendingList = allRefunds.filter(r => r.status === 'pending_approval');
  const approvedList = allRefunds.filter(r => r.status === 'approved');
  const unrequestedOrders = allOrders.filter(orderNeedsRefund).filter(o => {
    const hasOpen = Array.isArray(o.refundRequests) && o.refundRequests.some(r => r.status === 'pending_approval');
    return !hasOpen;
  });

  if (pendingCountEl) pendingCountEl.textContent = `${pendingList.length} phiếu`;
  if (pendingAmtEl) pendingAmtEl.textContent = `Tổng tiền chờ hoàn: ${formatPrice(pendingList.reduce((s, r) => s + Number(r.amount || 0), 0))}`;
  if (approvedCountEl) approvedCountEl.textContent = `${approvedList.length} phiếu`;
  if (approvedAmtEl) approvedAmtEl.textContent = `Tổng đã hoàn: ${formatPrice(approvedList.reduce((s, r) => s + Number(r.amount || 0), 0))}`;
  if (unreqCountEl) unreqCountEl.textContent = `${unrequestedOrders.length} đơn`;

  if (tabsWrap) {
    tabsWrap.querySelectorAll('[data-refund-status]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.refundStatus === selectedRefundSegment);
    });
  }

  if (!tbody) return;
  const filtered = selectedRefundSegment === 'all'
    ? allRefunds
    : allRefunds.filter(r => r.status === selectedRefundSegment);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">Chưa có phiếu yêu cầu hoàn tiền nào trong mục này</td></tr>`;
    return;
  }

  const isAdminRole = currentUser?.role === 'admin';
  tbody.innerHTML = filtered.map(r => {
    let statusBadge = `<span class="badge-pill badge-amber">Chờ Admin duyệt</span>`;
    if (r.status === 'approved') statusBadge = `<span class="badge-pill badge-emerald">Đã duyệt hoàn tiền</span>`;
    else if (r.status === 'rejected') statusBadge = `<span class="badge-pill badge-rose">Đã từ chối</span>`;

    const actionHtml = r.status === 'pending_approval'
      ? (isAdminRole
        ? `<div style="display: flex; gap: 6px; justify-content: flex-end;">
             <button type="button" class="btn-inline-action btn-quick-approve btn-refund-approve" data-id="${escapeHTML(r.id)}">✓ Duyệt</button>
             <button type="button" class="btn-action text-danger btn-refund-reject" data-id="${escapeHTML(r.id)}">Từ chối</button>
           </div>`
        : `<span style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">Chờ Admin duyệt</span>`)
      : `<span style="font-size: 11.5px; color: var(--text-muted);">${r.refundTxRef ? `GD: ${escapeHTML(r.refundTxRef)}` : 'Đã khóa'}</span>`;

    return `
      <tr>
        <td><strong>#${escapeHTML(r.id)}</strong><div style="font-size: 11px; color: var(--text-muted);">${new Date(r.requestedAt).toLocaleString('vi-VN')}</div></td>
        <td>
          <strong>#${escapeHTML(r.orderCode)}</strong>
          <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHTML(r.order?.customerName || '')} • ${escapeHTML(r.order?.customerPhone || '')}</div>
        </td>
        <td style="font-weight: 800; color: #DC2626;">${formatPrice(r.amount)}</td>
        <td style="max-width: 240px;">
          <div style="font-size: 12.5px;">${escapeHTML(r.reason)}</div>
          ${r.bankInfo ? `<div style="font-size: 11.5px; color: #0284C7; margin-top: 2px;">STK: ${escapeHTML(r.bankInfo)}</div>` : ''}
        </td>
        <td>${escapeHTML(r.requestedByName || 'Thu ngân')}</td>
        <td>
          ${statusBadge}
          ${r.reviewedByName ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Bởi: ${escapeHTML(r.reviewedByName)}</div>` : ''}
          ${r.adminNote ? `<div style="font-size: 11px; color: var(--text-secondary);">"${escapeHTML(r.adminNote)}"</div>` : ''}
        </td>
        <td style="text-align: right;">${actionHtml}</td>
      </tr>
    `;
  }).join('');
}

function initRefundManagement() {
  const tabsWrap = document.querySelector('#refundSegmentedTabs');
  const tbody = document.querySelector('#adminRefundsTable');
  const modal = document.querySelector('#refundActionModal');
  const closeBtn = document.querySelector('#refundActionCloseBtn');
  const cancelBtn = document.querySelector('#refundActionCancelBtn');
  const form = document.querySelector('#refundActionForm');

  if (tabsWrap && !tabsWrap.dataset.bound) {
    tabsWrap.dataset.bound = 'true';
    tabsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-refund-status]');
      if (!btn) return;
      selectedRefundSegment = btn.dataset.refundStatus;
      renderRefundsTab();
    });
  }

  if (tbody && !tbody.dataset.bound) {
    tbody.dataset.bound = 'true';
    tbody.addEventListener('click', (e) => {
      const approveBtn = e.target.closest('.btn-refund-approve');
      if (approveBtn) {
        const ref = allRefunds.find(r => String(r.id) === String(approveBtn.dataset.id));
        if (ref) openRefundActionModal('approve', ref);
        return;
      }
      const rejectBtn = e.target.closest('.btn-refund-reject');
      if (rejectBtn) {
        const ref = allRefunds.find(r => String(r.id) === String(rejectBtn.dataset.id));
        if (ref) openRefundActionModal('reject', ref);
      }
    });
  }

  const closeRefundModal = () => modal?.classList.add('hidden');
  if (closeBtn) closeBtn.onclick = closeRefundModal;
  if (cancelBtn) cancelBtn.onclick = closeRefundModal;

  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = document.querySelector('#refundModalMode')?.value;
      const targetId = document.querySelector('#refundModalTargetId')?.value;
      const submitBtn = document.querySelector('#refundActionSubmitBtn');
      const originalText = submitBtn?.textContent || 'Xác nhận';

      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang xử lý...'; }

        if (mode === 'create') {
          const amount = Number(document.querySelector('#refundAmountInput')?.value || 0);
          const bankInfo = document.querySelector('#refundBankInfoInput')?.value?.trim() || '';
          const reason = document.querySelector('#refundReasonInput')?.value?.trim() || '';
          await refundApi.create({ orderId: targetId, amount, bankInfo, reason });
          showToast('Thu ngân đã lập phiếu đề nghị hoàn tiền, chờ Admin duyệt!', 'success');
        } else if (mode === 'approve') {
          const refundTxRef = document.querySelector('#refundTxRefInput')?.value?.trim() || '';
          const adminNote = document.querySelector('#refundAdminNoteInput')?.value?.trim() || '';
          const restock = Boolean(document.querySelector('#refundRestockCheckbox')?.checked);
          await refundApi.approve(targetId, { refundTxRef, adminNote, restock });
          showToast(`Admin đã duyệt hoàn tiền thành công!${restock ? ' (Đã nhập lại hoa vào kho)' : ''}`, 'success');
        } else if (mode === 'reject') {
          const adminNote = document.querySelector('#refundAdminNoteInput')?.value?.trim() || '';
          if (adminNote.length < 2) {
            showToast('Vui lòng nhập lý do từ chối phiếu hoàn tiền!', 'warning');
            return;
          }
          await refundApi.reject(targetId, { adminNote });
          showToast('Đã từ chối phiếu hoàn tiền!', 'info');
        }

        closeRefundModal();
        document.querySelector('#orderDetailModal')?.classList.add('hidden');
        const [orders, refunds] = await Promise.all([fetchOrders(), fetchAllRefunds()]);
        allOrders = orders;
        allRefunds = refunds;
        renderRefundsTab();
        renderOrdersTable();
        renderDashboard();
        if (currentTab === 'statistics') renderStatistics();
      } catch (err) {
        showToast(err.response?.data?.error?.message || err.message || 'Lỗi xử lý hoàn tiền', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
      }
    });
  }
}

// ==========================================================================
// 11. TAB 6: BÁO CÁO & THỐNG KÊ DOANH SỐ - DOANH THU - MẶT HÀNG (NGÀY / THÁNG / NĂM)
// ==========================================================================
function syncStatsYearOptions() {
  const yearSelect = document.querySelector('#statsYearSelect');
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, currentYear - 1]);
  allOrders.forEach(o => {
    const raw = o?.createdAt || o?.created_at;
    if (raw) {
      const y = new Date(raw).getFullYear();
      if (Number.isFinite(y)) years.add(y);
    }
  });
  const sortedYears = [...years].sort((a, b) => b - a);
  yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
  if (!sortedYears.includes(Number(statsFilter.year))) {
    statsFilter.year = currentYear;
  }
  yearSelect.value = String(statsFilter.year);
}

function getEffectiveDateRangeForStats() {
  const { periodType, year, monthIndex, fromDate, toDate } = statsFilter;
  if (periodType === 'day') {
    return {
      fromDate: fromDate || toLocalDateKey(new Date()),
      toDate: toDate || fromDate || toLocalDateKey(new Date()),
      title: fromDate === toDate
        ? `Ngày ${fromDate.split('-').reverse().join('/')}`
        : `${fromDate.split('-').reverse().join('/')} → ${toDate.split('-').reverse().join('/')}`
    };
  }
  if (periodType === 'month') {
    if (monthIndex !== 'all' && Number(monthIndex) >= 1 && Number(monthIndex) <= 12) {
      const m = Number(monthIndex);
      const first = toLocalDateKey(new Date(Number(year), m - 1, 1));
      const last = toLocalDateKey(new Date(Number(year), m, 0));
      return { fromDate: first, toDate: last, title: `Tháng ${m}/${year}` };
    }
    return { fromDate: `${year}-01-01`, toDate: `${year}-12-31`, title: `12 Tháng Năm ${year}` };
  }
  if (periodType === 'quarter') {
    return { fromDate: `${year}-01-01`, toDate: `${year}-12-31`, title: `4 Quý Năm ${year}` };
  }
  return { fromDate: '', toDate: '', title: 'Tất Cả Các Năm' };
}

function buildCurrentStatsPayload() {
  const range = getEffectiveDateRangeForStats();
  const statsData = calculateRevenueStats(allOrders, statsFilter.periodType, statsFilter.year, {
    fromDate: range.fromDate,
    toDate: range.toDate,
    monthIndex: statsFilter.monthIndex,
    products: allProducts
  });
  const productStats = aggregateProductDeliveryAndRevenue(allOrders, allProducts, allCategories, {
    fromDate: range.fromDate,
    toDate: range.toDate
  });
  const ordersInRange = (range.fromDate || range.toDate)
    ? filterOrdersByDateRange(allOrders, range.fromDate, range.toDate)
    : [...allOrders];
  const dayMonthYearSummary = getDayMonthYearSummary(allOrders);

  return {
    statsData,
    productStats,
    ordersInRange,
    periodType: statsFilter.periodType,
    fromDate: range.fromDate,
    toDate: range.toDate,
    periodTitle: range.title,
    dayMonthYearSummary
  };
}

function renderStatistics() {
  syncStatsYearOptions();

  const periodTypeSelect = document.querySelector('#statsPeriodType');
  const dateRangeWrap = document.querySelector('#statsDateRangeWrap');
  const monthWrap = document.querySelector('#statsMonthWrap');
  const yearWrap = document.querySelector('#statsYearWrap');
  const dateFromInput = document.querySelector('#statsDateFrom');
  const dateToInput = document.querySelector('#statsDateTo');
  const monthSelect = document.querySelector('#statsMonthSelect');
  const activeScopeEl = document.querySelector('#statsActiveScopeLabel');

  if (periodTypeSelect) periodTypeSelect.value = statsFilter.periodType;
  if (dateFromInput) dateFromInput.value = statsFilter.fromDate;
  if (dateToInput) dateToInput.value = statsFilter.toDate;
  if (monthSelect) monthSelect.value = String(statsFilter.monthIndex);

  if (dateRangeWrap) dateRangeWrap.style.display = statsFilter.periodType === 'day' ? 'inline-flex' : 'none';
  if (monthWrap) monthWrap.style.display = statsFilter.periodType === 'month' ? 'inline-flex' : 'none';
  if (yearWrap) yearWrap.style.display = (statsFilter.periodType === 'month' || statsFilter.periodType === 'quarter') ? 'inline-flex' : 'none';

  const payload = buildCurrentStatsPayload();
  const { statsData, productStats, ordersInRange, periodTitle, dayMonthYearSummary, fromDate, toDate } = payload;

  if (activeScopeEl) activeScopeEl.textContent = `Đang xem: ${periodTitle}`;

  // 1. Dải Tóm tắt Ngày / Tháng / Năm độc lập
  const setDmy = (id, text) => { const el = document.querySelector(id); if (el) el.textContent = text; };
  setDmy('#dmyTodayDateBadge', dayMonthYearSummary.today.label);
  setDmy('#dmyTodayRev', formatPrice(dayMonthYearSummary.today.revenue));
  setDmy('#dmyTodayMeta', `Doanh số: ${formatPrice(dayMonthYearSummary.today.gmv)} • ${dayMonthYearSummary.today.gmvOrderCount} đặt / ${dayMonthYearSummary.today.orderCount} giao`);

  setDmy('#dmyMonthBadge', dayMonthYearSummary.month.label);
  setDmy('#dmyMonthRev', formatPrice(dayMonthYearSummary.month.revenue));
  setDmy('#dmyMonthMeta', `Doanh số: ${formatPrice(dayMonthYearSummary.month.gmv)} • ${dayMonthYearSummary.month.gmvOrderCount} đặt / ${dayMonthYearSummary.month.orderCount} giao`);

  setDmy('#dmyYearBadge', dayMonthYearSummary.year.label);
  setDmy('#dmyYearRev', formatPrice(dayMonthYearSummary.year.revenue));
  setDmy('#dmyYearMeta', `Doanh số: ${formatPrice(dayMonthYearSummary.year.gmv)} • ${dayMonthYearSummary.year.gmvOrderCount} đặt / ${dayMonthYearSummary.year.orderCount} giao`);

  // 2. 4 Thẻ KPI cân 1 hàng
  const totalGmvOrders = statsData.reduce((s, r) => s + Number(r.gmvOrderCount || 0), 0);
  const totalGmv = statsData.reduce((s, r) => s + Number(r.gmv || 0), 0);
  const totalOrders = statsData.reduce((s, r) => s + Number(r.orderCount || 0), 0);
  const totalRev = statsData.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalCost = statsData.reduce((s, r) => s + Number(r.cost || 0), 0);
  const totalProfit = statsData.reduce((s, r) => s + Number(r.profit || 0), 0);
  const refundedInScope = ordersInRange
    .filter(o => String(o.paymentStatus || '').toLowerCase() === 'refunded')
    .reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  setDmy('#statCompletedOrders', `${totalOrders} / ${totalGmvOrders}`);
  setDmy('#statAovSub', `AOV hoàn tất: ${formatPrice(totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0)}`);
  setDmy('#statTotalGmv', formatPrice(totalGmv));
  setDmy('#statTotalRevenue', formatPrice(totalRev));
  setDmy('#statRefundedSub', `Đã hoàn tiền: ${formatPrice(refundedInScope)}`);
  setDmy('#statTotalProfit', formatPrice(totalProfit));
  setDmy('#statCostSub', `Giá vốn: ${formatPrice(totalCost)} • Biên ${totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0}%`);

  // 3. Phân bổ doanh thu theo danh mục (khớp doanh thu thực trong kỳ)
  const categoryBreakdownEl = document.querySelector('#statsCategoryRevenueBreakdown');
  if (categoryBreakdownEl) {
    const catList = calculateCategoryRevenueBreakdown(allOrders, allProducts, allCategories, { fromDate, toDate });
    categoryBreakdownEl.innerHTML = catList.map(cat => `
      <div class="cat-rev-item">
        <div class="cat-rev-meta">
          <span class="cat-rev-name">${escapeHTML(cat.categoryName)}</span>
          <span class="cat-rev-val">${formatPrice(cat.revenue)} (${cat.percent}%)</span>
        </div>
        <div class="cat-rev-bar">
          <div class="cat-rev-fill" style="width: ${cat.percent}%;"></div>
        </div>
      </div>
    `).join('');
  }

  // 4. Biểu đồ 3 chuỗi Doanh số / Doanh thu / Lợi nhuận đi theo Ngày / Tháng / Quý / Năm
  const chartHeading = document.querySelector('#statsChartHeading');
  if (chartHeading) chartHeading.textContent = `Biểu Đồ Doanh Số, Doanh Thu & Lợi Nhuận (${periodTitle})`;
  const chartWrap = document.querySelector('#statsBarChartWrap');
  if (chartWrap) {
    chartWrap.innerHTML = renderPeriodBarChartHtml(statsData, {
      heightPx: 165,
      showGmv: statsFilter.series.gmv,
      showRevenue: statsFilter.series.revenue,
      showProfit: statsFilter.series.profit,
      compact: false
    });
  }

  // 5. Bảng 1 — Doanh số & Doanh thu từng kỳ
  const periodTitleEl = document.querySelector('#statsPeriodTableTitle');
  if (periodTitleEl) periodTitleEl.textContent = `Bảng Chi Tiết Theo Kỳ (${periodTitle})`;

  const tbody = document.querySelector('#statsTableBody');
  const tfoot = document.querySelector('#statsTableFooter');
  if (tbody) {
    if (statsData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 28px; color: var(--text-muted);">Không có dữ liệu trong khoảng thời gian đã chọn</td></tr>`;
    } else {
      tbody.innerHTML = statsData.map(r => `
        <tr>
          <td><strong>${escapeHTML(r.label)}</strong></td>
          <td style="text-align: center;">${r.gmvOrderCount ?? r.orderCount}</td>
          <td style="text-align: right; font-weight: 600; color: #0284C7;">${formatPrice(r.gmv ?? r.revenue)}</td>
          <td style="text-align: center;">${r.orderCount}</td>
          <td style="text-align: right; font-weight: 700; color: #108474;">${formatPrice(r.revenue)}</td>
          <td style="text-align: right; color: #64748B;">${formatPrice(r.cost)}</td>
          <td style="text-align: right; font-weight: 700; color: #D97706;">${formatPrice(r.profit)}</td>
          <td style="text-align: center;"><span class="badge-pill badge-emerald">${r.margin}%</span></td>
        </tr>
      `).join('');
    }
  }
  if (tfoot) {
    const avgMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;
    tfoot.innerHTML = `
      <tr>
        <td>TỔNG CỘNG (${statsData.length} kỳ)</td>
        <td style="text-align: center;">${totalGmvOrders}</td>
        <td style="text-align: right; color: #0284C7;">${formatPrice(totalGmv)}</td>
        <td style="text-align: center;">${totalOrders}</td>
        <td style="text-align: right; color: #108474;">${formatPrice(totalRev)}</td>
        <td style="text-align: right; color: #64748B;">${formatPrice(totalCost)}</td>
        <td style="text-align: right; color: #D97706;">${formatPrice(totalProfit)}</td>
        <td style="text-align: center;">${avgMargin}%</td>
      </tr>
    `;
  }

  // 6. Bảng 2 — Thống Kê Mặt Hàng (Chưa giao / Đang giao / Đã giao / Doanh thu trong kỳ)
  renderStatsProductMatrix(productStats, periodTitle);
}

function renderStatsProductMatrix(productStats, periodTitle = '') {
  const titleEl = document.querySelector('#statsProductMatrixTitle');
  if (titleEl) titleEl.textContent = `Thống Kê Từng Mặt Hàng (${periodTitle})`;

  const catSelect = document.querySelector('#statsProductCategoryFilter');
  if (catSelect && catSelect.options.length <= 1 && allCategories.length > 0) {
    catSelect.innerHTML = `<option value="all">Tất cả danh mục</option>` +
      allCategories.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
    catSelect.value = statsProductFilter.categoryId;
  }

  const keyword = statsProductFilter.search.toLowerCase().trim();
  let list = (productStats || []).filter(item => {
    const matchName = !keyword || item.name.toLowerCase().includes(keyword) || item.productId.toLowerCase().includes(keyword);
    const matchCat = statsProductFilter.categoryId === 'all' || String(item.categoryId) === String(statsProductFilter.categoryId);
    let matchStatus = true;
    if (statsProductFilter.status === 'has-undelivered') matchStatus = item.undeliveredQty > 0;
    else if (statsProductFilter.status === 'has-shipping') matchStatus = item.shippingQty > 0;
    else if (statsProductFilter.status === 'has-delivered') matchStatus = item.deliveredQty > 0 || item.deliveredRevenue > 0;
    return matchName && matchCat && matchStatus;
  });

  list = [...list].sort((a, b) => {
    if (statsProductFilter.sort === 'delivered-desc') return b.deliveredQty - a.deliveredQty || b.deliveredRevenue - a.deliveredRevenue;
    if (statsProductFilter.sort === 'shipping-desc') return b.shippingQty - a.shippingQty || b.undeliveredQty - a.undeliveredQty;
    if (statsProductFilter.sort === 'undelivered-desc') return b.undeliveredQty - a.undeliveredQty || b.shippingQty - a.shippingQty;
    return b.deliveredRevenue - a.deliveredRevenue || b.deliveredQty - a.deliveredQty;
  });

  const tbody = document.querySelector('#statsProductMatrixBody');
  const tfoot = document.querySelector('#statsProductMatrixFooter');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 28px; color: var(--text-muted);">Không có mặt hàng nào khớp bộ lọc</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  const pill = (val, cls) => `<span class="qty-pill ${val > 0 ? cls : 'qty-pill-zero'}">${val}</span>`;

  tbody.innerHTML = list.map(item => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${safeAdminMediaUrl(item.image)}" alt="${escapeHTML(item.name)}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; flex-shrink: 0;" onerror="this.src='./images/300.webp'">
          <div>
            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${escapeHTML(item.name)}</div>
            <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHTML(item.categoryName)} • #${escapeHTML(item.productId)}</div>
          </div>
        </div>
      </td>
      <td style="text-align: center;">${pill(item.undeliveredQty, 'qty-pill-undelivered')}</td>
      <td style="text-align: center;">${pill(item.shippingQty, 'qty-pill-shipping')}</td>
      <td style="text-align: center;">${pill(item.deliveredQty, 'qty-pill-delivered')}</td>
      <td style="text-align: center;">${pill(item.cancelledQty, 'qty-pill-cancelled')}</td>
      <td style="text-align: right; font-weight: 700; color: #108474;">${formatPrice(item.deliveredRevenue)}</td>
      <td style="text-align: center;">
        <span style="font-weight: 700; color: ${item.stock <= 10 ? '#DC2626' : 'var(--text-main)'};">${item.stock}</span>
      </td>
    </tr>
  `).join('');

  if (tfoot) {
    const sumUndeliv = list.reduce((s, p) => s + p.undeliveredQty, 0);
    const sumShip = list.reduce((s, p) => s + p.shippingQty, 0);
    const sumDeliv = list.reduce((s, p) => s + p.deliveredQty, 0);
    const sumCancel = list.reduce((s, p) => s + p.cancelledQty, 0);
    const sumRev = list.reduce((s, p) => s + p.deliveredRevenue, 0);
    tfoot.innerHTML = `
      <tr>
        <td>TỔNG (${list.length} mặt hàng)</td>
        <td style="text-align: center; color: #92400E;">${sumUndeliv}</td>
        <td style="text-align: center; color: #0369A1;">${sumShip}</td>
        <td style="text-align: center; color: #166534;">${sumDeliv}</td>
        <td style="text-align: center; color: #B91C1C;">${sumCancel}</td>
        <td style="text-align: right; color: #108474;">${formatPrice(sumRev)}</td>
        <td style="text-align: center;">-</td>
      </tr>
    `;
  }
}

function applyStatsPreset(preset) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const todayKey = toLocalDateKey(now);

  statsFilter.preset = preset;

  if (preset === 'today') {
    statsFilter.periodType = 'day';
    statsFilter.fromDate = todayKey;
    statsFilter.toDate = todayKey;
  } else if (preset === 'yesterday') {
    const yKey = toLocalDateKey(new Date(yyyy, mm, now.getDate() - 1));
    statsFilter.periodType = 'day';
    statsFilter.fromDate = yKey;
    statsFilter.toDate = yKey;
  } else if (preset === '7days') {
    const r = getDefaultDateRange(6);
    statsFilter.periodType = 'day';
    statsFilter.fromDate = r.fromDate;
    statsFilter.toDate = r.toDate;
  } else if (preset === '30days') {
    const r = getDefaultDateRange(29);
    statsFilter.periodType = 'day';
    statsFilter.fromDate = r.fromDate;
    statsFilter.toDate = r.toDate;
  } else if (preset === 'thisMonth') {
    statsFilter.periodType = 'month';
    statsFilter.year = yyyy;
    statsFilter.monthIndex = String(mm + 1);
  } else if (preset === 'lastMonth') {
    const prev = new Date(yyyy, mm - 1, 1);
    statsFilter.periodType = 'month';
    statsFilter.year = prev.getFullYear();
    statsFilter.monthIndex = String(prev.getMonth() + 1);
  } else if (preset === 'thisYear') {
    statsFilter.periodType = 'month';
    statsFilter.year = yyyy;
    statsFilter.monthIndex = 'all';
  } else if (preset === 'allYears') {
    statsFilter.periodType = 'year';
  }

  document.querySelectorAll('#statsPresetBar .stats-preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });
  renderStatistics();
}

function initStatistics() {
  const presetBar = document.querySelector('#statsPresetBar');
  const periodTypeSelect = document.querySelector('#statsPeriodType');
  const dateFromInput = document.querySelector('#statsDateFrom');
  const dateToInput = document.querySelector('#statsDateTo');
  const monthSelect = document.querySelector('#statsMonthSelect');
  const yearSelect = document.querySelector('#statsYearSelect');
  const seriesGroup = document.querySelector('#statsSeriesToggleGroup');
  const exportPdfBtn = document.querySelector('#btnExportStatsPdf');
  const exportExcelBtn = document.querySelector('#btnExportStatsExcel');

  const prodSearch = document.querySelector('#statsProductSearch');
  const prodCat = document.querySelector('#statsProductCategoryFilter');
  const prodStatus = document.querySelector('#statsProductStatusFilter');
  const prodSort = document.querySelector('#statsProductSort');

  if (presetBar) {
    presetBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.stats-preset-btn');
      if (btn) applyStatsPreset(btn.dataset.preset);
    });
  }

  if (periodTypeSelect) {
    periodTypeSelect.addEventListener('change', () => {
      statsFilter.periodType = periodTypeSelect.value;
      statsFilter.preset = '';
      document.querySelectorAll('#statsPresetBar .stats-preset-btn').forEach(b => b.classList.remove('active'));
      renderStatistics();
    });
  }

  const handleDateChange = () => {
    const from = dateFromInput?.value || '';
    const to = dateToInput?.value || from;
    statsFilter.fromDate = from;
    statsFilter.toDate = to && from && to < from ? from : to;
    statsFilter.preset = '';
    document.querySelectorAll('#statsPresetBar .stats-preset-btn').forEach(b => b.classList.remove('active'));
    renderStatistics();
  };
  if (dateFromInput) dateFromInput.addEventListener('change', handleDateChange);
  if (dateToInput) dateToInput.addEventListener('change', handleDateChange);

  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      statsFilter.monthIndex = monthSelect.value;
      statsFilter.preset = '';
      document.querySelectorAll('#statsPresetBar .stats-preset-btn').forEach(b => b.classList.remove('active'));
      renderStatistics();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      statsFilter.year = Number(yearSelect.value);
      renderStatistics();
    });
  }

  if (seriesGroup) {
    seriesGroup.addEventListener('change', (e) => {
      const cb = e.target.closest('.stats-series-cb');
      if (!cb) return;
      statsFilter.series[cb.value] = cb.checked;
      renderStatistics();
    });
  }

  if (prodSearch) prodSearch.addEventListener('input', () => { statsProductFilter.search = prodSearch.value; renderStatistics(); });
  if (prodCat) prodCat.addEventListener('change', () => { statsProductFilter.categoryId = prodCat.value; renderStatistics(); });
  if (prodStatus) prodStatus.addEventListener('change', () => { statsProductFilter.status = prodStatus.value; renderStatistics(); });
  if (prodSort) prodSort.addEventListener('change', () => { statsProductFilter.sort = prodSort.value; renderStatistics(); });

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportRevenueStatisticsPdf(buildCurrentStatsPayload());
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      exportRevenueStatisticsExcel(buildCurrentStatsPayload());
    });
  }
}

// ==========================================================================
// 12. TAB 7: QUẢN LÝ TÀI KHOẢN & PUT CREDENTIALS BÀN GIAO (ADMIN)
// ==========================================================================
async function fetchAllUsers() {
  try {
    const res = await api.get('/api/admin/users');
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error('Lỗi tải danh sách người dùng:', err);
    return [];
  }
}

function renderUsersTable() {
  const tbody = document.querySelector('#adminUsersTableBody');
  const searchInput = document.querySelector('#userSearchInput');
  const roleFilter = document.querySelector('#userRoleFilter');
  if (!tbody) return;

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedRole = roleFilter ? roleFilter.value : 'all';

  const filtered = allUsers.filter(u => {
    const matchSearch = (u.name && u.name.toLowerCase().includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm));
    const uRole = u.role || 'customer';
    const matchRole = selectedRole === 'all' || uRole === selectedRole;
    return matchSearch && matchRole;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">Không tìm thấy tài khoản nào phù hợp</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((u, idx) => {
    const uRole = u.role || 'customer';
    let roleBadge = '<span class="badge-pill badge-emerald">Khách Hàng</span>';
    if (uRole === 'admin') {
      roleBadge = '<span class="badge-pill badge-rose">Quản Trị Viên</span>';
    } else if (uRole === 'staff') {
      roleBadge = '<span class="badge-pill badge-blue">Nhân Viên Kế Toán</span>';
    }

    const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo';

    return `
      <tr data-id="${escapeHTML(u.id)}">
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${escapeHTML(u.name || 'Người dùng')}</strong></td>
        <td><code>${escapeHTML(u.email)}</code></td>
        <td>${roleBadge}</td>
        <td>${dateStr}</td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
            <button type="button" class="btn-action btn-action-edit edit-user-btn" data-id="${escapeHTML(u.id)}">
              Chỉnh Sửa
            </button>
            <button type="button" class="btn-action btn-action-delete delete-user-btn" data-id="${escapeHTML(u.id)}">
              Xóa
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function initUserManagement() {
  const table = document.querySelector('#adminUsersTableBody');
  const searchInput = document.querySelector('#userSearchInput');
  const roleFilter = document.querySelector('#userRoleFilter');
  const addBtn = document.querySelector('#btnAddUserBtn');
  const modal = document.querySelector('#userEditModal');
  const closeBtn = document.querySelector('#userEditModalClose');
  const cancelBtn = document.querySelector('#userEditModalCancel');
  const form = document.querySelector('#userEditForm');
  const idInput = document.querySelector('#userEditId');
  const nameInput = document.querySelector('#userEditName');
  const emailInput = document.querySelector('#userEditEmail');
  const passwordInput = document.querySelector('#userEditPassword');
  const roleSelect = document.querySelector('#userEditRole');
  const roleHelp = document.querySelector('#userEditRoleHelp');
  const titleEl = document.querySelector('#userEditModalTitle');

  function openEditModal(user = null) {
    if (!modal) return;
    if (user) {
      if (titleEl) titleEl.textContent = `Chỉnh Sửa Tài Khoản: ${user.name}`;
      if (idInput) idInput.value = user.id;
      if (nameInput) nameInput.value = user.name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.required = false;
        passwordInput.placeholder = 'Để trống nếu không đổi, hoặc nhập mật khẩu mới';
      }
      if (roleSelect) roleSelect.value = '';
      if (roleHelp) {
        const currentRole = user.role || 'customer';
        const roleLabel = currentRole === 'admin'
          ? 'Quản trị viên (Admin)'
          : currentRole === 'staff'
            ? 'Nhân viên (Staff)'
            : 'Khách hàng (Customer)';
        roleHelp.textContent = `Vai trò hiện tại: ${roleLabel}. Chọn Admin hoặc Staff nếu cần cấp/đổi quyền nhân sự; để trống nếu giữ nguyên.`;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Thêm Tài Khoản Mới Vào Hệ Thống';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.required = true;
        passwordInput.placeholder = 'Mật khẩu khởi tạo (ít nhất 8 ký tự)';
      }
      if (roleSelect) roleSelect.value = '';
      if (roleHelp) roleHelp.textContent = 'Tài khoản tạo tại đây dành cho nhân sự. Khách hàng đăng ký tại trang Đăng ký.';
    }
    modal.classList.remove('hidden');
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (addBtn) addBtn.addEventListener('click', () => openEditModal(null));

  if (table) {
    table.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-user-btn');
      const deleteBtn = e.target.closest('.delete-user-btn');

      if (editBtn) {
        const id = editBtn.dataset.id;
        const user = allUsers.find(u => String(u.id) === String(id));
        if (user) openEditModal(user);
      }

      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống không?')) {
          try {
            await api.delete(`/api/admin/users/${id}`);
            showToast('Đã xóa tài khoản thành công!');
            allUsers = await fetchAllUsers();
            renderUsersTable();
          } catch (err) {
            console.error('Lỗi khi xóa tài khoản:', err);
            showToast('Không thể xóa tài khoản!', 'error');
          }
        }
      }
    });
  }

  // XỬ LÝ PUT CREDENTIALS BÀN GIAO TÀI KHOẢN
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = idInput.value;
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const newPassword = passwordInput.value.trim();
      const role = roleSelect.value;

      try {
        if (id) {
          const updatedUser = {
            name,
            ...(role ? { role } : {}),
            password: newPassword
          };

          await api.put(`/api/admin/users/${id}`, updatedUser);
          showToast(`Đã cập nhật thông tin tài khoản #${id} thành công!`, 'success');
        } else {
          if (!['admin', 'staff'].includes(role)) {
            showToast('Vui lòng chọn vai trò Admin hoặc Staff cho tài khoản nhân sự mới.', 'error');
            return;
          }
          // Tạo user mới bằng POST
          const newUser = {
            name,
            email,
            password: newPassword,
            role,
            createdAt: new Date().toISOString()
          };
          await api.post('/api/admin/users', newUser);
          showToast('Đã thêm tài khoản mới thành công!', 'success');
        }

        closeModal();
        allUsers = await fetchAllUsers();
        renderUsersTable();
      } catch (err) {
        console.error('Lỗi cập nhật tài khoản:', err);
        showToast(err.response?.data?.error?.message || 'Có lỗi xảy ra khi lưu thông tin tài khoản!', 'error');
      }
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderUsersTable);
  if (roleFilter) roleFilter.addEventListener('change', renderUsersTable);
}

// ==========================================================================
// 13. KHỞI TẠO TỔNG THỂ DỮ LIỆU BAN ĐẦU
// ==========================================================================
async function loadAllData() {
  try {
    const [categories, products, banners, promotions, orders, users, refunds] = await Promise.all([
      fetchCategories().catch(e => { console.warn('Lỗi nạp danh mục:', e); return []; }),
      fetchProducts({ activeOnly: false }).catch(e => { console.warn('Lỗi nạp sản phẩm:', e); return []; }),
      fetchAllBanners().catch(e => { console.warn('Lỗi nạp banners:', e); return []; }),
      fetchAllPromotions().catch(e => { console.warn('Lỗi nạp khuyến mãi:', e); return []; }),
      fetchOrders().catch(e => { console.warn('Lỗi nạp đơn hàng:', e); return []; }),
      fetchAllUsers().catch(e => { console.warn('Lỗi nạp người dùng:', e); return []; }),
      fetchAllRefunds().catch(e => { console.warn('Lỗi nạp hoàn tiền:', e); return []; })
    ]);

    allCategories = categories || [];
    allProducts = products || [];
    allBanners = banners || [];
    allPromotions = promotions || [];
    allOrders = orders || [];
    allUsers = users || [];
    allRefunds = refunds || [];

    // Khởi tạo các phân hệ
    initNavigation();
    initDropzones();
    initProductCrud();
    // Phân hệ Nhập Excel & Xuất PDF theo bài giảng của cô
    initExcelPdf({
      getProducts: () => {
        const searchInput = document.querySelector('#productSearchInput');
        const catFilter = document.querySelector('#productCategoryFilter');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCat = catFilter ? catFilter.value : 'all';

        return allProducts.filter(p => {
          const matchSearch = p.name.toLowerCase().includes(searchTerm) || String(p.id).includes(searchTerm);
          const matchCat = (selectedCat === 'all') || (String(p.categoryId) === String(selectedCat));
          return matchSearch && matchCat;
        });
      },
      getCategories: () => allCategories,
      onProductsImported: async () => {
        allProducts = await fetchProducts({ activeOnly: false });
        renderProductSegmentedTabs();
        renderProductsTable();
        renderDashboard();
      }
    });
    initBannerCrud();
    initVoucherCrud();
    initOrderManagement();
    initRefundManagement();
    initStatistics();
    initUserManagement();
    initConfirmModal();

    // Render tab ban đầu (Dashboard)
    renderDashboard();
  } catch (error) {
    console.error('Lỗi khởi tạo dữ liệu trang Admin:', error);
    showToast('Lỗi nạp dữ liệu quản trị, vui lòng kiểm tra kết nối!', 'error');
  }
}

// ==========================================================================
// 14. TAB 8: QUẢN LÝ ĐÁNH GIÁ & BÌNH LUẬN (ADMIN REVIEWS MANAGEMENT)
// ==========================================================================
let allAdminReviews = [];
let reviewFilterState = {
  search: '',
  rating: 'all',
  status: 'all'
};

async function renderReviewsTable() {
  const tbody = document.querySelector('#reviewsTableBody');
  const summaryBadge = document.querySelector('#reviewsSummaryBadge');
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">Đang tải dữ liệu đánh giá...</td></tr>`;
    allAdminReviews = await fetchProductReviews(); // Lấy tất cả đánh giá
  } catch (err) {
    console.error('Lỗi nạp đánh giá:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #DC2626;">Lỗi tải dữ liệu đánh giá: ${err.message}</td></tr>`;
    return;
  }

  const productsMap = new Map((allProducts || []).map(p => [String(p.id), p]));

  function applyFiltersAndRender() {
    let filtered = [...allAdminReviews];

    if (reviewFilterState.search) {
      const q = reviewFilterState.search.toLowerCase();
      filtered = filtered.filter(r =>
        (r.userName && r.userName.toLowerCase().includes(q)) ||
        (r.comment && r.comment.toLowerCase().includes(q)) ||
        (productsMap.get(String(r.productId))?.name.toLowerCase().includes(q))
      );
    }

    if (reviewFilterState.rating !== 'all') {
      if (reviewFilterState.rating === '1-2') {
        filtered = filtered.filter(r => Number(r.rating) <= 2);
      } else {
        filtered = filtered.filter(r => Number(r.rating) === Number(reviewFilterState.rating));
      }
    }

    if (reviewFilterState.status === 'unreplied') {
      filtered = filtered.filter(r => !r.reply);
    } else if (reviewFilterState.status === 'low_unreplied') {
      filtered = filtered.filter(r => Number(r.rating) <= 3 && !r.reply);
    } else if (reviewFilterState.status !== 'all') {
      filtered = filtered.filter(r => reviewFilterState.status === 'hidden' ? r.hidden : !r.hidden);
    }

    if (summaryBadge) {
      summaryBadge.textContent = `Tổng: ${filtered.length} / ${allAdminReviews.length} đánh giá`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">Không tìm thấy đánh giá nào phù hợp với bộ lọc</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((r, index) => {
      const prod = productsMap.get(String(r.productId));
      const prodName = prod ? prod.name : `Mã #${r.productId}`;
      const statusBadge = r.hidden
        ? `<span class="badge" style="background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Đã ẩn</span>`
        : `<span class="badge" style="background: #DCFCE7; color: #16A34A; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">Hiển thị</span>`;
      const isVerified = Boolean(r.isVerifiedBuyer || r.is_verified_buyer);
      const verifiedBadge = isVerified
        ? `<span class="badge" style="background: #ECFDF5; color: #047857; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; margin-left: 4px; font-weight: 600;" title="Đã mua hàng và nhận hoa thực tế">✓ Đã mua</span>`
        : '';
      const decodedComment = unescapeHTML(r.comment || '');
      const decodedReply = unescapeHTML(r.reply || '');
      const imagesHtml = (Array.isArray(r.images) && r.images.length > 0)
        ? `<div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">${r.images.map(img => `<a href="${escapeHTML(img)}" target="_blank" rel="noopener"><img src="${escapeHTML(img)}" alt="Ảnh đánh giá" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-light);"></a>`).join('')}</div>`
        : '';
      const helpfulCount = Number(r.helpfulCount || 0);
      const threadComments = Array.isArray(r.comments) ? r.comments : [];
      const threadHtml = threadComments.length > 0
        ? `<div style="margin-top: 6px; padding: 6px 8px; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: 4px; display: flex; flex-direction: column; gap: 5px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted);">Trao đổi qua lại (${threadComments.length}):</div>
            ${threadComments.map(c => `
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; font-size: 11.5px; color: var(--text-secondary);">
                <span><strong>${escapeHTML(c.userName || 'Khách')}:</strong> ${escapeHTML(unescapeHTML(c.content || ''))}</span>
                <button type="button" class="btn-action-small text-danger btn-admin-delete-thread-comment" data-review-id="${r.id}" data-comment-id="${c.id}" style="padding: 1px 6px; font-size: 10.5px; flex-shrink: 0;" title="Xóa phản hồi này">Xóa</button>
              </div>
            `).join('')}
          </div>`
        : '';

      return `
        <tr data-id="${r.id}">
          <td style="color: var(--text-muted); font-size: 12px;">${index + 1}</td>
          <td>
            <strong style="color: var(--text-main); font-size: 13px;">${escapeHTML(prodName)}</strong>
            <div style="font-size: 11px; color: var(--text-muted);">ID: #${r.productId}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 12.5px; display: flex; align-items: center; flex-wrap: wrap;">
              ${escapeHTML(r.userName || 'Khách Mua Hoa')}
              ${verifiedBadge}
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">${r.userId || 'Guest'}</div>
          </td>
          <td>
            <span style="color: #FF9900; font-weight: 700; font-size: 13px;">${'★'.repeat(r.rating || 5)}</span>
            <span style="font-size: 11.5px; color: var(--text-muted);"> (${r.rating}/5)</span>
            ${helpfulCount > 0 ? `<div style="font-size: 11px; color: var(--color-primary-dark); margin-top: 2px;">Hữu ích: ${helpfulCount}</div>` : ''}
            ${threadComments.length > 0 ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Trao đổi: ${threadComments.length}</div>` : ''}
          </td>
          <td style="max-width: 320px;">
            <p style="margin: 0; font-size: 12.5px; color: var(--text-secondary); line-height: 1.4; word-break: break-word;">${escapeHTML(decodedComment)}</p>
            ${imagesHtml}
            ${decodedReply ? `
              <div style="margin-top: 6px; padding: 6px 10px; background: #F0FDF4; border-left: 3px solid #108474; border-radius: 4px; font-size: 11.5px; color: #166534; line-height: 1.4;">
                <div style="font-weight: 700; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span>Phản hồi từ tiệm:</span>
                  <span style="font-size: 10px; color: #15803D; font-weight: 400;">${r.replyDate ? new Date(r.replyDate).toLocaleDateString('vi-VN') : ''}</span>
                </div>
                <div>${escapeHTML(decodedReply)}</div>
              </div>
            ` : ''}
            ${threadHtml}
          </td>
          <td style="font-size: 12px; color: var(--text-muted);">
            ${new Date(r.createdAt).toLocaleDateString('vi-VN')}
            ${r.editedAt ? `<div style="font-size: 10.5px; color: #64748B;">Đã sửa</div>` : ''}
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
              <button type="button" class="btn-action-small btn-reply-review" data-id="${r.id}" data-comment="${escapeHTML(decodedComment)}" data-author="${escapeHTML(r.userName || '')}" data-reply="${escapeHTML(decodedReply)}" title="${decodedReply ? 'Sửa phản hồi của shop' : 'Trả lời đánh giá'}">
                ${decodedReply ? 'Sửa reply' : 'Trả lời'}
              </button>
              <button type="button" class="btn-action-small btn-toggle-hide-review" data-id="${r.id}" title="${r.hidden ? 'Hiện đánh giá này' : 'Ẩn đánh giá này'}">
                ${r.hidden ? 'Hiện' : 'Ẩn'}
              </button>
              <button type="button" class="btn-action-small text-danger btn-delete-review" data-id="${r.id}" title="Xóa vĩnh viễn đánh giá">
                Xóa
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  applyFiltersAndRender();

  // Gắn sự kiện Search & Filter
  const searchInput = document.querySelector('#reviewSearchInput');
  const ratingFilter = document.querySelector('#reviewRatingFilter');
  const statusFilter = document.querySelector('#reviewStatusFilter');

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', (e) => {
      reviewFilterState.search = e.target.value.trim();
      applyFiltersAndRender();
    });
  }

  if (ratingFilter && !ratingFilter.dataset.bound) {
    ratingFilter.dataset.bound = 'true';
    ratingFilter.addEventListener('change', (e) => {
      reviewFilterState.rating = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (statusFilter && !statusFilter.dataset.bound) {
    statusFilter.dataset.bound = 'true';
    statusFilter.addEventListener('change', (e) => {
      reviewFilterState.status = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Delegation cho nút Ẩn/Hiện, Trả Lời và Xóa
  if (!tbody.dataset.bound) {
    tbody.dataset.bound = 'true';
    tbody.addEventListener('click', async (e) => {
      const replyBtn = e.target.closest('.btn-reply-review');
      if (replyBtn) {
        const id = replyBtn.dataset.id;
        const comment = replyBtn.dataset.comment;
        const author = replyBtn.dataset.author;
        const currentReply = replyBtn.dataset.reply || '';

        const modal = document.querySelector('#replyReviewModal');
        const authorEl = document.querySelector('#replyReviewAuthor');
        const commentEl = document.querySelector('#replyReviewCustomerComment');
        const inputEl = document.querySelector('#replyReviewInput');
        const confirmBtn = document.querySelector('#btnConfirmReplyReview');

        if (authorEl) authorEl.textContent = author;
        if (commentEl) commentEl.textContent = `"${comment}"`;
        if (inputEl) inputEl.value = currentReply;
        if (modal) modal.classList.remove('hidden');

        if (confirmBtn) {
          confirmBtn.onclick = async () => {
            const replyText = inputEl ? inputEl.value.trim() : '';
            if (!replyText) {
              showToast('Vui lòng nhập nội dung phản hồi từ tiệm hoa!', 'warning');
              return;
            }
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Đang lưu...';
            try {
              await replyProductReview(id, replyText);
              showToast('Đã lưu phản hồi của tiệm thành công!', 'success');
              if (modal) modal.classList.add('hidden');
              await renderReviewsTable();
            } catch (err) {
              showToast(err.message || 'Lỗi khi lưu phản hồi', 'error');
            } finally {
              confirmBtn.disabled = false;
              confirmBtn.textContent = 'Gửi Phản Hồi';
            }
          };
        }
        return;
      }

      const toggleBtn = e.target.closest('.btn-toggle-hide-review');
      if (toggleBtn) {
        const id = toggleBtn.dataset.id;
        try {
          await toggleHideProductReview(id);
          showToast('Đã cập nhật trạng thái ẩn/hiện đánh giá!', 'success');
          await renderReviewsTable();
        } catch (err) {
          showToast(err.message || 'Lỗi cập nhật trạng thái đánh giá', 'error');
        }
        return;
      }

      const delThreadBtn = e.target.closest('.btn-admin-delete-thread-comment');
      if (delThreadBtn) {
        const { reviewId, commentId } = delThreadBtn.dataset;
        delThreadBtn.disabled = true;
        try {
          await deleteReviewThreadComment(reviewId, commentId);
          showToast('Đã xóa phản hồi trao đổi!', 'success');
          await renderReviewsTable();
        } catch (err) {
          showToast(err.message || 'Không thể xóa phản hồi trao đổi', 'error');
          delThreadBtn.disabled = false;
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-review');
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        openConfirmModal('review', id, 'Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này? Ảnh đính kèm cũng sẽ được dọn sạch.');
      }
    });
  }

  // Gắn sự kiện mẫu trả lời nhanh và đóng modal Trả lời
  const replyModal = document.querySelector('#replyReviewModal');
  const replyCloseBtn = document.querySelector('#replyReviewCloseBtn');
  const replyCancelBtn = document.querySelector('#replyReviewCancelBtn');
  if (replyCloseBtn && replyModal) replyCloseBtn.onclick = () => replyModal.classList.add('hidden');
  if (replyCancelBtn && replyModal) replyCancelBtn.onclick = () => replyModal.classList.add('hidden');
  if (replyModal && !replyModal.dataset.quickBound) {
    replyModal.dataset.quickBound = 'true';
    replyModal.addEventListener('click', (e) => {
      const chip = e.target.closest('.btn-quick-reply-chip');
      if (!chip) return;
      const inputEl = document.querySelector('#replyReviewInput');
      if (inputEl) {
        inputEl.value = chip.dataset.template || '';
        inputEl.focus();
      }
    });
  }
}

// Bắt đầu khởi chạy hệ thống
initAuthGate();
initClock();

