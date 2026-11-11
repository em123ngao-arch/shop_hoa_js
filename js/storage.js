import api, { authApi, avatarApi, notificationApi, reviewApi, wishlistApi, orderApi } from './api.js';

/**
 * storage.js - Quản lý nạp dữ liệu và lưu trữ (Dual-tier: json-server + localStorage)
 * Thực hiện đúng theo hướng dẫn tại lythuyet.js và app.js của Giáo viên
 */

const STORAGE_KEYS = {
  PRODUCTS: 'SHOP_HOA_PRODUCTS',
  CATEGORIES: 'SHOP_HOA_CATEGORIES',
  CART: 'SHOP_HOA_CART',
  BANNERS: 'SHOP_HOA_BANNERS_V4',
  PROMOTIONS: 'SHOP_HOA_PROMOTIONS',
  APPLIED_VOUCHER: 'SHOP_HOA_APPLIED_VOUCHER',
  ORDERS: 'SHOP_HOA_ORDERS',
  ACTIVE_THEME: 'SHOP_HOA_ACTIVE_THEME',
  REVIEWS: 'SHOP_HOA_REVIEWS',
  NOTIFICATIONS: 'SHOP_HOA_NOTIFICATIONS',
  WISHLIST_PREFIX: 'SHOP_HOA_WISHLIST_'
};

// Dữ liệu khuyến mãi & Voucher mẫu dự phòng cho SHOP-07 & Đồ án Phân Cấp Giảm Giá
const DEFAULT_PROMOTIONS = [
  {
    id: "promo-kemnhung15",
    code: "KEMNHUNG15",
    name: "Tri Ân Tín Đồ Hoa Kẽm Nhung",
    discountType: "percent",
    discountValue: 15,
    maxDiscount: 100000,
    scope: "category",
    targetCategoryIds: ["1"],
    targetProductIds: [],
    minOrder: 200000,
    excludeSaleItems: false,
    startDate: "2026-01-01",
    endDate: "2027-12-31",
    usageLimit: 100,
    usedCount: 14,
    desc: "Giảm 15% tối đa 100.000đ cho danh mục Hoa Kẽm Nhung (đơn từ 200k)",
    active: true
  },
  {
    id: "promo-new",
    code: "CHAO2026",
    name: "Ưu Đãi Khách Hàng Mới",
    discountType: "fixed",
    discountValue: 30000,
    maxDiscount: null,
    scope: "all",
    targetCategoryIds: [],
    targetProductIds: [],
    minOrder: 200000,
    excludeSaleItems: false,
    startDate: "2026-01-01",
    endDate: "2027-12-31",
    usageLimit: 200,
    usedCount: 45,
    desc: "Giảm trực tiếp 30.000đ cho đơn hàng từ 200.000đ",
    active: true
  },
  {
    id: "promo-birthday",
    code: "SINHNHATVUI",
    name: "Quà Tặng Sinh Nhật Khách Yêu",
    discountType: "percent",
    discountValue: 20,
    maxDiscount: 150000,
    scope: "category",
    targetCategoryIds: ["2"],
    targetProductIds: [],
    minOrder: 0,
    excludeSaleItems: false,
    startDate: "2026-01-01",
    endDate: "2027-12-31",
    usageLimit: 1000,
    usedCount: 89,
    desc: "Giảm 20% tối đa 150.000đ cho Bó Hoa Sinh Nhật",
    active: true
  },
  {
    id: "promo-flash",
    code: "SALE15",
    name: "Flash Sale Giờ Vàng",
    discountType: "percent",
    discountValue: 15,
    maxDiscount: 80000,
    scope: "all",
    targetCategoryIds: [],
    targetProductIds: [],
    minOrder: 350000,
    excludeSaleItems: true,
    startDate: "2026-01-01",
    endDate: "2027-12-31",
    usageLimit: 50,
    usedCount: 12,
    desc: "Giảm 15% tối đa 80k đơn từ 350k (Không áp dụng cho hàng đang giảm giá)",
    active: true
  }
];

// Dữ liệu banner mẫu dự phòng cho Hero Slider
const DEFAULT_BANNERS = [
  {
    id: "5",
    tenbanner: "Hộp Hoa Kẽm Nhung Khai Xuân Đắc Lộc - Tết 2027",
    tag: "Khai Xuân Đắc Lộc 2027",
    title: "Khai Xuân Đắc Lộc <br>Vạn Sự Cát Tường 2027",
    desc: "Hộp hoa kẽm nhung phối sắc đỏ vàng may mắn, hoa mai phú quý cùng mèo thần tài chiêu tài đón lộc. Món quà trao gửi trọn vẹn lời chúc Bình An và Thịnh Vượng cho năm mới 2027.",
    hinhbanner: "./images/Lunar New Year Blossom Bouquet.png",
    link: "#products",
    ctaText: "Sắm Hoa Đón Tết 2027",
    active: true,
    order: 1,
    theme: "tet"
  },
  {
    id: "1",
    tenbanner: "Bộ Sưu Tập Hoa Kẽm Nhung Mùa Xuân 2026",
    tag: "Tinh Hoa Nghệ Thuật Handmade",
    title: "Trao Gửi Yêu Thương <br>Bền Đẹp Theo Năm Tháng",
    desc: "Từng cành hoa được uốn nắn thủ công 100% từ sợi kẽm nhung cao cấp mềm mịn, giữ trọn vẻ tươi tắn vĩnh cửu. Món quà sinh nhật và kỷ niệm ý nghĩa nhất.",
    hinhbanner: "./images/350.png",
    link: "#products",
    ctaText: "Khám Phá Các Mẫu Hoa",
    active: true,
    order: 2,
    theme: "default"
  },
  {
    id: "2",
    tenbanner: "Bó Hoa Khai Trương Tinh Tế Pastel - Giảm 15%",
    tag: "Ưu Đãi Giờ Vàng",
    title: "Khai Trương Hồng Phát <br>Tài Lộc Thịnh Vượng",
    desc: "Bó hoa tulip phối sắc cam vàng rực rỡ tượng trưng cho nhiệt huyết và thịnh vượng, món quà tinh tế gửi trọn lời chúc may mắn phát tài.",
    hinhbanner: "./images/300.png",
    link: "#products",
    ctaText: "Săn Ưu Đãi Ngay",
    active: true,
    order: 3,
    theme: "sale"
  },
  {
    id: "4",
    tenbanner: "Bộ Sưu Tập Lễ Tình Nhân Sweet Valentine",
    tag: "Mùa Yêu Thương Lãng Mạn",
    title: "Gửi Trọn Tình Yêu <br>Hoa Nhung Vĩnh Cửu",
    desc: "Bó hoa hồng kẽm nhung cánh sen ngọt ngào cùng thiệp chúc mừng viết tay thủ công, thay vạn lời muốn nói gửi đến người thương trong dịp Valentine.",
    hinhbanner: "./images/500k.png",
    link: "#products",
    ctaText: "Khám Phá Mẫu Hoa Tình Yêu",
    active: true,
    order: 4,
    theme: "valentine"
  },
  {
    id: "3",
    tenbanner: "Hoa Để Bàn Mini & Quà Tặng Sinh Nhật",
    tag: "Quà Tặng Sinh Nhật Ý Nghĩa",
    title: "Sắc Màu Ngọt Ngào <br>Lưu Giữ Khoảnh Khắc",
    desc: "Chậu hoa kẽm nhung nhỏ gọn tinh xảo, phối nơ ren thủ công, mang sắc thái tối giản thanh lịch phù hợp cho bàn làm việc và góc học tập.",
    hinhbanner: "./images/350k.jpg",
    link: "#products",
    ctaText: "Xem Mẫu Bán Chạy",
    active: false,
    order: 5,
    theme: "default"
  }
];

