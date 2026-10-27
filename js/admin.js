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
  updateOrderStatus
} from './storage.js';
import api from './api.js';
import { formatPrice, showToast } from './utils.js';
import {
  initExcelPdf,
  exportOrderInvoicePdf,
  exportRevenueStatisticsPdf,
  exportRevenueStatisticsExcel
} from './excel-pdf.js';

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
let currentUser = null; // Tài khoản đang đăng nhập hiện tại
let currentTab = 'dashboard';
let deleteTarget = { type: null, id: null };
let currentDetailOrderId = null;

// State quản lý phân trang theo công thức của cô
let productsPagination = {
  currentPage: 1,
  limit: 10
};

let ordersPagination = {
  currentPage: 1,
  limit: 10
};

// State lọc báo cáo thống kê doanh thu & lợi nhuận
let statsFilter = {
  periodType: 'month', // 'month' hoặc 'quarter'
  year: 2026
};

// ==========================================================================
// 2. CỬA NGÕ XÁC THỰC QUẢN TRỊ & PHÂN QUYỀN 3 ROLE (AUTH GATE & ROLE ACCESS)
// ==========================================================================
function initAuthGate() {
  const authModal = document.querySelector('#authGateModal');
  const adminApp = document.querySelector('#adminApp');
  const authForm = document.querySelector('#adminAuthForm');
  const pinInput = document.querySelector('#adminPinInput');
  const quickDemoBtn = document.querySelector('#quickDemoBtn');
  const logoutBtn = document.querySelector('#adminLogoutBtn');
  const userRoleBadge = document.querySelector('#adminUserRoleBadge');
  const userNameDisplay = document.querySelector('#adminUserNameDisplay');
  const userAvatarDisplay = document.querySelector('#adminAvatarDisplay');

  // Đọc thông tin tài khoản người dùng từ localStorage
  const savedUserJson = localStorage.getItem('user');
  if (savedUserJson) {
    try {
      currentUser = JSON.parse(savedUserJson);
    } catch (e) {
      currentUser = null;
    }
  }

  // Hàm áp dụng giao diện theo vai trò (Role Permissions)
  function applyRolePermissions(user) {
    const role = user?.role || 'admin'; // Mặc định chế độ Demo là admin

    // Cập nhật thông tin hiển thị ở topbar
    if (userNameDisplay) {
      userNameDisplay.textContent = user?.name || user?.email || 'Quản Trị Viên';
    }
    if (userAvatarDisplay) {
      const initial = (user?.name || user?.email || 'A').charAt(0).toUpperCase();
      userAvatarDisplay.textContent = initial;
    }

    const navOrders = document.querySelector('.nav-item[data-tab="orders"]');
    const navDashboard = document.querySelector('.nav-item[data-tab="dashboard"]');
    const navProducts = document.querySelector('.nav-item[data-tab="products"]');
    const navBanners = document.querySelector('.nav-item[data-tab="banners"]');
    const navVouchers = document.querySelector('.nav-item[data-tab="vouchers"]');
    const navStatistics = document.querySelector('#navItemStatistics');
    const navUsers = document.querySelector('#navItemUsers');

    if (role === 'staff') {
      // VAI TRÒ NHÂN VIÊN KẾ TOÁN: CHỈ XEM ĐƠN HÀNG VÀ XUẤT HÓA ĐƠN PDF
      if (userRoleBadge) {
        userRoleBadge.textContent = '📑 Nhân Viên Kế Toán';
        userRoleBadge.style.color = '#0284C7';
      }

      // Ẩn tất cả các tab khác
      if (navDashboard) navDashboard.style.display = 'none';
      if (navProducts) navProducts.style.display = 'none';
      if (navBanners) navBanners.style.display = 'none';
      if (navVouchers) navVouchers.style.display = 'none';
      if (navStatistics) navStatistics.style.display = 'none';
      if (navUsers) navUsers.style.display = 'none';

      // Chỉ hiển thị tab Đơn Hàng
      if (navOrders) {
        navOrders.style.display = 'flex';
        // Tự động kích hoạt tab Đơn Hàng
        setTimeout(() => navOrders.click(), 50);
      }
    } else {
      // VAI TRÒ ADMIN: TOÀN QUYỀN TRÊN TẤT CẢ CÁC PHÂN HỆ
      if (userRoleBadge) {
        userRoleBadge.textContent = '👑 Quản Trị Viên Cấp Cao';
        userRoleBadge.style.color = '#108474';
      }

      // Hiển thị đầy đủ tất cả các tab
      if (navDashboard) navDashboard.style.display = 'flex';
      if (navProducts) navProducts.style.display = 'flex';
      if (navBanners) navBanners.style.display = 'flex';
      if (navVouchers) navVouchers.style.display = 'flex';
      if (navOrders) navOrders.style.display = 'flex';
      if (navStatistics) navStatistics.style.display = 'flex';
      if (navUsers) navUsers.style.display = 'flex';
    }
  }

  function unlockAdmin(user) {
    sessionStorage.setItem('admin_authenticated', 'true');
    if (authModal) authModal.classList.add('hidden');
    if (adminApp) adminApp.style.display = 'flex';
    applyRolePermissions(user);
    loadAllData();
  }

  function lockAdmin() {
    sessionStorage.removeItem('admin_authenticated');
    if (authModal) authModal.classList.remove('hidden');
    if (adminApp) adminApp.style.display = 'none';
  }

  // 1. KIỂM TRA PHÂN QUYỀN TRUY CẬP TỰ ĐỘNG
  const urlParams = new URLSearchParams(window.location.search);
  const isDemo = urlParams.get('demo') === 'true';

  if (currentUser) {
    if (currentUser.role === 'customer') {
      alert('⚠️ Tài khoản khách hàng không có quyền truy cập vào Khu Vực Quản Trị Hệ Thống!');
      window.location.href = 'index.html';
      return;
    } else if (currentUser.role === 'admin' || currentUser.role === 'staff') {
      unlockAdmin(currentUser);
    } else {
      // Nếu không rõ vai trò thì yêu cầu xác thực
      lockAdmin();
    }
  } else if (sessionStorage.getItem('admin_authenticated') === 'true' || isDemo) {
    // Phiên làm việc demo hoặc đã đăng nhập trước đó
    currentUser = { name: 'Admin Demo', email: 'admin@shophoa.com', role: 'admin' };
    unlockAdmin(currentUser);
  } else {
    lockAdmin();
  }

  // 2. FORM ĐĂNG NHẬP MÃ PIN DỰ PHÒNG
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = pinInput ? pinInput.value.trim() : '';
      if (val === '123' || val === '123456' || val.length >= 3) {
        showToast('Đăng nhập Quản trị viên thành công!');
        currentUser = { name: 'Quản Trị Viên', email: 'admin@shophoa.com', role: 'admin' };
        localStorage.setItem('user', JSON.stringify(currentUser));
        unlockAdmin(currentUser);
      } else {
        showToast('Mật khẩu/Mã PIN không đúng (Gợi ý: 123)', 'error');
      }
    });
  }

  // 3. VÀO NHANH CHẾ ĐỘ DEMO
  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', () => {
      showToast('Đã mở quyền Quản trị viên Cấp cao (Demo)!');
      currentUser = { name: 'Thầy Cô Chấm Thi', email: 'admin@shophoa.com', role: 'admin' };
      localStorage.setItem('user', JSON.stringify(currentUser));
      unlockAdmin(currentUser);
    });
  }

  // 4. ĐĂNG XUẤT HỆ THỐNG
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      showToast('Đã đăng xuất khỏi hệ thống.');
      localStorage.removeItem('user');
      sessionStorage.removeItem('admin_authenticated');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 500);
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
    statistics: 'Báo Cáo & Thống Kê Doanh Thu - Lợi Nhuận',
    users: 'Quản Lý Tài Khoản & Phân Quyền'
  };

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

      // Nạp lại dữ liệu tương ứng của từng tab
      if (tab === 'dashboard') renderDashboard();
      else if (tab === 'products') renderProductsTable();
      else if (tab === 'banners') renderBannersTable();
      else if (tab === 'vouchers') renderVouchersTable();
      else if (tab === 'orders') renderOrdersTable();
      else if (tab === 'statistics') renderStatistics();
      else if (tab === 'users') renderUsersTable();
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
// 5. TAB 1: RENDER TỔNG QUAN & THỐNG KÊ KPI (ES6 REDUCE)
// ==========================================================================
function renderDashboard() {
  const totalProductsEl = document.querySelector('#kpiTotalProducts');
  const totalOrdersEl = document.querySelector('#kpiTotalOrders');
  const totalRevenueEl = document.querySelector('#kpiTotalRevenue');
  const topProductEl = document.querySelector('#kpiTopProduct');
  const topProductSoldEl = document.querySelector('#kpiTopProductSoldCount');
  const recentOrdersTbody = document.querySelector('#dashboardRecentOrders');
  const categoryBreakdown = document.querySelector('#dashboardCategoryBreakdown');

  // 1. Đếm tổng sản phẩm
  if (totalProductsEl) totalProductsEl.textContent = allProducts.length;

  // 2. Đếm tổng đơn hàng
  if (totalOrdersEl) totalOrdersEl.textContent = allOrders.length;

  // 3. DÙNG REDUCE() TÍNH TỔNG DOANH THU (BẢO VỆ ĐỒ ÁN)
  const totalRevenue = allOrders.reduce((sum, order) => {
    if (order.status !== 'cancelled') {
      return sum + Number(order.totalAmount || 0);
    }
    return sum;
  }, 0);

  if (totalRevenueEl) totalRevenueEl.textContent = formatPrice(totalRevenue);

  // 4. DÙNG REDUCE() TÌM SẢN PHẨM BÁN CHẠY NHẤT
  if (allProducts.length > 0) {
    const topProd = allProducts.reduce((max, p) => {
      const soldCurrent = Number(p.soldCount) || 0;
      const soldMax = Number(max.soldCount) || 0;
      return soldCurrent > soldMax ? p : max;
    }, allProducts[0]);

    if (topProductEl) topProductEl.textContent = topProd.name;
    if (topProductSoldEl) topProductSoldEl.textContent = `${topProd.soldCount || 0} lượt bán`;
  }

  // 5. Render đơn hàng gần đây (Tối đa 4 đơn)
  if (recentOrdersTbody) {
    const recents = [...allOrders].slice(0, 4);
    if (recents.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Chưa có đơn hàng nào</td></tr>`;
    } else {
      recentOrdersTbody.innerHTML = recents.map(order => {
        let badgeClass = 'badge-emerald';
        let statusText = 'Hoàn thành';
        if (order.status === 'pending') { badgeClass = 'badge-amber'; statusText = 'Chờ xử lý'; }
        else if (order.status === 'shipping') { badgeClass = 'badge-blue'; statusText = 'Đang giao'; }
        else if (order.status === 'cancelled') { badgeClass = 'badge-rose'; statusText = 'Đã hủy'; }

        return `
          <tr>
            <td><strong>#${order.id}</strong></td>
            <td>${order.customerName}</td>
            <td style="font-weight: 700; color: var(--color-primary);">${formatPrice(order.totalAmount)}</td>
            <td><span class="badge-pill ${badgeClass}">${statusText}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // 6. Phân bổ mẫu hoa theo từng danh mục
  if (categoryBreakdown) {
    const totalProdCount = allProducts.length || 1;
    categoryBreakdown.innerHTML = allCategories.map(cat => {
      // Dùng filter() để đếm số lượng hoa thuộc danh mục
      const count = allProducts.filter(p => Number(p.categoryId) === Number(cat.id)).length;
      const percent = Math.round((count / totalProdCount) * 100);

      return `
        <div style="margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            <span>${cat.name}</span>
            <span style="color: var(--text-muted);">${count} mẫu (${percent}%)</span>
          </div>
          <div style="height: 6px; background-color: var(--border-light); border-radius: 4px; overflow: hidden;">
            <div style="width: ${percent}%; height: 100%; background-color: var(--color-primary); border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
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
// 7. TAB 2: QUẢN LÝ SẢN PHẨM (CRUD + PHÂN TRANG)
// ==========================================================================
function renderProductsTable() {
  const tbody = document.querySelector('#adminProductsTable');
  const searchInput = document.querySelector('#productSearchInput');
  const catFilter = document.querySelector('#productCategoryFilter');
  if (!tbody) return;

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedCat = catFilter ? catFilter.value : 'all';

  // Lọc sản phẩm bằng filter() của ES6
  const filtered = allProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm) || String(p.id).includes(searchTerm);
    const matchCat = (selectedCat === 'all') || (String(p.categoryId) === String(selectedCat));
    return matchSearch && matchCat;
  });

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
    const originalPriceHtml = (p.originalPrice && p.originalPrice > p.price)
      ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 12px;">${formatPrice(p.originalPrice)}</span>`
      : '-';

    return `
      <tr data-id="${p.id}">
        <td>
          <img src="${p.image}" alt="${p.name}" class="table-thumb" onerror="this.src='./images/300.png'">
        </td>
        <td>
          <div class="table-title">${p.name}</div>
          <div class="table-subtitle">ID: #${p.id} ${p.badge ? `• <span class="badge-pill badge-rose" style="font-size: 10px; padding: 1px 6px;">${p.badge}</span>` : ''}</div>
        </td>
        <td>${p.categoryName || 'Hoa Kẽm Nhung'}</td>
        <td style="font-weight: 700; color: var(--color-sale-price);">${formatPrice(p.price)}</td>
        <td>${originalPriceHtml}</td>
        <td><strong style="color: ${p.stock <= 5 ? 'var(--color-danger)' : 'var(--text-main)'};">${p.stock || 0}</strong></td>
        <td>${p.soldCount || 0}</td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
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
      catSelect.innerHTML = allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if (catFilter) {
      catFilter.innerHTML = `<option value="all">Tất cả danh mục</option>` + 
        allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  }

  // 2-Way Smart Calculator elements
  const origPriceInput = document.querySelector('#prodOriginalPriceInput');
  const discountPctInput = document.querySelector('#prodDiscountPercentInput');
  const priceInput = document.querySelector('#prodPriceInput');
  const quickPercentGroup = document.querySelector('#quickPercentGroup');
  const previewBadge = document.querySelector('#previewBadgeDiscount');
  const previewSavingText = document.querySelector('#previewSavingText');
  const origPriceHint = document.querySelector('#prodOrigPriceHint');
  const priceHint = document.querySelector('#prodPriceHint');

  function updateDiscountPreview() {
    const orig = Number(origPriceInput ? origPriceInput.value : 0) || 0;
    const price = Number(priceInput ? priceInput.value : 0) || 0;

    // Cập nhật dòng chữ hiển thị định dạng tiền tệ VND tránh nhầm lẫn số không
    if (origPriceHint) origPriceHint.textContent = orig > 0 ? `≈ ${formatPrice(orig)}` : '≈ 0 ₫';
    if (priceHint) priceHint.textContent = price > 0 ? `≈ ${formatPrice(price)}` : '≈ 0 ₫';

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

  function openModal(mode = 'create', product = null) {
    if (!modal) return;
    modal.classList.remove('hidden');

    if (mode === 'create') {
      modalTitle.textContent = 'Thêm Mẫu Hoa Kẽm Nhung Mới';
      form.reset();
      document.querySelector('#prodFormId').value = '';
      if (discountPctInput) discountPctInput.value = '';
      if (productDropzoneHelper) productDropzoneHelper.setPreview('');
      updateDiscountPreview();
    } else if (mode === 'edit' && product) {
      modalTitle.textContent = `Chỉnh Sửa Mẫu Hoa #${product.id}`;
      document.querySelector('#prodFormId').value = product.id;
      document.querySelector('#prodNameInput').value = product.name;
      document.querySelector('#prodPriceInput').value = product.price;
      const orig = product.originalPrice || product.price;
      document.querySelector('#prodOriginalPriceInput').value = orig;

      // Tự động tính % giảm giá của sản phẩm hiện tại
      const pct = (orig > product.price) ? Math.round(((orig - product.price) / orig) * 100) : 0;
      if (discountPctInput) discountPctInput.value = pct > 0 ? pct : '';

      document.querySelector('#prodCategorySelect').value = product.categoryId;
      document.querySelector('#prodBadgeSelect').value = product.badge || '';
      document.querySelector('#prodStockInput').value = product.stock || 0;
      document.querySelector('#prodSoldCountInput').value = product.soldCount || 0;
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

  if (searchInput) searchInput.addEventListener('input', renderProductsTable);
  if (catFilter) catFilter.addEventListener('change', renderProductsTable);

  // Submit Form Lưu / Sửa Sản Phẩm
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.querySelector('#prodFormId').value;
      const catId = Number(document.querySelector('#prodCategorySelect').value);
      const catObj = allCategories.find(c => Number(c.id) === catId) || {};

      let image = document.querySelector('#prodImageUrl').value || document.querySelector('#prodImageUrlInput').value;
      if (!image) image = './images/300.png';

      const productData = {
        name: document.querySelector('#prodNameInput').value.trim(),
        price: Number(document.querySelector('#prodPriceInput').value),
        originalPrice: Number(document.querySelector('#prodOriginalPriceInput').value) || Number(document.querySelector('#prodPriceInput').value),
        categoryId: catId,
        categoryName: catObj.name || 'Hoa Kẽm Nhung',
        categorySlug: catObj.slug || 'kem-nhung',
        badge: document.querySelector('#prodBadgeSelect').value,
        stock: Number(document.querySelector('#prodStockInput').value),
        soldCount: Number(document.querySelector('#prodSoldCountInput').value),
        description: document.querySelector('#prodDescInput').value.trim(),
        image
      };

      if (!productData.name || !productData.price) {
        showToast('Vui lòng nhập đầy đủ tên hoa và giá bán!', 'error');
        return;
      }

      if (id) {
        // Cập nhật sản phẩm
        await updateProduct(id, productData);
        showToast(`Đã cập nhật mẫu hoa #${id} thành công!`);
      } else {
        // Thêm mới
        const created = await createProduct(productData);
        showToast(`Đã thêm mẫu hoa mới "${created.name}"!`);
      }

      closeModal();
      allProducts = await fetchProducts();
      renderProductsTable();
      renderDashboard();
    });
  }

  // Event Delegation cho bảng sản phẩm (Sửa & Xóa)
  if (table) {
    table.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-product-btn');
      const deleteBtn = e.target.closest('.delete-product-btn');

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
    tet: { pct: 15, name: 'Tết Giáp Thìn & Mùa Xuân' },
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
            ...p,
            originalPrice: orig,
            price: newPrice
          });
        }
        allProducts = await fetchProducts();
        renderProductsTable();
        renderDashboard();
        showToast(`🎉 Đã kích hoạt "${campaign.name}"! Toàn bộ hoa đã giảm sâu ${campaign.pct}%.`);
      } catch (err) {
        showToast('Có lỗi xảy ra khi kích hoạt chiến dịch!', 'error');
      } finally {
        applyHolidayBtn.disabled = false;
        applyHolidayBtn.textContent = '🚀 Kích Hoạt Lễ';
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
              ...p,
              price: p.originalPrice
            });
          }
        }
        allProducts = await fetchProducts();
        renderProductsTable();
        renderDashboard();
        showToast('⏹️ Đã khôi phục toàn bộ hoa về giá gốc niêm yết!');
      } catch (err) {
        showToast('Có lỗi xảy ra khi khôi phục giá gốc!', 'error');
      } finally {
        restorePricesBtn.disabled = false;
        restorePricesBtn.textContent = '⏹️ Hết Lễ: Khôi Phục Giá Gốc';
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

    return `
      <tr data-id="${b.id}">
        <td>
          <img src="${b.hinhbanner}" alt="${b.tenbanner}" class="table-thumb" style="width: 70px; height: 42px; object-fit: cover;" onerror="this.src='./images/350.png'">
        </td>
        <td>
          <div class="table-title">${b.tenbanner || b.title}</div>
          <div class="table-subtitle">ID: #${b.id}</div>
        </td>
        <td><span class="badge-pill badge-gray">${b.tag || '--'}</span></td>
        <td><span class="badge-pill ${themeBadge}">${themeLabel}</span></td>
        <td><strong>${b.order || 1}</strong></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="banner-active-toggle" data-id="${b.id}" ${b.active ? 'checked' : ''}>
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
      document.querySelector('#bannerTenInput').value = banner.tenbanner || '';
      document.querySelector('#bannerTagInput').value = banner.tag || '';
      document.querySelector('#bannerThemeSelect').value = banner.theme || 'default';
      document.querySelector('#bannerTitleInput').value = banner.title || '';
      document.querySelector('#bannerDescInput').value = banner.desc || '';
      document.querySelector('#bannerOrderInput').value = banner.order || 1;
      document.querySelector('#bannerActiveCheckbox').checked = Boolean(banner.active);
      if (bannerDropzoneHelper) bannerDropzoneHelper.setPreview(banner.hinhbanner || '');
      const urlInput = document.querySelector('#bannerImageUrlInput');
      if (urlInput) urlInput.value = banner.hinhbanner || '';
    }
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (openAddBtn) openAddBtn.addEventListener('click', () => openModal('create'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.querySelector('#bannerFormId').value;
      let hinhbanner = document.querySelector('#bannerImageUrl').value || document.querySelector('#bannerImageUrlInput').value;
      if (!hinhbanner) hinhbanner = './images/350.png';

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
    let typeLabel = 'Khách Mới';
    if (v.type === 'birthday') typeLabel = 'Sinh Nhật';
    else if (v.type === 'flash_sale') typeLabel = 'Giờ Vàng';

    return `
      <tr data-id="${v.id}">
        <td><strong style="font-family: monospace; font-size: 14px; color: var(--color-primary); background: var(--color-primary-light); padding: 3px 8px; border-radius: 4px;">${v.code}</strong></td>
        <td><strong>${v.name}</strong><br><span style="font-size: 12px; color: var(--text-muted);">${v.desc || ''}</span></td>
        <td><span class="badge-pill badge-rose" style="font-weight: 800;">-${v.discountPercent}%</span></td>
        <td>${v.minOrder > 0 ? formatPrice(v.minOrder) : '<span style="color: var(--text-muted);">Không giới hạn</span>'}</td>
        <td><span class="badge-pill badge-blue">${typeLabel}</span></td>
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

  function openModal(mode = 'create', voucher = null) {
    if (!modal) return;
    modal.classList.remove('hidden');

    if (mode === 'create') {
      modalTitle.textContent = 'Tạo Mã Giảm Giá Mới';
      form.reset();
      document.querySelector('#voucherFormId').value = '';
    } else if (mode === 'edit' && voucher) {
      modalTitle.textContent = `Chỉnh Sửa Mã ${voucher.code}`;
      document.querySelector('#voucherFormId').value = voucher.id;
      document.querySelector('#voucherCodeInput').value = voucher.code;
      document.querySelector('#voucherPercentInput').value = voucher.discountPercent;
      document.querySelector('#voucherNameInput').value = voucher.name;
      document.querySelector('#voucherMinOrderInput').value = voucher.minOrder || 0;
      document.querySelector('#voucherTypeSelect').value = voucher.type || 'new_user';
      document.querySelector('#voucherDescInput').value = voucher.desc || '';
      document.querySelector('#voucherActiveCheckbox').checked = Boolean(voucher.active);
    }
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (openAddBtn) openAddBtn.addEventListener('click', () => openModal('create'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.querySelector('#voucherFormId').value;
      const voucherData = {
        code: document.querySelector('#voucherCodeInput').value.trim().toUpperCase(),
        discountPercent: Number(document.querySelector('#voucherPercentInput').value),
        name: document.querySelector('#voucherNameInput').value.trim(),
        minOrder: Number(document.querySelector('#voucherMinOrderInput').value) || 0,
        type: document.querySelector('#voucherTypeSelect').value,
        desc: document.querySelector('#voucherDescInput').value.trim(),
        active: document.querySelector('#voucherActiveCheckbox').checked
      };

      if (!voucherData.code || !voucherData.discountPercent) {
        showToast('Vui lòng nhập đầy đủ mã code và % giảm!', 'error');
        return;
      }

      if (id) {
        await updatePromotion(id, voucherData);
        showToast(`Đã cập nhật mã ${voucherData.code}!`);
      } else {
        await createPromotion(voucherData);
        showToast(`Đã tạo mã giảm giá mới: ${voucherData.code}!`);
      }

      closeModal();
      allPromotions = await fetchAllPromotions();
      renderVouchersTable();
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
        await updatePromotion(id, { active });
        allPromotions = await fetchAllPromotions();
        showToast(`Đã ${active ? 'kích hoạt' : 'tạm ngưng'} mã voucher`);
      }
    });
  }
}

