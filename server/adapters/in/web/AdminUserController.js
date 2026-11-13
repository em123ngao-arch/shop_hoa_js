/**
 * AdminUserController.js - Express Controller quan tri nguoi dung tren MySQL 8.0 cho Admin Dashboard
 * Thuoc tang Adapters / In / Web
 */

import { ConflictError, ValidationError } from '../../../domain/errors/DomainErrors.js';

export class AdminUserController {
  constructor(prismaClient, passwordHasher) {
    this.prisma = prismaClient;
    this.passwordHasher = passwordHasher;
  }

  // GET /api/admin/users
  getUsers = async (req, res) => {
    try {
      const users = await this.prisma.users.findMany({
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatar_url: true,
          is_active: true,
          created_at: true
        }
      });

      // DTO tuong thich 100% voi admin.js
      const dtoList = users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone || '',
        role: u.role,
        avatar: u.avatar_url || '',
        isActive: u.is_active,
        is_active: u.is_active,
        createdAt: u.created_at
      }));

      return res.status(200).json(dtoList);
    } catch (err) {
      console.error('Loi getUsers:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi lay danh sach nguoi dung' } });
    }
  };

  // POST /api/admin/users
  createUser = async (req, res) => {
    try {
      const { name, email, password, role, phone } = req.body;
      if (!['admin', 'staff'].includes(role)) {
        return res.status(400).json({
          error: { code: 'INVALID_ROLE', message: 'Tài khoản nhân sự chỉ được tạo với vai trò Admin hoặc Staff.' }
        });
      }
      if (!name || !email || !password) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' } });
      }
      if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 bytes.' } });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = await this.prisma.users.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Dia chi email nay da ton tai trong he thong' } });
      }

      const passwordHash = await this.passwordHasher.hash(password);
      const userId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const raw = await this.prisma.users.create({
        data: {
          id: userId,
          email: cleanEmail,
          password_hash: passwordHash,
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          role,
          is_active: true
        }
      });

      return res.status(201).json({
        id: raw.id,
        email: raw.email,
        name: raw.name,
        phone: raw.phone || '',
        role: raw.role,
        isActive: raw.is_active,
        createdAt: raw.created_at
      });
    } catch (err) {
      console.error('Loi createUser:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi tao nguoi dung moi' } });
    }
  };

  // PUT /api/admin/users/:id
  updateUser = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, role, is_active, isActive, password } = req.body;

      if (role !== undefined && !['admin', 'staff'].includes(role)) {
        return res.status(400).json({
          error: { code: 'INVALID_ROLE', message: 'Không thể gán role Khách hàng tại màn hình quản lý nhân sự. Chỉ chấp nhận Admin hoặc Staff.' }
        });
      }

      const data = {};
      if (name !== undefined) data.name = name.trim();
      if (phone !== undefined) data.phone = phone ? phone.trim() : null;
      if (role !== undefined) data.role = role;
      if (is_active !== undefined || isActive !== undefined) {
        data.is_active = Boolean(is_active ?? isActive);
      }
      if (password !== undefined && password !== '') {
        if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 bytes.' } });
        }
        data.password_hash = await this.passwordHasher.hash(password);
      }
      if (data.password_hash || role !== undefined || is_active !== undefined || isActive !== undefined) {
        data.token_version = { increment: 1 };
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.users.findUnique({
          where: { id },
          select: { id: true, role: true, is_active: true }
        });
        if (!existing) return { error: 'NOT_FOUND' };

        const nextRole = role ?? existing.role;
        const nextIsActive = is_active !== undefined || isActive !== undefined
          ? Boolean(is_active ?? isActive)
          : existing.is_active;
        const isRemovingActiveAdmin = existing.role === 'admin'
          && existing.is_active
          && (nextRole !== 'admin' || !nextIsActive);

        if (isRemovingActiveAdmin) {
          const activeAdminCount = await tx.users.count({ where: { role: 'admin', is_active: true } });
          if (activeAdminCount <= 1) return { error: 'LAST_ACTIVE_ADMIN' };
        }

        const updated = await tx.users.update({
          where: { id },
          data,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            avatar_url: true,
            is_active: true,
            created_at: true
          }
        });
        return { user: updated };
      }, { isolationLevel: 'Serializable' });

      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' } });
      }
      if (result.error === 'LAST_ACTIVE_ADMIN') {
        return res.status(409).json({ error: { code: 'LAST_ACTIVE_ADMIN', message: 'Không thể hạ quyền hoặc vô hiệu hóa Admin cuối cùng đang hoạt động.' } });
      }

      return res.status(200).json(result.user);
    } catch (err) {
      console.error('Loi updateUser:', err);
      if (err.code === 'P2034') {
        return res.status(409).json({ error: { code: 'CONCURRENT_ROLE_CHANGE', message: 'Tài khoản vừa được cập nhật đồng thời. Vui lòng tải lại và thử lại.' } });
      }
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi cap nhat nguoi dung' } });
    }
  };

  // DELETE /api/admin/users/:id
  deleteUser = async (req, res) => {
    try {
      const { id } = req.params;
      if (req.user?.id === id) {
        return res.status(400).json({ error: { code: 'SELF_DELETE_FORBIDDEN', message: 'Ban khong the tu xoa tai khoan cua chinh minh' } });
      }

      await this.prisma.users.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Xoa nguoi dung thanh cong' });
    } catch (err) {
      console.error('Loi deleteUser:', err);
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Loi xoa nguoi dung' } });
    }
  };
}
