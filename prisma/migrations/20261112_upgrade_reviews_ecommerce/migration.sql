ALTER TABLE `reviews`
  ADD COLUMN `images_json` TEXT NULL,
  ADD COLUMN `helpful_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `edited_at` DATETIME(0) NULL;

CREATE TABLE `review_helpful_votes` (
  `id` VARCHAR(36) NOT NULL,
  `review_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_review_helpful_unique` (`review_id`, `user_id`),
  INDEX `fk_helpful_user` (`user_id`),
  CONSTRAINT `fk_helpful_review`
    FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_helpful_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

