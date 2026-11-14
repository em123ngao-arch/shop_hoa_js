import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('--- Updating Banner 1794329984394 (20/11) ---');
  await prisma.banners.update({
    where: { id: '1794329984394' },
    data: {
      tag: 'Tri Ân Thầy Cô 20/11',
      title: 'Tri Ân Thầy Cô <br>Ngày Nhà Giáo Việt Nam 20/11',
      description: 'Bộ sưu tập hoa kẽm nhung thủ công cao cấp thay lời cảm ơn sâu sắc nhất gửi đến quý thầy cô kính yêu.',
      cta_text: 'Khám Phá Các Mẫu Hoa'
    }
  });

  console.log('--- Cleaning emojis from other banners ---');
  await prisma.banners.update({
    where: { id: '1' },
    data: { tag: 'Khai Xuân Đắc Lộc 2027' }
  });

  await prisma.banners.update({
    where: { id: '2' },
    data: { tag: 'Tinh Hoa Nghệ Thuật Handmade' }
  });

  await prisma.banners.update({
    where: { id: '3' },
    data: { tag: 'Ưu Đãi Khai Trương Hồng Phát' }
  });

  await prisma.banners.update({
    where: { id: '4' },
    data: { tag: 'Mùa Yêu Thương Lãng Mạn' }
  });

  console.log('All banners updated successfully.');
  await prisma.$disconnect();
}
run();

