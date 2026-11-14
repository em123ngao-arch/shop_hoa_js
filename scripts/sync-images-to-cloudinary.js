/**
 * scripts/sync-images-to-cloudinary.js
 * Đồng bộ toàn bộ hình ảnh sản phẩm & banner từ public/images/ lên Cloudinary CDN (mobixull)
 * Giúp tối ưu hóa tốc độ tải trang (Fast CDN, f_auto, q_auto) và lưu trữ vĩnh viễn
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';
import '../server/infrastructure/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

async function runSync() {
  console.log('================================================================');
  console.log('☁️ BẮT ĐẦU ĐỒNG BỘ HÌNH ẢNH LÊN CLOUDINARY CDN (mobixull)');
  console.log('================================================================\n');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  const ping = await cloudinary.api.ping();
  console.log('✅ Kết nối Cloudinary thành công! Trạng thái:', ping.status);

  const imagesDir = path.resolve(__dirname, '../public/images');
  const files = fs.readdirSync(imagesDir).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));

  console.log(`📂 Tìm thấy ${files.length} tệp ảnh trong public/images/\n`);

  const uploadedMap = new Map();

  for (const filename of files) {
    const filePath = path.join(imagesDir, filename);
    const publicId = `shophoa/catalog/${path.parse(filename).name}`;
    
    try {
      const uploadRes = await cloudinary.uploader.upload(filePath, {
        folder: 'shophoa/catalog',
        public_id: path.parse(filename).name,
        overwrite: true,
        resource_type: 'image'
      });

      console.log(`  ⬆️ Upload thành công: ${filename} -> ${uploadRes.secure_url}`);
      uploadedMap.set(filename, uploadRes.secure_url);
    } catch (err) {
      console.warn(`  ⚠️ Lỗi upload ${filename}:`, err.message);
    }
  }

  console.log(`\n🎉 Đã upload ${uploadedMap.size} ảnh lên Cloudinary!`);

  // Tùy chọn: Cập nhật đường dẫn URL trong CSDL MySQL
  const products = await prisma.products.findMany({ select: { id: true, image_url: true } });
  let updatedCount = 0;

  for (const p of products) {
    if (!p.image_url) continue;
    const basename = path.basename(p.image_url);
    if (uploadedMap.has(basename)) {
      const cdnUrl = uploadedMap.get(basename);
      // Sử dụng URL có tối ưu hóa tự động f_auto,q_auto
      const optimizedUrl = cdnUrl.replace('/upload/', '/upload/f_auto,q_auto/');
      await prisma.products.update({
        where: { id: p.id },
        data: { image_url: optimizedUrl }
      });
      updatedCount++;
    }
  }

  console.log(`🔄 Đã cập nhật ${updatedCount}/${products.length} sản phẩm trong CSDL sang URL Cloudinary CDN siêu tốc!`);
  console.log('\n================================================================');
  console.log('✨ HOÀN TẤT ĐỒNG BỘ ẢNH LÊN CLOUDINARY! TRANG WEB LOAD SIÊU TỐC');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

runSync().catch(err => {
  console.error('❌ Lỗi tiến trình đồng bộ:', err);
  process.exit(1);
});
