import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

async function main() {
  console.log('--- Đồng bộ 4 Campaign Banners từ db.json vào MySQL shop_hoa_db.banners ---');

  const dbJsonPath = path.resolve(__dirname, '../db.json');
  const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
  const banners = dbData.banners || [];

  console.log(`Tìm thấy ${banners.length} banner trong db.json`);

  // Xóa sạch banner cũ hoặc placeholder
  await prisma.banners.deleteMany({});
  console.log('Đã làm sạch bảng banners.');

  for (const b of banners) {
    const record = await prisma.banners.create({
      data: {
        id: String(b.id),
        title: b.title || b.tenbanner,
        image_url: b.hinhbanner || b.image_url || './images/350.png',
        link_url: b.link || b.link_url || '#products',
        display_order: Number(b.order ?? b.display_order ?? 1),
        is_active: Boolean(b.active !== undefined ? b.active : b.is_active),
        tag: b.tag || null,
        description: b.desc || b.description || null,
        theme: b.theme || 'default',
        cta_text: b.ctaText || b.cta_text || 'Khám Phá Các Mẫu Hoa'
      }
    });
    console.log(`+ Đã tạo Banner [ID: ${record.id}] [Theme: ${record.theme}]: ${record.title}`);
  }

  const allInDb = await prisma.banners.findMany({ orderBy: { display_order: 'asc' } });
  console.log('\nDanh sách 4 banners trong MySQL hiện tại:');
  console.table(allInDb.map(b => ({
    id: b.id,
    theme: b.theme,
    tag: b.tag,
    title: b.title.substring(0, 30),
    image_url: b.image_url,
    order: b.display_order,
    is_active: b.is_active
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());

