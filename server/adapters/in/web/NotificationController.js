/**
 * NotificationController.js - Express Controller xu ly thong bao tren MySQL 8.0
 * Thuoc tang Adapters / In / Web
 */

export class NotificationController {
  constructor(notificationRepository) {
    this.notifRepo = notificationRepository;
  }

  // GET /api/notifications
  getNotifications = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Can dang nhap de xem thong bao' } });
      }

      const notifs = await this.notifRepo.getUserNotifications(user.id);
      return res.status(200).json(notifs);
    } catch (err) {
      console.error('Loi getNotifications:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay thong bao' } });
    }
  };

  // PATCH /api/notifications/:id/read
  markAsRead = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Can dang nhap' } });
      }

      const { id } = req.params;
      const result = await this.notifRepo.markAsRead(id, user.id);
      if (!result) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Khong tim thay thong bao hoac khong co quyen' } });
      }

      return res.status(200).json({ success: true, notification: result });
    } catch (err) {
      console.error('Loi markAsRead:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi cap nhat thong bao' } });
    }
  };

  // PATCH /api/notifications/read-all
  markAllAsRead = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Can dang nhap' } });
      }

      const count = await this.notifRepo.markAllAsRead(user.id);
      return res.status(200).json({ success: true, count, message: 'Da danh dau doc tat ca thong bao' });
    } catch (err) {
      console.error('Loi markAllAsRead:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi cap nhat toan bo thong bao' } });
    }
  };
}

