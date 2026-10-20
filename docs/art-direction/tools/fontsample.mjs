// Name-font comparison: each candidate set into ref-02 in place of the original name.
// node fontsample.mjs <ref-02.png> <out.webp>   (run where sharp, opentype.js and the @fontsource packages are installed)
import sharp from 'sharp';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { font, text, advance } from './type.mjs';

const require = createRequire(import.meta.url);
const [ref, out] = process.argv.slice(2);
const GOLD = '#e4be7f', INK = '#fcedc0', DIM = '#8f7f9e', BG = '#0a0510';
const mono = font('@fontsource/martian-mono', 'martian-mono-latin-400-normal.woff');
const monoL = font('@fontsource/martian-mono', 'martian-mono-latin-300-normal.woff');

const candidates = [
  { key: 'A', name: 'Montserrat', pkg: '@fontsource/montserrat', slug: 'montserrat', note: 'wide geometric; round O, flat-barred G; closest to ref-02' },
  { key: 'B', name: 'Jost', pkg: '@fontsource/jost', slug: 'jost', note: 'Futura lineage; narrower, sharper; classic instrument-maker feel' },
  { key: 'C', name: 'Josefin Sans', pkg: '@fontsource/josefin-sans', slug: 'josefin-sans', note: 'vintage geometric; low middle bars; most elegant, thinnest' },
];

// ref-02 geometry (source px): name caps span x 553..800, y 170..189; tagline caps x 621..722, y 201..208.
const CROP = { left: 440, top: 110, width: 396, height: 150 }, S = 2;
const NAME = { cx: (553 + 800) / 2, base: 189, cap: 19, width: 247 };
const TAG = { cx: (621 + 722) / 2, base: 208, cap: 6.2, width: 101 };
const capH = f => (f.tables.os2.sCapHeight || f.charToGlyph('H').yMax) / f.unitsPerEm;
// tracking (em) so the line spans the reference width at the reference cap height
function fit(f, str, cap, width) {
  const size = cap / capH(f);
  const plain = advance(f, str, size, 0);
  return { size, tracking: Math.max(0, (width - plain) / (size * (str.length - 1))) };
}

// fixed tracking, size solved so the line spans the reference width
function fitTracked(f, str, tracking, width) {
  const per = advance(f, str, 1, 0) + tracking * (str.length - 1);
  return { size: width / per, tracking };
}

// Base panel: the ref crop with the original type covered by sky copied from just above it.
const crop = await sharp(ref).extract(CROP).resize(CROP.width * S, CROP.height * S, { kernel: 'lanczos3' }).png().toBuffer();
const sky = await sharp(ref).extract({ left: 530, top: 112, width: 300, height: 52 }).resize(300 * S, 52 * S).blur(3).png().toBuffer();
const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${300 * S}" height="${104 * S}"><defs><filter id="f"><feGaussianBlur stdDeviation="10"/></filter></defs><rect x="22" y="22" width="${300 * S - 44}" height="${104 * S - 44}" fill="#fff" filter="url(#f)"/></svg>`);
const skyTall = await sharp(sky).resize(300 * S, 104 * S).composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
const blank = await sharp(crop).composite([{ input: skyTall, left: (530 - CROP.left) * S, top: (150 - CROP.top) * S }]).png().toBuffer();

const PW = CROP.width * S, PH = CROP.height * S, M = 48, W = 1600;
const rowH = PH + 36;
const H = 120 + (candidates.length + 1) * rowH + 30;
const layers = [];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/>`;
svg += text(mono, 'NAME + TAGLINE FONT · CANDIDATES SET INTO REF-02 AT ITS CAP HEIGHT AND LINE WIDTH', M, 64, 14, { tracking: 0.08, fill: GOLD });
svg += text(monoL, 'All three are SIL Open Font License, self-hosted from fontsource (CSP font-src self). Gold = #E4BE7F, sampled from ref-02.', M, 90, 12, { fill: DIM });

const rows = [{ key: 'REF', name: 'ref-02 (original)', note: 'the reference image, enlarged 2x' }, ...candidates];
const specs = [];
for (const [i, c] of rows.entries()) {
  const y = 120 + i * rowH;
  if (c.key === 'REF') {
    layers.push({ input: crop, left: M, top: y });
  } else {
    const light = font(c.pkg, `${c.slug}-latin-300-normal.woff`);
    const reg = font(c.pkg, `${c.slug}-latin-400-normal.woff`);
    const n = fit(reg, 'BOB CHUNG', NAME.cap * S, NAME.width * S);
    const nl = fit(light, 'BOB CHUNG', NAME.cap * S, NAME.width * S);
    const t = fitTracked(reg, 'FOLLOW THE NEEDLE', 0.36, TAG.width * S);
    const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}">`
      + text(reg, 'BOB CHUNG', (NAME.cx - CROP.left) * S, (NAME.base - CROP.top) * S, n.size, { tracking: n.tracking, anchor: 'middle', fill: GOLD })
      + text(reg, 'FOLLOW THE NEEDLE', (TAG.cx - CROP.left) * S, (TAG.base - CROP.top) * S, t.size, { tracking: t.tracking, anchor: 'middle', fill: GOLD, opacity: 0.75 })
      + '</svg>';
    layers.push({ input: await sharp(blank).composite([{ input: Buffer.from(over) }]).png().toBuffer(), left: M, top: y });
    // Specimen on the right: the name larger, then the alphabet and Dutch/Papiamento accents.
    const sx = M + PW + 40;
    const big = 46 / capH(light);
    svg += text(light, 'BOB CHUNG', sx, y + 92, big, { tracking: nl.tracking, fill: GOLD });
    svg += text(light, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', sx, y + 140, 22, { tracking: 0.12, fill: INK, opacity: 0.85 });
    svg += text(reg, 'NOORD · ROTTERDAM · ORANJESTAD · È Ò Ü Ñ IJ', sx, y + 172, 15, { tracking: 0.2, fill: DIM });
    const kb = ['300', '400'].map(w => fs.statSync(require.resolve(`${c.pkg}/files/${c.slug}-latin-${w}-normal.woff2`)).size);
    svg += text(monoL, `left: 400 (the ref weight) · right: 300 · name tracking ${n.tracking.toFixed(2)}em`, sx, y + 214, 12, { fill: DIM });
    svg += text(monoL, `latin woff2: ${(kb[0] / 1024).toFixed(1)} KB + ${(kb[1] / 1024).toFixed(1)} KB · ${c.pkg}`, sx, y + 234, 12, { fill: DIM });
    specs.push({ key: c.key, name: c.name, trackingName: +n.tracking.toFixed(3), trackingTag: +t.tracking.toFixed(3), kb: kb.map(b => +(b / 1024).toFixed(1)) });
  }
  svg += text(mono, `${c.key === 'REF' ? '' : c.key + ' · '}${c.name.toUpperCase()}`, M, y + PH + 22, 13, { tracking: 0.1, fill: INK });
  svg += text(monoL, c.note, M + 300, y + PH + 22, 12, { fill: DIM });
}
svg += '</svg>';
await sharp(Buffer.from(svg)).composite(layers).png().toFile(out);
console.log(JSON.stringify(specs));
