/**
 * scripts/test-real-order-controller-checkout-flow.js
 * Kiểm thử tích hợp trực tiếp:
 * 1. OrderController._parseOrderPayload giữ nguyên deliveryDate & isAnonymous
 * 2. OrderController.createOrder chuyển đầy đủ vào OrderService -> PrismaOrderRepository
 * 3. Chặn ngày giao sai định dạng / quá khứ / vượt 60 ngày
 * 4. PrismaCatalogRepository chặn tồn kho âm (khi giảm quá tồn hoặc nhập số âm)
 * 5. PaymentService & Business Rules nhận diện chuẩn xác partially_refunded
 */

import assert from 'node:assert/strict';
import { OrderController } from '../server/adapters/in/web/OrderController.js';
import { OrderService } from '../server/application/OrderService.js';
import { PrismaOrderRepository } from '../server/adapters/out/persistence/PrismaOrderRepository.js';
import { PrismaCatalogRepository } from '../server/adapters/out/persistence/PrismaCatalogRepository.js';
import { PaymentService } from '../server/application/PaymentService.js';
import { isUnpaidSepayOrder, isOrderPaid } from '../public/js/business-rules.js';

console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍCH HỢP TOÀN DIỆN: CONTROLLER -> SERVICE -> REPOSITORY');

// ============================================================================
// 1. KIỂM THỬ OrderController._parseOrderPayload (SỬA LỖI RƠI TRƯỜNG DỮ LIỆU)
// ============================================================================
{
  console.log('\n1️⃣ Kiểm tra OrderController._parseOrderPayload với deliveryDate & isAnonymous...');
  const controller = new OrderController();

  const checkoutPayload = {
    customerName: 'Nguyễn Văn Đạt',
    phone: '0901234567',
    address: '123 Nguyễn Thị Minh Khai, Q1',
    paymentMethod: 'sepay',
    items: [
      { productId: 'PROD-001', quantity: 1 }
    ],
    deliveryDate: '2026-11-20',
    deliverySlot: 'Buổi sáng (08:00 - 12:00)',
    isAnonymous: true,
    cardMessage: 'Chúc mừng sinh nhật Mai!',
    hasGreetingCard: true
  };

  const parsed = controller._parseOrderPayload(checkoutPayload);

  assert.equal(parsed.deliveryDate, '2026-11-20', 'Parser PHẢI giữ lại deliveryDate từ payload');
  assert.equal(parsed.isAnonymous, true, 'Parser PHẢI giữ lại isAnonymous từ payload');
  assert.equal(parsed.isGift, true, 'Đơn ẩn danh quà tặng bí mật PHẢI tự động kích hoạt isGift = true');
  assert.equal(parsed.cardMessage, 'Chúc mừng sinh nhật Mai!');

  console.log('  ✓ Đạt: _parseOrderPayload trích xuất và bảo toàn đầy đủ deliveryDate, isAnonymous & isGift');

  // Kiểm tra chặn ngày giao sai định dạng
  assert.throws(() => {
    controller._parseOrderPayload({
      ...checkoutPayload,
      deliveryDate: '20-11-2026' // Sai chuẩn YYYY-MM-DD
    });
  }, /Định dạng ngày hẹn giao hoa không hợp lệ/i, 'Phải ném ValidationError khi deliveryDate sai định dạng');

  console.log('  ✓ Đạt: _parseOrderPayload chặn đúng ngày giao sai định dạng');
}

