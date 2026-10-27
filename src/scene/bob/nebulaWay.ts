/**
 * The nebula the light and the camera fly through (spec 2026-10-27-bob-nebula-space-design.md, goals 1, 2 and 8), as
 * plain numbers: how much of it shows at a pose, and where its clouds hang. Pure, as the journey and the path are: no
 * React, no three, so the tests read the very levels and places the scene draws (src/engine/bob/build/nebula.ts).
 *
 * - **The clouds** come in over the fall (way frames `CLOUDS_IN`), as the camera turns to follow the light from the
 *   side, so the light falls through the nebula; whole on the path; out with the sheet's black. Each cloud hangs at its
 *   own place and depth, about half down the fall's column and the rest round the way, so they pass at their own speeds
 *   as the camera moves: a 3D nebula, not a picture behind it. None hangs between the camera and the light in the fall
 *   (`CORRIDOR`), near a bead, or on any camera's line to what it looks at on the way: one focal point, and every fact
 *   and label readable.
 * - **The far bands**, a few engraved gold orbit bands far behind (the first mock-up's), come in over the first trip,
 *   clear of the fall's own rings.
 * - **The look back's rings**, a thin engraved ring round each bead (the beads' own, from Blender), come in over the
 *   look back, at `RINGS.level`, and go out under the sheet.
 */
import type { JourneyAt } from './journey';
import type { Path, PathFrame, Vec3 } from './lightPath';
import { smoothstep, type Span, through } from './scrollPose';

/** How much of each part shows, 0..1. */
export interface NebulaLevels {
  clouds: number;
  bands: number;
  rings: number;
}

/** One cloud: its centre (m), its width (m), its tint (0 the deep violet, 1 the wisp's), its alpha, and its texture (0-3). */
export interface CloudSpec {
  at: Vec3;
  size: number;
  tint: number;
  alpha: number;
  variant: number;
}

/** How near the fall's line, on the camera's side, no cloud hangs (m): the fall's corridor (the light and its facts). */
export const CORRIDOR = 2.8;

/**
 * The numbers (my calls, as the spec leaves them to the builder): the windows each part shows over (way frames, or a
 * part's t), how many clouds each tier lays, and where they hang.
 * - `FALL`: the fall's column, `top` to `bottom` (m), the clouds `reach` (m) out from its line, about `share` of them,
 *   their alpha times `alpha` (the facts' words stand over them);
 * - `WAY`: round the way, the projects' box grown by `margin` (m) every way, `back` (m) more behind; no cloud within
 *   `clear` (m) of a bead, nor within `sight` (m) of any camera's line to what it looks at, every `step` of the path;
 * - `SIZE`, `ALPHA`: each cloud's width (m) and alpha, between these; thin, so a cloud is a veil, never a wall.
 */
export const NEBULA = {
  CLOUDS_IN: [50, 95] as Span,
  BANDS_IN_T: [0.2, 0.7] as Span,
  RINGS: { level: 0.6, in: [0.15, 0.7] as Span },
  /** The hall's wide rings give way to the clouds over these way frames (engravedWay's hall). */
  HALL_GIVES: [70, 110] as Span,
  COUNT: { high: 140, medium: 70, low: 35 },
  FALL: { top: -1, bottom: -12, reach: [3.2, 16] as Span, share: 0.5, alpha: 0.8 },
  WAY: { margin: 7, back: 8, clear: 2, sight: 1.2, step: 0.1 },
  SIZE: [3, 9] as Span,
  ALPHA: [0.16, 0.42] as Span
} as const;

/** Smoothstep over a span. */
function over(span: Span, u: number): number {
  return smoothstep(through(u, span));
}

/**
 * Each part's level at a pose: in the light dive by its way frame (`at.frame`), on the path by its part and t (`path`,
 * null off the path).
 */
export function nebulaLevels(at: Pick<JourneyAt, 'stretch' | 'frame'>, path: Pick<PathFrame, 'part' | 'index' | 't' | 'black'> | null): NebulaLevels {
  if (at.stretch === 'light' && at.frame !== null) return { clouds: over(NEBULA.CLOUDS_IN, at.frame), bands: 0, rings: 0 };
  if (path === null) return { clouds: 0, bands: 0, rings: 0 };
  const { part, index, t, black } = path;
  if (part === 'sheet') return { clouds: 1 - black, bands: 1 - black, rings: NEBULA.RINGS.level * (1 - black) };
  const bands = part === 'travel' && index === 0 ? over(NEBULA.BANDS_IN_T, t) : 1;
  const rings = part === 'look' ? NEBULA.RINGS.level * over(NEBULA.RINGS.in, t) : 0;
  return { clouds: 1, bands, rings };
}

