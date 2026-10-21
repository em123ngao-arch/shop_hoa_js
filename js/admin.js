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
import { formatPrice, showToast } from './utils.js';

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
let currentTab = 'dashboard';
let deleteTarget = { type: null, id: null };
let currentDetailOrderId = null;

// ==========================================================================
// 2. CỬA NGÕ XÁC THỰC QUẢN TRỊ (AUTH GATE)
// ==========================================================================
function initAuthGate() {
  const authModal = document.querySelector('#authGateModal');
  const adminApp = document.querySelector('#adminApp');
  const authForm = document.querySelector('#adminAuthForm');
  const pinInput = document.querySelector('#adminPinInput');
  const quickDemoBtn = document.querySelector('#quickDemoBtn');
  const logoutBtn = document.querySelector('#adminLogoutBtn');

  function unlockAdmin() {
    sessionStorage.setItem('admin_authenticated', 'true');
    if (authModal) authModal.classList.add('hidden');
    if (adminApp) adminApp.style.display = 'flex';
    loadAllData();
  }

  function lockAdmin() {
    sessionStorage.removeItem('admin_authenticated');
    if (authModal) authModal.classList.remove('hidden');
    if (adminApp) adminApp.style.display = 'none';
  }

  // Kiểm tra phiên đăng nhập đã có chưa
  if (sessionStorage.getItem('admin_authenticated') === 'true') {
    unlockAdmin();
  } else {
    lockAdmin();
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = pinInput ? pinInput.value.trim() : '';
      // Chấp nhận mã PIN 123, 123456 hoặc bất kỳ chuỗi mật khẩu hợp lệ
      if (val === '123' || val === '123456' || val.length >= 3) {
        showToast('Đăng nhập Quản trị viên thành công!');
        unlockAdmin();
      } else {
        showToast('Mật khẩu/Mã PIN không đúng (Gợi ý: 123)', 'error');
      }
    });
  }

  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', () => {
      showToast('Đã mở quyền Quản trị viên (Chế độ Demo)!');
      unlockAdmin();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      showToast('Đã đăng xuất quyền Quản trị.');
      lockAdmin();
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
    orders: 'Quản Lý Đơn Hàng'
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

      // Nạp lại dữ liệu tương ứng của tab
      if (tab === 'dashboard') renderDashboard();
      else if (tab === 'products') renderProductsTable();
      else if (tab === 'banners') renderBannersTable();
      else if (tab === 'vouchers') renderVouchersTable();
      else if (tab === 'orders') renderOrdersTable();
    });
  });

  // Nút xem tất cả đơn nhanh từ dashboard
  const quickOrdersBtn = document.querySelector('#viewAllOrdersQuickBtn');
  if (quickOrdersBtn) {
    quickOrdersBtn.addEventListener('click', () => {
      const ordersNavBtn = document.querySelector('.nav-item[data-tab="orders"]');
      if (ordersNavBtn) ordersNavBtn.click();
    });
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
// 6. TAB 2: QUẢN LÝ SẢN PHẨM (CRUD + TÌM KIẾM / LỌC)
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
    return;
  }

  tbody.innerHTML = filtered.map(p => {
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
// 9. TAB 5: QUẢN LÝ ĐƠN HÀNG (ORDERS MANAGEMENT)
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
    return;
  }

  tbody.innerHTML = filtered.map(o => {
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

  if (searchInput) searchInput.addEventListener('input', renderOrdersTable);
  if (statusFilter) statusFilter.addEventListener('change', renderOrdersTable);
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
// 11. KHỞI TẠO TỔNG THỂ DỮ LIỆU BAN ĐẦU
// ==========================================================================
async function loadAllData() {
  try {
    const [categories, products, banners, promotions, orders] = await Promise.all([
      fetchCategories(),
      fetchProducts(),
      fetchAllBanners(),
      fetchAllPromotions(),
      fetchOrders()
    ]);

    allCategories = categories;
    allProducts = products;
    allBanners = banners;
    allPromotions = promotions;
    allOrders = orders;

    // Khởi tạo các phân hệ
    initNavigation();
    initDropzones();
    initProductCrud();
    initBannerCrud();
    initVoucherCrud();
    initOrderManagement();
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