// Dữ liệu đơn hàng mẫu phục vụ thống kê KPI cho Admin Dashboard
const DEFAULT_ORDERS = [
  {
    id: "DH-1001",
    customerName: "Nguyễn Thị Mai",
    phone: "0901234567",
    address: "14 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
    note: "Giao trước 10h sáng giúp mình nhé",
    items: [
      {
        id: 1,
        name: "Bó Hoa Kẽm Nhung Tulip Pastel",
        price: 300000,
        quantity: 2,
        image: "./images/300.png"
      }
    ],
    subtotal: 600000,
    discountAmount: 60000,
    totalAmount: 540000,
    status: "completed",
    paymentMethod: "sepay",
    paymentStatus: "paid",
    hasGreetingCard: true,
    sepayTransaction: {
      bank: "MBBank",
      account: "0901234567",
      amount: 540000,
      code: "SEPAY-DH1001",
      paidAt: "2026-10-12T09:32:00.000Z"
    },
    createdAt: "2026-10-12T09:30:00.000Z"
  },
  {
    id: "DH-1002",
    customerName: "Trần Văn Nam",
    phone: "0987654321",
    address: "25 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
    note: "Gọi trước khi giao 15 phút",
    items: [
      {
        id: 6,
        name: "Bó Hoa Baby Kẽm Nhung Xanh Biển",
        price: 390000,
        quantity: 1,
        image: "./images/baby-xanh-bien.png"
      }
    ],
    subtotal: 390000,
    discountAmount: 0,
    totalAmount: 390000,
    status: "shipping",
    paymentMethod: "cod",
    paymentStatus: "pending",
    hasGreetingCard: false,
    createdAt: "2026-10-14T14:15:00.000Z"
  },
  {
    id: "DH-1003",
    customerName: "Lê Thu Trang",
    phone: "0912345678",
    address: "88 Lý Tự Trọng, Phường Bến Thành, Quận 1, TP.HCM",
    note: "Kèm thiệp chúc mừng sinh nhật giúp em",
    items: [
      {
        id: 9,
        name: "Hộp Hoa Kẽm Nhung Trái Tim Sweet Love",
        price: 500000,
        quantity: 1,
        image: "./images/500k.png"
      }
    ],
    subtotal: 500000,
    discountAmount: 100000,
    totalAmount: 400000,
    status: "pending",
    paymentMethod: "sepay",
    paymentStatus: "paid",
    hasGreetingCard: true,
    sepayTransaction: {
      bank: "MBBank",
      account: "0901234567",
      amount: 400000,
      code: "SEPAY-DH1003",
      paidAt: "2026-10-15T08:48:00.000Z"
    },
    createdAt: "2026-10-15T08:45:00.000Z"
  }
];

