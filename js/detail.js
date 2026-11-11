import { fetchProductById, fetchProducts, addToCart, fetchPromotions, fetchProductReviews, submitProductReview, fetchWishlistStorage, toggleWishlistStorage } from './storage.js';
import { formatPrice, renderStars, showToast, updateCartBadge, renderHeaderAuth, escapeHTML, updateWishlistBadge } from './utils.js';
import { initUniversalCartDrawer, openCartDrawer } from './cart-drawer.js';
import { initCheckoutWorkflow, openCheckoutModal } from './checkout.js';
import { initMobileBottomNav } from './bottom-nav.js';

/**
 * detail.js - Logic điều khiển trang chi tiết sản phẩm (detail.html)
 * Nâng cấp trải nghiệm UI/UX toàn diện: Skeleton Shimmer, Thumbnails, Phụ kiện, Sticky Bar, Mua ngay tức thì
 */

// Các phần tử DOM chính
const loadingElement = document.querySelector('#loading');
const errorElement = document.querySelector('#error');
const productDetail = document.querySelector('#productDetail');
const breadcrumbCategory = document.querySelector('#breadcrumbCategory');
const breadcrumbProduct = document.querySelector('#breadcrumbProduct');
const relatedGrid = document.querySelector('#relatedGrid');

let currentProduct = null;
let currentQuantity = 1;

/**
 * 1. LẤY ID SẢN PHẨM TỪ URL PARAMS
 */
function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * 2. RENDER GIAO DIỆN CHI TIẾT SẢN PHẨM
 */
