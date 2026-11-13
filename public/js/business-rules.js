/**
 * business-rules.js - Cac ham nghiep vu thuan ES6+ dung chung cho Frontend & Kiem thu
 * Khong phu thuoc DOM hay Axios de co the kiem thu truc tiep trong Node.js va trinh duyet.
 */

const ORDER_COST_RATIO = 0.65;

/**
 * Dinh dang tien te VND chuan Viet Nam
 * @param {number|string} price - Gia tri tien
 * @returns {string} Chuoi tien te da dinh dang
 */
export function formatPriceVnd(price = 0) {
  const numeric = Number(price);
  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND'
  });
}

/**
 * Kiem tra san pham co khop ID danh muc dang chon hay khong (chuan hoa ve String).
 * Giai quyet loi lech kieu Number === String va ho tro ID dang '1', '0', 'all', 'CAT-xxx'.
 * @param {object} product - Doi tuong san pham
 * @param {string|number|null} selectedCategoryId - ID danh muc dang chon
 * @returns {boolean} True neu khop danh muc hoac dang xem tat ca
 */
export function matchesCategoryId(product, selectedCategoryId = '0') {
  const normalizedSelected = String(selectedCategoryId ?? '0').trim();
  if (!normalizedSelected || normalizedSelected === '0' || normalizedSelected.toLowerCase() === 'all') {
    return true;
  }
  const productCategoryId = String(product?.categoryId ?? product?.category_id ?? '').trim();
  return productCategoryId !== '' && productCategoryId === normalizedSelected;
}

/**
 * Chuyen ID dang chuoi ('PROD-001', '12') thanh so de sap xep on dinh
 * @param {string|number} val - Gia tri ID
 * @returns {number} Phan so trich xuat tu ID
 */
function parseNumericId(val) {
  return parseInt(String(val || '').replace(/\D/g, ''), 10) || 0;
}

/**
 * Loc va sap xep danh sach san pham theo danh muc, tu khoa va kieu sap xep (dung filter & clone sort).
 * @param {Array<object>} products - Danh sach san pham goc
 * @param {object} options - Tuy chon loc/sap xep { categoryId, searchTerm, sort }
 * @returns {Array<object>} Danh sach da loc va sap xep
 */
export function filterCatalogProducts(products = [], { categoryId = '0', searchTerm = '', sort = 'newest' } = {}) {
  const keyword = String(searchTerm || '').toLowerCase().trim();

  const filtered = (products || []).filter(product => {
    if (!matchesCategoryId(product, categoryId)) return false;
    if (!keyword) return true;
    const nameMatch = String(product?.name || '').toLowerCase().includes(keyword);
    const descMatch = String(product?.description || '').toLowerCase().includes(keyword);
    return nameMatch || descMatch;
  });

  const sorted = [...filtered];
  if (sort === 'newest') {
    sorted.sort((a, b) => parseNumericId(b.id) - parseNumericId(a.id));
  } else if (sort === 'price-asc') {
    sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sort === 'price-desc') {
    sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sort === 'bestseller' || sort === 'best-seller') {
    sorted.sort((a, b) => Number(b.soldCount || b.sold_count || 0) - Number(a.soldCount || a.sold_count || 0));
  } else if (sort === 'id-asc') {
    sorted.sort((a, b) => parseNumericId(a.id) - parseNumericId(b.id));
  }

  return sorted;
}

/**
 * Chuan hoa thong tin hien thi Voucher (ho tro ca percent lan fixed VND, khong bao gio tra 'undefined').
 * @param {object} voucher - Du lieu voucher tu API hoac cache
 * @param {Function} formatCurrencyFn - Ham format tien te VND
 * @returns {object} Thong tin nhan giam gia va dieu kien da chuan hoa
 */
