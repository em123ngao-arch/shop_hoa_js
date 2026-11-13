/**
 * scripts/test-real-gift-delivery-slip.js
 * Kiểm thử nghiệp vụ P1: Ngày giao hàng hẹn trước, quà tặng bí mật & Phiếu giao quà tặng A5 (ẩn giá).
 * IMPORT TRỰC TIẾP TỪ CÁC MODULE THẬT CỦA HỆ THỐNG - KHÔNG MÔ PHỎNG LẠI CODE.
 */

import assert from 'node:assert/strict';
import { resolveGiftDeliverySlipMeta } from '../public/js/business-rules.js';
import { renderGiftDeliverySlipPdfWithDoc } from '../public/js/excel-pdf.js';
import { OrderService } from '../server/application/OrderService.js';
import { PrismaOrderRepository } from '../server/adapters/out/persistence/PrismaOrderRepository.js';

console.log('--- KIỂM THỬ THẬT: NGHIỆP VỤ P1 (DELIVERY DATE, ANONYMOUS GIFT, GIFT SLIP) ---');

// 1. Kiểm thử resolveGiftDeliverySlipMeta với đơn hàng Quà tặng Ẩn danh (is_anonymous: true)
{
  const anonymousOrder = {
    id: 'DH-GIFT-001',
    orderCode: 'DH-GIFT-001',
    customerName: 'Nguyễn Văn Đạt (Người đặt)',
    customerPhone: '0909123456',
    recipientName: 'Trần Thị Mai (Người nhận hoa)',
    recipientPhone: '0988776655',
    address: '123 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1',
    deliveryDate: '2026-11-20',
    deliverySlot: 'Buổi sáng (08:00 - 12:00)',
    isAnonymous: true,
    hasGreetingCard: true,
    cardMessage: 'Chúc em một ngày sinh nhật thật ấm áp và luôn tươi như hoa kẽm nhung nhé!',
    items: [
      { name: 'Bó Hoa Hướng Dương Kẽm Nhung', quantity: 1, price: 350000, addonsText: 'Đèn LED đom đóm' },
      { name: 'Bó Hoa Tulip Hồng Pastel', quantity: 2, price: 280000, addonsText: '' }
    ],
    subtotal: 910000,
    shippingFee: 30000,
    totalAmount: 940000,
    status: 'confirmed'
  };

  const meta = resolveGiftDeliverySlipMeta(anonymousOrder);

  assert.equal(meta.canExport, true, 'Phiếu giao quà cho đơn confirmed phải hợp lệ');
  assert.equal(meta.orderCode, 'DH-GIFT-001');
  assert.equal(meta.deliveryDate, '2026-11-20');
  assert.equal(meta.deliverySlot, 'Buổi sáng (08:00 - 12:00)');
  assert.equal(meta.recipientName, 'Trần Thị Mai (Người nhận hoa)');
  assert.equal(meta.recipientPhone, '0988776655');

  // ĐẶC THÙ HOA TẶNG BÍ MẬT: Phải ẩn hoàn toàn tên và SĐT người gửi
  assert.match(meta.senderName, /bí mật|giấu tên/i, 'Tên người gửi phải được ẩn thành thông điệp bí mật');
  assert.equal(meta.senderName.includes('Nguyễn Văn Đạt'), false, 'Tên thật của người gửi KHÔNG được xuất hiện');
  assert.match(meta.senderPhone, /\*\*\*|ẩn/i, 'SĐT người gửi phải được che');
  assert.equal(meta.senderPhone.includes('0909123456'), false, 'SĐT thật của người gửi KHÔNG được xuất hiện');

  // Thiệp mừng
  assert.equal(meta.hasGreetingCard, true);
  assert.equal(meta.cardMessage, 'Chúc em một ngày sinh nhật thật ấm áp và luôn tươi như hoa kẽm nhung nhé!');

  // Bảng mặt hàng: Tuyệt đối KHÔNG chứa đơn giá hoặc tổng tiền
  assert.equal(meta.items.length, 2);
  assert.equal(meta.items[0].name, 'Bó Hoa Hướng Dương Kẽm Nhung');
  assert.equal(meta.items[0].quantity, 1);
  assert.equal(meta.items[0].addons, 'Đèn LED đom đóm');
  assert.equal(meta.items[0].price, undefined, 'Mặt hàng trong phiếu giao quà không được chứa price');
  assert.equal(meta.totals, undefined, 'Meta phiếu giao quà không được chứa totals/tiền');

  console.log('✓ PASS: resolveGiftDeliverySlipMeta ẩn danh tính người gửi & loại bỏ hoàn toàn giá tiền cho đơn quà bí mật');
}

