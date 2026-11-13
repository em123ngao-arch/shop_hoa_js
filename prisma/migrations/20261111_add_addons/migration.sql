-- CreateTable addons
CREATE TABLE `addons` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `price` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable order_item_addons
CREATE TABLE `order_item_addons` (
    `id` VARCHAR(36) NOT NULL,
    `order_item_id` VARCHAR(36) NOT NULL,
    `addon_id` VARCHAR(36) NOT NULL,
    `addon_name` VARCHAR(100) NOT NULL,
    `unit_price` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`id`),
    INDEX `fk_item_addon_order_item`(`order_item_id`),
    INDEX `fk_item_addon_addon`(`addon_id`),
    CONSTRAINT `fk_item_addon_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_item_addon_addon` FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default addons idempotent
INSERT INTO `addons` (`id`, `name`, `price`, `is_active`, `created_at`) VALUES
  ('ADDON-LED', 'Đèn LED đom đóm', 15000, true, NOW()),
  ('ADDON-CARD', 'Thiệp viết tay cao cấp', 10000, true, NOW()),
  ('ADDON-BAG', 'Túi kính trong suốt', 20000, true, NOW())
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price` = VALUES(`price`);

