// Colour helpers: sRGB <-> Lab, HSV, WCAG contrast, seeded k-means in Lab.
export const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = c => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };
export function rgb2lab([r, g, b]) {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  let x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function lab2rgb([L, a, bb]) {
  let y = (L + 16) / 116, x = a / 500 + y, z = y - bb / 200;
  const fi = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  x = fi(x) * 0.95047; y = fi(y); z = fi(z) * 1.08883;
  return [toSrgb(3.2406 * x - 1.5372 * y - 0.4986 * z), toSrgb(-0.9689 * x + 1.8758 * y + 0.0415 * z), toSrgb(0.0557 * x - 0.204 * y + 1.057 * z)];
}
export const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
export const unhex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function hsv([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx / 255];
}
export const relLum = ([r, g, b]) => 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
export const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export function kmeans(px, k, iters = 25) {
  if (px.length === 0) return [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lab = px.map(rgb2lab);
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const C = [lab[Math.floor(rnd() * lab.length)]];
  while (C.length < Math.min(k, lab.length)) {
    const ds = lab.map(p => Math.min(...C.map(c => d2(p, c))));
    const sum = ds.reduce((s, v) => s + v, 0); let t = rnd() * sum, i = 0;
    while (t > ds[i] && i < ds.length - 1) t -= ds[i++];
    C.push(lab[i]);
  }
  let asg = new Array(lab.length).fill(0);
  for (let it = 0; it < iters; it++) {
    asg = lab.map(p => { let bi = 0, bd = Infinity; C.forEach((c, j) => { const d = d2(p, c); if (d < bd) { bd = d; bi = j; } }); return bi; });
    const sums = C.map(() => [0, 0, 0, 0]);
    lab.forEach((p, i) => { const s = sums[asg[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sums.forEach((s, j) => { if (s[3]) C[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const n = C.map(() => 0); asg.forEach(a => n[a]++);
  return C.map((c, j) => ({ rgb: lab2rgb(c), lab: c, share: n[j] / lab.length })).filter(c => c.share > 0).sort((a, b) => b.share - a.share);
}
