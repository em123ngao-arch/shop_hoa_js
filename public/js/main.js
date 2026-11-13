import { initCheckoutWorkflow, openCheckoutModal, closeCheckoutModal } from './checkout.js';
import { exportOrderInvoicePdf } from './excel-pdf.js';
import {
  fetchCategories,
  fetchProducts,
  fetchBanners,
  fetchBestSellers,
  fetchNewestProducts,
  fetchPromotions,
  addToCart,
  getCartSummary,
  updateCartQuantity,
  removeCartItem,
  applyVoucher,
  removeVoucher,
  saveOrder,
  fetchOrders,
  fetchWishlistStorage,
  toggleWishlistStorage
} from './storage.js';
import { formatPrice, renderStars, showToast, updateCartBadge, renderHeaderAuth, updateWishlistBadge, escapeHTML } from './utils.js';
import {
  filterCatalogProducts,
  formatVoucherDisplay,
  isOrderPaid,
  isUnpaidSepayOrder
} from './business-rules.js';
import {
  initUniversalCartDrawer,
  openCartDrawer,
  closeCartDrawer,
  renderCartDrawer
} from './cart-drawer.js';
import { initMobileBottomNav } from './bottom-nav.js';

/**
 * main.js - Logic điều khiển trang chủ (index.html)
 * Kế thừa phong cách của Giáo viên và bổ sung các tính năng ES6+ đạt chuẩn đồ án
 */

// Nơi lưu trữ trạng thái dữ liệu (State)
let allCategories = [];
let allProducts = [];
let allPromotions = [];
let currentWishlist = [];
let currentCategoryId = '0';
let catalogPagination = {
  currentPage: 1,
  limit: 8 // Hiển thị 8 mẫu hoa / trang (lưới 4 cột x 2 dòng cân đối)
};
let catalogSort = 'newest';

// Các phần tử DOM chính
const categoryList = document.querySelector('#categoryList');
const productList = document.querySelector('#productList');
const searchInput = document.querySelector('#searchInput');
const searchBtn = document.querySelector('#searchBtn');
const loadingElement = document.querySelector('#loading');
const errorElement = document.querySelector('#error');
const productCountElement = document.querySelector('#productCount');

/**
 * 1. HÀM RENDER DANH MỤC HOA
 * Sử dụng forEach và innerHTML theo đúng cách viết của Thầy
 */
function renderCategories(categories) {
  if (!categoryList) return;

  // Nút đầu tiên là "Tất cả" với data-category="0"
  categoryList.innerHTML = `
    <button class="category-btn active" data-category="0">
      Tất cả
    </button>
  `;

  // Duyệt qua từng danh mục và tạo nút
  categories.forEach(category => {
    categoryList.innerHTML += `
      <button class="category-btn" data-category="${category.id}">
        ${category.name}
      </button>
    `;
  });

  // Lắng nghe sự kiện click trên từng nút danh mục
  const categoryButtons = document.querySelectorAll('.category-btn');
  categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Đổi class active
      categoryButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const catId = String(btn.dataset.category || '0');
      currentCategoryId = catId;
      applyFilters(true);
    });
  });
}

/**
 * HÀM TIỆN ÍCH TẠO MÃ HTML CHO MỘT THẺ SẢN PHẨM HOA (CHUẨN FLOWER CHIMP CAO CẤP)
 * Tối giản, không viền thô kệch, ảnh bo góc 12px có chiều sâu, chữ căn giữa thanh lịch
 * Nút "+ Thêm nhanh" trượt từ đáy ảnh lên khi rê chuột (Hover Slide-up)
 * @param {object} product - Đối tượng sản phẩm hoa
 * @param {string} defaultBadge - Nhãn mặc định ('Bán chạy', 'Mới', 'Handmade')
 * @returns {string} Chuỗi template literal HTML
 */