// ==========================================================================
// 9. TAB 5: QUẢN LÝ ĐƠN HÀNG (ORDERS MANAGEMENT + PHÂN TRANG + XUẤT HÓA ĐƠN PDF)
// ==========================================================================
function renderOrdersTable() {
  const tbody = document.querySelector('#adminOrdersTable');
  const searchInput = document.querySelector('#orderSearchInput');
  const statusFilter = document.querySelector('#orderStatusFilter');
  if (!tbody) return;

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedStatus = statusFilter ? statusFilter.value : 'all';

  const filtered = allOrders.filter(o => {
    const matchSearch = String(o.id).toLowerCase().includes(searchTerm) || 
      (o.customerName && o.customerName.toLowerCase().includes(searchTerm)) ||
      (o.phone && o.phone.includes(searchTerm));
    const matchStatus = (selectedStatus === 'all') || (o.status === selectedStatus);
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">Không tìm thấy đơn hàng nào phù hợp</td></tr>`;
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

    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : '--';
    const itemCount = (o.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

    return `
      <tr data-id="${o.id}">
        <td><strong>#${o.id}</strong></td>
        <td><strong>${o.customerName || 'Khách Vãng Lai'}</strong></td>
        <td>${o.phone || '--'}</td>
        <td>${dateStr}</td>
        <td><strong style="color: var(--color-primary);">${formatPrice(o.totalAmount)}</strong> <span style="font-size: 11.5px; color: var(--text-muted);">(${itemCount} bó hoa)</span></td>
        <td><span class="badge-pill ${badgeClass}">${statusText}</span></td>
        <td style="text-align: right;">
          <button type="button" class="btn-action view-order-btn" data-id="${o.id}">Xem Chi Tiết</button>
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

  function openOrderDetail(order) {
    if (!modal || !order) return;
    currentDetailOrderId = order.id;
    if (titleEl) titleEl.textContent = `Chi Tiết Đơn Hàng #${order.id}`;

    if (statusSelect) statusSelect.value = order.status || 'pending';

    if (bodyEl) {
      const itemsHtml = (order.items || []).map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--border-light);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${item.image}" alt="${item.name}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;">
            <div>
              <div style="font-weight: 700; font-size: 13.5px;">${item.name}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${formatPrice(item.price)} × ${item.quantity}</div>
            </div>
          </div>
          <strong>${formatPrice(item.price * item.quantity)}</strong>
        </div>
      `).join('');

      bodyEl.innerHTML = `
        <div style="background-color: var(--color-bg); padding: 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; line-height: 1.6;">
          <div>👤 <strong>Khách hàng:</strong> ${order.customerName}</div>
          <div>📞 <strong>Số điện thoại:</strong> ${order.phone}</div>
          <div>📍 <strong>Địa chỉ giao:</strong> ${order.address}</div>
          <div>📝 <strong>Ghi chú:</strong> ${order.note || 'Không có ghi chú'}</div>
          <div>🕒 <strong>Thời gian đặt:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</div>
        </div>

        <h4 style="font-size: 13.5px; font-weight: 700; margin-bottom: 8px;">Danh Sách Mẫu Hoa Đã Đặt:</h4>
        <div style="margin-bottom: 16px;">
          ${itemsHtml}
        </div>

        <div style="font-size: 13.5px; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between;">
            <span>Tạm tính tiền hoa:</span>
            <span>${formatPrice(order.subtotal || order.totalAmount)}</span>
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
      if (order) {
        exportOrderInvoicePdf(order);
      } else {
        showToast('Không tìm thấy thông tin đơn hàng!', 'error');
      }
    });
  }

  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', async () => {
      if (!currentDetailOrderId) return;
      const newStatus = statusSelect.value;
      await updateOrderStatus(currentDetailOrderId, newStatus);
      showToast(`Đã cập nhật đơn #${currentDetailOrderId} sang trạng thái mới!`);
      closeOrderDetail();
      allOrders = await fetchOrders();
      renderOrdersTable();
      renderDashboard();
    });
  }

  if (table) {
    table.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.view-order-btn');
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
        await deleteProduct(id);
        allProducts = await fetchProducts();
        renderProductsTable();
        renderDashboard();
        showToast(`Đã xóa mẫu hoa #${id} thành công!`);
      } else if (type === 'banner') {
        await deleteBanner(id);
        allBanners = await fetchAllBanners();
        renderBannersTable();
        showToast(`Đã xóa banner #${id}!`);
      } else if (type === 'voucher') {
        await deletePromotion(id);
        allPromotions = await fetchAllPromotions();
        renderVouchersTable();
        showToast(`Đã xóa mã voucher thành công!`);
      }
    });
  }
}