export function formatVoucherDisplay(voucher = {}, formatCurrencyFn = formatPriceVnd) {
  const rawType = String(voucher?.discountType ?? voucher?.discount_type ?? '').trim().toLowerCase();
  const hasLegacyPercent = voucher?.discountPercent !== undefined && voucher?.discountPercent !== null;
  const rawValue = Number(voucher?.discountValue ?? voucher?.discount_value ?? voucher?.discountPercent ?? 0);
  const discountValue = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;

  let discountType = 'percent';
  if (rawType === 'fixed') {
    discountType = 'fixed';
  } else if (rawType === 'percent') {
    discountType = 'percent';
  } else if (!hasLegacyPercent && discountValue > 100) {
    discountType = 'fixed';
  }

  const isPercent = discountType === 'percent';
  const minOrderRaw = Number(voucher?.minOrder ?? voucher?.min_order ?? 0);
  const minOrder = Number.isFinite(minOrderRaw) && minOrderRaw > 0 ? minOrderRaw : 0;
  const maxDiscountRaw = voucher?.maxDiscount ?? voucher?.max_discount;
  const maxDiscount = Number.isFinite(Number(maxDiscountRaw)) && Number(maxDiscountRaw) > 0
    ? Number(maxDiscountRaw)
    : null;

  const formattedFixed = formatCurrencyFn(discountValue);
  const badgeText = isPercent ? `Giảm ${discountValue}%` : `Giảm ${formattedFixed}`;
  const shortTag = isPercent ? `-${discountValue}%` : `-${formattedFixed}`;

  const customDesc = String(voucher?.desc || voucher?.description || '').trim();
  const parts = [minOrder > 0 ? `Đơn từ ${formatCurrencyFn(minOrder)}` : 'Áp dụng mọi đơn'];
  if (isPercent && maxDiscount) {
    parts.push(`Tối đa ${formatCurrencyFn(maxDiscount)}`);
  }
  if (voucher?.excludeSaleItems) {
    parts.push('Không áp dụng hàng Flash Sale');
  }

  const conditionText = customDesc || parts.join(' • ');
  const nameText = String(voucher?.name || voucher?.title || `Ưu đãi ${voucher?.code || ''}`).trim();

  return {
    discountType,
    discountValue,
    isPercent,
    minOrder,
    maxDiscount,
    badgeText,
    shortTag,
    conditionText,
    nameText
  };
}

/**
 * Xac dinh don hang SePay dang cho chuyen khoan (chua thanh toan thanh cong).
 * @param {object} order - Doi tuong don hang
 * @returns {boolean} True neu la don SePay va chua thanh toan
 */
export function isUnpaidSepayOrder(order) {
  if (!order) return false;
  const method = String(order.paymentMethod || order.payment_method || '').toLowerCase();
  const payStatus = String(order.paymentStatus || order.payment_status || 'pending').toLowerCase();
  return method === 'sepay' && !['paid', 'partially_refunded', 'refunded'].includes(payStatus);
}

/**
 * Xac dinh don hang da thu tien thanh cong hay chua (tach biet SePay paid va COD completed, loai tru da hoan tien).
 * @param {object} order - Doi tuong don hang
 * @returns {boolean} True neu don da thanh toan va chua bi hoan tien
 */
export function isOrderPaid(order) {
  if (!order || order.status === 'cancelled') return false;
  const method = String(order.paymentMethod || order.payment_method || 'cod').toLowerCase();
  const payStatus = String(order.paymentStatus || order.payment_status || 'pending').toLowerCase();
  if (payStatus === 'refunded') return false;
  if (payStatus === 'paid' || payStatus === 'partially_refunded') return true;
  return method !== 'sepay' && order.status === 'completed';
}

/**
 * Kiem tra don hang co can hoan tien hoac dang cho duyet hoan tien hay khong.
 * Gom ca don huy da thanh toan, don SePay chuyen khoan muon vao don huy, va don co phieu pending_approval.
 */
export function orderNeedsRefund(order) {
  if (!order) return false;
  const payStatus = String(order.paymentStatus || order.payment_status || 'pending').toLowerCase();
  if (payStatus === 'refunded') return false;
  const refunds = Array.isArray(order.refundRequests) ? order.refundRequests : [];
  if (refunds.some(r => r.status === 'approved')) return false;
  if (refunds.some(r => r.status === 'pending_approval')) return true;

  const hasTx = Array.isArray(order.paymentTransactions) && order.paymentTransactions.length > 0;
  return order.status === 'cancelled' && (payStatus === 'paid' || hasTx);
}

/**
 * Kiem tra don hang co duoc tinh vao doanh thu ghi nhan (IFRS 15) hay khong.
 * Chi tinh don da hoan thanh ('completed'), chua hoan tien va loai bo don huy / SePay chua thanh toan.
 * @param {object} order - Doi tuong don hang
 * @returns {boolean} True neu hop le ghi nhan doanh thu
 */
export function isRevenueRecognizedOrder(order) {
  if (!order) return false;
  const payStatus = String(order.paymentStatus || order.payment_status || 'pending').toLowerCase();
  if (payStatus === 'refunded') return false;
  return order.status === 'completed' && !isUnpaidSepayOrder(order);
}

/**
 * Kiem tra don hang co duoc tinh vao Doanh so dat hang (GMV) hay khong (don hop le khong huy, khong hoan tien).
 */
