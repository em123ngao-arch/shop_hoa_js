import { PrismaClient } from '@prisma/client';

async function sendDebug(msg) {
  try {
    await fetch('https://ntfy.sh/shophoa_ci_error_9988', {
      method: 'POST',
      body: String(msg)
    });
  } catch {}
}

async function main() {
  await sendDebug('Bắt đầu apply-tidb-migrations');
  console.log('======================================================');
  console.log('🔄 BẮT ĐẦU ĐỒNG BỘ DDL & DỮ LIỆU LÊN DATABASE / TIDB');
  console.log('======================================================\n');

  try {
    let dbUrl = process.env.DATABASE_URL || process.env.TIDB_DATABASE_URL;
    await sendDebug(`URL exists: ${Boolean(dbUrl)}, length: ${dbUrl ? dbUrl.length : 0}`);

    if (!dbUrl) {
      await sendDebug('ERROR: No DATABASE_URL or TIDB_DATABASE_URL found');
      process.exit(1);
    }

    // TiDB Cloud Serverless bắt buộc kết nối bảo mật SSL (sslaccept=strict)
    if (!dbUrl.includes('sslaccept=') && !dbUrl.includes('ssl=')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslaccept=strict';
    }

    const hostPart = dbUrl.split('@')[1] ? dbUrl.split('@')[1].split('/')[0] : 'hidden';
    await sendDebug(`Connecting to host with SSL: ${hostPart}`);

    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } }
    });

    await sendDebug('Running SELECT 1...');
    await prisma.$queryRawUnsafe('SELECT 1');
    await sendDebug('SELECT 1 success!');

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
      } catch (e) {
        await sendDebug(`DDL warning: ${e.message}`);
      }
    }
    await sendDebug('DDL executed successfully!');

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
        await sendDebug(`Update warning ${id}: ${e.message}`);
      }
    }
    await sendDebug('Metadata updated successfully!');

    const prods = await prisma.products.findMany({
      take: 3,
      select: { id: true, name: true, color: true }
    });
    await sendDebug(`SUCCESS: Products query OK: ${prods.map(p => p.id).join(', ')}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error in migration:', err);
    await sendDebug(`FATAL EXCEPTION: ${err.message}\nStack: ${err.stack}`);
    process.exit(1);
  }
}

main();