async function renderDetail(product) {
  if (!productDetail) return;

  const wishlist = await fetchWishlistStorage();
  const isFav = wishlist.includes(String(product.id));

  // Cập nhật Breadcrumbs
  if (breadcrumbCategory) {
    breadcrumbCategory.textContent = product.categoryName || 'Hoa Kẽm Nhung';
    breadcrumbCategory.href = `./index.html`;
  }
  if (breadcrumbProduct) {
    breadcrumbProduct.textContent = product.name;
  }
  document.title = `${product.name} - Shop Hoa Kẽm Nhung`;

  // Tính phần trăm giảm giá nếu có (chỉ hiện khi originalPrice > price - UX-02)
  let discountBadge = '';
  let imageDiscountBadge = '';
  const isProductRealSale = Boolean(product.originalPrice && Number(product.originalPrice) > Number(product.price));
  if (isProductRealSale) {
    const percent = Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100);
    if (percent >= 5) {
      imageDiscountBadge = `<span class="product-badge-discount" style="top: 14px; left: 14px; font-size: 13px; padding: 4px 10px;">-${percent}%</span>`;
      const savedAmount = Number(product.originalPrice) - Number(product.price);
      discountBadge = `<span class="detail-save-badge">Tiết kiệm ${formatPrice(savedAmount)} (-${percent}%)</span>`;
    }
  }

  // Tìm voucher hợp lệ áp dụng cho sản phẩm này
  let voucherHintHtml = '';
  try {
    const promotions = await fetchPromotions();
    const now = new Date();
    const isProductOnSale = Boolean(product.originalPrice && product.originalPrice > product.price);

    const applicablePromo = (promotions || []).find(p => {
      if (!p.active) return false;
      if (p.startDate && new Date(p.startDate) > now) return false;
      if (p.endDate) {
        const end = new Date(p.endDate);
        end.setHours(23, 59, 59, 999);
        if (end < now) return false;
      }
      if (typeof p.usageLimit === 'number' && typeof p.usedCount === 'number' && p.usedCount >= p.usageLimit) {
        return false;
      }
      if (p.excludeSaleItems && isProductOnSale) {
        return false;
      }
      if (p.scope === 'product' && Array.isArray(p.targetProductIds) && p.targetProductIds.includes(String(product.id))) {
        return true;
      }
      if (p.scope === 'category' && Array.isArray(p.targetCategoryIds) && p.targetCategoryIds.includes(String(product.categoryId))) {
        return true;
      }
      return false;
    });

    if (applicablePromo) {
      const isPct = (applicablePromo.discountType || 'percent') === 'percent';
      const val = applicablePromo.discountValue ?? applicablePromo.discountPercent ?? 0;
      const txt = isPct ? `-${val}%` : `-${formatPrice(val)}`;
      const scopeLabel = applicablePromo.scope === 'product' ? 'Ưu đãi riêng cho mẫu này' : 'Ưu đãi danh mục';
      voucherHintHtml = `
        <div class="product-voucher-tag" style="margin-top: 8px; font-size: 12px; padding: 6px 12px;" title="${applicablePromo.desc || ''}">
          <span>🎫 ${scopeLabel}: Nhập mã <strong>${applicablePromo.code}</strong> để giảm thêm ${txt} khi thanh toán</span>
        </div>
      `;
    }
  } catch (e) {}

  // Render toàn bộ layout chi tiết
  productDetail.innerHTML = `
    <div class="detail-layout">
      <!-- CỘT TRÁI: ẢNH SẢN PHẨM & DẢI ẢNH THU NHỎ -->
      <div class="detail-gallery">
        <div class="main-image-wrap">
          ${imageDiscountBadge}
          ${product.badge ? `<span class="detail-badge-corner">${product.badge}</span>` : ''}
          <img src="${product.image}" alt="${product.name}" id="mainDetailImage">
        </div>

        <!-- Dải ảnh thu nhỏ (Detail Thumbnails) -->
        <div class="detail-thumbnails" id="detailThumbnails">
          <button type="button" class="thumb-item active" data-src="${product.image}" aria-label="Góc chính diện">
            <img src="${product.image}" alt="${product.name} - Góc 1">
          </button>
          <button type="button" class="thumb-item" data-src="${product.image}" aria-label="Cận cảnh chất liệu kẽm nhung">
            <img src="${product.image}" alt="${product.name} - Góc 2">
          </button>
          <button type="button" class="thumb-item" data-src="${product.image}" aria-label="Góc gói giấy thủ công">
            <img src="${product.image}" alt="${product.name} - Góc 3">
          </button>
        </div>
      </div>

      <!-- CỘT PHẢI: THÔNG TIN VÀ ĐẶT HÀNG -->
      <div class="detail-info">
        <span class="detail-category-tag">${product.categoryName || 'Hoa Kẽm Nhung Handmade'}</span>
        
        <h1 class="detail-title">${product.name}</h1>

        <div class="detail-meta">
          <div class="detail-rating">
            ${renderStars(product.rating || 5)}
            <span style="font-weight: 600; color: var(--text-main);">${product.rating || 5}.0</span>
            <span style="color: var(--text-muted);">(${product.reviewCount || 25} đánh giá)</span>
          </div>

          <span style="color: var(--border-light);">|</span>

          <div class="detail-stock-status">
            <span class="status-dot"></span>
            <span>Còn hàng (${product.stock || 20} sản phẩm sẵn có)</span>
          </div>
        </div>

        <div class="detail-price-box">
          <span class="detail-price" id="detailPriceDisplay">${formatPrice(product.price)}</span>
          ${(product.originalPrice && Number(product.originalPrice) > Number(product.price)) ? `<span class="detail-was-price">${formatPrice(product.originalPrice)}</span>` : ''}
          ${discountBadge}
        </div>

        ${voucherHintHtml}

        <div class="detail-desc">
          <p>${product.description || 'Sản phẩm hoa handmade tinh xảo, chất lượng cao uốn từ sợi kẽm nhung bền đẹp.'}</p>
        </div>

        <!-- KHỐI TÙY CHỌN PHỤ KIỆN (ADD-ONS) -->
        <div class="addon-options">
          <span class="quantity-label">Tùy chọn thêm phụ kiện:</span>
          <div class="addon-list" id="addonList">
            <label class="addon-chip">
              <input type="checkbox" name="addon" value="15000" data-name="Đèn LED đom đóm">
              <span>+ Đèn LED đom đóm (15.000 ₫)</span>
            </label>
            <label class="addon-chip">
              <input type="checkbox" name="addon" value="10000" data-name="Thiệp viết tay cao cấp">
              <span>+ Thiệp viết tay (10.000 ₫)</span>
            </label>
            <label class="addon-chip">
              <input type="checkbox" name="addon" value="20000" data-name="Túi kính trong suốt">
              <span>+ Túi kính trong suốt (20.000 ₫)</span>
            </label>
          </div>
        </div>

        <!-- BỘ CHỌN SỐ LƯỢNG (Bỏ readonly, cho phép nhập bàn phím trực tiếp) -->
        <div class="quantity-control">
          <label class="quantity-label" for="qtyInput">Số lượng:</label>
          <div class="quantity-box">
            <button type="button" class="qty-btn" id="btnMinus" aria-label="Giảm số lượng">−</button>
            <input type="number" class="qty-input" id="qtyInput" value="1" min="1" max="${product.stock || 99}" inputmode="numeric">
            <button type="button" class="qty-btn" id="btnPlus" aria-label="Tăng số lượng">+</button>
          </div>
        </div>

        <!-- NÚT HÀNH ĐỘNG -->
        <div class="action-buttons" id="mainActionButtons">
          <button type="button" class="btn-add-cart" id="btnAddToCart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            Thêm Vào Giỏ Hàng
          </button>

          <button type="button" class="btn-buy-now" id="btnBuyNow">
            Mua Ngay
          </button>

          <button type="button" class="btn-detail-wishlist ${isFav ? 'active' : ''}" id="btnDetailWishlist" title="${isFav ? 'Bỏ yêu thích' : 'Lưu mẫu hoa vào danh sách yêu thích'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span>${isFav ? 'Đã Yêu Thích' : 'Yêu Thích'}</span>
          </button>
        </div>

        <!-- CAM KẾT DỊCH VỤ CHUẨN FLOWER CHIMP -->
        <div class="detail-guarantees">
          <div class="guarantee-item">
            <svg class="guarantee-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            <span><strong>Giao hỏa tốc trong ngày</strong> — Cam kết đúng hẹn, bảo quản hoa cẩn thận.</span>
          </div>

          <div class="guarantee-item">
            <svg class="guarantee-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
            <span><strong>Tặng kèm thiệp chúc mừng</strong> — Miễn phí in thông điệp yêu thương.</span>
          </div>

          <div class="guarantee-item">
            <svg class="guarantee-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span><strong>Hoa kẽm nhung bền đẹp vĩnh cửu</strong> — 100% thủ công tỉ mỉ từng cánh hoa.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- KHU VỰC ĐÁNH GIÁ & BÌNH LUẬN TƯƠNG TÁC (REVIEWS) -->
    <section class="reviews-container-block" id="productReviewsSection"></section>
  `;

  // Gắn sự kiện nút Yêu thích trên trang chi tiết
  const btnWishlist = document.getElementById('btnDetailWishlist');
  if (btnWishlist) {
    btnWishlist.addEventListener('click', async () => {
      const res = await toggleWishlistStorage(product.id);
      btnWishlist.classList.toggle('active', res.isFavorite);
      const span = btnWishlist.querySelector('span');
      if (span) span.textContent = res.isFavorite ? 'Đã Yêu Thích' : 'Yêu Thích';
      const svg = btnWishlist.querySelector('svg');
      if (svg) svg.setAttribute('fill', res.isFavorite ? 'currentColor' : 'none');
      await updateWishlistBadge();
      showToast(res.isFavorite ? 'Đã thêm mẫu hoa vào danh sách yêu thích' : 'Đã bỏ yêu thích mẫu hoa', 'info');
    });
  }

  // Khởi tạo và nạp danh sách Đánh giá & Bình luận
  await renderReviewsSection(product);

  // 1. Chuyển đổi ảnh Thumbnail
  setupThumbnails();

  // 2. Gắn sự kiện tính giá và số lượng
  setupInteractivePriceAndQuantity(product);

  // 3. Gắn sự kiện thanh Sticky Mobile Action Bar
  setupStickyBuyBar(product);

  // 4. Gắn sự kiện nút Mua / Thêm giỏ
  setupCartButtons(product);
}

