/**
 * PaymentController.js - Express Controller xu ly thanh toan VietQR SePay tren Express
 * Thuoc tang Adapters / In / Web (Hexagonal Architecture)
 * Khong import Prisma, khong chua Business Logic, chi xu ly HTTP qua PaymentService
 */

import crypto from 'crypto';

const safeSecretEquals = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

export class PaymentController {
  /**
   * @param {import('../../application/PaymentService.js').PaymentService} paymentService
   * @param {string} [webhookApiKey='']
   */
  constructor(paymentService, webhookApiKey = '', liveEnabled = String(process.env.SEPAY_LIVE_ENABLED || '').toLowerCase() === 'true') {
    this.paymentService = paymentService;
    this.webhookApiKey = webhookApiKey;
    this.liveEnabled = liveEnabled === true;
  }

  /**
   * Helper recordPayment proxy de tuong thich nguoc voi cac test cu
   */
  async recordPayment(order, providerTxId, amount, transaction = {}) {
    const orderId = typeof order === 'string' ? order : (order?.id || order?.order_code);
    return this.paymentService.recordPayment(orderId, providerTxId, amount, transaction);
  }

  // GET /api/sepay/config
  getConfig = (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    // Luôn ưu tiên biến môi trường; nếu thiếu tự động fallback về tài khoản Sacombank chính thức của tiệm hoa
    const bankCode = process.env.SEPAY_BANK_CODE || 'Sacombank';
    const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER || '70207003455';
    const accountHolder = process.env.SEPAY_ACCOUNT_HOLDER || 'NGUYEN DUY BAO';

    return res.status(200).json({
      bankCode,
      accountNumber,
      accountHolder,
      simulationOnly: false,
      simulationEnabled: process.env.NODE_ENV !== 'production'
    });
  };

  // POST /api/sepay/check-payment/:orderId
  checkPayment = async (req, res) => {
    try {
      const { orderId } = req.params;
      const phone = req.body?.phone || req.query?.phone || '';
      const result = await this.paymentService.checkPaymentStatus(orderId, {
        user: req.user || null,
        phone,
        intentId: req.body?.intentId || null
      });

      return res.status(200).json({
        paid: result.paid,
        cancelled: Boolean(result.cancelled),
        orderId: result.order?.id || orderId,
        order: result.order,
        transaction: result.transaction,
        message: result.message
      });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({
          error: {
            code: err.name || 'CLIENT_ERROR',
            message: err.message
          }
        });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      if (err.name === 'UnauthorizedError' || err.name === 'AuthenticationError') {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
      }
      if (err.name === 'ForbiddenError') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      }
      console.error('Loi checkPayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
    }
  };

  // POST /api/sepay/simulate-payment/:orderId — chỉ cho local/dev.
  simulatePayment = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Mô phỏng thanh toán bị tắt trong production.' }
      });
    }
    try {
      const result = await this.paymentService.simulatePayment(req.params.orderId, {
        user: req.user || null,
        phone: req.body?.phone || '',
        intentId: req.body?.intentId || null
      });
      return res.status(200).json(result);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code || err.name, message: err.message } });
      console.error('Loi simulatePayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể mô phỏng thanh toán local' } });
    }
  };

  // POST /api/sepay/webhook
  webhook = async (req, res) => {
    try {
      const webhookKey = this.webhookApiKey || process.env.SEPAY_WEBHOOK_API_KEY || 'sepay_webhook_secret_key_2026';
      const authorization = req.get('authorization') || '';
      const suppliedKey = authorization.replace(/^Apikey\s+/i, '');
      if (!/^Apikey\s+/i.test(authorization) || !safeSecretEquals(suppliedKey, webhookKey)) {
        return res.status(401).json({ success: false, error: 'Webhook authentication failed' });
      }

      const result = await this.paymentService.processWebhook(req.body || {});
      // SePay yêu cầu success:true; 201 tương thích cả các webhook đời cũ/OAuth chỉ chấp nhận 201.
      return res.status(201).json(result);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, error: err.message });
      }
      console.error('Loi webhook:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // GET /api/sepay/reconciliation — khoản chuyển chưa khớp mã thanh toán.
  getUnmatchedPayments = async (req, res) => {
    try {
      const rows = await this.paymentService.listUnmatchedPayments(req.user);
      return res.status(200).json(rows);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi getUnmatchedPayments:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể tải danh sách giao dịch cần đối soát' } });
    }
  };

  // PATCH /api/sepay/reconciliation/:id — đánh dấu đã xử lý sau khi kiểm tra thủ công.
  reviewUnmatchedPayment = async (req, res) => {
    try {
      const result = await this.paymentService.reviewUnmatchedPayment({ id: req.params.id, note: req.body?.note, user: req.user });
      return res.status(200).json({ success: true, transaction: result });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
      console.error('Loi reviewUnmatchedPayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Không thể cập nhật giao dịch đối soát' } });
    }
  };
}
