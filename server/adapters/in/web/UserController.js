/**
 * UserController.js - Express Controller quan ly Profile & Avatar an toan bang Sharp WebP 200x200
 * Thuoc tang Adapters / In / Web
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { saveProcessedMedia } from '../../out/storage/MediaStorageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root upload directory
const UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads/avatars');

export class UserController {
  constructor(prismaClient) {
    this.prisma = prismaClient;
    // Dam bao thu muc uploads/avatars ton tai
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  // POST /api/users/avatar
  uploadAvatar = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui long dang nhap de cap nhat avatar' } });
      }

      const rawBase64 = req.body.avatarBase64 || req.body.avatar;
      if (typeof rawBase64 !== 'string' || rawBase64.length > 5_000_000 || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(rawBase64)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Du lieu anh Base64 khong hop le' } });
      }

      // 1. Tach header base64 va lay Buffer
      const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.length || buffer.length > 3_750_000) {
        return res.status(413).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'Avatar vượt quá dung lượng cho phép' } });
      }

      // 2. Khu doc toan dien bang Sharp (Image Sanitization):
      // Giai ma byte anh -> Ve lai pixel 200x200 format WebP -> Loai bo hoan toan Polyglot/ma doc
      const sanitizedFilename = `avatar-${user.id}.webp`;

      const processedBuffer = await sharp(buffer, { limitInputPixels: 20_000_000 })
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      const avatarUrl = await saveProcessedMedia(processedBuffer, {
        folder: 'avatars',
        filename: sanitizedFilename,
        publicId: `avatar-${user.id}`
      });

      // 3. Cap nhat vao MySQL
      const updatedUser = await this.prisma.users.update({
        where: { id: user.id },
        data: { avatar_url: avatarUrl },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatar_url: true,
          is_active: true
        }
      });

      return res.status(200).json({
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          avatar: updatedUser.avatar_url,
          avatar_url: updatedUser.avatar_url
        }
      });
    } catch (err) {
      console.error('Loi uploadAvatar:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi xu ly anh avatar bang Sharp' } });
    }
  };

  // GET /api/users/profile
  getProfile = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Can dang nhap' } });
      }

      const dbUser = await this.prisma.users.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatar_url: true,
          is_active: true,
          created_at: true
        }
      });

      if (!dbUser) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Nguoi dung khong ton tai' } });
      }

      return res.status(200).json({
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        phone: dbUser.phone || '',
        role: dbUser.role,
        avatar: dbUser.avatar_url || '',
        avatar_url: dbUser.avatar_url || '',
        is_active: dbUser.is_active,
        created_at: dbUser.created_at
      });
    } catch (err) {
      console.error('Loi getProfile:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay thong tin profile' } });
    }
  };
}

