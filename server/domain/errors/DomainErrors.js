/**
 * DomainErrors.js - Lớp định nghĩa các lỗi nghiệp vụ trong hệ thống Shop Hoa
 * Thuộc tầng Domain (Hexagonal Architecture) - Pure JavaScript, không phụ thuộc framework
 */

export class DomainError extends Error {
  constructor(message, statusCode = 400, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Lỗi dữ liệu đầu vào không hợp lệ (400 Bad Request)
export class ValidationError extends DomainError {
  constructor(message = 'Dữ liệu đầu vào không hợp lệ') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

// Lỗi xác thực thất bại - sai tài khoản hoặc mật khẩu (401 Unauthorized)
export class AuthenticationError extends DomainError {
  constructor(message = 'Email hoặc mật khẩu không chính xác') {
    super(message, 401, 'INVALID_CREDENTIALS');
  }
}
export const UnauthorizedError = AuthenticationError;

// Lỗi không đủ quyền hạn hoặc tài khoản bị khóa (403 Forbidden)
export class ForbiddenError extends DomainError {
  constructor(message = 'Bạn không có quyền thực hiện hành động này hoặc tài khoản đã bị khóa') {
    super(message, 403, 'FORBIDDEN');
  }
}

// Lỗi không tìm thấy tài nguyên (404 Not Found)
export class NotFoundError extends DomainError {
  constructor(message = 'Không tìm thấy tài nguyên yêu cầu') {
    super(message, 404, 'NOT_FOUND');
  }
}

// Lỗi xung đột dữ liệu - ví dụ trùng email (409 Conflict)
export class ConflictError extends DomainError {
  constructor(message = 'Tài nguyên đã tồn tại trong hệ thống') {
    super(message, 409, 'CONFLICT');
  }
}

export class InvalidResetTokenError extends DomainError {
  constructor(message = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn') {
    super(message, 400, 'INVALID_RESET_TOKEN');
  }
}