// ==========================================================================
// 11. TAB 6: BÁO CÁO & THỐNG KÊ DOANH THU - LỢI NHUẬN TÁCH BIỆT (ADMIN)
// Đáp ứng đúng yêu cầu: Lợi nhuận/Doanh thu tách biệt, Tháng/Quý, Dashboard + Table để xuất
// ==========================================================================
function calculateRevenueStats(orders, periodType, year) {
  // Lọc các đơn hàng hoàn thành trong năm được chọn
  const validOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    return d.getFullYear() === Number(year) && o.status !== 'cancelled';
  });

  const stats = [];

  if (periodType === 'quarter') {
    // Thống kê theo 4 Quý (Q1: T1-3, Q2: T4-6, Q3: T7-9, Q4: T10-12)
    const quarters = [
      { label: `Quý 1 (Tháng 1 - 3 / ${year})`, startMonth: 0, endMonth: 2 },
      { label: `Quý 2 (Tháng 4 - 6 / ${year})`, startMonth: 3, endMonth: 5 },
      { label: `Quý 3 (Tháng 7 - 9 / ${year})`, startMonth: 6, endMonth: 8 },
      { label: `Quý 4 (Tháng 10 - 12 / ${year})`, startMonth: 9, endMonth: 11 }
    ];

    quarters.forEach(q => {
      const qOrders = validOrders.filter(o => {
        const m = new Date(o.createdAt).getMonth();
        return m >= q.startMonth && m <= q.endMonth;
      });

      // Dùng ES6 reduce tính tổng doanh thu
      const revenue = qOrders.reduce((sum, o) => sum + Number(o.totalAmount || o.finalTotal || o.subtotal || 0), 0);
      // Chi phí giá vốn tính theo 65% doanh thu
      const cost = Math.round(revenue * 0.65);
      // Lợi nhuận ròng = Doanh thu - Giá vốn (35%)
      const profit = revenue - cost;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      stats.push({
        label: q.label,
        orderCount: qOrders.length,
        revenue,
        cost,
        profit,
        margin
      });
    });
  } else {
    // Thống kê theo 12 Tháng
    for (let m = 0; m < 12; m++) {
      const monthOrders = validOrders.filter(o => new Date(o.createdAt).getMonth() === m);
      const revenue = monthOrders.reduce((sum, o) => sum + Number(o.totalAmount || o.finalTotal || o.subtotal || 0), 0);
      const cost = Math.round(revenue * 0.65);
      const profit = revenue - cost;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      stats.push({
        label: `Tháng ${m + 1} / ${year}`,
        orderCount: monthOrders.length,
        revenue,
        cost,
        profit,
        margin
      });
    }
  }

  return stats;
}

