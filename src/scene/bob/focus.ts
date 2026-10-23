/**
 * A bead seen close (spec §2.4, "Click or Enter flies through the porthole into the project page"; Ruling 4) as plain
 * rules: the camera's moves between the journey's shot and a bead's close view (`focusShotFor`, ./journey), what the
 * page asks for, and when a move may fly. Pure, and apart from types it imports only the journey and the step fade's
 * length, so the tests run it without R3F, three or a browser; the Opening (./Opening.tsx), the shot's one writer,
 * applies exactly these, and the label (src/ui/BeadLabel.tsx) begins the flight in.
 *
 * - **Into a bead**: the label's link, or a click on the bead, at its stop, flies the camera into the porthole over
 *   FLIGHT_MS; then the router goes to the page, which stands over the bead seen close.
 * - **Out again**: Back or Escape puts the story at the bead's stop (src/state/routeSync.ts), and the camera flies out
 *   to it.
 * - **A fade** stands in for the flight wherever a flight cannot be one: with reduced motion (spec §2.3: a step is a
 *   short fade), into a page reached any other way (a link of the home's nav, Lite, a direct arrival once its loader has
 *   landed), and out to a story the scroll's hold keeps short of the bead's stop (the void is not loaded yet). It is
 *   M2a's step fade (./stepFade.ts): the scene host fades down over FOCUS_FADE_MS, the shot jumps while it is dark, and
 *   it fades back.
 */
import type { SceneKind } from '~/app/handle';
import type { ProjectId } from '~/data/projects';
import type { Phase } from '~/state/machine';
import { BEADS, journeyAt } from './journey';
import { STEP_FADE_MS } from './stepFade';

/** How long the flight into a porthole (and back out) takes, ms: spec §2.4's "about 0.8 s". */
export const FLIGHT_MS = 800;

/** How long a fade's dark half takes, ms: the step fade's (the scene host's opacity moves over it, src/styles/base.css). */
export const FOCUS_FADE_MS = STEP_FADE_MS;

/** How a move goes: the camera flies, or the host fades down, the shot jumps and it fades back. */
export type FocusMode = 'fly' | 'fade';

/**
 * A move of the camera between the journey's shot and a bead's close view. At rest it stands where it went.
 * - `from`: where it stood when it began: a bead's close view and how far in (0 is the journey's shot, 1 the close
 *   view), or `{ id: null, amount: 0 }` for the journey's shot;
 * - `to`: the bead whose close view it goes to, or null back to the journey's shot;
 * - `at`: when it began (`performance.now()` ms);
 * - `mode`: a flight or a fade.
 */
export interface FocusMove {
  from: { id: ProjectId | null; amount: number };
  to: ProjectId | null;
  at: number;
  mode: FocusMode;
}

/** No move yet: the journey's shot, at rest. */
export const FOCUS_AT_REST: Readonly<FocusMove> = Object.freeze({
  from: Object.freeze({ id: null, amount: 0 }),
  to: null,
  at: Number.NEGATIVE_INFINITY,
  mode: 'fade'
});

/**
 * Where a move stands at a moment:
 * - `id`, `amount`: the bead whose close view is in the shot and how far (eased: the shot is `shotToward` the close
 *   view by it), or null and 0 for the journey's shot alone;
 * - `dark`: a fade's first half, while the scene host is faded down;
 * - `moving`: the move is not over, so the canvas draws on;
 * - `engaged`: the camera is at a close view or on its way to or from one: the bead's label is away and the pointer
 *   hovers nothing.
 */
export interface FocusPose {
  id: ProjectId | null;
  amount: number;
  dark: boolean;
  moving: boolean;
  engaged: boolean;
}

