ALTER TABLE `orders`
  ADD COLUMN `delivery_zone` VARCHAR(40) NULL,
  ADD COLUMN `delivery_latitude` DOUBLE NULL,
  ADD COLUMN `delivery_longitude` DOUBLE NULL;
