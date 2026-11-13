/**
 * authMiddleware.js - Middleware trích xuất và xác thực phiên từ cookie HttpOnly
 * Thuộc tầng Adapters / In / Web
 */

/** Chỉ lấy phiên xác thực từ cookie HttpOnly của trình duyệt. */
export function getRequestToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const sessionCookie = cookieHeader.split(';').map(part => part.trim())
    .find(part => part.startsWith('shophoa_session='));
  if (!sessionCookie) return '';
  const value = sessionCookie.slice('shophoa_session='.length);
  try { return decodeURIComponent(value); } catch { return ''; }
}

export function createAuthMiddleware(tokenPort, userRepo) {
  return async function authMiddleware(req, res, next) {
    try {
      const token = getRequestToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Yêu cầu đăng nhập để truy cập tài nguyên này.' }
        });
      }

      // Xác minh JWT token
      const decoded = tokenPort.verify(token);

      // Lấy thông tin user mới nhất từ CSDL nếu cần
      if (userRepo) {
        const user = await userRepo.findById(decoded.id);
        if (!user || !user.isActive()) {
          return res.status(401).json({
            error: { code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập không còn hợp lệ.' }
          });
        }
        if (Number(decoded.tokenVersion) !== Number(user.token_version)) {
          return res.status(401).json({
            error: { code: 'SESSION_REVOKED', message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.' }
          });
        }
        req.user = user.toDTO();
      } else {
        req.user = decoded;
      }

      res.setHeader('Cache-Control', 'no-store');
      next();
    } catch (err) {
      const status = err.statusCode || 401;
      return res.status(status).json({
        error: {
          code: err.code || 'INVALID_SESSION',
          message: status >= 500 ? 'Không thể xác thực phiên đăng nhập lúc này.' : (err.message || 'Phiên đăng nhập không hợp lệ.')
        }
      });
    }
  };
}

