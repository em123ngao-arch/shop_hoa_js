/**
 * CatalogController.js - Express Controller xu ly cac yeu cau San pham, Danh muc, Banner, Khuyen mai
 * Thuoc tang Adapters / In / Web
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { saveProcessedMedia, deleteMediaFiles } from '../../out/storage/MediaStorageService.js';
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
  if (!rawBase64 || typeof rawBase64 !== 'string') {
    return rawBase64;
  }
  if (!rawBase64.startsWith('data:')) return rawBase64;
  if (rawBase64.length > 8_000_000 || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(rawBase64)) {
    throw Object.assign(new Error('Ảnh phải là PNG, JPEG hoặc WebP và không vượt quá 6 MB'), { statusCode: 400 });
  }
  const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer.length || buffer.length > 6_000_000) {
    throw Object.assign(new Error('Ảnh vượt quá dung lượng cho phép'), { statusCode: 413 });
  }
  const filename = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}.webp`;
  const folder = prefix === 'banner' ? 'banners' : 'products';

  let processedBuffer;
  if (prefix === 'banner') {
    processedBuffer = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .resize(1200, 500, { fit: 'cover' }) // Chuẩn tỉ lệ ngang Banner Hero
      .webp({ quality: 85 })
      .toBuffer();
  } else {
    processedBuffer = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .resize(600, 750, { fit: 'cover' }) // Chuẩn tỉ lệ 4:5 của hoa
      .webp({ quality: 85 })
      .toBuffer();
  }

  return saveProcessedMedia(processedBuffer, { folder, filename });
}

/**
 * Xoa an toan cac file anh mo coi nam trong uploads/products/ hoac uploads/banners/ hoac tren Cloudinary
 * Tuyet doi khong cham toi anh mau tinh trong public/images/
 */
