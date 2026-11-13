/**
 * authRoutes.js - Khai báo các tuyến đường RESTful API cho phân hệ Xác thực
 * Thuộc tầng Adapters / In / Web
 */

import { Router } from 'express';
import { createHash } from 'crypto';
import { createRateLimiter } from '../middlewares/rateLimiter.js';

export function createAuthRouter(authController, authMiddleware) {
  const router = Router();

  const loginIpLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: 'Bạn đã gửi quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.',
    keyGenerator: req => `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`
  });
  const loginEmailLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Bạn đã thử đăng nhập quá nhiều lần với email này. Vui lòng thử lại sau.',
    keyGenerator: req => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      return email ? `email:${email}` : `ip:${req.ip || 'unknown'}`;
    }
  });

  const registerLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Bạn đã đăng ký quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau.'
  });
  const forgotIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const forgotEmailLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Nếu email tồn tại, hướng dẫn đã được gửi gần đây. Vui lòng kiểm tra hộp thư.',
    keyGenerator: req => `email:${String(req.body?.email || '').trim().toLowerCase() || req.ip || 'unknown'}`
  });
  const resetIpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 15 });
  const resetTokenLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: req => {
      const token = String(req.body?.token || '');
      return token ? `reset:${createHash('sha256').update(token).digest('hex')}` : `ip:${req.ip || 'unknown'}`;
    }
  });

  // Tuyến đường công khai (Public) kèm Rate Limiting
  router.post('/register', registerLimiter, authController.register);
  router.post('/login', loginIpLimiter, loginEmailLimiter, authController.login);
  router.post('/logout', authController.logout);
  router.post('/logout-all', authMiddleware, authController.logoutAllDevices);
  router.post('/forgot-password', forgotIpLimiter, forgotEmailLimiter, authController.forgotPassword);
  router.post('/reset-password', resetIpLimiter, resetTokenLimiter, authController.resetPassword);

  // Endpoint phiên trình duyệt chỉ chấp nhận cookie HttpOnly.
  router.get('/me', authMiddleware, authController.getMe);

  return router;
}