function createProductCardHtml(product, defaultBadge = '') {
  const badgeText = product.badge || defaultBadge;
  let ribbonHtml = '';
  if (badgeText === 'Bán chạy') {
    ribbonHtml = `<div class="product-ribbon">Bán chạy nhất</div>`;
  } else if (badgeText === 'Handmade' || badgeText === 'Thuần khiết') {
    ribbonHtml = `<div class="product-ribbon ribbon-handmade">Thủ công 100%</div>`;
  } else if (badgeText === 'Mới' || badgeText === 'Mới nhất') {
    ribbonHtml = `<div class="product-ribbon ribbon-new">Mẫu mới 2026</div>`;
  }

  // Tính % giảm giá thực tế nếu có giá cũ (chỉ hiện khi có sale - UX-02)
  let discountBadgeHtml = '';
  const hasRealSale = Boolean(product.originalPrice && Number(product.originalPrice) > Number(product.price));
  if (hasRealSale) {
    const discountPercent = Math.round((1 - Number(product.price) / Number(product.originalPrice)) * 100);
    // Chỉ hiển thị huy hiệu giảm giá khi mức giảm từ 5% trở lên (chuẩn TMĐT cao cấp)
    if (discountPercent >= 5) {
      discountBadgeHtml = `<span class="product-badge-discount">-${discountPercent}%</span>`;
    }
  }

  // Tìm voucher hợp lệ áp dụng cho sản phẩm này (Cấp Sản phẩm hoặc Cấp Danh mục)
  let voucherHintHtml = '';
  const now = new Date();
  const isProductOnSale = Boolean(product.originalPrice && product.originalPrice > product.price);

  const applicablePromo = (allPromotions || []).find(p => {
    if (!p.active) return false;
    // Kiểm tra ngày bắt đầu
    if (p.startDate && new Date(p.startDate) > now) return false;
    // Kiểm tra ngày kết thúc (tính đến hết ngày 23:59:59)
    if (p.endDate) {
      const end = new Date(p.endDate);
      end.setHours(23, 59, 59, 999);
      if (end < now) return false;
    }
    // Kiểm tra số lượt sử dụng
    if (typeof p.usageLimit === 'number' && typeof p.usedCount === 'number' && p.usedCount >= p.usageLimit) {
      return false;
    }
    // Chặn hiển thị nhãn nếu sản phẩm đang Flash Sale và voucher cấm cộng dồn
    if (p.excludeSaleItems && isProductOnSale) {
      return false;
    }
    // Kiểm tra scope: ưu tiên mẫu hoa cụ thể, sau đó đến danh mục
    if (p.scope === 'product' && Array.isArray(p.targetProductIds) && p.targetProductIds.map(String).includes(String(product.id))) {
      return true;
    }
    if (p.scope === 'category' && Array.isArray(p.targetCategoryIds) && p.targetCategoryIds.map(String).includes(String(product.categoryId))) {
      return true;
    }
    return false;
  });

  if (applicablePromo) {
    const voucherMeta = formatVoucherDisplay(applicablePromo, formatPrice);
    const labelPrefix = applicablePromo.scope === 'product' ? 'Mẫu này: Giảm' : 'Giảm';
    voucherHintHtml = `
      <div class="product-voucher-tag" title="${escapeHTML(voucherMeta.conditionText)}">
        <span>🎫 ${labelPrefix} ${escapeHTML(voucherMeta.shortTag)} với <strong>${escapeHTML(applicablePromo.code)}</strong></span>
      </div>
    `;
  }

  const isFav = currentWishlist.includes(String(product.id));
  const heartBtnHtml = `
    <button type="button" class="card-heart-btn ${isFav ? 'active' : ''}" data-id="${product.id}" title="${isFav ? 'Bỏ yêu thích' : 'Lưu mẫu hoa yêu thích'}" aria-label="Yêu thích">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    </button>
  `;

  return `
    <div class="product-card" data-id="${product.id}">
      <!-- KHUNG HÌNH ẢNH HOA CÓ CHIỀU SÂU -->
      <div class="product-image">
        <!-- Huy hiệu giảm giá (Chỉ hiện nếu có giá gốc) -->
        ${discountBadgeHtml}

        <a href="./detail.html?id=${product.id}" class="product-img-link">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
        </a>

        <!-- Nút Thả Tim Yêu Thích -->
        ${heartBtnHtml}

        <!-- Dải băng nhãn ở đáy ảnh chuẩn Flower Chimp -->
        ${ribbonHtml}

        <!-- Nút Thêm Nhanh trượt lên khi Hover -->
        <button class="quick-add-btn add-cart" data-id="${product.id}" title="Thêm nhanh vào giỏ hàng">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Thêm Nhanh
        </button>
      </div>

      <!-- THÔNG TIN HOA CĂN GIỮA THANH LỊCH -->
      <div class="product-info">
        <a href="./detail.html?id=${product.id}">
          <h3 class="product-title" title="${product.name}">
            ${product.name}
          </h3>
        </a>

        <div class="price-wrap">
          ${(product.originalPrice && Number(product.originalPrice) > Number(product.price)) ? `<span class="was-price">${formatPrice(product.originalPrice)}</span>` : ''}
          <span class="price">${formatPrice(product.price)}</span>
        </div>

        ${voucherHintHtml}

        ${Number(product.reviewCount) > 0 && Number.isFinite(Number(product.rating)) ? `
          <div class="product-rating">
            ${renderStars(product.rating)}
            <span class="review-count">(${Number(product.reviewCount)})</span>
          </div>
        ` : '<div class="product-rating product-rating-empty">Chưa có đánh giá</div>'}
      </div>
    </div>
  `;
}

/**
 * 2. HÀM RENDER DANH SÁCH HOA CHÍNH (TOÀN BỘ SẢN PHẨM)
 * Sử dụng map() của ES6+ để chuyển đổi mảng đối tượng thành HTML
 */
