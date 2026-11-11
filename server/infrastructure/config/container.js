/**
 * container.js - IoC Container (Tu dong tiem phu thuoc - Constructor Dependency Injection)
 * Thuoc tang Infrastructure / Config
 * Lap rap toan bo cac tang: Adapters -> Ports -> Domain Services theo dung nguyen ly Hexagonal
 */

import { env } from './env.js';
import { getPrismaClient } from '../db/prisma.js';
import { PrismaUserRepository } from '../../adapters/out/persistence/PrismaUserRepository.js';
import { PrismaCatalogRepository } from '../../adapters/out/persistence/PrismaCatalogRepository.js';
import { PrismaOrderRepository } from '../../adapters/out/persistence/PrismaOrderRepository.js';
import { PrismaReviewRepository } from '../../adapters/out/persistence/PrismaReviewRepository.js';
import { PrismaWishlistRepository } from '../../adapters/out/persistence/PrismaWishlistRepository.js';
import { PrismaNotificationRepository } from '../../adapters/out/persistence/PrismaNotificationRepository.js';
import { BcryptHasherAdapter } from '../../adapters/out/security/BcryptHasherAdapter.js';
import { JwtTokenAdapter } from '../../adapters/out/security/JwtTokenAdapter.js';
import { AuthService } from '../../application/AuthService.js';
import { AuthController } from '../../adapters/in/web/AuthController.js';
import { CatalogController } from '../../adapters/in/web/CatalogController.js';
import { AdminUserController } from '../../adapters/in/web/AdminUserController.js';
import { OrderController } from '../../adapters/in/web/OrderController.js';
import { ReviewController } from '../../adapters/in/web/ReviewController.js';
import { WishlistController } from '../../adapters/in/web/WishlistController.js';
import { NotificationController } from '../../adapters/in/web/NotificationController.js';
import { UserController } from '../../adapters/in/web/UserController.js';
import { PaymentController } from '../../adapters/in/web/PaymentController.js';
import { createAuthMiddleware } from '../../adapters/in/web/middlewares/authMiddleware.js';
import { roleGuard } from '../../adapters/in/web/middlewares/roleGuard.js';
import { createAuthRouter } from '../../adapters/in/web/routes/authRoutes.js';

class Container {
  constructor() {
    this.env = env;
    this.prisma = getPrismaClient();

    // 1. Khoi tao Outbound Adapters (Ha tang DB & Security)
    this.userRepo = new PrismaUserRepository(this.prisma);
    this.catalogRepo = new PrismaCatalogRepository(this.prisma);
    this.orderRepo = new PrismaOrderRepository(this.prisma);
    this.reviewRepo = new PrismaReviewRepository(this.prisma);
    this.wishlistRepo = new PrismaWishlistRepository(this.prisma);
    this.notificationRepo = new PrismaNotificationRepository(this.prisma);
    this.passwordHasher = new BcryptHasherAdapter(10);
    this.tokenPort = new JwtTokenAdapter(this.env.JWT_SECRET, this.env.JWT_EXPIRES_IN);

    // 2. Khoi tao Application Services (Loi nghiep vu ung dung)
    this.authService = new AuthService(this.userRepo, this.passwordHasher, this.tokenPort);

    // 3. Khoi tao Inbound Adapters (Web Controllers & Middlewares)
    this.authController = new AuthController(this.authService);
    this.catalogController = new CatalogController(this.catalogRepo);
    this.adminUserController = new AdminUserController(this.prisma, this.passwordHasher);
    this.orderController = new OrderController(this.orderRepo);
    this.reviewController = new ReviewController(this.reviewRepo);
    this.wishlistController = new WishlistController(this.wishlistRepo);
    this.notificationController = new NotificationController(this.notificationRepo);
    this.userController = new UserController(this.prisma);
    this.paymentController = new PaymentController(this.prisma, process.env.SEPAY_API_TOKEN || '', this.orderRepo);

    // Middlewares
    this.authMiddleware = createAuthMiddleware(this.tokenPort, this.userRepo);
    // Optional auth middleware: khong bat buoc token, nhung neu co token hop le thi gan req.user
    this.optionalAuthMiddleware = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }
      const token = authHeader.substring(7);
      try {
        const decoded = this.tokenPort.verify(token);
        const user = await this.userRepo.findById(decoded.id);
        if (user && user.is_active) {
          req.user = user;
        }
      } catch (e) {
        // Token khong hop le thi van cho di tiep voi req.user = undefined
      }
      next();
    };

    this.roleGuard = roleGuard;

    // 4. Khoi tao Express Routes
    this.authRouter = createAuthRouter(this.authController, this.authMiddleware);
  }
}

// Singleton Container instance
export const container = new Container();
