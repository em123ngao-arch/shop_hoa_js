import { PasswordResetRepositoryPort } from '../../../ports/out/PasswordResetRepositoryPort.js';

/** Adapter Prisma cho vòng đời token reset, gồm thao tác tiêu thụ một lần trong transaction. */
export class PrismaPasswordResetRepository extends PasswordResetRepositoryPort {
  constructor(prismaClient) {
    super();
    this.prisma = prismaClient;
  }

  async createToken(tokenData) {
    return this.prisma.$transaction(async (tx) => {
      await tx.password_reset_tokens.updateMany({
        where: { user_id: tokenData.user_id, used_at: null },
        data: { used_at: new Date() }
      });
      return tx.password_reset_tokens.create({ data: tokenData });
    });
  }

  async invalidateToken(tokenId, now) {
    return this.prisma.password_reset_tokens.updateMany({
      where: { id: tokenId, used_at: null },
      data: { used_at: now }
    });
  }

  async findValidToken(tokenHash, now) {
    return this.prisma.password_reset_tokens.findFirst({
      where: { token_hash: tokenHash, used_at: null, expires_at: { gt: now } },
      include: { users: { select: { email: true } } }
    });
  }

  async consumeTokenAndChangePassword({ tokenId, userId, passwordHash, now }) {
    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.password_reset_tokens.updateMany({
        where: { id: tokenId, user_id: userId, used_at: null, expires_at: { gt: now } },
        data: { used_at: now }
      });
      if (consumed.count !== 1) return false;

      await tx.users.update({
        where: { id: userId },
        data: { password_hash: passwordHash, token_version: { increment: 1 } }
      });
      await tx.password_reset_tokens.updateMany({
        where: { user_id: userId, used_at: null },
        data: { used_at: now }
      });
      return true;
    });
  }
}
