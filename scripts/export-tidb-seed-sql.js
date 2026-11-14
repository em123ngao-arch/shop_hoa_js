import prisma from '../server/infrastructure/db/prisma.js';
import fs from 'fs';

async function main() {
  const prods = await prisma.products.findMany();
  const sqlLines = [
    '-- TiDB Sync Metadata Script for Products',
    '-- Run this in TiDB Cloud SQL Editor if you wish to sync all 19 products metadata',
    'USE shop_hoa_db;'
  ];
  for (const p of prods) {
    const col = p.color || 'ket-hop';
    const flw = p.flower_type || 'khac';
    const occ = p.occasion || 'tat-ca';
    const mat = p.material || 'kem-nhung';
    sqlLines.push(`UPDATE products SET color = '${col}', flower_type = '${flw}', occasion = '${occ}', material = '${mat}' WHERE id = '${p.id}';`);
  }
  fs.writeFileSync('prisma/migrations_tidb/update_product_rows.sql', sqlLines.join('\n'), 'utf8');
  console.log('Saved prisma/migrations_tidb/update_product_rows.sql with', prods.length, 'updates.');
  process.exit(0);
}
main().catch(console.error);