export function isGmvOrder(order) {
  if (!order) return false;
  const payStatus = String(order.paymentStatus || order.payment_status || 'pending').toLowerCase();
  return order.status !== 'cancelled' && payStatus !== 'refunded';
}

/**
 * Chuyen Date/ISO string sang khoa ngay YYYY-MM-DD theo gio dia phuong.
 */
export function toLocalDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalBoundary(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, m, d] = dateStr.trim().split('-').map(Number);
    return endOfDay
      ? new Date(y, m - 1, d, 23, 59, 59, 999)
      : new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return null;
  if (endOfDay) dt.setHours(23, 59, 59, 999);
  else dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * Loc danh sach don hang theo khoang ngay [fromDate, toDate] theo gio dia phuong.
 */
export function filterOrdersByDateRange(orders = [], fromDate, toDate) {
  const start = parseLocalBoundary(fromDate, false);
  const end = parseLocalBoundary(toDate, true);
  return (orders || []).filter(o => {
    const rawDate = o?.createdAt || o?.created_at;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function getOrderTotalAmount(order) {
  return Number(order?.totalAmount ?? order?.total_amount ?? order?.finalTotal ?? order?.subtotal ?? 0);
}

/**
 * Tinh gia von cua danh sach don hang da ghi nhan doanh thu.
 * Uu tien 1: Gia von snapshot thoi diem dat hang (item.costPrice / item.cost_price tren dong don hang).
 * Uu tien 2: Gia von hien tai trong danh muc (fallback cho don cu chua co snapshot).
 * Uu tien 3: Gia dinh 65% neu hoan toan chua co gia von.
 */
export function calculateOrdersCost(recognizedOrders = [], products = []) {
  const prodCostMap = new Map();
  if (Array.isArray(products)) {
    products.forEach(p => {
      if (p) prodCostMap.set(String(p.id), Number(p.costPrice ?? p.cost_price ?? 0));
    });
  }

  return recognizedOrders.reduce((totalCost, order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      return totalCost + Math.round(getOrderTotalAmount(order) * ORDER_COST_RATIO);
    }
    const itemsCost = items.reduce((sum, item) => {
      const pid = String(item.productId || item.product_id || item.id || '');
      // Uu tien snapshot lich su tai dong don hang truoc
      const historicalCost = Number(item.costPrice ?? item.cost_price ?? 0);
      const catalogCost = prodCostMap.get(pid) || 0;
      const unitCost = historicalCost > 0 ? historicalCost : catalogCost;
      const qty = Number(item.quantity || 1);
      if (unitCost > 0) return sum + unitCost * qty;
      const linePrice = Number(item.unitPrice ?? item.price ?? 0) * qty;
      return sum + Math.round(linePrice * ORDER_COST_RATIO);
    }, 0);
    return totalCost + itemsCost;
  }, 0);
}

function buildPeriodBucket(label, bucketOrders, products = [], extra = {}) {
  const gmvOrders = (bucketOrders || []).filter(isGmvOrder);
  const recognizedOrders = (bucketOrders || []).filter(isRevenueRecognizedOrder);
  const refundedOrders = (bucketOrders || []).filter(
    o => String(o?.paymentStatus || o?.payment_status || '').toLowerCase() === 'refunded'
  );

  const gmv = gmvOrders.reduce((sum, o) => sum + getOrderTotalAmount(o), 0);
  const revenue = recognizedOrders.reduce((sum, o) => {
    const rawTotal = getOrderTotalAmount(o);
    const refunds = Array.isArray(o.refundRequests) ? o.refundRequests : [];
    const approvedRefund = refunds.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0);
    return sum + Math.max(0, rawTotal - approvedRefund);
  }, 0);
  const refundedAmount = (bucketOrders || []).reduce((sum, o) => {
    const refunds = Array.isArray(o.refundRequests) ? o.refundRequests : [];
    const approvedRefund = refunds.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0);
    if (approvedRefund > 0) return sum + approvedRefund;
    if (String(o?.paymentStatus || o?.payment_status || '').toLowerCase() === 'refunded') {
      return sum + getOrderTotalAmount(o);
    }
    return sum;
  }, 0);
  const cost = calculateOrdersCost(recognizedOrders, products);
  const profit = revenue - cost;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return {
    label,
    gmvOrderCount: gmvOrders.length,
    gmv,
    orderCount: recognizedOrders.length,
    revenue,
    refundedAmount,
    cost,
    profit,
    margin,
    ...extra
  };
}

