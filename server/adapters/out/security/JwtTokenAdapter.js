/**
 * JwtTokenAdapter.js - Bộ tiếp hợp sinh và xác minh JWT Token (RFC 7519)
 * Thuộc tầng Adapters / Out / Security
 */

import jwt from 'jsonwebtoken';
import { TokenPort } from '../../../ports/out/TokenPort.js';
import { AuthenticationError } from '../../../domain/errors/DomainErrors.js';

export class JwtTokenAdapter extends TokenPort {
  constructor(secret, expiresIn = '24h') {
    super();
    if (!secret) {
      throw new Error('JwtTokenAdapter yêu cầu chuỗi bí mật (secret) để ký token');
    }
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  /**
   * Ký sinh token JWT chứa payload
   * @param {Object} payload { id, email, role }
   * @returns {string} Chuỗi token
   */
  generate(payload) {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256'
    });
  }

  /**
   * Giải mã và xác thực token JWT
   * @param {string} token
   * @returns {Object} Payload giải mã
   */
  verify(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
      }
      throw new AuthenticationError('Token xác thực không hợp lệ');
    }
  }
}

