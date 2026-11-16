import prisma from '../server/infrastructure/db/prisma.js';

export async function ensureBannerScheduleColumns() {
  try {
    const existing = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'banners' 
        AND COLUMN_NAME IN ('start_date', 'end_date')
    `);
    const colNames = Array.isArray(existing) ? existing.map(r => r.COLUMN_NAME) : [];

    if (!colNames.includes('start_date')) {
      await prisma.$executeRawUnsafe('ALTER TABLE banners ADD COLUMN start_date DATETIME NULL;');
      console.log('✅ Added column start_date to banners table');
    }
    if (!colNames.includes('end_date')) {
      await prisma.$executeRawUnsafe('ALTER TABLE banners ADD COLUMN end_date DATETIME NULL;');
      console.log('✅ Added column end_date to banners table');
    }
  } catch (err) {
    console.warn('[Schema Notice] Note on banners columns:', err.message);
  }
}

if (process.argv[1]?.endsWith('ensure-banner-columns.js')) {
  ensureBannerScheduleColumns().finally(() => prisma.$disconnect());
}
