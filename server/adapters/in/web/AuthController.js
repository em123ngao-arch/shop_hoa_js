/**
 * AuthController.js - Express Controller xử lý các yêu cầu HTTP xác thực
 * Thuộc tầng Adapters / In / Web
 */

export class AuthController {
  constructor(authUseCase) {
    this.authService = authUseCase;
  }

  /**
   * POST /api/auth/register - Đăng ký tài khoản mới
   */
  register = async (req, res) => {
    try {
      const { name, email, password, phone } = req.body || {};
      const result = await this.authService.register({ name, email, password, phone });
      return res.status(201).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: err.message || 'Lỗi xử lý đăng ký'
      });
    }
  };

  /**
   * POST /api/auth/login - Đăng nhập tài khoản
   */
  login = async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await this.authService.login({ email, password });
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: err.message || 'Lỗi xử lý đăng nhập'
      });
    }
  };

  /**
   * GET /api/auth/me - Lấy thông tin cá nhân hiện tại
   */
  getMe = async (req, res) => {
    try {
      const userId = req.user?.id;
      const result = await this.authService.getMe(userId);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: err.message || 'Lỗi lấy thông tin tài khoản'
      });
    }
  };
}