// Dữ liệu mẫu dự phòng ban đầu (16 sản phẩm hoa) đảm bảo luôn đủ ít nhất 15 SP
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Bó Hoa Kẽm Nhung Tulip Pastel",
    price: 300000,
    originalPrice: 350000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/300.png",
    rating: 5,
    reviewCount: 42,
    description: "Bó hoa tulip handmade từ sợi kẽm nhung cao cấp mềm mịn, màu sắc pastel thanh lịch, độ bền vĩnh cửu theo thời gian. Món quà hoàn hảo cho ngày sinh nhật và kỷ niệm.",
    stock: 25,
    soldCount: 68,
    featured: true,
    badge: "Handmade"
  },
  {
    id: 2,
    name: "Bó Hoa Hồng Kẽm Nhung Sunset",
    price: 350000,
    originalPrice: 420000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/350.png",
    rating: 5,
    reviewCount: 35,
    description: "Sắc cam hoàng hôn rực rỡ tượng trưng cho nhiệt huyết và tình cảm nồng ấm. Từng cánh hoa được uốn tỉ mỉ bằng kẽm nhung mềm cao cấp.",
    stock: 18,
    soldCount: 54,
    featured: true,
    badge: "Bán chạy"
  },
  {
    id: 3,
    name: "Bó Hoa Kẽm Nhung Hướng Dương Rực Rỡ",
    price: 350000,
    originalPrice: 390000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/350k.jpg",
    rating: 5,
    reviewCount: 29,
    description: "Những đóa hướng dương kẽm nhung bung nở tràn đầy năng lượng tích cực, luôn hướng về phía mặt trời. Món quà tốt nghiệp và chúc mừng ý nghĩa.",
    stock: 15,
    soldCount: 47,
    featured: true,
    badge: "Yêu thích"
  },
  {
    id: 4,
    name: "Bó Hoa Tulip Hồng Phấn Mộng Mơ",
    price: 399000,
    originalPrice: 450000,
    categoryId: 2,
    categoryName: "Bó Hoa Sinh Nhật",
    categorySlug: "sinh-nhat",
    image: "./images/399.png",
    rating: 5,
    reviewCount: 51,
    description: "Bó hoa phối sắc hồng phấn ngọt ngào và tinh khôi, gói giấy lụa Hàn Quốc cao cấp kèm nơ ruy băng sang trọng.",
    stock: 20,
    soldCount: 83,
    featured: true,
    badge: "-12%"
  },
  {
    id: 5,
    name: "Giỏ Hoa Kẽm Nhung Garden Sunshine",
    price: 402000,
    originalPrice: 480000,
    categoryId: 3,
    categoryName: "Giỏ & Hộp Hoa",
    categorySlug: "gio-hop-hoa",
    image: "./images/402.png",
    rating: 5,
    reviewCount: 19,
    description: "Giỏ hoa cắm phối tự nhiên phong cách vườn châu Âu, kết hợp giữa hoa tulip và cúc họa mi kẽm nhung handmade bền màu.",
    stock: 12,
    soldCount: 31,
    featured: false,
    badge: "Mới"
  },
  {
    id: 6,
    name: "Bó Hoa Baby Kẽm Nhung Xanh Biển",
    price: 450000,
    originalPrice: 520000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/baby-xanh-bien.png",
    rating: 5,
    reviewCount: 27,
    description: "Tông xanh biển pastel dịu mát mang lại cảm giác bình yên, tươi mới. Hoa handmade uốn cánh bền chắc, giữ nguyên dáng vẻ theo năm tháng.",
    stock: 14,
    soldCount: 39,
    featured: true,
    badge: "Handmade"
  },
  {
    id: 7,
    name: "Bó Hoa Kẽm Nhung Cúc Họa Mi Tinh Khôi",
    price: 450000,
    originalPrice: 500000,
    categoryId: 2,
    categoryName: "Bó Hoa Sinh Nhật",
    categorySlug: "sinh-nhat",
    image: "./images/450k.png",
    rating: 5,
    reviewCount: 44,
    description: "Cúc họa mi trắng nhị vàng mộc mạc và thuần khiết. Bó hoa thủ công đem lại nét đẹp giản dị nhưng đong đầy tình cảm.",
    stock: 22,
    soldCount: 61,
    featured: true,
    badge: "Bán chạy"
  },
  {
    id: 8,
    name: "Bó Hoa Kẽm Nhung Lavender Tím Huế",
    price: 499000,
    originalPrice: 560000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/499.jpg",
    rating: 5,
    reviewCount: 33,
    description: "Sắc tím thủy chung và lãng mạn của hoa oải hương, tạo hình từng nụ hoa nhỏ tinh tế từ sợi nhung mềm mịn.",
    stock: 16,
    soldCount: 45,
    featured: false,
    badge: "-11%"
  },
  {
    id: 9,
    name: "Hộp Hoa Kẽm Nhung Trái Tim Sweet Love",
    price: 500000,
    originalPrice: 590000,
    categoryId: 3,
    categoryName: "Giỏ & Hộp Hoa",
    categorySlug: "gio-hop-hoa",
    image: "./images/500k.png",
    rating: 5,
    reviewCount: 63,
    description: "Hộp hoa thiết kế cao cấp, bên trong xếp hoa hồng kẽm nhung đỏ nhung quý phái, phù hợp làm quà tặng tỏ tình và kỷ niệm ngày yêu.",
    stock: 10,
    soldCount: 92,
    featured: true,
    badge: "Hot"
  },
  {
    id: 10,
    name: "Bó Hoa Kẽm Nhung Đa Sắc Cầu Vồng",
    price: 501000,
    originalPrice: 580000,
    categoryId: 2,
    categoryName: "Bó Hoa Sinh Nhật",
    categorySlug: "sinh-nhat",
    image: "./images/501.png",
    rating: 5,
    reviewCount: 21,
    description: "Bản hòa ca của các sắc hoa tulip và hoa chuông rực rỡ, mang đến niềm vui trọn vẹn cho bữa tiệc sinh nhật của người thân yêu.",
    stock: 17,
    soldCount: 38,
    featured: false,
    badge: "Sáng tạo"
  },
  {
    id: 11,
    name: "Bình Hoa Kẽm Nhung Để Bàn Thanh Lịch",
    price: 503000,
    originalPrice: 580000,
    categoryId: 4,
    categoryName: "Hoa Để Bàn Mini",
    categorySlug: "de-ban",
    image: "./images/503.png",
    rating: 5,
    reviewCount: 18,
    description: "Bình hoa cắm sẵn dùng trang trí bàn làm việc, kệ sách hoặc góc phòng khách. Không cần tưới nước, luôn giữ được sắc thái tươi tắn.",
    stock: 20,
    soldCount: 29,
    featured: false,
    badge: "Trang trí"
  },
  {
    id: 12,
    name: "Bó Hoa Kẽm Nhung Hoàng Gia Queen",
    price: 550000,
    originalPrice: 650000,
    categoryId: 2,
    categoryName: "Bó Hoa Sinh Nhật",
    categorySlug: "sinh-nhat",
    image: "./images/550k.png",
    rating: 5,
    reviewCount: 39,
    description: "Bó hoa dáng lớn lộng lẫy, kết hợp hoa hồng kẽm nhung và cành lá phụ mềm mại, tôn vinh vẻ đẹp sang trọng và quý phái.",
    stock: 11,
    soldCount: 50,
    featured: true,
    badge: "-15%"
  },
  {
    id: 13,
    name: "Giỏ Hoa Kẽm Nhung Khai Trương Tài Lộc",
    price: 600000,
    originalPrice: 720000,
    categoryId: 5,
    categoryName: "Hoa Khai Trương",
    categorySlug: "khai-truong",
    image: "./images/600k.png",
    rating: 5,
    reviewCount: 24,
    description: "Giỏ hoa phối sắc vàng đỏ may mắn, đại diện cho tài lộc dồi dào, kinh doanh hồng phát. Tặng kèm banner chúc mừng in theo yêu cầu.",
    stock: 8,
    soldCount: 41,
    featured: true,
    badge: "May mắn"
  },
  {
    id: 14,
    name: "Bó Hoa Nghệ Thuật Bloom Of Spring",
    price: 450000,
    originalPrice: 520000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/bloom-of-spring.png",
    rating: 5,
    reviewCount: 47,
    description: "Tác phẩm thủ công lấy cảm hứng từ mùa xuân bừng nở, đường nét uốn cánh tinh xảo, màu sắc trang nhã hài hòa.",
    stock: 19,
    soldCount: 73,
    featured: true,
    badge: "Độc bản"
  },
  {
    id: 15,
    name: "Chậu Hoa Kẽm Nhung Mini Để Bàn Xinh",
    price: 280000,
    originalPrice: 320000,
    categoryId: 4,
    categoryName: "Hoa Để Bàn Mini",
    categorySlug: "de-ban",
    image: "./images/300.png",
    rating: 5,
    reviewCount: 31,
    description: "Chậu hoa nhỏ gọn xinh xắn uốn từ sợi kẽm nhung dày mịn, thích hợp làm quà tặng bạn bè, đồng nghiệp trang trí góc học tập.",
    stock: 30,
    soldCount: 65,
    featured: false,
    badge: "Mini"
  },
  {
    id: 16,
    name: "Bó Hoa Tulip Kẽm Nhung Trắng Sữa",
    price: 360000,
    originalPrice: 400000,
    categoryId: 1,
    categoryName: "Hoa Kẽm Nhung",
    categorySlug: "kem-nhung",
    image: "./images/350.png",
    rating: 5,
    reviewCount: 26,
    description: "Bó hoa tulip màu trắng sữa thuần khiết, mang phong cách tối giản thanh lịch, phối cùng nơ ren tinh tế.",
    stock: 15,
    soldCount: 38,
    featured: true,
    badge: "Thuần khiết"
  }
];

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Hoa Kẽm Nhung", slug: "kem-nhung" },
  { id: 2, name: "Bó Hoa Sinh Nhật", slug: "sinh-nhat" },
  { id: 3, name: "Giỏ & Hộp Hoa", slug: "gio-hop-hoa" },
  { id: 4, name: "Hoa Để Bàn Mini", slug: "de-ban" },
  { id: 5, name: "Hoa Khai Trương", slug: "khai-truong" }
];

/**
 * Lấy danh sách danh mục (Ưu tiên json-server, fallback localStorage)
 */
export async function fetchCategories() {
  try {
    const response = await api.get('/categories');
    if (response.data && response.data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(response.data));
      return response.data;
    }
  } catch (error) {
    console.warn('json-server chưa bật hoặc lỗi, tự động lấy danh mục từ localStorage/fallback.');
  }

  const localData = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
  if (localData) {
    return JSON.parse(localData);
  }

  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

/**
 * Lấy danh sách sản phẩm hoa (Ưu tiên json-server, fallback localStorage)
 */
export async function fetchProducts() {
  try {
    const response = await api.get('/api/products');
    if (response.data && response.data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(response.data));
      return response.data;
    }
  } catch (error) {
    console.warn('Không thể tải từ /api/products, kiểm tra localStorage/fallback.');
  }

  const localData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  if (localData) {
    const parsed = JSON.parse(localData);
    // Nếu cache cũ còn chứa ID số cũ, tự động dọn dẹp để đồng bộ hệ ID PROD-xxx của MySQL
    if (parsed.length > 0 && String(parsed[0].id).startsWith('PROD-')) {
      return parsed;
    }
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
  }

  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
  return DEFAULT_PRODUCTS;
}

/**
 * Lấy thông tin 1 sản phẩm theo ID (Dùng find của ES6)
 * @param {number|string} id - ID sản phẩm
 */
