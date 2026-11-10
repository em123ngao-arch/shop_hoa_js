/**
 * CatalogController.js - Express Controller xu ly cac yeu cau San pham, Danh muc, Banner, Khuyen mai
 * Thuoc tang Adapters / In / Web
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROD_UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads/products');
const BANNER_UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads/banners');

if (!fs.existsSync(PROD_UPLOADS_DIR)) {
  fs.mkdirSync(PROD_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BANNER_UPLOADS_DIR)) {
  fs.mkdirSync(BANNER_UPLOADS_DIR, { recursive: true });
}

async function sanitizeAndSaveBase64Image(rawBase64, prefix = 'prod') {
  if (!rawBase64 || typeof rawBase64 !== 'string' || !rawBase64.startsWith('data:image/')) {
    return rawBase64;
  }
  const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}.webp`;
  
  if (prefix === 'banner') {
    const filePath = path.join(BANNER_UPLOADS_DIR, filename);
    await sharp(buffer)
      .resize(1200, 500, { fit: 'cover' }) // Chuẩn tỉ lệ ngang Banner Hero
      .webp({ quality: 85 })
      .toFile(filePath);
    return `/uploads/banners/${filename}`;
  } else {
    const filePath = path.join(PROD_UPLOADS_DIR, filename);
    await sharp(buffer)
      .resize(600, 750, { fit: 'cover' }) // Chuẩn tỉ lệ 4:5 của hoa
      .webp({ quality: 85 })
      .toFile(filePath);
    return `/uploads/products/${filename}`;
  }
}

export class CatalogController {
  constructor(catalogRepository) {
    this.catalogRepo = catalogRepository;
  }

  // GET /api/products
  getProducts = async (req, res) => {
    try {
      const { categoryId, category_id, search, q, sort, _sort, _order, limit, _limit, activeOnly } = req.query;

      let sortParam = sort || '';
      if (_sort === 'soldCount' || _sort === 'price') {
        sortParam = `${_sort}_${_order === 'desc' ? 'desc' : 'asc'}`;
      }

      const products = await this.catalogRepo.findProducts({
        categoryId: categoryId || category_id || null,
        search: search || q || '',
        sort: sortParam,
        limit: limit || _limit || null,
        activeOnly: activeOnly !== 'false'
      });
      return res.status(200).json(products);
    } catch (err) {
      console.error('Loi getProducts:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi may chu khi lay danh sach san pham' } });
    }
  };

  // GET /api/products/:id
  getProductById = async (req, res) => {
    try {
      const product = await this.catalogRepo.findProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Khong tim thay san pham yeu cau' } });
      }
      return res.status(200).json(product);
    } catch (err) {
      console.error('Loi getProductById:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi may chu khi lay chi tiet san pham' } });
    }
  };

  // POST /api/products (Staff/Admin)
  createProduct = async (req, res) => {
    try {
      const data = { ...req.body };
      if (!data.name || Number(data.price) < 0) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ten va gia san pham khong hop le' } });
      }
      if (data.image) {
        data.image = await sanitizeAndSaveBase64Image(data.image, 'prod');
      }
      if (data.image_url) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'prod');
      }
      const newProduct = await this.catalogRepo.createProduct(data);
      return res.status(201).json(newProduct);
    } catch (err) {
      console.error('Loi createProduct:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi may chu khi tao san pham' } });
    }
  };

  // PUT /api/products/:id (Staff/Admin)
  updateProduct = async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.image) {
        data.image = await sanitizeAndSaveBase64Image(data.image, 'prod');
      }
      if (data.image_url) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'prod');
      }
      const updated = await this.catalogRepo.updateProduct(req.params.id, data);
      return res.status(200).json(updated);
    } catch (err) {
      console.error('Loi updateProduct:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi may chu khi cap nhat san pham' } });
    }
  };

  // DELETE /api/products/:id (Admin only)
  deleteProduct = async (req, res) => {
    try {
      await this.catalogRepo.deleteProduct(req.params.id);
      return res.status(200).json({ success: true, message: 'Xoa san pham thanh cong' });
    } catch (err) {
      console.error('Loi deleteProduct:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi may chu khi xoa san pham' } });
    }
  };

  // GET /api/categories
  getCategories = async (req, res) => {
    try {
      const categories = await this.catalogRepo.findCategories();
      return res.status(200).json(categories);
    } catch (err) {
      console.error('Loi getCategories:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay danh muc' } });
    }
  };

  // GET /api/banners
  getBanners = async (req, res) => {
    try {
      const { all } = req.query;
      const banners = await this.catalogRepo.findBanners({ activeOnly: all !== 'true' });
      return res.status(200).json(banners);
    } catch (err) {
      console.error('Loi getBanners:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay banner' } });
    }
  };

  // POST /api/banners (Staff/Admin)
  createBanner = async (req, res) => {
    try {
      const data = { ...req.body };
      if (!data.tenbanner && !data.title) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Tên banner không được để trống' } });
      }
      if (data.hinhbanner) {
        data.hinhbanner = await sanitizeAndSaveBase64Image(data.hinhbanner, 'banner');
      }
      if (data.image_url) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'banner');
      }
      const newBanner = await this.catalogRepo.createBanner(data);
      return res.status(201).json(newBanner);
    } catch (err) {
      console.error('Loi createBanner:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi tạo banner' } });
    }
  };

  // PUT /api/banners/:id (Staff/Admin)
  updateBanner = async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.hinhbanner) {
        data.hinhbanner = await sanitizeAndSaveBase64Image(data.hinhbanner, 'banner');
      }
      if (data.image_url) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'banner');
      }
      const updated = await this.catalogRepo.updateBanner(req.params.id, data);
      return res.status(200).json(updated);
    } catch (err) {
      console.error('Loi updateBanner:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi cập nhật banner' } });
    }
  };

  // DELETE /api/banners/:id (Admin only)
  deleteBanner = async (req, res) => {
    try {
      await this.catalogRepo.deleteBanner(req.params.id);
      return res.status(200).json({ success: true, message: 'Xóa banner thành công' });
    } catch (err) {
      console.error('Loi deleteBanner:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi xóa banner' } });
    }
  };

  // PUT /api/banners/theme (Staff/Admin)
  activateBannerTheme = async (req, res) => {
    try {
      const { theme } = req.body;
      const banners = await this.catalogRepo.activateBannerTheme(theme || 'default');
      return res.status(200).json(banners);
    } catch (err) {
      console.error('Loi activateBannerTheme:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Lỗi kích hoạt chủ đề banner' } });
    }
  };

  // GET /api/promotions (hoac /api/vouchers)
  getPromotions = async (req, res) => {
    try {
      const { all } = req.query;
      const vouchers = await this.catalogRepo.findVouchers({ activeOnly: all !== 'true' });
      return res.status(200).json(vouchers);
    } catch (err) {
      console.error('Loi getPromotions:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay khuyen mai' } });
    }
  };
}

