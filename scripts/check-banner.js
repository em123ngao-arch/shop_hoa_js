import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const b = await prisma.banners.findUnique({
    where: { id: '1794329984394' }
  });
  console.log('Banner in DB:', JSON.stringify(b, null, 2));
  await prisma.$disconnect();
}
run();

