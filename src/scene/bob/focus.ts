/**
 * A project opened in place (spec 2026-10-28-bob-quantum-stack-design.md, goal 5) as plain rules: the project lifting off
 * its socket to the spot in front of the camera and sinking back (the lift, which the world eases and poses,
 * src/engine/bob/build/world.ts), the camera's shot meanwhile, what the page asks for, and when a move may go smoothly.
 * Pure, and apart from types it imports only the journey and the step fade's length, so the tests run it without R3F,
 * three or a browser; the Opening (./Opening.tsx), the shot's one writer, applies exactly these, and the label
 * (src/ui/projectOpen.tsx) begins the lift.
 *
 * - **Into a project**: a click on it, its name or its board's words, at a stop, lifts it to the spot over FLIGHT_MS; the
 *   camera stays where it stands. "Bekijk project" goes on to its page, which stands over it.
 * - **From one to the next**: the arrows sink the project in the spot back to its socket as the next one rises into the
 *   same spot, from whichever board it is on; the camera stays. Pressed again quickly, the ones on their way down go on
 *   down from where they are.
 * - **Out again**: Back or Escape puts the story at the shown project's board (src/state/routeSync.ts); the project sinks
 *   over SINK_MS and the camera turns round the stack's axis (./around.ts `aroundShot`) to that board's stop.
 * - **A fade** stands in for a lift wherever one cannot be: with reduced motion (spec §2.3: a step is a short fade), into
 *   a page reached any other way (a link of the home's nav, Lite, a direct arrival once its loader has landed), and out
 *   to a story the scroll's hold keeps short of the project's stop (the void is not loaded yet). It is M2a's step fade
 *   (./stepFade.ts): the scene host fades down over FOCUS_FADE_MS, the shot and the lift jump while it is dark (to the
 *   project's board stop, the project in the spot), and it fades back.
 */
import type { SceneKind } from '~/app/handle';
import type { ProjectId } from '~/data/projects';
import type { CameraShot } from '~/engine/bob/shots';
import type { Phase } from '~/state/machine';
import { aroundShot } from './around';
import { opensOnClick } from './inside';
import { journeyAt, WORLD_PROJECTS } from './journey';
import { STEP_FADE_MS } from './stepFade';

/** How long a project takes to rise to the spot, ms (the mock-up's 1.5 s). */
export const FLIGHT_MS = 1500;

/** How long it takes to sink back to its socket, ms (the mock-up's 1.3 s); the camera turns to its board meanwhile. */
export const SINK_MS = 1300;

/** How long a fade's dark half takes, ms: the step fade's (the scene host's opacity moves over it, src/styles/base.css). */
export const FOCUS_FADE_MS = STEP_FADE_MS;

/** How a move goes: the project lifts or sinks (the camera turning back to a board on the way out), or a fade. */
export type FocusMode = 'fly' | 'fade';

/** A project and how far it has risen off its socket toward the spot, 0..1. */
export interface Lift {
  id: ProjectId;
  amount: number;
}

/**
 * A move of the projects between their sockets and the spot, and of the camera on the way out. At rest it stands where
 * it went.
 * - `from`: what was up as it began: the project in the spot or rising to it (`id`, `amount`; none and 0 for no
 *   project), and the one on its way down (`leaving`), which go on from there;
 * - `to`: the project it lifts to the spot, or null to sink them all;
 * - `at`: when it began (`performance.now()` ms);
 * - `mode`: a lift or a fade;
 * - `shot`: the camera's shot as it began (`frame.shot`), where it stays, and which the way out leaves from; none (the
 *   first move, or one begun where the camera's shot is not known) stands on its goal.
 */
export interface FocusMove {
  from: { id: ProjectId | null; amount: number; leaving: Lift | null };
  to: ProjectId | null;
  at: number;
  mode: FocusMode;
  shot: CameraShot | null;
}

/** No move yet: nothing lifted, the journey's shot. */
export const FOCUS_AT_REST: Readonly<FocusMove> = Object.freeze({
  from: Object.freeze({ id: null, amount: 0, leaving: null }),
  to: null,
  at: Number.NEGATIVE_INFINITY,
  mode: 'fade',
  shot: null
});

/**
 * Where a move stands at a moment:
 * - `id`: the project shown (the one rising, or on the way out the one sinking), null with none up;
 * - `amount`: how far the open look is in, the highest lift of any project (0 with none);
 * - `dark`: a fade's first half, while the scene host is faded down;
 * - `moving`: the move is not over, so the canvas draws on;
 * - `engaged`: a project is open or on its way up or down: its label is away and the pointer hovers nothing.
 */
export interface FocusPose {
  id: ProjectId | null;
  amount: number;
  dark: boolean;
  moving: boolean;
  engaged: boolean;
}

