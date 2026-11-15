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
  calculateCategoryRevenueBreakdown,
  calculateOrdersCost
} from './business-rules.js';
import {
  initExcelPdf,
  exportOrderInvoicePdf,
  exportGiftDeliverySlipPdf,
  exportRevenueStatisticsPdf,
  exportRevenueStatisticsExcel
} from './excel-pdf.js';
import { DELIVERY_AREA_GROUPS, DELIVERY_AREAS, DELIVERY_AREA_RATES } from './delivery-areas.js';

let openOrderDetailModalRef = null;
let currentLogisticsFilter = 'all';
let currentLogisticsSubtab = 'orders';

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
let allUnmatchedPayments = []; // Giao dịch SePay không khớp mã thanh toán cần đối soát
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
      'delivery-quotes': document.querySelector('#navItemDeliveryQuotes'),
      refunds: document.querySelector('#navItemRefunds'),
      statistics: document.querySelector('#navItemStatistics'),
      users: document.querySelector('#navItemUsers'),
      reviews: document.querySelector('#navItemReviews')
    };
    const todoStrip = document.querySelector('#alertTodoStrip');
    const groupTitles = document.querySelectorAll('.nav-group-title');
    if (role === 'staff') {
      for (const [key, item] of Object.entries(nav)) {
        if (item) item.style.display = (key === 'orders' || key === 'refunds' || key === 'delivery-quotes') ? 'flex' : 'none';
      }
      groupTitles.forEach((gt, idx) => {
        gt.style.display = idx === 0 ? 'block' : 'none';
      });
      if (todoStrip) todoStrip.style.display = 'none';
      setTimeout(() => nav.orders?.click(), 50);
    } else {
      Object.values(nav).forEach(item => { if (item) item.style.display = 'flex'; });
      groupTitles.forEach(gt => { gt.style.display = 'block'; });
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
    dashboard: 'Tổng Quan & Doanh Thu',
    products: 'Quản Lý Mẫu Hoa',
    banners: 'Banner & Chủ Đề',
    vouchers: 'Mã Giảm Giá Voucher',
    orders: 'Quản Lý Đơn Hàng',
    'delivery-quotes': 'Điều Phối Giao Hoa & Chi Phí Ship',
    'shipping-logistics': 'Điều Phối Giao Hoa & Chi Phí Ship',
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
      const activePanel = document.querySelector(`#panel-${tab}`) ||
        ((tab === 'shipping-logistics' || tab === 'delivery-quotes') ? document.querySelector('#panel-shipping-logistics') : null);
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
      else if (tab === 'delivery-quotes' || tab === 'shipping-logistics') renderShippingLogisticsTab();
      else if (tab === 'refunds') renderRefundsTab();
      else if (tab === 'statistics') renderStatistics();
      else if (tab === 'users') renderUsersTable();
      else if (tab === 'reviews') renderReviewsTable();
    });
  });

  // Tự động chuyển tab nếu có query param ?tab=
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  if (initialTab) {
    const targetNavBtn = document.querySelector(`.nav-item[data-tab="${initialTab}"]`) ||
      ((initialTab === 'delivery-quotes' || initialTab === 'shipping-logistics') ? document.querySelector('#navItemDeliveryQuotes') : null);
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
    const shipTooltip = r.shippingFee ? `\n• Phí vận chuyển (thu hộ): ${formatPrice(r.shippingFee)}` : '';
    const tooltip = `${r.label}\n• Doanh thu: ${formatPrice(r.revenue || 0)} (${r.orderCount || 0} đơn)${shipTooltip}\n• Lợi nhuận thực: ${formatPrice(r.profit || 0)}`;

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

// ==========================================================================
// 5. TỔNG QUAN DOANH THU & HIỆU QUẢ BÁN HÀNG (DASHBOARD GỌN GÀNG, CHUẨN IFRS 15)
// ==========================================================================
let currentDashboardPeriod = 'today'; // 'today' | 'month' | 'year' | 'custom'
let customDashboardDate = '';
let knownOrderIds = new Set();
let allDeliveryQuoteRequests = [];
let adminPollTimer = null;

function updateNavRefundBadge() {
  const badge = document.querySelector('#navRefundBadge');
  if (badge) {
    const pendingApproval = allRefunds.filter(r => r.status === 'pending_approval').length;
    const unrequested = allOrders.filter(orderNeedsRefund).filter(o => {
      const hasOpen = Array.isArray(o.refundRequests) && o.refundRequests.some(r => r.status === 'pending_approval');
      return !hasOpen;
    }).length;
    const totalAlert = pendingApproval + unrequested;
    badge.textContent = totalAlert;
    badge.style.display = totalAlert > 0 ? 'inline-flex' : 'none';
  }
  updateSidebarBadges();
}

function updateSidebarBadges() {
  // 1. Badge số đỏ cho Quản Lý Đơn Hàng (đơn vừa lập / chờ duyệt / chờ xử lý)
  const navOrdersBadge = document.querySelector('#navOrdersBadge');
  if (navOrdersBadge) {
    const pendingOrders = allOrders.filter(o => o.status === 'pending');
    const count = pendingOrders.length;
    if (count > 0) {
      navOrdersBadge.textContent = count > 99 ? '99+' : count;
      navOrdersBadge.classList.remove('hidden');
      navOrdersBadge.classList.add('badge-pulse');
    } else {
      navOrdersBadge.textContent = '0';
      navOrdersBadge.classList.add('hidden');
      navOrdersBadge.classList.remove('badge-pulse');
    }
  }

  // 2. Badge số đỏ cho Báo Giá Giao Hàng & Logistics
  const navQuotesBadge = document.querySelector('#navDeliveryQuotesBadge');
  const logisticsQuotesBadge = document.querySelector('#logisticsQuotesBadge');
  if (navQuotesBadge) {
    const pendingQuotes = (allDeliveryQuoteRequests || []).filter(q => q.status === 'pending' || q.status === 'requested' || q.status === 'reviewing');
    const qCount = pendingQuotes.length;
    if (qCount > 0) {
      navQuotesBadge.textContent = qCount > 99 ? '99+' : qCount;
      navQuotesBadge.classList.remove('hidden');
      if (logisticsQuotesBadge) {
        logisticsQuotesBadge.textContent = qCount > 99 ? '99+' : qCount;
        logisticsQuotesBadge.classList.remove('hidden');
      }
    } else {
      navQuotesBadge.textContent = '0';
      navQuotesBadge.classList.add('hidden');
      if (logisticsQuotesBadge) {
        logisticsQuotesBadge.textContent = '0';
        logisticsQuotesBadge.classList.add('hidden');
      }
    }
  }

  // 3. Badge số cho Đánh Giá & Phản Hồi
  const navReviewsBadge = document.querySelector('#navReviewsBadge');
  if (navReviewsBadge) {
    const unrepliedCount = (allAdminReviews || []).filter(r => !r.isHidden && (!r.comments || r.comments.length === 0)).length;
    if (unrepliedCount > 0) {
      navReviewsBadge.textContent = unrepliedCount > 99 ? '99+' : unrepliedCount;
      navReviewsBadge.classList.remove('hidden');
    } else {
      navReviewsBadge.textContent = '0';
      navReviewsBadge.classList.add('hidden');
    }
  }
}

function buildDashboardStatsPayload() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayKey = toLocalDateKey(now);

  let periodType = 'day';
  let fromDate = todayKey;
  let toDate = todayKey;
  let periodTitle = `Hôm nay (${todayKey})`;
  let monthIndex = null;

  if (currentDashboardPeriod === 'month') {
    periodType = 'month';
    const firstDay = toLocalDateKey(new Date(currentYear, currentMonth, 1));
    const lastDay = toLocalDateKey(new Date(currentYear, currentMonth + 1, 0));
    fromDate = firstDay;
    toDate = lastDay;
    monthIndex = currentMonth + 1;
    periodTitle = `Tháng ${currentMonth + 1}/${currentYear}`;
  } else if (currentDashboardPeriod === 'year') {
    periodType = 'year';
    fromDate = `${currentYear}-01-01`;
    toDate = `${currentYear}-12-31`;
    periodTitle = `Năm ${currentYear}`;
  } else if (currentDashboardPeriod === 'custom' && customDashboardDate) {
    periodType = 'day';
    fromDate = customDashboardDate;
    toDate = customDashboardDate;
    periodTitle = `Ngày ${customDashboardDate}`;
  }

  const statsData = calculateRevenueStats(allOrders, periodType, currentYear, {
    fromDate,
    toDate,
    monthIndex,
    products: allProducts
  });

  const productStats = aggregateProductDeliveryAndRevenue(allOrders, allProducts, allCategories, {
    fromDate,
    toDate
  });

  const ordersInRange = filterOrdersByDateRange(allOrders, fromDate, toDate);
  const dayMonthYearSummary = getDayMonthYearSummary(allOrders);

  return {
    statsData,
    productStats,
    ordersInRange,
    periodType,
    fromDate,
    toDate,
    periodTitle,
    dayMonthYearSummary
  };
}

