/**
 * AuthUseCase.js - Inbound Port (Cổng vào) cho Phân hệ Xác thực
 * Định nghĩa hợp đồng nghiệp vụ mà tầng Web Adapter sẽ gọi vào Application Service
 * Thuộc tầng Ports (Hexagonal Architecture) - Pure JavaScript
 */

export class AuthUseCase {
  /**
   * Đăng ký người dùng mới
   * @param {Object} registerDTO { name, email, password, phone }
   * @returns {Promise<{ message: string, user: Object }>}
   */
  async register(registerDTO) {
    throw new Error('Phương thức register() chưa được triển khai');
  }

  /**
   * Đăng nhập người dùng và cấp vé JWT
   * @param {Object} loginDTO { email, password }
   * @returns {Promise<{ token: string, user: Object }>}
   */
  async login(loginDTO) {
    throw new Error('Phương thức login() chưa được triển khai');
  }

  /**
   * Lấy thông tin cá nhân của người dùng đang đăng nhập
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getMe(userId) {
    throw new Error('Phương thức getMe() chưa được triển khai');
  }
}

