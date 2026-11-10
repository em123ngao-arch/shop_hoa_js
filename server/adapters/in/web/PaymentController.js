/**
 * PaymentController.js - Express Controller xu ly thanh toan VietQR SePay tren MySQL 8.0
 * Thuoc tang Adapters / In / Web
 */

export class PaymentController {
  constructor(prismaClient, sepayToken = '', orderRepository = null) {
    this.prisma = prismaClient;
    this.sepayToken = sepayToken;
    this.orderRepository = orderRepository;
  }

  // GET /api/sepay/config
  getConfig = (req, res) => {
    return res.status(200).json({
      bankCode: process.env.SEPAY_BANK_CODE || 'Sacombank',
      accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '70207003455',
      accountHolder: process.env.SEPAY_ACCOUNT_HOLDER || 'NGUYEN DUY BAO'
    });
  };

  // GET /api/sepay/check-payment/:orderId
  checkPayment = async (req, res) => {
    try {
      const { orderId } = req.params;
      const cleanOrderCode = orderId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

      // Tim don hang trong MySQL
      const order = await this.prisma.orders.findFirst({
        where: {
          OR: [
            { id: orderId },
            { order_code: orderId }
          ]
        },
        include: { payment_transactions: true }
      });

      if (!order) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Khong tim thay don hang' } });
      }

      if (order.payment_status === 'paid') {
        return res.status(200).json({
          paid: true,
          orderId: order.id,
          order: this.orderRepository ? await this.orderRepository.findOrderById(order.id) : order,
          transaction: order.payment_transactions?.[0] || null
        });
      }

      if (!this.sepayToken) {
        return res.status(200).json({ paid: false, orderId: order.id, message: 'SePay Sandbox Mode (No API Token)' });
      }

      // Goi SePay API kiem tra giao dich thuc te
      const response = await fetch('https://my.sepay.vn/userapi/transactions/list', {
        headers: { 'Authorization': `Bearer ${this.sepayToken}` }
      });

      if (!response.ok) {
        return res.status(502).json({ error: { code: 'GATEWAY_ERROR', message: 'Loi ket noi toi SePay Server' } });
      }

      const data = await response.json();
      const transactions = data.transactions || [];

      const matchingTx = transactions.find(tx => {
        const content = (tx.transaction_content || '').toUpperCase();
        const codeMatches = content.includes(cleanOrderCode) ||
          (cleanOrderCode.startsWith('DH') && content.includes(cleanOrderCode.slice(2)));
        const amountIn = parseFloat(tx.amount_in || 0);
        return codeMatches && amountIn >= order.total_amount;
      });

      if (matchingTx) {
        // Cap nhat don hang sang PAID trong MySQL
        await this.prisma.$transaction(async (tx) => {
          await tx.orders.update({
            where: { id: order.id },
            data: {
              payment_status: 'paid',
              status: 'confirmed'
            }
          });

          const txId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          await tx.payment_transactions.create({
            data: {
              id: txId,
              order_id: order.id,
              provider: 'sepay',
              provider_tx_id: String(matchingTx.id),
              amount: Math.round(parseFloat(matchingTx.amount_in)),
              bank_brand: matchingTx.bank_brand_name || 'Sacombank',
              account_number: matchingTx.account_number || '',
              transaction_date: new Date(matchingTx.transaction_date || Date.now())
            }
          });

          if (order.user_id) {
            await tx.notifications.create({
              data: {
                id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                user_id: order.user_id,
                order_id: order.id,
                title: `Thanh toán thành công #${order.order_code}`,
                message: `Đã nhận chuyển khoản ${Number(matchingTx.amount_in).toLocaleString()}đ qua SePay. Nghệ nhân đang bắt đầu kết hoa!`,
                is_read: false
              }
            });
          }
        });

        return res.status(200).json({
          paid: true,
          orderId: order.id,
          order: this.orderRepository ? await this.orderRepository.findOrderById(order.id) : undefined,
          transaction: matchingTx
        });
      }

      return res.status(200).json({ paid: false, orderId: order.id });
    } catch (err) {
      console.error('Loi checkPayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
    }
  };

  // Chi mo trong moi truong demo duoc bat chu dong, khong bao gio dung de xac nhan tien that.
  simulatePayment = async (req, res) => {
    if (process.env.DEMO_MODE !== 'true' || process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Che do mo phong thanh toan dang tat' } });
    }
    try {
      const { orderId } = req.params;
      const order = await this.prisma.orders.findFirst({
        where: { OR: [{ id: orderId }, { order_code: orderId }] }
      });
      if (!order) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Khong tim thay don hang' } });
      if (order.payment_method !== 'sepay' || order.status !== 'pending' || order.payment_status === 'paid') {
        return res.status(409).json({ error: { code: 'INVALID_ORDER_STATE', message: 'Don hang khong o trang thai cho thanh toan' } });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.orders.update({
          where: { id: order.id },
          data: { payment_status: 'paid', status: 'confirmed' }
        });
        if (order.user_id) {
          await tx.notifications.create({
            data: {
              id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              user_id: order.user_id,
              order_id: order.id,
              title: `Mo phong thanh toan thanh cong #${order.order_code}`,
              message: 'Thanh toan da duoc xac nhan trong che do demo.',
              is_read: false
            }
          });
        }
      });
      return res.status(200).json({
        paid: true,
        orderId: order.id,
        order: this.orderRepository ? await this.orderRepository.findOrderById(order.id) : undefined
      });
    } catch (err) {
      console.error('Loi simulatePayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Khong the mo phong thanh toan' } });
    }
  };

  // POST /api/sepay/webhook
  webhook = async (req, res) => {
    try {
      const payload = req.body;
      const content = (payload.content || payload.transaction_content || '').toUpperCase();
      const amountIn = parseFloat(payload.transferAmount || payload.amount_in || 0);

      const match = content.match(/DH[A-Z0-9]+/);
      if (match) {
        const orderCode = match[0];
        const order = await this.prisma.orders.findFirst({
          where: { order_code: orderCode }
        });

        if (order && order.payment_method === 'sepay' && order.payment_status !== 'paid' && amountIn >= order.total_amount) {
          await this.prisma.$transaction(async (tx) => {
            await tx.orders.update({
              where: { id: order.id },
              data: {
                payment_status: 'paid',
                status: 'confirmed'
              }
            });

            const txId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await tx.payment_transactions.upsert({
              where: { provider_tx_id: String(payload.id || txId) },
              update: {},
              create: {
                id: txId,
                order_id: order.id,
                provider: 'sepay',
                provider_tx_id: String(payload.id || txId),
                amount: Math.round(amountIn),
                bank_brand: payload.gateway || payload.bank_brand_name || 'Sacombank',
                account_number: payload.accountNumber || payload.account_number || '',
                transaction_date: new Date(payload.transactionDate || Date.now())
              }
            });

            if (order.user_id) {
              await tx.notifications.create({
                data: {
                  id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                  user_id: order.user_id,
                  order_id: order.id,
                  title: `Thanh toán thành công #${order.order_code}`,
                  message: `Đã nhận chuyển khoản ${Number(amountIn).toLocaleString()}đ qua SePay. Nghệ nhân đang bắt đầu kết hoa!`,
                  is_read: false
                }
              });
            }
          });
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Loi webhook:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

