-- ============================================================================
-- SCRIPT KHỞI TẠO CƠ SỞ DỮ LIỆU SHOP HOA KẼM NHUNG (shop_hoa_db)
-- HỆ QUẢN TRỊ CSDL: MySQL 8.0+
-- TƯƠNG THÍCH: MySQL Workbench, Prisma ORM, Node.js Backend
-- LƯU Ý QUAN TRỌNG: Script này dùng cho môi trường Development/Chấm thi.
-- Sẽ xóa toàn bộ bảng và khởi tạo lại cấu trúc cùng dữ liệu mẫu chuẩn thực tế.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `shop_hoa_db` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `shop_hoa_db`;

-- CẢNH BÁO: Tắt kiểm tra khóa ngoại để xóa và dựng lại cấu trúc bảng sạch sẽ
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `payment_transactions`;
DROP TABLE IF EXISTS `wishlist_items`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `banners`;
DROP TABLE IF EXISTS `vouchers`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. BẢNG NGƯỜI DÙNG (users)
CREATE TABLE `users` (
  `id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'customer',
  `avatar_url` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`),
  CONSTRAINT `chk_users_role` CHECK (`role` IN ('customer', 'staff', 'admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BẢNG DANH MỤC HOA (categories)
CREATE TABLE `categories` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BẢNG MẪU HOA (products)
CREATE TABLE `products` (
  `id` VARCHAR(36) NOT NULL,
  `category_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `price` INT NOT NULL,
  `original_price` INT NOT NULL,
  `cost_price` INT NOT NULL DEFAULT 0,
  `stock` INT NOT NULL DEFAULT 0,
  `image_url` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `badge` VARCHAR(50) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_products_category` (`category_id`),
  KEY `idx_products_cat_active` (`category_id`, `is_active`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_products_price` CHECK (`price` >= 0),
  CONSTRAINT `chk_products_orig_price` CHECK (`original_price` >= `price`),
  CONSTRAINT `chk_products_stock` CHECK (`stock` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BẢNG MÃ GIẢM GIÁ (vouchers)
CREATE TABLE `vouchers` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `discount_type` VARCHAR(10) NOT NULL DEFAULT 'percent',
  `discount_value` INT NOT NULL,
  `min_order` INT NOT NULL DEFAULT 0,
  `max_discount` INT DEFAULT NULL,
  `scope` VARCHAR(20) NOT NULL DEFAULT 'all',
  `target_category_ids` TEXT DEFAULT NULL,
  `target_product_ids` TEXT DEFAULT NULL,
  `usage_limit` INT DEFAULT NULL,
  `used_count` INT NOT NULL DEFAULT 0,
  `start_date` DATETIME DEFAULT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_vouchers_code` (`code`),
  CONSTRAINT `chk_vouchers_type` CHECK (`discount_type` IN ('percent', 'fixed')),
  CONSTRAINT `chk_vouchers_usage` CHECK (`usage_limit` IS NULL OR `used_count` <= `usage_limit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BẢNG BANNER TRANG CHỦ (banners)
CREATE TABLE `banners` (
  `id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `image_url` VARCHAR(255) NOT NULL,
  `link_url` VARCHAR(255) DEFAULT NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `tag` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `theme` VARCHAR(50) DEFAULT 'default',
  `cta_text` VARCHAR(100) DEFAULT 'Khám Phá Các Mẫu Hoa',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BẢNG ĐƠN ĐẶT HÀNG (orders)
CREATE TABLE `orders` (
  `id` VARCHAR(36) NOT NULL,
  `order_code` VARCHAR(50) NOT NULL,
  `user_id` VARCHAR(64) DEFAULT NULL,
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_phone` VARCHAR(20) NOT NULL,
  `shipping_address` VARCHAR(255) NOT NULL,
  `shipping_fee` INT NOT NULL DEFAULT 0,
  `subtotal` INT NOT NULL DEFAULT 0,
  `discount_amount` INT NOT NULL DEFAULT 0,
  `total_amount` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(20) NOT NULL DEFAULT 'cod',
  `payment_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `voucher_code` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_orders_code` (`order_code`),
  KEY `fk_orders_user` (`user_id`),
  KEY `idx_orders_user_created` (`user_id`, `created_at`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_orders_status` CHECK (`status` IN ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')),
  CONSTRAINT `chk_orders_pay_status` CHECK (`payment_status` IN ('pending', 'paid', 'partially_refunded', 'refunded')),
  CONSTRAINT `chk_orders_pay_method` CHECK (`payment_method` IN ('cod', 'sepay')),
  CONSTRAINT `chk_orders_amounts` CHECK (`total_amount` >= 0 AND `subtotal` >= 0 AND `discount_amount` >= 0 AND `shipping_fee` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. BẢNG CHI TIẾT ĐƠN HÀNG (order_items)
CREATE TABLE `order_items` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `product_id` VARCHAR(36) NOT NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` INT NOT NULL,
  `cost_price` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_order_items_order` (`order_id`),
  KEY `fk_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_order_items_qty` CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_items_price` CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. BẢNG ĐÁNH GIÁ & BÌNH LUẬN (reviews)
CREATE TABLE `reviews` (
  `id` VARCHAR(36) NOT NULL,
  `product_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `rating` TINYINT NOT NULL DEFAULT 5,
  `comment` TEXT NOT NULL,
  `images_json` TEXT DEFAULT NULL,
  `helpful_count` INT NOT NULL DEFAULT 0,
  `is_hidden` TINYINT(1) NOT NULL DEFAULT 0,
  `reply` TEXT DEFAULT NULL,
  `reply_date` DATETIME DEFAULT NULL,
  `reply_by` VARCHAR(100) DEFAULT NULL,
  `is_verified_buyer` TINYINT(1) NOT NULL DEFAULT 0,
  `edited_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_product_review` (`product_id`, `user_id`),
  KEY `fk_reviews_user` (`user_id`),
  KEY `idx_reviews_prod_hidden` (`product_id`, `is_hidden`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `review_helpful_votes` (
  `id` VARCHAR(36) NOT NULL,
  `review_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_review_helpful_unique` (`review_id`, `user_id`),
  KEY `fk_helpful_user` (`user_id`),
  CONSTRAINT `fk_helpful_review` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_helpful_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `review_comments` (
  `id` VARCHAR(36) NOT NULL,
  `review_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `content` TEXT NOT NULL,
  `is_verified_buyer` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rev_comment_review_created` (`review_id`, `created_at`),
  KEY `fk_rev_comment_user` (`user_id`),
  CONSTRAINT `fk_rev_comment_review` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rev_comment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. BẢNG THÔNG BÁO TIẾN TRÌNH ĐƠN (notifications)
CREATE TABLE `notifications` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `order_id` VARCHAR(36) DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notif_user` (`user_id`),
  KEY `fk_notif_order` (`order_id`),
  KEY `idx_notif_user_read` (`user_id`, `is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notif_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. BẢNG HOA YÊU THÍCH (wishlist_items)
CREATE TABLE `wishlist_items` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_product_wishlist` (`user_id`, `product_id`),
  KEY `fk_wishlist_product` (`product_id`),
  CONSTRAINT `fk_wishlist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wishlist_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. BẢNG ĐỐI SOÁT THANH TOÁN SEPAY (payment_transactions)
CREATE TABLE `payment_transactions` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'sepay',
  `provider_tx_id` VARCHAR(100) NOT NULL,
  `amount` INT NOT NULL,
  `bank_brand` VARCHAR(50) DEFAULT NULL,
  `account_number` VARCHAR(50) DEFAULT NULL,
  `transaction_date` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_sepay_provider_tx` (`provider_tx_id`),
  KEY `fk_pay_order` (`order_id`),
  CONSTRAINT `fk_pay_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- NẠP DỮ LIỆU MẪU CHUẨN THỰC TẾ (SEED DATA)
-- ============================================================================

-- 1. Seed Danh mục
INSERT INTO `categories` (`id`, `name`, `slug`, `description`) VALUES
('1', 'Hoa Kẽm Nhung', 'kem-nhung', 'Hoa thủ công từ sợi kẽm nhung cao cấp mềm mịn, màu sắc pastel thanh lịch, độ bền vĩnh cửu.'),
('2', 'Bó Hoa Sinh Nhật', 'sinh-nhat', 'Các mẫu bó hoa tươi tắn rực rỡ chúc mừng sinh nhật ý nghĩa.'),
('3', 'Giỏ & Hộp Hoa', 'gio-hop-hoa', 'Giỏ hoa để bàn, hộp hoa quà tặng sang trọng.'),
('4', 'Hoa Để Bàn Mini', 'de-ban', 'Chậu hoa kẽm nhung mini trang trí bàn học, bàn làm việc.'),
('5', 'Hoa Khai Trương', 'khai-truong', 'Kệ hoa, giỏ hoa phát tài phát lộc chúc mừng khai trương hồng phát.');

-- 2. Seed Tài khoản mẫu (Bcrypt hash đã xác thực bằng bcrypt.compareSync trả về true)
-- Mật khẩu demo:
-- - admin@shophoa.example: admin123 ($2b$10$s7cC3Ks.S.Zkt5b/3SvnzeEQzJayWvYsdY5rYP7ADhnfazodLMgo.)
-- - Các tài khoản còn lại: 123456 ($2b$10$jtHjQNjBwQW6tvIEgjNADehZAzmFbT0AeaESk0hEqlyK1Xh4hFhH6)
INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `phone`, `role`, `avatar_url`, `is_active`) VALUES
('USR-ADMIN-01', 'admin@shophoa.example', '$2b$10$s7cC3Ks.S.Zkt5b/3SvnzeEQzJayWvYsdY5rYP7ADhnfazodLMgo.', 'Quản Trị Viên Trưởng', '0908889999', 'admin', NULL, 1),
('USR-STAFF-01', 'staff@shophoa.example', '$2b$10$jtHjQNjBwQW6tvIEgjNADehZAzmFbT0AeaESk0hEqlyK1Xh4hFhH6', 'Nguyễn Thị Kế Toán', '0907778888', 'staff', NULL, 1),
('USR-CUST-01', 'customer1@shophoa.example', '$2b$10$jtHjQNjBwQW6tvIEgjNADehZAzmFbT0AeaESk0hEqlyK1Xh4hFhH6', 'Trần Thị Mai', '0912345678', 'customer', NULL, 1),
('USR-CUST-02', 'customer2@shophoa.example', '$2b$10$jtHjQNjBwQW6tvIEgjNADehZAzmFbT0AeaESk0hEqlyK1Xh4hFhH6', 'Lê Hoàng Nam', '0933456789', 'customer', NULL, 1),
('USR-CUST-03', 'customer3@shophoa.example', '$2b$10$jtHjQNjBwQW6tvIEgjNADehZAzmFbT0AeaESk0hEqlyK1Xh4hFhH6', 'Phạm Hương Giang', '0988765432', 'customer', NULL, 1);

-- 3. Seed 15 Mẫu Hoa (Đã đổi tên file ảnh sạch sẽ, original_price chuẩn xác với badge giảm giá)
INSERT INTO `products` (`id`, `category_id`, `name`, `price`, `original_price`, `cost_price`, `stock`, `image_url`, `description`, `badge`) VALUES
('PROD-001', '1', 'Bó Hoa Kẽm Nhung Tulip Pastel', 350000, 350000, 150000, 24, './images/300.png', 'Bó hoa tulip handmade từ sợi kẽm nhung cao cấp mềm mịn, màu sắc pastel thanh lịch, độ bền vĩnh cửu theo thời gian.', 'Handmade'),
('PROD-002', '1', 'Bó Hoa Hồng Kẽm Nhung Sunset', 420000, 450000, 180000, 16, './images/350.png', 'Sắc cam hoàng hôn rực rỡ tượng trưng cho nhiệt huyết và tình cảm nồng ấm. Từng cánh hoa được uốn tỉ mỉ.', 'Bán chạy'),
('PROD-003', '1', 'Bó Hoa Kẽm Nhung Hướng Dương Rực Rỡ', 390000, 390000, 160000, 14, './images/350k.jpg', 'Những đóa hướng dương kẽm nhung bung nở tràn đầy năng lượng tích cực, luôn hướng về phía mặt trời.', 'Yêu thích'),
('PROD-004', '2', 'Bó Hoa Tulip Hồng Phấn Mộng Mơ', 450000, 511000, 200000, 19, './images/399.png', 'Bó hoa phối sắc hồng phấn ngọt ngào và tinh khôi, gói giấy lụa Hàn Quốc cao cấp kèm nơ ruy băng sang trọng.', '-12%'),
('PROD-005', '3', 'Giỏ Hoa Kẽm Nhung Garden Sunshine', 480000, 480000, 220000, 12, './images/402.png', 'Giỏ hoa kẽm nhung kết hợp hoa cúc họa mi, hướng dương và hoa hồng, mang trọn vẹn khu vườn ánh nắng ban mai.', 'Mới'),
('PROD-006', '1', 'Bó Hoa Baby Kẽm Nhung Xanh Biển', 600000, 600000, 250000, 10, './images/baby-xanh-bien.png', 'Bó hoa baby kẽm nhung sắc xanh biển đại dương thanh khiết, uốn nắn thủ công cầu kỳ.', 'Handmade'),
('PROD-007', '2', 'Bó Hoa Kẽm Nhung Cúc Họa Mi Tinh Khôi', 500000, 500000, 210000, 16, './images/450k.png', 'Cúc họa mi kẽm nhung trắng tinh khôi kết hợp nơ xanh trang nhã, biểu tượng của sự thuần khiết.', 'Bán chạy'),
('PROD-008', '1', 'Bó Hoa Kẽm Nhung Lavender Tím Huế', 425000, 500000, 180000, 22, './images/499.jpg', 'Những nhành hoa oải hương tím biếc uốn nắn mềm mại, bền màu vĩnh viễn, lưu giữ kỷ niệm tình yêu son sắt.', '-15%'),
('PROD-009', '3', 'Hộp Hoa Kẽm Nhung Trái Tim Sweet Love', 490000, 550000, 220000, 14, './images/500k.png', 'Hộp hoa trái tim phối hồng và đỏ nồng nàn, món quà tỏ tình lãng mạn bền lâu.', 'Hot'),
('PROD-010', '2', 'Bó Hoa Kẽm Nhung Đa Sắc Cầu Vồng', 580000, 580000, 240000, 15, './images/501.png', 'Bó hoa phối 7 sắc màu rực rỡ từ kẽm nhung loại 1, tràn đầy năng lượng tươi vui.', 'Sáng tạo'),
('PROD-011', '4', 'Bình Hoa Kẽm Nhung Để Bàn Thanh Lịch', 600000, 600000, 260000, 8, './images/503.png', 'Bình hoa để bàn sang trọng với các đóa hồng, tulip và mẫu đơn kẽm nhung kết hợp.', 'Trang trí'),
('PROD-012', '2', 'Bó Hoa Kẽm Nhung Hoàng Gia Queen', 650000, 765000, 290000, 10, './images/550k.png', 'Bó hoa cỡ lớn phối hoa hồng nhung đỏ và vương miện hoàng gia quý phái.', '-15%'),
('PROD-013', '5', 'Giỏ Hoa Kẽm Nhung Khai Trương Tài Lộc', 720000, 720000, 320000, 8, './images/600k.png', 'Giỏ hoa kẽm nhung tông vàng kim rực rỡ, đại cát đại lợi chúc mừng khai trương hồng phát.', 'May mắn'),
('PROD-014', '1', 'Bó Hoa Nghệ Thuật Bloom Of Spring', 520000, 520000, 230000, 12, './images/bloom-of-spring.png', 'Tác phẩm hoa kẽm nhung độc bản với phong cách phối màu nghệ thuật đương đại.', 'Độc bản'),
('PROD-015', '4', 'Chậu Hoa Kẽm Nhung Mini Để Bàn Xinh', 320000, 320000, 130000, 20, './images/300.png', 'Chậu hoa kẽm nhung nhỏ nhắn để bàn học, bàn làm việc tạo điểm nhấn thư thái.', 'Mini');

-- 4. Seed Vouchers (used_count = 1 cho HOAXUAN20 vì khớp với đơn hàng mẫu DH-1002 bên dưới)
INSERT INTO `vouchers` (`id`, `code`, `name`, `discount_type`, `discount_value`, `min_order`, `max_discount`, `scope`, `usage_limit`, `used_count`, `is_active`) VALUES
('VOUCHER-01', 'HOAXUAN20', 'Giảm 20% Đón Xuân', 'percent', 20, 300000, 100000, 'all', 100, 1, 1),
('VOUCHER-02', 'FREESHIP', 'Giảm 30.000đ Phí Vận Chuyển', 'fixed', 30000, 250000, 30000, 'all', 200, 0, 1),
('VOUCHER-03', 'WELCOME10', 'Ưu đãi khách hàng mới', 'percent', 10, 200000, 50000, 'all', 500, 0, 1);

-- 5. Seed Banners
INSERT INTO `banners` (`id`, `title`, `image_url`, `link_url`, `display_order`, `is_active`, `tag`, `description`, `theme`, `cta_text`) VALUES
('1', 'Khai Xuân Đắc Lộc <br>Vạn Sự Cát Tường 2027', './images/Lunar New Year Blossom Bouquet.png', '#products', 1, 1, '🧧 Khai Xuân Đắc Lộc 2027', 'Hộp hoa kẽm nhung phối sắc đỏ vàng may mắn, hoa mai phú quý cùng mèo thần tài chiêu tài đón lộc. Món quà trao gửi trọn vẹn lời chúc Bình An và Thịnh Vượng cho năm mới 2027.', 'tet', 'Sắm Hoa Đón Tết 2027'),
('2', 'Trao Gửi Yêu Thương <br>Bền Đẹp Theo Năm Tháng', './images/350.png', '#products', 2, 1, '🌿 Tinh Hoa Nghệ Thuật Handmade', 'Từng cành hoa được uốn nắn thủ công 100% từ sợi kẽm nhung cao cấp mềm mịn, giữ trọn vẻ tươi tắn vĩnh cửu. Món quà sinh nhật và kỷ niệm ý nghĩa nhất.', 'default', 'Khám Phá Các Mẫu Hoa'),
('3', 'Khai Trương Hồng Phát <br>Tài Lộc Thịnh Vượng', './images/300.png', '#products', 3, 1, '⚡ Siêu Ưu Đãi Giờ Vàng', 'Bó hoa tulip phối sắc cam vàng rực rỡ tượng trưng cho nhiệt huyết và thịnh vượng, món quà tinh tế gửi trọn lời chúc may mắn phát tài.', 'sale', 'Săn Ưu Đãi Ngay'),
('4', 'Gửi Trọn Tình Yêu <br>Hoa Nhung Vĩnh Cửu', './images/500k.png', '#products', 4, 1, '💖 Mùa Yêu Thương Lãng Mạn', 'Bó hoa hồng kẽm nhung cánh sen ngọt ngào cùng thiệp chúc mừng viết tay thủ công, thay vạn lời muốn nói gửi đến người thương trong dịp Valentine.', 'valentine', 'Khám Phá Mẫu Hoa Tình Yêu');

-- 6. Seed Đơn Hàng Mẫu (Đủ trạng thái phục vụ hiển thị Dashboard và Quản trị đơn hàng)
INSERT INTO `orders` (`id`, `order_code`, `user_id`, `customer_name`, `customer_phone`, `shipping_address`, `shipping_fee`, `subtotal`, `discount_amount`, `total_amount`, `status`, `payment_method`, `payment_status`, `voucher_code`, `created_at`, `completed_at`) VALUES
('ORD-001', 'DH-1001', 'USR-CUST-01', 'Trần Thị Mai', '0912345678', '123 Nguyễn Huệ, Quận 1, TP.HCM', 0, 450000, 0, 450000, 'completed', 'cod', 'paid', NULL, '2026-11-01 09:15:00', '2026-11-02 15:30:00'),
('ORD-002', 'DH-1002', 'USR-CUST-02', 'Lê Hoàng Nam', '0933456789', '45 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM', 0, 840000, 100000, 740000, 'shipping', 'sepay', 'paid', 'HOAXUAN20', '2026-11-08 14:20:00', NULL),
('ORD-003', 'DH-1003', 'USR-CUST-03', 'Phạm Hương Giang', '0988765432', '789 Trần Hưng Đạo, Quận 5, TP.HCM', 30000, 390000, 0, 420000, 'confirmed', 'sepay', 'paid', NULL, '2026-11-09 11:00:00', NULL),
('ORD-004', 'DH-1004', NULL, 'Nguyễn Văn Khách (Vãng lai)', '0901112233', '12 Phan Xích Long, Phú Nhuận, TP.HCM', 30000, 350000, 0, 380000, 'pending', 'cod', 'pending', NULL, '2026-11-10 08:30:00', NULL);

-- 7. Seed Chi tiết Đơn hàng mẫu (Khớp với sản phẩm và tồn kho bị trừ ở trên)
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `product_name`, `quantity`, `unit_price`) VALUES
('ITEM-001', 'ORD-001', 'PROD-004', 'Bó Hoa Tulip Hồng Phấn Mộng Mơ', 1, 450000),
('ITEM-002', 'ORD-002', 'PROD-002', 'Bó Hoa Hồng Kẽm Nhung Sunset', 2, 420000),
('ITEM-003', 'ORD-003', 'PROD-003', 'Bó Hoa Kẽm Nhung Hướng Dương Rực Rỡ', 1, 390000),
('ITEM-004', 'ORD-004', 'PROD-001', 'Bó Hoa Kẽm Nhung Tulip Pastel', 1, 350000);

-- 8. Seed Giao dịch SePay mẫu (Khớp với đơn hàng ORD-002 và ORD-003)
INSERT INTO `payment_transactions` (`id`, `order_id`, `provider`, `provider_tx_id`, `amount`, `bank_brand`, `account_number`, `transaction_date`, `created_at`) VALUES
('PAY-001', 'ORD-002', 'sepay', 'SEPAY-TXN-984721', 740000, 'Sacombank', '70207003455', '2026-11-08 14:25:10', '2026-11-08 14:25:12'),
('PAY-002', 'ORD-003', 'sepay', 'SEPAY-TXN-985102', 420000, 'Sacombank', '70207003455', '2026-11-09 11:05:40', '2026-11-09 11:05:42');

-- 9. Seed Đánh giá mẫu đa dạng (Nhiều khách hàng khác nhau, có 4 sao, 5 sao, 3 sao)
INSERT INTO `reviews` (`id`, `product_id`, `user_id`, `rating`, `comment`, `is_hidden`, `created_at`) VALUES
('REV-001', 'PROD-001', 'USR-CUST-01', 5, 'Bó hoa tulip màu pastel ở ngoài đẹp hơn trong ảnh rất nhiều! Cánh hoa mềm mịn, bạn gái mình rất thích.', 0, '2026-11-02 16:00:00'),
('REV-002', 'PROD-002', 'USR-CUST-02', 4, 'Hoa uốn tỉ mỉ, màu cam hoàng hôn ấm áp. Shop đóng gói cẩn thận có bọc bóng khí.', 0, '2026-11-06 10:15:00'),
('REV-003', 'PROD-004', 'USR-CUST-03', 5, 'Tone hồng phấn rất xinh xắn, nơ ruy băng chỉn chu. Mình sẽ ủng hộ shop tiếp vào các dịp tới!', 0, '2026-11-07 14:20:00'),
('REV-004', 'PROD-003', 'USR-CUST-01', 3, 'Hoa làm đẹp và tươi sáng nhưng hôm giao hàng shipper bị trễ mất 1 tiếng so với hẹn ban đầu.', 0, '2026-11-09 17:45:00');

-- 10. Seed Thông báo mẫu
INSERT INTO `notifications` (`id`, `user_id`, `order_id`, `title`, `message`, `is_read`, `created_at`) VALUES
('NOTIF-001', 'USR-CUST-01', 'ORD-001', 'Giao hàng thành công đơn #DH-1001', 'Đơn hàng #DH-1001 đã được giao tận tay thành công. Cảm ơn bạn!', 1, '2026-11-02 15:30:00'),
('NOTIF-002', 'USR-CUST-02', 'ORD-002', 'Xác nhận thanh toán đơn #DH-1002', 'Đã nhận chuyển khoản 740.000đ qua SePay. Nghệ nhân đang kết hoa!', 0, '2026-11-08 14:25:12');
