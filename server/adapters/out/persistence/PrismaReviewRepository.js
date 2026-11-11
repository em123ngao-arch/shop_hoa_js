/**
 * PrismaReviewRepository.js - Xu ly danh gia, binh luan va diem so trung binh tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

import { ValidationError, NotFoundError } from '../../../domain/errors/DomainErrors.js';

export class PrismaReviewRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Lay danh sach danh gia theo san pham hoac toan bo he thong
   */
  async findReviews({ productId = null, includeHidden = false } = {}) {
    const where = {};
    if (productId) {
      // Ho tro ca ID PROD-001 hoac so
      where.OR = [
        { product_id: productId }
      ];
      if (/^\d+$/.test(productId)) {
        where.OR.push({ product_id: `PROD-${productId.padStart(3, '0')}` });
      }
    }
    if (!includeHidden) {
      where.is_hidden = false;
    }

    const reviews = await this.prisma.reviews.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
            role: true
          }
        },
        products: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return reviews.map(r => ({
      id: r.id,
      productId: r.product_id,
      product_id: r.product_id,
      productName: r.products?.name || '',
      userId: r.user_id,
      user_id: r.user_id,
      userName: r.users?.name || 'Khách Mua Hoa',
      userAvatar: r.users?.avatar_url || '',
      rating: r.rating,
      comment: r.comment,
      hidden: r.is_hidden,
      is_hidden: r.is_hidden,
      createdAt: r.created_at,
      created_at: r.created_at
    }));
  }

  /**
   * Tao danh gia moi co loc XSS va kiem tra ton tai san pham
   */
  async createReview({ productId, userId, rating, comment, userName = '' }) {
    if (!productId) {
      throw new ValidationError('Mã sản phẩm không được để trống');
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw new ValidationError('Số sao đánh giá phải từ 1 đến 5');
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
      throw new ValidationError('Nội dung bình luận phải có ít nhất 3 ký tự');
    }

    // Chuan hoa ID san pham
    let prod = await this.prisma.products.findUnique({ where: { id: productId } });
    if (!prod && /^\d+$/.test(productId)) {
      prod = await this.prisma.products.findUnique({ where: { id: `PROD-${productId.padStart(3, '0')}` } });
    }
    if (!prod) {
      throw new NotFoundError('Không tìm thấy sản phẩm cần đánh giá');
    }

    // Lam sach chuoi phong chong XSS (Zero-XSS Protection)
    const cleanComment = comment
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .trim();

    const reviewId = `REV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Tao hoac cap nhat review cua user tren san pham nay
    const review = await this.prisma.reviews.upsert({
      where: {
        product_id_user_id: {
          product_id: prod.id,
          user_id: userId
        }
      },
      update: {
        rating: Math.round(numRating),
        comment: cleanComment,
        is_hidden: false,
        created_at: new Date()
      },
      create: {
        id: reviewId,
        product_id: prod.id,
        user_id: userId,
        rating: Math.round(numRating),
        comment: cleanComment,
        is_hidden: false
      },
      include: {
        users: { select: { name: true, avatar_url: true } }
      }
    });

    // Tinh diem trung binh moi bang ES6 Array reduce
    const allValidReviews = await this.prisma.reviews.findMany({
      where: { product_id: prod.id, is_hidden: false }
    });

    const avgRating = allValidReviews.length === 0
      ? 5.0
      : Number((allValidReviews.reduce((sum, r) => sum + r.rating, 0) / allValidReviews.length).toFixed(1));

    return {
      review: {
        id: review.id,
        productId: review.product_id,
        userId: review.user_id,
        userName: review.users?.name || userName || 'Khách Mua Hoa',
        userAvatar: review.users?.avatar_url || '',
        rating: review.rating,
        comment: review.comment,
        hidden: review.is_hidden,
        createdAt: review.created_at
      },
      productStats: {
        id: prod.id,
        rating: avgRating,
        reviewCount: allValidReviews.length
      }
    };
  }

  /**
   * An / Hien danh gia (Admin & Staff)
   */
  async toggleHideReview(reviewId) {
    const rev = await this.prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!rev) {
      throw new NotFoundError(`Không tìm thấy đánh giá #${reviewId}`);
    }

    const updated = await this.prisma.reviews.update({
      where: { id: reviewId },
      data: { is_hidden: !rev.is_hidden }
    });

    return {
      id: updated.id,
      productId: updated.product_id,
      hidden: updated.is_hidden,
      is_hidden: updated.is_hidden
    };
  }

  /**
   * Xoa vinh vien danh gia (Admin)
   */
  async deleteReview(reviewId) {
    const rev = await this.prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!rev) {
      throw new NotFoundError(`Không tìm thấy đánh giá #${reviewId}`);
    }

    await this.prisma.reviews.delete({ where: { id: reviewId } });
    return { success: true, message: 'Đã xóa đánh giá thành công' };
  }
}

