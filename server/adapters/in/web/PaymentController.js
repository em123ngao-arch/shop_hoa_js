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
  constructor(paymentService, webhookApiKey = '') {
    this.paymentService = paymentService;
    this.webhookApiKey = webhookApiKey;
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
    const bankCode = process.env.SEPAY_BANK_CODE;
    const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER;
    const accountHolder = process.env.SEPAY_ACCOUNT_HOLDER;

    if (!bankCode || !accountNumber || !accountHolder) {
      return res.status(503).json({
        error: {
          code: 'PAYMENT_UNAVAILABLE',
          message: 'Thông tin tài khoản ngân hàng chưa được cấu hình trên máy chủ'
        }
      });
    }

    return res.status(200).json({
      bankCode,
      accountNumber,
      accountHolder
    });
  };

  // POST /api/sepay/check-payment/:orderId
  checkPayment = async (req, res) => {
    try {
      const { orderId } = req.params;
      const phone = req.body?.phone || req.query?.phone || '';
      const result = await this.paymentService.checkPaymentStatus(orderId, {
        user: req.user || null,
        phone
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

  // POST /api/sepay/simulate-payment/:orderId
  simulatePayment = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Chế độ mô phỏng thanh toán bị vô hiệu hóa trong môi trường production' } });
    }
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Che do mo phong thanh toan dang tat' } });
    }
    try {
      const { orderId } = req.params;
      const phone = req.body?.phone || req.query?.phone || '';
      const result = await this.paymentService.simulatePayment(orderId, {
        user: req.user || null,
        phone
      });

      return res.status(200).json({
        paid: result.paid,
        orderId: result.order?.id || orderId,
        order: result.order
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
      if (err.name === 'ValidationError') {
        return res.status(409).json({ error: { code: 'INVALID_ORDER_STATE', message: err.message } });
      }
      console.error('Loi simulatePayment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Khong the mo phong thanh toan' } });
    }
  };

  // POST /api/sepay/webhook
  webhook = async (req, res) => {
    try {
      if (!this.webhookApiKey) {
        return res.status(503).json({ success: false, error: 'Webhook thanh toán chưa được cấu hình xác thực' });
      }
      const authorization = req.get('authorization') || '';
      const suppliedKey = authorization.replace(/^Apikey\s+/i, '');
      if (!/^Apikey\s+/i.test(authorization) || !safeSecretEquals(suppliedKey, this.webhookApiKey)) {
        return res.status(401).json({ success: false, error: 'Webhook authentication failed' });
      }

      const result = await this.paymentService.processWebhook(req.body || {});
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, error: err.message });
      }
      console.error('Loi webhook:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}
