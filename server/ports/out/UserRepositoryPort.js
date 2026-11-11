/**
 * UserRepositoryPort.js - Outbound Port (Cổng ra) thao tác CSDL Người dùng
 * Định nghĩa hợp đồng mà Application Service cần để truy xuất CSDL (MySQL qua Prisma)
 * Thuộc tầng Ports (Hexagonal Architecture) - Pure JavaScript
 */

export class UserRepositoryPort {
  /**
   * Tìm người dùng theo email
   * @param {string} email
   * @returns {Promise<import('../../domain/models/User.js').User | null>}
   */
  async findByEmail(email) {
    throw new Error('Phương thức findByEmail() chưa được triển khai');
  }

  /**
   * Tìm người dùng theo ID
   * @param {string} id
   * @returns {Promise<import('../../domain/models/User.js').User | null>}
   */
  async findById(id) {
    throw new Error('Phương thức findById() chưa được triển khai');
  }

  /**
   * Tạo mới người dùng trong CSDL
   * @param {Object} userData
   * @returns {Promise<import('../../domain/models/User.js').User>}
   */
  async create(userData) {
    throw new Error('Phương thức create() chưa được triển khai');
  }

  /**
   * Cập nhật thông tin người dùng
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<import('../../domain/models/User.js').User>}
   */
  async update(id, updateData) {
    throw new Error('Phương thức update() chưa được triển khai');
  }
}

