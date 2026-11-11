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

// Bắt buộc phải có JWT_SECRET và DATABASE_URL
const JWT_SECRET = process.env.JWT_SECRET || 'shophoa_jwt_secret_super_secure_key_2026_exam';
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = Number(process.env.PORT) || 4000;

if (!DATABASE_URL) {
  console.warn('⚠️ CẢNH BÁO: Chưa cấu hình biến môi trường DATABASE_URL trong .env!');
}

export const env = {
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN: '24h',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  SEPAY_API_TOKEN: process.env.SEPAY_API_TOKEN || '',
  SEPAY_ACCOUNT_NUMBER: process.env.SEPAY_ACCOUNT_NUMBER || '',
  SEPAY_BANK_CODE: process.env.SEPAY_BANK_CODE || 'Sacombank'
};

