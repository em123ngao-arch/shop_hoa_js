import { fetchProductById, fetchProducts, addToCart, fetchPromotions, fetchProductReviews, submitProductReview, toggleReviewHelpful, postReviewThreadComment, deleteReviewThreadComment, replyProductReview, toggleHideProductReview, fetchWishlistStorage, toggleWishlistStorage } from './storage.js';
import { reviewApi } from './api.js';
import { formatPrice, renderStars, showToast, updateCartBadge, renderHeaderAuth, escapeHTML, unescapeHTML, compressAspectImageToBase64, updateWishlistBadge } from './utils.js';
import { matchesCategoryId, formatVoucherDisplay } from './business-rules.js';
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
let reviewVisibilityObserver = null;

function safeMediaUrl(value) {
  const candidate = String(value || '').trim();
  if (/^(?:\/|\.\/)(?!\/)/.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate, window.location.origin);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return candidate;
  } catch {}
  return './images/300.webp';
}

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
  const safeImage = escapeHTML(safeMediaUrl(product.image));
  const safeName = escapeHTML(product.name || 'Mẫu hoa');

  const stockCount = typeof product.stock === 'number' ? product.stock : 20;
  const isOutOfStock = stockCount <= 0;

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
      const scopeLabel = applicablePromo.scope === 'product' ? 'Ưu đãi riêng cho mẫu này' : 'Ưu đãi danh mục';
      voucherHintHtml = `
        <div class="product-voucher-tag" style="margin-top: 8px; font-size: 12px; padding: 6px 12px;" title="${escapeHTML(voucherMeta.conditionText)}">
          <span>🎫 ${scopeLabel}: Nhập mã <strong>${escapeHTML(applicablePromo.code)}</strong> để giảm thêm ${escapeHTML(voucherMeta.shortTag)} khi thanh toán</span>
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
          ${product.badge ? `<span class="detail-badge-corner">${escapeHTML(product.badge)}</span>` : ''}
          <img src="${safeImage}" alt="${safeName}" id="mainDetailImage">
        </div>

        <!-- Dải ảnh thu nhỏ (Detail Thumbnails: chỉ hiển thị khi có từ 2 ảnh khác nhau trở lên) -->
        ${(() => {
          const galleryImages = Array.isArray(product.images) && product.images.length > 0
            ? [...new Set(product.images.filter(Boolean).map(img => escapeHTML(img)))]
            : [safeImage];
          if (galleryImages.length < 2) return '';
          return `
            <div class="detail-thumbnails" id="detailThumbnails">
              ${galleryImages.map((imgSrc, idx) => `
                <button type="button" class="thumb-item ${idx === 0 ? 'active' : ''}" data-src="${imgSrc}" aria-label="Ảnh sản phẩm ${idx + 1}">
                  <img src="${imgSrc}" alt="${safeName} - Ảnh ${idx + 1}">
                </button>
              `).join('')}
            </div>
          `;
        })()}
      </div>

      <!-- CỘT PHẢI: THÔNG TIN VÀ ĐẶT HÀNG -->
      <div class="detail-info">
        <span class="detail-category-tag">${escapeHTML(product.categoryName || 'Hoa Kẽm Nhung Handmade')}</span>
        
        <h1 class="detail-title">${safeName}</h1>

        <div class="detail-meta">
          <div class="detail-rating">
            <span id="detailRatingSummary" class="detail-rating-loading" aria-live="polite">Đang tải đánh giá…</span>
          </div>

          <span style="color: var(--border-light);">|</span>

          <div class="detail-stock-status">
            <span class="status-dot" style="${isOutOfStock ? 'background: #EF4444;' : ''}"></span>
            <span>${isOutOfStock ? '<strong style="color: #EF4444;">Tạm hết hàng</strong>' : `Còn hàng (${stockCount} sản phẩm sẵn có)`}</span>
          </div>
        </div>

        <div class="detail-price-box">
          <span class="detail-price" id="detailPriceDisplay">${formatPrice(product.price)}</span>
          ${(product.originalPrice && Number(product.originalPrice) > Number(product.price)) ? `<span class="detail-was-price">${formatPrice(product.originalPrice)}</span>` : ''}
          ${discountBadge}
        </div>

        ${voucherHintHtml}

        <div class="detail-desc">
          <p>${escapeHTML(product.description || 'Sản phẩm hoa handmade tinh xảo, chất lượng cao uốn từ sợi kẽm nhung bền đẹp.')}</p>
        </div>

        <!-- KHỐI TÙY CHỌN PHỤ KIỆN (ADD-ONS) -->
        <div class="addon-options">
          <span class="quantity-label">Tùy chọn thêm phụ kiện:</span>
          <div class="addon-list" id="addonList">
            <label class="addon-chip">
              <input type="checkbox" name="addon" value="15000" data-id="ADDON-LED" data-name="Đèn LED đom đóm">
              <span>+ Đèn LED đom đóm (15.000 ₫)</span>
            </label>
            <label class="addon-chip">
              <input type="checkbox" name="addon" value="10000" data-id="ADDON-CARD" data-name="Thiệp viết tay cao cấp">
              <span>+ Thiệp viết tay (10.000 ₫)</span>
            </label>
            <label class="addon-chip">
              <input type="checkbox" name="addon" value="20000" data-id="ADDON-BAG" data-name="Túi kính trong suốt">
              <span>+ Túi kính trong suốt (20.000 ₫)</span>
            </label>
          </div>
        </div>

        <!-- BỘ CHỌN SỐ LƯỢNG (Bỏ readonly, cho phép nhập bàn phím trực tiếp) -->
        <div class="quantity-control">
          <label class="quantity-label" for="qtyInput">Số lượng:</label>
          <div class="quantity-box">
            <button type="button" class="qty-btn" id="btnMinus" aria-label="Giảm số lượng" ${isOutOfStock ? 'disabled' : ''}>−</button>
            <input type="number" class="qty-input" id="qtyInput" value="${isOutOfStock ? 0 : 1}" min="${isOutOfStock ? 0 : 1}" max="${isOutOfStock ? 0 : stockCount}" ${isOutOfStock ? 'disabled' : ''} inputmode="numeric">
            <button type="button" class="qty-btn" id="btnPlus" aria-label="Tăng số lượng" ${isOutOfStock ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <!-- NÚT HÀNH ĐỘNG -->
        <div class="action-buttons" id="mainActionButtons">
          <button type="button" class="btn-add-cart" id="btnAddToCart" ${isOutOfStock ? 'disabled style="opacity: 0.55; cursor: not-allowed;"' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            ${isOutOfStock ? 'Tạm Hết Hàng' : 'Thêm Vào Giỏ Hàng'}
          </button>

          <button type="button" class="btn-buy-now" id="btnBuyNow" ${isOutOfStock ? 'disabled style="opacity: 0.55; cursor: not-allowed;"' : ''}>
            ${isOutOfStock ? 'Hết Hàng' : 'Mua Ngay'}
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
  const maxStock = typeof product.stock === 'number' ? product.stock : 99;
  if (maxStock <= 0) {
    currentQuantity = 0;
    if (qtyInput) qtyInput.value = 0;
  }

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
      id: chk.dataset.id || chk.value,
      addonId: chk.dataset.id || chk.value,
      name: chk.dataset.name,
      price: parseInt(chk.value, 10) || 0
    }));

    const addonPriceTotal = addonsList.reduce((sum, a) => sum + a.price, 0);
    const addonsText = addonsList.map(a => a.name).join(', ');
    const addonIds = addonsList.map(a => a.addonId);

    return {
      ...product,
      id: addonsList.length ? `${product.id}__${addonIds.sort().join('_')}` : product.id,
      productId: String(product.productId || product.id).replace(/__.*$/, ''),
      name: product.name,
      price: product.price + addonPriceTotal,
      originalPrice: (product.originalPrice || product.price) + addonPriceTotal,
      addonsText: addonsText || null,
      selectedAddons: addonsList,
      addonIds: addonIds
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

      // Đồng bộ số lượng đang nhập trên UI ngay lúc bấm Mua Ngay (không cộng dồn vào giỏ hàng cũ)
      const qtyInput = document.querySelector('#qtyInput');
      const maxStock = typeof product.stock === 'number' ? product.stock : 99;
      if (qtyInput) {
        let parsedQty = parseInt(qtyInput.value, 10);
        if (isNaN(parsedQty) || parsedQty < 1) parsedQty = 1;
        if (parsedQty > maxStock) parsedQty = maxStock;
        currentQuantity = parsedQty;
        qtyInput.value = currentQuantity;
      }

      const itemToBuy = {
        ...buildProductWithAddons(),
        quantity: Math.max(1, Number(currentQuantity) || 1)
      };

      if (typeof openCheckoutModal === 'function') {
        openCheckoutModal({ mode: 'buy-now', directItems: [itemToBuy] });
      }
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
    .filter(p => String(p.id) !== String(product.id) && (matchesCategoryId(p, product.categoryId) || p.categorySlug === product.categorySlug))
    .slice(0, 4);

  if (related.length === 0) {
    const section = document.querySelector('.related-section');
    if (section) section.style.display = 'none';
    return;
  }

  relatedGrid.innerHTML = related.map(item => {
    const itemId = encodeURIComponent(String(item.id || ''));
    const itemName = escapeHTML(item.name || 'Mẫu hoa');
    const itemImage = escapeHTML(safeMediaUrl(item.image));
    return `
    <div class="product-card">
      <div class="product-image">
        <a href="./detail.html?id=${itemId}">
          <img src="${itemImage}" alt="${itemName}">
        </a>
        ${item.badge ? `<span class="product-badge">${escapeHTML(item.badge)}</span>` : ''}
        <button class="quick-add-btn" data-id="${escapeHTML(item.id)}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          Thêm nhanh
        </button>
      </div>

      <div class="product-info">
        <span class="product-category">${escapeHTML(item.categoryName || 'Hoa Handmade')}</span>
        <h3 class="product-title">
          <a href="./detail.html?id=${itemId}">${itemName}</a>
        </h3>
        
        ${Number(item.reviewCount) > 0 && Number.isFinite(Number(item.rating)) ? `
          <div class="product-rating">
            ${renderStars(item.rating)}
            <span class="rating-count">(${Number(item.reviewCount)})</span>
          </div>
        ` : '<div class="product-rating product-rating-empty">Chưa có đánh giá</div>'}

        <div class="product-price-row">
          <span class="price">${formatPrice(item.price)}</span>
          ${(item.originalPrice && Number(item.originalPrice) > Number(item.price)) ? `<span class="was-price">${formatPrice(item.originalPrice)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');

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
 * 6. KHU VỰC ĐÁNH GIÁ & BÌNH LUẬN TƯƠNG TÁC (CHUẨN TMĐT THỰC TẾ)
 */
const RATING_TEXT_LABELS = {
  1: 'Rất tệ',
  2: 'Chưa hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Tuyệt vời'
};

function openReviewImageLightbox(imageSrc, altText = 'Ảnh đánh giá từ khách hàng') {
  let backdrop = document.getElementById('reviewLightboxModal');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'reviewLightboxModal';
    backdrop.className = 'review-lightbox-backdrop hidden';
    backdrop.innerHTML = `
      <div class="review-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Xem ảnh đánh giá">
        <button type="button" class="review-lightbox-close" id="btnCloseReviewLightbox" aria-label="Đóng ảnh">&times;</button>
        <img id="reviewLightboxImg" src="" alt="">
      </div>
    `;
    document.body.appendChild(backdrop);

    const closeBox = () => backdrop.classList.add('hidden');
    backdrop.querySelector('#btnCloseReviewLightbox')?.addEventListener('click', closeBox);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeBox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) {
        closeBox();
      }
    });
  }

  const imgEl = backdrop.querySelector('#reviewLightboxImg');
  if (imgEl) {
    imgEl.src = imageSrc;
    imgEl.alt = altText;
  }
  backdrop.classList.remove('hidden');
}

async function renderReviewsSection(product) {
  const reviewsContainer = document.querySelector('#productReviewsSection');
  if (!reviewsContainer) return;

  reviewVisibilityObserver?.disconnect();

  const reviews = await fetchProductReviews(product.id);
  let validReviews = reviews.filter(r => !r.hidden && Number(r.rating) >= 1 && Number(r.rating) <= 5);

  let eligibility = { canReview: false, isVerifiedBuyer: false, hasPendingOrder: false, hasReviewed: false, existingReview: null, reason: '', currentUserId: null, currentUserRole: null };
  let isAuthenticated = false;
  let currentUserId = null;
  let currentUserRole = 'customer';
  let currentUserName = 'của bạn';
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      const cachedUser = JSON.parse(savedUser);
      currentUserId = cachedUser.id || null;
      currentUserRole = cachedUser.role || 'customer';
      currentUserName = cachedUser.name || currentUserName;
      const res = await reviewApi.checkEligibility(product.id);
      if (res?.data) {
        eligibility = res.data;
        currentUserId = res.data.currentUserId || currentUserId;
        currentUserRole = res.data.currentUserRole || currentUserRole;
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
      currentUserId = null;
      currentUserRole = 'customer';
    }
  }
  const isAdminOrStaff = isAuthenticated && (currentUserRole === 'admin' || currentUserRole === 'staff');

  const avgRating = validReviews.length > 0
    ? Number((validReviews.reduce((sum, r) => sum + Number(r.rating), 0) / validReviews.length).toFixed(1))
    : null;
  const distribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: validReviews.filter(review => Number(review.rating) === rating).length
  }));
  const withPhotosCount = validReviews.filter(r => Array.isArray(r.images) && r.images.length > 0).length;
  const loginReturnUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}#productReviewsSection`);
  let selectedRating = eligibility.hasReviewed ? Number(eligibility.existingReview?.rating) || null : null;
  let selectedReviewFilter = 0; // 0 = tat ca, 1..5 = theo sao, 'photos' = co hinh anh
  let selectedReviewSort = 'newest';
  let visibleReviewCount = 6;
  let composerImages = Array.isArray(eligibility.existingReview?.images) ? [...eligibility.existingReview.images] : [];
  let activeThreadReplyReviewId = null;
  let activeThreadDraft = '';
  let activeOfficialReplyReviewId = null;
  const expandedThreadIds = new Set();

  const renderEligibilityNotice = () => {
    if (!isAuthenticated) return '';
    if (isAdminOrStaff) {
      return `
        <div class="review-eligibility-notice review-admin-mode-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>Bạn đang ở <strong>Chế độ ${currentUserRole === 'admin' ? 'Quản Trị Viên' : 'Nhân Viên'}</strong> — có thể trả lời chính thức từ Tiệm hoặc trao đổi trực tiếp bên dưới mỗi đánh giá.</span>
          <a href="./admin.html?tab=reviews" class="review-eligibility-link">Mở trang Quản trị</a>
        </div>
      `;
    }
    if (eligibility.canReview) return '';
    return `
      <div class="review-eligibility-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>${escapeHTML(eligibility.reason || 'Chỉ khách hàng đã mua và hoàn tất nhận mẫu hoa này mới có thể viết đánh giá.')} Bạn vẫn có thể bấm <strong>Phản hồi</strong> để trao đổi bên dưới các đánh giá hiện có.</span>
        <a href="./orders.html" class="review-eligibility-link">Xem đơn hàng</a>
      </div>
    `;
  };

  reviewsContainer.innerHTML = `
    <div class="reviews-header-row">
      <div>
        <h3 class="reviews-section-title">Đánh giá từ khách hàng</h3>
        <p class="reviews-section-subtitle">Chia sẻ từ khách đã mua thực tế về độ hoàn thiện, màu hoa và giao nhận.</p>
      </div>
      <div class="reviews-header-actions">
        <div class="reviews-score-box" aria-label="Tóm tắt đánh giá">
          ${avgRating === null ? `
            <div class="reviews-empty-score">Chưa có đánh giá</div>
          ` : `
            <div class="reviews-big-score">${avgRating.toFixed(1)}<span class="reviews-score-max">/5</span></div>
            <div class="reviews-score-meta">
              <div class="reviews-star-line">${renderStars(avgRating)}</div>
              <span class="reviews-total-text">${validReviews.length} đánh giá</span>
            </div>
          `}
        </div>
        ${!isAuthenticated ? `
          <a class="btn-review-write" href="./login.html?returnUrl=${loginReturnUrl}">Đăng nhập để đánh giá</a>
        ` : (isAdminOrStaff ? `
          <span class="review-admin-mode-pill">Quản trị phản hồi trực tiếp</span>
        ` : (eligibility.canReview ? `
          <button type="button" class="btn-review-write" id="btnOpenReviewForm">
            ${eligibility.hasReviewed ? 'Sửa đánh giá của bạn' : 'Viết đánh giá'}
          </button>
        ` : `
          <span class="review-verified-only-pill">Dành cho khách đã nhận hoa</span>
        `))}
      </div>
    </div>

    ${renderEligibilityNotice()}

    ${validReviews.length > 0 ? `
      <div class="review-summary-distribution" aria-label="Phân bố số sao đánh giá">
        ${distribution.map(({ rating, count }) => `
          <button type="button" class="review-distribution-row" data-review-filter="${rating}" aria-pressed="false" aria-label="Lọc đánh giá ${rating} sao, ${count} lượt">
            <span class="review-distribution-label">${rating} sao</span>
            <span class="review-distribution-track"><span style="width: ${validReviews.length ? (count / validReviews.length) * 100 : 0}%"></span></span>
            <span class="review-distribution-count">${count}</span>
          </button>
        `).join('')}
      </div>

      <div class="review-quick-filters" id="reviewQuickFilters" aria-label="Lọc nhanh đánh giá">
        <button type="button" class="review-filter-chip active" data-chip-filter="0">Tất cả (${validReviews.length})</button>
        <button type="button" class="review-filter-chip" data-chip-filter="photos">Có hình ảnh (${withPhotosCount})</button>
        ${distribution.map(({ rating, count }) => `
          <button type="button" class="review-filter-chip" data-chip-filter="${rating}">${rating} sao (${count})</button>
        `).join('')}
      </div>
    ` : ''}

    ${(isAuthenticated && eligibility.canReview) ? `
      <div class="review-form-card hidden" id="reviewComposer">
        <div class="review-composer-heading">
          <div>
            <h4>${eligibility.hasReviewed ? 'Cập nhật đánh giá của bạn' : 'Chia sẻ trải nghiệm của bạn'}</h4>
            <p>Nhận xét thực tế về độ giống ảnh, đường uốn cánh hoa, đóng gói và thời gian giao hàng.</p>
          </div>
          <button type="button" class="review-composer-close" id="btnCloseReviewForm" aria-label="Đóng form đánh giá">Đóng</button>
        </div>
        <div class="review-account-note">Đánh giá bằng tài khoản <strong>${escapeHTML(currentUserName)}</strong> &bull; <span class="verified-buyer-badge">✓ Đã mua hàng</span></div>
        ${eligibility.hasReviewed ? `
          <div class="buyer-eligibility-banner unverified">
            <span class="badge-icon">i</span>
            <span>Nếu thay đổi số sao hoặc nội dung nhận xét, phản hồi trước đó của tiệm sẽ được đặt lại để hỗ trợ lại chính xác hơn.</span>
          </div>
        ` : ''}
        <fieldset class="review-rating-fieldset">
          <legend>Điểm đánh giá <span aria-hidden="true">*</span></legend>
          <div class="star-picker-row">
            <div class="star-picker-wrap" id="starPickerWrap" role="radiogroup" aria-label="Chọn số sao" tabindex="-1">
              ${[1, 2, 3, 4, 5].map(rating => `
                <button type="button" class="star-picker-btn ${selectedRating >= rating ? 'active' : ''}" data-rating="${rating}" role="radio" aria-checked="${selectedRating === rating}" aria-label="${rating} sao">★</button>
              `).join('')}
            </div>
            <span class="star-picker-label" id="starPickerLabel">${selectedRating ? `${selectedRating} sao - ${RATING_TEXT_LABELS[selectedRating]}` : 'Chọn mức hài lòng'}</span>
          </div>
        </fieldset>
        <div class="review-field-header">
          <label class="review-field-label" for="reviewCommentInput">Nhận xét <span aria-hidden="true">*</span></label>
          <span class="review-char-counter" id="reviewCharCounter">0 / 1200</span>
        </div>
        <textarea id="reviewCommentInput" class="review-textarea" minlength="10" maxlength="1200" required placeholder="Ví dụ: Hoa giống ảnh, cánh kẽm nhung đều đẹp, thiệp viết tay chỉn chu và giao đúng hẹn…"></textarea>

        <div class="review-photo-uploader">
          <div class="review-photo-upload-bar">
            <input type="file" id="reviewPhotoInput" accept="image/png,image/jpeg,image/webp" multiple hidden>
            <button type="button" class="btn-add-review-photo" id="btnAddReviewPhoto">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>Thêm ảnh thực tế (tối đa 3)</span>
            </button>
            <span class="review-photo-hint">PNG, JPG, WebP</span>
          </div>
          <div class="review-photo-preview-grid" id="reviewPhotoPreviewGrid"></div>
        </div>

        <div class="review-form-footer">
          <p id="reviewFormFeedback" class="review-form-feedback" role="status" aria-live="polite">Tối thiểu 10 ký tự. Không chia sẻ số điện thoại hoặc thông tin riêng tư trong nhận xét.</p>
          <button type="button" class="btn-submit-review" id="btnSubmitReview">${eligibility.hasReviewed ? 'Lưu thay đổi' : 'Gửi đánh giá'}</button>
        </div>
      </div>
    ` : ''}

    <div class="reviews-list-toolbar">
      <h4 id="reviewsFilteredHeading">${validReviews.length} đánh giá</h4>
      ${validReviews.length > 1 ? `
        <label for="reviewSortSelect">Sắp xếp
          <select id="reviewSortSelect" class="review-sort-select">
            <option value="newest">Mới nhất</option>
            <option value="helpful">Hữu ích nhất</option>
            <option value="highest">Điểm cao trước</option>
            <option value="lowest">Điểm thấp trước</option>
          </select>
        </label>
      ` : ''}
    </div>

    <div class="reviews-list-wrap" id="reviewsList"></div>
    <button type="button" class="review-show-more hidden" id="btnShowMoreReviews">Xem thêm đánh giá</button>
  `;

  if ('IntersectionObserver' in window) {
    reviewVisibilityObserver = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle('review-section-in-view', entry.isIntersecting);
    }, { threshold: 0.08 });
    reviewVisibilityObserver.observe(reviewsContainer);
  }

  updateDetailRatingSummary(avgRating, validReviews.length);

  const composer = reviewsContainer.querySelector('#reviewComposer');
  const openReviewForm = reviewsContainer.querySelector('#btnOpenReviewForm');
  const closeReviewForm = reviewsContainer.querySelector('#btnCloseReviewForm');
  const commentInput = reviewsContainer.querySelector('#reviewCommentInput');
  const charCounter = reviewsContainer.querySelector('#reviewCharCounter');
  const feedback = reviewsContainer.querySelector('#reviewFormFeedback');
  const starPickerLabel = reviewsContainer.querySelector('#starPickerLabel');
  const photoInput = reviewsContainer.querySelector('#reviewPhotoInput');
  const addPhotoBtn = reviewsContainer.querySelector('#btnAddReviewPhoto');
  const photoPreviewGrid = reviewsContainer.querySelector('#reviewPhotoPreviewGrid');

  const updateCharCounter = () => {
    if (!commentInput || !charCounter) return;
    const len = Array.from(commentInput.value).length;
    charCounter.textContent = `${len} / 1200`;
    charCounter.classList.toggle('ready', len >= 10);
  };

  if (commentInput) {
    commentInput.value = unescapeHTML(eligibility.existingReview?.comment || '');
    updateCharCounter();
    commentInput.addEventListener('input', updateCharCounter);
  }

  const renderComposerPhotos = () => {
    if (!photoPreviewGrid) return;
    photoPreviewGrid.innerHTML = composerImages.map((src, idx) => `
      <div class="review-photo-preview-item">
        <img src="${escapeHTML(safeMediaUrl(src))}" alt="Ảnh xem trước ${idx + 1}">
        <button type="button" class="review-photo-remove-btn" data-photo-idx="${idx}" aria-label="Xóa ảnh ${idx + 1}">&times;</button>
      </div>
    `).join('');
    if (addPhotoBtn) {
      addPhotoBtn.disabled = composerImages.length >= 3;
    }
  };
  renderComposerPhotos();

  if (addPhotoBtn && photoInput) {
    addPhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      photoInput.value = '';
      if (!files.length) return;
      const availableSlots = 3 - composerImages.length;
      if (files.length > availableSlots) {
        showToast(`Chỉ chọn thêm được tối đa ${availableSlots} ảnh nữa (tổng tối đa 3 ảnh).`, 'warning');
      }
      const chosen = files.slice(0, availableSlots);
      for (const file of chosen) {
        if (file.size > 6 * 1024 * 1024) {
          showToast(`Ảnh "${file.name}" vượt quá 6MB, vui lòng chọn ảnh nhẹ hơn.`, 'error');
          continue;
        }
        try {
          const base64 = await compressAspectImageToBase64(file, 960, 0.82);
          composerImages.push(base64);
        } catch (err) {
          showToast(err.message || 'Không đọc được file ảnh đã chọn.', 'error');
        }
      }
      renderComposerPhotos();
    });
  }

  if (photoPreviewGrid) {
    photoPreviewGrid.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.review-photo-remove-btn');
      if (!removeBtn) return;
      const idx = Number(removeBtn.dataset.photoIdx);
      if (Number.isInteger(idx) && idx >= 0) {
        composerImages.splice(idx, 1);
        renderComposerPhotos();
      }
    });
  }

  if (openReviewForm && composer) openReviewForm.addEventListener('click', () => {
    composer.classList.remove('hidden');
    commentInput?.focus();
  });
  if (closeReviewForm && composer) closeReviewForm.addEventListener('click', () => composer.classList.add('hidden'));

  const starBtns = reviewsContainer.querySelectorAll('.star-picker-btn');
  const updateStarPickerUI = (hoverRating = 0) => {
    const activeThreshold = hoverRating || selectedRating || 0;
    starBtns.forEach(btn => {
      const rating = Number(btn.dataset.rating);
      btn.classList.toggle('active', Boolean(selectedRating && rating <= selectedRating));
      btn.classList.toggle('hover', Boolean(hoverRating && rating <= hoverRating));
      btn.setAttribute('aria-checked', String(rating === selectedRating));
    });
    if (starPickerLabel) {
      starPickerLabel.textContent = activeThreshold
        ? `${activeThreshold} sao - ${RATING_TEXT_LABELS[activeThreshold]}`
        : 'Chọn mức hài lòng';
    }
  };
  starBtns.forEach(btn => {
    const rating = Number(btn.dataset.rating);
    btn.addEventListener('mouseenter', () => updateStarPickerUI(rating));
    btn.addEventListener('mouseleave', () => updateStarPickerUI(0));
    btn.addEventListener('click', () => {
      selectedRating = rating;
      updateStarPickerUI(0);
    });
  });

  const syncFilterButtons = () => {
    reviewsContainer.querySelectorAll('.review-distribution-row').forEach(filterBtn => {
      const val = Number(filterBtn.dataset.reviewFilter);
      filterBtn.setAttribute('aria-pressed', String(val === selectedReviewFilter));
    });
    reviewsContainer.querySelectorAll('.review-filter-chip').forEach(chip => {
      const raw = chip.dataset.chipFilter;
      const chipVal = raw === 'photos' ? 'photos' : Number(raw);
      chip.classList.toggle('active', chipVal === selectedReviewFilter);
    });
  };

  reviewsContainer.querySelectorAll('.review-distribution-row').forEach(btn => btn.addEventListener('click', () => {
    const rating = Number(btn.dataset.reviewFilter);
    selectedReviewFilter = selectedReviewFilter === rating ? 0 : rating;
    visibleReviewCount = 6;
    syncFilterButtons();
    renderReviewCards();
  }));

  reviewsContainer.querySelectorAll('.review-filter-chip').forEach(chip => chip.addEventListener('click', () => {
    const raw = chip.dataset.chipFilter;
    const chipVal = raw === 'photos' ? 'photos' : Number(raw);
    selectedReviewFilter = chipVal === 0 ? 0 : (selectedReviewFilter === chipVal ? 0 : chipVal);
    visibleReviewCount = 6;
    syncFilterButtons();
    renderReviewCards();
  }));

  const sortSelect = reviewsContainer.querySelector('#reviewSortSelect');
  if (sortSelect) sortSelect.addEventListener('change', () => {
    selectedReviewSort = sortSelect.value;
    renderReviewCards();
  });
  const showMoreButton = reviewsContainer.querySelector('#btnShowMoreReviews');
  if (showMoreButton) showMoreButton.addEventListener('click', () => {
    visibleReviewCount += 6;
    renderReviewCards();
  });

  function renderReviewCards() {
    const list = reviewsContainer.querySelector('#reviewsList');
    const heading = reviewsContainer.querySelector('#reviewsFilteredHeading');
    if (!list) return;
    let filtered = [...validReviews];
    if (selectedReviewFilter === 'photos') {
      filtered = filtered.filter(review => Array.isArray(review.images) && review.images.length > 0);
    } else if (typeof selectedReviewFilter === 'number' && selectedReviewFilter > 0) {
      filtered = filtered.filter(review => Number(review.rating) === selectedReviewFilter);
    }

    if (selectedReviewSort === 'helpful') {
      filtered.sort((a, b) => Number(b.helpfulCount || 0) - Number(a.helpfulCount || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    } else if (selectedReviewSort === 'highest') {
      filtered.sort((a, b) => Number(b.rating) - Number(a.rating) || new Date(b.createdAt) - new Date(a.createdAt));
    } else if (selectedReviewSort === 'lowest') {
      filtered.sort((a, b) => Number(a.rating) - Number(b.rating) || new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (heading) {
      heading.textContent = selectedReviewFilter === 'photos'
        ? `${filtered.length} đánh giá có hình ảnh`
        : (selectedReviewFilter ? `${filtered.length} đánh giá ${selectedReviewFilter} sao` : `${filtered.length} đánh giá`);
    }

    const visible = filtered.slice(0, visibleReviewCount);
    list.innerHTML = visible.length ? visible.map(review => {
      const initial = escapeHTML(review.userName || 'K').charAt(0).toUpperCase();
      const hasAvatar = Boolean(review.userAvatar);
      const avatarHtml = hasAvatar
        ? `<img src="${escapeHTML(safeMediaUrl(review.userAvatar))}" class="review-author-avatar" alt="Ảnh đại diện ${escapeHTML(review.userName || 'khách hàng')}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="review-author-avatar review-author-fallback" aria-hidden="true" style="display: none;">${initial}</div>`
        : `<div class="review-author-avatar" aria-hidden="true">${initial}</div>`;

      const photosHtml = (Array.isArray(review.images) && review.images.length > 0)
        ? `<div class="review-photo-gallery">${review.images.map((imgUrl, idx) => `
            <button type="button" class="review-photo-thumb-btn" data-lightbox-src="${escapeHTML(safeMediaUrl(imgUrl))}" aria-label="Phóng to ảnh đánh giá ${idx + 1}">
              <img src="${escapeHTML(safeMediaUrl(imgUrl))}" alt="Ảnh thực tế từ ${escapeHTML(review.userName || 'khách hàng')} (${idx + 1})" loading="lazy">
            </button>
          `).join('')}</div>`
        : '';

      const isOwnReview = Boolean(currentUserId && String(review.userId) === String(currentUserId));
      const helpfulCount = Number(review.helpfulCount || 0);
      const editedTag = review.editedAt ? ` <span class="review-edited-tag">(Đã chỉnh sửa)</span>` : '';
      const comments = Array.isArray(review.comments) ? review.comments : [];
      const isExpanded = expandedThreadIds.has(review.id);
      const visibleComments = isExpanded ? comments : comments.slice(0, 2);
      const hiddenCommentsCount = Math.max(0, comments.length - visibleComments.length);

      const threadCommentsHtml = comments.length > 0 ? `
        <div class="review-thread-list" aria-label="Trao đổi dưới đánh giá">
          ${visibleComments.map(c => {
            const cInitial = escapeHTML(c.userName || 'K').charAt(0).toUpperCase();
            const cAvatar = c.userAvatar
              ? `<img src="${escapeHTML(safeMediaUrl(c.userAvatar))}" class="thread-author-avatar" alt="${escapeHTML(c.userName || 'Người dùng')}" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="thread-author-avatar" aria-hidden="true" style="display: none;">${cInitial}</div>`
              : `<div class="thread-author-avatar" aria-hidden="true">${cInitial}</div>`;

            let roleBadgeHtml = '';
            if (c.userRole === 'admin') {
              roleBadgeHtml = '<span class="thread-badge thread-badge-admin">Quản Trị Viên</span>';
            } else if (c.userRole === 'staff') {
              roleBadgeHtml = '<span class="thread-badge thread-badge-staff">Nhân Viên</span>';
            } else if (c.isAuthor) {
              roleBadgeHtml = '<span class="thread-badge thread-badge-author">Tác giả đánh giá</span>';
            } else if (c.isVerifiedBuyer) {
              roleBadgeHtml = '<span class="thread-badge thread-badge-verified">✓ Đã mua</span>';
            }

            const canDeleteComment = Boolean(isAdminOrStaff || (currentUserId && String(c.userId) === String(currentUserId)));

            return `
              <div class="review-thread-item" data-comment-id="${escapeHTML(c.id)}">
                ${cAvatar}
                <div class="review-thread-content-wrap">
                  <div class="review-thread-head">
                    <span class="review-thread-author">${escapeHTML(c.userName || 'Khách Hàng')}</span>
                    ${roleBadgeHtml}
                    <span class="review-thread-time">${new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div class="review-thread-text">${escapeHTML(unescapeHTML(c.content))}</div>
                  <div class="review-thread-item-actions">
                    <button type="button" class="btn-thread-reply-mention" data-review-id="${escapeHTML(review.id)}" data-mention="${escapeHTML(c.userName || '')}">Phản hồi</button>
                    ${canDeleteComment ? `<button type="button" class="btn-thread-delete-comment" data-review-id="${escapeHTML(review.id)}" data-comment-id="${escapeHTML(c.id)}">Xóa</button>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
          ${hiddenCommentsCount > 0 ? `
            <button type="button" class="btn-thread-expand" data-review-id="${escapeHTML(review.id)}">Xem thêm ${hiddenCommentsCount} phản hồi</button>
          ` : (isExpanded && comments.length > 2 ? `
            <button type="button" class="btn-thread-collapse" data-review-id="${escapeHTML(review.id)}">Thu gọn phản hồi</button>
          ` : '')}
        </div>
      ` : '';

      const inlineOfficialReplyHtml = (isAdminOrStaff && activeOfficialReplyReviewId === review.id) ? `
        <div class="inline-review-composer inline-official-composer" id="officialReplyComposer-${escapeHTML(review.id)}">
          <div class="inline-composer-head">
            <strong>${review.reply ? 'Chỉnh sửa phản hồi chính thức từ Tiệm' : 'Trả lời chính thức từ Tiệm Hoa Kẽm Nhung'}</strong>
            <div class="inline-quick-templates">
              <button type="button" class="btn-inline-quick-tpl" data-review-id="${escapeHTML(review.id)}" data-template="Tiệm Hoa Kẽm Nhung xin chân thành cảm ơn quý khách đã tin tưởng và chia sẻ cảm nhận. Rất mong tiếp tục đồng hành cùng bạn trong những dịp ý nghĩa sắp tới!">Cảm ơn 4-5★</button>
              <button type="button" class="btn-inline-quick-tpl" data-review-id="${escapeHTML(review.id)}" data-template="Tiệm Hoa Kẽm Nhung thành thật xin lỗi bạn về trải nghiệm chưa trọn vẹn vừa qua. Tiệm đã ghi nhận góp ý để điều phối tốt hơn và xin phép nhắn riêng để hỗ trợ bù đắp cho bạn ạ.">Xin lỗi &amp; hỗ trợ</button>
            </div>
          </div>
          <textarea class="inline-reply-textarea" id="officialReplyInput-${escapeHTML(review.id)}" rows="3" maxlength="1000" placeholder="Nhập lời cảm ơn hoặc giải đáp chính thức từ Tiệm Hoa...">${escapeHTML(unescapeHTML(review.reply || ''))}</textarea>
          <div class="inline-composer-actions">
            <button type="button" class="btn-inline-cancel" data-cancel-official="${escapeHTML(review.id)}">Hủy</button>
            <button type="button" class="btn-inline-submit" data-save-official="${escapeHTML(review.id)}">Lưu phản hồi tiệm</button>
          </div>
        </div>
      ` : '';

      const inlineThreadReplyHtml = (isAuthenticated && activeThreadReplyReviewId === review.id) ? `
        <div class="inline-review-composer" id="threadComposer-${escapeHTML(review.id)}">
          <textarea class="inline-reply-textarea" id="threadReplyInput-${escapeHTML(review.id)}" rows="2" maxlength="500" placeholder="Viết phản hồi trao đổi dưới đánh giá này (2 - 500 ký tự)..."></textarea>
          <div class="inline-composer-actions">
            <span class="inline-reply-hint">Mọi phản hồi hiển thị công khai dưới đánh giá</span>
            <div class="inline-composer-btns">
              <button type="button" class="btn-inline-cancel" data-cancel-thread="${escapeHTML(review.id)}">Hủy</button>
              <button type="button" class="btn-inline-submit" data-save-thread="${escapeHTML(review.id)}">Gửi phản hồi</button>
            </div>
          </div>
        </div>
      ` : '';

      return `
        <article class="review-item-card" data-review-id="${escapeHTML(review.id)}">
          <div class="review-card-head">
            <div class="review-author-info">
              ${avatarHtml}
              <div>
                <div class="review-author-name">
                  ${escapeHTML(review.userName || 'Khách Mua Hoa')}
                  ${(review.isVerifiedBuyer || review.is_verified_buyer) ? `<span class="verified-buyer-badge" title="Đơn hàng đã hoàn tất">✓ Đã mua hàng</span>` : ''}
                </div>
                <div class="review-created-date">${new Date(review.createdAt).toLocaleDateString('vi-VN')}${editedTag}</div>
              </div>
            </div>
            <div class="review-stars-given" aria-label="${Number(review.rating)} trên 5 sao">${renderStars(review.rating)}</div>
          </div>
          <div class="review-comment-body">${escapeHTML(unescapeHTML(review.comment))}</div>
          ${photosHtml}
          <div class="review-card-actions">
            <button type="button" class="btn-review-helpful ${review.hasVotedHelpful ? 'active' : ''}" data-review-id="${escapeHTML(review.id)}" ${isOwnReview ? 'disabled title="Đánh giá của bạn"' : 'title="Đánh dấu đánh giá này hữu ích"'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
              </svg>
              <span>${review.hasVotedHelpful ? 'Đã hữu ích' : 'Hữu ích'}${helpfulCount > 0 ? ` (${helpfulCount})` : ''}</span>
            </button>
            <button type="button" class="btn-review-reply-thread ${activeThreadReplyReviewId === review.id ? 'active' : ''}" data-review-id="${escapeHTML(review.id)}" title="Phản hồi hoặc trao đổi dưới đánh giá này">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Phản hồi${comments.length > 0 ? ` (${comments.length})` : ''}</span>
            </button>
            ${isAdminOrStaff ? `
              <button type="button" class="btn-review-official-reply ${activeOfficialReplyReviewId === review.id ? 'active' : ''}" data-review-id="${escapeHTML(review.id)}" title="Trả lời chính thức bằng tên Tiệm Hoa">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span>${review.reply ? 'Sửa phản hồi tiệm' : 'Trả lời từ tiệm'}</span>
              </button>
              <button type="button" class="btn-review-hide-inline" data-review-id="${escapeHTML(review.id)}" title="Ẩn đánh giá này khỏi trang sản phẩm">
                Ẩn
              </button>
            ` : ''}
          </div>
          ${review.reply ? `
            <div class="shop-reply-card">
              <div class="shop-reply-header">
                <span class="shop-reply-badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  Phản hồi từ Tiệm Hoa Kẽm Nhung
                </span>
                <span class="shop-reply-meta">${escapeHTML(review.replyBy || 'Tiệm Hoa Kẽm Nhung')} · ${review.replyDate ? new Date(review.replyDate).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
              </div>
              <div class="shop-reply-content">${escapeHTML(unescapeHTML(review.reply))}</div>
            </div>
          ` : ''}
          ${inlineOfficialReplyHtml}
          ${threadCommentsHtml}
          ${inlineThreadReplyHtml}
        </article>
      `;
    }).join('') : `
      <div class="reviews-empty-state">
        ${validReviews.length === 0 ? 'Mẫu hoa này chưa có đánh giá. Hãy là người đầu tiên nhận hoa và chia sẻ trải nghiệm!' : 'Không có đánh giá phù hợp với bộ lọc đã chọn.'}
      </div>
    `;
    if (showMoreButton) {
      showMoreButton.classList.toggle('hidden', filtered.length <= visibleReviewCount);
      showMoreButton.textContent = selectedReviewFilter && selectedReviewFilter !== 'photos'
        ? `Xem thêm đánh giá ${selectedReviewFilter} sao`
        : 'Xem thêm đánh giá';
    }
    if (activeThreadReplyReviewId) {
      const box = reviewsContainer.querySelector(`#threadReplyInput-${CSS.escape(activeThreadReplyReviewId)}`);
      if (box) {
        if (activeThreadDraft) {
          box.value = activeThreadDraft;
          activeThreadDraft = '';
        }
        box.focus();
        box.setSelectionRange(box.value.length, box.value.length);
      }
    }
    if (activeOfficialReplyReviewId) {
      const officialBox = reviewsContainer.querySelector(`#officialReplyInput-${CSS.escape(activeOfficialReplyReviewId)}`);
      if (officialBox) officialBox.focus();
    }
  }
  renderReviewCards();

  const reviewsListEl = reviewsContainer.querySelector('#reviewsList');
  if (reviewsListEl) {
    reviewsListEl.addEventListener('click', async (e) => {
      const thumbBtn = e.target.closest('.review-photo-thumb-btn');
      if (thumbBtn) {
        openReviewImageLightbox(thumbBtn.dataset.lightboxSrc, 'Ảnh thực tế từ khách mua hoa');
        return;
      }

      const helpfulBtn = e.target.closest('.btn-review-helpful');
      if (helpfulBtn && !helpfulBtn.disabled) {
        if (!isAuthenticated) {
          showToast('Vui lòng đăng nhập để bình chọn đánh giá hữu ích.', 'info');
          return;
        }

        const reviewId = helpfulBtn.dataset.reviewId;
        helpfulBtn.disabled = true;
        try {
          const res = await toggleReviewHelpful(reviewId);
          validReviews = validReviews.map(r => String(r.id) === String(reviewId)
            ? { ...r, helpfulCount: res.helpfulCount, hasVotedHelpful: res.hasVotedHelpful }
            : r);
          renderReviewCards();
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Không thể bình chọn lúc này.';
          showToast(msg, 'error');
          helpfulBtn.disabled = false;
        }
        return;
      }

      const threadToggleBtn = e.target.closest('.btn-review-reply-thread');
      if (threadToggleBtn) {
        if (!isAuthenticated) {
          showToast('Vui lòng đăng nhập để gửi phản hồi.', 'info');
          return;
        }
        const reviewId = threadToggleBtn.dataset.reviewId;
        activeThreadReplyReviewId = activeThreadReplyReviewId === reviewId ? null : reviewId;
        activeThreadDraft = '';
        renderReviewCards();
        return;
      }

      const mentionBtn = e.target.closest('.btn-thread-reply-mention');
      if (mentionBtn) {
        if (!isAuthenticated) {
          showToast('Vui lòng đăng nhập để phản hồi bình luận.', 'info');
          return;
        }
        const reviewId = mentionBtn.dataset.reviewId;
        const mentionName = (mentionBtn.dataset.mention || '').trim();
        activeThreadReplyReviewId = reviewId;
        activeThreadDraft = mentionName ? `@${mentionName} ` : '';
        renderReviewCards();
        return;
      }

      const cancelThreadBtn = e.target.closest('[data-cancel-thread]');
      if (cancelThreadBtn) {
        activeThreadReplyReviewId = null;
        activeThreadDraft = '';
        renderReviewCards();
        return;
      }

      const saveThreadBtn = e.target.closest('[data-save-thread]');
      if (saveThreadBtn) {
        const reviewId = saveThreadBtn.dataset.saveThread;
        const inputEl = reviewsContainer.querySelector(`#threadReplyInput-${CSS.escape(reviewId)}`);
        const content = inputEl ? inputEl.value.trim() : '';
        if (Array.from(content).length < 2) {
          showToast('Phản hồi cần ít nhất 2 ký tự.', 'warning');
          inputEl?.focus();
          return;
        }
        saveThreadBtn.disabled = true;
        saveThreadBtn.textContent = 'Đang gửi...';
        try {
          const res = await postReviewThreadComment(reviewId, content);
          if (res?.comment) {
            validReviews = validReviews.map(r => String(r.id) === String(reviewId)
              ? { ...r, comments: [...(r.comments || []), res.comment] }
              : r);
            expandedThreadIds.add(reviewId);
          }
          activeThreadReplyReviewId = null;
          activeThreadDraft = '';
          showToast('Đã gửi phản hồi thành công!', 'success');
          renderReviewCards();
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Không thể gửi phản hồi.';
          showToast(msg, 'error');
          saveThreadBtn.disabled = false;
          saveThreadBtn.textContent = 'Gửi phản hồi';
        }
        return;
      }

      const deleteCommentBtn = e.target.closest('.btn-thread-delete-comment');
      if (deleteCommentBtn) {
        const { reviewId, commentId } = deleteCommentBtn.dataset;
        deleteCommentBtn.disabled = true;
        try {
          await deleteReviewThreadComment(reviewId, commentId);
          validReviews = validReviews.map(r => String(r.id) === String(reviewId)
            ? { ...r, comments: (r.comments || []).filter(c => String(c.id) !== String(commentId)) }
            : r);
          showToast('Đã xóa phản hồi.', 'info');
          renderReviewCards();
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Không thể xóa phản hồi.';
          showToast(msg, 'error');
          deleteCommentBtn.disabled = false;
        }
        return;
      }

      const expandBtn = e.target.closest('.btn-thread-expand');
      if (expandBtn) {
        expandedThreadIds.add(expandBtn.dataset.reviewId);
        renderReviewCards();
        return;
      }

      const collapseBtn = e.target.closest('.btn-thread-collapse');
      if (collapseBtn) {
        expandedThreadIds.delete(collapseBtn.dataset.reviewId);
        renderReviewCards();
        return;
      }

      const officialToggleBtn = e.target.closest('.btn-review-official-reply');
      if (officialToggleBtn && isAdminOrStaff) {
        const reviewId = officialToggleBtn.dataset.reviewId;
        activeOfficialReplyReviewId = activeOfficialReplyReviewId === reviewId ? null : reviewId;
        renderReviewCards();
        return;
      }

      const quickTplBtn = e.target.closest('.btn-inline-quick-tpl');
      if (quickTplBtn) {
        const reviewId = quickTplBtn.dataset.reviewId;
        const inputEl = reviewsContainer.querySelector(`#officialReplyInput-${CSS.escape(reviewId)}`);
        if (inputEl) {
          inputEl.value = quickTplBtn.dataset.template || '';
          inputEl.focus();
        }
        return;
      }

      const cancelOfficialBtn = e.target.closest('[data-cancel-official]');
      if (cancelOfficialBtn) {
        activeOfficialReplyReviewId = null;
        renderReviewCards();
        return;
      }

      const saveOfficialBtn = e.target.closest('[data-save-official]');
      if (saveOfficialBtn && isAdminOrStaff) {
        const reviewId = saveOfficialBtn.dataset.saveOfficial;
        const inputEl = reviewsContainer.querySelector(`#officialReplyInput-${CSS.escape(reviewId)}`);
        const replyText = inputEl ? inputEl.value.trim() : '';
        if (!replyText) {
          showToast('Vui lòng nhập nội dung phản hồi từ Tiệm Hoa.', 'warning');
          inputEl?.focus();
          return;
        }
        saveOfficialBtn.disabled = true;
        saveOfficialBtn.textContent = 'Đang lưu...';
        try {
          const res = await replyProductReview(reviewId, replyText);
          if (res?.review) {
            validReviews = validReviews.map(r => String(r.id) === String(reviewId)
              ? { ...r, reply: res.review.reply, replyDate: res.review.replyDate, replyBy: res.review.replyBy }
              : r);
          }
          activeOfficialReplyReviewId = null;
          showToast('Đã lưu phản hồi chính thức từ tiệm!', 'success');
          renderReviewCards();
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Không thể lưu phản hồi.';
          showToast(msg, 'error');
          saveOfficialBtn.disabled = false;
          saveOfficialBtn.textContent = 'Lưu phản hồi tiệm';
        }
        return;
      }

      const hideInlineBtn = e.target.closest('.btn-review-hide-inline');
      if (hideInlineBtn && isAdminOrStaff) {
        const reviewId = hideInlineBtn.dataset.reviewId;
        hideInlineBtn.disabled = true;
        try {
          const res = await toggleHideProductReview(reviewId);
          validReviews = validReviews.filter(r => String(r.id) !== String(reviewId));
          showToast('Đã ẩn đánh giá khỏi trang sản phẩm.', 'info');
          const nextCount = res?.product?.reviewCount ?? validReviews.length;
          const nextAvg = res?.product?.rating ?? (validReviews.length
            ? Number((validReviews.reduce((s, r) => s + Number(r.rating), 0) / validReviews.length).toFixed(1))
            : null);
          updateDetailRatingSummary(nextAvg, nextCount);
          await renderReviewsSection(product);
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Không thể ẩn đánh giá.';
          showToast(msg, 'error');
          hideInlineBtn.disabled = false;
        }
      }
    });
  }

  // Gắn sự kiện submit review
  const submitBtn = reviewsContainer.querySelector('#btnSubmitReview');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const comment = commentInput ? commentInput.value.trim() : '';

      if (!selectedRating) {
        if (feedback) feedback.textContent = 'Vui lòng chọn số sao trước khi gửi.';
        starBtns[0]?.focus();
        return;
      }
      if (Array.from(comment).length < 10) {
        if (feedback) feedback.textContent = 'Nhận xét cần có ít nhất 10 ký tự để giúp người mua sau tham khảo.';
        if (commentInput) commentInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi đánh giá...';

      try {
        await submitProductReview({
          productId: product.id,
          rating: selectedRating,
          comment,
          images: composerImages
        });

        showToast(eligibility.hasReviewed ? 'Đã cập nhật đánh giá của bạn.' : 'Cảm ơn bạn đã chia sẻ đánh giá thực tế!', 'success');
        await renderReviewsSection(product);
      } catch (err) {
        const serverMsg = err.response?.data?.error?.message || err.message || 'Chưa gửi được đánh giá. Vui lòng thử lại.';
        if (feedback) feedback.textContent = serverMsg;
        showToast(serverMsg, 'error');
      } finally {
        if (submitBtn.isConnected) {
          submitBtn.disabled = false;
          submitBtn.textContent = eligibility.hasReviewed ? 'Lưu thay đổi' : 'Gửi đánh giá';
        }
      }
    });
  }
}

function updateDetailRatingSummary(avgRating, reviewCount) {
  const summary = document.querySelector('#detailRatingSummary');
  if (!summary) return;
  if (!reviewCount || avgRating === null) {
    summary.innerHTML = '<a href="#productReviewsSection" class="detail-rating-empty">Chưa có đánh giá · Viết đánh giá đầu tiên</a>';
    return;
  }
  summary.innerHTML = `
    <span class="detail-rating-stars">${renderStars(avgRating)}</span>
    <strong>${avgRating.toFixed(1)}</strong>
    <a href="#productReviewsSection">${reviewCount} đánh giá</a>
  `;
}

// Khởi chạy khi nạp trang
initDetail();
