import { fetchCategories, fetchProducts, addToCart } from './storage.js';
import { formatPrice, renderStars, showToast, updateCartBadge } from './utils.js';

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
 * 2. HÀM RENDER DANH SÁCH HOA (TỐI THIỂU 15+ SẢN PHẨM)
 * Sử dụng map() và template literals theo phong cách Flower Chimp
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

  // Sử dụng phương thức map() của ES6+ để chuyển đổi mảng đối tượng thành HTML
  productList.innerHTML = products.map(product => {
    const badgeClass = product.badge === 'Handmade' ? 'badge-handmade' : 
                       (product.badge === 'Bán chạy' ? 'badge-bestseller' : '');

    return `
      <div class="product-card" data-id="${product.id}">
        <!-- HÌNH ẢNH HOA -->
        <div class="product-image">
          ${product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : ''}
          <a href="./detail.html?id=${product.id}">
            <img src="${product.image}" alt="${product.name}" loading="lazy">
          </a>
        </div>

        <!-- THÔNG TIN HOA -->
        <div class="product-info">
          <span class="product-category-label">${product.categoryName || 'Hoa Kẽm Nhung'}</span>
          
          <a href="./detail.html?id=${product.id}">
            <h3 class="product-title" title="${product.name}">
              ${product.name}
            </h3>
          </a>

          <div class="product-rating">
            ${renderStars(product.rating || 5)}
            <span>(${product.reviewCount || 20})</span>
          </div>

          <div class="product-bottom">
            <div class="price-wrap">
              ${product.originalPrice ? `<span class="was-price">${formatPrice(product.originalPrice)}</span>` : ''}
              <span class="price">${formatPrice(product.price)}</span>
            </div>

            <button class="add-cart" data-id="${product.id}" title="Thêm vào giỏ">
              + Thêm
            </button>
          </div>

          <a href="./detail.html?id=${product.id}" class="detail-btn">
            Xem chi tiết →
          </a>
        </div>
      </div>
    `;
  }).join('');
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
 * 5. KỸ THUẬT EVENT DELEGATION CHO NÚT THÊM VÀO GIỎ
 * Tránh rò rỉ bộ nhớ và không bị mất sự kiện khi re-render
 */
if (productList) {
  productList.addEventListener('click', (event) => {
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
    }
  });
}

/**
 * 6. KHỞI TẠO DỮ LIỆU BAN ĐẦU KHI MỞ TRANG
 */
async function init() {
  updateCartBadge();

  try {
    if (loadingElement) loadingElement.classList.remove('hidden');

    // Nạp đồng thời danh mục và sản phẩm
    const [categories, products] = await Promise.all([
      fetchCategories(),
      fetchProducts()
    ]);

    allCategories = categories;
    allProducts = products;

    if (loadingElement) loadingElement.classList.add('hidden');

    renderCategories(allCategories);
    renderProducts(allProducts);
  } catch (error) {
    console.error('Lỗi khởi tạo dữ liệu trang chủ:', error);
    if (loadingElement) loadingElement.classList.add('hidden');
    if (errorElement) errorElement.classList.remove('hidden');
  }
}

// Bắt đầu chạy chương trình khi file được nạp
init();