// 2. Kiểm thử resolveGiftDeliverySlipMeta với đơn hàng Quà tặng CÔNG KHAI người gửi (is_anonymous: false)
{
  const publicOrder = {
    id: 'DH-GIFT-002',
    customerName: 'Lê Hoàng Nam',
    customerPhone: '0912345678',
    recipientName: 'Phạm Thu Thảo',
    recipientPhone: '0933445566',
    address: '45 Lê Duẩn, Quận 1',
    deliveryDate: '2026-11-25',
    deliverySlot: 'Buổi chiều (13:30 - 17:30)',
    isAnonymous: false,
    items: [{ name: 'Bó Hoa Cúc Họa Mi Kẽm Nhung', quantity: 1, price: 220000 }]
  };

  const meta = resolveGiftDeliverySlipMeta(publicOrder);
  assert.equal(meta.isAnonymous, false);
  assert.equal(meta.senderName, 'Lê Hoàng Nam', 'Đơn không ẩn danh thì hiện rõ tên người gửi');
  assert.equal(meta.senderPhone, '0912345678', 'Đơn không ẩn danh thì hiện rõ SĐT người gửi');
  console.log('✓ PASS: resolveGiftDeliverySlipMeta hiển thị đúng thông tin khi người gửi chọn công khai');
}

// 3. Kiểm thử từ chối in phiếu giao quà cho đơn hàng đã hủy (cancelled)
{
  const cancelledOrder = {
    id: 'DH-CANCELLED',
    status: 'cancelled',
    customerName: 'Khách A',
    items: []
  };
  const meta = resolveGiftDeliverySlipMeta(cancelledOrder);
  assert.equal(meta.canExport, false);
  assert.match(meta.errorMessage, /đã hủy/i);
  console.log('✓ PASS: Chặn xuất Phiếu Giao Quà Tặng cho đơn hàng đã hủy');
}

// 4. Kiểm thử renderGiftDeliverySlipPdfWithDoc tạo PDF hợp lệ với jsPDF instance
{
  const calls = [];
  const fakeDoc = {
    setFont: (f, s) => calls.push({ fn: 'setFont', f, s }),
    setFontSize: (s) => calls.push({ fn: 'setFontSize', s }),
    setTextColor: (...c) => calls.push({ fn: 'setTextColor', c }),
    setDrawColor: (...c) => calls.push({ fn: 'setDrawColor', c }),
    setFillColor: (...c) => calls.push({ fn: 'setFillColor', c }),
    setLineWidth: (w) => calls.push({ fn: 'setLineWidth', w }),
    line: (...args) => calls.push({ fn: 'line', args }),
    roundedRect: (...args) => calls.push({ fn: 'roundedRect', args }),
    text: (t, x, y, opt) => calls.push({ fn: 'text', t, x, y, opt }),
    splitTextToSize: (t) => [t],
    autoTable: (cfg) => {
      calls.push({ fn: 'autoTable', cfg });
      fakeDoc.lastAutoTable = { finalY: 100 };
    },
    save: (name) => calls.push({ fn: 'save', name }),
    output: () => 'blob:fake-url'
  };

  const testOrder = {
    orderCode: 'DH-TEST-PDF',
    deliveryDate: '2026-12-24',
    deliverySlot: 'Tối (18:00 - 21:00)',
    isAnonymous: true,
    recipientName: 'Bạn Thân',
    recipientPhone: '0909000111',
    address: 'Vincom Đồng Khởi',
    cardMessage: 'Merry Christmas!',
    hasGreetingCard: true,
    items: [{ name: 'Cây Thông Noel Kẽm Nhung', quantity: 1, price: 450000 }]
  };

  const meta = resolveGiftDeliverySlipMeta(testOrder);
  const resultDoc = renderGiftDeliverySlipPdfWithDoc(fakeDoc, testOrder, meta, { autoDownload: true });

  assert.equal(resultDoc, fakeDoc);
  const titleCall = calls.find(c => c.fn === 'text' && /PHIEU GIAO QUA TANG|PHIẾU GIAO QUÀ TẶNG/i.test(String(c.t)));
  assert.ok(titleCall, 'Tài liệu PDF phải chứa tiêu đề PHIẾU GIAO QUÀ TẶNG');

  const autoTableCall = calls.find(c => c.fn === 'autoTable');
  assert.ok(autoTableCall, 'Tài liệu PDF phải vẽ bảng AutoTable');
  assert.equal(autoTableCall.cfg.head[0].length, 4, 'Bảng quà tặng phải có đúng 4 cột');
  assert.match(String(autoTableCall.cfg.head[0][1]), /Bó Hoa|Bo Hoa/i, 'Header bảng quà tặng phải chứa tên hoa');

  const saveCall = calls.find(c => c.fn === 'save');
  assert.ok(saveCall, 'Đã kích hoạt lưu file PDF');
  assert.equal(saveCall.name, 'Phieu_Giao_Qua_DH-TEST-PDF.pdf');

  console.log('✓ PASS: renderGiftDeliverySlipPdfWithDoc vẽ đầy đủ bố cục Phiếu giao quà tặng, không lỗi');
}

