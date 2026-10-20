// Samples palette tokens from the five reference images.
// node palette.mjs <references dir> <out dir>   (writes palette.json and debug overlays; needs sharp)
import sharp from 'sharp';
import fs from 'node:fs';
import { kmeans, hex, hsv, rgb2lab, lab2rgb } from './colour.mjs';

const [dir, out] = process.argv.slice(2);
const files = { r1: 'ref-01-chip-loader', r2: 'ref-02-hero-compass', r3: 'ref-03-compass-to-harddrive', r4: 'ref-04-platter-test-points', r5: 'ref-05-abacus-phone' };
const img = {};
for (const [k, f] of Object.entries(files)) {
  const { data, info } = await sharp(`${dir}/${f}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  img[k] = { data, w: info.width, h: info.height, file: f };
}

function pixels(k, [x0, y0, x1, y1], pred = () => true, step = 1) {
  const { data, w } = img[k], px = [];
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * w + x) * 3, p = [data[i], data[i + 1], data[i + 2]];
    if (pred(p)) px.push(p);
  }
  return px;
}
// Per-channel median in Lab: the typical colour of a filtered set.
function median(px) {
  const lab = px.map(rgb2lab);
  return lab2rgb([0, 1, 2].map(a => { const v = lab.map(p => p[a]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; }));
}
// Median of the brightest fraction: the lit end of a set (glows, highlights).
const top = (px, frac) => median([...px].sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2])).slice(0, Math.max(1, Math.round(px.length * frac))));

const H = p => hsv(p)[0], S = p => hsv(p)[1], V = p => hsv(p)[2];
const purple = p => H(p) >= 250 && H(p) <= 300 && S(p) > 0.35;
const gold = p => H(p) >= 25 && H(p) <= 55 && S(p) > 0.4;

const report = { dominant: {}, tokens: [] };
for (const k of Object.keys(img)) {
  const { w, h } = img[k];
  report.dominant[img[k].file] = kmeans(pixels(k, [0, 0, w, h], () => true, 3), 7).map(c => ({ hex: hex(c.rgb), share: +c.share.toFixed(3) }));
}

// Each region is [x0, y0, x1, y1] in source pixels and is outlined on debug-<ref>.png.
const T = (id, k, box, pred, how, note) => {
  const px = pixels(k, box, pred);
  const rgb = how === 'median' ? median(px) : top(px, how);
  report.tokens.push({ id, hex: hex(rgb), source: img[k].file, box, n: px.length, note, k });
};
T('void-0', 'r2', [640, 10, 830, 120], () => true, 'median', 'empty sky right of the name');
T('void-1', 'r4', [0, 330, 140, 470], p => V(p) < 0.5, 'median', 'shadowed chassis, bottom left');
T('nebula-deep', 'r2', [0, 260, 140, 460], purple, 'median', 'nebula body, lower left');
T('nebula', 'r2', [380, 300, 720, 460], purple, 0.15, 'lit nebula wisps under the compass');
T('field-violet', 'r3', [470, 80, 650, 320], p => purple(p) && V(p) > 0.55, 0.3, 'magnetic field lines off the platter');
T('pcb-purple', 'r1', [0, 120, 160, 255], purple, 'median', 'PCB solder mask');
T('lacquer-purple', 'r5', [170, 0, 255, 160], p => H(p) >= 240 && H(p) <= 310 && S(p) > 0.2, 'median', 'abacus bead lacquer');
T('dial-black', 'r2', [190, 90, 430, 280], p => V(p) < 0.25 && !gold(p), 'median', 'dial face between engravings');
T('brass-shadow', 'r3', [40, 80, 400, 400], p => H(p) >= 15 && H(p) <= 50 && S(p) > 0.35 && V(p) < 0.35, 'median', 'compass body in shadow');
T('brass', 'r3', [40, 80, 400, 400], p => gold(p) && V(p) >= 0.35, 'median', 'compass body, lit brass');
T('brass-hi', 'r2', [90, 40, 500, 380], gold, 0.08, 'rim and engraving highlights');
T('gold-type', 'r2', [550, 165, 805, 195], p => gold(p) && V(p) > 0.55, 'median', 'BOB CHUNG letterforms');
T('gold-title', 'r4', [33, 92, 322, 132], p => gold(p) && V(p) > 0.55, 'median', 'FUNCIAL title');
T('gold-glow', 'r4', [200, 180, 500, 330], p => gold(p) && V(p) > 0.8, 'median', 'track glow');
T('amber-spill', 'r1', [160, 120, 340, 175], p => H(p) >= 20 && H(p) <= 50 && V(p) > 0.75, 'median', 'light under the probed chip');
T('gold-core', 'r4', [200, 180, 500, 330], p => V(p) > 0.9, 0.2, 'hottest part of the track');
T('sun', 'r2', [712, 392, 734, 412], () => true, 0.1, 'distant sun core');
T('sun-halo', 'r2', [700, 380, 746, 424], p => gold(p) && V(p) < 0.8, 'median', 'sun halo');
T('string-red', 'r2', [100, 50, 500, 360], p => (H(p) <= 12 || H(p) >= 345) && S(p) > 0.55 && V(p) > 0.35, 'median', 'red sighting strings');
T('platter', 'r4', [600, 200, 840, 320], p => V(p) > 0.35, 'median', 'spindle and platter metal');
T('label-ink', 'r4', [250, 155, 480, 300], p => S(p) < 0.35 && V(p) > 0.7, 'median', 'TP caption text');
T('nebula-hi', 'r2', [380, 300, 720, 460], purple, 0.02, 'brightest nebula wisps');
T('lacquer-hi', 'r5', [170, 0, 255, 160], p => H(p) >= 240 && H(p) <= 310 && S(p) > 0.2, 0.1, 'lit side of the lacquer beads');
T('platter-hi', 'r4', [600, 200, 840, 320], () => true, 0.05, 'specular on the platter and spindle');
T('tagline', 'r2', [615, 199, 730, 211], p => V(p) > 0.45, 'median', 'FOLLOW THE NEEDLE letterforms');

fs.writeFileSync(`${out}/palette.json`, JSON.stringify(report, null, 2));
for (const t of report.tokens) console.log(t.id.padEnd(15), t.hex, String(t.n).padStart(6), `${t.source} [${t.box}]`, t.note);
for (const [f, d] of Object.entries(report.dominant)) console.log(f, d.map(c => `${c.hex} ${(c.share * 100).toFixed(0)}%`).join('  '));

for (const k of Object.keys(img)) {
  const boxes = report.tokens.filter(t => t.k === k);
  if (!boxes.length) continue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${img[k].w}" height="${img[k].h}">${boxes.map(b => `<rect x="${b.box[0]}" y="${b.box[1]}" width="${b.box[2] - b.box[0]}" height="${b.box[3] - b.box[1]}" fill="none" stroke="#0f0" stroke-width="1.5"/><text x="${b.box[0] + 3}" y="${b.box[1] + 11}" font-size="10" font-family="Arial" fill="#0f0">${b.id}</text>`).join('')}</svg>`;
  await sharp(`${dir}/${img[k].file}.png`).composite([{ input: Buffer.from(svg) }]).png().toFile(`${out}/debug-${k}.png`);
}