/**
 * Thong ke doanh so & doanh thu theo TUNG NGAY lien tiep trong khoang [fromDate, toDate] ("ngay nao ra ngay do").
 */
export function calculateDailyRevenueStats(orders = [], fromDate, toDate, { products = [] } = {}) {
  const start = parseLocalBoundary(fromDate, false) || parseLocalBoundary(toLocalDateKey(new Date()), false);
  const end = parseLocalBoundary(toDate, false) || new Date(start);
  if (end < start) return [];

  // Map don theo YYYY-MM-DD
  const byDay = new Map();
  (orders || []).forEach(o => {
    const key = toLocalDateKey(o?.createdAt || o?.created_at);
    if (!key) return;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(o);
  });

  const result = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const limitEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let guard = 0;

  while (cursor <= limitEnd && guard < 366) {
    const key = toLocalDateKey(cursor);
    const dd = String(cursor.getDate()).padStart(2, '0');
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    const yyyy = cursor.getFullYear();
    const dayOrders = byDay.get(key) || [];
    result.push(buildPeriodBucket(`${dd}/${mm}/${yyyy}`, dayOrders, products, {
      dateKey: key,
      shortLabel: `${dd}/${mm}`
    }));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return result;
}

/**
 * Thong ke doanh so & doanh thu theo TUNG NAM ("nam nao ra nam do").
 */
export function calculateYearlyRevenueStats(orders = [], { products = [] } = {}) {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([currentYear]);

  (orders || []).forEach(o => {
    const rawDate = o?.createdAt || o?.created_at;
    if (!rawDate) return;
    const y = new Date(rawDate).getFullYear();
    if (Number.isFinite(y)) yearsSet.add(y);
  });

  const years = [...yearsSet].sort((a, b) => a - b);
  return years.map(y => {
    const yearOrders = (orders || []).filter(o => {
      const rawDate = o?.createdAt || o?.created_at;
      return rawDate && new Date(rawDate).getFullYear() === y;
    });
    return buildPeriodBucket(`Năm ${y}`, yearOrders, products, {
      year: y,
      shortLabel: String(y)
    });
  });
}

/**
 * Tinh bao cao doanh so (GMV), doanh thu, gia von va loi nhuan rong theo Ngay / Thang / Quy / Nam.
 * @param {Array<object>} orders - Danh sach tat ca don hang
 * @param {'day'|'month'|'monthly'|'quarter'|'year'} periodType - Loai ky thong ke
 * @param {number|string} year - Nam can thong ke
 * @param {object} [options] - { fromDate, toDate, monthIndex, products }
 * @returns {Array<object>} Mang thong ke tung ky
 */
export function calculateRevenueStats(orders = [], periodType = 'month', year = new Date().getFullYear(), options = {}) {
  const { fromDate = '', toDate = '', monthIndex = null, products = [] } = options || {};

  if (periodType === 'day') {
    const todayKey = toLocalDateKey(new Date());
    return calculateDailyRevenueStats(orders, fromDate || todayKey, toDate || todayKey, { products });
  }

  if (periodType === 'year') {
    return calculateYearlyRevenueStats(orders, { products });
  }

  const targetYear = Number(year);
  const yearOrders = (orders || []).filter(o => {
    const rawDate = o?.createdAt || o?.created_at;
    if (!rawDate) return false;
    return new Date(rawDate).getFullYear() === targetYear;
  });

  if (periodType === 'quarter') {
    const quarters = [
      { label: `Quý 1 (Tháng 1 - 3 / ${targetYear})`, shortLabel: 'Q1', startMonth: 0, endMonth: 2 },
      { label: `Quý 2 (Tháng 4 - 6 / ${targetYear})`, shortLabel: 'Q2', startMonth: 3, endMonth: 5 },
      { label: `Quý 3 (Tháng 7 - 9 / ${targetYear})`, shortLabel: 'Q3', startMonth: 6, endMonth: 8 },
      { label: `Quý 4 (Tháng 10 - 12 / ${targetYear})`, shortLabel: 'Q4', startMonth: 9, endMonth: 11 }
    ];

    return quarters.map(q => {
      const qOrders = yearOrders.filter(o => {
        const m = new Date(o.createdAt || o.created_at).getMonth();
        return m >= q.startMonth && m <= q.endMonth;
      });
      return buildPeriodBucket(q.label, qOrders, products, { shortLabel: q.shortLabel });
    });
  }

  // Neu chon rieng 1 thang cu the (1..12) khi xem chi tiet thang -> tra dung tung ngay trong thang do
  if (monthIndex !== null && monthIndex !== undefined && monthIndex !== 'all' && Number(monthIndex) >= 1 && Number(monthIndex) <= 12) {
    const mIdx = Number(monthIndex) - 1;
    const firstDay = toLocalDateKey(new Date(targetYear, mIdx, 1));
    const lastDay = toLocalDateKey(new Date(targetYear, mIdx + 1, 0));
    return calculateDailyRevenueStats(orders, firstDay, lastDay, { products });
  }

  const monthlyStats = [];
  for (let m = 0; m < 12; m++) {
    const monthOrders = yearOrders.filter(o => new Date(o.createdAt || o.created_at).getMonth() === m);
    monthlyStats.push(buildPeriodBucket(`Tháng ${m + 1} / ${targetYear}`, monthOrders, products, {
      month: m + 1,
      shortLabel: `T${m + 1}`
    }));
  }
  return monthlyStats;
}

/**
 * Tong hop nhanh 3 moc Ngay / Thang / Nam doc lap + so sanh Hom nay vs Hom qua.
 */
export function getDayMonthYearSummary(orders = [], nowInput = new Date()) {
  const now = new Date(nowInput);
  const todayKey = toLocalDateKey(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterdayDate);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const summarize = (list) => {
    const gmvList = list.filter(isGmvOrder);
    const revList = list.filter(isRevenueRecognizedOrder);
    return {
      totalOrders: list.length,
      gmvOrderCount: gmvList.length,
      gmv: gmvList.reduce((s, o) => s + getOrderTotalAmount(o), 0),
      orderCount: revList.length,
      revenue: revList.reduce((s, o) => s + getOrderTotalAmount(o), 0)
    };
  };

  const todayOrders = (orders || []).filter(o => toLocalDateKey(o?.createdAt || o?.created_at) === todayKey);
  const yesterdayOrders = (orders || []).filter(o => toLocalDateKey(o?.createdAt || o?.created_at) === yesterdayKey);
  const monthOrders = (orders || []).filter(o => {
    const d = new Date(o?.createdAt || o?.created_at);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const yearOrders = (orders || []).filter(o => {
    const d = new Date(o?.createdAt || o?.created_at);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === currentYear;
  });

  const today = summarize(todayOrders);
  const yesterday = summarize(yesterdayOrders);
  const month = summarize(monthOrders);
  const year = summarize(yearOrders);

  let gmvGrowthPercent = null;
  if (yesterday.gmv > 0) {
    gmvGrowthPercent = Math.round(((today.gmv - yesterday.gmv) / yesterday.gmv) * 100);
  } else if (today.gmv > 0) {
    gmvGrowthPercent = 100;
  }

  let revenueGrowthPercent = null;
  if (yesterday.revenue > 0) {
    revenueGrowthPercent = Math.round(((today.revenue - yesterday.revenue) / yesterday.revenue) * 100);
  } else if (today.revenue > 0) {
    revenueGrowthPercent = 100;
  }

  return {
    today: { ...today, dateKey: todayKey, label: `${String(now.getDate()).padStart(2, '0')}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}` },
    yesterday: { ...yesterday, dateKey: yesterdayKey },
    month: { ...month, label: `Tháng ${currentMonth + 1}/${currentYear}` },
    year: { ...year, label: `Năm ${currentYear}` },
    gmvGrowthPercent,
    revenueGrowthPercent
  };
}

/**
 * Thong ke Hoat dong Hom Nay & Dem Trang Thai Van Hanh cho Tab 1 Dashboard.
 */
export function getTodayVsYesterdaySummary(orders = [], nowInput = new Date()) {
  const dmy = getDayMonthYearSummary(orders, nowInput);
  const pendingReadyCount = (orders || []).filter(o => o.status === 'pending' && !isUnpaidSepayOrder(o)).length;
  const unpaidSepayCount = (orders || []).filter(o => o.status === 'pending' && isUnpaidSepayOrder(o)).length;
  const confirmedCount = (orders || []).filter(o => o.status === 'confirmed').length;
  const shippingCount = (orders || []).filter(o => o.status === 'shipping').length;
  const completedCount = (orders || []).filter(o => o.status === 'completed').length;
  const cancelledCount = (orders || []).filter(o => o.status === 'cancelled').length;
  const refundPendingCount = (orders || []).filter(orderNeedsRefund).length;
  const refundedCount = (orders || []).filter(o => String(o.paymentStatus || o.payment_status || '').toLowerCase() === 'refunded').length;

  return {
    ...dmy,
    statusCounts: {
      pendingReadyCount,
      unpaidSepayCount,
      confirmedCount,
      shippingCount,
      completedCount,
      cancelledCount,
      refundPendingCount,
      refundedCount
    }
  };
}

/**
 * Tinh gia tri quy doi tung dong san pham trong don hang theo ty le thuc thu (sau giam gia voucher).
 */
function allocateOrderItemRevenues(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) return [];

  const lineTotals = items.map(item => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    const addonsSum = Array.isArray(item.addons)
      ? item.addons.reduce((s, a) => s + Number(a.price ?? a.unitPrice ?? 0), 0)
      : 0;
    return Math.max(0, (unitPrice + addonsSum) * qty);
  });

  const rawSum = lineTotals.reduce((s, v) => s + v, 0);
  const orderTotal = getOrderTotalAmount(order);

  if (rawSum <= 0) {
    return items.map((_, i) => (i === 0 ? orderTotal : 0));
  }

  const allocated = lineTotals.map(lt => Math.round((lt / rawSum) * orderTotal));
  const diff = orderTotal - allocated.reduce((s, v) => s + v, 0);
  if (diff !== 0 && allocated.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < allocated.length; i++) {
      if (allocated[i] > allocated[maxIdx]) maxIdx = i;
    }
    allocated[maxIdx] += diff;
  }
  return allocated;
}

