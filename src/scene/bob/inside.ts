/**
 * A bead's inside, opened by a click (spec 2026-10-27-bob-nebula-space-design.md, goal 6), as plain rules: where a
 * click on a bead takes the visitor inside it, and the history entry an inside stands on. Pure and apart from types it
 * imports only the projects, so the route sync reads it without the scene.
 *
 * - **In**: a click or a tap on the bead the light rests beside (its arrival), or on any bead in the look back, or on
 *   its label there, pushes the home page again with `{ [INSIDE_STATE]: id }` (src/ui/projectOpen.tsx `openInside`), and
 *   the camera flies through the porthole (./focus.ts): the bead's objects build and its touch points show.
 * - **Out**: Back pops that entry; "Terug", Escape, a wheel and a swipe go Back too (`closeInside`). The camera flies
 *   out to where the click was.
 */
import { type ProjectId, projects } from '~/data/projects';
import type { JourneyAt } from './journey';
import { LAND_STOP } from '~/state/chapters';
import { IDLE_SECONDS } from './look';

/** The key of a history entry's state that marks an inside: `{ [INSIDE_STATE]: ProjectId }`. */
export const INSIDE_STATE = 'bob-inside';

/** Where on the camera's way in (the focus's amount, 0 at the arrival, 1 inside) the bead's objects build, eased. */
export const INSIDE_BUILD = [0.35, 0.95] as const;

/** Where on the way in its touch points come in, eased: once the camera is all but in, after the objects. */
export const INSIDE_POINTS = [0.8, 1] as const;

/** `x` from `a` to `b` as 0 to 1, held there and smoothstepped; NaN reads as 0. */
function eased(x: number, [a, b]: readonly [number, number]): number {
  const t = x > a ? (x < b ? (x - a) / (b - a) : 1) : 0;
  return t * t * (3 - 2 * t);
}

/** How far the bead's objects are built with the camera `amount` of the way in (out again, the same way back). */
export function insideBuild(amount: number): number {
  return eased(amount, INSIDE_BUILD);
}

/** How far its touch points show with the camera `amount` of the way in. */
export function insidePoints(amount: number): number {
  return eased(amount, INSIDE_POINTS);
}

/**
 * Whether the objects' clock runs inside the bead at `now` (ms): for IDLE_SECONDS after `stirred` (when the inside
 * opened, or the pointer last moved over it), as the home's idle motion runs, and never with reduced motion. Then the
 * objects rest where they are and the canvas sleeps.
 */
export function insideClockRuns(stirred: number, now: number, reduced: boolean): boolean {
  return !reduced && now - stirred < IDLE_SECONDS * 1000;
}

/**
 * Whether a click on a project opens it on the world (spec 2026-10-27-bob-hologram-world-design.md), with the journey at
 * `at` and the story at rest (`rest`: the scroll's target where the story stands): at the world's stop, at an area's,
 * or in the look back (its own stop, the sheet's start, included), any project on the world. Nowhere else: in the light
 * dive, while the land is still coming in, while the camera glides between two stops, and once the sheet is rising,
 * nothing opens there (a click elsewhere goes to the project's page instead, src/ui/projectOpen.tsx).
 */
export function opensOnClick(at: JourneyAt, rest: boolean): boolean {
  if (!rest) return false;
  if (at.stretch === 'land') return at.local >= LAND_STOP - 1e-6;
  return at.stretch === 'area' || at.stretch === 'look' || (at.stretch === 'sheet' && at.local === 0);
}

/**
 * The inside a history entry's state carries (`{ [INSIDE_STATE]: id }`, as `openInside` pushes it): the project's id
 * if it is a bead on the way, else null, for any other state, an unknown id or a project off the way included.
 */
export function insideFromHistory(state: unknown): ProjectId | null {
  if (typeof state !== 'object' || state === null) return null;
  const id = (state as Record<string, unknown>)[INSIDE_STATE];
  return projects.onPath().find((project) => project.id === id)?.id ?? null;
}