function renderProducts(products) {
  if (!productList) return;

  // Cập nhật số lượng sản phẩm hiển thị trên toolbar
  if (productCountElement) {
    productCountElement.textContent = products.length;
  }

  // Trường hợp không tìm thấy sản phẩm nào
  if (products.length === 0) {
    productList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 12px;">
          Không tìm thấy mẫu hoa nào phù hợp.
        </p>
        <button id="resetFilterBtn" class="hero-cta" style="padding: 9px 20px; font-size: 13px;">
          Xem tất cả hoa
        </button>
      </div>
    `;

    const resetBtn = document.querySelector('#resetFilterBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        currentCategoryId = '0';
        const allBtn = document.querySelector('.category-btn[data-category="0"]');
        if (allBtn) allBtn.click();
      });
    }
    const pagContainer = document.querySelector('#catalogPagination');
    if (pagContainer) pagContainer.innerHTML = '';
    return;
  }

  // Phân trang chuẩn công thức: Math.ceil(tongsp / limit)
  const limit = catalogPagination.limit;
  const totalItems = products.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  if (catalogPagination.currentPage > totalPages) {
    catalogPagination.currentPage = totalPages;
  }

  const startIndex = (catalogPagination.currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const pagedProducts = products.slice(startIndex, endIndex);

  // Sử dụng phương thức map() của ES6+
  productList.innerHTML = pagedProducts.map(p => createProductCardHtml(p)).join('');

  // Hiển thị nút điều hướng phân trang
  renderCatalogPagination(totalItems, totalPages);
}

/**
 * 2.0.1. RENDER THANH ĐIỀU HƯỚNG PHÂN TRANG DANH SÁCH HOA
 */
function renderCatalogPagination(totalItems, totalPages) {
  const container = document.querySelector('#catalogPagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const currentPage = catalogPagination.currentPage;
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
      catalogPagination.currentPage--;
      applyFilters(false);
      document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Gắn sự kiện nút Sau
  const nextBtn = container.querySelector('.page-next');
  if (nextBtn && currentPage < totalPages) {
    nextBtn.addEventListener('click', () => {
      catalogPagination.currentPage++;
      applyFilters(false);
      document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Gắn sự kiện từng số trang
  const pageBtns = container.querySelectorAll('.pagination-btn[data-page]');
  pageBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pageNum = Number(e.currentTarget.getAttribute('data-page'));
      if (pageNum && pageNum !== catalogPagination.currentPage) {
        catalogPagination.currentPage = pageNum;
        applyFilters(false);
        document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/**
 * 2.1. RENDER SECTION SẢN PHẨM BÁN CHẠY NHẤT (SHOP-06)
 * Hiển thị 4 sản phẩm có lượt bán cao nhất với badge Bán chạy
 */
function renderBestSellers(products = []) {
  const container = document.querySelector('#bestSellersList');
  if (!container || products.length === 0) return;
  container.innerHTML = products.map(p => createProductCardHtml(p, 'Bán chạy')).join('');
}

/**
 * 2.2. RENDER SECTION SẢN PHẨM MỚI NHẤT (SHOP-06)
 * Hiển thị 4 mẫu hoa mới lên kệ nhất với badge Mới
 */
function renderNewestProducts(products = []) {
  const container = document.querySelector('#newArrivalsList');
  if (!container || products.length === 0) return;
  container.innerHTML = products.map(p => createProductCardHtml(p, 'Mới')).join('');
}

/**
 * 3. HÀM LỌC TỔNG HỢP (DANH MỤC + TÌM KIẾM REALTIME)
 * Sử dụng phương thức filter() của ES6+
 */
function applyFilters(resetPage = false) {
  if (resetPage) {
    catalogPagination.currentPage = 1;
  }

  const searchTerm = searchInput ? searchInput.value : '';
  const filtered = filterCatalogProducts(allProducts, {
    categoryId: currentCategoryId,
    searchTerm,
    sort: catalogSort
  });

  renderProducts(filtered);
}

/**
 * 4. XỬ LÝ SỰ KIỆN TÌM KIẾM (EVENT LISTENER)
 * Kế thừa chuẩn theo code của Thầy (lắng nghe sự kiện input)
 */
if (searchInput) {
  searchInput.addEventListener('input', () => {
    applyFilters(true);
  });
}


// Lắng nghe sự kiện thay đổi sắp xếp
const catalogSortSelect = document.querySelector('#catalogSortSelect');
// Xu ly click "Kham pha them" o section Mau Hoa Moi Nhat -> Cuon xuong danh muc va chon sap xep moi nhat
const moreArrivalsBtn = document.querySelector('.section-link-more');
if (moreArrivalsBtn) {
  moreArrivalsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (catalogSortSelect) {
      catalogSortSelect.value = 'newest';
    }
    catalogSort = 'newest';
    applyFilters(true);
    document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (catalogSortSelect) {
  catalogSortSelect.addEventListener('change', (e) => {
    catalogSort = e.target.value;
    applyFilters(true);
  });
}

if (searchBtn) {
  searchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    applyFilters();
  });
}

/**
 * 5. KỸ THUẬT TOÀN CỤC EVENT DELEGATION CHO NÚT THÊM VÀO GIỎ
 * Áp dụng cho cả 3 danh sách: Bán chạy, Mới nhất và Toàn bộ mẫu hoa
 */
document.addEventListener('click', (event) => {
  // Bắt sự kiện bấm Thả Tim Yêu Thích
  const heartBtn = event.target.closest('.card-heart-btn');
  if (heartBtn) {
    event.preventDefault();
    event.stopPropagation();
    const rawId = heartBtn.dataset.id;
    if (rawId) {
      toggleWishlistStorage(rawId).then((res) => {
        currentWishlist = res.wishlist;
        heartBtn.classList.toggle('active', res.isFavorite);
        heartBtn.title = res.isFavorite ? 'Bỏ yêu thích' : 'Lưu mẫu hoa yêu thích';
        updateWishlistBadge();
        showToast(res.isFavorite ? 'Đã thêm mẫu hoa vào danh sách yêu thích' : 'Đã bỏ mẫu hoa khỏi danh sách yêu thích', 'info');
      });
    }
    return;
  }

  const addBtn = event.target.closest('.add-cart');
  if (!addBtn) return;

  event.preventDefault();
  const rawId = addBtn.dataset.id;
  if (!rawId) return;

  // Sử dụng so sánh chuỗi tương thích 100% với db.json
  const product = allProducts.find(p => String(p.id) === String(rawId));

  if (product) {
    if (product.stock !== undefined && product.stock <= 0) {
      showToast('Mẫu hoa này tạm thời hết hàng!', 'error');
      return;
    }
    addToCart(product, 1);
    updateCartBadge();
    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    if (typeof renderCartDrawer === 'function') {
      renderCartDrawer();
    }
    if (typeof openCartDrawer === 'function') {
      openCartDrawer();
    }
  }
});

/**
 * 6. RENDER VÀ ĐIỀU KHIỂN HERO BANNER SLIDER (SHOP-05 LUXURY UPGRADE)
 * Sử dụng map() ES6 để sinh mã HTML cho từng slide và dot indicator
 * Hỗ trợ:
 * - Chuyển slide tự động kèm Thanh Progress Bar chạy 4.5s mượt mà
 * - Tạm dừng khi rê chuột (Pause on Hover) và tiếp tục khi rời chuột
 * - Cử chỉ vuốt chạm cảm ứng trên Mobile (Touch Swipe Gestures)
 * - Nút CTA thông minh hỗ trợ cuộn mượt và kích hoạt bộ lọc danh mục
 * @param {Array} banners - Danh sách banner từ db.json / storage
 */
function initHeroSlider(banners = []) {
  const slidesContainer = document.querySelector('#heroSlidesContainer');
  const dotsContainer = document.querySelector('#heroDots');
  const prevBtn = document.querySelector('#heroPrevBtn');
  const nextBtn = document.querySelector('#heroNextBtn');
  const heroSection = document.querySelector('#heroSection');
  const progressBar = document.querySelector('#heroProgressBar');

  if (!slidesContainer || !dotsContainer || banners.length === 0) return;

  // Render danh sách slide bằng map() của ES6
  slidesContainer.innerHTML = banners.map((banner, index) => {
    const isSale = banner.theme === 'sale';
    const ctaClass = isSale ? 'hero-cta hero-cta-sale' : 'hero-cta';

    return `
      <div class="hero-slide ${index === 0 ? 'active' : ''}" data-index="${index}" data-theme="${banner.theme || 'default'}">
        <div class="hero-text">
          <span class="hero-tag">${banner.tag || 'Bộ Sưu Tập Hoa Kẽm Nhung'}</span>
          <h1 class="hero-title">${banner.title || banner.tenbanner}</h1>
          <p class="hero-desc">${banner.desc || ''}</p>
          <a href="${banner.link || '#products'}" class="${ctaClass}" data-theme="${banner.theme || 'default'}">
            <span>${banner.ctaText || 'Khám Phá Các Mẫu Hoa'}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>

        <div class="hero-image-wrap">
          <img src="${banner.hinhbanner || banner.image_url || banner.image || './images/350.webp'}" alt="${banner.tenbanner || banner.title || 'Hoa Kẽm Nhung'}" loading="eager" onerror="this.src='./images/350.webp'">
        </div>
      </div>
    `;
  }).join('');

  // Render các chấm tròn chỉ số dots bằng map()
  dotsContainer.innerHTML = banners.map((_, index) => `
    <button class="hero-dot ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="Slide ${index + 1}"></button>
  `).join('');

  let currentSlide = 0;
  const totalSlides = banners.length;
  const SLIDE_DURATION = 2000; // Tự động chuyển slide sau mỗi 2 giây
  let progressElapsed = 0;
  let progressInterval = null;
  let isHovered = false;

  // Cập nhật theme ban đầu cho toàn vùng banner
  if (heroSection && banners[0]) {
    heroSection.dataset.currentTheme = banners[0].theme || 'default';
  }

  // Hàm cập nhật trạng thái slide và dot
  function goToSlide(index) {
    const slides = slidesContainer.querySelectorAll('.hero-slide');
    const dots = dotsContainer.querySelectorAll('.hero-dot');

    if (index >= totalSlides) currentSlide = 0;
    else if (index < 0) currentSlide = totalSlides - 1;
    else currentSlide = index;

    slides.forEach((slide, i) => {
      const isActive = i === currentSlide;
      slide.classList.toggle('active', isActive);
      if (isActive && heroSection) {
        heroSection.dataset.currentTheme = slide.dataset.theme || 'default';
      }
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });

    resetProgress();
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function prevSlide() {
    goToSlide(currentSlide - 1);
  }

  // Quản lý Thanh Tiến Trình (Progress Bar)
  function startProgress() {
    if (totalSlides <= 1) return;
    stopProgress();

    progressInterval = setInterval(() => {
      if (!isHovered) {
        progressElapsed += 50;
        const pct = Math.min(100, (progressElapsed / SLIDE_DURATION) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;

        if (progressElapsed >= SLIDE_DURATION) {
          nextSlide();
        }
      }
    }, 50);
  }

  function stopProgress() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function resetProgress() {
    progressElapsed = 0;
    if (progressBar) progressBar.style.width = '0%';
  }

  // Bắt sự kiện nút bấm Prev / Next
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
    });
  }

  // Bắt sự kiện click vào từng dot
  dotsContainer.addEventListener('click', (e) => {
    const dot = e.target.closest('.hero-dot');
    if (!dot) return;
    const index = Number(dot.dataset.index);
    goToSlide(index);
  });

  // Tạm dừng khi rê chuột vào Hero section (UX thân thiện chuẩn cao cấp)
  if (heroSection) {
    heroSection.addEventListener('mouseenter', () => {
      isHovered = true;
    });
    heroSection.addEventListener('mouseleave', () => {
      isHovered = false;
    });
  }

  // Bắt sự kiện vuốt chạm cảm ứng trên Mobile (Touch Swipe)
  let touchStartX = 0;
  let touchEndX = 0;

  slidesContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  slidesContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 45) {
      if (diff < 0) {
        // Vuốt sang trái -> xem slide tiếp theo
        nextSlide();
      } else {
        // Vuốt sang phải -> xem slide trước
        prevSlide();
      }
    }
  }

  // Khởi động chạy tiến trình
  startProgress();
}

/**
 * 7. GÓC SĂN SALE GIỜ VÀNG (SHOP-07)
 * Lọc động các mức giảm giá 10-15%, 20-25%, 30-35%+ bằng filter() của ES6
 */
function initFlashSale(products = []) {
  const container = document.querySelector('#flashSaleList');
  const pillsContainer = document.querySelector('#saleFilterPills');
  if (!container) return;

  // Lọc danh sách hoa có giá gốc lớn hơn giá bán
  const discounted = products.filter(p => p.originalPrice && Number(p.originalPrice) > Number(p.price));

  function getDiscountPercent(p) {
    return Math.round((1 - Number(p.price) / Number(p.originalPrice)) * 100);
  }

  function renderList(filterKey = 'all') {
    let filtered = discounted;

    if (filterKey === '10-15') {
      filtered = discounted.filter(p => {
        const d = getDiscountPercent(p);
        return d >= 10 && d <= 15;
      });
    } else if (filterKey === '20-25') {
      filtered = discounted.filter(p => {
        const d = getDiscountPercent(p);
        return d >= 20 && d <= 25;
      });
    } else if (filterKey === '30-35') {
      filtered = discounted.filter(p => {
        const d = getDiscountPercent(p);
        return d >= 30;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 36px 20px; color: var(--text-muted); font-size: 14px;">
          Hiện chưa có mẫu hoa nào trong khung giảm giá này. Bạn vui lòng chọn mức khác nhé!
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(p => createProductCardHtml(p)).join('');
  }

  // Render mặc định tất cả mẫu hoa sale
  renderList('all');

  // Lắng nghe sự kiện click các nút lọc phần trăm
  if (pillsContainer) {
    pillsContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.sale-pill');
      if (!pill) return;

      pillsContainer.querySelectorAll('.sale-pill').forEach(b => b.classList.remove('active'));
      pill.classList.add('active');
      renderList(pill.dataset.sale);
    });
  }
}

/**
 * Đếm ngược thời gian Flash Sale Giờ Vàng (Ticking countdown to midnight)
 */
function startFlashSaleTimer() {
  const timerEl = document.querySelector('#flashSaleTimer strong');
  if (!timerEl) return;

  function tick() {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const diff = endOfDay - now;

    if (diff <= 0) {
      timerEl.textContent = '00:00:00';
      return;
    }

    const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
    const minutes = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
    const seconds = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

    timerEl.textContent = `${hours}:${minutes}:${seconds}`;
  }

  tick();
  setInterval(tick, 1000);
}

/**
 * 8. TRUNG TÂM VOUCHER & MÃ GIẢM GIÁ (SHOP-07)
 * Render thẻ coupon cắt răng cưa và hỗ trợ 1-click sao chép mã
 */
function renderVouchers(promotions = []) {
  const container = document.querySelector('#voucherList');
  if (!container || promotions.length === 0) return;

  container.innerHTML = promotions.map(p => {
    const meta = formatVoucherDisplay(p, formatPrice);
    let typeLabel = 'Ưu Đãi Đặc Biệt';
    if (p.type === 'new_user') typeLabel = 'Khách Hàng Mới';
    else if (p.type === 'birthday') typeLabel = 'Mừng Sinh Nhật';
    else if (p.type === 'flash_sale') typeLabel = 'Giờ Vàng';
    else if (p.scope === 'category') typeLabel = 'Theo Danh Mục';
    else if (p.scope === 'product') typeLabel = 'Theo Mẫu Hoa';

    const safeCode = escapeHTML(p.code || '');

    return `
      <div class="voucher-card" data-code="${safeCode}">
        <div class="voucher-top">
          <span class="voucher-discount-badge">${escapeHTML(meta.badgeText)}</span>
          <span class="voucher-type-tag">${escapeHTML(typeLabel)}</span>
        </div>
        <h4 class="voucher-title">${escapeHTML(meta.nameText)}</h4>
        <p class="voucher-condition">${escapeHTML(meta.conditionText)}</p>
        <div class="voucher-bottom">
          <span class="voucher-code-display">${safeCode}</span>
          <button type="button" class="voucher-copy-btn" data-code="${safeCode}">
            Sao Chép Mã
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Lắng nghe sự kiện click sao chép mã (chỉ gắn 1 lần)
  if (!container.dataset.bound) {
    container.dataset.bound = 'true';
    container.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.voucher-copy-btn');
      if (!copyBtn) return;

      const code = copyBtn.dataset.code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => { });
      }

      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Đã Lưu Mã';
      copyBtn.classList.add('copied');
      showToast(`Đã lưu mã giảm giá: ${code}`);

      // Tự động điền vào ô voucher trong giỏ hàng nếu có
      const voucherInput = document.querySelector('#voucherInput');
      if (voucherInput) {
        voucherInput.value = code;
      }

      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('copied');
      }, 2500);
    });
  }
}

