import nodemailer from 'nodemailer';
import { EmailSenderPort } from '../../../ports/out/EmailSenderPort.js';

/** Adapter Nodemailer gửi email khôi phục; log chỉ chứa mã lỗi, không chứa PII hoặc token. */
export class SmtpEmailAdapter extends EmailSenderPort {
  constructor(config = {}) {
    super();
    this.from = config.mailFrom || '';
    const isConfigured = Boolean(config.smtpHost && config.smtpUser && config.smtpPass && this.from);
    this.transporter = isConfigured
      ? nodemailer.createTransport({
          host: config.smtpHost,
          port: Number(config.smtpPort) || 587,
          secure: Number(config.smtpPort) === 465,
          auth: { user: config.smtpUser, pass: config.smtpPass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000
        })
      : null;

    if (!this.transporter) {
      console.warn('[EmailService] SMTP chưa được cấu hình; email xác thực sẽ không được gửi.');
    }
  }

  async sendPasswordResetEmail({ email, resetUrl, expiresAt }) {
    if (!this.transporter) return { sent: false };
    try {
      const expiryLabel = new Date(expiresAt).toLocaleString('vi-VN');
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Đặt lại mật khẩu Tiệm Hoa Kẽm Nhung',
        text: `Bạn vừa yêu cầu đặt lại mật khẩu. Mở liên kết an toàn này trong 30 phút: ${resetUrl}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
        html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p><a href="${escapeAttribute(resetUrl)}">Đặt lại mật khẩu</a></p><p>Liên kết hết hạn lúc ${escapeHtml(expiryLabel)}.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`
      });
      return { sent: true };
    } catch (error) {
      console.error('[EmailService] SMTP send failed:', error.code || 'SMTP_ERROR');
      return { sent: false };
    }
  }

  async sendPasswordChangedEmail({ email }) {
    if (!this.transporter) return { sent: false };
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Mật khẩu tài khoản vừa được thay đổi',
        text: 'Mật khẩu tài khoản Tiệm Hoa Kẽm Nhung vừa được thay đổi. Nếu không phải bạn, hãy liên hệ bộ phận hỗ trợ.'
      });
      return { sent: true };
    } catch (error) {
      console.error('[EmailService] Security notice send failed:', error.code || 'SMTP_ERROR');
      return { sent: false };
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
