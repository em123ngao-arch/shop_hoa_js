/**
 * OrderExpiryService.js - Application Service quan ly tu dong huy don hang cho thanh toan qua han
 * Thuoc tang Application (Clean / Hexagonal Architecture: 0 Express, 0 Prisma dependencies)
 */

export class OrderExpiryService {
  /**
   * @param {Object} orderRepository - Outbound Port / Adapter cua Order Repository
   * @param {number} [ttlMinutes=30] - Thoi gian cho phep cho thanh toan (tinh bang phut)
   */
  constructor(orderRepository, ttlMinutes = 30) {
    this.orderRepo = orderRepository;
    this.ttlMinutes = Number(ttlMinutes) || 30;
    this.timer = null;
    this.isProcessing = false;
  }

  /**
   * Quet va tu dong huy cac don hang SePay pending da qua thoi gian quy dinh.
   * Dam bao chi huy don dang cho (status=pending & payment_status=pending).
   * @returns {Promise<Array<Object>>} Danh sach don da bi huy va hoan kho
   */
  async processExpiredOrders() {
    if (this.isProcessing) {
      return [];
    }
    this.isProcessing = true;
    const cancelledOrders = [];

    try {
      const cutoffDate = new Date(Date.now() - this.ttlMinutes * 60 * 1000);
      const expiredList = await this.orderRepo.findExpiredPendingSepayOrders(cutoffDate);

      for (const item of expiredList) {
        try {
          const cancelled = await this.orderRepo.cancelExpiredPendingOrder(item.id);
          if (cancelled) {
            cancelledOrders.push(cancelled);
            console.log(`[OrderExpiryService] Đã tự động hủy đơn hết hạn thanh toán: #${cancelled.order_code || cancelled.id}`);
          }
        } catch (itemErr) {
          console.error(`[OrderExpiryService] Lỗi khi xử lý đơn hết hạn #${item.id}:`, itemErr.message);
        }
      }
    } catch (err) {
      console.error('[OrderExpiryService] Lỗi quét danh sách đơn hết hạn:', err.message);
    } finally {
      this.isProcessing = false;
    }

    return cancelledOrders;
  }

  /**
   * Khoi dong background timer quet dinh ky moi `intervalMs` (mac dinh 5 phut)
   * @param {number} [intervalMs=300000] - Chu ky quet (5 phut = 300.000 ms)
   * @returns {NodeJS.Timeout}
   */
  start(intervalMs = 5 * 60 * 1000) {
    if (this.timer) {
      return this.timer;
    }

    // Chay dinh ky moi chu ky
    this.timer = setInterval(() => {
      this.processExpiredOrders().catch(err => {
        console.error('[OrderExpiryService] Lỗi chạy định kỳ:', err.message);
      });
    }, intervalMs);

    // unref() de khong ngan can tien trinh Node thoat khi can thiet
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }

    return this.timer;
  }

  /**
   * Dung background timer khi tat server
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

