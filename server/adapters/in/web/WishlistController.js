/**
 * WishlistController.js - Express Controller xu ly danh sach yeu thich tren MySQL 8.0
 * Thuoc tang Adapters / In / Web
 */

export class WishlistController {
  constructor(wishlistRepository) {
    this.wishlistRepo = wishlistRepository;
  }

  // GET /api/wishlist
  getWishlist = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(200).json([]);
      }
      const list = await this.wishlistRepo.getUserWishlist(user.id);
      return res.status(200).json(list);
    } catch (err) {
      console.error('Loi getWishlist:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay danh sach yeu thich' } });
    }
  };

  // POST /api/wishlist/toggle
  toggleWishlist = async (req, res) => {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Thieu productId' } });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui long dang nhap de luu hoa yeu thich' } });
      }

      const result = await this.wishlistRepo.toggleWishlist(user.id, productId);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Loi toggleWishlist:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi toggle yeu thich' } });
    }
  };
}

