/**
 * The nebula the light and the camera fly through (spec 2026-10-27-bob-nebula-space-design.md, goals 1, 2 and 8), as
 * plain numbers: how much of it shows at a pose, and where its clouds hang. Pure, as the journey and the path are: no
 * React, no three, so the tests read the very levels and places the scene draws (src/engine/bob/build/nebula.ts).
 *
 * - **The clouds** come in over the fall (way frames `CLOUDS_IN`), as the camera turns to follow the light from the
 *   side, so the light falls through the nebula, at `FALL_LEVEL` behind Bob's facts (their words stay readable); they
 *   come up to whole over the first trip (by `WHOLE_BY_T`), and go out with the sheet's black. Each cloud hangs at its
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
import { AREA_STOP } from '~/state/chapters';
import { OPEN_LOOK } from './inside';
import type { WorldFrame, WorldPath } from './worldPath';

type Vec3 = [number, number, number];
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
 * - `WORLD`: round the hologram world (spec 2026-10-27-bob-hologram-world-design.md, the mock-up's layout), `reach`
 *   (m) out from the board's centre, `above` and `below` it (m); none over the board (`board` m out, `height` m up or
 *   down), nor within `sight` (m) of any view's line from its camera to what it looks at;
 * - `SIZE`, `ALPHA`: each cloud's width (m) and alpha, between these; thin, so a cloud is a veil, never a wall.
 */
export const NEBULA = {
  CLOUDS_IN: [50, 95] as Span,
  /** How much of the nebula shows in the fall, behind the facts, and by when on the first trip it is whole. */
  FALL_LEVEL: 0.6,
  WHOLE_BY_T: 0.5,
  BANDS_IN_T: [0.2, 0.7] as Span,
  RINGS: { level: 0.6, in: [0.15, 0.7] as Span },
  /**
   * The clouds' level on the world (spec 2026-10-27-bob-hologram-world-design.md, the mock-up's): at the world's stop
   * and the look back, and at an area, quieter, so the area's project stands out.
   */
  WORLD_LEVEL: { world: 0.8, area: 0.55 },
  /** The hall's wide rings give way to the clouds over these way frames (engravedWay's hall). */
  HALL_GIVES: [70, 110] as Span,
  COUNT: { high: 140, medium: 70, low: 35 },
  FALL: { top: -1, bottom: -12, reach: [3.2, 16] as Span, share: 0.5, alpha: 0.8 },
  WORLD: { reach: [7, 34] as Span, above: 8, below: 16, board: 7, height: 4, sight: 1.2 },
  SIZE: [3, 9] as Span,
  ALPHA: [0.16, 0.42] as Span
} as const;

/** Smoothstep over a span. */
function over(span: Span, u: number): number {
  return smoothstep(through(u, span));
}

/**
 * Each part's level at a pose: in the light dive by its way frame (`at.frame`), on the world by its part, t and area
 * (`path`, null off it): the clouds up to the world's level and the bands in over the land, as the light leaves the facts
 * behind; quieter over the first area's way in and back up over the look back; with a project open (`open`, 0..1) the
 * clouds go toward `OPEN_LOOK.clouds` of their level (./inside.ts). No rings, which were the beads'.
 */
export function nebulaLevels(at: Pick<JourneyAt, 'stretch' | 'frame'>, path: Pick<WorldFrame, 'part' | 't' | 'black' | 'index'> | null, open = 0): NebulaLevels {
  if (at.stretch === 'light' && at.frame !== null) return { clouds: NEBULA.FALL_LEVEL * over(NEBULA.CLOUDS_IN, at.frame), bands: 0, rings: 0 };
  if (path === null) return { clouds: 0, bands: 0, rings: 0 };
  const { part, t, black, index } = path;
  const { world, area } = NEBULA.WORLD_LEVEL;
  const quiet = 1 + (OPEN_LOOK.clouds - 1) * Math.min(1, Math.max(0, open));
  if (part === 'sheet') return { clouds: world * (1 - black) * quiet, bands: 1 - black, rings: 0 };
  let clouds: number = world;
  if (part === 'land') clouds = NEBULA.FALL_LEVEL + (world - NEBULA.FALL_LEVEL) * over([0, NEBULA.WHOLE_BY_T], t);
  else if (part === 'area') clouds = index === 0 ? world + (area - world) * over([0, AREA_STOP], t) : area;
  else if (part === 'look') clouds = area + (world - area) * over([0, 0.9], t);
  const bands = part === 'land' ? over(NEBULA.BANDS_IN_T, t) : 1;
  return { clouds: clouds * quiet, bands, rings: 0 };
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
 * Where the clouds hang round the world `world` on a ladder's `tier`: `NEBULA.COUNT[tier]` of them, the same for the
 * same world every time. About `FALL.share` down the fall's column, round its line; the rest round the board. A place is
 * kept only out of the fall's corridor, off the board (`WORLD.board` out and `WORLD.height` up or down, and its half
 * width), and `WORLD.sight` and its half width off every view's line from its camera to what it looks at (`sights`:
 * the land's, the world's, each area's, the look back's and every open view's).
 */
export function cloudLayout(world: Pick<WorldPath, 'sights' | 'centre'>, tier: keyof typeof NEBULA.COUNT): CloudSpec[] {
  const random = seeded(4099);
  const count = NEBULA.COUNT[tier];
  const fallCount = Math.round(count * NEBULA.FALL.share);
  const { sights, centre: c } = world;
  const { reach, above, below, board, height, sight } = NEBULA.WORLD;

  const keeps = (at: Vec3, size: number): boolean => {
    if (inCorridor(at, size)) return false;
    if (Math.hypot(at[0] - c[0], at[2] - c[2]) < board + size / 2 && Math.abs(at[1] - c[1]) < height + size / 2) return false;
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
  // Round the world.
  lay(() => {
    const th = random() * Math.PI * 2;
    const r = lerp(reach[0], reach[1], Math.sqrt(random()));
    return [c[0] + Math.cos(th) * r, lerp(c[1] - below, c[1] + above, random()), c[2] + Math.sin(th) * r];
  }, count);
  return clouds;
}
