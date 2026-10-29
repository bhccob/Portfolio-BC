/**
 * The nebula the light and the camera fly through (spec 2026-10-27-bob-nebula-space-design.md, goals 1, 2 and 8), as
 * plain numbers: how much of it shows at a pose. Pure, as the journey and the path are: no React, no three, so the tests
 * read the very levels the scene draws (src/engine/bob/build/nebula.ts, volume.ts).
 *
 * - **The clouds**, the gas now (src/engine/bob/build/volume.ts, spec 2026-10-28-bob-quantum-stack-design.md, goal 9),
 *   come in over the fall (way frames `CLOUDS_IN`), as the camera turns to follow the light from the side, so the
 *   light falls through the nebula, at `FALL_LEVEL` behind Bob's facts (their words stay readable); they come up to
 *   whole over the first trip (by `WHOLE_BY_T`), and stay through the Q&A. The gas keeps its own clear space
 *   round the stack or along the fall's line, and along the camera's line to what it looks at.
 * - **The far bands**, a few engraved gold orbit bands far behind (the first mock-up's), come in over the first trip,
 *   clear of the fall's own rings.
 * - **The look back's rings**, a thin engraved ring round each bead (the beads' own, from Blender), come in over the
 *   look back, at `RINGS.level`.
 */
import type { JourneyAt } from './journey';
import { AREA_STOP } from '~/state/chapters';
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
  HALL_GIVES: [70, 110] as Span
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
  if (part === 'qa') return { clouds: world * (1 - black) * quiet, bands: 1 - black, rings: 0 };
  let clouds: number = world;
  if (part === 'land') clouds = NEBULA.FALL_LEVEL + (world - NEBULA.FALL_LEVEL) * over([0, NEBULA.WHOLE_BY_T], t);
  else if (part === 'area') clouds = index === 0 ? world + (area - world) * over([0, AREA_STOP], t) : area;
  else if (part === 'look') clouds = area + (world - area) * over([0, 0.9], t);
  const bands = part === 'land' ? over(NEBULA.BANDS_IN_T, t) : 1;
  return { clouds: clouds * quiet, bands, rings: 0 };
}
