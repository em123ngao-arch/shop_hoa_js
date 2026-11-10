/**
 * PrismaUserRepository.js - Bộ tiếp hợp kho dữ liệu User kết nối MySQL qua Prisma ORM
 * Thuộc tầng Adapters / Out / Persistence
 */

import { UserRepositoryPort } from '../../../ports/out/UserRepositoryPort.js';
import { User } from '../../../domain/models/User.js';
import { ConflictError } from '../../../domain/errors/DomainErrors.js';

export class PrismaUserRepository extends UserRepositoryPort {
  constructor(prismaClient) {
    super();
    this.prisma = prismaClient;
  }

  /**
   * Chuyển đổi bản ghi CSDL sang thực thể Domain User
   * @param {Object} raw
   * @returns {User | null}
   */
  #mapToDomain(raw) {
    if (!raw) return null;
    return new User({
      id: raw.id,
      email: raw.email,
      password_hash: raw.password_hash,
      name: raw.name,
      phone: raw.phone,
      role: raw.role,
      avatar_url: raw.avatar_url,
      is_active: raw.is_active ? 1 : 0,
      created_at: raw.created_at
    });
  }

  async findByEmail(email) {
    if (!email) return null;
    const raw = await this.prisma.users.findUnique({
      where: { email: email.trim().toLowerCase() }
    });
    return this.#mapToDomain(raw);
  }

  async findById(id) {
    if (!id) return null;
    const raw = await this.prisma.users.findUnique({
      where: { id }
    });
    return this.#mapToDomain(raw);
  }

  async create(userData) {
    try {
      const raw = await this.prisma.users.create({
        data: {
          id: userData.id,
          email: userData.email.trim().toLowerCase(),
          password_hash: userData.password_hash,
          name: userData.name.trim(),
          phone: userData.phone ? userData.phone.trim() : null,
          role: userData.role || 'customer',
          avatar_url: userData.avatar_url || null,
          is_active: userData.is_active !== undefined ? Boolean(userData.is_active) : true
        }
      });
      return this.#mapToDomain(raw);
    } catch (err) {
      if (err.code === 'P2002') {
        throw new ConflictError('Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
      }
      throw err;
    }
  }

  async update(id, updateData) {
    const data = {};
    if (updateData.name !== undefined) data.name = updateData.name.trim();
    if (updateData.phone !== undefined) data.phone = updateData.phone ? updateData.phone.trim() : null;
    if (updateData.avatar_url !== undefined) data.avatar_url = updateData.avatar_url;
    if (updateData.password_hash !== undefined) data.password_hash = updateData.password_hash;
    if (updateData.role !== undefined) data.role = updateData.role;
    if (updateData.is_active !== undefined) data.is_active = Boolean(updateData.is_active);

    const raw = await this.prisma.users.update({
      where: { id },
      data
    });
    return this.#mapToDomain(raw);
  }
}

