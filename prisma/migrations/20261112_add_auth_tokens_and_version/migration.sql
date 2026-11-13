ALTER TABLE `users`
  ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `password_reset_tokens` (
  `id` VARCHAR(40) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `expires_at` DATETIME(0) NOT NULL,
  `used_at` DATETIME(0) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_password_reset_token_hash` (`token_hash`),
  INDEX `idx_password_reset_user_expiry` (`user_id`, `expires_at`),
  CONSTRAINT `fk_password_reset_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);
