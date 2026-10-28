import { LANDING_HOLD } from '~/scene/bob/landingHold';
import { type ChapterAt, type Chapters, chapterAt, keyStops, riseTop, scrollEnd, sheetStart } from '~/state/chapters';
import { type Phase, SCROLL_PHASES } from '~/state/machine';
import type { VoidState } from '~/state/store';

/** How near a stop the scroll counts as being on it, in units: a target a hair short of a stop is on the stop. */
const ON_STOP = 1e-6;

/**
 * The stops a key, and reduced motion's every input, steps among for the void's state (`VoidState`,
 * src/scene/bob/Void.tsx): the key stops (`keyStops`: the home, BOB from above, each fact at its full strength, each
 * project's arrival and inside, the look back, the end page) while the void is there or still to come, and with the
 * void failed only the home, BOB from above, the landing hold (src/scene/bob/landingHold.ts, where the scroll holds
 * then) and the end page, so nothing steps to a place on a path whose beads are not there. The scroll input steps its
 * keys among them (src/input/scrollLoop.ts).
 */
export function stopsFor(c: Chapters, voidState: VoidState): number[] {
  if (voidState !== 'failed') return keyStops(c);
  // The way in and the fall still play: the key stops short of the hold (the home, BOB from above, the facts), the hold.
  return [...keyStops(c).filter((place) => place < LANDING_HOLD), LANDING_HOLD, scrollEnd(c)];
}

/**
 * Where the scroll target goes for a delta of `units` (one unit is a viewport height of scroll).
 * Normally it moves by the delta and stays inside the story, 0 to the end page (`scrollEnd`). With reduced motion it
 * does not move by a distance but to a place: the next stop down the story for a delta down, the previous one up for
 * a delta up, whatever the size of the delta; none past the last. The stops are `places`, in order: the key stops
 * (`keyStops`) unless given (`stopsFor` the void's state).
 */
export function moveTarget(target: number, units: number, c: Chapters, reducedMotion: boolean, places: readonly number[] = keyStops(c)): number {
  const end = scrollEnd(c);
  if (!reducedMotion) return Math.min(Math.max(target + units, 0), end);
  if (units === 0) return target;
  if (units > 0) return places.find((stop) => stop > target + ON_STOP) ?? end;
  return places.findLast((stop) => stop < target - ON_STOP) ?? 0;
}

/** True for a place on the rise, below its top (`riseTop`): there the scroll is M2a's, and a key moves by its distance. */
export function onRise(place: number, c: Chapters): boolean {
  return place < riseTop(c) - ON_STOP;
}

/**
 * Where a key (an arrow, Page Up or Down, Space; `units` is its distance, signed) takes the target without reduced
 * motion. On the rise it moves by its distance, as M2a's keys did, but never past the rise's top, BOB from above, a
 * stop. From the top on it steps to the next stop down, or up to the one before, whatever its distance, as reduced
 * motion's steps do (among `places`, the key stops unless given): in the light dive from fact to fact, then from project
 * to project and on to the end page; up from the top it is back on the rise, by its distance again.
 */
export function keyTarget(target: number, units: number, c: Chapters, places: readonly number[] = keyStops(c)): number {
  if (units === 0) return target;
  const top = riseTop(c);
  if (units > 0) return onRise(target, c) ? Math.min(target + units, top) : moveTarget(target, units, c, true, places);
  return target > top + ON_STOP ? moveTarget(target, units, c, true, places) : Math.max(target + units, 0);
}

/**
 * How far a finger must take the story from the end page of a failed void before it steps back (src/input/scrollLoop.ts),
 * px: under it the story stays there, so a touch that only wavers, or a pull at the page's top, makes no fade. It is the
 * distance a swipe needs to take a step with reduced motion (VirtualScroll's SWIPE_STEP_PX).
 */
export const SETTLE_SLOP_PX = 40;

/**
 * Whether a wheel or touch gesture rests on the rise's top, BOB from above, once it has ended: one that came up out of
 * the rise (`from` on it, travelling down, `direction` by default the sign of `to - from`) and ended past the top by no
 * more than a whole unit, the end of M2a's rise; further it is a fling, and rests where it ends, as every gesture past the
 * rise does. One that ends on the rise rests where it is (M2a's rise is continuous).
 */