export async function fetchProductById(id) {
  try {
    const response = await api.get(`/api/products/${id}`);
    if (response.data) return response.data;
  } catch (error) {
    // Fallback tìm trong danh sách offline
  }

  const allProducts = await fetchProducts();
  return allProducts.find(product => String(product.id) === String(id) || product.id == id);
}

/**
 * Thêm sản phẩm vào giỏ hàng và đồng bộ localStorage
 * @param {object} product - Thông tin sản phẩm hoa
 * @param {number} quantity - Số lượng cần thêm
 */
export function addToCart(product, quantity = 1) {
  let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  
  // Sử dụng findIndex() của ES6 để tìm vị trí món hàng trong giỏ
  const existingIndex = cart.findIndex(item => item.id == product.id);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += Number(quantity);
    if (cart[existingIndex].categoryId === undefined && product.categoryId !== undefined) {
      cart[existingIndex].categoryId = product.categoryId;
    }
    if (cart[existingIndex].originalPrice === undefined) {
      cart[existingIndex].originalPrice = product.originalPrice || product.price;
    }
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice || product.price,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      quantity: Number(quantity)
    });
  }

  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  return cart;
}

/**
 * Lấy danh sách banner (Dual-tier: json-server + fallback localStorage / mặc định)
 * Sử dụng ES6 filter() và sort() để sắp xếp theo thứ tự hiển thị
 * @returns {Promise<Array>} Mảng danh sách banner đang hoạt động (active: true)
 */
export async function fetchBanners() {
  try {
    const response = await api.get('/banners');
    if (response.data && response.data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(response.data));
      return response.data
        .filter(b => b.active !== false && b.is_active !== false)
        .sort((a, b) => ((a.order ?? a.display_order ?? 0) - (b.order ?? b.display_order ?? 0)));
    }
  } catch (error) {
    console.warn('Không thể kết nối API /banners, chuyển sang chế độ dữ liệu dự phòng.');
  }

  // Fallback 1: Lấy từ localStorage nếu đã từng tải
  const cached = localStorage.getItem(STORAGE_KEYS.BANNERS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(b => b.active)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    } catch (e) {}
  }

  // Fallback 2: Sử dụng DEFAULT_BANNERS nguyên bản
  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(DEFAULT_BANNERS));
  return DEFAULT_BANNERS
    .filter(b => b.active)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Lấy danh sách sản phẩm bán chạy nhất (Best Sellers) - SHOP-06
 * Sử dụng ES6 spread operator [...] để clone mảng và sort() theo số lượng bán (soldCount)
 * @param {number} limit - Số lượng sản phẩm muốn lấy (mặc định: 4)
 * @returns {Promise<Array>} Mảng sản phẩm bán chạy nhất
 */
export async function fetchBestSellers(limit = 4) {
  try {
    const response = await api.get('/api/products', {
      params: {
        _sort: 'soldCount',
        _order: 'desc',
        _limit: limit
      }
    });
    if (response.data && response.data.length > 0) {
      return response.data;
    }
  } catch (error) {
    // Fallback
  }

  const all = await fetchProducts();
  return [...all]
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, limit);
}

/**
 * Lấy danh sách mẫu hoa mới nhất (Newest Arrivals) - SHOP-06
 * Sử dụng ES6 sort() sắp xếp giảm dần theo ID
 * @param {number} limit - Số lượng sản phẩm muốn lấy (mặc định: 4)
 * @returns {Promise<Array>} Mảng sản phẩm mới nhất
 */
export async function fetchNewestProducts(limit = 4) {
  // Lấy toàn bộ sản phẩm và sắp xếp theo số nguyên ID giảm dần (đảm bảo ID 17 luôn lớn hơn ID 9, tránh lỗi chuỗi của json-server)
  const all = await fetchProducts();
  return [...all]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, limit);
}

/**
 * Lấy danh sách Voucher khuyến mãi (Dual-tier: json-server + fallback localStorage / mặc định)
 * @returns {Promise<Array>} Mảng danh sách các mã khuyến mãi đang active
 */
export async function fetchPromotions() {
  try {
    const response = await api.get('/promotions');
    if (response.data && response.data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(response.data));
      return response.data.filter(p => p.active);
    }
  } catch (error) {
    console.warn('Không thể kết nối API /promotions, dùng dữ liệu dự phòng.');
  }

  const cached = localStorage.getItem(STORAGE_KEYS.PROMOTIONS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(p => p.active);
      }
    } catch (e) {}
  }

  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(DEFAULT_PROMOTIONS));
  return DEFAULT_PROMOTIONS.filter(p => p.active);
}

/**
 * ============================================================================
 * HỆ THỐNG PHÂN CẤP GIẢM GIÁ (TIERED DISCOUNT SYSTEM - SHOPEE/TIKI STANDARD)
 * Cấp 1: Giảm tự động theo sản phẩm (originalPrice -> price)
 * Cấp 2: Giảm theo danh mục (scope: 'category', targetCategoryIds)
 * Cấp 3: Giảm toàn giỏ hàng (scope: 'all')
 * ============================================================================
 */

/**
 * Chuẩn hóa và làm giàu dữ liệu sản phẩm trong giỏ hàng (Single Source of Truth)
 * Luôn tra cứu categoryId và originalPrice từ danh mục sản phẩm gốc, KHÔNG tin tưởng dữ liệu cũ trong localStorage
 */
