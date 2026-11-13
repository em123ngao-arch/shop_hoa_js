/**
 * env.js - Quản lý và kiểm tra tính hợp lệ của biến môi trường (Fail-Fast)
 * Thuộc tầng Infrastructure (Hạ tầng cấu hình)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tự động nạp .env từ thư mục gốc souce_shopHoa nếu chưa nạp
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Bỏ dấu nháy kép hoặc đơn nếu có
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Fail-fast: không dùng secret mặc định vì có thể cho phép giả mạo JWT nếu thiếu cấu hình.
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = Number(process.env.PORT) || 4000;
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
let parsedAppBaseUrl;
try {
  parsedAppBaseUrl = new URL(APP_BASE_URL);
} catch {
  throw new Error('APP_BASE_URL phải là một URL http/https hợp lệ.');
}
if (!['http:', 'https:'].includes(parsedAppBaseUrl.protocol) || parsedAppBaseUrl.username || parsedAppBaseUrl.password) {
  throw new Error('APP_BASE_URL phải dùng http/https và không chứa thông tin đăng nhập.');
}
if (process.env.NODE_ENV === 'production' && parsedAppBaseUrl.protocol !== 'https:') {
  throw new Error('APP_BASE_URL phải dùng HTTPS trong môi trường production.');
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET phải được cấu hình riêng và có tối thiểu 32 ký tự.');
}
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL chưa được cấu hình. Máy chủ không thể khởi chạy an toàn.');
}

export const env = {
  PORT,
  APP_BASE_URL: parsedAppBaseUrl.origin,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN: '24h',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  SEPAY_API_TOKEN: process.env.SEPAY_API_TOKEN || '',
  SEPAY_WEBHOOK_API_KEY: process.env.SEPAY_WEBHOOK_API_KEY || '',
  SEPAY_ACCOUNT_NUMBER: process.env.SEPAY_ACCOUNT_NUMBER || '',
  SEPAY_BANK_CODE: process.env.SEPAY_BANK_CODE || '',
  SEPAY_ACCOUNT_HOLDER: process.env.SEPAY_ACCOUNT_HOLDER || '',
  PENDING_PAYMENT_TTL_MINUTES: Number(process.env.PENDING_PAYMENT_TTL_MINUTES) || 30,
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || ''
};