export function restsAtTop(from: number, to: number, c: Chapters, direction = Math.sign(to - from)): boolean {
  const top = riseTop(c);
  return onRise(from, c) && direction > 0 && !onRise(to, c) && to <= top + 1 + ON_STOP;
}

/** A sheet stopped under this share of its way up goes back down onto the look back, whichever way the scroll went. */
export const SHEET_BACK = 0.03;

/**
 * Where the sheet finishes once the scroll has stopped part-way up it, at `place` ("Follow, then finish", spec
 * 2026-10-25-bob-light-dive-design.md): on up to the end page if the last move went down (`direction` above 0) and the
 * sheet is at least SHEET_BACK up, else back down onto the look back, the sheet's start. Null off the sheet, and at
 * its two ends, where there is nothing to finish: the path never moves by itself.
 */
export function finishTarget(place: number, direction: number, c: Chapters): number | null {
  const start = sheetStart(c);
  const end = scrollEnd(c);
  if (!(place > start && place < end)) return null;
  return direction > 0 && place - start >= SHEET_BACK * (end - start) ? end : start;
}

/**
 * The chapter progress has moved into since the last frame, or null when it is still in the one it was in
 * (`chapterIndex`). While the story moves, the chapter it was in is kept within HYSTERESIS of its edges, so a
 * position that wobbles on a boundary does not change chapter back and forth. At rest (`settled`) nothing
 * wobbles, and a position exactly on a boundary (a reduced-motion stop is one) belongs to the chapter that starts
 * there, not to the one it came from: a settled story is read without the hysteresis.
 */
export function changedChapter(c: Chapters, progress: number, chapterIndex: number, settled: boolean): ChapterAt | null {
  const at = chapterAt(c, progress, settled ? undefined : { index: chapterIndex });
  return at.index === chapterIndex ? null : at;
}

/**
 * True when a delta of `units` has left `target` against an end of the story: a delta up at 0, or down at the end (the
 * end page), or at `limit`, the most the target may reach now (`holdLimit`; the end by default). A glide that is
 * pushing into the wall has nowhere to go, so it is ended instead of keeping the frame loop awake.
 */
export function pinnedAtEnd(target: number, units: number, c: Chapters, limit = scrollEnd(c)): boolean {
  return (units < 0 && target <= 0) || (units > 0 && target >= Math.min(limit, scrollEnd(c)));
}

/**
 * The most the target may reach under a hold of `hold` units (src/scene/bob/landingHold.ts `landingHoldFor`): the hold,
 * kept within the story, 0 to the end page (one that is not a number holds nothing). With reduced motion, which rests on
 * stops alone and never travels between them, it is the last of `places` (the key stops unless given) at or under the
 * hold, so a step that the hold stops is no step at all.
 */
export function holdLimit(hold: number, c: Chapters, reducedMotion: boolean, places: readonly number[] = keyStops(c)): number {
  const end = scrollEnd(c);
  const limit = Number.isNaN(hold) ? end : Math.min(Math.max(hold, 0), end);
  if (!reducedMotion) return limit;
  return places.findLast((stop) => stop <= limit + ON_STOP) ?? 0;
}

/**
 * Where a target that rests on a hold goes once the hold rises to `limit` (the beads are ready), when the input had
 * asked for `asked`, past the old hold: on to the next key stop at least (from the landing hold, Steady's arrival), or as far
 * as it asked if that is further (End, a long wheel), and never past the new limit.
 */
export function releaseTarget(target: number, asked: number, limit: number, c: Chapters): number {
  return Math.min(limit, Math.max(asked, moveTarget(target, 1, c, true)));
}

/** Where Home and End go: the start of the story and its end, the end page's stop. */
export function jumpTarget(to: 'home' | 'end', c: Chapters): number {
  return to === 'home' ? 0 : scrollEnd(c);
}

/**
 * Whether the scroll input takes the wheel, touch and keys: only with 3D on and only in the phases the scroll
 * moves through. Anywhere else (loading, a page) the input leaves the browser its own.
 */
export function scrollEnabled(state: { threeD: boolean; phase: Phase }): boolean {
  return state.threeD && SCROLL_PHASES.has(state.phase.kind);
}
