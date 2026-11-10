/**
 * server.js - Máy chủ Express Fullstack JavaScript (Clean / Hexagonal Architecture)
 * 100% Thuần Express + Prisma ORM + MySQL 8.0 (Đã loại bỏ hoàn toàn json-server & db.json)
 * Cổng: 4000
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { container } from './server/infrastructure/config/container.js';

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
const PORT = process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Đảm bảo thư mục uploads/avatars tồn tại để lưu ảnh đại diện WebP
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 2. Middlewares toàn cục
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Phục vụ static files cho Frontend và thư mục uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

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

// Lấy danh sách đơn hàng (Có phân quyền IDOR: khách xem của mình, admin/staff xem tất cả)
app.get(['/api/orders', '/orders'], container.authMiddleware, container.orderController.getOrders);
app.post('/api/orders/lookup', container.orderController.lookupGuestOrder);

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
app.get('/api/reviews', container.optionalAuthMiddleware, container.reviewController.getReviews);
app.post('/api/reviews', container.authMiddleware, container.reviewController.createReview);
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
app.get('/api/sepay/check-payment/:orderId', container.paymentController.checkPayment);
app.post('/api/sepay/simulate-payment/:orderId', container.paymentController.simulatePayment);
app.post('/api/sepay/webhook', container.paymentController.webhook);

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
    const promotions = await container.catalogRepo.findPromotions();

    const query = message.toLowerCase();
    const matchedProducts = products.filter(p => {
      return p.name.toLowerCase().includes(query) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(query)) ||
        (p.description && p.description.toLowerCase().includes(query));
    }).slice(0, 3);

    const flowerKnowledge = products.slice(0, 6).map(p => `- ${p.name} (Giá: ${p.price.toLocaleString()}đ, Danh mục: ${p.categoryName || 'Hoa handmade'})`).join('\n');
    const promoKnowledge = promotions.filter(p => p.active).map(p => `- Mã ${p.code}: Giảm ${p.discountValue || p.discountPercent}${p.discountType === 'fixed' ? 'đ' : '%'}`).join('\n');

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

// Khởi chạy máy chủ
const server = app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🌸 Shop Hoa Fullstack Backend (Hexagonal + MySQL 8.0)`);
  console.log(`🌐 Server đang lắng nghe tại: http://localhost:${PORT}`);
  console.log(`💎 Cơ sở dữ liệu: MySQL 8.0 via Prisma ORM (Không còn json-server/db.json)`);
  console.log(`🔐 Bảo mật: Bcrypt 10 rounds + JWT RFC 7519 + Sharp Image Sanitizer`);
  console.log(`================================================================`);
});

export default app;
