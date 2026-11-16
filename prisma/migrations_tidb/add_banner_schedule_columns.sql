-- Migration: Thêm cột hẹn ngày hiển thị tự động cho Banner chiến dịch
-- Thực thi trên TiDB Cloud hoặc MySQL 8.0

ALTER TABLE banners ADD COLUMN start_date DATETIME NULL;
ALTER TABLE banners ADD COLUMN end_date DATETIME NULL;
