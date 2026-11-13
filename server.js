/**
 * server.js - Máy chủ Express Fullstack JavaScript (Clean / Hexagonal Architecture)
 * 100% Thuần Express + Prisma ORM + MySQL 8.0 (Đã loại bỏ hoàn toàn json-server & db.json)
 * Cổng: 4000
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { container } from './server/infrastructure/config/container.js';
import { createOriginGuard } from './server/adapters/in/web/middlewares/originGuard.js';
import { createRateLimiter } from './server/adapters/in/web/middlewares/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Tự động đọc biến môi trường từ .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Đảm bảo thư mục uploads/avatars tồn tại để lưu ảnh đại diện WebP
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 2. Middlewares toàn cục
const developmentOrigins = process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4000',
  'http://127.0.0.1:4000'
];
const allowedOrigins = new Set([
  ...developmentOrigins,
  ...(container.env.CORS_ORIGINS || []),
  container.env.APP_BASE_URL
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép các yêu cầu không có origin (curl, mobile apps, dev tools)
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.has(origin) ? origin : false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(compression());
app.use(createOriginGuard(allowedOrigins));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (req.path === '/reset-password.html') {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  next();
});

// Tối ưu tốc độ tải ảnh: Tự động phục vụ WebP (nhẹ hơn 94%) khi yêu cầu ảnh .png hoặc .jpg nếu có bản .webp
app.use(['/images', '/public/images'], (req, res, next) => {
  if (req.path.match(/\.(png|jpg|jpeg)$/i)) {
    const webpFilename = req.path.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    const webpPath = path.join(__dirname, 'public', 'images', webpFilename);
    if (fs.existsSync(webpPath)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.sendFile(webpPath);
    }
  }
  next();
});

// Cấu hình HTTP Caching chuẩn cho static assets (Ảnh, Fonts, CSS, JS)
const staticOptions = {
  maxAge: '1d',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(webp|png|jpg|jpeg|svg|gif|ico|woff2?|ttf|eot)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 ngày
    } else if (filePath.match(/\.(css|js)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 ngày
    }
  }
};

// Phục vụ static files cho Frontend từ public/ và thư mục uploads (chặn lộ file mã nguồn ở gốc)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// Endpoint giam sat trang thai (Health Check) phuc vu Render & Cron-job.org keep-alive
app.get(['/api/health', '/health'], async (req, res) => {
  try {
    await container.prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(503).json({ status: 'error', message: 'Database disconnected' });
  }
});

// ============================================================================
// 1. PHÂN HỆ XÁC THỰC HEXAGONAL (AUTH API - MYSQL 8.0 + BCRYPT + JWT RFC 7519)
// ============================================================================
app.use('/api/auth', container.authRouter);

// ============================================================================
// 2. PHÂN HỆ SẢN PHẨM, DANH MỤC, BANNER & KHUYẾN MÃI (CATALOG API - MYSQL 8.0)
// ============================================================================
app.get(['/api/categories', '/categories'], container.catalogController.getCategories);
app.get(['/api/products', '/products'], container.catalogController.getProducts);
app.get(['/api/products/:id', '/products/:id'], container.catalogController.getProductById);
app.post(['/api/products', '/products'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.createProduct);
app.put(['/api/products/:id', '/products/:id'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.updateProduct);
app.delete(['/api/products/:id', '/products/:id'], container.authMiddleware, container.roleGuard('admin'), container.catalogController.deleteProduct);

app.get(['/api/banners', '/banners'], container.catalogController.getBanners);
app.post(['/api/banners', '/banners'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.createBanner);
app.put(['/api/banners/theme', '/banners/theme'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.activateBannerTheme);
app.put(['/api/banners/:id', '/banners/:id'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.updateBanner);
app.delete(['/api/banners/:id', '/banners/:id'], container.authMiddleware, container.roleGuard('admin'), container.catalogController.deleteBanner);
app.get(['/api/promotions', '/promotions', '/api/vouchers', '/vouchers'], container.catalogController.getPromotions);
app.post(['/api/promotions', '/promotions', '/api/vouchers', '/vouchers'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.createVoucher);
app.put(['/api/promotions/:id', '/promotions/:id', '/api/vouchers/:id', '/vouchers/:id'], container.authMiddleware, container.roleGuard('staff', 'admin'), container.catalogController.updateVoucher);
app.delete(['/api/promotions/:id', '/promotions/:id', '/api/vouchers/:id', '/vouchers/:id'], container.authMiddleware, container.roleGuard('admin'), container.catalogController.deleteVoucher);

// ============================================================================
// 3. PHÂN HỆ QUẢN TRỊ NGƯỜI DÙNG (ADMIN USERS API - MYSQL 8.0)
// ============================================================================
app.get(['/api/admin/users', '/users'], container.authMiddleware, container.roleGuard('admin'), container.adminUserController.getUsers);
app.post(['/api/admin/users', '/users'], container.authMiddleware, container.roleGuard('admin'), container.adminUserController.createUser);
app.put(['/api/admin/users/:id', '/users/:id'], container.authMiddleware, container.roleGuard('admin'), container.adminUserController.updateUser);
app.delete(['/api/admin/users/:id', '/users/:id'], container.authMiddleware, container.roleGuard('admin'), container.adminUserController.deleteUser);

// ============================================================================
// 4. PHÂN HỆ ĐƠN HÀNG & GIAO DỊCH ACID (ORDERS API - MYSQL 8.0)
// ============================================================================
// Tạo đơn hàng (cho phép cả khách vãng lai và user đã đăng nhập, tự động trừ kho nguyên tử)
app.post(['/api/orders', '/orders'], container.optionalAuthMiddleware, container.orderController.createOrder);
app.put(['/api/orders/:id/draft', '/orders/:id/draft'], container.optionalAuthMiddleware, container.orderController.updateDraftOrder);

// Lấy danh sách đơn hàng (Có phân quyền IDOR: khách xem của mình, admin/staff xem tất cả)
app.get(['/api/orders', '/orders'], container.authMiddleware, container.orderController.getOrders);

// Tra cứu đơn cho khách vãng lai (Giới hạn tần suất chống dò tìm mã đơn + SĐT)
const guestLookupIpLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau ít phút.',
  keyGenerator: (req) => `lookup-ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`
});
const guestLookupOrderLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  message: 'Mã đơn này đã được thử sai quá nhiều lần. Vui lòng kiểm tra lại và thử sau.',
  keyGenerator: (req) => {
    const orderCode = String(req.body?.orderCode || '').trim().toUpperCase();
    return orderCode ? `lookup-order:${orderCode}` : `lookup-ip:${req.ip || 'unknown'}`;
  }
});
app.post('/api/orders/lookup', guestLookupIpLimiter, guestLookupOrderLimiter, container.orderController.lookupGuestOrder);

// Chi tiết đơn hàng
app.get(['/api/orders/:id', '/orders/:id'], container.authMiddleware, container.orderController.getOrderById);

// Cập nhật trạng thái đơn hàng (Bảo vệ State Machine + Sinh Notification)
app.patch('/api/orders/:id/status', container.authMiddleware, container.orderController.updateOrderStatus);

// Chặn các phương thức sửa/xóa trực tiếp trên /orders để bảo vệ toàn vẹn State Machine
app.use('/orders', (req, res, next) => {
  if (['PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Thao tác trực tiếp trên /orders không được phép. Vui lòng sử dụng PATCH /api/orders/:id/status để chuyển trạng thái qua State Machine.'
      }
    });
  }
  next();
});

// ============================================================================
// 5. PHÂN HỆ ĐÁNH GIÁ & BÌNH LUẬN (REVIEWS API - MYSQL 8.0 + ZERO-XSS + REDUCE)
// ============================================================================
const reviewWriteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Bạn gửi đánh giá quá nhanh. Vui lòng thử lại sau ít phút.',
  keyGenerator: (req) => `review-write:${req.user?.id || req.ip || 'unknown'}`
});
const reviewHelpfulLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: 'Bạn thao tác bình chọn quá nhanh. Vui lòng thử lại sau ít phút.',
  keyGenerator: (req) => `review-helpful:${req.user?.id || req.ip || 'unknown'}`
});
const reviewCommentLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 25,
  message: 'Bạn gửi phản hồi quá nhanh. Vui lòng thử lại sau ít phút.',
  keyGenerator: (req) => `review-comment:${req.user?.id || req.ip || 'unknown'}`
});
app.get('/api/reviews/check-eligibility', container.authMiddleware, container.reviewController.checkEligibility);
app.post('/api/reviews/mine', container.authMiddleware, container.reviewController.getReviewedProductIds);
app.get('/api/reviews', container.optionalAuthMiddleware, container.reviewController.getReviews);
app.post('/api/reviews', container.authMiddleware, reviewWriteLimiter, container.reviewController.createReview);
app.post('/api/reviews/:id/helpful', container.authMiddleware, reviewHelpfulLimiter, container.reviewController.toggleHelpful);
app.post('/api/reviews/:id/comments', container.authMiddleware, reviewCommentLimiter, container.reviewController.addComment);
app.delete('/api/reviews/:id/comments/:commentId', container.authMiddleware, container.reviewController.deleteComment);
app.post('/api/reviews/:id/reply', container.authMiddleware, container.roleGuard('staff', 'admin'), container.reviewController.replyReview);
app.patch('/api/reviews/:id/toggle-hide', container.authMiddleware, container.roleGuard('staff', 'admin'), container.reviewController.toggleHide);
app.delete('/api/reviews/:id', container.authMiddleware, container.roleGuard('admin'), container.reviewController.deleteReview);

// ============================================================================
// 6. PHÂN HỆ DANH SÁCH YÊU THÍCH (WISHLIST API - MYSQL 8.0)
// ============================================================================
app.get('/api/wishlist', container.authMiddleware, container.wishlistController.getWishlist);
app.post('/api/wishlist/toggle', container.authMiddleware, container.wishlistController.toggleWishlist);

// ============================================================================
// 7. PHÂN HỆ THÔNG BÁO TIẾN TRÌNH ĐƠN HÀNG (NOTIFICATIONS API - MYSQL 8.0)
// ============================================================================
app.get('/api/notifications', container.authMiddleware, container.notificationController.getNotifications);
app.patch('/api/notifications/:id/read', container.authMiddleware, container.notificationController.markAsRead);
app.patch('/api/notifications/read-all', container.authMiddleware, container.notificationController.markAllAsRead);

// ============================================================================
// 8. PHÂN HỆ PROFILE & AVATAR (SHARP WEBP 200x200 SANITIZATION)
// ============================================================================
app.get('/api/users/profile', container.authMiddleware, container.userController.getProfile);
app.post('/api/users/avatar', container.authMiddleware, container.userController.uploadAvatar);

// ============================================================================
// 9. PHÂN HỆ THANH TOÁN VIETQR SEPAY GATEWAY
// ============================================================================
app.get('/api/sepay/config', container.paymentController.getConfig);
app.post('/api/sepay/check-payment/:orderId', container.optionalAuthMiddleware, container.paymentController.checkPayment);
app.post('/api/sepay/simulate-payment/:orderId', container.optionalAuthMiddleware, container.paymentController.simulatePayment);
app.post('/api/sepay/webhook', container.paymentController.webhook);

// ============================================================================
// 9B. PHÂN HỆ HOÀN TIỀN 2 CẤP (THU NGÂN STAFF LẬP PHIẾU -> ADMIN DUYỆT)
// ============================================================================
app.get('/api/refunds', container.authMiddleware, container.roleGuard('staff', 'admin'), container.refundController.getRefunds);
app.post('/api/refunds', container.authMiddleware, container.roleGuard('staff', 'admin'), container.refundController.createRefund);
app.post('/api/refunds/:id/approve', container.authMiddleware, container.roleGuard('admin'), container.refundController.approveRefund);
app.post('/api/refunds/:id/reject', container.authMiddleware, container.roleGuard('admin'), container.refundController.rejectRefund);

// ============================================================================
// 10. PHÂN HỆ CHATBOT AI EM LY (GEMINI PROXY BẢO MẬT PHÍA SERVER)
// ============================================================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Thiếu nội dung câu hỏi' });
    }

    const products = await container.catalogRepo.findProducts({ limit: 15 });
    const vouchers = await container.catalogRepo.findVouchers();

    const query = message.toLowerCase();
    const matchedProducts = products.filter(p => {
      return p.name.toLowerCase().includes(query) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query));
    }).slice(0, 3);

    const flowerKnowledge = products.slice(0, 6).map(p => `- ${p.name} (Giá: ${p.price.toLocaleString()}đ, Danh mục: ${p.categoryName || 'Hoa handmade'})`).join('\n');
    const promoKnowledge = vouchers.filter(v => v.isActive ?? v.is_active ?? true).map(v => `- Mã ${v.code}: Giảm ${v.discountValue || v.discount_value || 0}${v.discountType === 'fixed' || v.discount_type === 'fixed' ? 'đ' : '%'}`).join('\n');

    let replyText = '';

    if (query.includes('chào') || query.includes('hello') || query.includes('hi')) {
      replyText = `Dạ Em Ly chào bạn ạ! Rất vui được đồng hành cùng bạn chọn hoa hôm nay. Tiệm có các mẫu hoa kẽm nhung thủ công bền đẹp và hoa tươi quà tặng, bạn đang tìm hoa cho dịp nào ạ?`;
    } else if (query.includes('khuyến mãi') || query.includes('mã giảm') || query.includes('voucher')) {
      replyText = `Dạ hiện tại tiệm đang có các mã ưu đãi đặc biệt:\n${promoKnowledge || '- Nhập HOAMOI20 để giảm 20%'}\nBạn có thể áp dụng ngay trong giỏ hàng nhé!`;
    } else if (query.includes('giá') || query.includes('bao nhiêu') || matchedProducts.length > 0) {
      if (matchedProducts.length > 0) {
        replyText = `Dạ đây là những mẫu hoa phù hợp nhất với yêu cầu "${message}" của bạn ạ:`;
      } else {
        replyText = `Dạ các mẫu hoa kẽm nhung thủ công tại tiệm có giá từ 180.000đ đến 550.000đ tùy theo kích cỡ và độ tỉ mỉ. Dưới đây là một số mẫu hoa nổi bật bạn tham khảo nhé!`;
      }
    } else {
      if (GEMINI_API_KEY) {
        try {
          const prompt = `Bạn là "Em Ly", trợ lý tư vấn hoa nghệ thuật handmade kẽm nhung và hoa tươi tại "Tiệm Hoa Kẽm Nhung".
Hãy trả lời khách hàng một cách lịch sự, nhã nhặn, chuẩn tiếng Việt ấm áp, ngắn gọn trong 2-3 câu.
Danh mục hoa hiện có:
${flowerKnowledge}
Ưu đãi:
${promoKnowledge}
Khách hàng hỏi: "${message}"`;

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
          const aiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) replyText = text.trim();
          }
        } catch (apiErr) {
          console.warn('Lỗi gọi Gemini API (dùng fallback local):', apiErr.message);
        }
      }

      if (!replyText) {
        replyText = `Dạ Em Ly đã ghi nhận yêu cầu của bạn ạ! Mỗi đóa hoa kẽm nhung tại tiệm đều được nghệ nhân uốn nắn thủ công mềm mại và giữ được độ bền vĩnh cửu. Bạn tham khảo các mẫu hoa dưới đây nhé ạ!`;
      }
    }

    return res.json({
      reply: replyText,
      suggestedProducts: matchedProducts.length > 0 ? matchedProducts : products.slice(0, 3)
    });
  } catch (err) {
    console.error('Lỗi API Chat:', err);
    return res.status(500).json({ error: 'Lỗi xử lý phản hồi chat' });
  }
});

// Fallback 404 cho API
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Đường dẫn API ${req.method} ${req.url} không tồn tại` } });
});

export function getLanIpAddress() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(nets)) {
    const lowerName = name.toLowerCase();
    // Bỏ qua hoàn toàn interface ảo VirtualBox, VMware, WSL, vEthernet, Hyper-V
    const isVirtual = lowerName.includes('virtual') ||
                      lowerName.includes('vbox') ||
                      lowerName.includes('vmware') ||
                      lowerName.includes('wsl') ||
                      lowerName.includes('vethernet') ||
                      lowerName.includes('pseudo') ||
                      lowerName.includes('hyper-v');

    if (isVirtual) continue;

    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        // Bỏ qua dải IP của VirtualBox Host-Only Adapter (192.168.56.x) hoặc APIPA (169.254.x.x)
        if (net.address.startsWith('192.168.56.') || net.address.startsWith('169.254.')) continue;

        // Ưu tiên mạng Wi-Fi hơn mạng dây Ethernet vật lý
        const isWifi = lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wireless');
        candidates.push({
          address: net.address,
          priority: isWifi ? 2 : 1
        });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0]?.address || '127.0.0.1';
}

let server = null;
let expiryTimer = null;

export const startServer = (port = PORT, host = '0.0.0.0') => {
  if (server) return server;
  const lanIp = getLanIpAddress();
  server = app.listen(port, host, () => {
    console.log(`================================================================`);
    console.log(`🌸 Shop Hoa Fullstack Backend (Hexagonal + MySQL 8.0)`);
    console.log(`🌐 Local:   http://localhost:${port}`);
    console.log(`📱 LAN IP:  http://${lanIp}:${port} (Mở trên điện thoại cùng mạng WiFi)`);
    console.log(`💎 Cơ sở dữ liệu: MySQL 8.0 via Prisma ORM (Không còn json-server/db.json)`);
    console.log(`🔐 Bảo mật: Bcrypt 10 rounds + JWT RFC 7519 + Sharp Image Sanitizer`);
    console.log(`⏱️ Auto-expiry Job: Hủy đơn SePay quá hạn (${container.env.PENDING_PAYMENT_TTL_MINUTES} phút) mỗi 5 phút`);
    console.log(`================================================================`);
  });
  expiryTimer = container.orderExpiryService.start();
  return server;
};

export const stopServer = () => {
  if (expiryTimer) {
    container.orderExpiryService.stop();
    expiryTimer = null;
  }
  if (server) {
    server.close();
    server = null;
  }
};

// Chi khoi chay listener va timer mac dinh khi file duoc thuc thi truc tiep (node server.js)
// Khi duoc import boi cac file test (E2E / Integration), test runner tu quan ly ephemeral port rieng
const isDirectRun = Boolean(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename));
if (isDirectRun) {
  startServer();

  const gracefulShutdown = () => {
    stopServer();
    process.exit(0);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

export { app, server };
export default app;