function bindDashboardControls() {
  const periodGroup = document.querySelector('#dashboardPeriodGroup');
  if (periodGroup && !periodGroup.dataset.bound) {
    periodGroup.dataset.bound = 'true';
    periodGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-period-toggle');
      if (!btn) return;
      currentDashboardPeriod = btn.dataset.period;
      customDashboardDate = '';
      const dateInput = document.querySelector('#dashCustomDateInput');
      if (dateInput) dateInput.value = '';
      renderDashboard();
    });
  }

  const customDateInput = document.querySelector('#dashCustomDateInput');
  if (customDateInput && !customDateInput.dataset.bound) {
    customDateInput.dataset.bound = 'true';
    customDateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        currentDashboardPeriod = 'custom';
        customDashboardDate = e.target.value;
        renderDashboard();
      }
    });
  }

  const btnExportPdf = document.querySelector('#btnDashExportPdf');
  if (btnExportPdf && !btnExportPdf.dataset.bound) {
    btnExportPdf.dataset.bound = 'true';
    btnExportPdf.addEventListener('click', async () => {
      try {
        const payload = buildDashboardStatsPayload();
        await exportRevenueStatisticsPdf(payload);
        showToast('Đã xuất báo cáo PDF thành công!', 'success');
      } catch (err) {
        console.error('Lỗi xuất PDF:', err);
        showToast('Lỗi khi xuất PDF: ' + (err.message || 'Thất bại'), 'error');
      }
    });
  }

  const btnExportExcel = document.querySelector('#btnDashExportExcel');
  if (btnExportExcel && !btnExportExcel.dataset.bound) {
    btnExportExcel.dataset.bound = 'true';
    btnExportExcel.addEventListener('click', async () => {
      try {
        const payload = buildDashboardStatsPayload();
        await exportRevenueStatisticsExcel(payload);
        showToast('Đã xuất báo cáo Excel thành công!', 'success');
      } catch (err) {
        console.error('Lỗi xuất Excel:', err);
        showToast('Lỗi khi xuất Excel: ' + (err.message || 'Thất bại'), 'error');
      }
    });
  }

  const cardAction = document.querySelector('#dashCardPendingOrdersAction');
  if (cardAction && !cardAction.dataset.bound) {
    cardAction.dataset.bound = 'true';
    cardAction.addEventListener('click', () => {
      selectedOrderSegment = 'pending';
      ordersPagination.currentPage = 1;
      const ordersNav = document.querySelector('.nav-item[data-tab="orders"]');
      if (ordersNav) ordersNav.click();
    });
  }

  const btnViewAllProducts = document.querySelector('#btnViewAllProductsFromDash');
  if (btnViewAllProducts && !btnViewAllProducts.dataset.bound) {
    btnViewAllProducts.dataset.bound = 'true';
    btnViewAllProducts.addEventListener('click', () => {
      const prodNav = document.querySelector('.nav-item[data-tab="products"]');
      if (prodNav) prodNav.click();
    });
  }
}

function renderDashboard() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayKey = toLocalDateKey(now);

  // 1. Cập nhật trạng thái bộ lọc kỳ trên thanh Toolbar
  const periodBtns = document.querySelectorAll('#dashboardPeriodGroup .btn-period-toggle');
  periodBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.period === currentDashboardPeriod);
  });
  const dateInput = document.querySelector('#dashCustomDateInput');
  if (dateInput && currentDashboardPeriod === 'custom') {
    dateInput.value = customDashboardDate;
  } else if (dateInput && currentDashboardPeriod !== 'custom') {
    dateInput.value = '';
  }

  // 2. Xác định phạm vi ngày lọc theo kỳ được chọn
  let fromDate = todayKey;
  let toDate = todayKey;
  let periodLabelText = 'Hôm nay';
  let chartStatsData = [];

  if (currentDashboardPeriod === 'today') {
    fromDate = todayKey;
    toDate = todayKey;
    periodLabelText = 'Hôm nay';
    const range7 = getDefaultDateRange(6);
    chartStatsData = calculateRevenueStats(allOrders, 'day', currentYear, {
      fromDate: range7.fromDate,
      toDate: range7.toDate,
      products: allProducts
    });
  } else if (currentDashboardPeriod === 'month') {
    fromDate = toLocalDateKey(new Date(currentYear, currentMonth, 1));
    toDate = toLocalDateKey(new Date(currentYear, currentMonth + 1, 0));
    periodLabelText = `Tháng ${currentMonth + 1}/${currentYear}`;
    chartStatsData = calculateRevenueStats(allOrders, 'month', currentYear, {
      monthIndex: currentMonth + 1,
      products: allProducts
    });
  } else if (currentDashboardPeriod === 'year') {
    fromDate = `${currentYear}-01-01`;
    toDate = `${currentYear}-12-31`;
    periodLabelText = `Năm ${currentYear}`;
    chartStatsData = calculateRevenueStats(allOrders, 'month', currentYear, {
      products: allProducts
    });
  } else if (currentDashboardPeriod === 'custom' && customDashboardDate) {
    fromDate = customDashboardDate;
    toDate = customDashboardDate;
    periodLabelText = customDashboardDate;
    const [y, m, d] = customDashboardDate.split('-');
    const customObj = new Date(Number(y), Number(m) - 1, Number(d));
    const rangeCustom = new Date(customObj);
    rangeCustom.setDate(rangeCustom.getDate() - 6);
    const rangeFromKey = toLocalDateKey(rangeCustom);
    chartStatsData = calculateRevenueStats(allOrders, 'day', currentYear, {
      fromDate: rangeFromKey,
      toDate: customDashboardDate,
      products: allProducts
    });
  }

  // 3. Lọc danh sách đơn trong kỳ
  const periodOrders = filterOrdersByDateRange(allOrders, fromDate, toDate);
  const periodCompletedOrders = periodOrders.filter(isRevenueRecognizedOrder);

  // Thẻ KPI 1: Doanh Thu Thực Tế (IFRS 15 - loại trừ đơn hoàn tiền)
  const recognizedRevenue = periodCompletedOrders.reduce((sum, o) => {
    const rawTotal = Number(o.totalAmount || o.total_amount || 0);
    const refunds = Array.isArray(o.refundRequests) ? o.refundRequests : [];
    const approvedRefund = refunds.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0);
    return sum + Math.max(0, rawTotal - approvedRefund);
  }, 0);

  // Chi phí vận chuyển (thu hộ trả shipper) trong kỳ
  const periodShippingFee = periodCompletedOrders.reduce((sum, o) => {
    return sum + Number(o.shippingFee ?? o.shipping_fee ?? 0);
  }, 0);

  // Doanh thu hoa & phụ kiện thuần (đã tách riêng phí ship)
  const netFlowerRevenue = Math.max(0, recognizedRevenue - periodShippingFee);

  // Thẻ KPI 2: Lợi Nhuận Thực Nhận & Tỷ Suất Lãi
  const cost = calculateOrdersCost(periodCompletedOrders, allProducts);
  const profit = Math.max(0, netFlowerRevenue - cost);
  const margin = netFlowerRevenue > 0 ? Math.round((profit / netFlowerRevenue) * 100) : 0;

  // Thẻ KPI 3: Số Đơn Hoàn Tất & Số Đơn Mới Tạo
  const completedCount = periodCompletedOrders.length;
  const createdCount = periodOrders.length;

  // Thẻ KPI 4: Đơn Cần Xử Lý Ngay (đồng bộ 100% với Badge cột trái)
  const allPendingOrders = allOrders.filter(o => o.status === 'pending').length;
  const pendingReadyOrders = allOrders.filter(o => o.status === 'pending' && !isUnpaidSepayOrder(o)).length;
  const pendingUnpaidSepay = allOrders.filter(o => o.status === 'pending' && isUnpaidSepayOrder(o)).length;

  // Cập nhật DOM các thẻ KPI
  const kpiPeriodLabel = document.querySelector('#dashKpiPeriodLabel');
  const kpiRevenue = document.querySelector('#dashKpiRevenue');
  const kpiRevenueSub = document.querySelector('#dashKpiRevenueSub');
  const kpiFlowerNetRev = document.querySelector('#dashKpiFlowerNetRev');
  const kpiShippingFee = document.querySelector('#dashKpiShippingFee');
  const kpiCostPrice = document.querySelector('#dashKpiCostPrice');
  const kpiProfit = document.querySelector('#dashKpiProfit');
  const kpiMarginBadge = document.querySelector('#dashKpiMarginBadge');
  const kpiOrders = document.querySelector('#dashKpiOrders');
  const kpiCreatedBadge = document.querySelector('#dashKpiCreatedBadge');
  const kpiOrdersSub = document.querySelector('#dashKpiOrdersSub');
  const kpiPendingAction = document.querySelector('#dashKpiPendingAction');
  const kpiPendingActionSub = document.querySelector('#dashKpiPendingActionSub');

  if (kpiPeriodLabel) kpiPeriodLabel.textContent = periodLabelText;
  if (kpiRevenue) kpiRevenue.textContent = formatPrice(recognizedRevenue);
  if (kpiFlowerNetRev) kpiFlowerNetRev.textContent = formatPrice(netFlowerRevenue);
  if (kpiShippingFee) kpiShippingFee.textContent = formatPrice(periodShippingFee);
  if (kpiCostPrice) kpiCostPrice.textContent = formatPrice(cost);

  if (kpiRevenueSub) {
    kpiRevenueSub.textContent = currentDashboardPeriod === 'today'
      ? 'Đơn hoàn tất hôm nay (IFRS 15)'
      : (currentDashboardPeriod === 'month' ? `Lũy kế tháng ${currentMonth + 1}/${currentYear}` : `Lũy kế năm ${currentYear}`);
  }

  if (kpiProfit) kpiProfit.textContent = formatPrice(profit);
  if (kpiMarginBadge) {
    kpiMarginBadge.textContent = netFlowerRevenue > 0 ? `Tỷ suất lãi: ${margin}%` : 'Tỷ suất lãi: --%';
  }

  if (kpiOrders) kpiOrders.textContent = `${completedCount} đơn`;
  if (kpiCreatedBadge) kpiCreatedBadge.textContent = `${createdCount} đơn mới`;
  if (kpiOrdersSub) {
    kpiOrdersSub.textContent = currentDashboardPeriod === 'today'
      ? 'Giao thành công hôm nay'
      : (currentDashboardPeriod === 'month' ? 'Giao thành công trong tháng' : 'Giao thành công trong kỳ');
  }

  // Khớp 100% số đơn với Badge bên trái
  if (kpiPendingAction) kpiPendingAction.textContent = `${allPendingOrders} đơn`;
  if (kpiPendingActionSub) {
    kpiPendingActionSub.textContent = `${pendingReadyOrders} chờ duyệt giao • ${pendingUnpaidSepay} chờ VietQR`;
  }

  // Cập nhật Dải Bóc Tách Minh Bạch Dòng Tiền (Financial Streamline Bar)
  const finTotal = document.querySelector('#finStepTotalCollected');
  const finShip = document.querySelector('#finStepShipping');
  const finFlower = document.querySelector('#finStepFlowerRev');
  const finCost = document.querySelector('#finStepCost');
  const finProfit = document.querySelector('#finStepProfit');
  const finMargin = document.querySelector('#finStepMargin');

  if (finTotal) finTotal.textContent = formatPrice(recognizedRevenue);
  if (finShip) finShip.textContent = formatPrice(periodShippingFee);
  if (finFlower) finFlower.textContent = formatPrice(netFlowerRevenue);
  if (finCost) finCost.textContent = formatPrice(cost);
  if (finProfit) finProfit.textContent = formatPrice(profit);
  if (finMargin) {
    finMargin.textContent = netFlowerRevenue > 0 ? `Tỷ suất lãi: ${margin}% trên tiền hoa` : 'Tỷ suất: --%';
  }

  // 4. Sơ đồ cột trực quan
  const chartContainer = document.querySelector('#dashBarChartContainer');
  if (chartContainer) {
    chartContainer.innerHTML = renderPeriodBarChartHtml(chartStatsData, {
      heightPx: 180,
      showGmv: false,
      showRevenue: true,
      showProfit: true,
      compact: false
    });
  }

  // 5. Top 5 Mẫu hoa bán chạy
  const topListEl = document.querySelector('#dashboardTopProductsList');
  if (topListEl) {
    const productStats = aggregateProductDeliveryAndRevenue(allOrders, allProducts, allCategories);
    const top5 = productStats.slice(0, 5);
    if (top5.length === 0) {
      topListEl.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); margin: 0; padding: 12px 0;">Chưa có dữ liệu bán hàng</p>`;
    } else {
      topListEl.innerHTML = top5.map((p, idx) => `
        <div class="top-seller-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="top-seller-rank ${idx === 0 ? 'rank-1' : ''}" style="width: 22px; height: 22px; border-radius: 50%; background: ${idx === 0 ? '#108474' : '#E2E8F0'}; color: ${idx === 0 ? '#fff' : '#475569'}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">${idx + 1}</span>
            <img src="${safeAdminMediaUrl(p.image)}" alt="${escapeHTML(p.name)}" class="top-seller-thumb" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;" onerror="this.src='./images/300.webp'">
            <div class="top-seller-info">
              <div class="top-seller-name" style="font-size: 13px; font-weight: 600; color: #1E293B;">${escapeHTML(p.name)}</div>
              <div class="top-seller-meta" style="font-size: 11.5px; color: #64748B;">Đã giao: <strong>${p.deliveredQty}</strong> bó • Đang giao: ${p.shippingQty}</div>
            </div>
          </div>
          <div class="top-seller-rev" style="font-size: 13px; font-weight: 700; color: #108474;">${formatPrice(p.deliveredRevenue)}</div>
        </div>
      `).join('');
    }
  }

  // 6. Gắn sự kiện các nút điều khiển Dashboard
  bindDashboardControls();

  // 7. Đồng bộ badge thông báo thanh sidebar
  updateSidebarBadges();
}

