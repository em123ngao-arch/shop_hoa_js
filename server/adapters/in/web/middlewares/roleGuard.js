/**
 * roleGuard.js - Middleware kiểm soát phân quyền dựa trên vai trò (Role-Based Access Control)
 * Thuộc tầng Adapters / In / Web
 */

export function roleGuard(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Chưa đăng nhập xác thực'
      });
    }

    const userRole = req.user.role || 'customer';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Bạn không có quyền truy cập chức năng này (Yêu cầu vai trò: ${allowedRoles.join(', ')})`
      });
    }

    next();
  };
}

