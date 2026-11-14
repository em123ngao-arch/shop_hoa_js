/**
 * prisma.js - Khởi tạo và quản lý kết nối PrismaClient (Singleton)
 * Thuộc tầng Infrastructure
 */

import { PrismaClient } from '@prisma/client';

let prismaInstance = null;

export function getPrismaClient() {
  if (!prismaInstance) {
    let url = process.env.DATABASE_URL;
    if (url && url.includes('tidbcloud.com') && !url.includes('sslaccept=') && !url.includes('ssl=')) {
      url += (url.includes('?') ? '&' : '?') + 'sslaccept=strict';
      process.env.DATABASE_URL = url;
    }
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }
  return prismaInstance;
}

export default getPrismaClient();