export function resolveCartItemsCatalog(items) {
  if (!Array.isArray(items)) return [];

  let products = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (raw) products = JSON.parse(raw);
  } catch (e) {}

  if (!products || products.length === 0) {
    products = DEFAULT_PRODUCTS || [];
  }

  const prodMap = new Map((products || []).map(p => [String(p.id), p]));

  return items.map(item => {
    const p = prodMap.get(String(item.id));
    return {
      ...item,
      id: String(item.id),
      categoryId: (p && p.categoryId !== undefined) ? String(p.categoryId) : (item.categoryId !== undefined ? String(item.categoryId) : '1'),
      categoryName: p ? (p.categoryName || item.categoryName) : item.categoryName,
      price: Number(item.price || (p ? p.price : 0)),
      originalPrice: (p && p.originalPrice !== undefined) ? Number(p.originalPrice) : (item.originalPrice !== undefined ? Number(item.originalPrice) : Number(item.price || 0)),
      quantity: Math.max(1, Number(item.quantity) || 1)
    };
  });
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
      eligibleAmount: 0,
      eligibleItems: []
    };
  }

  // 1. Kiểm tra hạn dùng (startDate, endDate)
  const now = new Date();
  if (voucher.startDate && new Date(voucher.startDate) > now) {
    return {
      isValid: false,
      error: `Mã giảm giá chưa đến ngày áp dụng! (Bắt đầu từ ${voucher.startDate})`,
      reasonCode: 'NOT_STARTED',
      reasonText: `Chưa tới ngày dùng (${voucher.startDate})`,
      discountAmount: 0,
      eligibleAmount: 0,
      eligibleItems: []
    };
  }
  if (voucher.endDate) {
    const end = new Date(voucher.endDate);
    end.setHours(23, 59, 59, 999);
    if (end < now) {
      return {
        isValid: false,
        error: 'Mã giảm giá đã hết hạn sử dụng!',
        reasonCode: 'EXPIRED',
        reasonText: 'Mã đã hết hạn sử dụng',
        discountAmount: 0,
        eligibleAmount: 0,
        eligibleItems: []
      };
    }
  }

  // 2. Kiểm tra giới hạn lượt dùng
  if (typeof voucher.usageLimit === 'number' && typeof voucher.usedCount === 'number') {
    if (voucher.usedCount >= voucher.usageLimit) {
      return {
        isValid: false,
        error: 'Mã giảm giá đã hết lượt sử dụng!',
        reasonCode: 'LIMIT_REACHED',
        reasonText: 'Đã hết lượt sử dụng',
        discountAmount: 0,
        eligibleAmount: 0,
        eligibleItems: []
      };
    }
  }

  if (!items || items.length === 0) {
    return {
      isValid: false,
      error: 'Giỏ hàng đang trống! Vui lòng chọn hoa trước khi áp dụng mã.',
      reasonCode: 'EMPTY_CART',
      reasonText: 'Giỏ hàng đang trống',
      discountAmount: 0,
      eligibleAmount: 0,
      eligibleItems: []
    };
  }

  // 3. Chuẩn hóa và làm giàu dữ liệu sản phẩm từ danh mục gốc
  const resolvedItems = resolveCartItemsCatalog(items);

  const targetCategoryIds = Array.isArray(voucher.targetCategoryIds)
    ? voucher.targetCategoryIds.map(String)
    : (voucher.targetCategoryId ? [String(voucher.targetCategoryId)] : []);

  const targetProductIds = Array.isArray(voucher.targetProductIds)
    ? voucher.targetProductIds.map(String)
    : (voucher.targetProductId ? [String(voucher.targetProductId)] : []);

  // 4. Lọc các món đủ điều kiện (filter theo Scope & excludeSaleItems)
  const eligibleItems = resolvedItems.filter(item => {
    // Nếu voucher có cờ loại bỏ các món đang giảm giá cấp sản phẩm (Flash Sale)
    if (voucher.excludeSaleItems && Number(item.originalPrice) > Number(item.price)) {
      return false;
    }

    // Kiểm tra theo Cấp danh mục (Category-level)
    if (voucher.scope === 'category') {
      return targetCategoryIds.includes(String(item.categoryId));
    }

    // Kiểm tra theo Cấp sản phẩm cụ thể (Product-level)
    if (voucher.scope === 'product') {
      return targetProductIds.includes(String(item.id));
    }

    // Cấp toàn shop (scope === 'all' hoặc mặc định)
    return true;
  });

  // Thông báo lỗi rõ ràng nếu trong giỏ không có món nào thỏa mãn
  if (eligibleItems.length === 0) {
    let scopeHint = 'cho các sản phẩm thỏa mãn điều kiện';
    let reasonText = 'Chưa có sản phẩm phù hợp';
    let reasonCode = 'NOT_ELIGIBLE';

    // Kiểm tra xem giỏ hàng có sản phẩm khớp scope nhưng bị loại vì Flash Sale không
    const hasScopeMatch = resolvedItems.some(item => {
      if (voucher.scope === 'category') return targetCategoryIds.includes(String(item.categoryId));
      if (voucher.scope === 'product') return targetProductIds.includes(String(item.id));
      return true;
    });

    if (voucher.excludeSaleItems && hasScopeMatch) {
      scopeHint = 'cho các món nguyên giá (các món trong giỏ của bạn đều là hàng Flash Sale nên không được cộng dồn)';
      reasonText = 'Không áp dụng cho hàng Flash Sale';
      reasonCode = 'EXCLUDE_SALE';
    } else if (voucher.scope === 'category') {
      reasonCode = 'CATEGORY_MISMATCH';
      if (targetCategoryIds.includes('1')) {
        scopeHint = 'cho các mẫu hoa thuộc danh mục "Hoa Kẽm Nhung"';
        reasonText = 'Chỉ áp dụng cho Hoa Kẽm Nhung';
      } else if (targetCategoryIds.includes('2')) {
        scopeHint = 'cho các mẫu hoa thuộc danh mục "Bó Hoa Sinh Nhật"';
        reasonText = 'Chỉ áp dụng cho Bó Hoa Sinh Nhật';
      } else {
        scopeHint = 'cho các sản phẩm thuộc danh mục hoa được chỉ định';
        reasonText = 'Sai danh mục áp dụng';
      }
    } else if (voucher.scope === 'product') {
      scopeHint = 'cho một số mẫu hoa đặc thù theo danh sách';
      reasonText = 'Chỉ áp dụng cho một số mẫu hoa';
      reasonCode = 'PRODUCT_MISMATCH';
    }

    return {
      isValid: false,
      error: `Mã ${voucher.code} chỉ áp dụng ${scopeHint}! Vui lòng chọn thêm hoa phù hợp.`,
      reasonCode,
      reasonText,
      neededAmount: 0,
      discountAmount: 0,
      eligibleAmount: 0,
      eligibleItems: []
    };
  }

  // 5. Tính eligibleAmount (tổng tiền các món đủ điều kiện sau giảm giá cấp sản phẩm)
  const eligibleAmount = eligibleItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  // 6. Kiểm tra minOrder TÍNH TRÊN eligibleAmount (không tính cào bằng cả giỏ hàng)
  const minOrder = Number(voucher.minOrder) || 0;
  if (eligibleAmount < minOrder) {
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

  // 7. Tính tiền giảm theo loại: percent (có trần maxDiscount) hoặc fixed
  let discount = 0;
  let isCapped = false;
  const discountType = voucher.discountType || (voucher.discountPercent ? 'percent' : 'fixed');
  const discountValue = Number(voucher.discountValue ?? voucher.discountPercent ?? 0);

  if (discountType === 'percent') {
    discount = Math.round((eligibleAmount * discountValue) / 100);
    // Áp dụng trần maxDiscount nếu có cấu hình
    if (voucher.maxDiscount && discount > Number(voucher.maxDiscount)) {
      discount = Number(voucher.maxDiscount);
      isCapped = true;
    }
  } else {
    // Giảm tiền cố định: không được vượt quá số tiền của các món đủ điều kiện
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

/**
 * Lấy dữ liệu chi tiết giỏ hàng và tính toán tiền (Tạm tính, Giảm giá, Tổng cộng)
 * Sử dụng reduce() của ES6 để tính tổng tiền đơn hàng
 * @returns {object} { items, subtotal, discountAmount, totalPrice, appliedVoucher, voucherCalculation }
 */
export function getCartSummary() {
  const rawItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  // Chuẩn hóa và làm giàu dữ liệu sản phẩm từ danh mục gốc (không tin tưởng dữ liệu cũ thiếu trường)
  const items = resolveCartItemsCatalog(rawItems);

  // 1. Dùng reduce() ES6 tính tổng tiền hàng trước voucher (đã hưởng giảm giá cấp sản phẩm)
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  // 2. Lấy mã voucher đang áp dụng
  let appliedVoucher = null;
  try {
    appliedVoucher = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLIED_VOUCHER));
  } catch (e) {}

  let discountAmount = 0;
  let voucherCalculation = null;

  if (appliedVoucher && appliedVoucher.active) {
    voucherCalculation = calculateVoucherDiscount(items, appliedVoucher);
    if (voucherCalculation.isValid) {
      discountAmount = voucherCalculation.discountAmount;
    } else {
      // Nếu giỏ hàng có hàng nhưng không còn thỏa mãn điều kiện voucher -> tự động hủy áp dụng
      if (items.length > 0) {
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

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng (+1 hoặc -1)
 * @param {number|string} productId - ID sản phẩm
 * @param {number} delta - Giá trị thay đổi (+1 hoặc -1)
 */
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

/**
 * Xóa một sản phẩm khỏi giỏ hàng
 * @param {number|string} productId - ID sản phẩm
 */
export function removeCartItem(productId) {
  let cart = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  cart = cart.filter(item => item.id != productId);
  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  return getCartSummary();
}

/**
 * Áp dụng mã Voucher giảm giá vào giỏ hàng với quy tắc phân cấp chặt chẽ
 * @param {string} code - Mã voucher (ví dụ: 'KEMNHUNG15', 'CHAO2026', 'SINHNHATVUI')
 * @returns {Promise<object>} { success: boolean, message: string, summary: object }
 */
export async function applyVoucher(code) {
  if (!code || !code.trim()) {
    return { success: false, message: 'Vui lòng nhập mã giảm giá!' };
  }

  const cleanCode = code.trim().toUpperCase();
  const promotions = await fetchPromotions();
  const voucher = promotions.find(p => p.code.toUpperCase() === cleanCode && p.active);

  if (!voucher) {
    return { success: false, message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn!' };
  }

  const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || [];
  const calc = calculateVoucherDiscount(items, voucher);

  if (!calc.isValid) {
    return {
      success: false,
      message: calc.error
    };
  }

  // Lưu thông tin voucher đã được xác thực vào localStorage
  localStorage.setItem(STORAGE_KEYS.APPLIED_VOUCHER, JSON.stringify(voucher));

  // Tạo thông điệp chi tiết thông báo cho người dùng
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

/**
 * Gỡ bỏ mã Voucher đang áp dụng
 */
export function removeVoucher() {
  localStorage.removeItem(STORAGE_KEYS.APPLIED_VOUCHER);
  return getCartSummary();
}

/* ==========================================================================
   ADMIN MANAGEMENT & CRUD FUNCTIONS (SHOP-08)
   Hỗ trợ lưu trữ kép: json-server REST API + Đồng bộ tức thì localStorage
   ========================================================================== */

/**
 * Lấy TOÀN BỘ danh sách Banners (bao gồm cả banner đang ẩn active: false) dành riêng cho Admin
 * @returns {Promise<Array>} Danh sách toàn bộ banner được sắp xếp theo order
 */
export async function fetchAllBanners() {
  try {
    const response = await api.get('/banners?all=true');
    if (response.data && response.data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(response.data));
      return [...response.data].sort((a, b) => (Number(a.order ?? a.display_order) || 0) - (Number(b.order ?? b.display_order) || 0));
    }
  } catch (error) {
    console.warn('Không thể kết nối API /banners, đọc từ localStorage.');
  }

  const cached = localStorage.getItem(STORAGE_KEYS.BANNERS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...parsed].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      }
    } catch (e) {}
  }

  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(DEFAULT_BANNERS));
  return [...DEFAULT_BANNERS].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

/**
 * Thêm mới một Banner (Admin CRUD)
 */
export async function createBanner(bannerData) {
  const allBanners = await fetchAllBanners();
  const newBanner = {
    ...bannerData,
    id: bannerData.id || String(Date.now()),
    order: Number(bannerData.order) || (allBanners.length + 1),
    active: bannerData.active !== undefined ? Boolean(bannerData.active) : true,
    theme: bannerData.theme || 'default'
  };

  try {
    await api.post('/banners', newBanner);
  } catch (e) {
    console.warn('Không thể POST /banners, lưu vào localStorage.');
  }

  const updated = [...allBanners, newBanner];
  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(updated));
  return newBanner;
}

/**
 * Cập nhật thông tin Banner (Admin CRUD)
 */
export async function updateBanner(id, bannerData) {
  const allBanners = await fetchAllBanners();
  const index = allBanners.findIndex(b => String(b.id) === String(id));
  if (index === -1) throw new Error('Không tìm thấy banner để cập nhật');

  const updatedBanner = {
    ...allBanners[index],
    ...bannerData,
    id: String(id),
    order: Number(bannerData.order) || allBanners[index].order,
    active: bannerData.active !== undefined ? Boolean(bannerData.active) : allBanners[index].active
  };

  try {
    await api.put(`/banners/${id}`, updatedBanner);
  } catch (e) {
    console.warn(`Không thể PUT /banners/${id}, lưu vào localStorage.`);
  }

  allBanners[index] = updatedBanner;
  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(allBanners));
  return updatedBanner;
}

