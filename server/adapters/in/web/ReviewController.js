/**
 * ReviewController.js - Express Controller xu ly danh gia, anh thuc te & binh chon huu ich tren MySQL 8.0
 * Thuoc tang Adapters / In / Web
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { saveProcessedMedia, deleteMediaFiles } from '../../out/storage/MediaStorageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REVIEW_UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads/reviews');
const MAX_REVIEW_IMAGES = 3;

if (!fs.existsSync(REVIEW_UPLOADS_DIR)) {
  fs.mkdirSync(REVIEW_UPLOADS_DIR, { recursive: true });
}

function unlinkReviewFiles(urls = []) {
  deleteMediaFiles(urls).catch(() => {});
}

async function sanitizeReviewImages(rawImages, allowedExistingUrls = []) {
  if (rawImages === undefined || rawImages === null) {
    return { cleanImages: [], newlySavedUrls: [] };
  }
  if (!Array.isArray(rawImages)) {
    throw Object.assign(new Error('Danh sách ảnh đánh giá không hợp lệ'), { name: 'ValidationError' });
  }
  if (rawImages.length > MAX_REVIEW_IMAGES) {
    throw Object.assign(new Error(`Tối đa chỉ được đính kèm ${MAX_REVIEW_IMAGES} ảnh cho mỗi đánh giá`), { name: 'ValidationError' });
  }

  const cleanImages = [];
  const newlySavedUrls = [];
  const allowedSet = new Set(allowedExistingUrls);

  try {
    for (const item of rawImages) {
      if (typeof item !== 'string' || !item.trim()) continue;
      const trimmed = item.trim();

      if (allowedSet.has(trimmed)) {
        if (!cleanImages.includes(trimmed)) {
          cleanImages.push(trimmed);
        }
        continue;
      }

      if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(trimmed)) {
        throw Object.assign(new Error('Chỉ hỗ trợ ảnh định dạng PNG, JPEG hoặc WebP'), { name: 'ValidationError' });
      }
      if (trimmed.length > 8_000_000) {
        throw Object.assign(new Error('Dung lượng ảnh đính kèm vượt quá giới hạn cho phép (tối đa 5MB/ảnh)'), { name: 'ValidationError' });
      }

      const base64Data = trimmed.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.length || buffer.length > 6_000_000) {
        throw Object.assign(new Error('Dung lượng ảnh đính kèm vượt quá giới hạn cho phép'), { name: 'ValidationError' });
      }

      const filename = `rev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}.webp`;

      const processedBuffer = await sharp(buffer, { limitInputPixels: 30_000_000 })
        .rotate()
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const url = await saveProcessedMedia(processedBuffer, { folder: 'reviews', filename });
      newlySavedUrls.push(url);
      cleanImages.push(url);
    }

    return { cleanImages, newlySavedUrls };
  } catch (err) {
    unlinkReviewFiles(newlySavedUrls);
    throw err;
  }
}

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
        includeHidden: isAdminOrStaff,
        currentUserId: user?.id || null
      });

      return res.status(200).json(reviews);
    } catch (err) {
      console.error('Loi getReviews:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi lấy danh sách đánh giá' } });
    }
  };

  // POST /api/reviews
  createReview = async (req, res) => {
    let newlySavedUrls = [];
    try {
      const { productId, rating, comment, userName, images } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để gửi đánh giá' } });
      }

      const existingImages = await this.reviewRepo.getExistingReviewImages(productId, user.id);
      const sanitized = await sanitizeReviewImages(images, existingImages);
      newlySavedUrls = sanitized.newlySavedUrls;

      const result = await this.reviewRepo.createReview({
        productId,
        userId: user.id,
        rating,
        comment,
        userName: user.name || userName,
        images: sanitized.cleanImages
      });

      unlinkReviewFiles(result.removedImages || []);

      return res.status(201).json({
        success: true,
        review: result.review,
        product: result.productStats
      });
    } catch (err) {
      unlinkReviewFiles(newlySavedUrls);
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.name === 'ForbiddenError') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi createReview:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi tạo đánh giá' } });
    }
  };

  // POST /api/reviews/:id/helpful
  toggleHelpful = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để bình chọn hữu ích' } });
      }
      const { id } = req.params;
      const result = await this.reviewRepo.toggleHelpful(id, user.id);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi toggleHelpful:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi cập nhật bình chọn hữu ích' } });
    }
  };

  // PATCH /api/reviews/:id/toggle-hide
  toggleHide = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.reviewRepo.toggleHideReview(id);
      return res.status(200).json({ success: true, review: result, product: result.productStats });
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi toggleHide:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi ẩn/hiện đánh giá' } });
    }
  };

  // DELETE /api/reviews/:id
  deleteReview = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.reviewRepo.deleteReview(id);
      unlinkReviewFiles(result.removedImages || []);
      return res.status(200).json({
        success: true,
        message: result.message,
        product: result.productStats
      });
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi deleteReview:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi xóa đánh giá' } });
    }
  };

  // GET /api/reviews/check-eligibility?productId=...
  checkEligibility = async (req, res) => {
    try {
      const { productId, product_id } = req.query;
      const targetId = productId || product_id;
      const user = req.user;

      if (!user) {
        return res.status(200).json({ canReview: false, isVerifiedBuyer: false, hasPendingOrder: false, currentUserId: null, currentUserRole: null, reason: 'Chưa đăng nhập' });
      }

      const result = await this.reviewRepo.checkReviewEligibility(targetId, user.id);
      return res.status(200).json({
        ...result,
        currentUserId: user.id,
        currentUserRole: user.role || 'customer'
      });
    } catch (err) {
      console.error('Loi checkEligibility:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi kiểm tra điều kiện đánh giá' } });
    }
  };

  // POST /api/reviews/mine - tra ve cac san pham user hien tai da danh gia
  getReviewedProductIds = async (req, res) => {
    try {
      const productIds = req.body?.productIds;
      if (!Array.isArray(productIds) || productIds.length > 100) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Danh sách sản phẩm không hợp lệ' } });
      }

      const normalizedIds = [...new Set(productIds
        .filter(id => typeof id === 'string')
        .map(id => id.trim())
        .filter(Boolean))];
      const reviewedProductIds = await this.reviewRepo.findReviewedProductIds(normalizedIds, req.user.id);
      return res.status(200).json({ reviewedProductIds });
    } catch (err) {
      console.error('Loi getReviewedProductIds:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi tải trạng thái đánh giá' } });
    }
  };

  // POST /api/reviews/:id/reply
  replyReview = async (req, res) => {
    try {
      const { id } = req.params;
      const { reply } = req.body;
      const user = req.user;
      const staffName = user?.name ? `${user.name} (${user.role === 'admin' ? 'Quản Trị Viên' : 'Nhân Viên'})` : 'Tiệm Hoa Nhung (Quản Trị Viên)';

      const result = await this.reviewRepo.replyReview(id, reply, staffName);
      return res.status(200).json({ success: true, review: result });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi replyReview:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi phản hồi đánh giá' } });
    }
  };

  // POST /api/reviews/:id/comments
  addComment = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để gửi phản hồi' } });
      }
      const { id } = req.params;
      const { content } = req.body;
      const comment = await this.reviewRepo.addReviewComment({
        reviewId: id,
        userId: user.id,
        content
      });
      return res.status(201).json({ success: true, comment });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi addComment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi gửi phản hồi bình luận' } });
    }
  };

  // DELETE /api/reviews/:id/comments/:commentId
  deleteComment = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập' } });
      }
      const { id, commentId } = req.params;
      const result = await this.reviewRepo.deleteReviewComment({
        reviewId: id,
        commentId,
        user
      });
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'ForbiddenError') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi deleteComment:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi xóa phản hồi' } });
    }
  };
}