/**
 * 9. ĐIỀU KHIỂN SIDE CART DRAWER & VOUCHER CALCULATION (SHOP-07)
 * Sử dụng Universal Cart Drawer dùng chung đồng bộ trên toàn hệ thống (cart-drawer.js)
 */
function initCartDrawer() {
  initUniversalCartDrawer();
}

/**
 * 10. POPUP CHÚC MỪNG SINH NHẬT KHÁCH HÀNG (SHOP-07)
 */
function initBirthdayModal() {
  const modal = document.querySelector('#birthdayModal');
  const closeBtn = document.querySelector('#birthdayModalClose');
  const copyBtn = document.querySelector('#copyBirthdayBtn');
  const useBtn = document.querySelector('#useBirthdayCodeBtn');

  if (!modal) return;

  function showBirthdayModal() {
    modal.classList.remove('hidden');
  }

  function hideBirthdayModal() {
    modal.classList.add('hidden');
    sessionStorage.setItem('birthday_shown', 'true');
  }

  if (closeBtn) closeBtn.addEventListener('click', hideBirthdayModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideBirthdayModal();
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = document.querySelector('#birthdayCodeText')?.textContent?.trim() || 'SINHNHATVUI';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => { });
      }
      copyBtn.textContent = 'Đã Lưu';
      showToast(`Đã lưu mã giảm sinh nhật: ${code}`);
      const voucherInput = document.querySelector('#voucherInput');
      if (voucherInput) voucherInput.value = code;
    });
  }

  if (useBtn) {
    useBtn.addEventListener('click', async () => {
      const code = 'SINHNHATVUI';
      hideBirthdayModal();
      openCartDrawer();
      const voucherInput = document.querySelector('#voucherInput');
      if (voucherInput) voucherInput.value = code;
      const result = await applyVoucher(code);
      if (result.success) {
        showToast(result.message);
        renderCartDrawer();
      }
    });
  }

  // Không tự động bung modal đè màn hình người dùng khi đang duyệt sản phẩm
  // Chỉ mở khi người dùng chủ động bấm xem ưu đãi sinh nhật
  window.openBirthdayModal = showBirthdayModal;
}

