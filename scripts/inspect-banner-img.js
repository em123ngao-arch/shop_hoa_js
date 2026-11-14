import sharp from 'sharp';

async function run() {
  const meta = await sharp('uploads/banners/banner-mwd470z9-6nct.webp').metadata();
  console.log('20/11 banner metadata:', meta);
}
run();

