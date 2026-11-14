import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const list = await prisma.banners.findMany({
    orderBy: { display_order: 'asc' }
  });
  console.log('All banners in DB:');
  for (const b of list) {
    console.log(`[${b.id}] order: ${b.display_order}, tag: "${b.tag}", title: "${b.title}", desc: "${b.description}", img: "${b.image_url}"`);
  }
  await prisma.$disconnect();
}
run();