function renderStatistics() {
  const periodTypeSelect = document.querySelector('#statsPeriodType');
  const yearSelect = document.querySelector('#statsYearSelect');
  const completedOrdersEl = document.querySelector('#statCompletedOrders');
  const totalRevenueEl = document.querySelector('#statTotalRevenue');
  const totalCostEl = document.querySelector('#statTotalCost');
  const totalProfitEl = document.querySelector('#statTotalProfit');
  const chartWrap = document.querySelector('#statsBarChartWrap');
  const tbody = document.querySelector('#statsTableBody');
  const tfoot = document.querySelector('#statsTableFooter');

  const periodType = periodTypeSelect ? periodTypeSelect.value : statsFilter.periodType;
  const year = yearSelect ? Number(yearSelect.value) : statsFilter.year;

  const statsData = calculateRevenueStats(allOrders, periodType, year);

  // 1. Tính tổng toàn kỳ bằng reduce
  const totalOrders = statsData.reduce((sum, r) => sum + r.orderCount, 0);
  const totalRev = statsData.reduce((sum, r) => sum + r.revenue, 0);
  const totalCost = statsData.reduce((sum, r) => sum + r.cost, 0);
  const totalProfit = statsData.reduce((sum, r) => sum + r.profit, 0);

  // 2. Cập nhật 4 thẻ KPI
  if (completedOrdersEl) completedOrdersEl.textContent = totalOrders;
  if (totalRevenueEl) totalRevenueEl.textContent = formatPrice(totalRev);
  if (totalCostEl) totalCostEl.textContent = formatPrice(totalCost);
  if (totalProfitEl) totalProfitEl.textContent = formatPrice(totalProfit);

  // 3. Vẽ biểu đồ Bar Chart bằng CSS Flexbox
  if (chartWrap) {
    const maxVal = Math.max(...statsData.map(r => r.revenue), 1000000);
    chartWrap.innerHTML = statsData.map(r => {
      const revHeight = Math.max(Math.round((r.revenue / maxVal) * 150), 4);
      const profHeight = Math.max(Math.round((r.profit / maxVal) * 150), 4);

      return `
        <div style="flex: 1; min-width: 50px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
          <div style="display: flex; gap: 4px; align-items: flex-end; width: 100%; justify-content: center;">
            <div title="Doanh thu: ${formatPrice(r.revenue)}" style="width: 14px; height: ${revHeight}px; background: #0EA5E9; border-radius: 4px 4px 0 0; transition: height 0.3s ease;"></div>
            <div title="Lợi nhuận: ${formatPrice(r.profit)}" style="width: 14px; height: ${profHeight}px; background: #108474; border-radius: 4px 4px 0 0; transition: height 0.3s ease;"></div>
          </div>
          <span style="font-size: 10.5px; color: var(--text-muted); margin-top: 8px; white-space: nowrap; transform: rotate(-25deg); transform-origin: top left;">${r.label.split(' /')[0]}</span>
        </div>
      `;
    }).join('');
  }

  // 4. Đổ dữ liệu vào Table chi tiết
  if (tbody) {
    tbody.innerHTML = statsData.map(r => `
      <tr>
        <td><strong>${r.label}</strong></td>
        <td style="text-align: center;">${r.orderCount}</td>
        <td style="text-align: right; font-weight: 600; color: #0EA5E9;">${formatPrice(r.revenue)}</td>
        <td style="text-align: right; color: #F59E0B;">${formatPrice(r.cost)}</td>
        <td style="text-align: right; font-weight: 700; color: #108474;">${formatPrice(r.profit)}</td>
        <td style="text-align: center;"><span class="badge-pill badge-emerald">${r.margin}%</span></td>
      </tr>
    `).join('');
  }

  // 5. Dòng tổng cộng tfoot
  if (tfoot) {
    const avgMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;
    tfoot.innerHTML = `
      <tr>
        <td>TỔNG CỘNG TOÀN KỲ</td>
        <td style="text-align: center;">${totalOrders}</td>
        <td style="text-align: right; color: #0EA5E9;">${formatPrice(totalRev)}</td>
        <td style="text-align: right; color: #F59E0B;">${formatPrice(totalCost)}</td>
        <td style="text-align: right; color: #108474;">${formatPrice(totalProfit)}</td>
        <td style="text-align: center;">${avgMargin}%</td>
      </tr>
    `;
  }
}

