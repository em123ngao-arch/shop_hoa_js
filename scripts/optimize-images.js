import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function run() {
  const dir = 'public/images';
  const files = fs.readdirSync(dir);
  let totalOrig = 0;
  let totalWebp = 0;

  for (const f of files) {
    if (f.endsWith('.png') || f.endsWith('.jpg')) {
      const origPath = path.join(dir, f);
      const nameWithoutExt = f.replace(/\.(png|jpg)$/i, '');
      const outPath = path.join(dir, nameWithoutExt + '.webp');
      
      const stat = fs.statSync(origPath);
      totalOrig += stat.size;

      const isBanner = f.includes('banner') || f.includes('Lunar');
      const quality = isBanner ? 85 : 80;

      await sharp(origPath)
        .webp({ quality, effort: 4 })
        .toFile(outPath);

      const newStat = fs.statSync(outPath);
      totalWebp += newStat.size;
      const savedPct = Math.round((1 - newStat.size / stat.size) * 100);
      console.log(`Compressed: ${f} (${(stat.size / 1024 / 1024).toFixed(2)} MB) -> ${nameWithoutExt}.webp (${(newStat.size / 1024).toFixed(1)} KB) [${savedPct}% saved]`);
    }
  }

  const overallSaved = Math.round((1 - totalWebp / totalOrig) * 100);
  console.log(`\n🎉 TOTAL: ${(totalOrig / 1024 / 1024).toFixed(2)} MB -> ${(totalWebp / 1024 / 1024).toFixed(2)} MB (${overallSaved}% REDUCTION!)`);
}

run().catch(console.error);
