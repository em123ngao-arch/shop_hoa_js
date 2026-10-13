import { fetchProductById, fetchProducts, addToCart } from './storage.js';
import { formatPrice, renderStars, showToast, updateCartBadge } from './utils.js';

/**
 * detail.js - Logic điều khiển trang chi tiết sản phẩm (detail.html)
 * Kế thừa chuẩn yêu cầu và giải quyết bài tập dang dở của Giáo viên
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
 * Sử dụng URLSearchParams chuẩn ES6+
 */
function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * 2. RENDER GIAO DIỆN CHI TIẾT SẢN PHẨM
 * @param {object} product - Đối tượng thông tin hoa
 */
function renderDetail(product) {
  if (!productDetail) return;

  // Cập nhật Breadcrumbs
  if (breadcrumbCategory) {
    breadcrumbCategory.textContent = product.categoryName || 'Hoa Kẽm Nhung';
    breadcrumbCategory.href = `./index.html`;
  }
  if (breadcrumbProduct) {
    breadcrumbProduct.textContent = product.name;
  }
  document.title = `${product.name} - Shop Hoa Kẽm Nhung`;

  // Tính phần trăm giảm giá nếu có
  let discountBadge = '';
  if (product.originalPrice && product.originalPrice > product.price) {
    const percent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    discountBadge = `<span class="detail-save-badge">Tiết kiệm ${percent}%</span>`;
  }

  // Render toàn bộ layout chi tiết
  productDetail.innerHTML = `
    <div class="detail-layout">
      <!-- CỘT TRÁI: ẢNH SẢN PHẨM -->
      <div class="detail-gallery">
        <div class="main-image-wrap">
          ${product.badge ? `<span class="detail-badge-corner">${product.badge}</span>` : ''}
          <img src="${product.image}" alt="${product.name}" id="mainDetailImage">
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
          <span class="detail-price">${formatPrice(product.price)}</span>
          ${product.originalPrice ? `<span class="detail-was-price">${formatPrice(product.originalPrice)}</span>` : ''}
          ${discountBadge}
        </div>

        <div class="detail-desc">
          <p>${product.description || 'Sản phẩm hoa handmade tinh xảo, chất lượng cao.'}</p>
        </div>

        <!-- BỘ CHỌN SỐ LƯỢNG -->
        <div class="quantity-control">
          <label class="quantity-label">Số lượng:</label>
          <div class="quantity-box">
            <button type="button" class="qty-btn" id="btnMinus" aria-label="Giảm số lượng">−</button>
            <input type="number" class="qty-input" id="qtyInput" value="1" min="1" max="${product.stock || 99}" readonly>
            <button type="button" class="qty-btn" id="btnPlus" aria-label="Tăng số lượng">+</button>
          </div>
        </div>

        <!-- NÚT HÀNH ĐỘNG -->
        <div class="action-buttons">
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
  `;

  // Gắn sự kiện tăng giảm số lượng
  setupQuantityEvents(product);

  // Gắn sự kiện nút Mua / Thêm giỏ
  setupCartButtons(product);
}

/**
 * 3. XỬ LÝ TĂNG GIẢM SỐ LƯỢNG
 */
function setupQuantityEvents(product) {
  const btnMinus = document.querySelector('#btnMinus');
  const btnPlus = document.querySelector('#btnPlus');
  const qtyInput = document.querySelector('#qtyInput');

  if (btnMinus && btnPlus && qtyInput) {
    btnMinus.addEventListener('click', () => {
      if (currentQuantity > 1) {
        currentQuantity--;
        qtyInput.value = currentQuantity;
      }
    });

    btnPlus.addEventListener('click', () => {
      const maxStock = product.stock || 99;
      if (currentQuantity < maxStock) {
        currentQuantity++;
        qtyInput.value = currentQuantity;
      } else {
        showToast(`Chỉ còn ${maxStock} sản phẩm trong kho!`, 'error');
      }
    });
  }
}

/**
 * 4. XỬ LÝ NÚT THÊM VÀO GIỎ VÀ MUA NGAY
 */
function setupCartButtons(product) {
  const btnAddToCart = document.querySelector('#btnAddToCart');
  const btnBuyNow = document.querySelector('#btnBuyNow');

  if (btnAddToCart) {
    btnAddToCart.addEventListener('click', () => {
      addToCart(product, currentQuantity);
      updateCartBadge();
      showToast(`Đã thêm ${currentQuantity} bó "${product.name}" vào giỏ hàng!`);
    });
  }

  if (btnBuyNow) {
    btnBuyNow.addEventListener('click', () => {
      addToCart(product, currentQuantity);
      updateCartBadge();
      showToast(`Đang chuyển tới trang thanh toán...`);
      // Chuẩn bị cho giai đoạn giỏ hàng tiếp theo
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);
    });
  }
}

/**
 * 5. RENDER SẢN PHẨM LIÊN QUAN (RELATED PRODUCTS)
 * Sử dụng filter() và slice() của ES6+
 */
async function renderRelatedProducts(product) {
  if (!relatedGrid) return;

  const allProducts = await fetchProducts();
  
  // Lọc các sản phẩm cùng danh mục và loại trừ sản phẩm hiện tại
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
      </div>
      <div class="product-info">
        <a href="./detail.html?id=${item.id}">
          <h3 class="product-title">${item.name}</h3>
        </a>
        <div class="product-bottom">
          <span class="price">${formatPrice(item.price)}</span>
          <a href="./detail.html?id=${item.id}" class="add-cart" style="font-size: 12px; padding: 6px 12px;">
            Xem
          </a>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * 6. KHỞI TẠO TRANG CHI TIẾT
 */
async function initDetail() {
  updateCartBadge();
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
    renderDetail(currentProduct);
    renderRelatedProducts(currentProduct);
  } catch (error) {
    console.error('Lỗi khi nạp chi tiết sản phẩm:', error);
    if (loadingElement) loadingElement.classList.add('hidden');
    if (errorElement) errorElement.classList.remove('hidden');
  }
}

// Khởi chạy khi load trang
initDetail();
