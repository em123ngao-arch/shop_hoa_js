/**
 * PrismaCatalogRepository.js - Bo tiep hop kho du lieu Danh muc, San pham, Banner, Voucher qua Prisma MySQL
 * Thuoc tang Adapters / Out / Persistence
 */

import { ValidationError, NotFoundError } from '../../../domain/errors/DomainErrors.js';

export class PrismaCatalogRepository {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Helper chuyen doi san pham sang DTO chuan tuong thich 100% ca camelCase va snake_case cho Frontend
   */
  #mapProductToDTO(p) {
    if (!p) return null;
    const validReviews = (p.reviews || []).filter(r => !r.is_hidden);
    const avgRating = validReviews.length > 0
      ? Math.round((validReviews.reduce((sum, r) => sum + r.rating, 0) / validReviews.length) * 10) / 10
      : null;

    return {
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.original_price,
      original_price: p.original_price,
      costPrice: p.cost_price,
      cost_price: p.cost_price,
      stock: p.stock,
      image: p.image_url,
      image_url: p.image_url,
      description: p.description,
      badge: p.badge || '',
      categoryId: p.category_id,
      category_id: p.category_id,
      categoryName: p.categories?.name || 'Hoa Kem Nhung',
      categorySlug: p.categories?.slug || 'kem-nhung',
      rating: avgRating,
      reviewCount: validReviews.length,
      isActive: p.is_active,
      is_active: p.is_active,
      createdAt: p.created_at
    };
  }

  /**
   * Lay danh sach san pham co bo loc danh muc, tim kiem va sap xep
   */
  async findProducts({ categoryId = null, search = '', sort = '', limit = null, activeOnly = true } = {}) {
    const where = {};
    if (activeOnly) {
      where.is_active = true;
    }
    if (categoryId && categoryId !== 'all') {
      where.category_id = String(categoryId);
    }
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { description: { contains: search.trim() } }
      ];
    }

    const orderBy = [];
    if (sort === 'price_asc') orderBy.push({ price: 'asc' });
    else if (sort === 'price_desc') orderBy.push({ price: 'desc' });
    else if (sort === 'name_asc') orderBy.push({ name: 'asc' });
    else if (sort === 'name_desc') orderBy.push({ name: 'desc' });
    else orderBy.push({ created_at: 'asc' });

    const query = {
      where,
      orderBy,
      include: {
        categories: true,
        reviews: true
      }
    };

    if (limit && Number(limit) > 0) {
      query.take = Number(limit);
    }

    const records = await this.prisma.products.findMany(query);
    return records.map(p => this.#mapProductToDTO(p));
  }

  /**
   * Tim 1 san pham theo ID (Ho tro ca 'PROD-001' va '1' de tuong thich lien mach)
   */
  async findProductById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();

    // 1. Tim truc tiep theo ID
    let raw = await this.prisma.products.findUnique({
      where: { id: cleanId },
      include: { categories: true, reviews: true }
    });

    // 2. Fallback: Neu client truyen dang so ('1'), thu tim 'PROD-001'
    if (!raw && /^\d+$/.test(cleanId)) {
      const paddedId = `PROD-${cleanId.padStart(3, '0')}`;
      raw = await this.prisma.products.findUnique({
        where: { id: paddedId },
        include: { categories: true, reviews: true }
      });
    }

    return this.#mapProductToDTO(raw);
  }

  /**
   * Tao moi san pham (Admin CRUD)
   */
  async createProduct(data) {
    const id = data.id || `PROD-${Date.now().toString(36).toUpperCase()}`;
    const stock = Number(data.stock || 0);
    if (Number.isNaN(stock) || stock < 0) {
      throw new ValidationError('Số lượng tồn kho ban đầu không được là số âm');
    }
    const raw = await this.prisma.products.create({
      data: {
        id,
        category_id: String(data.categoryId || data.category_id || '1'),
        name: data.name.trim(),
        price: Number(data.price),
        original_price: Number(data.originalPrice || data.original_price || data.price),
        cost_price: Number(data.costPrice || data.cost_price || 0),
        stock,
        image_url: data.image || data.image_url || './images/300.png',
        description: data.description || '',
        badge: data.badge || null,
        is_active: data.isActive !== undefined ? Boolean(data.isActive) : true
      },
      include: { categories: true, reviews: true }
    });
    return this.#mapProductToDTO(raw);
  }

  /**
   * Cap nhat san pham (Admin CRUD)
   */
  async updateProduct(id, data) {
    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.price !== undefined) updatePayload.price = Number(data.price);
    if (data.originalPrice !== undefined || data.original_price !== undefined) {
      updatePayload.original_price = Number(data.originalPrice ?? data.original_price);
    }
    if (data.costPrice !== undefined || data.cost_price !== undefined) {
      updatePayload.cost_price = Number(data.costPrice ?? data.cost_price);
    }
    if (data.stockDelta !== undefined) {
      const delta = Number(data.stockDelta);
      if (!Number.isNaN(delta)) {
        if (delta < 0 && typeof this.prisma.products.findUnique === 'function') {
          const current = await this.prisma.products.findUnique({
            where: { id: String(id) },
            select: { stock: true }
          });
          if (current && (Number(current.stock || 0) + delta) < 0) {
            throw new ValidationError(`Số lượng tồn kho không đủ để giảm (tồn kho hiện tại: ${current.stock}, không thể giảm ${Math.abs(delta)})`);
          }
        }
        updatePayload.stock = { increment: delta };
      }
    } else if (data.stock !== undefined) {
      const targetStock = Number(data.stock);
      if (Number.isNaN(targetStock) || targetStock < 0) {
        throw new ValidationError('Số lượng tồn kho không được là số âm');
      }
      updatePayload.stock = targetStock;
    }
    if (data.image !== undefined || data.image_url !== undefined) {
      updatePayload.image_url = data.image ?? data.image_url;
    }
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.badge !== undefined) updatePayload.badge = data.badge;
    if (data.categoryId !== undefined || data.category_id !== undefined) {
      updatePayload.category_id = String(data.categoryId ?? data.category_id);
    }
    if (data.isActive !== undefined || data.is_active !== undefined) {
      updatePayload.is_active = Boolean(data.isActive ?? data.is_active);
    }

    const raw = await this.prisma.products.update({
      where: { id: String(id) },
      data: updatePayload,
      include: { categories: true, reviews: true }
    });
    return this.#mapProductToDTO(raw);
  }

  /**
   * Xoa san pham (Admin CRUD) - Chan xoa neu da co don hang de tranh loi khoa ngoai 500
   */
  async deleteProduct(id) {
    const cleanId = String(id);
    const orderItemCount = await this.prisma.order_items.count({
      where: { product_id: cleanId }
    });
    if (orderItemCount > 0) {
      throw new ValidationError(
        `Mẫu hoa này đã có ${orderItemCount} đơn hàng liên quan, không thể xóa vĩnh viễn. Vui lòng chuyển sang trạng thái "Ngừng kinh doanh" để bảo toàn lịch sử kế toán và giao dịch!`
      );
    }

    await this.prisma.products.delete({
      where: { id: cleanId }
    });
    return true;
  }

  /**
   * Lay toan bo danh muc hoa
   */
  async findCategories() {
    return this.prisma.categories.findMany({
      orderBy: { id: 'asc' }
    });
  }

  /**
   * Helper chuyen doi Banner sang DTO tuong thich 100% ca camelCase, snake_case va cu phap cu cua Frontend
   */
  #mapBannerToDTO(b) {
    if (!b) return null;
    const img = b.image_url || b.hinhbanner || b.image || './images/300.png';
    const title = b.title || b.tenbanner || '';
    const link = b.link_url || b.link || '#products';
    const order = b.display_order ?? b.order ?? 1;
    const active = b.is_active ?? b.active ?? true;
    const tag = b.tag || 'Bộ Sưu Tập Hoa Kẽm Nhung';
    const desc = b.description || b.desc || title;
    const theme = b.theme || 'default';
    const ctaText = b.cta_text || b.ctaText || 'Khám Phá Các Mẫu Hoa';

    return {
      id: b.id,
      title: title,
      tenbanner: title,
      name: title,
      image_url: img,
      hinhbanner: img,
      image: img,
      link_url: link,
      link: link,
      display_order: order,
      order: order,
      is_active: active,
      active: active,
      theme: theme,
      tag: tag,
      desc: desc,
      description: desc,
      ctaText: ctaText,
      cta_text: ctaText
    };
  }

  /**
   * Lay toan bo banner hoat dong (kem DTO tuong thich cao)
   */
  async findBanners({ activeOnly = true } = {}) {
    const records = await this.prisma.banners.findMany({
      where: activeOnly ? { is_active: true } : {},
      orderBy: { display_order: 'asc' }
    });
    return records.map(b => this.#mapBannerToDTO(b));
  }

  /**
   * Tim 1 banner theo ID
   */
  async findBannerById(id) {
    const raw = await this.prisma.banners.findUnique({
      where: { id: String(id) }
    });
    return this.#mapBannerToDTO(raw);
  }

  /**
   * Tao moi banner (Admin CRUD)
   */
  async createBanner(data) {
    const id = String(data.id || `BANNER-${Date.now().toString(36).toUpperCase()}`);
    const title = (data.tenbanner || data.title || 'Banner Mới').trim();
    const img = data.hinhbanner || data.image_url || data.image || './images/300.png';
    const link = data.link_url || data.link || '#products';
    const order = Number(data.order ?? data.display_order ?? 1);
    const active = data.active !== undefined ? Boolean(data.active) : (data.is_active !== undefined ? Boolean(data.is_active) : true);
    const tag = data.tag || null;
    const desc = data.desc || data.description || null;
    const theme = data.theme || 'default';
    const ctaText = data.ctaText || data.cta_text || 'Khám Phá Các Mẫu Hoa';

    const raw = await this.prisma.banners.create({
      data: {
        id,
        title,
        image_url: img,
        link_url: link,
        display_order: order,
        is_active: active,
        tag,
        description: desc,
        theme,
        cta_text: ctaText
      }
    });
    return this.#mapBannerToDTO(raw);
  }

  /**
   * Cap nhat banner (Admin CRUD)
   */
  async updateBanner(id, data) {
    const updateData = {};
    if (data.tenbanner !== undefined || data.title !== undefined) {
      updateData.title = String(data.tenbanner ?? data.title).trim();
    }
    if (data.hinhbanner !== undefined || data.image_url !== undefined || data.image !== undefined) {
      updateData.image_url = data.hinhbanner ?? data.image_url ?? data.image;
    }
    if (data.link_url !== undefined || data.link !== undefined) {
      updateData.link_url = data.link_url ?? data.link;
    }
    if (data.order !== undefined || data.display_order !== undefined) {
      updateData.display_order = Number(data.order ?? data.display_order);
    }
    if (data.active !== undefined || data.is_active !== undefined) {
      updateData.is_active = Boolean(data.active ?? data.is_active);
    }
    if (data.tag !== undefined) {
      updateData.tag = data.tag;
    }
    if (data.desc !== undefined || data.description !== undefined) {
      updateData.description = data.desc ?? data.description;
    }
    if (data.theme !== undefined) {
      updateData.theme = data.theme;
    }
    if (data.ctaText !== undefined || data.cta_text !== undefined) {
      updateData.cta_text = data.ctaText ?? data.cta_text;
    }

    const raw = await this.prisma.banners.update({
      where: { id: String(id) },
      data: updateData
    });
    return this.#mapBannerToDTO(raw);
  }

  /**
   * Xoa banner (Admin CRUD)
   */
  async deleteBanner(id) {
    await this.prisma.banners.delete({
      where: { id: String(id) }
    });
    return { success: true, id };
  }

  /**
   * Kich hoat chu de banner
   */
  async activateBannerTheme(themeKey) {
    if (themeKey === 'all') {
      await this.prisma.banners.updateMany({
        data: { is_active: true }
      });
    } else {
      // Tat tat ca cac banner khac chu de
      await this.prisma.banners.updateMany({
        where: { theme: { not: themeKey } },
        data: { is_active: false }
      });
      // Bat cac banner thuoc chu de
      const updated = await this.prisma.banners.updateMany({
        where: { theme: themeKey },
        data: { is_active: true }
      });
      // Neu khong co banner nao thuoc chu de do, giu banner dau tien active de khong bi trang man hinh
      if (updated.count === 0) {
        const first = await this.prisma.banners.findFirst({ orderBy: { display_order: 'asc' } });
        if (first) {
          await this.prisma.banners.update({
            where: { id: first.id },
            data: { is_active: true }
          });
        }
      }
    }
    return this.findBanners({ activeOnly: false });
  }

  /**
   * Lay toan bo danh sach voucher khuyen mai
   */
  async findVouchers({ activeOnly = true } = {}) {
    const records = await this.prisma.vouchers.findMany({
      where: activeOnly ? { is_active: true } : {},
      orderBy: { id: 'asc' }
    });

    return records.map(v => ({
      id: v.id,
      code: v.code,
      name: v.name,
      discountType: v.discount_type,
      discount_type: v.discount_type,
      discountValue: v.discount_value,
      discount_value: v.discount_value,
      minOrder: v.min_order,
      min_order: v.min_order,
      maxDiscount: v.max_discount,
      max_discount: v.max_discount,
      scope: v.scope,
      targetCategoryIds: v.target_category_ids ? JSON.parse(v.target_category_ids || '[]') : [],
      targetProductIds: v.target_product_ids ? JSON.parse(v.target_product_ids || '[]') : [],
      usageLimit: v.usage_limit,
      usedCount: v.used_count,
      startDate: v.start_date,
      endDate: v.end_date,
      isActive: v.is_active,
      active: v.is_active
    }));
  }

  /**
   * Tim 1 voucher theo ma code
   */
  async findVoucherByCode(code) {
    if (!code) return null;
    const v = await this.prisma.vouchers.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
    if (!v) return null;
    return {
      id: v.id,
      code: v.code,
      name: v.name,
      discountType: v.discount_type,
      discountValue: v.discount_value,
      minOrder: v.min_order,
      maxDiscount: v.max_discount,
      scope: v.scope,
      usageLimit: v.usage_limit,
      usedCount: v.used_count,
      startDate: v.start_date,
      endDate: v.end_date,
      isActive: v.is_active,
      active: v.is_active
    };
  }

  /**
   * Tao moi 1 voucher khuyen mai
   */
  async createVoucher(data) {
    const code = String(data.code || '').trim().toUpperCase();
    if (!code) throw new ValidationError('Mã voucher không được để trống');
    if (!data.name) throw new ValidationError('Tên chương trình ưu đãi không được để trống');

    const existing = await this.prisma.vouchers.findUnique({ where: { code } });
    if (existing) {
      throw new ValidationError(`Mã voucher "${code}" đã tồn tại trong hệ thống`);
    }

    const id = data.id || `vouch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const discountType = data.discountType === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(data.discountValue ?? data.discountPercent) || 0;
    const minOrder = Number(data.minOrder) || 0;
    const maxDiscount = (discountType === 'percent' && data.maxDiscount) ? Number(data.maxDiscount) : null;
    const scope = ['all', 'category', 'product'].includes(data.scope) ? data.scope : 'all';
    const targetCategoryIds = Array.isArray(data.targetCategoryIds) ? JSON.stringify(data.targetCategoryIds) : null;
    const targetProductIds = Array.isArray(data.targetProductIds) ? JSON.stringify(data.targetProductIds) : null;
    const usageLimit = Number(data.usageLimit) > 0 ? Number(data.usageLimit) : 100;
    const usedCount = Number(data.usedCount) || 0;
    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate ? new Date(data.endDate) : null;
    const isActive = data.active !== undefined ? Boolean(data.active) : (data.isActive !== undefined ? Boolean(data.isActive) : true);

    const record = await this.prisma.vouchers.create({
      data: {
        id,
        code,
        name: String(data.name).trim(),
        discount_type: discountType,
        discount_value: discountValue,
        min_order: minOrder,
        max_discount: maxDiscount,
        scope,
        target_category_ids: targetCategoryIds,
        target_product_ids: targetProductIds,
        usage_limit: usageLimit,
        used_count: usedCount,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive
      }
    });

    return {
      id: record.id,
      code: record.code,
      name: record.name,
      discountType: record.discount_type,
      discount_type: record.discount_type,
      discountValue: record.discount_value,
      discount_value: record.discount_value,
      minOrder: record.min_order,
      min_order: record.min_order,
      maxDiscount: record.max_discount,
      max_discount: record.max_discount,
      scope: record.scope,
      targetCategoryIds: record.target_category_ids ? JSON.parse(record.target_category_ids) : [],
      targetProductIds: record.target_product_ids ? JSON.parse(record.target_product_ids) : [],
      usageLimit: record.usage_limit,
      usedCount: record.used_count,
      startDate: record.start_date,
      endDate: record.end_date,
      isActive: record.is_active,
      active: record.is_active
    };
  }

  /**
   * Cap nhat thong tin voucher
   */
  async updateVoucher(id, data) {
    const existing = await this.prisma.vouchers.findUnique({ where: { id: String(id) } });
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy voucher #${id}`);
    }

    const updateData = {};
    if (data.code !== undefined) {
      const newCode = String(data.code).trim().toUpperCase();
      if (!newCode) throw new ValidationError('Mã voucher không được để trống');
      if (newCode !== existing.code) {
        const dup = await this.prisma.vouchers.findUnique({ where: { code: newCode } });
        if (dup && dup.id !== existing.id) {
          throw new ValidationError(`Mã voucher "${newCode}" đã được sử dụng`);
        }
        updateData.code = newCode;
      }
    }
    if (data.name !== undefined) updateData.name = String(data.name).trim();
    if (data.discountType !== undefined) updateData.discount_type = data.discountType === 'fixed' ? 'fixed' : 'percent';
    if (data.discountValue !== undefined || data.discountPercent !== undefined) {
      updateData.discount_value = Number(data.discountValue ?? data.discountPercent) || 0;
    }
    if (data.minOrder !== undefined) updateData.min_order = Number(data.minOrder) || 0;
    if (data.maxDiscount !== undefined) updateData.max_discount = data.maxDiscount ? Number(data.maxDiscount) : null;
    if (data.scope !== undefined) updateData.scope = data.scope;
    if (data.targetCategoryIds !== undefined) {
      updateData.target_category_ids = Array.isArray(data.targetCategoryIds) ? JSON.stringify(data.targetCategoryIds) : null;
    }
    if (data.targetProductIds !== undefined) {
      updateData.target_product_ids = Array.isArray(data.targetProductIds) ? JSON.stringify(data.targetProductIds) : null;
    }
    if (data.usageLimit !== undefined) updateData.usage_limit = Number(data.usageLimit) || 100;
    if (data.usedCount !== undefined) updateData.used_count = Number(data.usedCount) || 0;
    if (data.startDate !== undefined) updateData.start_date = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.end_date = data.endDate ? new Date(data.endDate) : null;
    if (data.active !== undefined || data.isActive !== undefined) {
      updateData.is_active = data.active !== undefined ? Boolean(data.active) : Boolean(data.isActive);
    }

    const record = await this.prisma.vouchers.update({
      where: { id: String(id) },
      data: updateData
    });

    return {
      id: record.id,
      code: record.code,
      name: record.name,
      discountType: record.discount_type,
      discount_type: record.discount_type,
      discountValue: record.discount_value,
      discount_value: record.discount_value,
      minOrder: record.min_order,
      min_order: record.min_order,
      maxDiscount: record.max_discount,
      max_discount: record.max_discount,
      scope: record.scope,
      targetCategoryIds: record.target_category_ids ? JSON.parse(record.target_category_ids) : [],
      targetProductIds: record.target_product_ids ? JSON.parse(record.target_product_ids) : [],
      usageLimit: record.usage_limit,
      usedCount: record.used_count,
      startDate: record.start_date,
      endDate: record.end_date,
      isActive: record.is_active,
      active: record.is_active
    };
  }

  /**
   * Xoa voucher
   */
  async deleteVoucher(id) {
    const existing = await this.prisma.vouchers.findUnique({ where: { id: String(id) } });
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy voucher #${id}`);
    }
    await this.prisma.vouchers.delete({ where: { id: String(id) } });
    return true;
  }
}

