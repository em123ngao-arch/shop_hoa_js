import api, { authApi, avatarApi, notificationApi, reviewApi, wishlistApi } from './api.js';

/**
 * storage.js - Quản lý giao tiếp REST API (/api/...) và lưu trữ phiên phía Client
 * Giỏ hàng (SHOP_HOA_CART), Voucher đang chọn (SHOP_HOA_APPLIED_VOUCHER),
 * Wishlist khách vãng lai (SHOP_HOA_WISHLIST_guest) và cache hiển thị user.
 */

const STORAGE_KEYS = {
  CART: 'SHOP_HOA_CART',
  APPLIED_VOUCHER: 'SHOP_HOA_APPLIED_VOUCHER',
  ACTIVE_THEME: 'SHOP_HOA_ACTIVE_THEME',
  WISHLIST_PREFIX: 'SHOP_HOA_WISHLIST_'
};

// Bộ nhớ đệm trong phiên cho các hàm đồng bộ (giỏ hàng, tính voucher) sau khi nạp từ API
let productsSnapshot = [];
let promotionsSnapshot = [];

function parseProductNumericId(val) {
  return parseInt(String(val || '').replace(/\D/g, ''), 10) || 0;
}

/**
 * Lấy danh sách danh mục từ API (/api/categories)
 */
