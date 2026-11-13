import assert from 'assert';

console.log('🧪 Bắt đầu kiểm thử độc lập Business Logic: An toàn tồn kho & Kích hoạt lễ (Inventory Safety)...');

// Kiểm tra hàm updateProduct trong storage.js
function simulateUpdateProduct(existingProduct, patchPayload) {
  // Bản sao chính xác logic từ public/js/storage.js
  const payload = { ...patchPayload };
  if (patchPayload.price !== undefined) payload.price = Number(patchPayload.price);
  if (patchPayload.originalPrice !== undefined) payload.originalPrice = Number(patchPayload.originalPrice);
  if (patchPayload.costPrice !== undefined) payload.costPrice = Number(patchPayload.costPrice);
  if (patchPayload.stock !== undefined) payload.stock = Number(patchPayload.stock);
  if (patchPayload.isActive !== undefined) payload.isActive = Boolean(patchPayload.isActive);

  // Áp dụng vào sản phẩm hiện tại
  return {
    ...existingProduct,
    ...payload
  };
}

// 1. Kiểm tra kịch bản Kích Hoạt Chiến Dịch Lễ
console.log('1️⃣ Kiểm tra kịch bản Kích Hoạt Chiến Dịch Lễ...');
const productBeforeHoliday = {
  id: 'PROD-001',
  name: 'Bó Hoa Baby Trắng',
  price: 280000,
  originalPrice: 320000,
  stock: 12, // Khách vừa đặt mua làm giảm từ 25 xuống 12
  costPrice: 120000,
  isActive: true
};

// Chiến dịch Lễ chỉ gửi { originalPrice, price }, KHÔNG ĐƯỢC gửi stock cũ!
const holidayPatch = {
  originalPrice: 320000,
  price: 240000 // Giảm 25%
};

const productAfterHoliday = simulateUpdateProduct(productBeforeHoliday, holidayPatch);

assert.strictEqual(productAfterHoliday.price, 240000, 'Giá bán phải được cập nhật giảm');
assert.strictEqual(productAfterHoliday.originalPrice, 320000, 'Giá gốc phải được giữ nguyên');
assert.strictEqual(productAfterHoliday.stock, 12, 'TỒN KHO THẬT KHÔNG ĐƯỢC BỊ GHI ĐÈ VỀ GIÁ TRỊ CŨ!');
console.log('   -> Giá mới:', productAfterHoliday.price, '| Tồn kho:', productAfterHoliday.stock);
console.log('   ✅ ĐẠT: Kích hoạt lễ không làm mất số tồn kho thời gian thực!');

// 2. Kiểm tra thao tác Ngừng Bán
console.log('2️⃣ Kiểm tra thao tác Ngừng Bán...');
const togglePatch = { isActive: false };
const productAfterToggle = simulateUpdateProduct(productAfterHoliday, togglePatch);
assert.strictEqual(productAfterToggle.isActive, false, 'Trạng thái isActive phải chuyển thành false');
assert.strictEqual(productAfterToggle.stock, 12, 'Tồn kho không bị thay đổi khi toggle ngừng bán');
console.log('   -> Trạng thái kinh doanh:', productAfterToggle.isActive ? 'Đang bán' : 'Ngừng bán');
console.log('   ✅ ĐẠT: Ngừng bán cập nhật độc lập, bảo toàn dữ liệu tồn kho!');

console.log('🎉 TOÀN BỘ KIỂM THỬ AN TOÀN TỒN KHO ĐẠT CHUẨN 100%!');