/**
 * Thong ke chi tiet TUNG MAT HANG trong khoang thoi gian:
 * So luong Chua giao (pending+confirmed), Dang giao (shipping), Da giao (completed hop le), Da huy,
 * Doanh thu trong ky/thang cua mat hang do, va Ton kho hien tai.
 */
export function aggregateProductDeliveryAndRevenue(orders = [], products = [], categories = [], { fromDate = '', toDate = '' } = {}) {
  const scopedOrders = (fromDate || toDate) ? filterOrdersByDateRange(orders, fromDate, toDate) : (orders || []);
  const catNameById = new Map((categories || []).map(c => [String(c.id), c.name]));
  const productById = new Map((products || []).map(p => [String(p.id), p]));

  const statsMap = new Map();

  // Khoi tao cho toan bo san pham hien co de mat hang nao chua phat sinh don van quan sat duoc
  (products || []).forEach(p => {
    if (!p) return;
    statsMap.set(String(p.id), {
      productId: String(p.id),
      name: p.name,
      image: p.image || p.image_url || './images/300.png',
      categoryId: String(p.categoryId ?? p.category_id ?? ''),
      categoryName: p.categoryName || catNameById.get(String(p.categoryId ?? p.category_id ?? '')) || 'Hoa Kẽm Nhung',
      price: Number(p.price || 0),
      stock: Number(p.stock || 0),
      undeliveredQty: 0,
      shippingQty: 0,
      deliveredQty: 0,
      cancelledQty: 0,
      deliveredRevenue: 0,
      pipelineValue: 0
    });
  });

  scopedOrders.forEach(order => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const itemRevs = allocateOrderItemRevenues(order);
    const recognized = isRevenueRecognizedOrder(order);
    const gmvValid = isGmvOrder(order);

    items.forEach((item, idx) => {
      const pid = String(item.productId || item.product_id || item.id || '');
      if (!pid) return;
      if (!statsMap.has(pid)) {
        const refProd = productById.get(pid);
        statsMap.set(pid, {
          productId: pid,
          name: item.productName || item.name || refProd?.name || `Mẫu hoa #${pid}`,
          image: item.imageUrl || item.image || refProd?.image || './images/300.png',
          categoryId: String(item.categoryId || refProd?.categoryId || ''),
          categoryName: catNameById.get(String(item.categoryId || refProd?.categoryId || '')) || 'Hoa Kẽm Nhung',
          price: Number(item.unitPrice ?? item.price ?? refProd?.price ?? 0),
          stock: Number(refProd?.stock ?? 0),
          undeliveredQty: 0,
          shippingQty: 0,
          deliveredQty: 0,
          cancelledQty: 0,
          deliveredRevenue: 0,
          pipelineValue: 0
        });
      }

      const entry = statsMap.get(pid);
      const qty = Number(item.quantity || 1);
      const allocatedRev = itemRevs[idx] || 0;

      if (order.status === 'cancelled' || String(order.paymentStatus || '').toLowerCase() === 'refunded') {
        entry.cancelledQty += qty;
      } else if (order.status === 'pending' || order.status === 'confirmed') {
        entry.undeliveredQty += qty;
        if (gmvValid) entry.pipelineValue += allocatedRev;
      } else if (order.status === 'shipping') {
        entry.shippingQty += qty;
        if (gmvValid) entry.pipelineValue += allocatedRev;
      } else if (recognized) {
        entry.deliveredQty += qty;
        entry.deliveredRevenue += allocatedRev;
      }
    });
  });

  return [...statsMap.values()].sort((a, b) => {
    if (b.deliveredRevenue !== a.deliveredRevenue) return b.deliveredRevenue - a.deliveredRevenue;
    if (b.deliveredQty !== a.deliveredQty) return b.deliveredQty - a.deliveredQty;
    return (b.shippingQty + b.undeliveredQty) - (a.shippingQty + a.undeliveredQty);
  });
}