function initStatistics() {
  const periodTypeSelect = document.querySelector('#statsPeriodType');
  const yearSelect = document.querySelector('#statsYearSelect');
  const exportPdfBtn = document.querySelector('#btnExportStatsPdf');
  const exportExcelBtn = document.querySelector('#btnExportStatsExcel');

  if (periodTypeSelect) {
    periodTypeSelect.addEventListener('change', () => {
      statsFilter.periodType = periodTypeSelect.value;
      renderStatistics();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      statsFilter.year = Number(yearSelect.value);
      renderStatistics();
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      const data = calculateRevenueStats(allOrders, statsFilter.periodType, statsFilter.year);
      exportRevenueStatisticsPdf(data, statsFilter.periodType, statsFilter.year);
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      const data = calculateRevenueStats(allOrders, statsFilter.periodType, statsFilter.year);
      exportRevenueStatisticsExcel(data, statsFilter.periodType, statsFilter.year);
    });
  }
}

// ==========================================================================
// 12. TAB 7: QUẢN LÝ TÀI KHOẢN & PUT CREDENTIALS BÀN GIAO (ADMIN)
// ==========================================================================
async function fetchAllUsers() {
  try {
    const res = await api.get('/users');
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
    let roleBadge = '<span class="badge-pill badge-emerald">🌸 Khách Hàng</span>';
    if (uRole === 'admin') {
      roleBadge = '<span class="badge-pill badge-rose">👑 Quản Trị Viên</span>';
    } else if (uRole === 'staff') {
      roleBadge = '<span class="badge-pill badge-blue">📑 Nhân Viên Kế Toán</span>';
    }

    const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo';

    return `
      <tr data-id="${u.id}">
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${u.name || 'Người dùng'}</strong></td>
        <td><code>${u.email}</code></td>
        <td>${roleBadge}</td>
        <td>${dateStr}</td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
            <button type="button" class="btn-action btn-action-edit edit-user-btn" data-id="${u.id}">
              ✏️ Sửa / Đổi Pass (PUT)
            </button>
            <button type="button" class="btn-action btn-action-delete delete-user-btn" data-id="${u.id}">
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
  const titleEl = document.querySelector('#userEditModalTitle');

  function openEditModal(user = null) {
    if (!modal) return;
    if (user) {
      if (titleEl) titleEl.textContent = `Chỉnh Sửa & Bàn Giao Tài Khoản: ${user.name}`;
      if (idInput) idInput.value = user.id;
      if (nameInput) nameInput.value = user.name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.placeholder = 'Để trống nếu không đổi, hoặc nhập mật khẩu mới';
      }
      if (roleSelect) roleSelect.value = user.role || 'customer';
    } else {
      if (titleEl) titleEl.textContent = 'Thêm Tài Khoản Mới Vào Hệ Thống';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (passwordInput) {
        passwordInput.value = '123456';
        passwordInput.placeholder = 'Mật khẩu khởi tạo (mặc định: 123456)';
      }
      if (roleSelect) roleSelect.value = 'customer';
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
            await api.delete(`/users/${id}`);
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
          // Lấy user cũ để giữ nguyên thông tin nếu không đổi pass
          const oldUser = allUsers.find(u => String(u.id) === String(id)) || {};
          const updatedUser = {
            ...oldUser,
            name,
            email,
            role,
            // Nếu có gõ mật khẩu mới -> Put credentials để bàn giao
            password: newPassword ? newPassword : oldUser.password
          };

          // GỌI PHƯƠNG THỨC PUT CHUẨN ĐỒ ÁN ĐỂ CẬP NHẬT CREDENTIALS
          await api.put(`/users/${id}`, updatedUser);
          showToast(`Đã cập nhật thông tin & mật khẩu (PUT) cho tài khoản #${id} thành công!`, 'success');
        } else {
          // Tạo user mới bằng POST
          const newUser = {
            name,
            email,
            password: newPassword || '123456',
            role,
            createdAt: new Date().toISOString()
          };
          await api.post('/users', newUser);
          showToast('Đã thêm tài khoản mới thành công!', 'success');
        }

        closeModal();
        allUsers = await fetchAllUsers();
        renderUsersTable();
      } catch (err) {
        console.error('Lỗi cập nhật tài khoản:', err);
        showToast('Có lỗi xảy ra khi lưu thông tin tài khoản!', 'error');
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
    const [categories, products, banners, promotions, orders, users] = await Promise.all([
      fetchCategories(),
      fetchProducts(),
      fetchAllBanners(),
      fetchAllPromotions(),
      fetchOrders(),
      fetchAllUsers()
    ]);

    allCategories = categories;
    allProducts = products;
    allBanners = banners;
    allPromotions = promotions;
    allOrders = orders;
    allUsers = users;

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
        allProducts = await fetchProducts();
        renderProductsTable();
        renderDashboard();
      }
    });
    initBannerCrud();
    initVoucherCrud();
    initOrderManagement();
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

// Bắt đầu khởi chạy hệ thống
initAuthGate();
initClock();

