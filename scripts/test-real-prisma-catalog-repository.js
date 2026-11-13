import assert from 'assert';
import { PrismaCatalogRepository } from '../server/adapters/out/persistence/PrismaCatalogRepository.js';

console.log('🧪 [TEST 4] Kiểm tra thực tế: PrismaCatalogRepository (Atomic delta & Foreign Key protection)...');

function createMockPrismaCatalog() {
  const capturedUpdates = [];
  const state = {
    products: [
      { id: 'PROD-001', name: 'Hoa Baby', stock: 15, is_active: true }
    ],
    orderItemsCount: 3 // Đã có 3 đơn hàng lịch sử
  };

  const mockPrisma = {
    products: {
      update: async ({ where, data }) => {
        capturedUpdates.push({ where, data });
        return { id: where.id, ...data };
      },
      delete: async ({ where }) => {
        state.products = state.products.filter(p => p.id !== where.id);
        return { id: where.id };
      }
    },
    order_items: {
      count: async ({ where }) => {
        return state.orderItemsCount;
      }
    }
  };

  return { mockPrisma, capturedUpdates, state };
}

async function run() {
  const { mockPrisma, capturedUpdates, state } = createMockPrismaCatalog();
  const repo = new PrismaCatalogRepository(mockPrisma);

  // 1. Kiểm tra cập nhật kho nguyên tử qua delta (+1)
  console.log('1️⃣ Kiểm tra cập nhật kho nguyên tử qua stockDelta (+1)...');
  await repo.updateProduct('PROD-001', { stockDelta: 1 });
  assert.strictEqual(capturedUpdates.length, 1);
  assert.deepStrictEqual(capturedUpdates[0].data.stock, { increment: 1 }, 'Phải sinh ra { increment: 1 } để MySQL thực thi atomic increment!');
  console.log('  ✓ Đạt: updateProduct({ stockDelta: 1 }) sinh ra Prisma stock: { increment: 1 }');

  // 2. Kiểm tra cập nhật kho nguyên tử qua delta (-1)
  console.log('2️⃣ Kiểm tra cập nhật kho nguyên tử qua stockDelta (-1)...');
  await repo.updateProduct('PROD-001', { stockDelta: -1 });
  assert.strictEqual(capturedUpdates.length, 2);
  assert.deepStrictEqual(capturedUpdates[1].data.stock, { increment: -1 }, 'Phải sinh ra { increment: -1 } để MySQL thực thi atomic decrement!');
  console.log('  ✓ Đạt: updateProduct({ stockDelta: -1 }) sinh ra Prisma stock: { increment: -1 }');

  // 3. Kiểm tra bảo vệ khóa ngoại khi xóa sản phẩm đã có đơn hàng
  console.log('3️⃣ Kiểm tra chặn xóa sản phẩm đã phát sinh đơn hàng...');
  await assert.rejects(
    async () => {
      await repo.deleteProduct('PROD-001');
    },
    /không thể xóa vĩnh viễn\. Vui lòng chuyển sang trạng thái "Ngừng kinh doanh"/
  );
  console.log('  ✓ Đạt: deleteProduct bắt được 3 order_items và ném ValidationError hướng dẫn "Ngừng kinh doanh" thay vì để MySQL văng 500');

  console.log('🎉 TEST 4 HOÀN TẤT: PrismaCatalogRepository đạt chuẩn 100%!\n');
}

run().catch(err => {
  console.error('❌ Lỗi Test 4:', err);
  process.exit(1);
});