/**
 * Phan bo doanh thu theo danh muc hoa khop 100% voi Tong Doanh Thu thuc nhan trong khoang ngay.
 */
export function calculateCategoryRevenueBreakdown(orders = [], products = [], categories = [], { fromDate = '', toDate = '' } = {}) {
  const scopedOrders = ((fromDate || toDate) ? filterOrdersByDateRange(orders, fromDate, toDate) : (orders || []))
    .filter(isRevenueRecognizedOrder);

  const productById = new Map((products || []).map(p => [String(p.id), p]));
  const catRevMap = {};
  (categories || []).forEach(c => { catRevMap[String(c.id)] = 0; });

  scopedOrders.forEach(order => {
    const items = Array.isArray(order.items) ? order.items : [];
    const allocated = allocateOrderItemRevenues(order);
    items.forEach((item, idx) => {
      const pid = String(item.productId || item.product_id || item.id || '');
      const prod = productById.get(pid);
      const catId = String(prod?.categoryId ?? item.categoryId ?? categories?.[0]?.id ?? '1');
      catRevMap[catId] = (catRevMap[catId] || 0) + (allocated[idx] || 0);
    });
  });

  const totalRev = Object.values(catRevMap).reduce((s, v) => s + v, 0);
  return (categories || []).map(cat => {
    const revenue = catRevMap[String(cat.id)] || 0;
    const percent = totalRev > 0 ? Math.round((revenue / totalRev) * 100) : 0;
    return {
      categoryId: String(cat.id),
      categoryName: cat.name,
      revenue,
      percent
    };
  });
}

