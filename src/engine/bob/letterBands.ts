/**
 * The two B letters made like the compass (spec 2026-10-29-bob-stack-2-design.md, goal 5; Bob: "2 · Ringen"): each
 * stroke three thin bands side by side, as the O is four rings nested round the needle, with gold rims along both edges
 * of each and the compass band's fine ticks on the outer edges. The shapes, pure: the letters' paths made dense, flat
 * strips along them and the ticks' places, on the glass (y up, as ~/engine/bob/wordmark lays them). The engraving
 * (src/engine/bob/build/engraving.ts) makes them three.js parts. It imports nothing from three.
 */
import type { Point2 } from './wordmark';

/**
 * The bands, the mock-up's (.superpowers/b-mockup/letters.ts, `rings`): `bands` are their middles across a stroke and
 * `width` each one's, `rim` the gold rims' width; a tick every `ticks.step` along the outer edges, every `longEvery`th
 * long (`long` of the reach, else `short`), the reach `reach` of a band's width, the fine ticks `fineWidth` wide and the
 * long `longWidth`; the paths made dense to `dense`; the glass, the rims and the ticks `lift` over the glass, each over
 * the last.
 */
export const RINGEN = {
  bands: [-0.14, 0, 0.14],
  width: 0.075,
  rim: 0.018,
  ticks: { step: 0.045, longEvery: 6, long: 0.62, short: 0.32, reach: 0.8, fineWidth: 0.006, longWidth: 0.011 },
  dense: 0.015,
  lift: { glass: 0.012, rim: 0.02, ticks: 0.022 }
} as const;

/** `path` with a point at least every `step` along each of its runs, its own points (the corners) kept. */
export function densePath(path: readonly Point2[], step: number): Point2[] {
  const out: Point2[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step - 1e-9));
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    out.push(b);
  }
  return out;
}

/** Whether a path ends where it starts: a B's outline, not its bar. */
const isClosed = (path: readonly Point2[]): boolean => Math.hypot(path[0]![0] - path[path.length - 1]![0], path[0]![1] - path[path.length - 1]![1]) < 1e-9;

/** The unit normal of a run from `a` to `b`: its direction turned a quarter on the glass, (−z, x). */
function normalOf(a: Point2, b: Point2): [number, number] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
}

/** Under this (1 + cos of the turn), a corner turns too sharply for a mitre, as the B's waist turns back on itself. */
const MITRE_LIMIT = 0.25;

/**
 * The offset at each point of the dense path that puts a strip's edge `d` across it at `d` × this: the mitre of its two
 * runs, so a corner stays sharp; where a run turns back on itself, the normal of the chord across the point instead.
 */
function mitres(points: readonly Point2[], closed: boolean): [number, number][] {
  const last = points.length - 1;
  return points.map((p, i) => {
    const before = i > 0 ? points[i - 1]! : closed ? points[last - 1]! : null;
    const after = i < last ? points[i + 1]! : closed ? points[1]! : null;
    if (before === null) return normalOf(p, after!);
    if (after === null) return normalOf(before, p);
    const [ax, az] = normalOf(before, p);
    const [bx, bz] = normalOf(p, after);
    const turn = 1 + ax * bx + az * bz;
    return turn > MITRE_LIMIT ? [(ax + bx) / turn, (az + bz) / turn] : normalOf(before, after);
  });
}

/**
 * A flat strip on the glass `y` up along `path` (made dense to `RINGEN.dense`), from `d0` to `d1` across it, its
 * corners mitred: two vertices to a point, `d0`'s first; uv along it 0 to 1 and across it 0 to 1; two triangles to a
 * step, facing up.
 */
export function letterStrip(path: readonly Point2[], d0: number, d1: number, y: number): { position: Float32Array; uv: Float32Array; index: Uint32Array } {
  const points = densePath(path, RINGEN.dense);
  const offsets = mitres(points, isClosed(path));
  const position = new Float32Array(points.length * 6);
  const uv = new Float32Array(points.length * 4);
  const index = new Uint32Array((points.length - 1) * 6);
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  let s = 0;
  points.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1]);
    const [nx, nz] = offsets[i]!;
    position.set([p[0] + nx * d0, y, p[1] + nz * d0, p[0] + nx * d1, y, p[1] + nz * d1], i * 6);
    uv.set([s / (total || 1), 0, s / (total || 1), 1], i * 4);
    if (i < points.length - 1) index.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
  });
  return { position, uv, index };
}

/** A tick on a band's edge: its middle on the glass, its turn about the up, its length across the band and its width along it. */
export interface TickPlace {
  at: Point2;
  /** three's turn about +y that lays a quad's x along the path: x goes to (cos, −sin). */
  angle: number;
  length: number;
  width: number;
}

/**
 * The band's ticks along `path`, on its edge `d` across it, one every `RINGEN.ticks.step` from its start, reaching
 * `inward` toward the bands' middle (every `longEvery`th `long` of it, the rest `short`).
 */
export function tickPlaces(path: readonly Point2[], d: number, inward: number): TickPlace[] {
  const { step, longEvery, long, short, fineWidth, longWidth } = RINGEN.ticks;
  const points = densePath(path, RINGEN.dense);
  const at: number[] = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]));
  const total = at[at.length - 1]!;
  const n = Math.floor(total / step + 1e-9);
  const sign = Math.sign(d) || 1;
  const out: TickPlace[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = k * step;
    while (j < points.length - 2 && at[j + 1]! <= s) j++;
    const a = points[j]!;
    const b = points[j + 1]!;
    const f = (s - at[j]!) / Math.max(1e-9, at[j + 1]! - at[j]!);
    const [nx, nz] = normalOf(a, b);
    const isLong = k % longEvery === 0;
    const length = (isLong ? long : short) * inward;
    const across = d - (sign * length) / 2;
    out.push({
      at: [a[0] + (b[0] - a[0]) * f + nx * across, a[1] + (b[1] - a[1]) * f + nz * across],
      angle: Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      length,
      width: isLong ? longWidth : fineWidth
    });
  }
  return out;
}