/**
 * 3. XỬ LÝ CHUYỂN ĐỔI ẢNH THUMBNAIL
 */
function setupThumbnails() {
  const thumbsContainer = document.querySelector('#detailThumbnails');
  const mainImage = document.querySelector('#mainDetailImage');

  if (thumbsContainer && mainImage) {
    thumbsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.thumb-item');
      if (!btn) return;
      thumbsContainer.querySelectorAll('.thumb-item').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      const newSrc = btn.dataset.src;
      if (newSrc) {
        mainImage.style.opacity = '0.6';
        setTimeout(() => {
          mainImage.src = newSrc;
          mainImage.style.opacity = '1';
        }, 120);
      }
    });
  }
}

/**
 * 4. XỬ LÝ TÍNH GIÁ ĐỘNG & BỘ SỐ LƯỢNG NHẬP TỰ DO
 */
function setupInteractivePriceAndQuantity(product) {
  const btnMinus = document.querySelector('#btnMinus');
  const btnPlus = document.querySelector('#btnPlus');
  const qtyInput = document.querySelector('#qtyInput');
  const addonInputs = document.querySelectorAll('input[name="addon"]');
  const stickyPriceEl = document.querySelector('#stickyPriceDisplay');
  const detailPriceDisplay = document.querySelector('#detailPriceDisplay');
  const maxStock = product.stock || 99;

  const calculateAddonTotal = () => {
    let total = 0;
    addonInputs.forEach(chk => {
      if (chk.checked) total += parseInt(chk.value, 10) || 0;
    });
    return total;
  };

  const updateLiveDisplay = () => {
    const addonTotal = calculateAddonTotal();
    const unitPrice = product.price + addonTotal;
    const finalTotal = unitPrice * currentQuantity;

    if (detailPriceDisplay) {
      detailPriceDisplay.textContent = formatPrice(unitPrice);
    }
    if (stickyPriceEl) {
      stickyPriceEl.textContent = formatPrice(finalTotal);
    }
  };

  // Nút trừ
  if (btnMinus) {
    btnMinus.addEventListener('click', () => {
      if (currentQuantity > 1) {
        currentQuantity--;
        if (qtyInput) qtyInput.value = currentQuantity;
        updateLiveDisplay();
      }
    });
  }

  // Nút cộng
  if (btnPlus) {
    btnPlus.addEventListener('click', () => {
      if (currentQuantity < maxStock) {
        currentQuantity++;
        if (qtyInput) qtyInput.value = currentQuantity;
        updateLiveDisplay();
      } else {
        showToast(`Chỉ còn ${maxStock} sản phẩm trong kho!`, 'error');
      }
    });
  }

  // Nhập số lượng trực tiếp từ bàn phím
  if (qtyInput) {
    const handleManualInput = () => {
      let val = parseInt(qtyInput.value, 10);
      if (isNaN(val) || val < 1) {
        val = 1;
      } else if (val > maxStock) {
        val = maxStock;
        showToast(`Kho chỉ còn sẵn ${maxStock} sản phẩm!`, 'error');
      }
      currentQuantity = val;
      qtyInput.value = currentQuantity;
      updateLiveDisplay();
    };

    qtyInput.addEventListener('change', handleManualInput);
    qtyInput.addEventListener('blur', handleManualInput);
  }

  // Bắt sự kiện thay đổi phụ kiện (Add-ons)
  addonInputs.forEach(chk => {
    chk.addEventListener('change', () => {
      updateLiveDisplay();
      const name = chk.dataset.name;
      if (chk.checked) {
        showToast(`Đã thêm tùy chọn: ${name}`);
      }
    });
  });

  // Cập nhật khởi tạo lần đầu
  updateLiveDisplay();
}

