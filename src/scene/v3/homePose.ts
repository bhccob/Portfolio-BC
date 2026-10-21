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
 * the hand-over from the opening), seconds: the stars' twinkle, the needle's breathing and the city's pulse. A needle
 * on the touch drift runs on for a whole cycle of it (`idleRuns`). Then the needle settles, the scene draws nothing
 * more and the canvas sleeps (spec §4: when nothing moves, nothing is rendered).
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

/**
 * Whether a change of the page's layout (a resize, a scroll, a font arriving, the language changing) asks the canvas
 * for a frame, so the constellations' names are placed again: only while a name can show, as Home's last frame left
 * it (`labelsLive`), and the home is at rest now (`isAiming`). Anywhere else the canvas sleeps through it: a page
 * without a scene asks for no frame at all (src/scene/Heartbeat.tsx), and Home stays mounted behind Lite, contact and
 * a 404, where its last frame may have left `labelsLive` set. The layout is still marked moved, and the placer reads
 * the page afresh when the names come live again.
 */
export function layoutWakes(labelsLive: boolean, phase: Phase['kind'], scene: SceneKind | null): boolean {
  return labelsLive && isAiming(phase, scene);
}

/** Where the needle's target comes from this frame: the pointer, the touch drift, or nowhere (it holds its last). */
export type AimSource = 'pointer' | 'drift' | 'hold';

/**
 * Where the needle's target comes from (spec §2.2): a mouse or a pen once it has moved (`pointerMoved`), on any
 * screen, a tablet with a mouse too; until then the touch drift (aim.ts `touchDrift`), so the needle visits the
 * constellations rather than stand still. A finger never counts as a move (src/scene/Rig.tsx reads no touch), so a
 * touch screen drifts. Nothing while the needle is not `aiming` (`isAiming`), where it holds.
 */
export function aimSource(aiming: boolean, pointerMoved: boolean): AimSource {
  if (!aiming) return 'hold';
  return pointerMoved ? 'pointer' : 'drift';
}

/**
 * Whether the idle motion runs this frame. Never under `reduced` motion: no twinkle, breathe, pulse or drift at all.
 * Otherwise before `until` (`performance.now()` ms: IDLE_SECONDS after the last stir); and while the needle is
 * `drifting`, on past it until the idle clock (`time`, seconds) reaches `driftUntil` (a whole cycle of the drift after
 * the last stir, aim.ts DRIFT_CYCLE, so a visitor with no pointer sees the needle visit China, the Netherlands and
 * Aruba) and then on until the drift is `resting` on a constellation (aim.ts `touchDriftRests`), so the scene falls
 * asleep with its needle on a named constellation rather than stopped in the dark between. The drift's end is on the
 * idle clock, not the page's, so a slow device whose frames the clock caps (Home's MAX_STEP) still plays it whole.
 */
export function idleRuns(at: { now: number; until: number; reduced: boolean; drifting: boolean; time: number; driftUntil: number; resting: boolean }): boolean {
  if (at.reduced) return false;
  if (at.now < at.until) return true;
  return at.drifting && (at.time < at.driftUntil || !at.resting);
}

/** The side of its figure a constellation's name stands on: right of it, left of it, above it, or under it. */
export type LabelSide = 'east' | 'west' | 'north' | 'south';

/**
 * Where a constellation's name stands, as the home camera (looking north) sees it: China, in the east, is named to its
 * right and Aruba, in the west, to its left, away from the compass; the ship, straight ahead beyond the far rim, under
 * its hull, in the sky between it and the compass. Above its masts (Task 13) the ship's name shared a band with the
 * hero's name at some widths and not at others, so it flipped under the ship between 1536 and 1600 px wide (Task 14b);
 * under the hull it stands the same at every width, and on a phone too.
 */
export function labelSide(id: CountryId): LabelSide {
  const east = Math.sin((PLACEMENTS[id].bearing * Math.PI) / 180);
  return east > 0.5 ? 'east' : east < -0.5 ? 'west' : 'south';
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
 * - south: under the figure's lowest star, centred on the anchor;
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
  if (side === 'south') return set(out, x, hold(figure.bottom + gap, margin, view.height - margin - label.height));
  return set(out, x, Math.max(margin, figure.top - gap - label.height));
}

/**
 * How much clear sky a name keeps from the hero's lines (CSS px, between the boxes): nearer than this it would read as
 * a word of the hero's, not a constellation's name. The ship's name stands under its hull (`labelSide`), well below
 * the hero's name at every width; what this still moves is Aruba's, beside the tree at the upper left, which comes
 * within reach of the tagline on a smaller laptop (1024 x 768) and then stands under the tree instead.
 */
export const HERO_ROOM = 80;

/**
 * Keeps a constellation's name off the hero's text. `lines` are the boxes of the hero's lines on the screen, CSS px
 * from the canvas's top left (a line that is not on the page is a box with no extent, left and top at +Infinity,
 * right and bottom at -Infinity, which meets nothing). A name at `spot` (as `labelSpot` placed it) that comes within
 * HERO_ROOM of a line stands under its figure instead: centred on the anchor, `LABEL.gap` below the figure's lowest
 * star, held inside the screen. If that spot is within reach of a line too, the name stays where it was, as there is
 * no better one. Writes into `out` (which may be `spot` itself) and answers it.
 */
export function clearOfHero(
  spot: readonly [number, number],
  figure: ScreenBox,
  anchor: { x: number },
  label: { width: number; height: number },
  view: { width: number; height: number },
  lines: readonly ScreenBox[],
  out: [number, number],
): [number, number] {
  const { gap, margin } = LABEL;
  const near = (x: number, y: number): boolean =>
    lines.some((line) => x < line.right + HERO_ROOM && x + label.width > line.left - HERO_ROOM && y < line.bottom + HERO_ROOM && y + label.height > line.top - HERO_ROOM);
  const [x, y] = spot;
  if (!near(x, y)) return set(out, x, y);
  const belowX = hold(anchor.x - label.width / 2, margin, view.width - margin - label.width);
  const belowY = hold(figure.bottom + gap, margin, view.height - margin - label.height);
  return near(belowX, belowY) ? set(out, x, y) : set(out, belowX, belowY);
}

function set(out: [number, number], x: number, y: number): [number, number] {
  out[0] = x;
  out[1] = y;
  return out;
}
