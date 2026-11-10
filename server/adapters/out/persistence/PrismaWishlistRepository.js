/**
 * PrismaWishlistRepository.js - Xu ly danh sach hoa yeu thich theo tai khoan tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

export class PrismaWishlistRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Lay danh sach ID san pham yeu thich cua mot user
   */
  async getUserWishlist(userId) {
    if (!userId) return [];

    const items = await this.prisma.wishlist_items.findMany({
      where: { user_id: userId },
      select: { product_id: true }
    });

    return items.map(i => i.product_id);
  }

  /**
   * Toggle (Them/Xoa) san pham khoi danh sach yeu thich
   */
  async toggleWishlist(userId, productId) {
    if (!userId || !productId) return { isFavorite: false, wishlist: [] };

    // Chuan hoa productId
    let cleanId = String(productId);
    let prod = await this.prisma.products.findUnique({ where: { id: cleanId } });
    if (!prod && /^\d+$/.test(cleanId)) {
      prod = await this.prisma.products.findUnique({ where: { id: `PROD-${cleanId.padStart(3, '0')}` } });
    }
    if (prod) {
      cleanId = prod.id;
    }

    const existing = await this.prisma.wishlist_items.findUnique({
      where: {
        user_id_product_id: {
          user_id: userId,
          product_id: cleanId
        }
      }
    });

    let isFavorite = false;
    if (existing) {
      await this.prisma.wishlist_items.delete({
        where: { id: existing.id }
      });
      isFavorite = false;
    } else {
      const id = `WISH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await this.prisma.wishlist_items.create({
        data: {
          id,
          user_id: userId,
          product_id: cleanId
        }
      });
      isFavorite = true;
    }

    const allFavorites = await this.getUserWishlist(userId);
    return {
      success: true,
      isFavorite,
      wishlist: allFavorites
    };
  }
}

