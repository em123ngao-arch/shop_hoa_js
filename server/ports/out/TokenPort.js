/**
 * TokenPort.js - Outbound Port (Cổng ra) trừu tượng hóa việc sinh và xác minh JWT Token
 * Thuộc tầng Ports (Hexagonal Architecture) - Chuẩn RFC 7519
 */

export class TokenPort {
  /**
   * Sinh chuỗi JWT Token từ payload
   * @param {Object} payload { id, email, role }
   * @returns {string} Chuỗi JWT token
   */
  generate(payload) {
    throw new Error('Phương thức generate() chưa được triển khai');
  }

  /**
   * Giải mã và xác thực tính hợp lệ của JWT Token
   * @param {string} token
   * @returns {Object} Payload giải mã
   */
  verify(token) {
    throw new Error('Phương thức verify() chưa được triển khai');
  }
}

