/**
 * BcryptHasherAdapter.js - Bộ tiếp hợp mã hóa mật khẩu dùng bcryptjs
 * Thuộc tầng Adapters / Out / Security
 */

import bcrypt from 'bcryptjs';
import { PasswordHasherPort } from '../../../ports/out/PasswordHasherPort.js';

export class BcryptHasherAdapter extends PasswordHasherPort {
  constructor(saltRounds = 10) {
    super();
    this.saltRounds = saltRounds;
  }

  /**
   * Băm mật khẩu bằng thuật toán Bcrypt
   * @param {string} rawPassword
   * @returns {Promise<string>}
   */
  async hash(rawPassword) {
    return bcrypt.hash(rawPassword, this.saltRounds);
  }

  /**
   * Đối soát mật khẩu thô với chuỗi băm
   * @param {string} rawPassword
   * @param {string} hashedPassword
   * @returns {Promise<boolean>}
   */
  async compare(rawPassword, hashedPassword) {
    if (!rawPassword || !hashedPassword) return false;
    return bcrypt.compare(rawPassword, hashedPassword);
  }
}

