/**
 * rateLimiter.js - Middleware giới hạn tần suất yêu cầu (Rate Limiter)
 * Chống tấn công brute-force quét mật khẩu và spam đăng ký
 * Thuộc tầng Adapters / In / Web
 */

export function createRateLimiter({ windowMs = 60 * 1000, max = 5, message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' } = {}) {
  const requests = new Map();

  // Dọn dẹp bộ nhớ định kỳ mỗi 5 phút
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now > record.resetTime) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = requests.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(ip, record);
      return next();
    }

    record.count++;
    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: retryAfterSeconds
      });
    }

    next();
  };
}

