/**
 * rateLimiter.js - Middleware giới hạn tần suất yêu cầu (Rate Limiter)
 * Chống tấn công brute-force quét mật khẩu và spam đăng ký
 * Thuộc tầng Adapters / In / Web
 */

export function createRateLimiter({
  windowMs = 60 * 1000,
  max = 5,
  message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  code = 'RATE_LIMITED',
  keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  maxKeys = 10000,
  skipSuccessfulRequests = false
} = {}) {
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
    const key = String(keyGenerator(req) || 'unknown').slice(0, 254);
    const now = Date.now();

    let record = requests.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      if (requests.size >= maxKeys) requests.delete(requests.keys().next().value);
      requests.set(key, record);
    } else {
      record.count++;
    }

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: { code, message },
        retryAfter: retryAfterSeconds
      });
    }

    if (skipSuccessfulRequests) {
      res.once('finish', () => {
        if (res.statusCode < 400 && requests.get(key) === record) {
          record.count = Math.max(0, record.count - 1);
          if (record.count === 0) requests.delete(key);
        }
      });
    }
    next();
  };
}

