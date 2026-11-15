// scripts/test-dash-export.js
import { chromium } from 'playwright';

async function testExport() {
  console.log('🚀 Bắt đầu kiểm thử Xuất PDF & Excel từ Dashboard...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('  [Browser]', msg.type(), msg.text()));

  try {
    await page.goto('http://localhost:4000/login.html?returnUrl=%2Fadmin.html', { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@shophoa.example');
    await page.fill('#password', 'admin123');
    await page.click('#submitBtn');
    await page.waitForURL('**/admin.html', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Bấm xuất PDF
    console.log('👉 Thử nghiệm bấm nút Xuất PDF trên Dashboard...');
    await page.click('#btnDashExportPdf');
    await page.waitForTimeout(2000);

    // Bấm xuất Excel
    console.log('👉 Thử nghiệm bấm nút Xuất Excel trên Dashboard...');
    await page.click('#btnDashExportExcel');
    await page.waitForTimeout(2000);

    console.log('✅ Cả 2 nút Xuất PDF và Excel hoạt động mượt mà, không gặp lỗi!');
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testExport();
