/**
 * User.js - Thực thể Người dùng (User Entity)
 * Thuộc tầng Domain (Lõi nghiệp vụ) - Pure JavaScript ES Modules, 0 dependencies
 */

import { ValidationError } from '../errors/DomainErrors.js';

export class User {
  constructor({
    id,
    email,
    password_hash,
    name,
    phone = null,
    role = 'customer',
    avatar_url = null,
    is_active = 1,
    created_at = new Date()
  }) {
    this.validate({ email, name, role });

    this.id = id;
    this.email = email.trim().toLowerCase();
    this.password_hash = password_hash;
    this.name = name.trim();
    this.phone = phone ? phone.trim() : null;
    this.role = role;
    this.avatar_url = avatar_url;
    this.is_active = Number(is_active) === 1 ? 1 : 0;
    this.created_at = created_at instanceof Date ? created_at : new Date(created_at);
  }

  /**
   * Kiểm tra tính toàn vẹn dữ liệu nghiệp vụ của User
   */
  validate({ email, name, role }) {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Họ và tên không được để trống');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ValidationError('Địa chỉ email không hợp lệ');
    }

    const validRoles = ['customer', 'staff', 'admin'];
    if (role && !validRoles.includes(role)) {
      throw new ValidationError(`Vai trò người dùng không hợp lệ: ${role}`);
    }
  }

  /**
   * Kiểm tra người dùng có đang hoạt động hay không
   */
  isActive() {
    return this.is_active === 1;
  }

  /**
   * Chuyển đổi sang Data Transfer Object (DTO) an toàn, tuyệt đối không lộ password_hash
   */
  toDTO() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      phone: this.phone,
      role: this.role,
      avatar_url: this.avatar_url,
      is_active: this.is_active,
      created_at: this.created_at
    };
  }
}

