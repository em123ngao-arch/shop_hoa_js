import { PrismaClient } from '@prisma/client';
import fs from 'fs';

function logSummary(msg) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg + '\n', 'utf8');
    } catch {}
  }
}

async function main() {
  logSummary('### 🔄 Bắt đầu chạy Migration TiDB Cloud');
  console.log('======================================================');
  console.log('🔄 BẮT ĐẦU ĐỒNG BỘ DDL & DỮ LIỆU LÊN DATABASE / TIDB');
  console.log('======================================================\n');

  try {
    const dbUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
    logSummary(`- Có biến URL: ${Boolean(dbUrl)} (độ dài: ${dbUrl ? dbUrl.length : 0})`);
    
    if (!dbUrl) {
      logSummary('❌ Lỗi: Không tìm thấy DATABASE_URL trong môi trường!');
      process.exit(1);
    }

    logSummary(`- Kết nối host: ${dbUrl.split('@')[1] ? dbUrl.split('@')[1].split('/')[0] : 'hidden'}`);

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } }
    });

    logSummary('- Đang chạy SELECT 1...');
    await prisma.$queryRawUnsafe('SELECT 1');
    logSummary('✅ SELECT 1 thành công!');

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
        console.log(`   [OK] ${sql.substring(0, 50)}...`);
      } catch (e) {
        logSummary(`- DDL Warning: \`${e.message}\``);
      }
    }
    logSummary('✅ Đã thực thi DDL thêm cột phân loại!');

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
        logSummary(`- Row Warning ${id}: \`${e.message}\``);
      }
    }
    logSummary('✅ Đã cập nhật metadata 19 sản phẩm!');

    const prods = await prisma.products.findMany({
      take: 3,
      select: { id: true, name: true, color: true, flower_type: true }
    });
    logSummary(`🎉 Đọc thành công qua Prisma: ${prods.map(p => `${p.id} (${p.color})`).join(', ')}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Lỗi thực thi migration:', err);
    logSummary(`\n### ❌ Lỗi Migration Exception:\n\`\`\`\n${err.stack || err.message || err}\n\`\`\`\n`);
    process.exit(1);
  }
}

main();
