// Renders the raster app icons (Apple touch icon, PWA icons) from
// public/favicon.svg, the ping-pong ball monogram, using sharp (already
// installed with Astro). The results are committed; pass --force to
// regenerate them after changing the SVG.
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (name) => join(root, 'public', name);
const force = process.argv.includes('--force');

const svg = await readFile(pub('favicon.svg'), 'utf8');
// Maskable icons are cropped to a circle or squircle by the OS, so that
// version fills the whole square and keeps the ball inside the safe zone.
const fullBleed = svg
  .replace('<rect width="64" height="64" rx="14" fill="#1c1030"/>', '<rect width="64" height="64" fill="#1c1030"/><g transform="translate(32 32) scale(0.82) translate(-32 -32)">')
  .replace('</svg>', '</g></svg>');

const outputs = [
  { file: 'apple-touch-icon.png', size: 180, source: fullBleed },
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'icon-maskable-512.png', size: 512, source: fullBleed }
];

for (const { file, size, source } of outputs) {
  const exists = await access(pub(file)).then(() => true, () => false);
  if (exists && !force) {
    console.log(`[icons] public/${file} exists (use --force to regenerate)`);
    continue;
  }
  await sharp(Buffer.from(source), { density: (72 * size) / 64 }).resize(size, size).png({ compressionLevel: 9 }).toFile(pub(file));
  console.log(`[icons] wrote public/${file}`);
}