/**
 * 11. KHỞI TẠO DỮ LIỆU BAN ĐẦU KHI MỞ TRANG
 */
async function init() {
  renderHeaderAuth(); // Khởi tạo lời chào tài khoản và phân quyền trên header
  updateCartBadge();
  initMobileBottomNav(); // Khởi tạo thanh điều hướng đáy màn hình trên di động (Pha 1)

  try {
    if (loadingElement) loadingElement.classList.remove('hidden');

    // Nạp đồng thời banner, danh mục, sản phẩm, top bán chạy, sản phẩm mới, voucher và danh sách yêu thích
    const [banners, categories, products, bestSellers, newestProducts, promotions, wishlist] = await Promise.all([
      fetchBanners(),
      fetchCategories(),
      fetchProducts(),
      fetchBestSellers(4),
      fetchNewestProducts(4),
      fetchPromotions(),
      fetchWishlistStorage()
    ]);

    allCategories = categories;
    allProducts = products;
    allPromotions = promotions || [];
    currentWishlist = wishlist || [];
    updateWishlistBadge();

    if (loadingElement) loadingElement.classList.add('hidden');

    // Nhận diện từ khóa tìm kiếm từ URL param nếu có (UX-06)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search') || urlParams.get('q');
    if (searchParam && searchInput) {
      searchInput.value = searchParam;
    }

    // Khởi tạo các thành phần giao diện
    initHeroSlider(banners);
    renderBestSellers(bestSellers);
    renderNewestProducts(newestProducts);
    initFlashSale(allProducts);
    startFlashSaleTimer();
    renderVouchers(promotions);
    renderCategories(allCategories);
    applyFilters(true);
    initCartDrawer();
    initBirthdayModal();
    initCheckoutWorkflow();
    initMyOrdersWorkflow();

    // Tự động xử lý điều hướng khi bấm Mua Ngay hoặc Giỏ Hàng từ trang Chi Tiết
    if (urlParams.get('openCheckout') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        openCheckoutModal();
      }, 350);
    } else if (urlParams.get('openCart') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        if (typeof openCartDrawer === 'function') {
          openCartDrawer();
        }
      }, 350);
    }
  } catch (error) {
    console.error('Lỗi khởi tạo dữ liệu trang chủ:', error);
    if (loadingElement) loadingElement.classList.add('hidden');
    if (errorElement) errorElement.classList.remove('hidden');
  }
}