/** Perlin's smootherstep: the camera's turn back leaves and arrives with no speed, heavy and damped (spec §4). */
function flightEase(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Each project's lift on `move` at `now`: the one rising to the spot (none on the way out), and those sinking, the highest
 * first. A lift rises at a steady pace over FLIGHT_MS and sinks over SINK_MS from where it was (the world eases it); a
 * fade holds all as they were while dark, then has the one it goes to in the spot and the rest down. A moment that is
 * not a number reads as the move's start.
 */
function liftsOf(move: FocusMove, now: number): { rising: Lift | null; sinking: Lift[] } {
  const elapsed = now - move.at;
  const start: Lift[] = [];
  if (move.from.id !== null && move.from.amount > 0) start.push({ id: move.from.id, amount: move.from.amount });
  const leaving = move.from.leaving;
  if (leaving !== null && leaving.amount > 0 && leaving.id !== move.from.id) start.push({ ...leaving });
  if (move.mode === 'fade') {
    if (!(elapsed >= FOCUS_FADE_MS)) {
      const [main, ...rest] = start;
      return { rising: main ?? null, sinking: rest };
    }
    return { rising: move.to === null ? null : { id: move.to, amount: 1 }, sinking: [] };
  }
  const t = elapsed > 0 ? elapsed : 0;
  const rising = move.to === null ? null : { id: move.to, amount: Math.min(1, (start.find((l) => l.id === move.to)?.amount ?? 0) + t / FLIGHT_MS) };
  const sinking = start
    .filter((l) => l.id !== move.to)
    .map((l) => ({ id: l.id, amount: Math.max(0, l.amount - t / SINK_MS) }))
    .filter((l) => l.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { rising, sinking };
}

/** Where `move` stands at `now` (ms). */
export function focusPoseAt(move: FocusMove, now: number): FocusPose {
  const elapsed = now - move.at;
  if (move.mode === 'fade') {
    const fromId = move.from.amount > 0 ? move.from.id : null;
    if (!(elapsed >= FOCUS_FADE_MS)) return { id: fromId, amount: fromId === null ? 0 : move.from.amount, dark: true, moving: true, engaged: true };
    return { id: move.to, amount: move.to === null ? 0 : 1, dark: false, moving: false, engaged: move.to !== null };
  }
  const { rising, sinking } = liftsOf(move, now);
  const amount = Math.max(rising?.amount ?? 0, sinking[0]?.amount ?? 0);
  const id = amount > 0 ? (rising?.id ?? sinking[0]?.id ?? null) : null;
  const moving = (rising !== null && rising.amount < 1) || sinking.length > 0;
  return { id, amount: id === null ? 0 : amount, dark: false, moving, engaged: moving || move.to !== null };
}

/** Every project's lift on `move` at `now`, the one rising included even at 0: what the world poses (`WorldPose.lift`). */
export function focusLiftsAt(move: FocusMove, now: number): Partial<Record<ProjectId, number>> {
  const { rising, sinking } = liftsOf(move, now);
  const lifts: Partial<Record<ProjectId, number>> = {};
  for (const l of sinking) lifts[l.id] = l.amount;
  if (rising !== null) lifts[rising.id] = rising.amount;
  return lifts;
}

/**
 * The open project's and the one leaving's lifts on `move` at `now`, which their panels and touch points follow: `open`,
 * the shown project's (`focusPoseAt`'s `id`), and `leaving`, the highest of the others on their way down (none
 * otherwise).
 */
export function focusOpensAt(move: FocusMove, now: number): { open: number; leaving: Lift | null } {
  const { rising, sinking } = liftsOf(move, now);
  if (rising !== null) return { open: rising.amount, leaving: sinking[0] ?? null };
  return { open: sinking[0]?.amount ?? 0, leaving: sinking[1] ?? null };
}

/**
 * The camera's shot on `move` at `now`, its goal `goal` (the shown project's board stop, or the journey's shot it goes
 * back to). Lifting a project, or swapping one for the next, the camera stays on the shot it began on; on the way out it
 * turns round the stack's `centre` (./around.ts) to its goal over SINK_MS. A fade holds the shot it began on while dark,
 * then the goal. A move with no shot to begin from stands on its goal.
 */
export function focusShotAt(move: FocusMove, now: number, goal: CameraShot, centre: readonly [number, number, number]): CameraShot {
  if (move.shot === null) return goal;
  const elapsed = now - move.at;
  if (move.mode === 'fade') return elapsed >= FOCUS_FADE_MS ? goal : move.shot;
  if (move.to !== null) return move.shot;
  const t = elapsed >= SINK_MS ? 1 : elapsed > 0 ? elapsed / SINK_MS : 0;
  if (t <= 0) return move.shot;
  return t >= 1 ? goal : aroundShot(move.shot, goal, centre, flightEase(t));
}

/**
 * A new move to `to` (a project to lift, or null to sink them all) begun at `now`, from wherever `move` stands then, so
 * a move turned back or swapped half way goes on from there: the camera from `shot`, where it stands now (`frame.shot`),
 * the shown project and the highest of those on their way down from their lifts. (A third on its way down, the lowest,
 * is let go.)
 */
export function moveFocus(move: FocusMove, to: ProjectId | null, now: number, mode: FocusMode, shot: CameraShot | null = null): FocusMove {
  const { rising, sinking } = liftsOf(move, now);
  const up = [...(rising !== null && rising.amount > 0 ? [rising] : []), ...sinking];
  const main = up[0] ?? null;
  return { from: { id: main?.id ?? null, amount: main?.amount ?? 0, leaving: up[1] ?? null }, to, at: now, mode, shot };
}

/** The project of an id, if it is on the world. */
function beadOf(id: string): ProjectId | null {
  return WORLD_PROJECTS.find((project) => project === id) ?? null;
}

/**
 * The close view the page asks for: the bead being opened (`opening`: its flight runs on the home page until the
 * router goes to its page); else, on a project page (`scene` 'project', the phase PROJECT_FOCUS), its project's bead;
 * else, on the home page, the bead the visitor is inside (`inside`, the store's: a click opened it, ./inside.ts); else
 * none, the journey's shot.
 *
 * A PROJECT_FOCUS on the home page with nothing opening is a page that is being left and not yet synced: on Back or
 * Escape the scene turns 'home' in a layout effect (SceneHost) a moment before the route sync, a passive effect, puts
 * the story at the bead's stop and the phase on the scroll (src/state/routeSync.ts), and a canvas frame can fall
 * between the two. It asks for the close view it stands at (`current`, the last move's), so the move out is decided
 * only once the story is where Back puts it. With none (the proof bridge's OPEN_PROJECT on the home) it asks for none:
 * only a page, or a label's flight, brings a bead close.
 */
export function focusGoalFor(
  phase: Phase,
  scene: SceneKind | null,
  opening: ProjectId | null,
  current: ProjectId | null = null,
  inside: ProjectId | null = null
): ProjectId | null {
  if (opening !== null) return opening;
  if (phase.kind !== 'PROJECT_FOCUS') return scene === 'home' && inside !== null ? beadOf(inside) : null;
  if (scene === 'project') return beadOf(phase.id);
  return scene === 'home' ? current : null;
}

/** What a frame's focus step reads of the app: the store's phase, page, reduced motion and inside, and the story's place. */
export interface FocusInput {
  phase: Phase;
  scene: SceneKind | null;
  reducedMotion: boolean;
  /** The bead the visitor is inside (the store's `inside`); none where it is left out. */
  inside?: ProjectId | null;
  progress: number;
  target: number;
  /** Where the camera stands (`frame.shot`, last frame's): a move begun here flies from it. */
  shot?: CameraShot | null;
}

/**
 * The close view on a frame at `now`, the Opening's step of `focus` (`frame.focus`, in place): a new move is begun
 * first wherever the page asks for another close view than the last move goes to (`focusGoalFor`). Into a page's bead
 * or an inside that is a fade (a click's own flight was begun by the click, `openBead` and `openInside`, so only an
 * inside the history brings back comes here); back out to the journey it is a flight from where the bead opens at
 * rest (`restsAt`: the route sync put the story there and the void's hold let it stay), and a fade otherwise, or with
 * reduced motion.
 */
export function stepFocus(focus: { move: FocusMove; opening: ProjectId | null }, input: FocusInput, now: number): FocusPose {
  const leaving = focus.move.to;
  const goal = focusGoalFor(input.phase, input.scene, focus.opening, leaving, input.inside ?? null);
  if (goal !== leaving) {
    const fly = goal === null && !input.reducedMotion && restsAt(leaving, input.progress, input.target);
    focus.move = moveFocus(focus.move, goal, now, fly ? 'fly' : 'fade', input.shot ?? null);
  }
  return focusPoseAt(focus.move, now);
}

/**
 * Whether the story rests where project `id` is in view: at rest (the scroll's target where the story stands) at the
 * world's stop, an area's or the look back (its own stop, the sheet's start, included), where a click opens a project on
 * the world (./inside.ts `opensOnClick`). Only from there does a flight leave or arrive: the shot at rest is the one the
 * flight eases from.
 */
export function restsAt(id: ProjectId | null, progress: number, target: number): boolean {
  if (id === null || progress !== target || !WORLD_PROJECTS.includes(id)) return false;
  return opensOnClick(journeyAt(progress), true);
}

