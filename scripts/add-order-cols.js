import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const statements = [
    'ALTER TABLE orders ADD COLUMN customer_email VARCHAR(254) DEFAULT NULL',
    'ALTER TABLE orders ADD COLUMN recipient_name VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE orders ADD COLUMN recipient_phone VARCHAR(20) DEFAULT NULL',
    'ALTER TABLE orders ADD COLUMN is_gift TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN delivery_slot VARCHAR(100) DEFAULT NULL',
    'ALTER TABLE orders ADD COLUMN has_greeting_card TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN card_message TEXT DEFAULT NULL',
    'ALTER TABLE orders ADD COLUMN customer_note TEXT DEFAULT NULL'
  ];

  for (const sql of statements) {
    try {
      await prisma.$queryRawUnsafe(sql);
      console.log('Executed:', sql);
    } catch (err) {
      console.log('Skip / notice:', sql, err.message);
    }
  }

  const cols = await prisma.$queryRawUnsafe('DESCRIBE orders');
  console.table(cols);
}

main().catch(console.error).finally(() => prisma.$disconnect());

