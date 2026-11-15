-- ========================================================================
-- TiDB Cloud & MySQL 8.0 Migration: Bổ sung cột khu vực và tọa độ ghim đơn hàng
-- Tương thích 100% với TiDB Serverless & MySQL 8.0
-- ========================================================================

USE `shop_hoa_db`;

ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `delivery_zone` VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS `delivery_latitude` DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS `delivery_longitude` DOUBLE NULL;

