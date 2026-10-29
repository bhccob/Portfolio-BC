// The torn masks of a project's own page (spec 2026-10-29-bob-stack-2-design.md, goal 2): drawn once, ahead of time,
// from src/ui/tornMask.ts `raggedAlpha` (the mock-up's raggedMask), softened a little, as PNGs the page's CSS masks with,
// so nothing is drawn as the page loads.
//
//   npx tsx tools/masks.ts <to folder>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { MASKS, raggedAlpha } from '../src/ui/tornMask';

const [to] = process.argv.slice(2);
if (!to) {
  console.error('usage: npx tsx tools/masks.ts <to folder>');
  process.exit(2);
}
mkdirSync(to, { recursive: true });
/** Drawn with a margin, so the mask's own border never softens into a seam. */
const PAD = 8;
for (const [name, [w, h, cx, cy, rx, ry, inside, seed]] of Object.entries(MASKS)) {
  const width = w + PAD * 2;
  const height = h + PAD * 2;
  const alpha = raggedAlpha(width, height, cx + PAD, cy + PAD, rx, ry, inside, seed);
  const out = join(to, `${name}.png`);
  const info = await sharp(Buffer.from(alpha.buffer), { raw: { width, height, channels: 4 } })
    .blur(0.8)
    .extract({ left: PAD, top: PAD, width: w, height: h })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`${out}: ${info.width} x ${info.height}, ${Math.round(info.size / 1024)} kB`);
}
