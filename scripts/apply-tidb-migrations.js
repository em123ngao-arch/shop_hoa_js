import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('======================================================');
  console.log('🔄 BẮT ĐẦU ĐỒNG BỘ DDL & DỮ LIỆU LÊN DATABASE / TIDB');
  console.log('======================================================\n');

  const dbUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Không tìm thấy DATABASE_URL hoặc TIDB_DATABASE_URL trong môi trường!');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  try {
    // 1. Kiểm tra kết nối
    console.log('1. Kiểm tra kết nối tới Database...');
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('   ✅ Kết nối thành công!');

    // 2. Chạy DDL thêm cột phân loại
    console.log('\n2. Thực thi DDL bổ sung cột metadata cho bảng products...');
    const ddlStatements = [
      "ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `color` VARCHAR(50) DEFAULT 'ket-hop'",
      "ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `flower_type` VARCHAR(50) DEFAULT 'khac'",
      "ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `occasion` VARCHAR(50) DEFAULT 'tat-ca'",
      "ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `material` VARCHAR(50) DEFAULT 'kem-nhung'",
      "ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_color` (`color`)",
      "ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_flower_type` (`flower_type`)",
      "ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_occasion` (`occasion`)",
      "ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_material` (`material`)"
    ];

    for (const sql of ddlStatements) {
      try {
        await prisma.$executeRawUnsafe(sql);
        console.log(`   [OK] ${sql.substring(0, 60)}...`);
      } catch (e) {
        console.warn(`   [WARN/SKIP] ${e.message.split('\n')[0]}`);
      }
    }

    // 3. Chuẩn hóa dữ liệu cho các sản phẩm
    console.log('\n3. Đồng bộ metadata cho toàn bộ sản phẩm...');
    const METADATA_MAPPING = {
      'PROD-001': { color: 'hong', flower_type: 'tulip', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-002': { color: 'cam', flower_type: 'hoa-hong', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-003': { color: 'vang', flower_type: 'huong-duong', occasion: '20-11', material: 'kem-nhung' },
      'PROD-004': { color: 'hong', flower_type: 'tulip', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-005': { color: 'vang', flower_type: 'huong-duong', occasion: 'khai-truong', material: 'kem-nhung' },
      'PROD-006': { color: 'xanh', flower_type: 'baby-lavender', occasion: 'ky-niem', material: 'kem-nhung' },
      'PROD-007': { color: 'trang', flower_type: 'hoa-ly-cuc', occasion: '20-11', material: 'kem-nhung' },
      'PROD-008': { color: 'tim', flower_type: 'baby-lavender', occasion: 'ky-niem', material: 'kem-nhung' },
      'PROD-009': { color: 'do', flower_type: 'hoa-hong', occasion: 'ky-niem', material: 'kem-nhung' },
      'PROD-010': { color: 'da-sac', flower_type: 'tulip', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-011': { color: 'hong', flower_type: 'hoa-ly-cuc', occasion: 'de-ban', material: 'kem-nhung' },
      'PROD-012': { color: 'do', flower_type: 'hoa-hong', occasion: 'ky-niem', material: 'kem-nhung' },
      'PROD-013': { color: 'vang', flower_type: 'huong-duong', occasion: 'khai-truong', material: 'kem-nhung' },
      'PROD-014': { color: 'da-sac', flower_type: 'mau-don', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-015': { color: 'vang', flower_type: 'huong-duong', occasion: 'de-ban', material: 'kem-nhung' },
      'PROD-016': { color: 'xanh', flower_type: 'mau-don', occasion: '20-11', material: 'kem-nhung' },
      'PROD-017': { color: 'tim', flower_type: 'mau-don', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-018': { color: 'cam', flower_type: 'tulip', occasion: 'sinh-nhat', material: 'kem-nhung' },
      'PROD-MWFTAMC6': { color: 'cam', flower_type: 'tulip', occasion: 'tat-ca', material: 'kem-nhung' }
    };

    for (const [id, meta] of Object.entries(METADATA_MAPPING)) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE \`products\` SET \`color\` = '${meta.color}', \`flower_type\` = '${meta.flower_type}', \`occasion\` = '${meta.occasion}', \`material\` = '${meta.material}' WHERE \`id\` = '${id}'`
        );
      } catch (e) {
        console.warn(`   [WARN update ${id}]`, e.message.split('\n')[0]);
      }
    }

    // 4. Xác nhận truy vấn products bằng Prisma
    console.log('\n4. Kiểm tra truy vấn sản phẩm qua Prisma Client...');
    const prods = await prisma.products.findMany({
      take: 5,
      select: { id: true, name: true, price: true, color: true, flower_type: true }
    });
    console.log('   ✅ Đã đọc thành công sản phẩm:', prods.map(p => `${p.id} (${p.color}, ${p.flower_type})`).join(', '));

    console.log('\n======================================================');
    console.log('🎉 ĐỒNG BỘ TOÀN BỘ SCHEMA & METADATA LÊN DATABASE THÀNH CÔNG!');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ Lỗi thực thi migration:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
