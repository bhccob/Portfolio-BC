/**
 * The nebula the light and the camera fly through (spec 2026-10-27-bob-nebula-space-design.md, goals 1, 2 and 8), as
 * plain numbers: how much of it shows at a pose. Pure, as the journey and the path are: no React, no three, so the tests
 * read the very levels the scene draws (src/engine/bob/build/nebula.ts, volume.ts).
 *
 * - **The clouds**, the gas now (src/engine/bob/build/volume.ts, spec 2026-10-28-bob-quantum-stack-design.md, goal 9),
 *   come in over the fall (way frames `CLOUDS_IN`), as the camera turns to follow the light from the side, so the
 *   light falls through the nebula, at `FALL_LEVEL` behind Bob's facts (their words keep the page's scrim), a richer
 *   space than before (spec 2026-10-29-bob-stack-2-design.md, goal 4); they ease to the world's level over the first
 *   trip (by `WHOLE_BY_T`), and stay through the Q&A. The gas keeps its own clear space
 *   round the stack or along the fall's line, and along the camera's line to what it looks at.
 * - **The far bands**, a few engraved gold orbit bands far behind (the first mock-up's), come in with the clouds over
 *   the fall at `FALL_BANDS`, and up to whole over the first trip.
 * - **The fall's stars** (src/engine/bob/build/stars.ts `starsFall`) come in with the clouds and go out over the land,
 *   as the stack's own stars come in with its power (`fallStarsLevel`).
 * - **The look back's rings**, a thin engraved ring round each bead (the beads' own, from Blender), come in over the
 *   look back, at `RINGS.level`.
 */
import type { JourneyAt } from './journey';
import { AREA_STOP, LAND_STOP } from '~/state/chapters';
import { OPEN_LOOK } from './inside';
import type { WorldFrame } from './worldPath';
import { smoothstep, type Span, through } from './scrollPose';

/** How much of each part shows, 0..1. */
export interface NebulaLevels {
  clouds: number;
  bands: number;
  rings: number;
}

/**
 * The numbers (my calls, as the spec leaves them to the builder): the windows each part shows over (way frames, or a
 * part's t) and its levels.
 */
export const NEBULA = {
  CLOUDS_IN: [50, 95] as Span,
  /** How much of the nebula shows in the fall, behind the facts (the mock-up's richer space), and by when on the first trip it is the world's. */
  FALL_LEVEL: 0.9,
  /** How much of the far bands shows in the fall, in with the clouds. */
  FALL_BANDS: 0.85,
  WHOLE_BY_T: 0.5,
  BANDS_IN_T: [0.2, 0.7] as Span,
  RINGS: { level: 0.6, in: [0.15, 0.7] as Span },
  /**
   * The clouds' level on the world (spec 2026-10-27-bob-hologram-world-design.md, the mock-up's): at the world's stop
   * and the look back, and at an area, quieter, so the area's project stands out.
   */
  WORLD_LEVEL: { world: 0.8, area: 0.55 },
  /** The hall's wide rings give way to the clouds over these way frames (engravedWay's hall). */
  HALL_GIVES: [70, 110] as Span
} as const;

/**
 * How much of the fall's stars shows at a pose, 0..1: in with the clouds over the fall (way frames `CLOUDS_IN`), out
 * over the land as the light comes down into the CPU (to the world's stop), none on the world after it, where the
 * stack's own stars stand.
 */
export function fallStarsLevel(at: Pick<JourneyAt, 'stretch' | 'frame'>, path: Pick<WorldFrame, 'part' | 't'> | null): number {
  if (at.stretch === 'light' && at.frame !== null) return over(NEBULA.CLOUDS_IN, at.frame);
  if (path === null || path.part !== 'land') return 0;
  return 1 - over([0, LAND_STOP], path.t);
}

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
  if (at.stretch === 'light' && at.frame !== null) {
    const coming = over(NEBULA.CLOUDS_IN, at.frame);
    return { clouds: NEBULA.FALL_LEVEL * coming, bands: NEBULA.FALL_BANDS * coming, rings: 0 };
  }
  if (path === null) return { clouds: 0, bands: 0, rings: 0 };
  const { part, t, black, index } = path;
  const { world, area } = NEBULA.WORLD_LEVEL;
  const quiet = 1 + (OPEN_LOOK.clouds - 1) * Math.min(1, Math.max(0, open));
  if (part === 'qa') return { clouds: world * (1 - black) * quiet, bands: 1 - black, rings: 0 };
  let clouds: number = world;
  if (part === 'land') clouds = NEBULA.FALL_LEVEL + (world - NEBULA.FALL_LEVEL) * over([0, NEBULA.WHOLE_BY_T], t);
  else if (part === 'area') clouds = index === 0 ? world + (area - world) * over([0, AREA_STOP], t) : area;
  else if (part === 'look') clouds = area + (world - area) * over([0, 0.9], t);
  const bands = part === 'land' ? NEBULA.FALL_BANDS + (1 - NEBULA.FALL_BANDS) * over(NEBULA.BANDS_IN_T, t) : 1;
  return { clouds: clouds * quiet, bands, rings: 0 };
}