export async function fetchCategories() {
  try {
    const response = await api.get('/api/categories');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Lỗi tải danh mục từ /api/categories:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

/**
 * Lấy danh sách sản phẩm hoa từ API (/api/products)
 */
export async function fetchProducts(options = {}) {
  try {
    const params = {};
    if (options && options.activeOnly === false) {
      params.activeOnly = 'false';
    }
    const response = await api.get('/api/products', { params });
    const list = Array.isArray(response.data) ? response.data : [];
    productsSnapshot = list;
    return list;
  } catch (error) {
    console.error('Lỗi tải sản phẩm từ /api/products:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

/**
 * Lấy thông tin 1 sản phẩm theo ID (Dùng find của ES6 khi có sẵn trong snapshot)
 * @param {number|string} id - ID sản phẩm
 */
export async function fetchProductById(id) {
  try {
    const response = await api.get(`/api/products/${encodeURIComponent(id)}`);
    if (response.data) return response.data;
  } catch (error) {
    console.warn('Không tải được chi tiết sản phẩm từ /api/products/:id:', error.response?.data?.error?.message || error.message);
  }

  return productsSnapshot.find(product => String(product.id) === String(id)) || null;
}

/**
 * Thêm sản phẩm vào giỏ hàng và đồng bộ localStorage (SHOP_HOA_CART)
 * @param {object|string|number} product - Thông tin sản phẩm hoa hoặc ID sản phẩm
 * @param {number} quantity - Số lượng cần thêm
 */
export function addToCart(product, quantity = 1) {
  if (!product) return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];

  let targetProduct = product;
  if (typeof product === 'string' || typeof product === 'number') {
    const found = productsSnapshot.find(p => String(p.id) === String(product));
    if (!found) {
      console.warn('addToCart: Không tìm thấy sản phẩm trong bộ nhớ đệm với ID:', product);
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
    }
    targetProduct = found;
  }

  const prodId = String(targetProduct.id || targetProduct.productId || '').trim();
  if (!prodId || prodId === 'undefined' || prodId === 'null') {
    console.warn('addToCart: ID sản phẩm không hợp lệ:', targetProduct);
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  }

  let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  cart = cart.filter(item => {
    if (!item || !item.id) return false;
    const sId = String(item.id);
    if (sId === 'undefined' || sId === 'null') return false;
    if (!item.name || item.name === 'undefined' || item.name === 'null') return false;
    if (!item.price || Number(item.price) <= 0) return false;
    return true;
  });

  const prodName = targetProduct.name && targetProduct.name !== 'undefined' ? targetProduct.name : '';
  const prodPrice = Number(targetProduct.price) || 0;
  if (!prodName || prodPrice <= 0) {
    console.warn('addToCart: Sản phẩm không hợp lệ, bỏ qua:', targetProduct);
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    return cart;
  }

  const existingIndex = cart.findIndex(item => String(item.id) === prodId);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += Number(quantity);
    if (cart[existingIndex].categoryId === undefined && targetProduct.categoryId !== undefined) {
      cart[existingIndex].categoryId = targetProduct.categoryId;
    }
    if (cart[existingIndex].originalPrice === undefined) {
      cart[existingIndex].originalPrice = targetProduct.originalPrice || targetProduct.price;
    }
    if (targetProduct.addonsText) cart[existingIndex].addonsText = targetProduct.addonsText;
    if (targetProduct.selectedAddons) cart[existingIndex].selectedAddons = targetProduct.selectedAddons;
  } else {
    cart.push({
      id: prodId,
      productId: targetProduct.productId || targetProduct.id || prodId,
      name: prodName,
      price: prodPrice,
      originalPrice: Number(targetProduct.originalPrice || targetProduct.price) || prodPrice,
      image: targetProduct.image || targetProduct.image_url || targetProduct.hinhbanner || './images/300.png',
      categoryId: targetProduct.categoryId !== undefined ? String(targetProduct.categoryId) : '1',
      categoryName: targetProduct.categoryName || 'Hoa Kẽm Nhung',
      quantity: Math.max(1, Number(quantity) || 1),
      addonsText: targetProduct.addonsText || null,
      selectedAddons: targetProduct.selectedAddons || []
    });
  }

  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  return cart;
}

/**
 * Lấy danh sách banner đang hoạt động từ API (/api/banners)
 * Sử dụng ES6 filter() và sort() để sắp xếp theo thứ tự hiển thị
 */
export async function fetchBanners() {
  try {
    const response = await api.get('/api/banners');
    const list = Array.isArray(response.data) ? response.data : [];
    return list
      .filter(b => b.active !== false && b.is_active !== false)
      .sort((a, b) => ((a.order ?? a.display_order ?? 0) - (b.order ?? b.display_order ?? 0)));
  } catch (error) {
    console.error('Lỗi tải banner từ /api/banners:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

/**
 * Lấy danh sách sản phẩm bán chạy nhất (dựa trên danh sách sản phẩm API)
 */
export async function fetchBestSellers(limit = 4) {
  const all = productsSnapshot.length > 0 ? productsSnapshot : await fetchProducts();
  return [...all]
    .sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0))
    .slice(0, limit);
}

/**
 * Lấy danh sách mẫu hoa mới nhất (Newest Arrivals)
 */
export async function fetchNewestProducts(limit = 4) {
  const all = productsSnapshot.length > 0 ? productsSnapshot : await fetchProducts();
  return [...all]
    .sort((a, b) => parseProductNumericId(b.id) - parseProductNumericId(a.id))
    .slice(0, limit);
}

/**
 * Lấy danh sách Voucher khuyến mãi đang kích hoạt từ API (/api/promotions)
 */
export async function fetchPromotions() {
  try {
    const response = await api.get('/api/promotions');
    const list = Array.isArray(response.data) ? response.data : [];
    promotionsSnapshot = list;
    return list.filter(p => p.active !== false && p.is_active !== false);
  } catch (error) {
    console.error('Lỗi tải voucher từ /api/promotions:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

/**
 * Chuẩn hóa và làm giàu dữ liệu sản phẩm trong giỏ hàng từ catalog đã tải
 */
export function resolveCartItemsCatalog(items, { persistCleanup = true } = {}) {
  if (!Array.isArray(items)) return [];

  const prodMap = new Map();
  (productsSnapshot || []).forEach(p => {
    if (!p) return;
    const strId = String(p.id);
    prodMap.set(strId, p);
    if (/^\d+$/.test(strId)) {
      prodMap.set(`PROD-${strId.padStart(3, '0')}`, p);
    }
    if (/^PROD-0*(\d+)$/i.test(strId)) {
      const numPart = strId.replace(/^PROD-0*/i, '');
      prodMap.set(numPart, p);
    }
  });

  const resolved = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rawId = String(item.id || item.productId || '').trim();
    if (!rawId || rawId === 'undefined' || rawId === 'null') continue;

    const baseId = rawId.replace(/__.*$/, '').trim();
    const numPart = baseId.replace(/^PROD-0*/i, '');
    const prodCode = /^PROD-/i.test(baseId) ? baseId : `PROD-${String(baseId).padStart(3, '0')}`;
    const p = prodMap.get(rawId) || prodMap.get(baseId) || prodMap.get(numPart) || prodMap.get(prodCode);

    const name = item.name && item.name !== 'undefined' && item.name !== 'null'
      ? item.name
      : (p ? p.name : '');

    if (!name || name === 'undefined' || name === 'null') continue;

    const price = Number(item.price !== undefined && !isNaN(Number(item.price)) && Number(item.price) > 0
      ? item.price
      : (p ? p.price : 0));

    if (price <= 0) continue;

    const maxAvailable = (p && typeof p.stock === 'number') ? p.stock : 99;
    if (maxAvailable <= 0) continue;

    const safeQty = Math.min(Math.max(1, Number(item.quantity) || 1), maxAvailable);

    resolved.push({
      ...item,
      id: rawId,
      productId: (p && p.id) ? p.id : (baseId || rawId),
      name,
      categoryId: (p && p.categoryId !== undefined) ? String(p.categoryId) : (item.categoryId !== undefined ? String(item.categoryId) : '1'),
      categoryName: p ? (p.categoryName || item.categoryName) : (item.categoryName || 'Hoa Kẽm Nhung'),
      price,
      originalPrice: (p && p.originalPrice !== undefined) ? Number(p.originalPrice) : (item.originalPrice !== undefined ? Number(item.originalPrice) : price),
      quantity: safeQty
    });
  }

  if (persistCleanup && resolved.length !== items.length && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(resolved));
    } catch (e) { }
  }

  return resolved;
}

/**
 * Tính toán mức giảm giá và kiểm tra tính hợp lệ của voucher theo mô hình phân cấp
 * @param {Array} items - Danh sách sản phẩm trong giỏ hàng
 * @param {Object} voucher - Đối tượng voucher cấu hình
 * @returns {Object} Kết quả kiểm tra và số tiền giảm chi tiết
 */
export function calculateVoucherDiscount(items, voucher) {
  if (!voucher || !voucher.active) {
    return {
      isValid: false,
      error: 'Mã giảm giá không tồn tại hoặc đã bị khóa!',
      reasonCode: 'INACTIVE',
      reasonText: 'Mã đã bị khóa hoặc không tồn tại',
      discountAmount: 0,
      eligibleAmount: 0
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (voucher.startDate) {
    const start = new Date(voucher.startDate);
    if (now < start) {
      return {
        isValid: false,
        error: `Mã ${voucher.code} chỉ bắt đầu áp dụng từ ngày ${start.toLocaleDateString('vi-VN')}!`,
        reasonCode: 'NOT_STARTED',
        reasonText: `Bắt đầu từ ${start.toLocaleDateString('vi-VN')}`,
        discountAmount: 0,
        eligibleAmount: 0
      };
    }
  }

  if (voucher.endDate) {
    const end = new Date(voucher.endDate);
    end.setHours(23, 59, 59, 999);
    if (new Date() > end) {
      return {
        isValid: false,
        error: `Mã ${voucher.code} đã hết hạn sử dụng!`,
        reasonCode: 'EXPIRED',
        reasonText: 'Mã đã hết hạn sử dụng',
        discountAmount: 0,
        eligibleAmount: 0
      };
    }
  }

  if (voucher.usageLimit && Number(voucher.usedCount || 0) >= Number(voucher.usageLimit)) {
    return {
      isValid: false,
      error: `Rất tiếc! Mã ${voucher.code} đã hết lượt sử dụng!`,
      reasonCode: 'USAGE_LIMIT',
      reasonText: 'Đã hết lượt sử dụng',
      discountAmount: 0,
      eligibleAmount: 0
    };
  }

  if (!items || items.length === 0) {
    return {
      isValid: false,
      error: 'Giỏ hàng của bạn đang trống!',
      reasonCode: 'EMPTY_CART',
      reasonText: 'Giỏ hàng trống',
      discountAmount: 0,
      eligibleAmount: 0
    };
  }

  const scope = voucher.scope || 'all';
  const targetCats = (voucher.targetCategoryIds || []).map(String);
  const targetProds = (voucher.targetProductIds || []).map(String);

  const eligibleItems = items.filter(item => {
    const isSaleItem = Number(item.originalPrice) > Number(item.price);
    if (voucher.excludeSaleItems && isSaleItem) return false;

    if (scope === 'category') {
      return targetCats.includes(String(item.categoryId || '1'));
    }
    if (scope === 'product') {
      return targetProds.includes(String(item.productId || item.id));
    }
    return true;
  });

  if (eligibleItems.length === 0) {
    let reason = `Không có sản phẩm nào trong giỏ hàng thỏa điều kiện áp dụng mã ${voucher.code}!`;
    let shortReason = 'Chưa có sản phẩm phù hợp';
    if (voucher.excludeSaleItems) {
      reason = `Mã ${voucher.code} không áp dụng cho các mẫu hoa đang giảm giá (Flash Sale)!`;
      shortReason = 'Không áp dụng hàng Flash Sale';
    } else if (scope === 'category') {
      reason = `Mã ${voucher.code} chỉ áp dụng riêng cho một số danh mục hoa nhất định!`;
      shortReason = 'Chỉ áp dụng danh mục riêng';
    } else if (scope === 'product') {
      reason = `Mã ${voucher.code} chỉ áp dụng cho sản phẩm được chỉ định!`;
      shortReason = 'Chỉ áp dụng mẫu hoa chỉ định';
    }
    return {
      isValid: false,
      error: reason,
      reasonCode: 'INELIGIBLE_ITEMS',
      reasonText: shortReason,
      discountAmount: 0,
      eligibleAmount: 0
    };
  }

  const eligibleAmount = eligibleItems.reduce(
    (sum, item) => sum + (Number(item.price) * Number(item.quantity)),
    0
  );

  const minOrder = Number(voucher.minOrder || 0);
  if (minOrder > 0 && eligibleAmount < minOrder) {
    const formattedEligible = eligibleAmount.toLocaleString('vi-VN') + '₫';
    const formattedMin = minOrder.toLocaleString('vi-VN') + '₫';
    const needed = minOrder - eligibleAmount;
    const formattedNeeded = needed.toLocaleString('vi-VN') + '₫';
    return {
      isValid: false,
      error: `Tổng tiền hoa thỏa điều kiện mới đạt ${formattedEligible} (Cần tối thiểu ${formattedMin} để dùng mã ${voucher.code}, mua thêm ${formattedNeeded})!`,
      reasonCode: 'MIN_ORDER',
      reasonText: `Mua thêm ${formattedNeeded} để dùng mã`,
      neededAmount: needed,
      discountAmount: 0,
      eligibleAmount,
      eligibleItems
    };
  }

  let discount = 0;
  let isCapped = false;
  const discountType = voucher.discountType || (voucher.discountPercent ? 'percent' : 'fixed');
  const discountValue = Number(voucher.discountValue ?? voucher.discountPercent ?? 0);

  if (discountType === 'percent') {
    discount = Math.round((eligibleAmount * discountValue) / 100);
    if (voucher.maxDiscount && discount > Number(voucher.maxDiscount)) {
      discount = Number(voucher.maxDiscount);
      isCapped = true;
    }
  } else {
    discount = Math.min(discountValue, eligibleAmount);
  }

  return {
    isValid: true,
    discountAmount: Math.max(0, discount),
    eligibleAmount,
    eligibleItems,
    isCapped,
    discountType,
    discountValue,
    maxDiscount: voucher.maxDiscount || null
  };
}

function buildOrderSummaryFromItems(rawItems = [], { applyCartVoucher = true, persistCleanup = true } = {}) {
  const items = resolveCartItemsCatalog(rawItems, { persistCleanup });
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  let appliedVoucher = null;
  let discountAmount = 0;
  let voucherCalculation = null;

  if (applyCartVoucher) {
    try {
      appliedVoucher = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLIED_VOUCHER));
    } catch (e) { }

    if (appliedVoucher && appliedVoucher.active) {
      voucherCalculation = calculateVoucherDiscount(items, appliedVoucher);
      if (voucherCalculation.isValid) {
        discountAmount = voucherCalculation.discountAmount;
      } else if (persistCleanup && items.length > 0) {
        localStorage.removeItem(STORAGE_KEYS.APPLIED_VOUCHER);
        appliedVoucher = null;
        voucherCalculation = null;
      }
    }
  }

  const totalPrice = Math.max(0, subtotal - discountAmount);

  return {
    items,
    subtotal,
    discountAmount,
    totalPrice,
    total: totalPrice,
    appliedVoucher,
    voucherCalculation
  };
}

export function getCartSummary() {
  const rawItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  return buildOrderSummaryFromItems(rawItems, { applyCartVoucher: true, persistCleanup: true });
}

export function getDirectBuySummary(directItems = []) {
  return buildOrderSummaryFromItems(directItems, { applyCartVoucher: false, persistCleanup: false });
}

export function updateCartQuantity(productId, delta) {
  let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  const index = cart.findIndex(item => item.id == productId);

  if (index > -1) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  }
  return getCartSummary();
}

export function removeCartItem(productId) {
  let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  cart = cart.filter(item => item.id != productId);
  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  return getCartSummary();
}

export async function applyVoucher(code) {
  if (!code || !code.trim()) {
    return { success: false, message: 'Vui lòng nhập mã giảm giá!' };
  }

  const cleanCode = code.trim().toUpperCase();
  const promotions = await fetchPromotions();
  const voucher = promotions.find(p => p.code.toUpperCase() === cleanCode && p.active !== false);

  if (!voucher) {
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn!' };
  }

  const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  const calc = calculateVoucherDiscount(items, voucher);

  if (!calc.isValid) {
    return { success: false, message: calc.error };
  }

  localStorage.setItem(STORAGE_KEYS.APPLIED_VOUCHER, JSON.stringify(voucher));

  let successMsg = `Đã áp dụng mã ${voucher.code}! Giảm ${calc.discountAmount.toLocaleString('vi-VN')}₫`;
  if (calc.isCapped && calc.maxDiscount) {
    successMsg += ` (Đã đạt mức giảm tối đa ${Number(calc.maxDiscount).toLocaleString('vi-VN')}₫)`;
  }

  return {
    success: true,
    message: successMsg,
    summary: getCartSummary()
  };
}

export function removeVoucher() {
  localStorage.removeItem(STORAGE_KEYS.APPLIED_VOUCHER);
  return getCartSummary();
}

/* ==========================================================================
   ADMIN CRUD FUNCTIONS (/api/... ONLY - MYSQL 8.0)
   ========================================================================== */

export async function fetchAllBanners() {
  try {
    const response = await api.get('/api/banners?all=true');
    const list = Array.isArray(response.data) ? response.data : [];
    return [...list].sort((a, b) => (Number(a.order ?? a.display_order) || 0) - (Number(b.order ?? b.display_order) || 0));
  } catch (error) {
    console.error('Lỗi tải banner quản trị từ /api/banners:', error.response?.data?.error?.message || error.message);
    return [];
  }
}

export async function createBanner(bannerData) {
  const response = await api.post('/api/banners', {
    ...bannerData,
    order: Number(bannerData.order) || 1,
    active: bannerData.active !== undefined ? Boolean(bannerData.active) : true,
    theme: bannerData.theme || 'default'
  });
  return response.data;
}

export async function updateBanner(id, bannerData) {
  const response = await api.put(`/api/banners/${encodeURIComponent(id)}`, bannerData);
  return response.data;
}

export async function deleteBanner(id) {
  await api.delete(`/api/banners/${encodeURIComponent(id)}`);
  return true;
}

export async function activateBannerTheme(themeKey) {
  const response = await api.put('/api/banners/theme', { theme: themeKey || 'default' });
  localStorage.setItem(STORAGE_KEYS.ACTIVE_THEME, themeKey || 'default');
  return Array.isArray(response.data) ? response.data : [];
}

export async function createProduct(productData) {
  const payload = {
    ...productData,
    price: Number(productData.price) || 0,
    originalPrice: Number(productData.originalPrice) || Number(productData.price) || 0,
    costPrice: Number(productData.costPrice || productData.cost_price || 0),
    stock: Number(productData.stock) || 0,
    isActive: productData.isActive !== undefined ? Boolean(productData.isActive) : true
  };
  const res = await api.post('/api/products', payload);
  await fetchProducts({ activeOnly: false });
  return res.data;
}

export async function updateProduct(id, productData) {
  const payload = { ...productData };
  if (productData.price !== undefined) payload.price = Number(productData.price);
  if (productData.originalPrice !== undefined) payload.originalPrice = Number(productData.originalPrice);
  if (productData.costPrice !== undefined) payload.costPrice = Number(productData.costPrice);
  if (productData.cost_price !== undefined) payload.cost_price = Number(productData.cost_price);
  if (productData.stockDelta !== undefined) payload.stockDelta = Number(productData.stockDelta);
  if (productData.stock !== undefined) payload.stock = Number(productData.stock);
  if (productData.isActive !== undefined) payload.isActive = Boolean(productData.isActive);
  if (productData.is_active !== undefined) payload.is_active = Boolean(productData.is_active);

  const res = await api.put(`/api/products/${encodeURIComponent(id)}`, payload);
  await fetchProducts({ activeOnly: false });
  return res.data;
}

export async function deleteProduct(id) {
  await api.delete(`/api/products/${encodeURIComponent(id)}`);
  await fetchProducts();
  return true;
}

export async function fetchAllPromotions() {
  try {
    const response = await api.get('/api/promotions?all=true');
    const list = Array.isArray(response.data) ? response.data : [];
    promotionsSnapshot = list;
    return list;
  } catch (err) {
    console.error('Lỗi tải vouchers từ /api/promotions:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

export async function createPromotion(promoData) {
  const newPromo = {
    ...promoData,
    id: promoData.id || `vouch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    code: (promoData.code || '').trim().toUpperCase(),
    discountPercent: Number(promoData.discountPercent ?? promoData.discountValue) || 10,
    minOrder: promoData.minOrder !== undefined ? Number(promoData.minOrder) : 0,
    active: promoData.active !== undefined ? Boolean(promoData.active) : true
  };

  try {
    const response = await api.post('/api/promotions', newPromo);
    return response.data;
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    throw new Error(errMsg);
  }
}

export async function updatePromotion(id, promoData) {
  const current = promotionsSnapshot.find(p => String(p.id) === String(id)) || {};

  const updatedPromo = {
    ...current,
    ...promoData,
    id: String(id),
    usedCount: typeof promoData.usedCount === 'number' ? promoData.usedCount : (current.usedCount || 0),
    code: (promoData.code || current.code || '').trim().toUpperCase(),
    discountPercent: Number(promoData.discountPercent ?? promoData.discountValue) || current.discountPercent || current.discountValue || 10,
    minOrder: promoData.minOrder !== undefined ? Number(promoData.minOrder) : (current.minOrder || 0),
    active: promoData.active !== undefined ? Boolean(promoData.active) : Boolean(current.active ?? current.isActive ?? true)
  };

  try {
    const response = await api.put(`/api/promotions/${encodeURIComponent(id)}`, updatedPromo);
    return response.data;
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    throw new Error(errMsg);
  }
}

export async function deletePromotion(id) {
  try {
    await api.delete(`/api/promotions/${encodeURIComponent(id)}`);
    return true;
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    throw new Error(errMsg);
  }
}

export async function fetchOrders() {
  try {
    const response = await api.get('/api/orders');
    return Array.isArray(response.data) ? response.data : [];
  } catch (e) {
    console.warn('Không tải được đơn hàng từ API:', e.response?.data?.error?.message || e.message);
    return [];
  }
}

export async function updateOrderStatus(orderId, newStatus) {
  const response = await api.patch(`/api/orders/${encodeURIComponent(orderId)}/status`, { status: newStatus });
  return response.data?.order || { status: newStatus };
}

export async function saveOrder(orderData) {
  const newOrder = {
    ...orderData,
    createdAt: orderData.createdAt || new Date().toISOString(),
    status: orderData.status || 'pending',
    paymentMethod: orderData.paymentMethod || 'cod',
    paymentStatus: orderData.paymentStatus || 'pending',
    isGift: Boolean(orderData.isGift),
    recipientName: orderData.recipientName || '',
    recipientPhone: orderData.recipientPhone || '',
    hasGreetingCard: Boolean(orderData.hasGreetingCard || orderData.cardMessage),
    cardMessage: orderData.cardMessage || '',
    deliverySlot: orderData.deliverySlot || 'Tiêu chuẩn trong ngày'
  };

  const response = await api.post('/api/orders', newOrder);
  return { ...newOrder, ...(response.data || {}) };
}

export async function updateDraftOrder(orderId, orderData, draftToken) {
  const response = await api.put(`/api/orders/${encodeURIComponent(orderId)}/draft`, {
    ...orderData,
    draftToken
  });
  return { ...orderData, ...(response.data || {}) };
}

// ============================================================================
// 1. MODULE UPLOAD ẢNH ĐẠI DIỆN CÁ NHÂN (USER AVATAR - CANVAS + SHARP WEBP)
// ============================================================================
export async function uploadUserAvatarStorage(avatarBase64) {
  const res = await avatarApi.uploadAvatar(avatarBase64);
  const updatedUser = res.data?.user || null;

  const savedUserJson = localStorage.getItem('user');
  if (savedUserJson && updatedUser) {
    try {
      const user = JSON.parse(savedUserJson);
      const merged = { ...user, ...updatedUser };
      localStorage.setItem('user', JSON.stringify(merged));
    } catch (e) { }
  }

  const finalAvatar = updatedUser?.avatar || avatarBase64;
  window.dispatchEvent(new CustomEvent('user:avatar-updated', { detail: { avatar: finalAvatar } }));
  return updatedUser;
}

// ============================================================================
// 2. MODULE DANH SÁCH HOA YÊU THÍCH (WISHLIST API + GUEST LOCAL)
// ============================================================================
export function getWishlistStorageKey() {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      const identifier = u.id || u.phone || u.email || 'guest';
      return `${STORAGE_KEYS.WISHLIST_PREFIX}${identifier}`;
    } catch (e) { }
  }
  return `${STORAGE_KEYS.WISHLIST_PREFIX}guest`;
}

export async function fetchWishlistStorage() {
  const key = getWishlistStorageKey();
  if (localStorage.getItem('user')) {
    try {
      const res = await wishlistApi.getWishlist();
      if (Array.isArray(res.data)) return res.data;
    } catch (err) { }
    return [];
  }

  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached) || [];
    } catch (e) { }
  }
  return [];
}

export async function toggleWishlistStorage(productId) {
  const prodIdStr = String(productId);
  if (localStorage.getItem('user')) {
    const res = await wishlistApi.toggleWishlist(prodIdStr);
    const data = res.data || {};
    const wishlist = Array.isArray(data.wishlist) ? data.wishlist : await fetchWishlistStorage();
    const isFavorite = data.isFavorite !== undefined ? Boolean(data.isFavorite) : wishlist.includes(prodIdStr);
    window.dispatchEvent(new CustomEvent('wishlist:updated', {
      detail: { productId: prodIdStr, isFavorite, wishlist }
    }));
    return { isFavorite, wishlist };
  }

  const key = getWishlistStorageKey();
  let currentList = [];
  try {
    currentList = JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    currentList = [];
  }

  let isFavorite = false;
  const idx = currentList.indexOf(prodIdStr);
  if (idx !== -1) {
    currentList.splice(idx, 1);
    isFavorite = false;
  } else {
    currentList.push(prodIdStr);
    isFavorite = true;
  }

  localStorage.setItem(key, JSON.stringify(currentList));
  window.dispatchEvent(new CustomEvent('wishlist:updated', {
    detail: { productId: prodIdStr, isFavorite, wishlist: currentList }
  }));

  return { isFavorite, wishlist: currentList };
}

export async function mergeGuestWishlistToUser() {
  const guestKey = `${STORAGE_KEYS.WISHLIST_PREFIX}guest`;
  try {
    const guestList = JSON.parse(localStorage.getItem(guestKey)) || [];
    if (guestList.length > 0 && localStorage.getItem('user')) {
      for (const pid of guestList) {
        try {
          const current = await fetchWishlistStorage();
          if (!current.includes(String(pid))) {
            await wishlistApi.toggleWishlist(String(pid));
          }
        } catch (e) { }
      }
      localStorage.removeItem(guestKey);
    }
  } catch (e) { }
  return [];
}

// ============================================================================
// 3. MODULE ĐÁNH GIÁ & BÌNH LUẬN (REVIEWS & THREADS API)
// ============================================================================
export async function fetchProductReviews(productId = null) {
  try {
    const res = await reviewApi.getReviews(productId);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.warn('Không thể tải đánh giá từ máy chủ:', err.message);
    return [];
  }
}

export async function submitProductReview({ productId, rating, comment, userName, images = [] }) {
  const res = await reviewApi.createReview({ productId, rating, comment, userName, images });
  if (res.data && res.data.review) {
    const idx = productsSnapshot.findIndex(p => String(p.id) === String(productId));
    if (idx !== -1 && res.data.product) {
      productsSnapshot[idx].rating = res.data.product.rating;
      productsSnapshot[idx].reviewCount = res.data.product.reviewCount;
    }
    window.dispatchEvent(new CustomEvent('review:created', {
      detail: { review: res.data.review, product: res.data.product }
    }));
    return res.data;
  }
  return res.data;
}

export async function toggleReviewHelpful(reviewId) {
  const res = await reviewApi.toggleHelpful(reviewId);
  return res.data;
}

export async function postReviewThreadComment(reviewId, content) {
  const res = await reviewApi.addComment(reviewId, content);
  return res.data;
}

export async function deleteReviewThreadComment(reviewId, commentId) {
  const res = await reviewApi.deleteComment(reviewId, commentId);
  return res.data;
}

export async function toggleHideProductReview(reviewId) {
  const res = await reviewApi.toggleHideReview(reviewId);
  return res.data;
}

export async function deleteProductReview(reviewId) {
  const res = await reviewApi.deleteReview(reviewId);
  return res.data;
}

export async function replyProductReview(reviewId, reply) {
  const res = await reviewApi.replyReview(reviewId, reply);
  return res.data;
}

// ============================================================================
// 4. MODULE THÔNG BÁO TIẾN TRÌNH ĐƠN HÀNG (NOTIFICATIONS API)
// ============================================================================
export async function fetchUserNotifications() {
  if (!localStorage.getItem('user')) return [];
  try {
    const res = await notificationApi.getNotifications();
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    return [];
  }
}

export async function markNotificationRead(id) {
  await notificationApi.markAsRead(id);
}

export async function markAllNotificationsRead() {
  await notificationApi.markAllAsRead();
}
