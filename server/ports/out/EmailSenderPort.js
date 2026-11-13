/** Cổng gửi thư cho application; provider email được thay thế độc lập với nghiệp vụ. */
export class EmailSenderPort {
  async sendPasswordResetEmail({ email, resetUrl, expiresAt }) {
    throw new Error('Phương thức sendPasswordResetEmail() chưa được triển khai');
  }

  async sendPasswordChangedEmail({ email }) {
    throw new Error('Phương thức sendPasswordChangedEmail() chưa được triển khai');
  }
}
