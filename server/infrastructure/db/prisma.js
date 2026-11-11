/**
 * prisma.js - Khởi tạo và quản lý kết nối PrismaClient (Singleton)
 * Thuộc tầng Infrastructure
 */

import { PrismaClient } from '@prisma/client';

let prismaInstance = null;

export function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }
  return prismaInstance;
}

export default getPrismaClient();