function setupAdminLivePolling() {
  if (adminPollTimer) clearInterval(adminPollTimer);

  // Khởi tạo tập hợp mã đơn đã biết
  allOrders.forEach(o => knownOrderIds.add(String(o.id)));
  updateSidebarBadges();

  adminPollTimer = setInterval(async () => {
    try {
      // 1. Kiểm tra đơn hàng mới ngầm
      const freshOrders = await fetchOrders();
      if (Array.isArray(freshOrders)) {
        const newlyArrived = freshOrders.filter(o => !knownOrderIds.has(String(o.id)));
        if (newlyArrived.length > 0) {
          const first = newlyArrived[0];
          showToast(`🌸 Có ${newlyArrived.length} đơn hàng mới! #${first.orderCode || first.id} - ${formatPrice(first.totalAmount)}`, 'info');
          newlyArrived.forEach(o => knownOrderIds.add(String(o.id)));
          allOrders = freshOrders;
          updateSidebarBadges();

          // Tự động làm mới dữ liệu tab đang active
          if (currentTab === 'dashboard') {
            renderDashboard();
          } else if (currentTab === 'orders') {
            renderOrderSegmentedTabs();
            renderOrdersTable();
          }
        } else {
          allOrders = freshOrders;
          updateSidebarBadges();
        }
      }

      // 2. Kiểm tra yêu cầu báo giá giao hàng ngầm
      try {
        const dqRes = await api.get('/api/admin/delivery-quote-requests');
        allDeliveryQuoteRequests = dqRes.data || [];
        updateSidebarBadges();
      } catch (e) {
        // Bỏ qua lỗi mạng nền
      }
    } catch (err) {
      console.warn('Lỗi polling đơn hàng admin:', err);
    }
  }, 15000); // Chu kỳ polling mỗi 15 giây
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

    const colorLabelsAdmin = {
      cam: 'Cam', do: 'Đỏ', hong: 'Hồng', vang: 'Vàng', trang: 'Trắng', tim: 'Tím', xanh: 'Xanh', 'da-sac': 'Đa sắc'
    };
    const flowerLabelsAdmin = {
      tulip: 'Tulip', 'huong-duong': 'Hướng dương', 'hoa-hong': 'Hoa hồng', 'mau-don': 'Mẫu đơn',
      'hoa-ly-cuc': 'Ly & Cúc', 'baby-lavender': 'Baby/Lavender', khac: 'Khác'
    };
    const colorTagHtml = p.color ? `<span class="badge-pill" style="font-size: 10px; padding: 1px 6px; background: #FEF3C7; color: #92400E;">Màu ${colorLabelsAdmin[p.color] || p.color}</span>` : '';
    const flowerTagHtml = (p.flowerType || p.flower_type) ? `<span class="badge-pill" style="font-size: 10px; padding: 1px 6px; background: #E0E7FF; color: #3730A3;">${flowerLabelsAdmin[p.flowerType || p.flower_type] || p.flowerType || p.flower_type}</span>` : '';

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
            ${colorTagHtml}
            ${flowerTagHtml}
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
      if (document.querySelector('#prodColorSelect')) document.querySelector('#prodColorSelect').value = 'da-sac';
      if (document.querySelector('#prodFlowerTypeSelect')) document.querySelector('#prodFlowerTypeSelect').value = 'khac';
      if (document.querySelector('#prodOccasionSelect')) document.querySelector('#prodOccasionSelect').value = 'tat-ca';
      if (document.querySelector('#prodMaterialSelect')) document.querySelector('#prodMaterialSelect').value = 'kem-nhung';
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
      if (document.querySelector('#prodColorSelect')) {
        document.querySelector('#prodColorSelect').value = product.color || 'da-sac';
      }
      if (document.querySelector('#prodFlowerTypeSelect')) {
        document.querySelector('#prodFlowerTypeSelect').value = product.flowerType || product.flower_type || 'khac';
      }
      if (document.querySelector('#prodOccasionSelect')) {
        document.querySelector('#prodOccasionSelect').value = product.occasion || 'tat-ca';
      }
      if (document.querySelector('#prodMaterialSelect')) {
        document.querySelector('#prodMaterialSelect').value = product.material || 'kem-nhung';
      }
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

      const colorVal = document.querySelector('#prodColorSelect')?.value || 'da-sac';
      const flowerTypeVal = document.querySelector('#prodFlowerTypeSelect')?.value || 'khac';
      const occasionVal = document.querySelector('#prodOccasionSelect')?.value || 'tat-ca';
      const materialVal = document.querySelector('#prodMaterialSelect')?.value || 'kem-nhung';

      const productData = {
        name: document.querySelector('#prodNameInput').value.trim(),
        price: Number(document.querySelector('#prodPriceInput').value),
        originalPrice: Number(document.querySelector('#prodOriginalPriceInput').value) || Number(document.querySelector('#prodPriceInput').value),
        costPrice: Math.max(0, costPriceVal),
        isActive: isActiveVal,
        categoryId: catId,
        categoryName: catObj.name || 'Hoa Kẽm Nhung',
        categorySlug: catObj.slug || 'kem-nhung',
        color: colorVal,
        flowerType: flowerTypeVal,
        flower_type: flowerTypeVal,
        occasion: occasionVal,
        material: materialVal,
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

    const createdAtDate = o.createdAt ? new Date(o.createdAt) : null;
    const dateStr = createdAtDate ? createdAtDate.toLocaleDateString('vi-VN') : '--';
    const timeStr = createdAtDate ? createdAtDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
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
          <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${dateStr} <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${timeStr}</span></div>
          ${(o.deliveryDate || o.delivery_date) ? `
            <div style="font-size: 11px; color: #0D9488; font-weight: 600; margin-top: 2px;" title="Ngày hẹn giao hoa: ${escapeHTML(o.deliveryDate || o.delivery_date)}${(o.deliverySlot || o.delivery_slot) ? ` (${escapeHTML(o.deliverySlot || o.delivery_slot)})` : ''}">
              🚚 ${escapeHTML(o.deliveryDate || o.delivery_date)}${(o.deliverySlot || o.delivery_slot) ? ` • ${escapeHTML(o.deliverySlot || o.delivery_slot)}` : ''}
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
    openOrderDetailModalRef = openOrderDetail;
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
          : (String(order.paymentStatus || '').toLowerCase() === 'partially_paid'
            ? '<span style="color: #B45309; font-weight: 700;">Đã trả trước một phần</span>'
          : (isPaid
            ? '<span style="color: #16a34a; font-weight: 700;">✓ Đã thanh toán (Paid)</span>'
            : (isSepay
              ? '<span style="color: #d97706; font-weight: 700;">Chờ khách chuyển khoản VietQR (SePay)</span>'
              : '<span style="color: #d97706; font-weight: 700;">Đơn lịch sử thanh toán khi nhận (COD)</span>'))));
      const paymentMethodText = order.paymentPlan === 'sepay_deposit'
        ? 'Trả trước 50% qua SePay, còn lại thu tiền mặt khi giao'
        : (order.paymentPlan === 'sepay_full' ? 'Chuyển khoản đủ qua SePay' : (isSepay ? 'Chuyển khoản SePay (đơn lịch sử)' : 'COD (đơn lịch sử)'));
      const cashBalance = Number(order.amountToCollectAtDelivery || 0);
      const showCashCollection = ['shipping', 'completed'].includes(order.status) && cashBalance > 0 && order.paymentPlan === 'sepay_deposit';
      const deliveryAttemptsHtml = (order.deliveryAttempts || []).map(attempt => `
        <li>Lần ${attempt.number}: ${escapeHTML(attempt.status)}${attempt.failedAt ? ` • thất bại ${new Date(attempt.failedAt).toLocaleString('vi-VN')}` : ''}${attempt.feeCharged ? ` • đã cấn ${formatPrice(attempt.feeCharged)}` : ''}${attempt.rescheduleDeadline ? ` • hẹn lại trước ${new Date(attempt.rescheduleDeadline).toLocaleString('vi-VN')}` : ''}${attempt.failReason ? ` • ${escapeHTML(attempt.failReason)}` : ''}</li>
      `).join('');
      const pendingCancellation = (order.cancellationRequests || []).find(request => request.status === 'pending');
      const pendingChangeRequest = (order.changeRequests || []).find(request => request.status === 'pending');
      const requestReviewHtml = `
        ${pendingCancellation ? `
          <div style="margin:10px 0;padding:12px;border:1px solid #FCA5A5;background:#FEF2F2;border-radius:8px;">
            <strong>Khách yêu cầu hủy đơn:</strong> ${escapeHTML(pendingCancellation.reason)}
            <p style="font-size:12px;margin:6px 0;">Khấu trừ chỉ nhập khi có chi phí hoa riêng không thể thu hồi; cần ghi bằng chứng. Mặc định hoàn toàn bộ tiền đã nhận.</p>
            <label>Số tiền khấu trừ (VND) <input id="cancellationDeductible" type="number" min="0" max="${Number(order.amountReceived || 0)}" value="0"></label>
            <textarea id="cancellationCostLines" rows="2" placeholder="Chi phí, số tiền (mỗi dòng: mô tả | VND)" style="width:100%;margin-top:6px;"></textarea>
            <input id="cancellationEvidence" type="text" placeholder="Ghi chú/bằng chứng chi phí" style="width:100%;margin-top:6px;">
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button type="button" class="btn-primary" id="btnApproveCancellation" data-request-id="${escapeHTML(pendingCancellation.id)}">Duyệt hủy</button>
              <button type="button" class="btn-secondary" id="btnRejectCancellation" data-request-id="${escapeHTML(pendingCancellation.id)}">Từ chối</button>
            </div>
          </div>
        ` : ''}
        ${pendingChangeRequest ? `
          <div style="margin:10px 0;padding:12px;border:1px solid #FDE68A;background:#FFFBEB;border-radius:8px;">
            <strong>Yêu cầu đổi ${escapeHTML(pendingChangeRequest.type)} đang chờ:</strong> ${escapeHTML(pendingChangeRequest.newValue)}
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button type="button" class="btn-primary" id="btnApproveOrderChange" data-request-id="${escapeHTML(pendingChangeRequest.id)}">Duyệt thay đổi</button>
              <button type="button" class="btn-secondary" id="btnRejectOrderChange" data-request-id="${escapeHTML(pendingChangeRequest.id)}">Từ chối</button>
            </div>
          </div>
        ` : ''}
      `;
      const deliveryOpsHtml = order.status === 'shipping' ? `
        <div style="margin:12px 0;padding:12px;border:1px solid #E8E8E8;border-radius:8px;">
          <strong>Giao hàng tự vận hành</strong>
          <ul style="margin:6px 0 10px 18px;font-size:12px;">${deliveryAttemptsHtml || '<li>Chưa bắt đầu ghi nhận chuyến giao.</li>'}</ul>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button type="button" class="btn-secondary" id="btnStartDeliveryAttempt">Bắt đầu chuyến / chuyến lại</button>
            <button type="button" class="btn-secondary" id="btnFailDeliveryAttempt">Ghi nhận giao thất bại</button>
            ${['failed', 'exception_required'].includes(order.deliveryAttempts?.at(-1)?.status) ? '<button type="button" class="btn-primary" id="btnCreateRedeliveryFee">Tạo khoản phí giao lại</button>' : ''}
          </div>
          <textarea id="deliveryContactLog" rows="2" placeholder="Ghi thời gian gọi, kết quả liên hệ; khi thất bại hãy ghi lý do" style="width:100%;margin-top:8px;padding:8px;border:1px solid #D1D5DB;border-radius:6px;"></textarea>
          <div id="redeliveryPaymentInfo" style="margin-top:8px;"></div>
        </div>
      ` : '';

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
            ${Number.isFinite(Number(order.deliveryLatitude)) && Number.isFinite(Number(order.deliveryLongitude))
              && order.deliveryLatitude !== null && order.deliveryLongitude !== null
              ? `<div><strong>Phí khu vực:</strong> ${escapeHTML(order.deliveryZone || order.deliveryArea || 'Đã lưu theo đơn')} — ${Number(order.shippingFee || 0) === 0 ? 'Miễn phí' : formatPrice(order.shippingFee)}</div>
                 <div style="margin-top: 4px;"><strong>Tọa độ ghim:</strong> <span style="font-family: monospace; color: #108474; font-weight: 600;">${order.deliveryLatitude}, ${order.deliveryLongitude}</span></div>
                 <div style="margin: 6px 0;">
                   <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(`${order.deliveryLatitude},${order.deliveryLongitude}`)}&amp;travelmode=driving" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#E6F4F1;color:#108474;border:1px solid #A7F3D0;border-radius:6px;font-weight:700;text-decoration:none;">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                     Mở ghim chỉ đường Google Maps
                   </a>
                 </div>`
              : `<div><strong>Phí khu vực:</strong> ${escapeHTML(order.deliveryZone || order.deliveryArea || 'Chưa lưu vùng')} — ${Number(order.shippingFee || 0) === 0 ? 'Miễn phí' : formatPrice(order.shippingFee)}</div>`}
            <div class="field-hint">Ghim do khách chọn để hỗ trợ điều hướng; xác nhận lại địa chỉ chữ và phường với khách trước khi xuất phát.</div>
            <div><strong>Hình thức thanh toán:</strong> ${paymentMethodText} &mdash; ${paymentStatusHtml}</div>
            ${order.paymentPlan === 'sepay_deposit' || order.paymentPlan === 'sepay_full' ? `
              <div><strong>Đã thu:</strong> ${formatPrice(order.amountReceived || 0)} • <strong>Còn phải thu:</strong> ${formatPrice(cashBalance)}</div>
            ` : ''}
            ${isUnpaidSepay && order.status !== 'cancelled' ? `
              <div id="unpaidSepayAdminGuardBanner" style="margin-top: 8px; padding: 10px 14px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; color: #92400E; font-size: 13px; font-weight: 600;">
                Đơn hàng SePay này đang chờ khách hàng chuyển khoản. Hệ thống khóa nút duyệt, giao hàng và hoàn tất cho đến khi ngân hàng đối soát nhận tiền.
              </div>
            ` : ''}
            ${refundSectionHtml}
            ${requestReviewHtml}
            ${deliveryOpsHtml}
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
          ${showCashCollection ? `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;padding:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
              <label for="cashCollectionAmount" style="font-weight:700;">Tiền mặt thu khi giao:</label>
              <input id="cashCollectionAmount" type="number" min="1" max="${cashBalance}" value="${cashBalance}" style="max-width:160px;padding:7px;border:1px solid #D1D5DB;border-radius:6px;">
              <button type="button" id="btnRecordCashCollection" class="btn-primary" data-order-id="${escapeHTML(order.id)}">Ghi nhận đã thu tiền</button>
            </div>
          ` : ''}
        </div>
      `;
      const cashButton = bodyEl.querySelector('#btnRecordCashCollection');
      if (cashButton) cashButton.addEventListener('click', async () => {
        const amount = Number(bodyEl.querySelector('#cashCollectionAmount')?.value);
        try {
          cashButton.disabled = true;
          const response = await api.post(`/api/orders/${encodeURIComponent(order.id)}/cash-collection`, { amount, note: 'Thu tiền mặt khi giao hàng' });
          const updatedOrder = response.data?.order;
          allOrders = await fetchOrders();
          renderOrdersTable();
          renderDashboard();
          if (updatedOrder) openOrderDetail(updatedOrder);
          showToast('Đã ghi nhận tiền mặt; trạng thái thanh toán được cập nhật độc lập với trạng thái giao.', 'success');
        } catch (error) {
          showToast(error.response?.data?.error?.message || error.message || 'Không thể ghi nhận tiền mặt.', 'error');
        } finally {
          cashButton.disabled = false;
        }
      });
      const refreshOrderDetail = async () => {
        allOrders = await fetchOrders();
        renderOrdersTable();
        renderDashboard();
        const refreshed = allOrders.find(item => String(item.id) === String(order.id));
        if (refreshed) openOrderDetail(refreshed);
      };
      const startAttemptButton = bodyEl.querySelector('#btnStartDeliveryAttempt');
      if (startAttemptButton) startAttemptButton.addEventListener('click', async () => {
        try {
          await api.post(`/api/orders/${encodeURIComponent(order.id)}/delivery-attempts`, { action: 'start' });
          await refreshOrderDetail();
          showToast('Đã ghi nhận bắt đầu chuyến giao.', 'success');
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
      const failAttemptButton = bodyEl.querySelector('#btnFailDeliveryAttempt');
      if (failAttemptButton) failAttemptButton.addEventListener('click', async () => {
        try {
          const contactLog = bodyEl.querySelector('#deliveryContactLog')?.value.trim() || '';
          if (!contactLog) throw new Error('Hãy ghi lại các lần liên hệ trước khi báo giao thất bại.');
          await api.post(`/api/orders/${encodeURIComponent(order.id)}/delivery-attempts`, { action: 'failed', reason: 'Không gặp được người nhận sau thời gian chờ', contactLog });
          await refreshOrderDetail();
          showToast('Đã ghi nhận chuyến giao thất bại và khoản cấn theo chính sách.', 'success');
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
      const redeliveryButton = bodyEl.querySelector('#btnCreateRedeliveryFee');
      if (redeliveryButton) redeliveryButton.addEventListener('click', async () => {
        try {
          const response = await api.post(`/api/orders/${encodeURIComponent(order.id)}/redelivery-payment`, {});
          const intent = response.data.paymentIntent;
          const configResponse = await api.get('/api/sepay/config');
          const config = configResponse.data;
          const info = bodyEl.querySelector('#redeliveryPaymentInfo');
          if (info) {
            const alreadyPaid = intent.status === 'paid';
            const qrUrl = config.simulationOnly ? '' : `https://qr.sepay.vn/img?acc=${encodeURIComponent(config.accountNumber)}&bank=${encodeURIComponent(config.bankCode)}&amount=${Number(intent.amount)}&des=${encodeURIComponent(intent.reference_code || intent.referenceCode)}&template=compact`;
            const qrMarkup = qrUrl ? `<img src="${qrUrl}" alt="Mã QR phí giao lại" width="180" height="180" style="display:block;width:180px;height:180px;object-fit:contain;margin:10px auto;background:#fff;">` : '';
            const simulationButton = config.simulationOnly && !alreadyPaid
              ? '<button type="button" class="btn-secondary" id="btnSimulateRedeliveryLocal" style="margin-top:10px;">Mô phỏng đã trả phí (local)</button>' : '';
            info.innerHTML = `<div style="padding:10px;background:#FFFBEB;border-radius:6px;">Phí giao lại: <strong>${formatPrice(intent.amount)}</strong><br>Mã thanh toán: <code>${escapeHTML(intent.reference_code || intent.referenceCode)}</code>${qrMarkup}<br>${config.simulationOnly ? 'LOCAL MOCK — không có QR thật, không chuyển tiền.' : 'Khách quét QR hoặc chuyển đúng số tiền và nội dung mã này trước khi bạn xuất phát.'}${alreadyPaid ? '<br>Đã ghi nhận phí cho chuyến này; không thu lần hai.' : simulationButton}</div>`;
            const simulateButton = info.querySelector('#btnSimulateRedeliveryLocal');
            if (simulateButton) simulateButton.addEventListener('click', async () => {
              simulateButton.disabled = true;
              try {
                await api.post(`/api/sepay/simulate-payment/${encodeURIComponent(order.id)}`, {
                  phone: order.customerPhone || order.phone || '', intentId: intent.id
                });
                await refreshOrderDetail();
                showToast('Đã ghi nhận mô phỏng phí giao lại local; không có tiền thật được chuyển.', 'success');
              } catch (error) {
                showToast(error.response?.data?.error?.message || error.message, 'error');
                simulateButton.disabled = false;
              }
            });
          }
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
      const cancellationButton = bodyEl.querySelector('#btnApproveCancellation');
      if (cancellationButton) cancellationButton.addEventListener('click', async () => {
        try {
          const deductibleAmount = Number(bodyEl.querySelector('#cancellationDeductible')?.value || 0);
          const evidenceNote = bodyEl.querySelector('#cancellationEvidence')?.value.trim() || '';
          const lines = bodyEl.querySelector('#cancellationCostLines')?.value.split('\n').map(line => line.trim()).filter(Boolean) || [];
          const costBreakdown = lines.map(line => {
            const [description, rawAmount] = line.split('|').map(part => part.trim());
            return { description, amount: Number(rawAmount) };
          });
          await api.patch(`/api/order-cancellation-requests/${encodeURIComponent(cancellationButton.dataset.requestId)}`, { approved: true, deductibleAmount, costBreakdown, evidenceNote });
          await refreshOrderDetail();
          showToast('Đã duyệt hủy đơn. Nếu có tiền cần hoàn, phiếu hoàn sẽ chờ bước duyệt maker-checker.', 'success');
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
      const rejectCancellationButton = bodyEl.querySelector('#btnRejectCancellation');
      if (rejectCancellationButton) rejectCancellationButton.addEventListener('click', async () => {
        try {
          await api.patch(`/api/order-cancellation-requests/${encodeURIComponent(rejectCancellationButton.dataset.requestId)}`, { approved: false });
          await refreshOrderDetail();
          showToast('Đã từ chối yêu cầu hủy.', 'info');
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
      const approveChangeButton = bodyEl.querySelector('#btnApproveOrderChange');
      if (approveChangeButton) approveChangeButton.addEventListener('click', async () => {
        try {
          const response = await api.patch(`/api/order-change-requests/${encodeURIComponent(approveChangeButton.dataset.requestId)}`, { approved: true });
          await refreshOrderDetail();
          if (response.data?.paymentIntent) showToast(`Cần khách thanh toán thêm ${formatPrice(response.data.paymentIntent.amount)} với mã ${response.data.paymentIntent.reference_code}.`, 'info');
          else showToast('Đã áp dụng thay đổi.', 'success');
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
      const rejectChangeButton = bodyEl.querySelector('#btnRejectOrderChange');
      if (rejectChangeButton) rejectChangeButton.addEventListener('click', async () => {
        try {
          await api.patch(`/api/order-change-requests/${encodeURIComponent(rejectChangeButton.dataset.requestId)}`, { approved: false });
          await refreshOrderDetail();
          showToast('Đã từ chối yêu cầu đổi.', 'info');
        } catch (error) { showToast(error.response?.data?.error?.message || error.message, 'error'); }
      });
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

async function fetchUnmatchedPayments() {
  try {
    const response = await api.get('/api/sepay/reconciliation');
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    console.warn('Lỗi tải giao dịch SePay cần đối soát:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

function renderUnmatchedPayments() {
  const tbody = document.querySelector('#adminUnmatchedPaymentsTable');
  const count = document.querySelector('#unmatchedPaymentCount');
  if (count) count.textContent = `${allUnmatchedPayments.length} giao dịch`;
  if (!tbody) return;
  if (!allUnmatchedPayments.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Không có giao dịch đang chờ đối soát</td></tr>';
    return;
  }
  tbody.innerHTML = allUnmatchedPayments.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.providerTxId)}</strong><div style="font-size:11px;color:var(--text-muted);">${new Date(item.createdAt).toLocaleString('vi-VN')}</div></td>
      <td style="font-weight:700;">${formatPrice(item.amount)}</td>
      <td style="max-width:260px;overflow-wrap:anywhere;">${escapeHTML(item.content || '(không có nội dung)')}</td>
      <td>${escapeHTML(item.bankBrand || 'SePay')} •••• ${escapeHTML(item.accountSuffix || '----')}<div style="font-size:11px;color:var(--text-muted);">${item.transactionDate ? new Date(item.transactionDate).toLocaleString('vi-VN') : ''}</div></td>
      <td><input type="text" maxlength="500" placeholder="Ghi chú đã kiểm tra / xử lý" style="width:100%;min-width:180px;"></td>
      <td><button type="button" class="btn-inline-action btn-reconciliation-review" data-id="${escapeHTML(item.id)}">Đã đối soát</button></td>
    </tr>
  `).join('');
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
  renderUnmatchedPayments();

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
  const reconciliationTable = document.querySelector('#adminUnmatchedPaymentsTable');

  if (reconciliationTable && !reconciliationTable.dataset.bound) {
    reconciliationTable.dataset.bound = 'true';
    reconciliationTable.addEventListener('click', async (event) => {
      const button = event.target.closest('.btn-reconciliation-review');
      if (!button) return;
      const note = button.closest('tr')?.querySelector('input')?.value.trim() || '';
      if (note.length < 3) {
        showToast('Ghi chú cách đối soát trước khi đóng giao dịch này.', 'warning');
        return;
      }
      if (!confirm('Chỉ xác nhận sau khi đã kiểm tra sao kê ngân hàng và xử lý khoản chuyển này. Tiếp tục?')) return;
      button.disabled = true;
      try {
        await api.patch(`/api/sepay/reconciliation/${encodeURIComponent(button.dataset.id)}`, { note });
        allUnmatchedPayments = await fetchUnmatchedPayments();
        renderUnmatchedPayments();
        showToast('Đã lưu kết quả đối soát giao dịch.', 'success');
      } catch (error) {
        showToast(error.response?.data?.error?.message || error.message || 'Không thể lưu kết quả đối soát.', 'error');
        button.disabled = false;
      }
    });
  }

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

// ===========================================================================
// 12B. BÁO GIÁ GIAO THỦ CÔNG (KHÔNG GIỮ SLOT / TỒN KHO TRƯỚC KHI KHÁCH ĐỒNG Ý)
// ===========================================================================
async function renderDeliveryQuoteRequests() {
  const container = document.querySelector('#adminDeliveryQuoteRequests');
  if (!container) return;
  container.innerHTML = '<p class="field-hint">Đang tải yêu cầu báo giá…</p>';
  try {
    const response = await api.get('/api/admin/delivery-quote-requests');
    const requests = response.data || [];
    allDeliveryQuoteRequests = requests;
    updateSidebarBadges();
    if (!requests.length) {
      container.innerHTML = '<div class="admin-empty-state">Hiện không có yêu cầu báo giá đang mở.</div>';
      return;
    }
    container.innerHTML = requests.map(request => {
      const payload = request.payload || {};
      const items = Array.isArray(payload.items) ? payload.items.map(item => {
        const product = allProducts.find(row => String(row.id) === String(item.productId));
        return `${escapeHTML(product?.name || item.productId)} × ${Number(item.quantity) || 0}`;
      }).join(', ') : 'Không có chi tiết giỏ hàng';
      const mapLink = Number.isFinite(Number(request.latitude)) && Number.isFinite(Number(request.longitude))
        ? `https://www.google.com/maps/dir/?api=1&destination=${Number(request.latitude)},${Number(request.longitude)}` : '';
      const requestUrl = `${window.location.origin}/delivery-quote.html?code=${encodeURIComponent(request.requestCode)}`;
      const statusText = { requested: 'Chờ shop xem', reviewing: 'Đang kiểm tra', quoted: 'Đã báo giá, chờ khách' }[request.status] || request.status;
      const chosenDate = request.quotedDeliveryDate || request.deliveryDate || '';
      const chosenSlot = request.quotedDeliverySlot || request.deliverySlot || '';
      const detail = `
        <div><strong>Địa chỉ:</strong> ${escapeHTML(request.shippingAddress)}, ${escapeHTML(request.deliveryArea)}</div>
        <div><strong>Giỏ:</strong> ${items}</div>
        <div style="font-size:13px;color:var(--text-secondary);">
          <strong>Khách muốn:</strong> ${escapeHTML(request.deliveryDate || 'Chưa chọn ngày')} · ${escapeHTML(request.deliverySlot || 'Chưa chọn khung')}
          ${request.distanceMeters != null ? ` · Tuyến ${(Number(request.distanceMeters) / 1000).toFixed(2)} km` : ''}
          ${request.snapOffsetMeters != null ? ` · Ghim lệch đường ${Number(request.snapOffsetMeters)} m` : ''}
          · Nguồn: ${escapeHTML(request.routeProvider || 'chưa tính được')}
        </div>`;
      const actions = request.status === 'quoted' ? `
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px;">
          <strong>Phí đã báo: ${formatPrice(Number(request.shippingFee) || 0)}</strong>
          <div>Ngày/khung shop chốt: ${escapeHTML(chosenDate || 'chưa chọn')} · ${escapeHTML(chosenSlot || 'chưa chọn')}</div>
          <div>${escapeHTML(request.shopNote || '')}</div>
          <div>Hạn xác nhận: ${request.expiresAt ? new Date(request.expiresAt).toLocaleString('vi-VN') : '—'}</div>
          <div style="font-size:12px;word-break:break-all;margin-top:5px;">${escapeHTML(requestUrl)}</div>
          <button type="button" class="btn-secondary" data-dq-action="copy" data-link="${escapeHTML(requestUrl)}">Sao chép liên kết cho khách</button>
        </div>` : `
        <form class="delivery-quote-admin-form" data-id="${escapeHTML(request.id)}" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
          <label>Phí giao (₫)<input name="shippingFee" class="admin-input" type="number" min="0" max="500000" step="1000" placeholder="Nhập phí sau khi kiểm tra" required></label>
          <label>Ngày shop xác nhận<input name="deliveryDate" class="admin-input" type="date" value="${escapeHTML(request.deliveryDate || '')}" required></label>
          <label>Khung giờ shop xác nhận<select name="deliverySlot" class="admin-select" style="width:100%;">
            <option value="">Chọn khung giờ đã kiểm tra</option>
            ${['Sáng (08:00 - 12:00)','Chiều (13:00 - 17:00)','Tối (18:00 - 21:00)','Hỏa tốc trong 2h'].map(slot => `<option value="${escapeHTML(slot)}" ${slot === chosenSlot ? 'selected' : ''}>${escapeHTML(slot)}</option>`).join('')}
          </select></label>
          <label style="grid-column:1/-1;">Ghi chú báo cho khách<textarea name="shopNote" class="admin-textarea" rows="2" maxlength="1000" placeholder="Ghi rõ tuyến/hẻm và điều kiện giao"></textarea></label>
          <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-primary" data-dq-action="quote" data-id="${escapeHTML(request.id)}">Gửi báo giá cho khách</button>
            <button type="button" class="btn-secondary" data-dq-action="reviewing" data-id="${escapeHTML(request.id)}">Đánh dấu đang kiểm tra</button>
            <button type="button" class="btn-secondary" data-dq-action="declined" data-id="${escapeHTML(request.id)}">Từ chối yêu cầu</button>
          </div>
        </form>`;
      return `<article class="admin-card" style="background:#fff;border:1px solid var(--border-light);border-radius:12px;padding:16px;display:grid;gap:12px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div><strong>${escapeHTML(request.requestCode)}</strong><span style="margin-left:10px;color:var(--color-warning);font-weight:700;">${escapeHTML(statusText)}</span>
            <div style="margin-top:4px;color:var(--text-secondary);">${escapeHTML(request.customerName)} · <a href="tel:${escapeHTML(request.customerPhone)}">${escapeHTML(request.customerPhone)}</a></div></div>
          ${mapLink ? `<a class="btn-secondary" href="${mapLink}" target="_blank" rel="noopener noreferrer">Mở tuyến bản đồ</a>` : ''}
        </div>
        ${detail}${actions}
        <p style="font-size:12px;color:var(--text-muted);margin:0;">Khung giờ chưa được hệ thống giữ chỗ. Kiểm tra lịch đơn hàng trước khi báo giá.</p>
      </article>`;
    }).join('');
  } catch (error) {
    container.innerHTML = `<p class="field-error">${escapeHTML(error.response?.data?.error?.message || 'Không tải được yêu cầu báo giá.')}</p>`;
  }
}

function initDeliveryQuoteManagement() {
  const container = document.querySelector('#adminDeliveryQuoteRequests');
  const refresh = document.querySelector('#refreshDeliveryQuotesBtn');
  if (refresh) refresh.addEventListener('click', renderDeliveryQuoteRequests);
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';
  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-dq-action]');
    if (!button) return;
    if (button.dataset.dqAction === 'copy') {
      try { await navigator.clipboard.writeText(button.dataset.link); showToast('Đã sao chép liên kết báo giá.', 'success'); }
      catch { showToast(button.dataset.link, 'info'); }
      return;
    }
    const requestId = button.dataset.id;
    let payload = { action: button.dataset.dqAction };
    if (payload.action === 'quote') {
      const form = button.closest('.delivery-quote-admin-form');
      payload = { action: 'quoted', shippingFee: Number(form?.elements.shippingFee.value),
        deliveryDate: form?.elements.deliveryDate.value || '', deliverySlot: form?.elements.deliverySlot.value || '',
        shopNote: form?.elements.shopNote.value.trim() || '' };
      if (!form?.reportValidity()) return;
      if (!Number.isSafeInteger(payload.shippingFee) || payload.shippingFee < 0) {
        showToast('Nhập phí giao hợp lệ trước khi báo giá.', 'warning'); return;
      }
    }
    if (payload.action === 'declined' && !window.confirm('Từ chối yêu cầu báo giá này?')) return;
    button.disabled = true;
    try {
      await api.patch(`/api/admin/delivery-quote-requests/${encodeURIComponent(requestId)}`, payload);
      showToast(payload.action === 'quoted' ? 'Đã tạo báo giá. Gửi liên kết cho khách qua điện thoại/Zalo.' : 'Đã cập nhật yêu cầu.', 'success');
      await renderDeliveryQuoteRequests();
    } catch (error) {
      showToast(error.response?.data?.error?.message || 'Không cập nhật được báo giá.', 'error');
      button.disabled = false;
    }
  });
}

// ==========================================================================
// 12C. ĐIỀU PHỐI GIAO HOA & CHI PHÍ SHIP (SHIPPING & LOGISTICS MANAGEMENT)
// ==========================================================================
async function renderShippingLogisticsTab() {
  // 1. Tính toán 4 chỉ số KPI giao vận
  const validOrders = allOrders.filter(o => o.status !== 'cancelled');

  // Tổng tiền ship thu của khách từ các đơn hợp lệ
  const totalShippingFee = validOrders.reduce((sum, o) => {
    return sum + Number(o.shippingFee ?? o.shipping_fee ?? 0);
  }, 0);

  // Chi phí đối tác shipper ước tính (đối soát 1:1 dòng tiền thu hộ)
  const carrierCost = totalShippingFee;

  // Số chuyến đang giao trên đường
  const shippingCount = allOrders.filter(o => o.status === 'shipping').length;

  // Số đơn đã giao thành công
  const completedCount = allOrders.filter(o => o.status === 'completed').length;

  // Cập nhật DOM KPI
  const feeEl = document.querySelector('#logisticsTotalShippingFee');
  const carrierEl = document.querySelector('#logisticsCarrierCost');
  const shippingEl = document.querySelector('#logisticsShippingOrdersCount');
  const completedEl = document.querySelector('#logisticsCompletedOrdersCount');

  if (feeEl) feeEl.textContent = formatPrice(totalShippingFee);
  if (carrierEl) carrierEl.textContent = formatPrice(carrierCost);
  if (shippingEl) shippingEl.textContent = `${shippingCount} chuyến`;
  if (completedEl) completedEl.textContent = `${completedCount} đơn`;

  // 2. Cập nhật số đếm trên các filter pills
  const confirmedCount = allOrders.filter(o => o.status === 'confirmed').length;
  const deliveryOrders = allOrders.filter(o => ['shipping', 'confirmed', 'completed', 'pending'].includes(o.status));

  const countAll = document.querySelector('#countLogisticsAll');
  const countShip = document.querySelector('#countLogisticsShipping');
  const countConf = document.querySelector('#countLogisticsConfirmed');
  const countComp = document.querySelector('#countLogisticsCompleted');

  if (countAll) countAll.textContent = deliveryOrders.length;
  if (countShip) countShip.textContent = shippingCount;
  if (countConf) countConf.textContent = confirmedCount;
  if (countComp) countComp.textContent = completedCount;

  // 3. Render danh sách đơn theo filter
  renderLogisticsOrdersTable(deliveryOrders);

  // 4. Đồng thời nạp dữ liệu cho 2 subtab còn lại
  renderDeliveryQuoteRequests();
  renderDeliveryZoneRatesTable();
}

function renderLogisticsOrdersTable(orders = []) {
  const tbody = document.querySelector('#logisticsOrdersTableBody');
  if (!tbody) return;

  let filtered = [...orders];
  if (currentLogisticsFilter === 'shipping') {
    filtered = filtered.filter(o => o.status === 'shipping');
  } else if (currentLogisticsFilter === 'confirmed') {
    filtered = filtered.filter(o => o.status === 'confirmed');
  } else if (currentLogisticsFilter === 'completed') {
    filtered = filtered.filter(o => o.status === 'completed');
  }

  // Sắp xếp: đơn 'shipping' lên trước, rồi tới 'confirmed', rồi theo ngày mới nhất
  const statusPriority = { shipping: 1, confirmed: 2, pending: 3, completed: 4, cancelled: 5 };
  filtered.sort((a, b) => {
    const pA = statusPriority[a.status] || 99;
    const pB = statusPriority[b.status] || 99;
    if (pA !== pB) return pA - pB;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          Không có chuyến giao hoa nào trong mục này.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const isGift = Boolean(order.isGift && order.recipientName);
    const shipFee = Number(order.shippingFee ?? order.shipping_fee ?? 0);
    const total = Number(order.totalAmount ?? order.total_amount ?? 0);

    let statusBadge = '';
    if (order.status === 'shipping') {
      statusBadge = '<span class="status-badge" style="background:#FEF3C7; color:#D97706; font-weight:700;">🚚 Đang Giao</span>';
    } else if (order.status === 'confirmed') {
      statusBadge = '<span class="status-badge" style="background:#E0F2FE; color:#0284C7; font-weight:700;">📦 Đã Duyệt Chờ Giao</span>';
    } else if (order.status === 'completed') {
      statusBadge = '<span class="status-badge" style="background:#DCFCE7; color:#16A34A; font-weight:700;">✅ Đã Giao Xong</span>';
    } else if (order.status === 'pending') {
      statusBadge = '<span class="status-badge" style="background:#F1F5F9; color:#475569; font-weight:600;">⏳ Chờ Xử Lý</span>';
    } else {
      statusBadge = `<span class="status-badge">${escapeHTML(order.status)}</span>`;
    }

    const hasCoords = Number.isFinite(Number(order.deliveryLatitude)) && Number.isFinite(Number(order.deliveryLongitude));
    const mapLink = hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLatitude},${order.deliveryLongitude}`
      : '';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">#${escapeHTML(order.orderCode || order.id)}</div>
          <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 3px;">
            👤 ${escapeHTML(order.customerName || 'Khách vãng lai')} · <a href="tel:${escapeHTML(order.customerPhone || '')}" style="color:var(--text-secondary); text-decoration:none;">📞 ${escapeHTML(order.customerPhone || '---')}</a>
          </div>
          ${isGift ? `
            <div style="font-size: 11.5px; color: #D9536F; font-weight: 600; margin-top: 3px; display:inline-flex; align-items:center; gap:3px;">
              🎁 Tặng: ${escapeHTML(order.recipientName)} ${order.recipientPhone ? `(${escapeHTML(order.recipientPhone)})` : ''}
            </div>
          ` : ''}
        </td>
        <td>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">
            📍 ${escapeHTML(order.shippingAddress || 'Nhận tại cửa hàng')}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ${escapeHTML(order.deliveryZone || order.deliveryArea || 'TP.HCM')}
          </div>
          ${mapLink ? `
            <a href="${mapLink}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; font-size: 11.5px; color: #108474; font-weight: 600; text-decoration:none; margin-top: 4px;">
              🗺️ Chỉ đường Map (${Number(order.deliveryLatitude).toFixed(3)}, ${Number(order.deliveryLongitude).toFixed(3)}) ↗
            </a>
          ` : ''}
        </td>
        <td>
          <div style="font-size: 13px; font-weight: 700; color: #0D9488;">
            📅 ${escapeHTML(order.deliveryDate || 'Trong ngày')}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ⏰ ${escapeHTML(order.deliverySlot || 'Khung giờ chuẩn')}
          </div>
        </td>
        <td>
          <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">
            Phí ship: <span style="color: #0284C7;">${shipFee > 0 ? formatPrice(shipFee) : 'Miễn phí'}</span>
          </div>
          <div style="font-size: 12px; margin-top: 2px;">
            ${order.paymentMethod === 'cod'
              ? `Thu COD: <strong style="color: #D92D20;">${formatPrice(total)}</strong>`
              : `<span style="color: #16A34A; font-weight: 600;">✓ SePay Đã Thu</span>`}
          </div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary btn-print-gift-slip" data-id="${order.id}" title="Xuất phiếu giao hoa quà tặng PDF cho tài xế" style="padding: 6px 10px; font-size: 12px; font-weight: 600; color: #108474; border-color: #108474;">
              📄 Phiếu Giao Quà
            </button>
            <button type="button" class="btn-secondary btn-view-logistics-order" data-id="${order.id}" title="Xem chi tiết đơn" style="padding: 6px 10px; font-size: 12px;">
              👁️ Chi Tiết
            </button>
            ${order.status === 'confirmed' ? `
              <button type="button" class="btn-primary btn-logistics-advance-ship" data-id="${order.id}" style="padding: 6px 10px; font-size: 12px; background: #F59E0B; border-color: #F59E0B;">
                🚚 Giao Hàng
              </button>
            ` : ''}
            ${order.status === 'shipping' ? `
              <button type="button" class="btn-primary btn-logistics-advance-complete" data-id="${order.id}" style="padding: 6px 10px; font-size: 12px; background: #16A34A; border-color: #16A34A;">
                ✅ Đã Giao Xong
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderDeliveryZoneRatesTable(filterKeyword = '') {
  const container = document.querySelector('#deliveryZoneTableContainer');
  if (!container) return;

  const keyword = filterKeyword.toLowerCase().trim();
  const rows = [];

  (DELIVERY_AREA_GROUPS || []).forEach(group => {
    (group.areas || []).forEach(area => {
      if (!keyword || area.toLowerCase().includes(keyword) || group.label.toLowerCase().includes(keyword)) {
        const rate = (DELIVERY_AREA_RATES && DELIVERY_AREA_RATES[area]) || { zoneName: group.label, fee: 35000 };
        rows.push({
          area,
          group: group.label,
          zoneName: rate.zoneName || group.label,
          fee: rate.fee
        });
      }
    });
  });

  if (rows.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Không tìm thấy phường/xã nào khớp với từ khóa tìm kiếm.</div>';
    return;
  }

  container.innerHTML = `
    <table class="admin-table" style="font-size: 13px;">
      <thead>
        <tr>
          <th>Tên Phường/Xã Hiện Hành</th>
          <th>Quận / Khu Vực Cũ</th>
          <th>Vùng Giao Hàng</th>
          <th style="text-align: right;">Cước Phí Vận Chuyển Cố Định</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td style="font-weight: 600; color: var(--text-main);">📍 ${escapeHTML(r.area)}</td>
            <td style="color: var(--text-secondary);">${escapeHTML(r.group)}</td>
            <td><span class="status-badge" style="background:#F1F5F9; color:#334155;">${escapeHTML(r.zoneName)}</span></td>
            <td style="text-align: right; font-weight: 700; color: ${r.fee === 0 ? '#16A34A' : '#108474'};">
              ${r.fee === 0 ? 'Miễn Phí (Nội bộ tiệm)' : formatPrice(r.fee)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function initShippingLogistics() {
  const refreshBtn = document.querySelector('#refreshShippingLogisticsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      try {
        allOrders = await fetchOrders();
        await renderShippingLogisticsTab();
        showToast('Đã làm mới dữ liệu vận hành & chi phí ship!', 'success');
      } catch (err) {
        showToast('Không thể làm mới dữ liệu!', 'error');
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  // Chuyển đổi Sub-tabs nội bộ
  const subtabBtns = document.querySelectorAll('.logistics-subtab-btn');
  const subpanels = document.querySelectorAll('.logistics-subpanel');

  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.dataset.subtab;
      currentLogisticsSubtab = targetSubtab;

      subtabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      subpanels.forEach(p => p.classList.remove('active'));
      const activePanel = document.querySelector(`#subpanel-logistics-${targetSubtab}`);
      if (activePanel) activePanel.classList.add('active');

      if (targetSubtab === 'quotes') {
        renderDeliveryQuoteRequests();
      } else if (targetSubtab === 'rates') {
        renderDeliveryZoneRatesTable();
      }
    });
  });

  // Lọc Filter Pills
  const filterPills = document.querySelectorAll('.logistics-filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentLogisticsFilter = pill.dataset.filter || 'all';

      const deliveryOrders = allOrders.filter(o => ['shipping', 'confirmed', 'completed', 'pending'].includes(o.status));
      renderLogisticsOrdersTable(deliveryOrders);
    });
  });

  // Ô tìm kiếm 78 phường
  const zoneSearchInput = document.querySelector('#searchDeliveryZoneInput');
  if (zoneSearchInput) {
    zoneSearchInput.addEventListener('input', e => {
      renderDeliveryZoneRatesTable(e.target.value);
    });
  }

  // Ủy quyền sự kiện bảng điều phối chuyến giao
  const tbody = document.querySelector('#logisticsOrdersTableBody');
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const printBtn = e.target.closest('.btn-print-gift-slip');
      if (printBtn) {
        const orderId = printBtn.dataset.id;
        const order = allOrders.find(o => String(o.id) === String(orderId));
        if (order) {
          try {
            await exportGiftDeliverySlipPdf(order, { autoDownload: true });
            showToast(`Đã xuất phiếu giao quà tặng cho đơn #${order.orderCode || order.id}!`, 'success');
          } catch (err) {
            console.error('Lỗi xuất phiếu giao:', err);
            showToast('Không thể xuất file PDF phiếu giao quà!', 'error');
          }
        }
        return;
      }

      const viewBtn = e.target.closest('.btn-view-logistics-order');
      if (viewBtn) {
        const orderId = viewBtn.dataset.id;
        const order = allOrders.find(o => String(o.id) === String(orderId));
        if (order && typeof openOrderDetailModalRef === 'function') {
          openOrderDetailModalRef(order);
        }
        return;
      }

      const shipBtn = e.target.closest('.btn-logistics-advance-ship');
      if (shipBtn) {
        const orderId = shipBtn.dataset.id;
        try {
          await updateOrderStatus(orderId, 'shipping');
          showToast(`Đơn hàng #${orderId} đã chuyển sang trạng thái: Đang Giao Hoa 🚚`, 'success');
          allOrders = await fetchOrders();
          updateSidebarBadges();
          renderShippingLogisticsTab();
        } catch (err) {
          showToast('Lỗi cập nhật trạng thái đơn hàng!', 'error');
        }
        return;
      }

      const completeBtn = e.target.closest('.btn-logistics-advance-complete');
      if (completeBtn) {
        const orderId = completeBtn.dataset.id;
        try {
          await updateOrderStatus(orderId, 'completed');
          showToast(`Đơn hàng #${orderId} đã giao thành công và hoàn tất! ✅`, 'success');
          allOrders = await fetchOrders();
          updateSidebarBadges();
          renderShippingLogisticsTab();
        } catch (err) {
          showToast('Lỗi cập nhật trạng thái đơn hàng!', 'error');
        }
        return;
      }
    });
  }
}

// ==========================================================================
// 13. KHỞI TẠO TỔNG THỂ DỮ LIỆU BAN ĐẦU
// ==========================================================================
async function loadAllData() {
  try {
    const [categories, products, banners, promotions, orders, users, refunds, unmatchedPayments] = await Promise.all([
      fetchCategories().catch(e => { console.warn('Lỗi nạp danh mục:', e); return []; }),
      fetchProducts({ activeOnly: false }).catch(e => { console.warn('Lỗi nạp sản phẩm:', e); return []; }),
      fetchAllBanners().catch(e => { console.warn('Lỗi nạp banners:', e); return []; }),
      fetchAllPromotions().catch(e => { console.warn('Lỗi nạp khuyến mãi:', e); return []; }),
      fetchOrders().catch(e => { console.warn('Lỗi nạp đơn hàng:', e); return []; }),
      fetchAllUsers().catch(e => { console.warn('Lỗi nạp người dùng:', e); return []; }),
      fetchAllRefunds().catch(e => { console.warn('Lỗi nạp hoàn tiền:', e); return []; }),
      fetchUnmatchedPayments().catch(e => { console.warn('Lỗi nạp giao dịch đối soát:', e); return []; })
    ]);

    allCategories = categories || [];
    allProducts = products || [];
    allBanners = banners || [];
    allPromotions = promotions || [];
    allOrders = orders || [];
    allUsers = users || [];
    allRefunds = refunds || [];
    allUnmatchedPayments = unmatchedPayments || [];

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
    initDeliveryQuoteManagement();
    initShippingLogistics();
    initRefundManagement();
    initStatistics();
    initUserManagement();
    initConfirmModal();

    // Render tab ban đầu (Dashboard) & Kích hoạt polling cập nhật live badge
    renderDashboard();
    setupAdminLivePolling();
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