/** A seeded generator (mulberry32), so the clouds hang in the same places every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The distance from `p` to the segment from `a` to `b`. */
function toSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]] as const;
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const s = l2 > 0 ? Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / l2)) : 0;
  return Math.hypot(ap[0] - ab[0] * s, ap[1] - ab[1] * s, ap[2] - ab[2] * s);
}

/** Whether a cloud at `at`, `size` wide, would hang in the fall's corridor: between its camera (on +z) and the light. */
function inCorridor(at: Vec3, size: number): boolean {
  return at[1] > NEBULA.FALL.bottom - 0.5 && at[1] < 0 && at[2] > -1 - size / 2 && Math.abs(at[0]) < CORRIDOR + size / 2;
}

/**
 * Where the clouds hang for `path` on a ladder's `tier`: `NEBULA.COUNT[tier]` of them, the same for the same path every
 * time. About `FALL.share` down the fall's column, round its line; the rest round the way's box. A place is kept only
 * out of the fall's corridor, `WAY.clear` and its half width off every bead, and `WAY.sight` and its half width off the
 * line from the path's camera to the point it looks at, all along the path (`WAY.step`), the look back's included.
 */
export function cloudLayout(path: Pick<Path, 'centres' | 'frameAt' | 'lookShot'>, tier: keyof typeof NEBULA.COUNT): CloudSpec[] {
  const random = seeded(4099);
  const count = NEBULA.COUNT[tier];
  const fallCount = Math.round(count * NEBULA.FALL.share);
  const { centres } = path;

  // Every camera on the way, with what it looks at: the travels and arrivals, then the look back's.
  const sights: [Vec3, Vec3][] = [];
  for (let q = 0; q < 200; q += NEBULA.WAY.step) {
    const frame = path.frameAt(q);
    if (frame.part === 'look' || frame.part === 'sheet') break;
    sights.push([frame.shot.position as Vec3, frame.shot.target as Vec3]);
  }
  sights.push([path.lookShot.position as Vec3, path.lookShot.target as Vec3]);

  // The way's box, grown by the margin, and further back behind it.
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const c of centres) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, c[i]!);
      hi[i] = Math.max(hi[i]!, c[i]!);
    }
  }
  const { margin, back, clear, sight } = NEBULA.WAY;

  const keeps = (at: Vec3, size: number): boolean => {
    if (inCorridor(at, size)) return false;
    for (const c of centres) if (Math.hypot(at[0] - c[0], at[1] - c[1], at[2] - c[2]) <= clear + size / 2) return false;
    for (const [a, b] of sights) if (toSegment(at, a, b) <= sight + size / 2) return false;
    return true;
  };

  const clouds: CloudSpec[] = [];
  const lay = (place: () => Vec3, until: number, thin = 1): void => {
    for (let tries = 0; clouds.length < until && tries < until * 400; tries++) {
      const at = place();
      const size = lerp(NEBULA.SIZE[0], NEBULA.SIZE[1], random() ** 1.5);
      const tint = random();
      const alpha = lerp(NEBULA.ALPHA[0], NEBULA.ALPHA[1], random()) * thin;
      const variant = Math.min(3, Math.floor(random() * 4));
      if (keeps(at, size)) clouds.push({ at, size, tint, alpha, variant });
    }
  };
  // Down the fall's column, round its line.
  lay(() => {
    const y = lerp(NEBULA.FALL.top, NEBULA.FALL.bottom, random());
    const th = random() * Math.PI * 2;
    const r = lerp(NEBULA.FALL.reach[0], NEBULA.FALL.reach[1], Math.sqrt(random()));
    return [Math.cos(th) * r, y, Math.sin(th) * r];
  }, fallCount, NEBULA.FALL.alpha);
  // Round the way.
  lay(() => [lerp(lo[0] - margin, hi[0] + margin, random()), lerp(lo[1] - margin, hi[1] + margin, random()), lerp(lo[2] - margin - back, hi[2] + margin, random())], count);
  return clouds;
}
