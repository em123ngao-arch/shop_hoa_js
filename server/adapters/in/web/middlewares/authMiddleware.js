/**
 * authMiddleware.js - Middleware trích xuất và xác thực Bearer JWT Token
 * Thuộc tầng Adapters / In / Web
 */

export function createAuthMiddleware(tokenPort, userRepo) {
  return async function authMiddleware(req, res, next) {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Yêu cầu đăng nhập để truy cập tài nguyên này'
        });
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token xác thực không hợp lệ'
        });
      }

      // Xác minh JWT token
      const decoded = tokenPort.verify(token);

      // Lấy thông tin user mới nhất từ CSDL nếu cần
      if (userRepo) {
        const user = await userRepo.findById(decoded.id);
        if (!user || !user.isActive()) {
          return res.status(403).json({
            success: false,
            error: 'Tài khoản không tồn tại hoặc đã bị khóa'
          });
        }
        req.user = user.toDTO();
      } else {
        req.user = decoded;
      }

      next();
    } catch (err) {
      const status = err.statusCode || 401;
      return res.status(status).json({
        success: false,
        error: err.message || 'Xác thực phiên đăng nhập thất bại'
      });
    }
  };
}

