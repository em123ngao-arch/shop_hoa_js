/**
 * PasswordHasherPort.js - Outbound Port (Cổng ra) trừu tượng hóa băm và đối soát mật khẩu
 * Thuộc tầng Ports (Hexagonal Architecture) - Giúp Application Service không dính chặt vào thư viện Bcrypt
 */

export class PasswordHasherPort {
  /**
   * Băm mật khẩu thô
   * @param {string} rawPassword
   * @returns {Promise<string>}
   */
  async hash(rawPassword) {
    throw new Error('Phương thức hash() chưa được triển khai');
  }

  /**
   * So sánh mật khẩu thô với chuỗi băm
   * @param {string} rawPassword
   * @param {string} hashedPassword
   * @returns {Promise<boolean>}
   */
  async compare(rawPassword, hashedPassword) {
    throw new Error('Phương thức compare() chưa được triển khai');
  }
}

