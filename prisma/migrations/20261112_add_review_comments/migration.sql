CREATE TABLE `review_comments` (
  `id` VARCHAR(36) NOT NULL,
  `review_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `content` TEXT NOT NULL,
  `is_verified_buyer` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_rev_comment_review_created` (`review_id`, `created_at`),
  INDEX `fk_rev_comment_user` (`user_id`),
  CONSTRAINT `fk_rev_comment_review`
    FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rev_comment_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

