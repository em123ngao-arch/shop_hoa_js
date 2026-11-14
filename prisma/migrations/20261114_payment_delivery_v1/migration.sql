ALTER TABLE `orders`
  ADD COLUMN `delivery_area` VARCHAR(100) NULL,
  ADD COLUMN `delivery_place_id` VARCHAR(255) NULL,
  ADD COLUMN `delivery_distance_meters` INT NULL,
  ADD COLUMN `delivery_quote_at` DATETIME(0) NULL,
  ADD COLUMN `payment_plan` VARCHAR(40) NOT NULL DEFAULT 'legacy_cod',
  ADD COLUMN `terms_version` VARCHAR(40) NULL,
  ADD COLUMN `terms_accepted_at` DATETIME(0) NULL;

UPDATE `orders`
SET `payment_plan` = CASE
  WHEN `payment_method` = 'sepay' THEN 'legacy_sepay_full'
  ELSE 'legacy_cod'
END;

ALTER TABLE `orders` DROP CHECK `chk_orders_pay_status`;
ALTER TABLE `orders`
  ADD CONSTRAINT `chk_orders_pay_status`
  CHECK (`payment_status` IN ('pending', 'partially_paid', 'paid', 'partially_refunded', 'refunded'));

CREATE TABLE `payment_intents` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `purpose` VARCHAR(40) NOT NULL,
  `reference_code` VARCHAR(32) NOT NULL,
  `amount` INT NOT NULL,
  `received_amount` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `expires_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `paid_at` DATETIME(0) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_payment_intent_reference` (`reference_code`),
  INDEX `idx_payment_intent_order_status` (`order_id`, `status`),
  CONSTRAINT `fk_payment_intent_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_payment_intent_amount` CHECK (`amount` > 0 AND `received_amount` >= 0),
  CONSTRAINT `chk_payment_intent_status` CHECK (`status` IN ('pending', 'partially_paid', 'paid', 'needs_review', 'expired', 'cancelled'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `payment_transactions`
  ADD COLUMN `payment_intent_id` VARCHAR(36) NULL,
  ADD INDEX `fk_payment_tx_intent` (`payment_intent_id`),
  ADD CONSTRAINT `fk_payment_tx_intent` FOREIGN KEY (`payment_intent_id`) REFERENCES `payment_intents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payment_intents` ADD COLUMN `related_request_id` VARCHAR(36) NULL;

CREATE TABLE `order_payment_entries` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `payment_intent_id` VARCHAR(36) NULL,
  `entry_type` VARCHAR(40) NOT NULL,
  `direction` VARCHAR(10) NOT NULL,
  `channel` VARCHAR(30) NOT NULL,
  `amount` INT NOT NULL,
  `external_ref` VARCHAR(120) NULL,
  `note` VARCHAR(500) NULL,
  `actor_id` VARCHAR(64) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_order_payment_entry_ref` (`external_ref`),
  INDEX `idx_payment_entry_order_created` (`order_id`, `created_at`),
  INDEX `idx_payment_entry_intent` (`payment_intent_id`),
  CONSTRAINT `fk_payment_entry_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payment_entry_intent` FOREIGN KEY (`payment_intent_id`) REFERENCES `payment_intents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_order_payment_entry` CHECK (`amount` > 0 AND `direction` IN ('in', 'out'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_attempts` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `attempt_number` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `started_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `failed_at` DATETIME(0) NULL,
  `completed_at` DATETIME(0) NULL,
  `fail_reason` VARCHAR(255) NULL,
  `contact_log` TEXT NULL,
  `fee_charged` INT NOT NULL DEFAULT 0,
  `reschedule_deadline` DATETIME(0) NULL,
  `created_by_id` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_delivery_attempt_number` (`order_id`, `attempt_number`),
  INDEX `idx_delivery_attempt_order_status` (`order_id`, `status`),
  INDEX `idx_delivery_reschedule_deadline` (`reschedule_deadline`),
  CONSTRAINT `fk_delivery_attempt_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_delivery_attempt_number` CHECK (`attempt_number` > 0),
  CONSTRAINT `chk_delivery_attempt_status` CHECK (`status` IN ('started', 'failed', 'delivered', 'exception_required'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `delivery_attempts` ADD COLUMN `reminder_sent_at` DATETIME(0) NULL;

CREATE TABLE `order_change_requests` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `change_type` VARCHAR(30) NOT NULL,
  `old_value` TEXT NOT NULL,
  `new_value` TEXT NOT NULL,
  `added_fee` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `requested_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `reviewed_at` DATETIME(0) NULL,
  `reviewed_by_id` VARCHAR(64) NULL,
  `customer_confirmed_at` DATETIME(0) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_order_change_order_status` (`order_id`, `status`),
  CONSTRAINT `fk_order_change_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_order_change_type` CHECK (`change_type` IN ('address', 'phone', 'recipient')),
  CONSTRAINT `chk_order_change_status` CHECK (`status` IN ('pending', 'approved', 'rejected', 'awaiting_payment', 'applied', 'expired'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_cancellation_requests` (
  `id` VARCHAR(36) NOT NULL,
  `order_id` VARCHAR(36) NOT NULL,
  `requested_by` VARCHAR(20) NOT NULL,
  `reason` TEXT NOT NULL,
  `cost_breakdown_json` TEXT NULL,
  `evidence_note` TEXT NULL,
  `deductible_amount` INT NOT NULL DEFAULT 0,
  `refund_amount` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `requested_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `reviewed_at` DATETIME(0) NULL,
  `reviewed_by_id` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_order_cancel_order_status` (`order_id`, `status`),
  CONSTRAINT `fk_order_cancel_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_order_cancel_requester` CHECK (`requested_by` IN ('customer', 'shop')),
  CONSTRAINT `chk_order_cancel_status` CHECK (`status` IN ('pending', 'approved', 'rejected', 'completed')),
  CONSTRAINT `chk_order_cancel_amounts` CHECK (`deductible_amount` >= 0 AND `refund_amount` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `unmatched_payment_transactions` (
  `id` VARCHAR(36) NOT NULL,
  `provider_tx_id` VARCHAR(100) NOT NULL,
  `amount` INT NOT NULL,
  `payment_content` VARCHAR(255) NOT NULL,
  `bank_brand` VARCHAR(50) NULL,
  `account_suffix` VARCHAR(8) NULL,
  `transaction_date` DATETIME(0) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'unmatched',
  `resolution_note` VARCHAR(500) NULL,
  `reviewed_by_id` VARCHAR(64) NULL,
  `reviewed_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_unmatched_payment_provider_tx` (`provider_tx_id`),
  INDEX `idx_unmatched_payment_status_created` (`status`, `created_at`),
  CONSTRAINT `chk_unmatched_payment_amount` CHECK (`amount` > 0),
  CONSTRAINT `chk_unmatched_payment_status` CHECK (`status` IN ('unmatched', 'reviewed'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
