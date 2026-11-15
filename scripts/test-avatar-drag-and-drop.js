import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

async function runAvatarDragAndDropTest() {
  console.log('--- KHỞI ĐỘNG KIỂM THỬ KÉO THẢ AVATAR KHÁCH HÀNG (DRAG & DROP) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. Tìm hoặc tạo tài khoản khách test
    let testUser = await prisma.users.findFirst({
      where: { role: 'customer' }
    });

    if (!testUser) {
      testUser = await prisma.users.findFirst();
    }
    console.log(`[Setup] Sử dụng tài khoản khách: ${testUser.email} (ID: ${testUser.id})`);

    // 2. Đăng nhập qua API và set cookie token
    const loginRes = await page.request.post('http://localhost:4000/api/auth/login', {
      data: {
        email: testUser.email,
        password: 'password123' // default seed password
      }
    });

    let loggedIn = loginRes.ok();
    if (!loggedIn) {
      // Thử mật khẩu 123456
      const retryRes = await page.request.post('http://localhost:4000/api/auth/login', {
        data: {
          email: testUser.email,
          password: 'password'
        }
      });
      loggedIn = retryRes.ok();
    }

    if (!loggedIn) {
      // Tạo user mới cho test
      const testEmail = `test_avatar_${Date.now()}@example.com`;
      const regRes = await page.request.post('http://localhost:4000/api/auth/register', {
        data: {
          name: 'Khách Test Avatar',
          email: testEmail,
          password: 'Password123!',
          phone: '0901234567'
        }
      });
      console.log(`[Setup] Tạo tài khoản mới: ${testEmail}, status: ${regRes.status()}`);
    }

    // 3. Mở trang orders.html
    await page.goto('http://localhost:4000/orders.html', { waitUntil: 'networkidle' });
    console.log('[Page] Đã tải trang orders.html');

    // Chờ selector #avatarDropzoneWrap xuất hiện
    await page.waitForSelector('#avatarDropzoneWrap', { timeout: 5000 });
    console.log('[DOM] #avatarDropzoneWrap đã hiện diện trên trang.');

    // 4. Kiểm tra sự kiện Drag Enter / Drag Over (Visual feedback)
    console.log('[DragOver Test] Mô phỏng sự kiện dragenter / dragover trên avatarDropzoneWrap...');
    await page.evaluate(() => {
      const dropzone = document.getElementById('avatarDropzoneWrap');
      const event = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
      });
      dropzone.dispatchEvent(event);
    });

    const isDragActive = await page.evaluate(() => {
      const dropzone = document.getElementById('avatarDropzoneWrap');
      return dropzone.classList.contains('drag-active');
    });

    console.log(`[DragOver Test] Class 'drag-active' được kích hoạt: ${isDragActive}`);
    if (!isDragActive) {
      throw new Error('Hiệu ứng drag-active không được kích hoạt khi kéo file vào avatar!');
    }

    // 5. Mô phỏng sự kiện Drop file ảnh
    console.log('[Drop Test] Chuẩn bị dữ liệu hình ảnh 1x1 pixel PNG và mô phỏng drop...');
    
    // Tạo 1 DataTransfer mang 1 file ảnh hợp lệ trong browser context
    await page.evaluate(async () => {
      // Tạo 1 canvas nhỏ 64x64 vẽ icon hoa kẽm nhung
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#108474';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('🌸', 16, 42);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'test-avatar.png', { type: 'image/png' });

      const dt = new DataTransfer();
      dt.items.add(file);

      const dropzone = document.getElementById('avatarDropzoneWrap');
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });
      dropzone.dispatchEvent(dropEvent);
    });

    // 6. Đợi Toast thành công xuất hiện
    console.log('[Drop Test] Đang chờ toast thông báo cập nhật avatar...');
    const toast = await page.waitForSelector('.toast.toast-success', { timeout: 10000 });
    const toastText = await toast.innerText();
    console.log(`[Toast] Nhận thông báo: "${toastText}"`);

    // 7. Kiểm tra thẻ img avatar trong #profileAvatarInitial
    await page.waitForFunction(() => {
      const initialEl = document.getElementById('profileAvatarInitial');
      const img = initialEl ? initialEl.querySelector('img') : null;
      return img && img.src && img.src.length > 0;
    }, { timeout: 5000 });

    const avatarSrc = await page.evaluate(() => {
      const img = document.querySelector('#profileAvatarInitial img');
      return img ? img.src : null;
    });
    console.log(`[UI Success] Avatar đã được cập nhật trên giao diện: ${avatarSrc}`);

    // 8. Chụp ảnh màn hình làm bằng chứng nghiệm thu
    const screenshotPath = 'C:/Users/ADMIN/.gemini/antigravity/brain/df58fbe0-caf1-4d2a-9095-600eafdbd0f3/88_customer_avatar_drag_and_drop.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[Artifact] Đã chụp ảnh lưu tại: ${screenshotPath}`);

    console.log('✅ KIỂM THỬ KÉO THẢ AVATAR THÀNH CÔNG 100%!');
  } catch (error) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH TEST:', error);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.users.deleteMany({
        where: { email: { startsWith: 'test_avatar_' } }
      });
      console.log('[Cleanup] Đã dọn dẹp tài khoản test avatar trong CSDL.');
    } catch (e) {
      console.warn('[Cleanup Warning]', e.message);
    }
    await browser.close();
    await prisma.$disconnect();
  }
}

runAvatarDragAndDropTest();
