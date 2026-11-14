-- ========================================================================
-- TiDB Cloud & MySQL 8.0 Migration: Bổ sung metadata phân loại mẫu hoa
-- Tương thích 100% với TiDB Serverless / TiDB Dedicated & MySQL 8.0
-- ========================================================================

USE `shop_hoa_db`;

-- 1. Thêm 4 cột phân loại vào bảng products
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `color` VARCHAR(50) DEFAULT 'ket-hop',
  ADD COLUMN IF NOT EXISTS `flower_type` VARCHAR(50) DEFAULT 'khac',
  ADD COLUMN IF NOT EXISTS `occasion` VARCHAR(50) DEFAULT 'tat-ca',
  ADD COLUMN IF NOT EXISTS `material` VARCHAR(50) DEFAULT 'kem-nhung';

-- 2. Thêm chỉ mục (Index) tối ưu hóa tốc độ truy vấn phân tán trên TiDB
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_color` (`color`);
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_flower_type` (`flower_type`);
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_occasion` (`occasion`);
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_material` (`material`);

