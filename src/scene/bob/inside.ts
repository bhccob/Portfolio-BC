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
 * Whether the world's clock runs at `now` (ms): the pulse along the buses, the pads' turning rings, the objects' float and
 * the gears' tick (spec 2026-10-27-bob-hologram-world-design.md, "the canvas sleeps"): for IDLE_SECONDS after `stirred`
 * (the last input, the story's last move, a project opening), never with reduced motion. Then the world stands still
 * and the canvas sleeps.
 */
export function worldClockRuns(stirred: number, now: number, reduced: boolean): boolean {
  return !reduced && now - stirred < IDLE_SECONDS * 1000;
}

/**
 * How the world looks with a project open (the mock-up's numbers): the board, the CPU and the pads of the rest at
 * `world` of their light, the open project at `focus`, the others at `others`, the light at `light`, and the clouds at
 * `clouds` of their level: the open project the one bright thing.
 */
export const OPEN_LOOK = { world: 0.25, focus: 1.25, others: 0.3, light: 0.34, clouds: 0.5 } as const;

/**
 * Each project's light with the world `amount` of the way into its open look (0..1) and each project as open as `open`
 * says (0..1, none for a closed one): an open one toward `OPEN_LOOK.focus` by how open it is, the rest of the way toward
 * `others`, so from one open project to the next the one left goes quiet as the next lights.
 */
export function openLevels<K extends string>(levels: Readonly<Record<K, number>>, open: Readonly<Partial<Record<NoInfer<K>, number>>>, amount: number): Record<K, number> {
  const unit = (x: number | undefined): number => Math.min(1, Math.max(0, x ?? 0));
  const a = unit(amount);
  return Object.fromEntries(
    (Object.entries(levels) as [K, number][]).map(([k, v]) => {
      const own = Math.min(a, unit(open[k]));
      return [k, v + (OPEN_LOOK.others - v) * (a - own) + (OPEN_LOOK.focus - v) * own];
    })
  ) as Record<K, number>;
}

/** The world's own light (the board, the CPU, the light) with a project open `amount` of the way. */
export function openWorld(amount: number): number {
  return 1 + (OPEN_LOOK.world - 1) * Math.min(1, Math.max(0, amount));
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
