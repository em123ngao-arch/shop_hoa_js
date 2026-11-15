import { randomUUID } from 'node:crypto';

/**
 * PrismaNotificationRepository.js - Xu ly thong bao don hang theo user tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

export class PrismaNotificationRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Tao thong bao moi cho nguoi dung
   */
  async createNotification({ userId, orderId = null, title, message }) {
    if (!userId || !title || !message) return null;
    try {
      const created = await this.prisma.notifications.create({
        data: {
          id: randomUUID(),
          user_id: userId,
          order_id: orderId || null,
          title: String(title).slice(0, 200),
          message: String(message),
          is_read: false
        }
      });
      return {
        id: created.id,
        userId: created.user_id,
        orderId: created.order_id,
        title: created.title,
        message: created.message,
        read: created.is_read,
        createdAt: created.created_at
      };
    } catch (err) {
      console.error('[NotificationRepository] Khong tao duoc thong bao:', err.message);
      return null;
    }
  }

  /**
   * Lay danh sach thong bao cua nguoi dung
   */
  async getUserNotifications(userId) {
    if (!userId) return [];

    const notifs = await this.prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    return notifs.map(n => ({
      id: n.id,
      userId: n.user_id,
      user_id: n.user_id,
      orderId: n.order_id,
      order_id: n.order_id,
      title: n.title,
      message: n.message,
      read: n.is_read,
      is_read: n.is_read,
      createdAt: n.created_at,
      created_at: n.created_at
    }));
  }

  /**
   * Danh dau da doc mot thong bao (IDOR Safe: chi sua khi thuoc ve userId)
   */
  async markAsRead(notifId, userId) {
    const notif = await this.prisma.notifications.findFirst({
      where: { id: notifId, user_id: userId }
    });

    if (!notif) return null;

    const updated = await this.prisma.notifications.update({
      where: { id: notif.id },
      data: { is_read: true }
    });

    return {
      id: updated.id,
      read: updated.is_read,
      is_read: updated.is_read
    };
  }

  /**
   * Danh dau tat ca thong bao cua user la da doc
   */
  async markAllAsRead(userId) {
    if (!userId) return 0;

    const res = await this.prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true }
    });

    return res.count;
  }
}