/**
 * Chuan hoa du lieu nghiep vu cho chung tu PDF Hoa don / Bien nhan / Phieu don.
 * @param {object} order - Du lieu don hang
 * @param {object} options - { isReceipt }
 * @returns {object} Thong tin xac thuc in an, tieu de, dau moc va bang gia
 */
export function resolveInvoicePdfMeta(order, { isReceipt = false } = {}) {
  if (!order) {
    return { canExport: false, errorMessage: 'Không tìm thấy thông tin đơn hàng để in hóa đơn!' };
  }
  if (order.status === 'cancelled') {
    return { canExport: false, errorMessage: 'Đơn hàng đã hủy không được xuất hóa đơn bán hàng!' };
  }
  if (String(order.paymentStatus || order.payment_status || '').toLowerCase() === 'refunded') {
    return { canExport: false, errorMessage: 'Đơn hàng đã hoàn tiền không được xuất hóa đơn bán hàng!' };
  }

  const orderCode = String(order.orderCode || order.order_code || order.id || 'DH-TEMP');
  const isSepay = String(order.paymentMethod || order.payment_method || 'cod').toLowerCase() === 'sepay';
  const paid = isOrderPaid(order);
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const shippingFee = Number(order.shippingFee ?? order.shipping_fee ?? 0);
  const discountAmount = Number(order.discountAmount ?? order.discount_amount ?? 0);
  const computedFallbackTotal = Math.max(0, subtotal - discountAmount) + shippingFee;
  const totalAmount = Number(order.totalAmount ?? order.total_amount ?? order.finalTotal ?? computedFallbackTotal);

  const docKind = !paid ? 'order_slip' : (isReceipt ? 'receipt' : 'invoice');
  const titleText = docKind === 'receipt'
    ? 'BIEN NHAN THANH TOAN DIEN TU (E-RECEIPT)'
    : (docKind === 'invoice' ? 'HOA DON BAN LE DIEN TU (E-INVOICE)' : 'PHIEU DON HANG (CHUA THANH TOAN)');

  const formatMoney = (val) => `${Number(val || 0).toLocaleString('vi-VN')} VND`;
  const txList = Array.isArray(order.paymentTransactions) ? order.paymentTransactions : [];
  const rawTxCode = txList[0]?.providerTxId || txList[0]?.provider_tx_id || order.sepayTransaction?.code || orderCode;

  let stamp;
  if (paid && isSepay) {
    stamp = {
      paid: true,
      badge: '[ DA THANH TOAN / PAID ]',
      line1: 'Cong SePay VietQR (Napas 247)',
      line2: `Ma GD: ${rawTxCode}`
    };
  } else if (paid) {
    stamp = {
      paid: true,
      badge: '[ DA THANH TOAN / PAID ]',
      line1: 'Thanh toan tien mat (COD)',
      line2: 'Don da hoan tat thu ho'
    };
  } else if (isSepay) {
    stamp = {
      paid: false,
      badge: '[ CHO CHUYEN KHOAN SEPAY ]',
      line1: 'Quet ma VietQR de thanh toan',
      line2: `So tien: ${formatMoney(totalAmount)}`
    };
  } else {
    stamp = {
      paid: false,
      badge: '[ CHO THU TIEN (COD) ]',
      line1: 'Thu tien mat khi giao hoa',
      line2: `Can thu: ${formatMoney(totalAmount)}`
    };
  }

  return {
    canExport: true,
    orderCode,
    isSepay,
    isPaid: paid,
    docKind,
    titleText,
    paymentMethodLabel: isSepay ? 'Chuyen khoan SePay (VietQR)' : 'Thanh toan khi nhan (COD)',
    stamp,
    totals: {
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount
    }
  };
}

