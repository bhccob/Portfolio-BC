/**
 * The storm behind everything (spec 2026-10-30-bob-storm-design.md; Bob, 2026-10-30: "i want the background dimension
 * too look more 3d and intimidating and cinematic including the start screen like so its not a static background"; he
 * picked the storm nebula, painted and animated): its flats, its flash, how much of it shows where, and when it moves.
 * Pure, as the journey is: the same moment is the same storm, and the tests read the very numbers the Void poses it by
 * (src/engine/bob/build/storm.ts draws it).
 */
import type { QualityTier } from '~/engine/quality';
import type { JourneyAt } from './journey';
import { TOP_FADE } from './lightDive';
import { NEBULA } from './nebulaWay';
import { LAND_HIT } from './worldPath';

type Vec3 = [number, number, number];

/**
 * The storm's numbers (the spike Bob saw, .superpowers/bg-review/storm-spike-b.png):
 * - `flats`: the painted flats curved round behind the compass at the start screen, far to near: each its radius and
 *   height (m), how much of the wall plate it spans (`scale`), where on it it starts (`shift`), how fast it drifts
 *   along it (a share a second), its light, and how far up the plate its foot stands (`foot`, the plate's dark base
 *   left out);
 * - `flash`: one gold flash in every `period` s (its glow the flash plates' times `gain`, round 8: faint, as in the
 *   moonlit storm Bob picked), starting up to `spread` s in, rising over `rise` s and dying over
 *   `fall` s; after `twiceAfter` s it may flicker again (when the clock's draw passes `twice`), at `twiceLevel`;
 * - `sky`: the sky's light at the start screen, round the fall, round the tower (`void`), and how much of that stays with
 *   a project open (`open`);
 * - `sea`: how much of the sea of storm below the horizon shows under the falling light (Bob, 2026-10-30: "when the
 *   lights fall i dont like that theres such bright clouds under"), against its whole elsewhere;
 * - `riseOut`: the flats are gone this far through the rise, as the camera comes up to look down on the name;
 * - `fps`: how often the canvas draws for the storm alone; `fadeIn`: s it takes to come in once its plates are in.
 */
export const STORM = {
  flats: [
    { radius: 34, height: 26, scale: 1, shift: 0, speed: 0.0009, level: 0.68, foot: 0.2 },
    { radius: 14, height: 11, scale: 0.75, shift: 0.37, speed: 0.0016, level: 1.04, foot: 0.32 },
    { radius: 6.5, height: 6, scale: 0.55, shift: 0.71, speed: 0.0025, level: 1.36, foot: 0.45 }
  ],
  flash: { period: 6, spread: 2.5, rise: 0.15, fall: 1.1, twice: 0.45, twiceAfter: 0.45, twiceAt: 0.6, twiceWidth: 0.25, twiceLevel: 0.7, gain: 0.6 },
  sky: { home: 0.85, fall: 0.18, void: 0.08, open: 0.6 },
  sea: { fall: 0.15 },
  riseOut: 0.5,
  fps: 30,
  fadeIn: 1.5
} as const;

const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** A fixed draw in 0..1 for `x`: the same `x`, the same draw. */
const draw = (x: number): number => {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The flash at storm time `t` (s): its strength, 0..1, and the way out to it from the camera (a unit vector), behind the
 * compass (-z) and near the horizon, a little above or below it. Each period's flash is fixed by its number alone.
 */
export function stormFlash(t: number): { strength: number; dir: Vec3 } {
  const f = STORM.flash;
  const k = Math.floor((Number.isFinite(t) ? t : 0) / f.period);
  const since = t - (k * f.period + draw(k) * f.spread);
  let strength = since < 0 ? 0 : since < f.rise ? since / f.rise : Math.exp(-(since - f.rise) / f.fall);
  if (draw(k + 0.5) > f.twice && since > f.twiceAfter) strength = Math.max(strength, f.twiceLevel * Math.exp(-Math.abs(since - f.twiceAt) / f.twiceWidth));
  const a = (draw(k + 0.3) * 2 - 1) * 1.1;
  const out: Vec3 = [Math.sin(a) * 0.8, -0.25 + draw(k + 0.7) * 0.55, -Math.abs(Math.cos(a))];
  const n = Math.hypot(...out);
  return { strength: clamp01(strength), dir: [out[0] / n, out[1] / n, out[2] / n] };
}

/**
 * How much of the storm shows with the journey at `at` and a project `opened` (0..1): the sky's light, the flats' and
 * the sea's (what of the sky below the horizon shows, against the rest of it).
 * The start screen has it whole; the flats go over the first `riseOut` of the rise; over the fall the sky dims, from the
 * glass top fading to the clouds being in (looking level into the storm's middle, round the falling light, a little of
 * it is a lot), and the sea under the light goes dark as the camera comes under the glass, and both stay there; over
 * the drop into the stack the sky eases to its light round the tower (looking down on the stack, behind the gas) and the
 * sea comes back, both there by the light's hit on the lid, and stay there, quieter with a project open; the end page is
 * a page, and has none.
 */
export function stormLevels(at: Pick<JourneyAt, 'stretch' | 'local' | 'frame'>, opened: number): { sky: number; flats: number; sea: number } {
  if (at.stretch === 'rise') return { sky: STORM.sky.home, flats: 1 - smooth(at.local / STORM.riseOut), sea: 1 };
  if (at.stretch === 'light') {
    const frame = at.frame ?? 0;
    const into = smooth((frame - TOP_FADE[0]) / (NEBULA.CLOUDS_IN[1] - TOP_FADE[0]));
    // The sea under the light dark by the time the camera is under the glass.
    const under = smooth((frame - TOP_FADE[0]) / (TOP_FADE[1] - TOP_FADE[0]));
    return { sky: STORM.sky.home + (STORM.sky.fall - STORM.sky.home) * into, flats: 0, sea: 1 + (STORM.sea.fall - 1) * under };
  }
  if (at.stretch === 'land' && at.local < LAND_HIT) {
    const into = smooth(at.local / LAND_HIT);
    return { sky: STORM.sky.fall + (STORM.sky.void - STORM.sky.fall) * into, flats: 0, sea: STORM.sea.fall + (1 - STORM.sea.fall) * into };
  }
  if (at.stretch === 'end') return { sky: 0, flats: 0, sea: 0 };
  return { sky: STORM.sky.void * (1 - (1 - STORM.sky.open) * clamp01(opened)), flats: 0, sea: 1 };
}

/** Whether the storm moves: on the home page, with motion allowed, above the low tier, while any of it shows. */
export function stormMoves(on: { page: string | null; reduced: boolean; tier: QualityTier; sky: number }): boolean {
  return on.page === 'home' && !on.reduced && on.tier !== 'low' && on.sky > 0;
}

/** How far in the storm has come `since` s after its plates were in: over `fadeIn`, eased; at once with reduced motion. */
export function stormFade(since: number, reduced: boolean): number {
  if (reduced) return 1;
  return Number.isFinite(since) ? smooth(since / STORM.fadeIn) : 0;
}
