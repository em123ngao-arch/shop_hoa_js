ALTER TABLE `orders`
  ADD COLUMN `customer_email` VARCHAR(254) NULL,
  ADD COLUMN `recipient_name` VARCHAR(100) NULL,
  ADD COLUMN `recipient_phone` VARCHAR(20) NULL,
  ADD COLUMN `is_gift` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `delivery_slot` VARCHAR(100) NULL,
  ADD COLUMN `has_greeting_card` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `card_message` TEXT NULL,
  ADD COLUMN `customer_note` TEXT NULL;

UPDATE `orders`
SET `recipient_name` = `customer_name`, `recipient_phone` = `customer_phone`
WHERE `recipient_name` IS NULL OR `recipient_phone` IS NULL;