// Bắt đầu chạy chương trình khi file được nạp
init();



/**
 * ==========================================================================
 * CHECKOUT & SEPAY VIETQR PAYMENT WORKFLOW (SHOP-11)
 * ==========================================================================
 */
let currentCompletedOrder = null;
let currentDraftOrder = null;
let sepayCountdownTimer = null;
let sepayPollingInterval = null;

// Delegate sang module dùng chung checkout.js
export { initCheckoutWorkflow, openCheckoutModal, closeCheckoutModal };

/**
 * ==========================================================================
 * WORKFLOW: ĐƠN HÀNG CỦA TÔI & THEO DÕI TIẾN TRÌNH CẮM HOA (MY ORDERS)
 * ==========================================================================
 */
let allLoadedOrders = [];

export async function openMyOrdersModal(highlightOrderId = null) {
  const modal = document.querySelector('#myOrdersModal');
  const listContainer = document.querySelector('#myOrdersListContainer');
  const userSubtitle = document.querySelector('#myOrdersUserSubtitle');
  const searchInput = document.querySelector('#myOrdersSearchInput');

  if (!modal) return;

  try {
    allLoadedOrders = await fetchOrders();
  } catch (err) {
    console.error('Lỗi nạp danh sách đơn hàng:', err);
    allLoadedOrders = [];
  }

  // Nhận diện khách hàng đang đăng nhập
  const currentUserJson = localStorage.getItem('user');
  let currentUser = null;
  if (currentUserJson) {
    try { currentUser = JSON.parse(currentUserJson); } catch (e) { }
  }

  if (currentUser) {
    if (userSubtitle) {
      userSubtitle.textContent = `Khách hàng: ${currentUser.name || currentUser.email} (${currentUser.phone || 'Thành viên'})`;
    }
  } else {
    if (userSubtitle) {
      userSubtitle.textContent = 'Tra cứu tiến trình cắm hoa & giao hàng theo Mã đơn hoặc Số điện thoại';
    }
  }

  // Lọc đơn hàng hiển thị
  let displayedOrders = [...allLoadedOrders];
  if (currentUser) {
    const userOrders = allLoadedOrders.filter(o =>
      (currentUser.name && o.customerName && o.customerName.toLowerCase().includes(currentUser.name.toLowerCase())) ||
      (currentUser.phone && (o.phone === currentUser.phone || o.recipientPhone === currentUser.phone)) ||
      (currentUser.email && o.email === currentUser.email)
    );
    // Nếu có đơn của user thì lọc, nếu chưa có (user mới) thì hiện toàn bộ đơn gần đây
    if (userOrders.length > 0) {
      displayedOrders = userOrders;
    }
  }

  // Sắp xếp đơn mới nhất lên đầu
  displayedOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  if (highlightOrderId) {
    if (searchInput) searchInput.value = highlightOrderId;
    displayedOrders = displayedOrders.filter(o => String(o.id).includes(highlightOrderId));
  } else if (searchInput) {
    searchInput.value = '';
  }

  renderMyOrdersList(displayedOrders);
  modal.classList.remove('hidden');
}

export function closeMyOrdersModal() {
  const modal = document.querySelector('#myOrdersModal');
  if (modal) modal.classList.add('hidden');
}

