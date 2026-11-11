/**
 * OrderController.js - Express Controller dieu khien don hang tren MySQL 8.0
 * Thuoc tang Adapters / In / Web
 */

export class OrderController {
  constructor(orderRepository) {
    this.orderRepo = orderRepository;
  }

  // POST /api/orders
  createOrder = async (req, res) => {
    try {
      // Guest order tao voi userId null; khong chap nhan userId tu body de tranh gan don vao tai khoan khac.
      const userId = req.user ? req.user.id : null;
      const newOrder = await this.orderRepo.createOrder({
        orderData: req.body,
        userId: userId
      });
      return res.status(201).json(newOrder);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      console.error('Loi createOrder:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Loi tao don hang' } });
    }
  };

  // GET /api/orders
  getOrders = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Yeu cau dang nhap de xem danh sach don hang' } });
      }

      const orders = await this.orderRepo.findOrders({
        userId: user.id,
        role: user.role
      });
      return res.status(200).json(orders);
    } catch (err) {
      console.error('Loi getOrders:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay danh sach don hang' } });
    }
  };

  // POST /api/orders/lookup: tra cuu don guest bang ma don + so dien thoai nguoi dat/nhan.
  lookupGuestOrder = async (req, res) => {
    try {
      const orderCode = String(req.body.orderCode || '').trim();
      const phone = String(req.body.phone || '').replace(/\D/g, '');
      if (!orderCode || phone.length < 9 || phone.length > 11) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Vui lòng nhập mã đơn và số điện thoại hợp lệ' } });
      }

      const order = await this.orderRepo.findOrderById(orderCode);
      const phoneMatches = [order?.customerPhone, order?.recipientPhone]
        .filter(Boolean)
        .some(savedPhone => String(savedPhone).replace(/\D/g, '') === phone);
      if (!order || !phoneMatches) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đơn phù hợp với mã đơn và số điện thoại' } });
      }
      return res.status(200).json(order);
    } catch (err) {
      console.error('Loi lookupGuestOrder:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi tra cứu đơn hàng' } });
    }
  };

  // GET /api/orders/:id
  getOrderById = async (req, res) => {
    try {
      const { id } = req.params;
      const order = await this.orderRepo.findOrderById(id);
      if (!order) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Khong tim thay don hang #${id}` } });
      }

      // IDOR Protection: Khach hang chi duoc xem don hang cua chinh minh
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Yeu cau dang nhap' } });
      }
      if (user.role !== 'admin' && user.role !== 'staff' && order.userId !== user.id) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Ban khong co quyen xem thong tin don hang nay' } });
      }

      return res.status(200).json(order);
    } catch (err) {
      console.error('Loi getOrderById:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay chi tiet don hang' } });
    }
  };

  // PATCH /api/orders/:id/status
  updateOrderStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Yeu cau dang nhap' } });
      }

      if (!status) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Vui long cung cap trang thai moi' } });
      }

      let result;
      if (user.role === 'admin' || user.role === 'staff') {
        result = await this.orderRepo.updateOrderStatus(id, status);
      } else if (status === 'cancelled') {
        result = await this.orderRepo.cancelCustomerOrder(id, user.id);
      } else {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Khach hang chi duoc huy don chua xu ly' } });
      }
      return res.status(200).json({
        success: true,
        order: result.order,
        notification: result.notification
      });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'INVALID_STATUS_TRANSITION', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi updateOrderStatus:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi cap nhat trang thai don hang' } });
    }
  };
}