async function unlinkCatalogFiles(urls = []) {
  await deleteMediaFiles(urls);
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
    const newlySavedUrls = [];
    try {
      const data = { ...req.body };
      if (!data.name || Number(data.price) < 0) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Ten va gia san pham khong hop le' } });
      }
      if (data.image && String(data.image).startsWith('data:')) {
        data.image = await sanitizeAndSaveBase64Image(data.image, 'prod');
        newlySavedUrls.push(data.image);
      }
      if (data.image_url && String(data.image_url).startsWith('data:')) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'prod');
        newlySavedUrls.push(data.image_url);
      }
      const newProduct = await this.catalogRepo.createProduct(data);
      return res.status(201).json(newProduct);
    } catch (err) {
      unlinkCatalogFiles(newlySavedUrls);
      console.error('Loi createProduct:', err);
      return res.status(err.statusCode || 500).json({ error: { code: err.statusCode ? 'VALIDATION_ERROR' : 'SERVER_ERROR', message: err.statusCode ? err.message : 'Loi may chu khi tao san pham' } });
    }
  };

  // PUT /api/products/:id (Staff/Admin)
  updateProduct = async (req, res) => {
    const newlySavedUrls = [];
    try {
      const existing = await this.catalogRepo.findProductById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Khong tim thay san pham can cap nhat' } });
      }
      const data = { ...req.body };
      if (data.image && String(data.image).startsWith('data:')) {
        data.image = await sanitizeAndSaveBase64Image(data.image, 'prod');
        newlySavedUrls.push(data.image);
      }
      if (data.image_url && String(data.image_url).startsWith('data:')) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'prod');
        newlySavedUrls.push(data.image_url);
      }
      const updated = await this.catalogRepo.updateProduct(req.params.id, data);
      const oldImg = existing.image_url || existing.image;
      const newImg = updated?.image_url || updated?.image;
      if (oldImg && newImg && oldImg !== newImg) {
        unlinkCatalogFiles([oldImg]);
      }
      return res.status(200).json(updated);
    } catch (err) {
      unlinkCatalogFiles(newlySavedUrls);
      console.error('Loi updateProduct:', err);
      return res.status(err.statusCode || 500).json({ error: { code: err.statusCode ? 'VALIDATION_ERROR' : 'SERVER_ERROR', message: err.statusCode ? err.message : 'Loi may chu khi cap nhat san pham' } });
    }
  };

  // DELETE /api/products/:id (Admin only)
  deleteProduct = async (req, res) => {
    try {
      const existing = await this.catalogRepo.findProductById(req.params.id);
      await this.catalogRepo.deleteProduct(req.params.id);
      if (existing) {
        unlinkCatalogFiles([existing.image_url || existing.image]);
      }
      return res.status(200).json({ success: true, message: 'Xóa sản phẩm thành công' });
    } catch (err) {
      console.error('Lỗi deleteProduct:', err);
      const isValidation = err.name === 'ValidationError' || err.statusCode === 400 || err.code === 'P2003';
      const statusCode = isValidation ? 400 : (err.statusCode || 500);
      const message = err.name === 'ValidationError'
        ? err.message
        : (err.code === 'P2003'
          ? 'Mẫu hoa này đã có lịch sử đơn hàng, không thể xóa vĩnh viễn. Vui lòng chuyển sang trạng thái "Ngừng kinh doanh"!'
          : (err.message || 'Lỗi máy chủ khi xóa sản phẩm'));
      return res.status(statusCode).json({ error: { code: isValidation ? 'VALIDATION_ERROR' : 'SERVER_ERROR', message } });
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
    const newlySavedUrls = [];
    try {
      const data = { ...req.body };
      if (!data.tenbanner && !data.title) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Tên banner không được để trống' } });
      }
      if (data.hinhbanner && String(data.hinhbanner).startsWith('data:')) {
        data.hinhbanner = await sanitizeAndSaveBase64Image(data.hinhbanner, 'banner');
        newlySavedUrls.push(data.hinhbanner);
      }
      if (data.image_url && String(data.image_url).startsWith('data:')) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'banner');
        newlySavedUrls.push(data.image_url);
      }
      const newBanner = await this.catalogRepo.createBanner(data);
      return res.status(201).json(newBanner);
    } catch (err) {
      unlinkCatalogFiles(newlySavedUrls);
      console.error('Loi createBanner:', err);
      return res.status(err.statusCode || 500).json({ error: { code: err.statusCode ? 'VALIDATION_ERROR' : 'SERVER_ERROR', message: err.statusCode ? err.message : 'Lỗi tạo banner' } });
    }
  };

  // PUT /api/banners/:id (Staff/Admin)
  updateBanner = async (req, res) => {
    const newlySavedUrls = [];
    try {
      const existing = await this.catalogRepo.findBannerById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy banner cần cập nhật' } });
      }
      const data = { ...req.body };
      if (data.hinhbanner && String(data.hinhbanner).startsWith('data:')) {
        data.hinhbanner = await sanitizeAndSaveBase64Image(data.hinhbanner, 'banner');
        newlySavedUrls.push(data.hinhbanner);
      }
      if (data.image_url && String(data.image_url).startsWith('data:')) {
        data.image_url = await sanitizeAndSaveBase64Image(data.image_url, 'banner');
        newlySavedUrls.push(data.image_url);
      }
      const updated = await this.catalogRepo.updateBanner(req.params.id, data);
      const oldImg = existing.image_url || existing.hinhbanner || existing.image;
      const newImg = updated?.image_url || updated?.hinhbanner || updated?.image;
      if (oldImg && newImg && oldImg !== newImg) {
        unlinkCatalogFiles([oldImg]);
      }
      return res.status(200).json(updated);
    } catch (err) {
      unlinkCatalogFiles(newlySavedUrls);
      console.error('Loi updateBanner:', err);
      return res.status(err.statusCode || 500).json({ error: { code: err.statusCode ? 'VALIDATION_ERROR' : 'SERVER_ERROR', message: err.statusCode ? err.message : 'Lỗi cập nhật banner' } });
    }
  };

  // DELETE /api/banners/:id (Admin only)
  deleteBanner = async (req, res) => {
    try {
      const existing = await this.catalogRepo.findBannerById(req.params.id);
      await this.catalogRepo.deleteBanner(req.params.id);
      if (existing) {
        unlinkCatalogFiles([existing.image_url || existing.hinhbanner || existing.image]);
      }
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

  // POST /api/promotions (hoac /api/vouchers)
  createVoucher = async (req, res) => {
    try {
      const newVoucher = await this.catalogRepo.createVoucher(req.body);
      return res.status(201).json(newVoucher);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      console.error('Loi createVoucher:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Loi tao voucher' } });
    }
  };

  // PUT /api/promotions/:id (hoac /api/vouchers/:id)
  updateVoucher = async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await this.catalogRepo.updateVoucher(id, req.body);
      return res.status(200).json(updated);
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message } });
      }
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi updateVoucher:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Loi cap nhat voucher' } });
    }
  };

  // DELETE /api/promotions/:id (hoac /api/vouchers/:id)
  deleteVoucher = async (req, res) => {
    try {
      const { id } = req.params;
      await this.catalogRepo.deleteVoucher(id);
      return res.status(200).json({ success: true, message: 'Da xoa voucher thanh cong' });
    } catch (err) {
      if (err.name === 'NotFoundError') {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
      }
      console.error('Loi deleteVoucher:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message || 'Loi xoa voucher' } });
    }
  };
}