/**
 * 5. KHỞI TẠO THANH STICKY BUY BAR TRÊN MOBILE
 */
function setupStickyBuyBar(product) {
  const stickyBar = document.querySelector('#stickyBuyBar');
  const mainActions = document.querySelector('#mainActionButtons');
  const btnStickyAddCart = document.querySelector('#btnStickyAddCart');
  const btnStickyBuyNow = document.querySelector('#btnStickyBuyNow');

  if (stickyBar && mainActions && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const isPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        stickyBar.classList.toggle('is-visible', isPassed);
        stickyBar.setAttribute('aria-hidden', String(!isPassed));
        document.body.classList.toggle('sticky-bar-active', isPassed);
      });
    }, { threshold: 0 });

    observer.observe(mainActions);
  }

  if (btnStickyAddCart) {
    btnStickyAddCart.addEventListener('click', () => {
      document.querySelector('#btnAddToCart')?.click();
    });
  }

  if (btnStickyBuyNow) {
    btnStickyBuyNow.addEventListener('click', () => {
      document.querySelector('#btnBuyNow')?.click();
    });
  }
}

/**
 * 6. XỬ LÝ NÚT THÊM VÀO GIỎ VÀ MUA NGAY ĐỒNG BỘ PHỤ KIỆN
 */