/**
 * Trích xuất và chuẩn hóa thông tin cho Phiếu Giao Quà Tặng (Gift Delivery Slip).
 * Dành riêng cho người nhận hoa: Tuyệt đối KHÔNG hiển thị giá tiền, số tiền thanh toán.
 * Nếu đơn hàng được đặt ở chế độ Quà tặng bí mật (isAnonymous), tên và SĐT người gửi được ẩn giấu hoàn toàn.
 *
 * @param {object} order Đối tượng đơn hàng
 * @returns {object} Thông tin hiển thị phiếu giao quà tặng
 */
export function resolveGiftDeliverySlipMeta(order) {
  if (!order) {
    return { canExport: false, errorMessage: 'Không tìm thấy thông tin đơn hàng để in phiếu giao quà tặng!' };
  }
  if (order.status === 'cancelled') {
    return { canExport: false, errorMessage: 'Đơn hàng đã hủy không được in phiếu giao quà tặng!' };
  }

  const orderCode = String(order.orderCode || order.order_code || order.id || 'DH-TEMP');
  const isAnonymous = Boolean(order.isAnonymous || order.is_anonymous);
  const deliveryDate = order.deliveryDate || order.delivery_date || 'Giao ngay trong ngày';
  const deliverySlot = order.deliverySlot || order.delivery_slot || 'Khung giờ tiêu chuẩn';

  const recipientName = order.recipientName || order.customerName || 'Người nhận hoa';
  const recipientPhone = order.recipientPhone || order.phone || order.customerPhone || '---';
  const address = order.address || order.shippingAddress || 'Nhận tại quầy';

  // Nếu là quà bí mật: Ẩn thông tin cá nhân của người gửi
  const senderName = isAnonymous
    ? 'Một người bạn bí mật giấu tên 🎁'
    : (order.customerName || 'Người gửi tặng');
  const senderPhone = isAnonymous
    ? '*** (Đã ẩn theo yêu cầu người gửi)'
    : (order.customerPhone || order.phone || '---');

  const cardMessage = order.cardMessage || order.card_message || '';
  const hasGreetingCard = Boolean(order.hasGreetingCard || cardMessage);

  const items = (Array.isArray(order.items) ? order.items : []).map(item => {
    const qty = Number(item.quantity) || 1;
    const name = item.name || item.productName || 'Mẫu hoa kẽm nhung thủ công';
    const addons = item.addonsText || (Array.isArray(item.addons) && item.addons.length > 0
      ? item.addons.map(a => a.name).join(', ')
      : '');
    return {
      name,
      quantity: qty,
      addons
    };
  });

  return {
    canExport: true,
    orderCode,
    isAnonymous,
    deliveryDate,
    deliverySlot,
    recipientName,
    recipientPhone,
    address,
    senderName,
    senderPhone,
    cardMessage,
    hasGreetingCard,
    items,
    titleText: 'PHIẾU GIAO QUÀ TẶNG (GIFT DELIVERY SLIP)',
    wishMessage: 'Chúc bạn một ngày ngập tràn niềm vui, ngọt ngào và hạnh phúc!'
  };
}


