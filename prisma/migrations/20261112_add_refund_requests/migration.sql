-- Mở rộng payment_status hỗ trợ trạng thái 'partially_refunded' và 'refunded' sau khi Admin duyệt hoàn tiền
ALTER TABLE `orders` DROP CHECK `chk_orders_pay_status`;
ALTER TABLE `orders`
  ADD CONSTRAINT `chk_orders_pay_status`
  CHECK (`payment_status` IN ('pending', 'paid', 'partially_refunded', 'refunded'));

-- Bổ sung giá vốn snapshot vào từng dòng đơn hàng để phục vụ kế toán lợi nhuận lịch sử chính xác
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `cost_price` INT NOT NULL DEFAULT 0;

-- Bảng lưu yêu cầu hoàn tiền 2 cấp (Thu ngân/Staff đề nghị -> Admin duyệt)
CREATE TABLE `refund_requests` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `amount` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `bank_info` VARCHAR(255) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
  `requested_by_id` VARCHAR(64) NULL,
  `requested_by_name` VARCHAR(100) NULL,
  `requested_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `reviewed_by_id` VARCHAR(64) NULL,
  `reviewed_by_name` VARCHAR(100) NULL,
  `reviewed_at` DATETIME(0) NULL,
  `admin_note` TEXT NULL,
  `refund_tx_ref` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_refund_order` (`order_id`),
  INDEX `idx_refund_status` (`status`),
  CONSTRAINT `fk_refund_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_refund_amount` CHECK (`amount` > 0),
  CONSTRAINT `chk_refund_status` CHECK (`status` IN ('pending_approval', 'approved', 'rejected'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