/**
 * Xóa một Banner (Admin CRUD)
 */
export async function deleteBanner(id) {
  try {
    await api.delete(`/banners/${id}`);
  } catch (e) {
    console.warn(`Không thể DELETE /banners/${id}, xóa trong localStorage.`);
  }

  const allBanners = await fetchAllBanners();
  const filtered = allBanners.filter(b => String(b.id) !== String(id));
  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(filtered));
  return true;
}

/**
 * Kích hoạt chiến dịch Banner theo chủ đề (SHOP-08 Feature)
 * @param {string} themeKey - 'default' | 'tet' | 'valentine' | 'sale' | 'all'
 */
export async function activateBannerTheme(themeKey) {
  const allBanners = await fetchAllBanners();
  const updatedBanners = allBanners.map(banner => {
    if (themeKey === 'all') {
      return { ...banner, active: true };
    }
    return {
      ...banner,
      active: (banner.theme || 'default') === themeKey
    };
  });

  // Nếu chủ đề được chọn không có banner nào, bật lại banner default
  const hasActive = updatedBanners.some(b => b.active);
  if (!hasActive && updatedBanners.length > 0) {
    updatedBanners[0].active = true;
  }

  localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(updatedBanners));
  localStorage.setItem(STORAGE_KEYS.ACTIVE_THEME, themeKey);

  // Thử đồng bộ lên API nếu có thể
  updatedBanners.forEach(b => {
    api.put(`/banners/${b.id}`, b).catch(() => {});
  });

  return updatedBanners;
}

/**
 * Thêm mới một sản phẩm hoa (Admin CRUD)
 */
export async function createProduct(productData) {
  const allProducts = await fetchProducts();
  const nextId = allProducts.length > 0 
    ? Math.max(...allProducts.map(p => Number(p.id) || 0)) + 1 
    : 1;

  const newProduct = {
    ...productData,
    id: String(nextId),
    price: Number(productData.price) || 0,
    originalPrice: Number(productData.originalPrice) || Number(productData.price) || 0,
    stock: Number(productData.stock) || 10,
    soldCount: Number(productData.soldCount) || 0,
    rating: Number(productData.rating) || 5,
    reviewCount: Number(productData.reviewCount) || 1,
    featured: Boolean(productData.featured)
  };

  try {
    await api.post('/api/products', newProduct);
  } catch (e) {
    console.warn('Không thể POST /api/products, lưu vào localStorage.');
  }

  const updated = [newProduct, ...allProducts];
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
  return newProduct;
}

/**
 * Cập nhật sản phẩm hoa (Admin CRUD)
 */
export async function updateProduct(id, productData) {
  const allProducts = await fetchProducts();
  const index = allProducts.findIndex(p => p.id == id);
  if (index === -1) throw new Error('Không tìm thấy mẫu hoa để cập nhật');

  const updatedProduct = {
    ...allProducts[index],
    ...productData,
    id: String(id),
    price: Number(productData.price),
    originalPrice: Number(productData.originalPrice) || Number(productData.price),
    stock: Number(productData.stock) || 0,
    soldCount: Number(productData.soldCount) || 0
  };

  try {
    await api.put(`/api/products/${id}`, updatedProduct);
  } catch (e) {
    console.warn(`Không thể PUT /api/products/${id}, cập nhật vào localStorage.`);
  }

  allProducts[index] = updatedProduct;
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(allProducts));
  return updatedProduct;
}

