/**
 * The torn masks of a project's own page (spec 2026-10-29-bob-stack-2-design.md, goal 2; the mock-up Bob chose, its
 * `raggedMask`): a ragged hole in the dark the project's object is seen through, and ragged blots the next project's
 * picture dissolves into the dark through, like torn, dry-brushed paint. Drawn once at load, on a canvas, as a CSS mask.
 */

/** Smooth 2D noise, 0..1, five octaves (the mock-up's `noise2`). */
function noise2(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number): number => {
    const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const smooth = (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = x - xi;
    const v = y - yi;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  return (x, y) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < 5; o++) {
      sum += smooth(x * f, y * f) * amp;
      f *= 2;
      amp *= 0.5;
    }
    return sum / 0.96875;
  };
}

/**
 * A mask `w` x `h` as RGBA (only its alpha used): a ragged ellipse at (cx, cy) of radii (rx, ry), its edge pushed in and
 * out by 2D noise, grain tearing holes and leaving flecks where it thins; the dark round a hole (`inside` false), or a
 * blot (`inside` true). The same for the same seed.
 */
export function raggedAlpha(w: number, h: number, cx: number, cy: number, rx: number, ry: number, inside: boolean, seed: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(w * h * 4);
  const big = noise2(seed);
  const grain = noise2(seed + 19.1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      // The edge wanders in and out over broad patches, then frays in finer ones.
      const wander = (big(x / 70, y / 70) - 0.5) * 0.55 + (big(x / 22 + 40, y / 22) - 0.5) * 0.22;
      const d = Math.hypot(dx, dy) - wander;
      let a = Math.min(1, Math.max(0, (0.98 - d) / 0.22));
      // Dry brush: in the thin band the grain tears holes and leaves flecks.
      if (a > 0 && a < 1) a = Math.min(1, Math.max(0, a + (grain(x / 3.2, y / 3.2) - 0.5) * 1.3));
      const k = (y * w + x) * 4;
      out[k] = out[k + 1] = out[k + 2] = 255;
      out[k + 3] = Math.round((inside ? a : 1 - a) * 255);
    }
  }
  return out;
}

/** The masks the page uses, the mock-up's: the top's hole, the next project's blot, and an app's tall blot. */
export const MASKS = {
  hole: [720, 460, 360, 176, 260, 158, false, 3.1],
  blot: [640, 420, 320, 200, 230, 160, true, 5.7],
  tall: [320, 600, 160, 290, 150, 290, true, 8.3]
} as const;

/** `raggedAlpha` drawn on a canvas, softened a little, as a data URL for a CSS mask; null where there is no canvas. */
export function raggedMask(...[w, h, cx, cy, rx, ry, inside, seed]: readonly [number, number, number, number, number, number, boolean, number]): string | null {
  if (typeof document === 'undefined') return null;
  const pad = 8;
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d');
  if (!g) return null;
  // Drawn with a margin, so its own border never softens into a seam.
  const alpha = raggedAlpha(c.width, c.height, cx + pad, cy + pad, rx, ry, inside, seed);
  g.putImageData(new ImageData(alpha, c.width, c.height), 0, 0);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const og = out.getContext('2d');
  if (!og) return null;
  og.filter = 'blur(0.8px)';
  og.drawImage(c, -pad, -pad);
  return out.toDataURL('image/png');
}