function renderMyOrdersList(orders = []) {
  const listContainer = document.querySelector('#myOrdersListContainer');
  if (!listContainer) return;

  if (orders.length === 0) {
    listContainer.innerHTML = `
      <div class="my-orders-empty-state">
        <div class="my-orders-empty-icon"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg></div>
        <h4>Chưa tìm thấy đơn hàng nào</h4>
        <p>Không có đơn hàng nào khớp với tìm kiếm. Hãy khám phá ngay các mẫu hoa đẹp của tiệm nhé!</p>
        <button type="button" class="btn-continue-shopping" style="max-width: 200px; margin: 0 auto;" id="btnOrdersExploreFlowers">
          Khám Phá Mẫu Hoa
        </button>
      </div>
    `;
    const exploreBtn = listContainer.querySelector('#btnOrdersExploreFlowers');
    if (exploreBtn) {
      exploreBtn.addEventListener('click', () => {
        closeMyOrdersModal();
        window.location.hash = '#products';
      });
    }
    return;
  }

  listContainer.innerHTML = orders.map(order => {
    const isPaid = isOrderPaid(order);
    const isSepay = order.paymentMethod === 'sepay';
    const isUnpaidSepay = isUnpaidSepayOrder(order);
    const status = order.status || 'pending';
    const displayOrderCode = escapeHTML(order.orderCode || order.order_code || order.id);

    // Badge Thanh Toán
    const paymentBadge = status === 'cancelled'
      ? `<span class="badge-pill" style="background: rgba(217, 45, 32, 0.1); color: #D92D20; border: 1px solid rgba(217, 45, 32, 0.25); font-weight: 700; font-size: 11.5px; padding: 2px 8px; border-radius: 10px;">Đã Hủy Đơn</span>`
      : (isSepay
        ? `<span class="badge-pill" style="background: rgba(16, 132, 116, 0.1); color: #108474; border: 1px solid rgba(16, 132, 116, 0.25); font-weight: 700; font-size: 11.5px; padding: 2px 8px; border-radius: 10px;">SePay (${isPaid ? 'Đã Thanh Toán' : 'Chờ Chuyển Khoản'})</span>`
        : `<span class="badge-pill" style="background: rgba(217, 119, 6, 0.1); color: #d97706; border: 1px solid rgba(217, 119, 6, 0.25); font-weight: 700; font-size: 11.5px; padding: 2px 8px; border-radius: 10px;">COD (${isPaid ? 'Đã Thu Tiền' : 'Thu Khi Nhận'})</span>`);

    // Tính trạng thái Stepper 4 bước chuẩn TMĐT
    let step1Class = status === 'cancelled' ? '' : 'done';
    let step2Class = status === 'cancelled' ? '' : 'done';
    let step2Text = status === 'cancelled' ? 'Đã Hủy' : (isPaid ? 'Đã Nhận Tiền' : 'Tiệm Đã Duyệt');
    let step3Class = '';
    let step4Class = '';

    if (status !== 'cancelled' && isUnpaidSepay) {
      step2Class = 'warning';
      step2Text = 'Chờ Quét QR';
    }

    if (status === 'confirmed') {
      step3Class = 'active';
    } else if (status === 'shipping') {
      step3Class = 'done';
      step4Class = 'active';
    } else if (status === 'completed') {
      step3Class = 'done';
      step4Class = 'done';
    }

    // Thông tin người nhận và giao hoa
    const recipient = escapeHTML(order.recipientName || order.customerName || 'Khách đặt trực tuyến');
    const phone = escapeHTML(order.recipientPhone || order.phone || '');
    const address = escapeHTML(order.address || 'Giao tại TP.HCM');
    const slot = escapeHTML(order.deliverySlot || 'Trong ngày');
    const cardMsg = order.hasGreetingCard
      ? `<div class="order-delivery-line" style="color: #be185d;"><span><strong>Thiệp viết tay:</strong> "${escapeHTML(order.cardMessage || 'Kèm thiệp chúc mừng riêng')}"</span></div>`
      : '';

    // Danh sách món hoa
    const itemsHtml = (order.items || []).map(item => `
      <div class="order-item-mini-row">
        <div class="order-item-mini-left">
          <img src="${escapeHTML(item.image || './images/300.webp')}" alt="${escapeHTML(item.name)}" class="order-item-mini-thumb">
          <span>${escapeHTML(item.name)} <strong style="color: #64748b; font-size: 11px;">× ${item.quantity}</strong></span>
        </div>
        <strong>${formatPrice(item.price * item.quantity)}</strong>
      </div>
    `).join('');

    // Minh bạch giá tiền (Tạm tính, Phí vận chuyển, Giảm giá, Tổng cộng)
    const itemsTotal = (order.items || []).reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
    const subtotal = Number(order.subtotal ?? itemsTotal);
    const shippingFee = Number(order.shippingFee ?? 0);
    const discountAmount = Number(order.discountAmount ?? 0);

    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Vừa xong';

    return `
      <div class="user-order-card" data-order-id="${escapeHTML(order.id)}">
        <div class="user-order-card-header">
          <div class="order-code-meta">
            <span class="order-code-title">
              #${displayOrderCode}
              <button type="button" class="btn-copy-field" data-target="code-${escapeHTML(order.id)}" style="padding: 2px 6px; font-size: 10.5px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer;" title="Sao chép mã đơn">Sao chép</button>
              <input type="hidden" id="code-${escapeHTML(order.id)}" value="${displayOrderCode}">
            </span>
            <span class="order-date-time">${formattedDate}</span>
          </div>
          <div class="order-badges-wrap">
            ${paymentBadge}
          </div>
        </div>

        <!-- Hộp thông tin giao nhận thực tế của shop hoa -->
        <div class="order-delivery-box">
          <div class="order-delivery-line">
            
            <span><strong>Giao tới:</strong> ${recipient} (${phone}) • <em>${address}</em></span>
          </div>
          <div class="order-delivery-line">
            
            <span><strong>Khung giờ giao:</strong> ${slot}</span>
          </div>
          ${cardMsg}
        </div>

        <!-- Stepper 4 bước tiến trình -->
        <div class="order-stepper-tracker">
          <div class="stepper-step ${step1Class}">
            <div class="stepper-circle">1</div>
            <span class="stepper-label">Đã Đặt</span>
          </div>
          <div class="stepper-step ${step2Class}">
            <div class="stepper-circle">2</div>
            <span class="stepper-label">${step2Text}</span>
          </div>
          <div class="stepper-step ${step3Class}">
            <div class="stepper-circle">3</div>
            <span class="stepper-label">Đang Cắm Hoa</span>
          </div>
          <div class="stepper-step ${step4Class}">
            <div class="stepper-circle">4</div>
            <span class="stepper-label">Đang Giao Hoa</span>
          </div>
        </div>

        <!-- Danh sách món hoa -->
        <div class="order-items-mini-list">
          ${itemsHtml}
        </div>

        <!-- Minh bạch chi tiết giá (Price Breakdown) -->
        <div class="order-price-summary-box">
          <div class="price-summary-row">
            <span>Tiền hoa (${(order.items || []).length} mẫu):</span>
            <span>${formatPrice(subtotal)}</span>
          </div>
          <div class="price-summary-row">
            <span>Phí vận chuyển:</span>
            <span>${shippingFee > 0 ? formatPrice(shippingFee) : 'Miễn phí'}</span>
          </div>
          ${discountAmount > 0 ? `
          <div class="price-summary-row discount-row">
            <span>Ưu đãi giảm giá voucher:</span>
            <span>-${formatPrice(discountAmount)}</span>
          </div>` : ''}
          <div class="price-summary-row total-row">
            <span>Tổng thanh toán:</span>
            <span>${formatPrice(order.totalAmount || 0)}</span>
          </div>
        </div>

        <!-- Footer hành động -->
        <div class="user-order-card-footer">
          <div class="order-card-actions">
            ${(isUnpaidSepay && status !== 'cancelled') ? `
            <button type="button" class="btn-order-pay-now" data-order-id="${escapeHTML(order.id)}" title="Quét mã QR VietQR Napas 247 để hoàn tất thanh toán">
              Quét QR Thanh Toán Ngay
            </button>` : ''}
            ${isPaid ? `
            <button type="button" class="btn-order-view-pdf" data-order-id="${escapeHTML(order.id)}" title="Xem và in lại hóa đơn điện tử">
              Xem Hóa Đơn Điện Tử
            </button>` : ''}
            <button type="button" class="btn-order-reorder" data-order-id="${escapeHTML(order.id)}" title="Thêm lại các mẫu hoa này vào giỏ">
              Đặt Lại Đơn Này
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initMyOrdersWorkflow() {
  const modal = document.querySelector('#myOrdersModal');
  const closeBtn = document.querySelector('#myOrdersModalClose');
  const searchInput = document.querySelector('#myOrdersSearchInput');
  const listContainer = document.querySelector('#myOrdersListContainer');

  if (!modal) return;

  if (closeBtn) closeBtn.addEventListener('click', closeMyOrdersModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeMyOrdersModal();
  });

  // Lắng nghe sự kiện từ Header (qua CustomEvent)
  window.addEventListener('open-my-orders', (e) => {
    openMyOrdersModal();
  });

  // Xử lý Tabs phân loại đơn hàng (Tất cả, Chờ chuyển khoản, Đang xử lý, Hoàn tất)
  let activeTabFilter = 'all';
  document.querySelectorAll('.orders-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.orders-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      activeTabFilter = tabBtn.dataset.filter;
      applyOrderFilters();
    });
  });

  function applyOrderFilters() {
    let filtered = [...allLoadedOrders];
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 1. Lọc theo Tab
    if (activeTabFilter === 'unpaid') {
      filtered = filtered.filter(o => o.paymentMethod === 'sepay' && o.paymentStatus !== 'paid');
    } else if (activeTabFilter === 'processing') {
      filtered = filtered.filter(o => o.status === 'confirmed' || o.status === 'shipping');
    } else if (activeTabFilter === 'completed') {
      filtered = filtered.filter(o => o.status === 'completed' || o.paymentStatus === 'paid');
    }

    // 2. Lọc theo Search Query
    if (query) {
      filtered = filtered.filter(o =>
        String(o.id).toLowerCase().includes(query) ||
        (o.phone && o.phone.includes(query)) ||
        (o.recipientPhone && o.recipientPhone.includes(query)) ||
        (o.customerName && o.customerName.toLowerCase().includes(query)) ||
        (o.recipientName && o.recipientName.toLowerCase().includes(query))
      );
    }

    renderMyOrdersList(filtered);
  }

  // Tìm kiếm realtime theo mã đơn hoặc số điện thoại
  if (searchInput) {
    searchInput.addEventListener('input', applyOrderFilters);
  }

  // Event delegation cho các nút hành động trên Order Card
  if (listContainer) {
    listContainer.addEventListener('click', (e) => {
      // 1. Xem Hóa đơn điện tử PDF
      const pdfBtn = e.target.closest('.btn-order-view-pdf');
      if (pdfBtn) {
        const orderId = pdfBtn.dataset.orderId;
        const order = allLoadedOrders.find(o => String(o.id) === String(orderId));
        if (order) {
          exportOrderInvoicePdf(order, { isReceipt: true });
        } else {
          showToast('Không tìm thấy dữ liệu đơn hàng!', 'error');
        }
        return;
      }

      // 2. Quét QR Thanh Toán Ngay cho đơn SePay chưa trả
      const payBtn = e.target.closest('.btn-order-pay-now');
      if (payBtn) {
        const orderId = payBtn.dataset.orderId;
        const order = allLoadedOrders.find(o => String(o.id) === String(orderId));
        if (order) {
          closeMyOrdersModal();
          currentDraftOrder = order;
          const checkoutModal = document.querySelector('#checkoutModal');
          if (checkoutModal) checkoutModal.classList.remove('hidden');
          showSepayQrStep(order);
          showToast(`Đang mở mã VietQR cho đơn #${order.id}...`);
        }
        return;
      }

      // 3. Đặt Lại Đơn Này (Re-order)
      const reorderBtn = e.target.closest('.btn-order-reorder');
      if (reorderBtn) {
        const orderId = reorderBtn.dataset.orderId;
        const order = allLoadedOrders.find(o => String(o.id) === String(orderId));
        if (order && order.items && order.items.length > 0) {
          order.items.forEach(item => {
            addToCart(item, item.quantity);
          });
          updateCartBadge();
          showToast(`Đã thêm ${order.items.length} món hoa của đơn #${order.id} vào giỏ hàng!`, 'success');
          closeMyOrdersModal();
          if (typeof renderCartDrawer === 'function') renderCartDrawer();
          if (typeof openCartDrawer === 'function') openCartDrawer();
        }
        return;
      }
    });
  }
}
