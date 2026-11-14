-- TiDB Sync Metadata Script for Products
-- Run this in TiDB Cloud SQL Editor if you wish to sync all 19 products metadata
USE shop_hoa_db;
UPDATE products SET color = 'hong', flower_type = 'tulip', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-001';
UPDATE products SET color = 'cam', flower_type = 'hoa-hong', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-002';
UPDATE products SET color = 'vang', flower_type = 'huong-duong', occasion = '20-11', material = 'kem-nhung' WHERE id = 'PROD-003';
UPDATE products SET color = 'hong', flower_type = 'tulip', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-004';
UPDATE products SET color = 'vang', flower_type = 'huong-duong', occasion = 'khai-truong', material = 'kem-nhung' WHERE id = 'PROD-005';
UPDATE products SET color = 'xanh', flower_type = 'baby-lavender', occasion = 'ky-niem', material = 'kem-nhung' WHERE id = 'PROD-006';
UPDATE products SET color = 'trang', flower_type = 'hoa-ly-cuc', occasion = '20-11', material = 'kem-nhung' WHERE id = 'PROD-007';
UPDATE products SET color = 'tim', flower_type = 'baby-lavender', occasion = 'ky-niem', material = 'kem-nhung' WHERE id = 'PROD-008';
UPDATE products SET color = 'do', flower_type = 'hoa-hong', occasion = 'ky-niem', material = 'kem-nhung' WHERE id = 'PROD-009';
UPDATE products SET color = 'da-sac', flower_type = 'tulip', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-010';
UPDATE products SET color = 'hong', flower_type = 'hoa-ly-cuc', occasion = 'de-ban', material = 'kem-nhung' WHERE id = 'PROD-011';
UPDATE products SET color = 'do', flower_type = 'hoa-hong', occasion = 'ky-niem', material = 'kem-nhung' WHERE id = 'PROD-012';
UPDATE products SET color = 'vang', flower_type = 'huong-duong', occasion = 'khai-truong', material = 'kem-nhung' WHERE id = 'PROD-013';
UPDATE products SET color = 'da-sac', flower_type = 'mau-don', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-014';
UPDATE products SET color = 'vang', flower_type = 'huong-duong', occasion = 'de-ban', material = 'kem-nhung' WHERE id = 'PROD-015';
UPDATE products SET color = 'xanh', flower_type = 'mau-don', occasion = '20-11', material = 'kem-nhung' WHERE id = 'PROD-016';
UPDATE products SET color = 'tim', flower_type = 'mau-don', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-017';
UPDATE products SET color = 'cam', flower_type = 'tulip', occasion = 'sinh-nhat', material = 'kem-nhung' WHERE id = 'PROD-018';
UPDATE products SET color = 'cam', flower_type = 'tulip', occasion = 'tat-ca', material = 'kem-nhung' WHERE id = 'PROD-MWFTAMC6';