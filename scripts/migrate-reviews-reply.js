import { getPrismaClient } from '../server/infrastructure/db/prisma.js';

async function migrate() {
  const prisma = getPrismaClient();
  console.log('--- ĐANG MỞ RỘNG BẢNG REVIEWS TRÊN MYSQL 8.0 ---');

  const columns = [
    { name: 'reply', sql: 'ALTER TABLE reviews ADD COLUMN reply TEXT NULL' },
    { name: 'reply_date', sql: 'ALTER TABLE reviews ADD COLUMN reply_date DATETIME NULL' },
    { name: 'reply_by', sql: 'ALTER TABLE reviews ADD COLUMN reply_by VARCHAR(100) NULL' },
    { name: 'is_verified_buyer', sql: 'ALTER TABLE reviews ADD COLUMN is_verified_buyer TINYINT(1) NOT NULL DEFAULT 0' }
  ];

  for (const col of columns) {
    try {
      await prisma.$executeRawUnsafe(col.sql);
      console.log(`✅ Đã thêm cột: ${col.name}`);
    } catch (e) {
      if (e.message && e.message.includes('Duplicate column name')) {
        console.log(`ℹ️ Cột ${col.name} đã tồn tại sẵn.`);
      } else {
        console.warn(`Lưu ý cột ${col.name}:`, e.message);
      }
    }
  }

  // Đánh dấu người mua thực tế cho các review cũ của USR-CUST-01 và USR-CUST-02
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE reviews SET is_verified_buyer = 1 WHERE user_id IN ('USR-CUST-01', 'USR-CUST-02')
    `);
    console.log('✅ Đã cập nhật is_verified_buyer = 1 cho các khách mua hoa thực tế.');
  } catch (e) {}

  // Thêm phản hồi mẫu của Shop cho đánh giá trên PROD-001 để hiển thị ngay
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE reviews 
      SET reply = 'Dạ Tiệm Hoa Kẽm Nhung xin chân thành cảm ơn bạn và chúc bạn gái luôn rạng rỡ như đóa hoa nhé! Khi nào có dịp kỷ niệm nhớ ghé lại tiệm để nhận ưu đãi VIP 15% nha 🌸',
          reply_date = NOW(),
          reply_by = 'Tiệm Hoa Nhung (Quản Trị Viên)'
      WHERE product_id = 'PROD-001' AND id = 'REV-PROD001-02'
    `);
    console.log('✅ Đã gán phản hồi mẫu của Shop cho review REV-PROD001-02 trên PROD-001.');
  } catch (e) {}

  const desc = await prisma.$queryRawUnsafe('DESCRIBE reviews');
  console.log('\n--- CẤU TRÚC MỚI CỦA BẢNG REVIEWS ---');
  console.log(desc.map(d => `${d.Field} (${d.Type})`));
  process.exit(0);
}

migrate().catch(e => {
  console.error('Lỗi migration:', e);
  process.exit(1);
});