/**
 * Xóa một sản phẩm hoa (Admin CRUD)
 */
export async function deleteProduct(id) {
  try {
    await api.delete(`/api/products/${id}`);
  } catch (e) {
    console.warn(`Không thể DELETE /api/products/${id}, xóa trong localStorage.`);
  }

  const allProducts = await fetchProducts();
  const filtered = allProducts.filter(p => p.id != id);
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
  return true;
}

/**
 * Lấy TOÀN BỘ danh sách Voucher (bao gồm cả mã đã tắt active: false) dành cho Admin
 */
export async function fetchAllPromotions() {
  try {
    const response = await api.get('/promotions');
    if (response.data && response.data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(response.data));
      return response.data;
    }
  } catch (e) {}

  const cached = localStorage.getItem(STORAGE_KEYS.PROMOTIONS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }

  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(DEFAULT_PROMOTIONS));
  return DEFAULT_PROMOTIONS;
}

/**
 * Thêm mới một mã Voucher (Admin CRUD)
 */
export async function createPromotion(promoData) {
  const allPromos = await fetchAllPromotions();
  const newPromo = {
    ...promoData,
    id: promoData.id || `promo-${Date.now()}`,
    code: (promoData.code || '').trim().toUpperCase(),
    discountPercent: Number(promoData.discountPercent) || 10,
    minOrder: Number(promoData.minOrder) || 0,
    active: promoData.active !== undefined ? Boolean(promoData.active) : true
  };

  try {
    await api.post('/promotions', newPromo);
  } catch (e) {}

  const updated = [...allPromos, newPromo];
  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(updated));
  return newPromo;
}

/**
 * Cập nhật thông tin Voucher (Admin CRUD)
 */
export async function updatePromotion(id, promoData) {
  const allPromos = await fetchAllPromotions();
  const index = allPromos.findIndex(p => String(p.id) === String(id));
  if (index === -1) throw new Error('Không tìm thấy voucher để cập nhật');

  const updatedPromo = {
    ...allPromos[index],
    ...promoData,
    id: String(id),
    usedCount: typeof promoData.usedCount === 'number' ? promoData.usedCount : (allPromos[index].usedCount || 0),
    code: (promoData.code || allPromos[index].code).trim().toUpperCase(),
    discountPercent: Number(promoData.discountPercent) || allPromos[index].discountPercent,
    minOrder: Number(promoData.minOrder) !== undefined ? Number(promoData.minOrder) : allPromos[index].minOrder,
    active: promoData.active !== undefined ? Boolean(promoData.active) : allPromos[index].active
  };

  try {
    await api.put(`/promotions/${id}`, updatedPromo);
  } catch (e) {}

  allPromos[index] = updatedPromo;
  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(allPromos));
  return updatedPromo;
}

/**
 * Xóa một mã Voucher (Admin CRUD)
 */
export async function deletePromotion(id) {
  try {
    await api.delete(`/promotions/${id}`);
  } catch (e) {}

  const allPromos = await fetchAllPromotions();
  const filtered = allPromos.filter(p => String(p.id) !== String(id));
  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(filtered));
  return true;
}

/**
 * Lấy danh sách toàn bộ Đơn Hàng (Orders Management)
 * Dùng reduce() trong admin.js để tính doanh thu
 */
export async function fetchOrders() {
  try {
    const response = await api.get('/orders');
    const orders = Array.isArray(response.data) ? response.data : [];
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    return orders;
  } catch (e) {
    // Giữ cache để người dùng vẫn xem được đơn đã tải trước đó khi API tạm mất kết nối.
    // Không tự bơm DEFAULT_ORDERS vào lịch sử mua hàng thật.
    console.warn('Không tải được đơn hàng từ API:', e.response?.data?.error?.message || e.message);
  }

  const cached = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }

  return [];
}

/**
 * Cập nhật trạng thái đơn hàng (pending, confirmed, shipping, completed, cancelled)
 */
export async function updateOrderStatus(orderId, newStatus) {
  const allOrders = await fetchOrders();
  const index = allOrders.findIndex(o => String(o.id) === String(orderId));
  if (index === -1) throw new Error('Không tìm thấy đơn hàng');
  const response = await api.patch(`/api/orders/${encodeURIComponent(orderId)}/status`, { status: newStatus });
  const updatedOrder = response.data?.order || { ...allOrders[index], status: newStatus };
  allOrders[index] = { ...allOrders[index], ...updatedOrder };
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(allOrders));
  return allOrders[index];
}

/**
 * Tạo đơn hàng mới từ giỏ hàng Storefront
 */
export async function saveOrder(orderData) {
  const allOrders = await fetchOrders();
  const newOrder = {
    ...orderData,
    id: orderData.id || `DH-${Date.now().toString().slice(-4)}`,
    createdAt: orderData.createdAt || new Date().toISOString(),
    status: orderData.status || (orderData.paymentMethod === 'sepay' && orderData.paymentStatus === 'paid' ? 'confirmed' : 'pending'),
    paymentMethod: orderData.paymentMethod || 'cod',
    paymentStatus: orderData.paymentStatus || (orderData.paymentMethod === 'sepay' ? 'paid' : 'pending'),
    isGift: Boolean(orderData.isGift),
    recipientName: orderData.recipientName || '',
    recipientPhone: orderData.recipientPhone || '',
    hasGreetingCard: Boolean(orderData.hasGreetingCard || orderData.cardMessage),
    cardMessage: orderData.cardMessage || '',
    deliverySlot: orderData.deliverySlot || 'Tiêu chuẩn trong ngày',
    sepayTransaction: orderData.sepayTransaction || null
  };

  // Backend là nguồn dữ liệu chính: nếu tạo thất bại thì giữ giỏ và báo lỗi cho khách.
  const response = await api.post('/api/orders', newOrder);
  const savedOrder = { ...newOrder, ...(response.data || {}) };
  const existingIndex = allOrders.findIndex(order => String(order.id) === String(savedOrder.id));
  const updated = existingIndex >= 0
    ? allOrders.map((order, index) => index === existingIndex ? { ...order, ...savedOrder } : order)
    : [savedOrder, ...allOrders];
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
  return savedOrder;
}

/**
 * Cập nhật trạng thái thanh toán của đơn hàng (SePay / COD)
 */
export async function updateOrderPaymentStatus(orderId, paymentStatus, transactionData = null) {
  const allOrders = await fetchOrders();
  const index = allOrders.findIndex(o => String(o.id) === String(orderId));
  if (index === -1) throw new Error('Không tìm thấy đơn hàng');

  allOrders[index].paymentStatus = paymentStatus;
  if (transactionData) {
    allOrders[index].sepayTransaction = transactionData;
  }
  if (paymentStatus === 'paid' && allOrders[index].status === 'pending') {
    allOrders[index].status = 'confirmed';
  }

  try {
    await api.patch(`/api/orders/${orderId}/status`, {
      paymentStatus: allOrders[index].paymentStatus,
      status: allOrders[index].status,
      sepayTransaction: allOrders[index].sepayTransaction
    });
  } catch (e) {}

  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(allOrders));
  return allOrders[index];
}

