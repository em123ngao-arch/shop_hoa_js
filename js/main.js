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
  saveOrder
} from './storage.js';
import { formatPrice, renderStars, showToast, updateCartBadge, renderHeaderAuth } from './utils.js';

/**
 * main.js - Logic điều khiển trang chủ (index.html)
 * Kế thừa phong cách của Giáo viên và bổ sung các tính năng ES6+ đạt chuẩn đồ án
 */

// Nơi lưu trữ trạng thái dữ liệu (State)
let allCategories = [];
let allProducts = [];
let currentCategoryId = 0;

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

      const catId = Number(btn.dataset.category);
      currentCategoryId = catId;
      applyFilters();
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

  // Tính % giảm giá thực tế nếu có giá cũ (chỉ hiện khi có sale)
  let discountBadgeHtml = '';
  if (product.originalPrice && product.originalPrice > product.price) {
    const discountPercent = Math.round((1 - product.price / product.originalPrice) * 100);
    // Chỉ hiển thị huy hiệu giảm giá khi mức giảm từ 5% trở lên (chuẩn TMĐT cao cấp)
    if (discountPercent >= 5) {
      discountBadgeHtml = `<span class="product-badge-discount">-${discountPercent}%</span>`;
    }
  }

  return `
    <div class="product-card" data-id="${product.id}">
      <!-- KHUNG HÌNH ẢNH HOA CÓ CHIỀU SÂU -->
      <div class="product-image">
        <!-- Huy hiệu giảm giá (Chỉ hiện nếu có giá gốc) -->
        ${discountBadgeHtml}

        <a href="./detail.html?id=${product.id}" class="product-img-link">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
        </a>

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
          ${product.originalPrice ? `<span class="was-price">${formatPrice(product.originalPrice)}</span>` : ''}
          <span class="price">${formatPrice(product.price)}</span>
        </div>

        <div class="product-rating">
          ${renderStars(product.rating || 5)}
          <span class="review-count">(${product.reviewCount || 20})</span>
        </div>
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
        currentCategoryId = 0;
        const allBtn = document.querySelector('.category-btn[data-category="0"]');
        if (allBtn) allBtn.click();
      });
    }
    return;
  }

  // Sử dụng phương thức map() của ES6+
  productList.innerHTML = products.map(p => createProductCardHtml(p)).join('');
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
function applyFilters() {
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  // Sử dụng filter() để lọc kết hợp cả Danh mục và Từ khóa tìm kiếm
  const filtered = allProducts.filter(product => {
    // Điều kiện danh mục
    const matchCategory = (currentCategoryId === 0) || (product.categoryId === currentCategoryId);

    // Điều kiện tìm kiếm tên hoặc mô tả
    const matchSearch = (searchTerm === '') ||
      product.name.toLowerCase().includes(searchTerm) ||
      (product.description && product.description.toLowerCase().includes(searchTerm));

    return matchCategory && matchSearch;
  });

  renderProducts(filtered);
}

/**
 * 4. XỬ LÝ SỰ KIỆN TÌM KIẾM (EVENT LISTENER)
 * Kế thừa chuẩn theo code của Thầy (lắng nghe sự kiện input)
 */
if (searchInput) {
  searchInput.addEventListener('input', () => {
    applyFilters();
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
  const addBtn = event.target.closest('.add-cart');
  if (!addBtn) return;

  event.preventDefault();
  const productId = Number(addBtn.dataset.id);
  
  // Sử dụng find() của ES6 để tìm sản phẩm hoa theo id
  const product = allProducts.find(p => p.id === productId);

  if (product) {
    addToCart(product, 1);
    updateCartBadge();
    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
    if (typeof renderCartDrawer === 'function') {
      renderCartDrawer();
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
    const tagEmoji = isSale ? '🔥' : (banner.theme === 'valentine' ? '💝' : (banner.theme === 'tet' ? '🧧' : '✨'));
    const ctaClass = isSale ? 'hero-cta hero-cta-sale' : 'hero-cta';

    return `
      <div class="hero-slide ${index === 0 ? 'active' : ''}" data-index="${index}" data-theme="${banner.theme || 'default'}">
        <div class="hero-text">
          <span class="hero-tag">${tagEmoji} ${banner.tag || 'Bộ Sưu Tập Hoa Kẽm Nhung'}</span>
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
          <img src="${banner.hinhbanner}" alt="${banner.tenbanner}" loading="eager" onerror="this.src='./images/350.png'">
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
    let typeLabel = 'Ưu Đãi Đặc Biệt';
    if (p.type === 'new_user') typeLabel = 'Khách Hàng Mới';
    else if (p.type === 'birthday') typeLabel = 'Mừng Sinh Nhật';
    else if (p.type === 'flash_sale') typeLabel = 'Giờ Vàng';

    return `
      <div class="voucher-card" data-code="${p.code}">
        <div class="voucher-top">
          <span class="voucher-discount-badge">Giảm ${p.discountPercent}%</span>
          <span class="voucher-type-tag">${typeLabel}</span>
        </div>
        <h4 class="voucher-title">${p.name}</h4>
        <p class="voucher-condition">${p.desc}</p>
        <div class="voucher-bottom">
          <span class="voucher-code-display">${p.code}</span>
          <button type="button" class="voucher-copy-btn" data-code="${p.code}">
            Sao Chép Mã
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Lắng nghe sự kiện click sao chép mã
  container.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.voucher-copy-btn');
    if (!copyBtn) return;

    const code = copyBtn.dataset.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }

    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✓ Đã Lưu Mã';
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

/**
 * 9. ĐIỀU KHIỂN SIDE CART DRAWER & VOUCHER CALCULATION (SHOP-07)
 * Trượt mượt mà từ mép phải màn hình, tính toán tổng tiền và áp dụng mã realtime
 */
let renderCartDrawer = () => {};
let openCartDrawer = () => {};
let closeCartDrawer = () => {};

function initCartDrawer() {
  const cartButton = document.querySelector('#cartButton');
  const cartBackdrop = document.querySelector('#cartBackdrop');
  const cartDrawer = document.querySelector('#cartDrawer');
  const drawerCloseBtn = document.querySelector('#drawerCloseBtn');
  const drawerContinueBtn = document.querySelector('#drawerContinueBtn');
  const emptyCartExploreBtn = document.querySelector('#emptyCartExploreBtn');
  const drawerCartItems = document.querySelector('#drawerCartItems');
  const applyVoucherBtn = document.querySelector('#applyVoucherBtn');
  const voucherInput = document.querySelector('#voucherInput');
  const drawerCheckoutBtn = document.querySelector('#drawerCheckoutBtn');

  openCartDrawer = function () {
    if (!cartDrawer || !cartBackdrop) return;
    cartDrawer.classList.add('open');
    cartBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCartDrawer();
  };

  closeCartDrawer = function () {
    if (!cartDrawer || !cartBackdrop) return;
    cartDrawer.classList.remove('open');
    cartBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  };

  renderCartDrawer = function () {
    const summary = getCartSummary();
    const countTag = document.querySelector('#drawerCartCountTag');
    const itemsContainer = document.querySelector('#drawerCartItems');
    const emptyState = document.querySelector('#drawerCartEmpty');
    const subtotalEl = document.querySelector('#drawerSubtotal');
    const discountRow = document.querySelector('#drawerDiscountRow');
    const discountLabel = document.querySelector('#drawerDiscountLabel');
    const discountEl = document.querySelector('#drawerDiscount');
    const totalEl = document.querySelector('#drawerTotal');
    const appliedInfo = document.querySelector('#appliedVoucherInfo');

    const totalCount = summary.items.reduce((sum, item) => sum + item.quantity, 0);
    if (countTag) countTag.textContent = `${totalCount} sản phẩm`;

    if (summary.items.length === 0) {
      if (itemsContainer) itemsContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      if (subtotalEl) subtotalEl.textContent = '0 ₫';
      if (discountRow) discountRow.classList.add('hidden');
      if (totalEl) totalEl.textContent = '0 ₫';
      if (appliedInfo) appliedInfo.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (itemsContainer) {
      itemsContainer.innerHTML = summary.items.map(item => `
        <div class="drawer-item" data-id="${item.id}">
          <img src="${item.image}" alt="${item.name}" class="drawer-item-img">
          <div class="drawer-item-info">
            <div class="drawer-item-title" title="${item.name}">${item.name}</div>
            <div class="drawer-item-price">${formatPrice(item.price)}</div>
            <div class="drawer-item-actions">
              <div class="drawer-qty-control">
                <button type="button" class="qty-btn qty-minus" data-id="${item.id}">−</button>
                <span class="qty-value">${item.quantity}</span>
                <button type="button" class="qty-btn qty-plus" data-id="${item.id}">+</button>
              </div>
              <button type="button" class="drawer-item-delete" data-id="${item.id}" title="Xóa sản phẩm">Xóa</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (subtotalEl) subtotalEl.textContent = formatPrice(summary.subtotal);

    if (summary.discountAmount > 0 && summary.appliedVoucher) {
      if (discountRow) {
        discountRow.classList.remove('hidden');
        if (discountLabel) {
          discountLabel.textContent = `Giảm giá (${summary.appliedVoucher.code} - ${summary.appliedVoucher.discountPercent}%):`;
        }
        if (discountEl) {
          discountEl.textContent = `-${formatPrice(summary.discountAmount)}`;
        }
      }
      if (appliedInfo) {
        appliedInfo.classList.remove('hidden');
        appliedInfo.innerHTML = `
          <span>🎉 Mã <strong>${summary.appliedVoucher.code}</strong> (-${summary.appliedVoucher.discountPercent}%)</span>
          <button type="button" class="remove-voucher-btn" id="removeVoucherBtn">Gỡ mã</button>
        `;
        const removeBtn = appliedInfo.querySelector('#removeVoucherBtn');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            removeVoucher();
            renderCartDrawer();
            showToast('Đã gỡ bỏ mã giảm giá!');
          });
        }
      }
    } else {
      if (discountRow) discountRow.classList.add('hidden');
      if (appliedInfo) appliedInfo.classList.add('hidden');
    }

    if (totalEl) totalEl.textContent = formatPrice(summary.totalPrice);
  };

  // Mở giỏ hàng khi click icon giỏ hàng trên Header
  if (cartButton) {
    cartButton.addEventListener('click', (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  }

  // Đóng giỏ hàng
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeCartDrawer);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartDrawer);
  if (drawerContinueBtn) drawerContinueBtn.addEventListener('click', closeCartDrawer);
  if (emptyCartExploreBtn) {
    emptyCartExploreBtn.addEventListener('click', () => {
      closeCartDrawer();
      window.location.hash = '#products';
    });
  }

  // Đóng bằng phím ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartDrawer && cartDrawer.classList.contains('open')) {
      closeCartDrawer();
    }
  });

  // Sự kiện tăng giảm số lượng & xóa sản phẩm (Event Delegation)
  if (drawerCartItems) {
    drawerCartItems.addEventListener('click', (e) => {
      const plusBtn = e.target.closest('.qty-plus');
      const minusBtn = e.target.closest('.qty-minus');
      const deleteBtn = e.target.closest('.drawer-item-delete');

      if (plusBtn) {
        const id = plusBtn.dataset.id;
        updateCartQuantity(id, +1);
        updateCartBadge();
        renderCartDrawer();
      } else if (minusBtn) {
        const id = minusBtn.dataset.id;
        updateCartQuantity(id, -1);
        updateCartBadge();
        renderCartDrawer();
      } else if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        removeCartItem(id);
        updateCartBadge();
        renderCartDrawer();
        showToast('Đã xóa mẫu hoa khỏi giỏ hàng!');
      }
    });
  }

  // Áp dụng mã Voucher
  if (applyVoucherBtn && voucherInput) {
    const handleApply = async () => {
      const code = voucherInput.value;
      const result = await applyVoucher(code);
      if (result.success) {
        showToast(result.message);
        renderCartDrawer();
      } else {
        showToast(result.message, 'error');
      }
    };

    applyVoucherBtn.addEventListener('click', handleApply);
    voucherInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
    });
  }

  // Nút Tiến Hành Đặt Hàng
  if (drawerCheckoutBtn) {
    drawerCheckoutBtn.addEventListener('click', async () => {
      const summary = getCartSummary();
      if (summary.items.length === 0) {
        showToast('Giỏ hàng của bạn đang trống! Vui lòng chọn hoa trước.', 'error');
        return;
      }

      // Tạo đơn hàng lưu vào hệ thống để đồng bộ sang trang Admin Dashboard
      const newOrder = await saveOrder({
        customerName: 'Khách Đặt Hàng Trực Tuyến',
        phone: '0908889999',
        address: '14 Trịnh Đình Thảo, Hòa Thạnh, Tân Phú, TP.HCM',
        note: 'Giao hỏa tốc trong ngày',
        items: [...summary.items],
        subtotal: summary.subtotal,
        discountAmount: summary.discountAmount,
        totalAmount: summary.totalPrice,
        status: 'pending'
      });

      // Dọn sạch giỏ hàng và gỡ voucher sau khi đặt thành công
      localStorage.removeItem('SHOP_HOA_CART');
      localStorage.removeItem('SHOP_HOA_APPLIED_VOUCHER');
      updateCartBadge();
      renderCartDrawer();

      showToast(`🎉 Đặt hàng thành công! Mã đơn: ${newOrder.id}`);
      setTimeout(() => {
        closeCartDrawer();
      }, 1500);
    });
  }
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
        navigator.clipboard.writeText(code).catch(() => {});
      }
      copyBtn.textContent = '✓ Đã Lưu';
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

  // Hiển thị nhẹ nhàng sau 2.5s khi người dùng truy cập lần đầu trong phiên
  const hasShown = sessionStorage.getItem('birthday_shown');
  if (!hasShown) {
    setTimeout(() => {
      showBirthdayModal();
    }, 2500);
  }
}

