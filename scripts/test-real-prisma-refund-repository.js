import assert from 'assert';
import { PrismaRefundRepository } from '../server/adapters/out/persistence/PrismaRefundRepository.js';

console.log('🧪 [TEST 3] Kiểm tra thực tế: PrismaRefundRepository (Class thật imported từ backend)...');

// Thiết lập Mock Prisma Client mô phỏng chính xác hành vi Transaction & Database
function createMockPrismaEngine() {
  const state = {
    order: {
      id: 'ORD-TEST-001',
      order_code: 'DH2026111201',
      status: 'shipping',
      payment_status: 'paid',
      total_amount: 350000,
      order_items: [{ product_id: 'PROD-001', quantity: 2 }],
      payment_transactions: [{ id: 'TX-1', amount: 350000 }]
    },
    refunds: [],
    productStockUpdates: []
  };

  const tx = {
    orders: {
      findFirst: async () => ({
        ...state.order,
        refund_requests: state.refunds,
        payment_transactions: state.order.payment_transactions
      }),
      findUnique: async () => ({
        ...state.order,
        refund_requests: state.refunds,
        payment_transactions: state.order.payment_transactions
      }),
      update: async ({ data }) => {
        Object.assign(state.order, data);
        return state.order;
      }
    },
    refund_requests: {
      findUnique: async ({ where }) => {
        const found = state.refunds.find(r => r.id === where.id);
        if (!found) return null;
        return {
          ...found,
          orders: {
            ...state.order,
            order_items: state.order.order_items,
            payment_transactions: state.order.payment_transactions
          }
        };
      },
      findMany: async ({ where }) => {
        return state.refunds.filter(r => {
          if (where.order_id && r.order_id !== where.order_id) return false;
          if (where.status && r.status !== where.status) return false;
          return true;
        });
      },
      create: async ({ data }) => {
        state.refunds.push({ ...data });
        return data;
      },
      updateMany: async ({ where, data }) => {
        const targets = state.refunds.filter(r => r.id === where.id && r.status === where.status);
        targets.forEach(t => Object.assign(t, data));
        return { count: targets.length };
      }
    },
    products: {
      update: async ({ where, data }) => {
        state.productStockUpdates.push({ where, data });
        return { id: where.id, ...data };
      }
    },
    vouchers: {
      updateMany: async () => ({ count: 1 })
    },
    notifications: {
      create: async () => ({})
    }
  };

  const mockPrisma = {
    $transaction: async (callback) => callback(tx),
    orders: tx.orders,
    refund_requests: tx.refund_requests,
    products: tx.products
  };

  return { mockPrisma, state };
}

async function run() {
  const { mockPrisma, state } = createMockPrismaEngine();
  const repo = new PrismaRefundRepository(mockPrisma);

  // 1. Tạo yêu cầu hoàn tiền 1 phần (50.000đ do móp giấy gói)
  console.log('1️⃣ Kiểm tra tạo phiếu hoàn tiền 1 phần 50.000đ...');
  const req1 = await repo.createRequest({
    orderId: 'ORD-TEST-001',
    amount: 50000,
    reason: 'Móp nơ và giấy gói khi giao',
    bankInfo: 'MBBank 0987654321',
    requestedBy: { id: 'STAFF-01', name: 'Nhân viên A' }
  });
  assert(req1, 'Tạo phiếu hoàn tiền 1 phần phải thành công');
  console.log('  ✓ Đạt: createRequest tạo thành công phiếu hoàn tiền 50.000đ');

  // 2. Chặn tạo phiếu thứ 2 khi phiếu 1 đang chờ duyệt (Pending Approval lock)
  await assert.rejects(
    async () => {
      await repo.createRequest({
        orderId: 'ORD-TEST-001',
        amount: 30000,
        reason: 'Phiếu trùng',
        bankInfo: 'MBBank 0987654321',
        requestedBy: { id: 'STAFF-01', name: 'Nhân viên A' }
      });
    },
    /chờ Quản trị viên duyệt/
  );
  console.log('  ✓ Đạt: Chặn tạo phiếu trùng khi đang có phiếu pending_approval');

  // 3. Admin duyệt hoàn tiền một phần (50.000đ / 350.000đ)
  console.log('2️⃣ Admin duyệt phiếu hoàn tiền 1 phần...');
  state.productStockUpdates = []; // Reset tracking
  await repo.approveRequest(req1.id, {
    adminUser: { id: 'ADMIN-01', name: 'Admin Tiệm Hoa' },
    adminNote: 'Đồng ý bồi thường tiền gói hoa',
    refundTxRef: 'TXREF-50K'
  });

  assert.strictEqual(state.order.payment_status, 'partially_refunded', 'payment_status phải là partially_refunded');
  assert.strictEqual(state.order.status, 'shipping', 'Đơn hàng KHÔNG ĐƯỢC bị hủy khi chỉ hoàn một phần!');
  assert.strictEqual(state.productStockUpdates.length, 0, 'Tuyệt đối KHÔNG ĐƯỢC hoàn kho khi chỉ hoàn tiền một phần!');
  console.log('  ✓ Đạt: Hoàn tiền một phần set payment_status = partially_refunded, không hủy đơn, không hoàn kho');

  // 4. Tạo tiếp phiếu hoàn nốt phần còn lại 300.000đ
  console.log('3️⃣ Tạo và duyệt phiếu hoàn nốt phần còn lại (300.000đ)...');
  const req2 = await repo.createRequest({
    orderId: 'ORD-TEST-001',
    amount: 300000,
    reason: 'Khách không nhận hoa và chuyển trả về',
    bankInfo: 'MBBank 0987654321',
    requestedBy: { id: 'STAFF-01', name: 'Nhân viên A' }
  });

  // 4a. Duyệt hoàn toàn phần khi đơn đang SHIPPING NHƯNG CHƯA XÁC NHẬN HOA QUAY VỀ (restock = false)
  state.productStockUpdates = [];
  await repo.approveRequest(req2.id, {
    adminUser: { id: 'ADMIN-01', name: 'Admin Tiệm Hoa' },
    adminNote: 'Đồng ý hủy đơn hoàn tiền',
    refundTxRef: 'TXREF-300K',
    restock: false // HOA ĐANG TRÊN ĐƯỜNG, CHƯA VỀ TIỆM
  });

  assert.strictEqual(state.order.payment_status, 'refunded', 'payment_status phải là refunded khi hoàn toàn phần');
  assert.strictEqual(state.order.status, 'cancelled', 'Đơn hàng phải chuyển sang cancelled khi hoàn toàn phần');
  assert.strictEqual(state.productStockUpdates.length, 0, 'Hoa đang shipping và chưa xác nhận quay về (restock=false) thì KHÔNG ĐƯỢC tự động cộng kho!');
  console.log('  ✓ Đạt: Hoàn toàn phần đơn shipping hủy đơn nhưng an toàn KHÔNG tự động cộng kho khi restock = false');

  console.log('🎉 TEST 3 HOÀN TẤT: PrismaRefundRepository đạt chuẩn nghiệp vụ 100%!\n');
}

run().catch(err => {
  console.error('❌ Lỗi Test 3:', err);
  process.exit(1);
});
