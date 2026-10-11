// Renders the 1200×630 social preview image (public/og.png) from an SVG
// template plus the portrait, using sharp (already installed with Astro).
// The result is committed; pass --force to regenerate it.
import { access, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'public', 'og.png');
const portraitPath = join(root, 'src', 'assets', 'portrait.jpg');
const force = process.argv.includes('--force');

const exists = await access(output).then(() => true, () => false);
if (exists && !force) {
  console.log('[og] public/og.png exists (use --force to regenerate)');
  process.exit(0);
}

const W = 1200;
const H = 630;
const portraitWidth = 420;

const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0V56" fill="none" stroke="#b3a5d4" stroke-opacity="0.07"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#150b26"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
</svg>`;

const fade = `
<svg xmlns="http://www.w3.org/2000/svg" width="${portraitWidth}" height="${H}">
  <defs>
    <linearGradient id="f" x1="0" x2="1">
      <stop offset="0" stop-color="#150b26" stop-opacity="1"/>
      <stop offset="0.5" stop-color="#150b26" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#f)"/>
</svg>`;

// The departures board: Bahnschrift Condensed (Windows) stands in for the
// site's Sofia Sans Extra Condensed, which the SVG renderer cannot load.
const foreground = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    .mono { font-family: 'Cascadia Mono', Consolas, 'DejaVu Sans Mono', monospace; font-weight: 600; letter-spacing: 3px; }
    .flap { font-family: 'Bahnschrift Condensed', 'Bahnschrift', 'Arial Narrow', 'DejaVu Sans Condensed', sans-serif; font-weight: 700; }
    .sans { font-family: 'Segoe UI', 'DejaVu Sans', sans-serif; }
  </style>
  <text x="58" y="100" class="mono" font-size="17" fill="#ffcf33">DEPARTURES</text>
  <text x="220" y="100" class="mono" font-size="17" fill="#b3a5d4">VERTREK · SALIDA</text>
  <g transform="translate(56 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">B</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(140 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">O</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(224 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">B</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(348 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">C</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(432 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">H</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(516 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">U</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(600 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">N</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <g transform="translate(684 150)"><rect width="78" height="112" rx="5" fill="#221539"/><rect y="56" width="78" height="56" rx="5" fill="#1a1030"/><text x="39" y="96" class="flap" font-size="98" text-anchor="middle" fill="#ffcf33">G</text><rect y="54.5" width="78" height="3" fill="#070310"/></g>
  <path d="M56 286H760M56 279v14M760 279v14" stroke="#ffcf33" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="58" y="350" class="flap" font-size="40" fill="#ffcf33" letter-spacing="6">STUDENT SOFTWARE ENGINEER</text>
  <text x="58" y="398" class="flap" font-size="40" fill="#b3a5d4" letter-spacing="6">ROTTERDAM · NL</text>
  <g class="mono" font-size="16">
    <text x="58" y="480" fill="#ffcf33">#01  COOKIES CLICKER</text><text x="420" y="480" fill="#ffcf33">DEPARTED</text>
    <text x="58" y="516" fill="#ffcf33">#02  JONTAI ENERGY</text><text x="420" y="516" fill="#ffcf33">DEPARTED</text>
    <text x="58" y="552" fill="#9283b8">#03  NEXT BUILD</text><text x="420" y="552" fill="#9283b8">BOARDING SOON</text>
  </g>
  <text x="58" y="600" class="mono" font-size="15" fill="#9283b8">BHCCOB.ME</text>
</svg>`;

const portrait = await sharp(portraitPath).resize(portraitWidth, H, { fit: 'cover', position: 'north' }).modulate({ saturation: 0.75 }).toBuffer();

await mkdir(dirname(output), { recursive: true });
await sharp(Buffer.from(background))
  .composite([
    { input: portrait, left: W - portraitWidth, top: 0 },
    { input: Buffer.from(fade), left: W - portraitWidth, top: 0 },
    { input: Buffer.from(foreground), left: 0, top: 0 }
  ])
  .png({ compressionLevel: 9 })
  .toFile(output);

console.log('[og] wrote public/og.png');