/**
 * 11. KHỞI TẠO DỮ LIỆU BAN ĐẦU KHI MỞ TRANG
 */
async function init() {
  renderHeaderAuth(); // Khởi tạo lời chào tài khoản và phân quyền trên header
  updateCartBadge();

  try {
    if (loadingElement) loadingElement.classList.remove('hidden');

    // Nạp đồng thời banner, danh mục, sản phẩm, top bán chạy, sản phẩm mới và voucher khuyến mãi
    const [banners, categories, products, bestSellers, newestProducts, promotions] = await Promise.all([
      fetchBanners(),
      fetchCategories(),
      fetchProducts(),
      fetchBestSellers(4),
      fetchNewestProducts(4),
      fetchPromotions()
    ]);

    allCategories = categories;
    allProducts = products;

    if (loadingElement) loadingElement.classList.add('hidden');

    // Khởi tạo các thành phần giao diện
    initHeroSlider(banners);
    renderBestSellers(bestSellers);
    renderNewestProducts(newestProducts);
    initFlashSale(allProducts);
    startFlashSaleTimer();
    renderVouchers(promotions);
    renderCategories(allCategories);
    renderProducts(allProducts);
    initCartDrawer();
    initBirthdayModal();
  } catch (error) {
    console.error('Lỗi khởi tạo dữ liệu trang chủ:', error);
    if (loadingElement) loadingElement.classList.add('hidden');
    if (errorElement) errorElement.classList.remove('hidden');
  }
}

// Bắt đầu chạy chương trình khi file được nạp
init();


