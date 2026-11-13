/**
 * MediaStorageService.js - Quản lý lưu trữ hình ảnh linh hoạt:
 *  - Khi có cấu hình Cloudinary (Production/Live): đẩy ảnh lên Cloudinary Media CDN (25GB Free, vĩnh viễn, chống mất ảnh).
 *  - Khi không có cấu hình Cloudinary (Local/Test offline): fallback lưu an toàn vào uploads/ cục bộ.
 * Thuộc tầng Adapters / Out / Storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.resolve(__dirname, '../../../../uploads');

function isCloudinaryReady() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function initCloudinary() {
  if (isCloudinaryReady()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

initCloudinary();

/**
 * Lưu trữ ảnh WebP đã được Sharp xử lý và khử độc.
 * @param {Buffer} webpBuffer - Buffer ảnh WebP đã khử độc bằng Sharp
 * @param {object} options - { folder: 'products'|'banners'|'reviews'|'avatars', publicId: string, filename: string }
 * @returns {Promise<string>} URL ảnh công khai (Cloudinary HTTPS URL hoặc /uploads/... local)
 */
export async function saveProcessedMedia(webpBuffer, { folder = 'products', publicId, filename }) {
  if (!Buffer.isBuffer(webpBuffer) || webpBuffer.length === 0) {
    throw new Error('Dữ liệu ảnh không hợp lệ');
  }

  // 1. Nếu có Cloudinary -> Đẩy lên đám mây vĩnh viễn
  if (isCloudinaryReady()) {
    initCloudinary();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `shophoa/${folder}`,
          public_id: publicId || filename?.replace(/\.webp$/i, ''),
          format: 'webp',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) {
            console.error('[MediaStorageService] Lỗi đẩy ảnh lên Cloudinary:', error);
            return reject(error);
          }
          resolve(result.secure_url);
        }
      );
      stream.end(webpBuffer);
    });
  }

  // 2. Fallback: Lưu vào thư mục uploads/ cục bộ
  const targetDir = path.join(UPLOADS_ROOT, folder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeFilename = filename || `${folder}-${Date.now().toString(36)}.webp`;
  const targetPath = path.join(targetDir, safeFilename);
  await fs.promises.writeFile(targetPath, webpBuffer);
  return `/uploads/${folder}/${safeFilename}`;
}

/**
 * Xóa an toàn ảnh mồ côi (khi cập nhật hoặc xóa sản phẩm / banner / review)
 * @param {string|string[]} urls - URL hoặc danh sách URL cần xóa
 */
export async function deleteMediaFiles(urls) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  for (const rawUrl of urlList) {
    if (typeof rawUrl !== 'string' || !rawUrl) continue;
    const cleanUrl = rawUrl.split('?')[0].trim();

    // A. Nếu là ảnh Cloudinary
    if (cleanUrl.includes('res.cloudinary.com')) {
      if (!isCloudinaryReady()) continue;
      try {
        // Trích xuất public_id từ URL Cloudinary (VD: shophoa/products/prod_123)
        const match = cleanUrl.match(/\/upload\/(?:v\d+\/)?(shophoa\/[^.]+)/);
        if (match && match[1]) {
          initCloudinary();
          await cloudinary.uploader.destroy(match[1]);
        }
      } catch (err) {
        console.warn('[MediaStorageService] Cảnh báo: không thể xóa ảnh Cloudinary:', cleanUrl, err.message);
      }
      continue;
    }

    // B. Nếu là ảnh local trong uploads/
    if (cleanUrl.startsWith('/uploads/')) {
      const relativePath = cleanUrl.replace(/^\/uploads\//, '');
      const fullPath = path.resolve(UPLOADS_ROOT, relativePath);
      // Chống Path Traversal
      if (fullPath.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.warn('[MediaStorageService] Cảnh báo: không thể xóa file local:', fullPath, err.message);
        }
      }
    }
  }
}