// 5. Kiểm thử OrderService: Ràng buộc hợp lệ ngày giao hàng (quá khứ & tối đa 60 ngày)
{
  const orderService = new OrderService();

  // Test ngày trong quá khứ
  assert.throws(() => {
    orderService.validateDeliveryDate('2020-01-01');
  }, /quá khứ/i, 'Phải chặn ngày giao hàng trong quá khứ');

  // Test ngày quá 60 ngày
  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 90);
  const farFutureStr = farFuture.toISOString().slice(0, 10);
  assert.throws(() => {
    orderService.validateDeliveryDate(farFutureStr);
  }, /60 ngày/i, 'Phải chặn ngày giao đặt trước vượt quá 60 ngày');

  // Test ngày hợp lệ (3 ngày tới)
  const validDate = new Date();
  validDate.setDate(validDate.getDate() + 3);
  const validDateStr = validDate.toISOString().slice(0, 10);
  const validated = orderService.validateDeliveryDate(validDateStr);
  assert.equal(validated, validDateStr);

  console.log('✓ PASS: OrderService.validateDeliveryDate chặn đúng ngày quá khứ và đặt trước quá 60 ngày');
}

// 6. Kiểm thử PrismaOrderRepository: Ánh xạ chuẩn trường delivery_date và is_anonymous
{
  const repo = new PrismaOrderRepository();

  const writeFields = repo._buildOrderWriteFields({
    deliveryDate: '2026-11-20',
    isAnonymous: true,
    recipientName: 'Người Nhận',
    recipientPhone: '0912345678'
  });

  assert.equal(writeFields.delivery_date, '2026-11-20', 'Phải ghi vào delivery_date trong MySQL');
  assert.equal(writeFields.is_anonymous, true, 'Phải ghi vào is_anonymous trong MySQL');

  const dto = repo._mapToDTO({
    id: 'ord-123',
    order_code: 'DH-123',
    delivery_date: '2026-11-20',
    is_anonymous: 1,
    customer_name: 'Người Đặt',
    total_amount: 500000,
    created_at: new Date()
  });

  assert.equal(dto.deliveryDate, '2026-11-20', 'DTO phải expose deliveryDate camelCase');
  assert.equal(dto.isAnonymous, true, 'DTO phải expose isAnonymous boolean');

  console.log('✓ PASS: PrismaOrderRepository ánh xạ hai chiều chính xác giữa database và DTO');
}

console.log('================================================================');
console.log('TẤT CẢ 6/6 BÀI KIỂM THỬ THẬT NGHIỆP VỤ P1 ĐÃ VƯỢT QUA 100%!');
console.log('================================================================');
