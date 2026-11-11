/**
 * ReviewController.js - Express Controller xu ly danh gia tren MySQL 8.0
 * Thuoc tang Adapters / In / Web
 */

export class ReviewController {
  constructor(reviewRepository) {
    this.reviewRepo = reviewRepository;
  }

  // GET /api/reviews
  getReviews = async (req, res) => {
    try {
      const { productId, product_id } = req.query;
      const user = req.user;
      const isAdminOrStaff = user && (user.role === 'admin' || user.role === 'staff');

      const reviews = await this.reviewRepo.findReviews({
        productId: productId || product_id || null,
        includeHidden: isAdminOrStaff
      });

      return res.status(200).json(reviews);
    } catch (err) {
      console.error('Loi getReviews:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay danh sach danh gia' } });
    }
  };

  // POST /api/reviews
  createReview = async (req, res) => {
    try {
      const { productId, rating, comment, userName } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui long dang nhap de gui danh gia' } });
      }

      const result = await this.reviewRepo.createReview({
        productId,
        userId: user.id,
        rating,
        comment,
        userName: user.name || userName
      });

      return res.status(201).json({
        success: true,
        review: result.review,
        product: result.productStats
      });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi createReview:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi tao danh gia' } });
    }
  };

  // PATCH /api/reviews/:id/toggle-hide
  toggleHide = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.reviewRepo.toggleHideReview(id);
      return res.status(200).json({ success: true, review: result });
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi toggleHide:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi an/hien danh gia' } });
    }
  };

  // DELETE /api/reviews/:id
  deleteReview = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.reviewRepo.deleteReview(id);
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi deleteReview:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi xoa danh gia' } });
    }
  };
}