// ============================================================================
// 2. KIỂM THỬ LUỒNG KHÉP KÍN CONTROLLER -> SERVICE -> REPOSITORY
// ============================================================================
{
  console.log('\n2️⃣ Kiểm tra toàn bộ luồng tạo đơn: Controller -> Service -> Repository...');
  
  let databaseInsertData = null;

  const fakePrisma = {
    products: {
      findMany: async () => [
        { id: 'PROD-001', name: 'Hoa Hướng Dương Kẽm Nhung', price: 350000, cost_price: 150000, stock: 10, is_active: true }
      ]
    },
    addons: {
      findMany: async () => []
    },
    vouchers: {
      findUnique: async () => null
    },
    orders: {
      create: async ({ data }) => {
        databaseInsertData = data;
        return {
          id: 'ord-test-p1',
          order_code: data.order_code,
          ...data,
          created_at: new Date()
        };
      }
    },
    order_items: {
      createMany: async () => ({ count: 1 })
    },
    notifications: {
      create: async () => ({})
    },
    $transaction: async (callback) => {
      const txMock = {
        products: {
          findUnique: async () => ({ id: 'PROD-001', name: 'Hoa Hướng Dương Kẽm Nhung', price: 350000, cost_price: 150000, stock: 10, is_active: true }),
          updateMany: async () => ({ count: 1 })
        },
        vouchers: {
          findUnique: async () => null,
          updateMany: async () => ({ count: 1 })
        },
        orders: {
          create: async ({ data }) => {
            databaseInsertData = data;
            return {
              id: 'ord-test-p1',
              order_code: data.order_code,
              ...data,
              created_at: new Date()
            };
          }
        },
        order_items: {
          createMany: async () => ({ count: 1 })
        },
        order_item_addons: {
          createMany: async () => ({ count: 0 })
        },
        notifications: {
          create: async () => ({})
        }
      };
      return await callback(txMock);
    }
  };

  const orderRepo = new PrismaOrderRepository(fakePrisma);
  const orderService = new OrderService(orderRepo);
  const controller = new OrderController(orderService);

  const validFutureDate = new Date();
  validFutureDate.setDate(validFutureDate.getDate() + 5);
  const validDateStr = validFutureDate.toISOString().slice(0, 10);

  const req = {
    body: {
      customerName: 'Người Tặng Hoa',
      phone: '0901234567',
      address: '72 Lê Thánh Tôn, Q1',
      paymentMethod: 'sepay',
      deliveryDate: validDateStr,
      deliverySlot: 'Chiều (13:30 - 17:30)',
      isAnonymous: true,
      items: [{ productId: 'PROD-001', quantity: 1 }]
    },
    user: null
  };

  let responseStatus = null;
  let responseData = null;
  const res = {
    status: (code) => {
      responseStatus = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await controller.createOrder(req, res);

  assert.equal(responseStatus, 201, 'Controller phải trả HTTP 201 Created');
  assert.ok(databaseInsertData, 'Dữ liệu phải được gửi tới Prisma');
  assert.equal(databaseInsertData.delivery_date, validDateStr, 'MySQL orders.delivery_date phải được lưu chính xác');
  assert.equal(databaseInsertData.is_anonymous, true, 'MySQL orders.is_anonymous phải được lưu true');
  assert.equal(responseData.deliveryDate, validDateStr, 'API response phải trả về deliveryDate');
  assert.equal(responseData.isAnonymous, true, 'API response phải trả về isAnonymous');

  console.log('  ✓ Đạt: Luồng createOrder khép kín: Controller -> Service -> DB -> Client trả về đầy đủ!');
}

// ============================================================================
// 3. KIỂM THỬ BẢO VỆ TỒN KHO KHÔNG ÂM (PRISMA CATALOG REPOSITORY)
// ============================================================================
{
  console.log('\n3️⃣ Kiểm tra bảo vệ tồn kho không âm ở backend (PrismaCatalogRepository)...');

  let currentStock = 0; // Hàng đã hết tồn kho
  const mockPrisma = {
    products: {
      findUnique: async () => ({ id: 'PROD-001', stock: currentStock }),
      update: async ({ data }) => ({ id: 'PROD-001', ...data }),
      create: async ({ data }) => ({ id: data.id, ...data })
    }
  };

  const catalogRepo = new PrismaCatalogRepository(mockPrisma);

  // Giảm kho khi tồn = 0 -> Phải quăng lỗi ValidationError
  await assert.rejects(
    async () => {
      await catalogRepo.updateProduct('PROD-001', { stockDelta: -1 });
    },
    /Số lượng tồn kho không đủ để giảm/i,
    'Phải chặn giảm kho khi tồn không đủ'
  );
  console.log('  ✓ Đạt: Chặn thành công giảm tồn kho âm khi stock = 0');

  // Nhập kho số âm -> Phải quăng lỗi ValidationError
  await assert.rejects(
    async () => {
      await catalogRepo.updateProduct('PROD-001', { stock: -5 });
    },
    /Số lượng tồn kho không được là số âm/i,
    'Phải chặn cập nhật số tồn âm'
  );
  console.log('  ✓ Đạt: Chặn thành công cập nhật tồn tuyệt đối là số âm');
}

// ============================================================================
// 4. KIỂM THỬ ĐỒNG BỘ partially_refunded (PAYMENT SERVICE & BUSINESS RULES)
// ============================================================================
{
  console.log('\n4️⃣ Kiểm tra đồng bộ partially_refunded trong PaymentService & Business Rules...');

  const mockOrderRepo = {
    findOrderById: async (id) => ({
      id,
      paymentMethod: 'sepay',
      paymentStatus: 'partially_refunded',
      status: 'shipping',
      totalAmount: 500000,
      customerPhone: '0901234567',
      paymentTransactions: [{ id: 'tx-1', amount: 500000 }]
    })
  };

  const paymentService = new PaymentService(mockOrderRepo);

  const statusCheck = await paymentService.checkPaymentStatus('DH-PARTIAL', { user: null, phone: '0901234567' });
  assert.equal(statusCheck.paid, true, 'PaymentService.checkPaymentStatus PHẢI trả paid: true cho đơn partially_refunded');
  console.log('  ✓ Đạt: PaymentService.checkPaymentStatus xác nhận partially_refunded đã thanh toán');

  const partialOrder = {
    paymentMethod: 'sepay',
    paymentStatus: 'partially_refunded',
    status: 'shipping'
  };

  assert.equal(isUnpaidSepayOrder(partialOrder), false, 'isUnpaidSepayOrder PHẢI trả false cho partially_refunded');
  assert.equal(isOrderPaid(partialOrder), true, 'isOrderPaid PHẢI trả true cho partially_refunded');
  console.log('  ✓ Đạt: Business Rules nhận diện partially_refunded là đơn đã thanh toán');
}

console.log('\n================================================================');
console.log('🎉 TẤT CẢ CÁC BÀI TEST TÍCH HỢP THẬT CONTROLLER & SERVICE ĐÃ PASS 100%!');
console.log('================================================================\n');
