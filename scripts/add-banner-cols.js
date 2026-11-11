import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const statements = [
    'ALTER TABLE banners MODIFY COLUMN title VARCHAR(255) NOT NULL',
    'ALTER TABLE banners ADD COLUMN tag VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE banners ADD COLUMN description TEXT DEFAULT NULL',
    'ALTER TABLE banners ADD COLUMN theme VARCHAR(50) DEFAULT "default"',
    'ALTER TABLE banners ADD COLUMN cta_text VARCHAR(100) DEFAULT "Khám Phá Các Mẫu Hoa"'
  ];

  for (const sql of statements) {
    try {
      await prisma.$queryRawUnsafe(sql);
      console.log('Executed:', sql);
    } catch (err) {
      console.log('Skip or notice for:', sql, err.message);
    }
  }

  const cols = await prisma.$queryRawUnsafe('DESCRIBE banners');
  console.table(cols);
}

main().catch(console.error).finally(() => prisma.$disconnect());