function setupCartButtons(product) {
  const btnAddToCart = document.querySelector('#btnAddToCart');
  const btnBuyNow = document.querySelector('#btnBuyNow');

  // Đóng gói sản phẩm kèm phụ kiện đã chọn
  function buildProductWithAddons() {
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="addon"]:checked'));
    const addonsList = checkedBoxes.map(chk => ({
      name: chk.dataset.name,
      price: parseInt(chk.value, 10) || 0
    }));

    const addonPriceTotal = addonsList.reduce((sum, a) => sum + a.price, 0);
    const addonsText = addonsList.map(a => a.name).join(', ');

    return {
      ...product,
      id: addonsList.length ? `${product.id}-addon-${addonsList.map(a => a.price).join('_')}` : product.id,
      name: product.name,
      price: product.price + addonPriceTotal,
      originalPrice: (product.originalPrice || product.price) + addonPriceTotal,
      addonsText: addonsText || null,
      selectedAddons: addonsList
    };
  }

  if (btnAddToCart) {
    btnAddToCart.addEventListener('click', () => {
      if (product.stock !== undefined && product.stock <= 0) {
        showToast('Mẫu hoa này hiện tại đã hết hàng!', 'error');
        return;
      }
      const itemToAdd = buildProductWithAddons();
      addToCart(itemToAdd, currentQuantity);
      updateCartBadge();
      showToast(`Đã thêm ${currentQuantity} bó "${itemToAdd.name}" vào giỏ hàng!`);
      openCartDrawer();
    });
  }

  if (btnBuyNow) {
    btnBuyNow.addEventListener('click', () => {
      if (product.stock !== undefined && product.stock <= 0) {
        showToast('Mẫu hoa này hiện tại đã hết hàng!', 'error');
        return;
      }
      const itemToAdd = buildProductWithAddons();
      addToCart(itemToAdd, currentQuantity);
      updateCartBadge();
      showToast('Đang mở màn hình thanh toán...');

      // Mở trực tiếp Modal Thanh Toán ngay tại trang chi tiết
      setTimeout(() => {
        if (typeof openCheckoutModal === 'function') {
          openCheckoutModal();
        }
      }, 300);
    });
  }
}

/**
 * 7. RENDER SẢN PHẨM LIÊN QUAN (RELATED PRODUCTS)
 */
async function renderRelatedProducts(product) {
  if (!relatedGrid) return;

  const allProducts = await fetchProducts();
  
  const related = allProducts
    .filter(p => p.id !== product.id && (p.categoryId === product.categoryId || p.categorySlug === product.categorySlug))
    .slice(0, 4);

  if (related.length === 0) {
    const section = document.querySelector('.related-section');
    if (section) section.style.display = 'none';
    return;
  }

  relatedGrid.innerHTML = related.map(item => `
    <div class="product-card">
      <div class="product-image">
        <a href="./detail.html?id=${item.id}">
          <img src="${item.image}" alt="${item.name}">
        </a>
        ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ''}
        <button class="quick-add-btn" data-id="${item.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          Thêm nhanh
        </button>
      </div>

      <div class="product-info">
        <span class="product-category">${item.categoryName || 'Hoa Handmade'}</span>
        <h3 class="product-title">
          <a href="./detail.html?id=${item.id}">${item.name}</a>
        </h3>
        
        <div class="product-rating">
          ${renderStars(item.rating || 5)}
          <span class="rating-count">(${item.reviewCount || 10})</span>
        </div>

        <div class="product-price-row">
          <span class="price">${formatPrice(item.price)}</span>
          ${(item.originalPrice && Number(item.originalPrice) > Number(item.price)) ? `<span class="was-price">${formatPrice(item.originalPrice)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Gắn sự kiện thêm nhanh trên sản phẩm liên quan
  relatedGrid.querySelectorAll('.quick-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const targetProduct = allProducts.find(p => p.id == id);
      if (targetProduct) {
        addToCart(targetProduct, 1);
        updateCartBadge();
        showToast(`Đã thêm "${targetProduct.name}" vào giỏ hàng!`);
        openCartDrawer();
      }
    });
  });
}

/**
 * 8. KHỞI TẠO TRANG CHI TIẾT
 */
