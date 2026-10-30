// Turns the storm plates rendered by tools/blender/storm_plates.py into the site's WebP files (round 8, spec
// 2026-10-30-bob-moonlit-3d-design.md): wall, sea and bank at full size (the bank keeping its alpha), the two flash
// plates at half (their glow is soft). All five stay within 1.2 MB together (tests/unit/bob/storm-assets.test.ts).
//   node tools/storm_webp.mjs <dir with wall.png, sea.png, bank.png, wall-flash.png, bank-flash.png> src/assets/storm
import { statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error('usage: node tools/storm_webp.mjs <rendered dir> <out dir>');
  process.exit(1);
}
const QUALITY = 82;
const PLATES = [
  { name: 'wall', size: [2688, 1152], alpha: false },
  { name: 'sea', size: [2688, 1152], alpha: false },
  { name: 'bank', size: [2688, 1152], alpha: true },
  { name: 'wall-flash', size: [1344, 576], alpha: false },
  { name: 'bank-flash', size: [1344, 576], alpha: false }
];

let total = 0;
for (const { name, size, alpha } of PLATES) {
  let image = sharp(join(from, `${name}.png`)).resize(size[0], size[1], { fit: 'fill' });
  if (!alpha) image = image.flatten({ background: '#000000' });
  const out = join(to, `storm-${name}.webp`);
  await image.webp({ quality: QUALITY, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(out);
  const bytes = statSync(out).size;
  total += bytes;
  console.log(`storm-${name}.webp ${size.join(' x ')} ${(bytes / 1024).toFixed(0)} kB`);
}
console.log(`total ${(total / 1024).toFixed(0)} kB of 1172 kB`);
