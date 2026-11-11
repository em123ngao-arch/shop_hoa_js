/**
 * AuthService.js - Dịch vụ Nghiệp vụ Xác thực (Authentication Application Service)
 * Thuộc tầng Application (Nghiệp vụ ứng dụng) - Thực thi AuthUseCase
 * Tuân thủ nghiêm ngặt Clean Architecture: Không gắn cờ bí danh, chống Timing Attack, ID UUID an toàn.
 */

import crypto from 'crypto';
import { AuthUseCase } from '../ports/in/AuthUseCase.js';
import { ValidationError, AuthenticationError, ConflictError, ForbiddenError } from '../domain/errors/DomainErrors.js';

export class AuthService extends AuthUseCase {
  constructor(userRepository, passwordHasher, tokenPort) {
    super();
    this.userRepo = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenPort = tokenPort;

    // Chuỗi Bcrypt hash hợp lệ dùng để đối soát giả lập khi tài khoản không tồn tại,
    // triệt tiêu sự chênh lệch thời gian xử lý CPU (Chống Timing Attack / User Enumeration)
    this.dummyHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  }

  /**
   * Đăng ký tài khoản mới
   * @param {Object} param0 { name, email, password, phone }
   * @returns {Promise<{ success: boolean, message: string, user: Object }>}
   */
  async register({ name, email, password, phone = null }) {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Họ và tên không được để trống');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ValidationError('Địa chỉ email không hợp lệ');
    }

    if (!password || password.length < 8) {
      throw new ValidationError('Mật khẩu phải có độ dài tối thiểu từ 8 ký tự trở lên');
    }

    // Bcrypt giới hạn mật khẩu tối đa 72 bytes
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new ValidationError('Mật khẩu không được vượt quá 72 bytes theo chuẩn bảo mật Bcrypt');
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Kiểm tra chống trùng lặp Email ở tầng Application
    const existing = await this.userRepo.findByEmail(cleanEmail);
    if (existing) {
      throw new ConflictError('Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
    }

    // 2. Băm mật khẩu 1 chiều bằng Bcrypt
    const passwordHash = await this.passwordHasher.hash(password);

    // 3. Tạo định danh an toàn bằng crypto.randomUUID()
    const userId = `USR-${crypto.randomUUID()}`;

    // 4. Lưu vào CSDL MySQL - Luôn gán cứng role = 'customer' (chống leo thang đặc quyền)
    const newUser = await this.userRepo.create({
      id: userId,
      email: cleanEmail,
      password_hash: passwordHash,
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      role: 'customer',
      avatar_url: null,
      is_active: 1
    });

    return {
      success: true,
      message: 'Đăng ký tài khoản thành công',
      user: newUser.toDTO()
    };
  }

  /**
   * Đăng nhập người dùng và cấp vé JWT
   * @param {Object} param0 { email, password }
   * @returns {Promise<{ success: boolean, message: string, token: string, user: Object }>}
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new ValidationError('Vui lòng nhập đầy đủ email và mật khẩu');
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Tìm người dùng trong MySQL
    const user = await this.userRepo.findByEmail(cleanEmail);

    if (!user) {
      // Chạy hash giả lập để đảm bảo thời gian phản hồi tương đương (chống timing attack)
      await this.passwordHasher.compare(password, this.dummyHash);
      throw new AuthenticationError('Email hoặc mật khẩu không chính xác');
    }

    // 2. Đối soát mật khẩu thô với chuỗi băm Bcrypt TRƯỚC (Chống rò rỉ trạng thái tài khoản)
    const isMatch = await this.passwordHasher.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AuthenticationError('Email hoặc mật khẩu không chính xác');
    }

    // 3. Khi mật khẩu hoàn toàn chính xác mới kiểm tra trạng thái hoạt động
    if (!user.isActive()) {
      throw new ForbiddenError('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ ban quản trị.');
    }

    // 4. Cấp vé phiên đăng nhập an toàn bằng JWT RFC 7519
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    const token = this.tokenPort.generate(payload);

    return {
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: user.toDTO()
    };
  }

  /**
   * Lấy thông tin cá nhân của người dùng hiện tại
   * @param {string} userId
   * @returns {Promise<{ success: boolean, user: Object }>}
   */
  async getMe(userId) {
    if (!userId) {
      throw new AuthenticationError('Yêu cầu định danh người dùng');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AuthenticationError('Không tìm thấy thông tin tài khoản');
    }

    return {
      success: true,
      user: user.toDTO()
    };
  }
}