async function initDetail() {
  updateCartBadge();
  renderHeaderAuth();
  initUniversalCartDrawer();
  initCheckoutWorkflow();
  initMobileBottomNav();

  // Bắt sự kiện tìm kiếm trên detail.html (UX-06)
  const headerSearchInput = document.getElementById('headerSearchInput');
  const headerSearchBtn = document.getElementById('headerSearchBtn');
  const handleDetailSearch = () => {
    const val = headerSearchInput ? headerSearchInput.value.trim() : '';
    if (val) {
      window.location.href = `./index.html?search=${encodeURIComponent(val)}#products`;
    }
  };
  if (headerSearchBtn) headerSearchBtn.addEventListener('click', handleDetailSearch);
  if (headerSearchInput) {
    headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleDetailSearch();
    });
  }

  const productId = getProductIdFromUrl();

  if (!productId) {
    if (loadingElement) loadingElement.classList.add('hidden');
    if (errorElement) errorElement.classList.remove('hidden');
    return;
  }

  try {
    if (loadingElement) loadingElement.classList.remove('hidden');
    const product = await fetchProductById(productId);

    if (loadingElement) loadingElement.classList.add('hidden');

    if (!product) {
      if (errorElement) errorElement.classList.remove('hidden');
      return;
    }

    currentProduct = product;
    await renderDetail(currentProduct);
    renderRelatedProducts(currentProduct);

    // Xử lý cờ mở thanh toán từ URL nếu có
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openCheckout') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname + `?id=${productId}`);
      setTimeout(() => {
        openCheckoutModal();
      }, 350);
    }
  } catch (error) {
    console.error('Lỗi khi nạp chi tiết sản phẩm:', error);
    if (loadingElement) loadingElement.classList.add('hidden');
    if (errorElement) errorElement.classList.remove('hidden');
  }
}

/**
 * 6. KHU VỰC ĐÁNH GIÁ & BÌNH LUẬN TƯƠNG TÁC (REVIEWS & STAR PICKER)
 */