// ============================================================================
// 1. MODULE UPLOAD ẢNH ĐẠI DIỆN CÁ NHÂN (USER AVATAR - CANVAS COMPRESSED)
// ============================================================================

/**
 * Cập nhật ảnh đại diện người dùng lên Server và đồng bộ LocalStorage
 * @param {string} avatarBase64 - Chuỗi Base64 đã được nén < 30KB bằng Canvas
 */
export async function uploadUserAvatarStorage(avatarBase64) {
  let updatedUser = null;

  try {
    const res = await avatarApi.uploadAvatar(avatarBase64);
    if (res.data && res.data.user) {
      updatedUser = res.data.user;
    }
  } catch (err) {
    console.warn('Backend chưa bật, cập nhật avatar cục bộ trên localStorage:', err.message);
  }

  // Luôn cập nhật LocalStorage đồng bộ
  const savedUserJson = localStorage.getItem('user');
  if (savedUserJson) {
    const user = JSON.parse(savedUserJson);
    user.avatar = avatarBase64;
    localStorage.setItem('user', JSON.stringify(user));
    if (!updatedUser) updatedUser = user;
  }

  // Phát sự kiện toàn cục để Header và Topbar Admin cập nhật ảnh ngay tức thì
  window.dispatchEvent(new CustomEvent('user:avatar-updated', { detail: { avatar: avatarBase64 } }));
  return updatedUser;
}

// ============================================================================
// 2. MODULE DANH SÁCH HOA YÊU THÍCH (WISHLIST THEO USER)
// ============================================================================

/**
 * Lấy storage key riêng biệt theo ID người dùng đăng nhập
 */
export function getWishlistStorageKey() {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      const identifier = u.id || u.phone || u.email || 'guest';
      return `${STORAGE_KEYS.WISHLIST_PREFIX}${identifier}`;
    } catch (e) {}
  }
  return `${STORAGE_KEYS.WISHLIST_PREFIX}guest`;
}

/**
 * Lấy danh sách ID các mẫu hoa yêu thích
 */
export async function fetchWishlistStorage() {
  const key = getWishlistStorageKey();

  // Thử gọi Server API
  try {
    const res = await wishlistApi.getWishlist();
    if (Array.isArray(res.data)) {
      localStorage.setItem(key, JSON.stringify(res.data));
      return res.data;
    }
  } catch (err) {}

  // Fallback đọc LocalStorage
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached) || [];
    } catch (e) {}
  }
  return [];
}

/**
 * Thêm hoặc bớt sản phẩm khỏi danh sách yêu thích
 */
export async function toggleWishlistStorage(productId) {
  const key = getWishlistStorageKey();
  const prodIdStr = String(productId);
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

  // Đồng bộ lên Server nếu có mạng
  try {
    await wishlistApi.toggleWishlist(prodIdStr);
  } catch (err) {}

  window.dispatchEvent(new CustomEvent('wishlist:updated', {
    detail: { productId: prodIdStr, isFavorite, wishlist: currentList }
  }));

  return { isFavorite, wishlist: currentList };
}

/**
 * Hợp nhất danh sách hoa yêu thích từ guest vào tài khoản khi vừa đăng nhập
 */
export function mergeGuestWishlistToUser(userId) {
  const guestKey = `${STORAGE_KEYS.WISHLIST_PREFIX}guest`;
  const userKey = `${STORAGE_KEYS.WISHLIST_PREFIX}${userId}`;

  try {
    const guestList = JSON.parse(localStorage.getItem(guestKey)) || [];
    if (guestList.length > 0) {
      const userList = JSON.parse(localStorage.getItem(userKey)) || [];
      const merged = Array.from(new Set([...userList, ...guestList]));
      localStorage.setItem(userKey, JSON.stringify(merged));
      localStorage.removeItem(guestKey);
      return merged;
    }
  } catch (e) {}
  return [];
}

// ============================================================================
// 3. MODULE ĐÁNH GIÁ & BÌNH LUẬN (REVIEWS & STAR RATING VỚI ES6 REDUCE)
// ============================================================================

/**
 * Lấy danh sách đánh giá & bình luận cho 1 mẫu hoa (hoặc toàn bộ)
 */
export async function fetchProductReviews(productId = null) {
  try {
    const res = await reviewApi.getReviews(productId);
    if (Array.isArray(res.data)) {
      return res.data;
    }
  } catch (err) {
    console.warn('Lỗi gọi API reviews, fallback local data:', err.message);
  }

  // Fallback đọc LocalStorage
  const cached = localStorage.getItem(STORAGE_KEYS.REVIEWS);
  if (cached) {
    try {
      const all = JSON.parse(cached) || [];
      return productId ? all.filter(r => String(r.productId) === String(productId) && !r.hidden) : all;
    } catch (e) {}
  }
  return [];
}

/**
 * Gửi đánh giá sao & bình luận mới cho mẫu hoa
 */
export async function submitProductReview({ productId, rating, comment, userName }) {
  try {
    const res = await reviewApi.createReview({ productId, rating, comment, userName });
    if (res.data && res.data.review) {
      // Cập nhật lại cache sản phẩm trong LocalStorage
      const products = await fetchProducts();
      const pIdx = products.findIndex(p => String(p.id) === String(productId));
      if (pIdx !== -1 && res.data.product) {
        products[pIdx].rating = res.data.product.rating;
        products[pIdx].reviewCount = res.data.product.reviewCount;
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      }

      window.dispatchEvent(new CustomEvent('review:created', {
        detail: { review: res.data.review, product: res.data.product }
      }));
      return res.data;
    }
  } catch (err) {
    console.error('Lỗi gửi đánh giá:', err);
    throw err;
  }
}

/**
 * Quản trị viên Ẩn / Hiện bình luận
 */
export async function toggleHideProductReview(reviewId) {
  const res = await reviewApi.toggleHideReview(reviewId);
  return res.data;
}

/**
 * Quản trị viên Xóa đánh giá
 */
export async function deleteProductReview(reviewId) {
  const res = await reviewApi.deleteReview(reviewId);
  return res.data;
}

// ============================================================================
// 4. MODULE THÔNG BÁO TIẾN TRÌNH ĐƠN HÀNG (NOTIFICATIONS API)
// ============================================================================

/**
 * Lấy danh sách thông báo tiến trình đơn hàng của người dùng hiện tại
 */
export async function fetchUserNotifications() {
  try {
    const res = await notificationApi.getNotifications();
    if (Array.isArray(res.data)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(res.data));
      return res.data;
    }
  } catch (err) {
    // Nếu chưa đăng nhập hoặc offline
  }

  const cached = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  if (cached) {
    try {
      return JSON.parse(cached) || [];
    } catch (e) {}
  }
  return [];
}

/**
 * Đánh dấu đã đọc một thông báo
 */
export async function markNotificationRead(id) {
  try {
    await notificationApi.markAsRead(id);
  } catch (e) {}

  const cached = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  if (cached) {
    try {
      const list = JSON.parse(cached) || [];
      const item = list.find(n => String(n.id) === String(id));
      if (item) item.read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    } catch (e) {}
  }
}

/**
 * Đánh dấu đã đọc toàn bộ thông báo
 */
export async function markAllNotificationsRead() {
  try {
    await notificationApi.markAllAsRead();
  } catch (e) {}

  const cached = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  if (cached) {
    try {
      const list = JSON.parse(cached) || [];
      list.forEach(n => n.read = true);
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    } catch (e) {}
  }
}




