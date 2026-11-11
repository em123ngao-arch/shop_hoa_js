/**
 * authRoutes.js - Khai báo các tuyến đường RESTful API cho phân hệ Xác thực
 * Thuộc tầng Adapters / In / Web
 */

import { Router } from 'express';
import { createRateLimiter } from '../middlewares/rateLimiter.js';

export function createAuthRouter(authController, authMiddleware) {
  const router = Router();

  // Rate Limiter chống Brute Force (tối đa 10 lần/phút)
  const loginLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 1 phút.'
  });

  const registerLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Bạn đã đăng ký quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau 1 phút.'
  });

  // Tuyến đường công khai (Public) kèm Rate Limiting
  router.post('/register', registerLimiter, authController.register);
  router.post('/login', loginLimiter, authController.login);

  // Tuyến đường cần xác thực Bearer JWT (Protected)
  router.get('/me', authMiddleware, authController.getMe);

  return router;
}
