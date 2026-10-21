/**
 * The home's rules as plain numbers (spec §2.2 and §4): when the needle follows the pointer and when it drifts, how
 * long the idle motion runs and how it breathes and pulses, how a constellation's glow fades, and where a
 * constellation's name stands on the screen. Pure, so the tests read the very numbers Home (Home.tsx) applies, and it
 * imports nothing from three or React.
 */
import type { SceneKind } from '~/app/handle';
import type { CountryId } from '~/data/directions';
import { PLACEMENTS } from '~/engine/v3/constellations';
import type { Phase } from '~/state/machine';

/**
 * How long the home's idle motion runs after the last thing that stirred it (a pointer move at home, a phase change,
 * the hand-over from the opening), seconds: the stars' twinkle, the needle's breathing, the city's pulse and the touch
 * drift. Then the needle settles, the scene draws nothing more and the canvas sleeps (spec §4: when nothing moves,
 * nothing is rendered).
 */
export const IDLE_SECONDS = 12;

/** The needle tip's breathing: its glow ±`depth` of itself, once every `period` seconds. Slow, like a held breath. */
export const BREATHE = { depth: 0.1, period: 4 } as const;

/** The chip city's pulse under the glass: its glow ±`depth` of itself, once every `period` seconds, very slowly. */
export const PULSE = { depth: 0.05, period: 9 } as const;

/** `1 + depth * sin(2 PI t / period)`; a time that is not finite reads as rest, 1. */
function wave(t: number, { depth, period }: { depth: number; period: number }): number {
  if (!Number.isFinite(t)) return 1;
  return 1 + depth * Math.sin((2 * Math.PI * t) / period);
}

/** The needle tip's glow at `t` seconds of idle motion, as a share of its own: 0.9 to 1.1 over 4 s. */
export function breathAt(t: number): number {
  return wave(t, BREATHE);
}

/** The city's glow at `t` seconds of idle motion, as a share of its home level: 0.95 to 1.05 over 9 s. */
export function pulseAt(t: number): number {
  return wave(t, PULSE);
}

/**
 * How long a constellation's glow takes to follow the needle, seconds: it is 95 % of the way from rest (0.3) to
 * pointed (1) after this, or back, so the stars brighten as the needle arrives without a snap.
 */
export const GLOW_FADE = 0.4;

/** Within this of its goal a glow is there: it takes the goal exactly, and the scene can count it still. */
const GLOW_SETTLED = 1e-3;

/**
 * A glow `dt` seconds further from `level` toward `goal`: an exponential approach, 95 % of the way in GLOW_FADE, which
 * never overshoots and lands exactly on the goal once within a thousandth of it. A step of no time (or not a number)
 * changes nothing, and a level that is not a number takes the goal.
 */
export function glowToward(level: number, goal: number, dt: number): number {
  if (Number.isNaN(level)) return goal;
  if (!(dt > 0)) return level;
  const next = goal + (level - goal) * Math.exp((-3 * dt) / GLOW_FADE);
  return Math.abs(next - goal) < GLOW_SETTLED ? goal : next;
}

/**
 * Whether the needle aims (at the pointer, or by the touch drift) and the constellation it points at is named: on the
 * home page at rest, HOME_IDLE with the home scene shown. Anywhere else (a page of text over the scene, a scroll chapter,
 * a constellation in focus) the needle holds where it points and no name shows, and a pointer moving there does not
 * stir the home's idle motion: the scene behind a country page wakes for the parallax only.
 */
export function isAiming(phase: Phase['kind'], scene: SceneKind | null): boolean {
  return phase === 'HOME_IDLE' && scene === 'home';
}

/** Where the needle's target comes from this frame: the pointer, the touch drift, or nowhere (it holds its last). */
export type AimSource = 'pointer' | 'drift' | 'hold';

/**
 * Where the needle's target comes from (spec §2.2): a mouse or trackpad (`finePointer`) once it has moved; the touch
 * drift (aim.ts `touchDrift`) on a touch screen, which has no pointer to follow, and on a fine one before its first
 * move, so the needle visits the constellations rather than stand still; and nothing while it is not `aiming`
 * (`isAiming`), where it holds.
 */
export function aimSource(aiming: boolean, finePointer: boolean, pointerMoved: boolean): AimSource {
  if (!aiming) return 'hold';
  return finePointer && pointerMoved ? 'pointer' : 'drift';
}

/**
 * Whether the idle motion runs this frame: before `until` (`performance.now()` ms: IDLE_SECONDS after the last stir),
 * and past it while the needle is `drifting` and the drift is not `resting` on a constellation (aim.ts
 * `touchDriftRests`), so the scene falls asleep with its needle on a named constellation rather than stopped in the
 * dark between. Never under `reduced` motion: no twinkle, breathe, pulse or drift at all.
 */
export function idleRuns(at: { now: number; until: number; reduced: boolean; drifting: boolean; resting: boolean }): boolean {
  if (at.reduced) return false;
  return at.now < at.until || (at.drifting && !at.resting);
}

/** The side of its figure a constellation's name stands on: right of it, left of it, or above it. */
export type LabelSide = 'east' | 'west' | 'north';

/**
 * The side away from the compass, as the home camera (looking north) sees it: China, in the east, is named to its
 * right; Aruba, in the west, to its left; the ship, straight ahead beyond the far rim, above its masts.
 */
export function labelSide(id: CountryId): LabelSide {
  const east = Math.sin((PLACEMENTS[id].bearing * Math.PI) / 180);
  return east > 0.5 ? 'east' : east < -0.5 ? 'west' : 'north';
}

/**
 * How a name keeps clear of its figure's outermost star (`gap`) and of the screen's edges (`margin`), CSS px. At the
 * design size (1440 x 900) China's and Aruba's outer sides each have about 100 px of sky, room for a short name.
 */
export const LABEL = { gap: 12, margin: 12 } as const;

/** A box on the screen, CSS px from the canvas's top left. */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** `value` held to [lo, hi], or to lo if there is no room between them. */
function hold(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(value, hi));
}

/**
 * Where a constellation's name stands on the screen: the top left of its label (`label` px), written into `out` and
 * answered, CSS px from the canvas's top left. `figure` is the box round its stars on the screen and `anchor` its
 * centroid there.
 *
 * - east and west: just past the figure on that side (`LABEL.gap`), level with the anchor;
 * - north, and a side with no room on the screen (a phone, where China and Aruba reach its edges): above the figure,
 *   centred on the anchor.
 *
 * The whole label is kept on the screen, `LABEL.margin` inside its edges.
 */
export function labelSpot(
  side: LabelSide,
  figure: ScreenBox,
  anchor: { x: number; y: number },
  label: { width: number; height: number },
  view: { width: number; height: number },
  out: [number, number],
): [number, number] {
  const { gap, margin } = LABEL;
  const level = hold(anchor.y - label.height / 2, margin, view.height - margin - label.height);
  if (side === 'east') {
    const x = figure.right + gap;
    if (x + label.width <= view.width - margin) return set(out, x, level);
  } else if (side === 'west') {
    const x = figure.left - gap - label.width;
    if (x >= margin) return set(out, x, level);
  }
  const x = hold(anchor.x - label.width / 2, margin, view.width - margin - label.width);
  return set(out, x, Math.max(margin, figure.top - gap - label.height));
}

function set(out: [number, number], x: number, y: number): [number, number] {
  out[0] = x;
  out[1] = y;
  return out;
}
