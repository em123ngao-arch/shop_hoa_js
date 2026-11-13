/**
 * PasswordResetRepositoryPort - cổng dữ liệu cho token khôi phục mật khẩu.
 * Application chỉ gọi các thao tác nghiệp vụ, không phụ thuộc Prisma.
 */
export class PasswordResetRepositoryPort {
  async createToken(tokenData) {
    throw new Error('Phương thức createToken() chưa được triển khai');
  }

  async invalidateToken(tokenId, now) {
    throw new Error('Phương thức invalidateToken() chưa được triển khai');
  }

  async findValidToken(tokenHash, now) {
    throw new Error('Phương thức findValidToken() chưa được triển khai');
  }

  async consumeTokenAndChangePassword(changeData) {
    throw new Error('Phương thức consumeTokenAndChangePassword() chưa được triển khai');
  }
}
