/**
 * RefundController.js - Inbound Web Adapter cho phan he Hoan tien 2 cap (Thu ngan -> Admin)
 * Thuoc tang Adapters / In / Web
 */

export class RefundController {
  constructor(refundService) {
    this.refundService = refundService;
  }

  _handleError(res, err, fallbackMsg) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    if (err.name === 'AuthenticationError') {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: err.message } });
    }
    if (err.name === 'ForbiddenError') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
    }
    if (err.name === 'NotFoundError') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }
    console.error('[RefundController] Error:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: fallbackMsg } });
  }

  getRefunds = async (req, res) => {
    try {
      const { status } = req.query;
      const list = await this.refundService.listRefunds({ status }, req.user);
      return res.status(200).json(list);
    } catch (err) {
      return this._handleError(res, err, 'Lỗi máy chủ khi tải danh sách hoàn tiền');
    }
  };

  createRefund = async (req, res) => {
    try {
      const { orderId, amount, reason, bankInfo } = req.body || {};
      const created = await this.refundService.createRefundRequest(
        { orderId, amount, reason, bankInfo },
        req.user
      );
      return res.status(201).json(created);
    } catch (err) {
      return this._handleError(res, err, 'Lỗi máy chủ khi lập phiếu yêu cầu hoàn tiền');
    }
  };

  approveRefund = async (req, res) => {
    try {
      const { adminNote, refundTxRef, restock } = req.body || {};
      const updated = await this.refundService.approveRefund(
        req.params.id,
        { adminNote, refundTxRef, restock: Boolean(restock) },
        req.user
      );
      return res.status(200).json(updated);
    } catch (err) {
      return this._handleError(res, err, 'Lỗi máy chủ khi duyệt hoàn tiền');
    }
  };

  rejectRefund = async (req, res) => {
    try {
      const { adminNote } = req.body || {};
      const updated = await this.refundService.rejectRefund(
        req.params.id,
        { adminNote },
        req.user
      );
      return res.status(200).json(updated);
    } catch (err) {
      return this._handleError(res, err, 'Lỗi máy chủ khi từ chối phiếu hoàn tiền');
    }
  };
}

