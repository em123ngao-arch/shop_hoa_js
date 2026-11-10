import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe('DESCRIBE banners');
  console.log('Columns in banners:');
  console.table(cols);
}

main().catch(console.error).finally(() => prisma.$disconnect());

