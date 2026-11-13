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
      setSessionCookie(res, result.token, false);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(201).json({ success: true, message: result.message, user: result.user });
    } catch (err) {
      return sendAuthError(res, err, 'Không thể hoàn tất đăng ký lúc này.');
    }
  };

  /**
   * POST /api/auth/login - Đăng nhập tài khoản
   */
  login = async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body || {};
      const shouldRemember = rememberMe === true;
      const result = await this.authService.login({ email, password, rememberMe: shouldRemember });
      setSessionCookie(res, result.token, shouldRemember);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ success: true, message: result.message, user: result.user });
    } catch (err) {
      return sendAuthError(res, err, 'Không thể hoàn tất đăng nhập lúc này.');
    }
  };

  /** POST /api/auth/logout - Xóa cookie phiên đăng nhập phía trình duyệt. */
  logout = (req, res) => {
    res.clearCookie('shophoa_session', sessionCookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, message: 'Đã đăng xuất' });
  };

  /** POST /api/auth/logout-all - Vô hiệu hóa phiên hiện tại và mọi phiên khác. */
  logoutAllDevices = async (req, res) => {
    try {
      const result = await this.authService.logoutAllDevices(req.user?.id);
      res.clearCookie('shophoa_session', sessionCookieOptions());
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(result);
    } catch (err) {
      return sendAuthError(res, err, 'Không thể đóng các phiên lúc này.');
    }
  };

  /** POST /api/auth/forgot-password - Luôn trả nội dung chung để tránh dò email. */
  forgotPassword = async (req, res) => {
    try {
      const result = await this.authService.forgotPassword(req.body?.email);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(result);
    } catch (err) {
      return sendAuthError(res, err, 'Không thể xử lý yêu cầu lúc này.');
    }
  };

  /** POST /api/auth/reset-password - Token chỉ dùng một lần; reset buộc đăng nhập lại. */
  resetPassword = async (req, res) => {
    try {
      const result = await this.authService.resetPassword({
        token: req.body?.token,
        newPassword: req.body?.newPassword
      });
      res.clearCookie('shophoa_session', sessionCookieOptions());
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(result);
    } catch (err) {
      return sendAuthError(res, err, 'Không thể đặt lại mật khẩu lúc này.');
    }
  };

  /**
   * GET /api/auth/me - Lấy thông tin cá nhân hiện tại
   */
  getMe = async (req, res) => {
    try {
      const userId = req.user?.id;
      const result = await this.authService.getMe(userId);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(result);
    } catch (err) {
      return sendAuthError(res, err, 'Không thể tải thông tin tài khoản lúc này.');
    }
  };
}

const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}

function setSessionCookie(res, token, rememberMe) {
  const options = sessionCookieOptions();
  if (rememberMe) options.maxAge = REMEMBER_ME_MS;
  res.cookie('shophoa_session', token, options);
}

function sendAuthError(res, err, fallbackMessage) {
  const status = Number(err?.statusCode) || 500;
  const isServerError = status >= 500;
  if (isServerError) console.error('[AuthController] Request failed:', err?.code || err?.name || 'INTERNAL_ERROR');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({
    error: {
      code: isServerError ? 'INTERNAL_ERROR' : (err?.code || 'AUTH_ERROR'),
      message: isServerError ? fallbackMessage : (err?.message || fallbackMessage)
    }
  });
}

