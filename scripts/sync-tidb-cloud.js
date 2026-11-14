import { execSync } from 'child_process';
import fs from 'fs';

// Tự động nạp .env mà không cần gói ngoài
if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

const tidbUrl = process.env.TIDB_DATABASE_URL;

console.log('======================================================');
console.log('🌸 CÔNG CỤ TỰ ĐỘNG ĐỒNG BỘ CSDL LÊN TIDB CLOUD');
console.log('======================================================\n');

if (!tidbUrl) {
  console.log('💡 HƯỚNG DẪN ĐẨY LÊN TIDB CLOUD:');
  console.log('------------------------------------------------------');
  console.log('CÁCH 1: Nhanh nhất (30 giây) - Chạy trực tiếp trên Web TiDB Cloud:');
  console.log('  1. Vào tab "SQL Editor" trên https://tidbcloud.com');
  console.log('  2. Mở file: prisma/migrations_tidb/add_product_filter_metadata.sql');
  console.log('  3. Dán câu lệnh SQL vào và bấm nút "Run".\n');
  console.log('CÁCH 2: Tự động qua lệnh terminal:');
  console.log('  1. Lấy connection string từ nút "Connect" trên TiDB Cloud.');
  console.log('  2. Thêm vào file .env:');
  console.log('     TIDB_DATABASE_URL="mysql://<user>.<hash>:<password>@gateway01.<region>.prod.aws.tidbcloud.com:4000/shop_hoa_db?sslaccept=strict"');
  console.log('  3. Chạy lại lệnh: npm run db:sync:tidb\n');
  process.exit(0);
}

try {
  console.log('🚀 Bước 1: Đang tự động đẩy Schema Prisma lên TiDB Cloud...');
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: tidbUrl },
    stdio: 'inherit'
  });

  console.log('\n🚀 Bước 2: Đang chuẩn hóa dữ liệu phân loại mẫu hoa trên TiDB Cloud...');
  execSync('node scripts/migrate-products-filter-metadata.js', {
    env: { ...process.env, DATABASE_URL: tidbUrl },
    stdio: 'inherit'
  });

  console.log('\n======================================================');
  console.log('🎉 ĐỒNG BỘ TOÀN BỘ CSDL LÊN TIDB CLOUD THÀNH CÔNG 100%!');
  console.log('======================================================');
} catch (err) {
  console.error('\n❌ Lỗi đồng bộ TiDB Cloud:', err.message);
  process.exit(1);
}