async function renderReviewsSection(product) {
  const reviewsContainer = document.querySelector('#productReviewsSection');
  if (!reviewsContainer) return;

  const reviews = await fetchProductReviews(product.id);
  const validReviews = reviews.filter(r => !r.hidden);

  // Tính điểm trung bình bằng reduce (xử lý chia 0 an toàn)
  const avgRating = validReviews.length === 0
    ? (product.rating || 5.0)
    : Number((validReviews.reduce((sum, r) => sum + Number(r.rating), 0) / validReviews.length).toFixed(1));

  let selectedRating = 5;

  reviewsContainer.innerHTML = `
    <div class="reviews-header-row">
      <div>
        <h3 style="font-family: var(--font-heading); font-size: 20px; color: var(--text-main); margin-bottom: 6px;">
          Đánh Giá & Phản Hồi Từ Khách Hàng
        </h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">Trải nghiệm thực tế từ những người đã nhận bó hoa kẽm nhung này</p>
      </div>
      <div class="reviews-score-box">
        <div class="reviews-big-score">${avgRating}</div>
        <div class="reviews-score-meta">
          <div class="reviews-star-line">${renderStars(avgRating)}</div>
          <span class="reviews-total-text">Dựa trên ${validReviews.length} lượt đánh giá thực tế</span>
        </div>
      </div>
    </div>

    <!-- Form Gửi Đánh Giá -->
    <div class="review-form-card">
      <h4>Gửi Cảm Nhận Của Bạn</h4>
      <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 12px;">Bạn thấy chất lượng hoa kẽm nhung và độ tỉ mỉ thế nào? Hãy đánh giá để tiệm hoàn thiện hơn nhé!</p>
      
      <div style="margin-bottom: 12px;">
        <span style="font-size: 12.5px; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 6px;">Chọn mức độ hài lòng:</span>
        <div class="star-picker-wrap" id="starPickerWrap">
          <button type="button" class="star-picker-btn active" data-rating="1">★</button>
          <button type="button" class="star-picker-btn active" data-rating="2">★</button>
          <button type="button" class="star-picker-btn active" data-rating="3">★</button>
          <button type="button" class="star-picker-btn active" data-rating="4">★</button>
          <button type="button" class="star-picker-btn active" data-rating="5">★</button>
        </div>
      </div>

      <div class="review-form-grid">
        <input type="text" id="reviewAuthorInput" class="review-input-field" placeholder="Họ và tên của bạn...">
        <input type="text" id="reviewPhoneInput" class="review-input-field" placeholder="Số điện thoại (không bắt buộc)...">
      </div>

      <textarea id="reviewCommentInput" class="review-textarea" placeholder="Chia sẻ cảm nhận chi tiết về bó hoa kẽm nhung, thời gian giao hàng, độ bền màu... (tối thiểu 3 ký tự)"></textarea>

      <button type="button" class="btn-submit-review" id="btnSubmitReview">
        Gửi Đánh Giá Ngay
      </button>
    </div>

    <!-- Danh sách đánh giá -->
    <div class="reviews-list-wrap">
      ${validReviews.length === 0 ? `
        <div class="notif-empty" style="background: #FFFFFF; border: 1px dashed var(--border-light); border-radius: 10px; padding: 30px;">
          Chưa có đánh giá nào cho mẫu hoa này. Hãy là người đầu tiên để lại cảm nhận bạn nhé!
        </div>
      ` : validReviews.map(r => `
        <div class="review-item-card">
          <div class="review-card-head">
            <div class="review-author-info">
              ${r.userAvatar ? `<img src="${r.userAvatar}" class="review-author-avatar" alt="${escapeHTML(r.userName)}">` : `<div class="review-author-avatar">${escapeHTML(r.userName || 'K').charAt(0).toUpperCase()}</div>`}
              <div>
                <div class="review-author-name">${escapeHTML(r.userName || 'Khách Mua Hoa')}</div>
                <div class="review-created-date">${new Date(r.createdAt).toLocaleDateString('vi-VN')}</div>
              </div>
            </div>
            <div class="review-stars-given">${renderStars(r.rating || 5)}</div>
          </div>
          <div class="review-comment-body">
            ${escapeHTML(r.comment)}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Xử lý Star Picker hover & click
  const starBtns = reviewsContainer.querySelectorAll('.star-picker-btn');
  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = Number(btn.dataset.rating);
      updateStarPickerUI(selectedRating);
    });
    btn.addEventListener('mouseenter', () => {
      const hoverRating = Number(btn.dataset.rating);
      starBtns.forEach(b => {
        const r = Number(b.dataset.rating);
        b.classList.toggle('hover', r <= hoverRating);
      });
    });
  });

  const pickerWrap = reviewsContainer.querySelector('#starPickerWrap');
  if (pickerWrap) {
    pickerWrap.addEventListener('mouseleave', () => {
      starBtns.forEach(b => b.classList.remove('hover'));
      updateStarPickerUI(selectedRating);
    });
  }

  function updateStarPickerUI(rating) {
    starBtns.forEach(b => {
      const r = Number(b.dataset.rating);
      b.classList.toggle('active', r <= rating);
    });
  }

  // Tự điền tên người dùng nếu đã đăng nhập
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      const authorInput = reviewsContainer.querySelector('#reviewAuthorInput');
      const phoneInput = reviewsContainer.querySelector('#reviewPhoneInput');
      if (authorInput && u.name) authorInput.value = u.name;
      if (phoneInput && u.phone) phoneInput.value = u.phone;
    } catch (e) {}
  }

  // Gắn sự kiện submit review
  const submitBtn = reviewsContainer.querySelector('#btnSubmitReview');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const commentInput = reviewsContainer.querySelector('#reviewCommentInput');
      const authorInput = reviewsContainer.querySelector('#reviewAuthorInput');
      const comment = commentInput ? commentInput.value.trim() : '';
      const userName = authorInput ? authorInput.value.trim() : '';

      if (!comment || comment.length < 3) {
        showToast('Vui lòng nhập nội dung đánh giá ít nhất 3 ký tự!', 'error');
        if (commentInput) commentInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi đánh giá...';

      try {
        await submitProductReview({
          productId: product.id,
          rating: selectedRating,
          comment: comment,
          userName: userName
        });

        showToast('Cảm ơn bạn đã gửi đánh giá cho mẫu hoa!', 'success');
        await renderReviewsSection(product);

        // Cập nhật số sao meta ở đầu trang chi tiết
        const topRatingNum = document.querySelector('.detail-rating span[style*="font-weight: 600"]');
        const topRatingCount = document.querySelector('.detail-rating span[style*="color: var(--text-muted)"]');
        if (topRatingNum) topRatingNum.textContent = `${avgRating}.0`;
        if (topRatingCount) topRatingCount.textContent = `(${validReviews.length + 1} đánh giá)`;
      } catch (err) {
        showToast(err.message || 'Lỗi khi gửi đánh giá', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi Đánh Giá Ngay';
      }
    });
  }
}

// Khởi chạy khi nạp trang
initDetail();
