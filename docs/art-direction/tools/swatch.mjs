// Renders the palette board from palette.json plus the proposed country accents.
// node swatch.mjs <palette.json> <out.png>   (needs sharp, opentype.js, @fontsource/martian-mono and @fontsource/unbounded)
import sharp from 'sharp';
import fs from 'node:fs';
import { font, text } from './type.mjs';
import { unhex, contrast, rgb2lab } from './colour.mjs';

const [src, out] = process.argv.slice(2);
const pal = JSON.parse(fs.readFileSync(src, 'utf8'));
const tok = Object.fromEntries(pal.tokens.map(t => [t.id, t]));
const mono = font('@fontsource/martian-mono', 'martian-mono-latin-400-normal.woff');
const monoL = font('@fontsource/martian-mono', 'martian-mono-latin-300-normal.woff');
const head = font('@fontsource/unbounded', 'unbounded-latin-700-normal.woff');

const short = s => s.replace(/^(ref-0\d).*/, '$1');
const sampled = id => ({ id, hex: tok[id].hex, src: short(tok[id].source) });
const proposed = (id, hex, from) => ({ id, hex, src: from });
const rows = [
  ['VOID + ATMOSPHERE', ['void-1', 'void-0', 'nebula-deep', 'lacquer-purple', 'pcb-purple', 'nebula', 'nebula-hi', 'platter', 'lacquer-hi', 'field-violet'].map(sampled)],
  ['BRASS + GOLD (lit surfaces, type)', ['dial-black', 'brass-shadow', 'brass', 'sun-halo', 'brass-hi', 'gold-type', 'tagline', 'gold-title'].map(sampled)],
  ['GLOW (emissive only)', ['amber-spill', 'gold-glow', 'gold-core', 'label-ink', 'platter-hi', 'sun'].map(sampled)],
  ['COUNTRY ACCENTS (proposed, one per arm)', [
    proposed('cn-cinnabar', '#a8352a', 'string-red, lifted'),
    proposed('cn-cinnabar-hi', '#d0563c', 'lacquer edge'),
    proposed('cn-gold-ink', tok['gold-type'].hex, '= gold-type'),
    proposed('nl-delft-deep', '#123a72', 'cobalt, in recesses'),
    proposed('nl-delft', '#1d5fa8', 'cobalt enamel'),
    proposed('nl-glaze', '#e8edf5', 'tin glaze'),
    proposed('aw-sea-deep', '#0c6467', 'reef shelf'),
    proposed('aw-sea', '#2db3a8', 'shallows'),
    proposed('aw-gold', '#f2b950', 'warm sun'),
  ]],
];

const W = 1600, M = 50, SW = 140, SH = 96, GAP = 10, ROWH = 200;
const H = 150 + rows.length * ROWH + 40;
const bg = tok['void-0'].hex, ink = tok['label-ink'].hex, dim = '#8f7f9e';
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>`;
svg += text(head, 'FOLLOW THE NEEDLE', M, 78, 34, { tracking: 0.04, fill: tok['gold-title'].hex });
svg += text(mono, 'PALETTE SAMPLED FROM REF-01 … REF-05 (MEDIAN IN LAB OF A MASKED REGION)', M, 112, 13, { tracking: 0.08, fill: dim });
rows.forEach(([title, items], r) => {
  const y0 = 150 + r * ROWH;
  svg += text(mono, title, M, y0 + 14, 13, { tracking: 0.12, fill: tok['gold-type'].hex });
  items.forEach((it, i) => {
    const x = M + i * (SW + GAP), y = y0 + 30;
    const rgb = unhex(it.hex);
    const ring = rgb2lab(rgb)[0] < 12 ? `stroke="#3a2a48" stroke-width="1"` : '';
    svg += `<rect x="${x}" y="${y}" width="${SW}" height="${SH}" rx="3" fill="${it.hex}" ${ring}/>`;
    const cr = contrast(rgb, unhex(bg));
    svg += text(mono, it.hex.toUpperCase(), x + 8, y + SH - 10, 11, { fill: rgb2lab(rgb)[0] > 60 ? '#160b1c' : '#f3e7ce', opacity: 0.85 });
    svg += text(mono, it.id, x, y + SH + 20, 12, { fill: ink });
    svg += text(monoL, it.src, x, y + SH + 37, 10, { fill: dim });
    svg += text(monoL, `${cr.toFixed(1)}:1 on void-0`, x, y + SH + 53, 10, { fill: dim });
  });
});
svg += text(monoL, 'n:1 = WCAG contrast against void-0. Glow tokens are emissive colours for the scene, not text colours.', M, H - 26, 11, { fill: dim });
svg += '</svg>';
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