/** Perlin's smootherstep: it leaves and arrives with no speed, so the flight is heavy and damped (spec §4). */
function flightEase(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Where `move` stands at `now` (ms).
 * - A flight eases from where it began to its end over FLIGHT_MS; its bead is the one it goes to (or, going out, the
 *   one it left), and once it is out the bead is let go.
 * - A fade holds the view it left while the host goes dark, FOCUS_FADE_MS, then stands at once on the view it went to.
 * A moment that is not a number reads as the move's start.
 */
export function focusPoseAt(move: FocusMove, now: number): FocusPose {
  const goal = move.to === null ? 0 : 1;
  const elapsed = now - move.at;
  const fromId = move.from.amount > 0 ? move.from.id : null;
  const fromAmount = fromId === null ? 0 : move.from.amount;
  if (move.mode === 'fade') {
    if (!(elapsed >= FOCUS_FADE_MS)) return { id: fromId, amount: fromAmount, dark: true, moving: true, engaged: true };
    return { id: move.to, amount: goal, dark: false, moving: false, engaged: move.to !== null };
  }
  const t = elapsed >= FLIGHT_MS ? 1 : elapsed > 0 ? elapsed / FLIGHT_MS : 0;
  const amount = fromAmount + (goal - fromAmount) * flightEase(t);
  const id = amount > 0 ? (move.to ?? fromId) : null;
  const moving = t < 1;
  return { id, amount: id === null ? 0 : amount, dark: false, moving, engaged: moving || move.to !== null };
}

/**
 * A new move to `to` (a bead's close view, or null for the journey's shot) begun at `now`, from wherever `move` stands
 * then, so a move turned back half way goes on from there. A flight goes between the journey and one bead; from one
 * bead's close view to another's there is no flight, and it fades.
 */
export function moveFocus(move: FocusMove, to: ProjectId | null, now: number, mode: FocusMode): FocusMove {
  const shown = focusPoseAt(move, now);
  const across = shown.id !== null && to !== null && shown.id !== to;
  return { from: { id: shown.id, amount: shown.amount }, to, at: now, mode: across ? 'fade' : mode };
}

/** The bead of a project id, if it has one. */
function beadOf(id: string): ProjectId | null {
  return BEADS.find((bead) => bead.id === id)?.id ?? null;
}

/**
 * The close view the page asks for: the bead being opened (`opening`: its flight runs on the home page until the
 * router goes to its page); else, on a project page (`scene` 'project', the phase PROJECT_FOCUS), its project's bead;
 * else none, the journey's shot.
 *
 * A PROJECT_FOCUS on the home page with nothing opening is a page that is being left and not yet synced: on Back or
 * Escape the scene turns 'home' in a layout effect (SceneHost) a moment before the route sync, a passive effect, puts
 * the story at the bead's stop and the phase on the scroll (src/state/routeSync.ts), and a canvas frame can fall
 * between the two. It asks for the close view it stands at (`current`, the last move's), so the move out is decided
 * only once the story is where Back puts it. With none (the proof bridge's OPEN_PROJECT on the home) it asks for none:
 * only a page, or a label's flight, brings a bead close.
 */
export function focusGoalFor(phase: Phase, scene: SceneKind | null, opening: ProjectId | null, current: ProjectId | null = null): ProjectId | null {
  if (opening !== null) return opening;
  if (phase.kind !== 'PROJECT_FOCUS') return null;
  if (scene === 'project') return beadOf(phase.id);
  return scene === 'home' ? current : null;
}

/** What a frame's focus step reads of the app: the store's phase, page and reduced motion, and the story's place. */
export interface FocusInput {
  phase: Phase;
  scene: SceneKind | null;
  reducedMotion: boolean;
  progress: number;
  target: number;
}

/**
 * The close view on a frame at `now`, the Opening's step of `focus` (`frame.focus`, in place): a new move is begun
 * first wherever the page asks for another close view than the last move goes to (`focusGoalFor`). Into a page's bead
 * that is a fade (the label's own flight was begun by its click, `openBead`); back out to the journey it is a flight
 * from the bead's own stop at rest (`restsAt`: the route sync put the story there and the void's hold let it stay),
 * and a fade otherwise, or with reduced motion.
 */
export function stepFocus(focus: { move: FocusMove; opening: ProjectId | null }, input: FocusInput, now: number): FocusPose {
  const leaving = focus.move.to;
  const goal = focusGoalFor(input.phase, input.scene, focus.opening, leaving);
  if (goal !== leaving) {
    const fly = goal === null && !input.reducedMotion && restsAt(leaving, input.progress, input.target);
    focus.move = moveFocus(focus.move, goal, now, fly ? 'fly' : 'fade');
  }
  return focusPoseAt(focus.move, now);
}

/**
 * Whether the story rests at bead `id`'s own stop: on its project stretch at its start (for the last bead, anywhere
 * on its stretch, which holds it), with the scroll's target there too. Only from there does a flight leave or arrive:
 * the shot at the stop is the one the flight eases from, and the bead stands there come forward.
 */
export function restsAt(id: ProjectId | null, progress: number, target: number): boolean {
  if (id === null || progress !== target) return false;
  const at = journeyAt(progress);
  return at.stretch === 'project' && at.local === 0 && at.project !== null && BEADS[at.project]?.id === id;
}
