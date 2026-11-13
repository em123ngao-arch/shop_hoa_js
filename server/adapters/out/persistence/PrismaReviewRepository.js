/**
 * PrismaReviewRepository.js - Xu ly danh gia, anh thuc te, binh chon huu ich va diem TB tren MySQL 8.0
 * Thuoc tang Adapters / Out / Persistence
 */

import { ValidationError, NotFoundError, ForbiddenError } from '../../../domain/errors/DomainErrors.js';

function parseReviewImages(imagesJson) {
  if (!imagesJson) return [];
  try {
    const parsed = JSON.parse(imagesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(u => typeof u === 'string' && (
      /^\/uploads\/reviews\/rev-[a-z0-9-]+\.webp$/i.test(u) ||
      /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_\-./]+\.webp$/i.test(u)
    ));
  } catch {
    return [];
  }
}

function escapeDbHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

export class PrismaReviewRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  #mapReviewToDTO(r, currentUserId = null) {
    if (!r) return null;
    const images = parseReviewImages(r.images_json);
    const voteCount = r._count?.helpful_votes !== undefined
      ? r._count.helpful_votes
      : Number(r.helpful_count || 0);
    const hasVotedHelpful = Boolean(
      currentUserId && Array.isArray(r.helpful_votes) && r.helpful_votes.length > 0
    );

    return {
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
      images,
      helpfulCount: voteCount,
      helpful_count: voteCount,
      hasVotedHelpful,
      reply: r.reply || null,
      replyDate: r.reply_date || null,
      reply_date: r.reply_date || null,
      replyBy: r.reply_by || null,
      reply_by: r.reply_by || null,
      isVerifiedBuyer: Boolean(r.is_verified_buyer),
      is_verified_buyer: Boolean(r.is_verified_buyer),
      editedAt: r.edited_at || null,
      edited_at: r.edited_at || null,
      hidden: r.is_hidden,
      is_hidden: r.is_hidden,
      createdAt: r.created_at,
      created_at: r.created_at,
      comments: Array.isArray(r.comments) ? r.comments.map(c => ({
        id: c.id,
        reviewId: c.review_id,
        userId: c.user_id,
        userName: c.users?.name || 'Khách Hàng',
        userAvatar: c.users?.avatar_url || '',
        userRole: c.users?.role || 'customer',
        content: c.content,
        isVerifiedBuyer: Boolean(c.is_verified_buyer),
        isAuthor: Boolean(c.user_id && c.user_id === r.user_id),
        createdAt: c.created_at
      })) : []
    };
  }

  async #resolveProductById(productId) {
    if (!productId) return null;
    const cleanId = String(productId).trim();
    let prod = await this.prisma.products.findUnique({ where: { id: cleanId } });
    if (!prod && /^\d+$/.test(cleanId)) {
      prod = await this.prisma.products.findUnique({ where: { id: `PROD-${cleanId.padStart(3, '0')}` } });
    }
    return prod;
  }

  async #computeProductStats(tx, productId) {
    const allValidReviews = await tx.reviews.findMany({
      where: { product_id: productId, is_hidden: false },
      select: { rating: true }
    });

    const avgRating = allValidReviews.length === 0
      ? null
      : Number((allValidReviews.reduce((sum, r) => sum + r.rating, 0) / allValidReviews.length).toFixed(1));

    return {
      id: productId,
      rating: avgRating,
      reviewCount: allValidReviews.length
    };
  }

  /**
   * Lay anh hien co cua danh gia (neu user da tung danh gia san pham nay)
   */
  async getExistingReviewImages(productId, userId) {
    if (!productId || !userId) return [];
    const prod = await this.#resolveProductById(productId);
    if (!prod) return [];
    const existing = await this.prisma.reviews.findUnique({
      where: { product_id_user_id: { product_id: prod.id, user_id: userId } },
      select: { images_json: true }
    });
    return parseReviewImages(existing?.images_json);
  }

  /**
   * Lay danh sach danh gia theo san pham hoac toan bo he thong
   */
  async findReviews({ productId = null, includeHidden = false, currentUserId = null } = {}) {
    const where = {};
    if (productId) {
      where.OR = [{ product_id: productId }];
      if (/^\d+$/.test(String(productId))) {
        where.OR.push({ product_id: `PROD-${String(productId).padStart(3, '0')}` });
      }
    }
    if (!includeHidden) {
      where.is_hidden = false;
    }

    const include = {
      users: {
        select: { id: true, name: true, avatar_url: true, role: true }
      },
      products: {
        select: { id: true, name: true }
      },
      _count: {
        select: { helpful_votes: true }
      },
      comments: {
        orderBy: { created_at: 'asc' },
        include: {
          users: {
            select: { id: true, name: true, avatar_url: true, role: true }
          }
        }
      }
    };

    if (currentUserId) {
      include.helpful_votes = {
        where: { user_id: currentUserId },
        select: { id: true }
      };
    }

    const reviews = await this.prisma.reviews.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include
    });

    return reviews.map(r => this.#mapReviewToDTO(r, currentUserId));
  }

  /**
   * Tao hoac cap nhat danh gia (chi cho phep nguoi da mua hang hoan tat)
   */
  async createReview({ productId, userId, rating, comment, userName = '', images = [] }) {
    if (!productId) {
      throw new ValidationError('Mã sản phẩm không được để trống');
    }

    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      throw new ValidationError('Số sao đánh giá phải từ 1 đến 5');
    }

    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    if (Array.from(trimmedComment).length < 10) {
      throw new ValidationError('Nội dung đánh giá phải có ít nhất 10 ký tự');
    }
    if (Array.from(trimmedComment).length > 1200) {
      throw new ValidationError('Nội dung đánh giá tối đa 1200 ký tự');
    }

    const prod = await this.#resolveProductById(productId);
    if (!prod) {
      throw new NotFoundError('Không tìm thấy sản phẩm cần đánh giá');
    }

    // Nghiep vu chuan TMDT: chi khach hang co don hang da hoan tat moi duoc viet/cham sao
    const purchasedOrder = await this.prisma.orders.findFirst({
      where: {
        user_id: userId,
        status: 'completed',
        order_items: { some: { product_id: prod.id } }
      },
      select: { id: true }
    });

    if (!purchasedOrder) {
      throw new ForbiddenError('Chỉ khách hàng đã mua và nhận thành công mẫu hoa này mới có thể viết đánh giá.');
    }

    const cleanComment = escapeDbHtml(trimmedComment);
    const cleanImages = Array.isArray(images) ? images.slice(0, 3) : [];
    const imagesJson = cleanImages.length > 0 ? JSON.stringify(cleanImages) : null;
    const roundedRating = Math.round(numRating);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reviews.findUnique({
        where: { product_id_user_id: { product_id: prod.id, user_id: userId } }
      });

      const oldImages = parseReviewImages(existing?.images_json);
      const removedImages = oldImages.filter(url => !cleanImages.includes(url));

      let review;
      if (existing) {
        const contentChanged = existing.rating !== roundedRating || existing.comment !== cleanComment;
        review = await tx.reviews.update({
          where: { id: existing.id },
          data: {
            rating: roundedRating,
            comment: cleanComment,
            images_json: imagesJson,
            is_hidden: false,
            is_verified_buyer: true,
            edited_at: new Date(),
            // Neu khach thay doi diem sao hoac noi dung, xoa phan hoi cu de tranh lech ngu canh
            ...(contentChanged ? { reply: null, reply_date: null, reply_by: null } : {})
          },
          include: {
            users: { select: { id: true, name: true, avatar_url: true } },
            products: { select: { id: true, name: true } },
            _count: { select: { helpful_votes: true } },
            comments: {
              orderBy: { created_at: 'asc' },
              include: { users: { select: { id: true, name: true, avatar_url: true, role: true } } }
            }
          }
        });
      } else {
        const reviewId = `REV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        review = await tx.reviews.create({
          data: {
            id: reviewId,
            product_id: prod.id,
            user_id: userId,
            rating: roundedRating,
            comment: cleanComment,
            images_json: imagesJson,
            helpful_count: 0,
            is_verified_buyer: true,
            is_hidden: false
          },
          include: {
            users: { select: { id: true, name: true, avatar_url: true } },
            products: { select: { id: true, name: true } },
            _count: { select: { helpful_votes: true } },
            comments: {
              orderBy: { created_at: 'asc' },
              include: { users: { select: { id: true, name: true, avatar_url: true, role: true } } }
            }
          }
        });
      }

      const productStats = await this.#computeProductStats(tx, prod.id);
      const mapped = this.#mapReviewToDTO(review, userId);
      if (userName && !mapped.userName) {
        mapped.userName = userName;
      }

      return {
        review: mapped,
        productStats,
        removedImages
      };
    });
  }

  /**
   * Binh chon / bo binh chon "Huu ich" cho danh gia (moi user 1 luot/review)
   */
  async toggleHelpful(reviewId, userId) {
    if (!reviewId || !userId) {
      throw new ValidationError('Thiếu thông tin bình chọn đánh giá');
    }

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.reviews.findUnique({ where: { id: reviewId } });
      if (!review || review.is_hidden) {
        throw new NotFoundError('Không tìm thấy đánh giá này');
      }

      if (review.user_id === userId) {
        throw new ValidationError('Bạn không thể tự bình chọn hữu ích cho đánh giá của chính mình');
      }

      const existing = await tx.review_helpful_votes.findUnique({
        where: { review_id_user_id: { review_id: reviewId, user_id: userId } }
      });

      let hasVotedHelpful = false;
      if (existing) {
        await tx.review_helpful_votes.delete({ where: { id: existing.id } });
        hasVotedHelpful = false;
      } else {
        await tx.review_helpful_votes.create({
          data: {
            id: `HLP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            review_id: reviewId,
            user_id: userId
          }
        });
        hasVotedHelpful = true;
      }

      const helpfulCount = await tx.review_helpful_votes.count({
        where: { review_id: reviewId }
      });

      await tx.reviews.update({
        where: { id: reviewId },
        data: { helpful_count: helpfulCount }
      });

      return {
        reviewId,
        helpfulCount,
        hasVotedHelpful
      };
    });
  }

  /**
   * Phan hoi chinh thuc cua Shop / Admin / Nhan vien cho danh gia cua khach + tao thong bao
   */
  async replyReview(reviewId, replyText, staffName = 'Tiệm Hoa Nhung (Quản Trị Viên)') {
    const cleanReply = escapeDbHtml(replyText || '');
    if (!cleanReply) {
      throw new ValidationError('Nội dung phản hồi của tiệm không được để trống');
    }

    return this.prisma.$transaction(async (tx) => {
      const rev = await tx.reviews.findUnique({
        where: { id: reviewId },
        include: { products: { select: { id: true, name: true } } }
      });
      if (!rev) {
        throw new NotFoundError(`Không tìm thấy đánh giá #${reviewId}`);
      }

      const updated = await tx.reviews.update({
        where: { id: reviewId },
        data: {
          reply: cleanReply,
          reply_date: new Date(),
          reply_by: staffName
        }
      });

      if (rev.user_id) {
        const prodName = rev.products?.name || 'mẫu hoa';
        await tx.notifications.create({
          data: {
            id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            user_id: rev.user_id,
            order_id: null,
            title: `Tiệm đã phản hồi đánh giá của bạn`,
            message: `Nghệ nhân vừa phản hồi đánh giá cho "${prodName}". Cảm ơn bạn đã đóng góp ý kiến!`,
            is_read: false
          }
        });
      }

      return {
        id: updated.id,
        productId: updated.product_id,
        reply: updated.reply,
        replyDate: updated.reply_date,
        replyBy: updated.reply_by
      };
    });
  }

  /**
   * Kiem tra dieu kien danh gia cua nguoi dung (Verified Buyer & Has Reviewed)
   */
  async checkReviewEligibility(productId, userId) {
    if (!userId) {
      return {
        canReview: false,
        isVerifiedBuyer: false,
        hasPendingOrder: false,
        reason: 'Vui lòng đăng nhập tài khoản đã mua hàng để đánh giá.'
      };
    }

    const prod = await this.#resolveProductById(productId);
    if (!prod) {
      return {
        canReview: false,
        isVerifiedBuyer: false,
        hasPendingOrder: false,
        reason: 'Không tìm thấy sản phẩm'
      };
    }

    const [existingReview, purchasedOrder, pendingOrder] = await Promise.all([
      this.prisma.reviews.findUnique({
        where: {
          product_id_user_id: {
            product_id: prod.id,
            user_id: userId
          }
        }
      }),
      this.prisma.orders.findFirst({
        where: {
          user_id: userId,
          status: 'completed',
          order_items: { some: { product_id: prod.id } }
        },
        select: { id: true }
      }),
      this.prisma.orders.findFirst({
        where: {
          user_id: userId,
          status: { in: ['pending', 'confirmed', 'shipping'] },
          order_items: { some: { product_id: prod.id } }
        },
        select: { id: true, status: true }
      })
    ]);

    const isVerifiedBuyer = Boolean(purchasedOrder);
    const hasPendingOrder = !isVerifiedBuyer && Boolean(pendingOrder);
    const reason = isVerifiedBuyer
      ? ''
      : (hasPendingOrder
        ? 'Đơn hàng của bạn đang được xử lý hoặc giao tới. Sau khi đơn hoàn thành bạn có thể viết đánh giá ngay tại đây.'
        : 'Chỉ khách hàng đã mua và hoàn tất nhận mẫu hoa này mới có thể gửi đánh giá.');

    return {
      canReview: isVerifiedBuyer,
      isVerifiedBuyer,
      hasPendingOrder,
      hasReviewed: Boolean(existingReview),
      reason,
      existingReview: existingReview ? {
        id: existingReview.id,
        rating: existingReview.rating,
        comment: existingReview.comment,
        images: parseReviewImages(existingReview.images_json),
        reply: existingReview.reply,
        editedAt: existingReview.edited_at,
        createdAt: existingReview.created_at
      } : null
    };
  }

  /**
   * Tra cac san pham da duoc nguoi dung danh gia trong mot truy van.
   * @param {string[]} productIds - Danh sach ID san pham can doi chieu.
   * @param {string} userId - ID tai khoan dang dang nhap.
   * @returns {Promise<string[]>} ID san pham da co review cua user.
   */
  async findReviewedProductIds(productIds = [], userId) {
    if (!userId || productIds.length === 0) return [];
    const rows = await this.prisma.reviews.findMany({
      where: { user_id: userId, product_id: { in: productIds } },
      select: { product_id: true }
    });
    return [...new Set(rows.map(row => row.product_id))];
  }

  /**
   * An / Hien danh gia (Admin & Staff)
   */
  async toggleHideReview(reviewId) {
    return this.prisma.$transaction(async (tx) => {
      const rev = await tx.reviews.findUnique({ where: { id: reviewId } });
      if (!rev) {
        throw new NotFoundError(`Không tìm thấy đánh giá #${reviewId}`);
      }

      const updated = await tx.reviews.update({
        where: { id: reviewId },
        data: { is_hidden: !rev.is_hidden }
      });

      const productStats = await this.#computeProductStats(tx, rev.product_id);

      return {
        id: updated.id,
        productId: updated.product_id,
        hidden: updated.is_hidden,
        is_hidden: updated.is_hidden,
        productStats
      };
    });
  }

  /**
   * Xoa vinh vien danh gia (Admin)
   */
  async deleteReview(reviewId) {
    return this.prisma.$transaction(async (tx) => {
      const rev = await tx.reviews.findUnique({ where: { id: reviewId } });
      if (!rev) {
        throw new NotFoundError(`Không tìm thấy đánh giá #${reviewId}`);
      }

      const removedImages = parseReviewImages(rev.images_json);
      await tx.reviews.delete({ where: { id: reviewId } });
      const productStats = await this.#computeProductStats(tx, rev.product_id);

      return {
        success: true,
        message: 'Đã xóa đánh giá thành công',
        removedImages,
        productStats
      };
    });
  }

  /**
   * Them phan hoi qua lai duoi 1 danh gia (ho tro ca khach hang & admin/staff)
   */
  async addReviewComment({ reviewId, userId, content }) {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (Array.from(trimmed).length < 2) {
      throw new ValidationError('Nội dung phản hồi cần ít nhất 2 ký tự');
    }
    if (Array.from(trimmed).length > 500) {
      throw new ValidationError('Nội dung phản hồi tối đa 500 ký tự');
    }

    const cleanContent = escapeDbHtml(trimmed);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.reviews.findUnique({
        where: { id: reviewId },
        include: { products: { select: { id: true, name: true } } }
      });
      if (!review || review.is_hidden) {
        throw new NotFoundError('Không tìm thấy đánh giá để phản hồi');
      }

      const commenter = await tx.users.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatar_url: true, role: true }
      });
      if (!commenter) {
        throw new NotFoundError('Không tìm thấy tài khoản người dùng');
      }

      let isVerifiedBuyer = false;
      if (commenter.role === 'customer') {
        const bought = await tx.orders.findFirst({
          where: {
            user_id: userId,
            status: 'completed',
            order_items: { some: { product_id: review.product_id } }
          },
          select: { id: true }
        });
        isVerifiedBuyer = Boolean(bought);
      }

      const commentId = `RCMT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const created = await tx.review_comments.create({
        data: {
          id: commentId,
          review_id: reviewId,
          user_id: userId,
          content: cleanContent,
          is_verified_buyer: isVerifiedBuyer
        },
        include: {
          users: { select: { id: true, name: true, avatar_url: true, role: true } }
        }
      });

      if (review.user_id && review.user_id !== userId) {
        const isStaffReply = commenter.role === 'admin' || commenter.role === 'staff';
        const prodName = review.products?.name || 'mẫu hoa';
        await tx.notifications.create({
          data: {
            id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            user_id: review.user_id,
            order_id: null,
            title: isStaffReply
              ? 'Tiệm vừa bình luận dưới đánh giá của bạn'
              : `${commenter.name} đã phản hồi đánh giá của bạn`,
            message: `${commenter.name} vừa để lại phản hồi mới trong đánh giá mẫu "${prodName}".`,
            is_read: false
          }
        });
      }

      return {
        id: created.id,
        reviewId: created.review_id,
        userId: created.user_id,
        userName: created.users?.name || 'Khách Hàng',
        userAvatar: created.users?.avatar_url || '',
        userRole: created.users?.role || 'customer',
        content: created.content,
        isVerifiedBuyer: Boolean(created.is_verified_buyer),
        isAuthor: Boolean(created.user_id && created.user_id === review.user_id),
        createdAt: created.created_at
      };
    });
  }

  /**
   * Xoa phan hoi trong luong trao doi (chi tac gia phan hoi hoac Admin/Staff)
   */
  async deleteReviewComment({ reviewId, commentId, user }) {
    const existing = await this.prisma.review_comments.findFirst({
      where: { id: commentId, review_id: reviewId }
    });
    if (!existing) {
      throw new NotFoundError('Không tìm thấy phản hồi cần xóa');
    }

    const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';
    if (!isAdminOrStaff && existing.user_id !== user?.id) {
      throw new ForbiddenError('Bạn không có quyền xóa phản hồi của người khác');
    }

    await this.prisma.review_comments.delete({ where: { id: commentId } });
    return { success: true, commentId, reviewId };
  }
}
