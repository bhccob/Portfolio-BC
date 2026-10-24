import { type ChapterAt, type Chapters, chapterAt, riseTop, scrollEnd, stops } from '~/state/chapters';
import { type Phase, SCROLL_PHASES } from '~/state/machine';

/** How near a stop the scroll counts as being on it, in units: a target a hair short of a stop is on the stop. */
const ON_STOP = 1e-6;

/**
 * Where the scroll target goes for a delta of `units` (one unit is a viewport height of scroll).
 * Normally it moves by the delta and stays inside the story, 0 to its last stop (`scrollEnd`). With reduced motion it
 * does not move by a distance but to a place: the next stop down the story for a delta down, the previous one up for
 * a delta up, whatever the size of the delta (a stop is the start of a chapter); none past the last.
 */
export function moveTarget(target: number, units: number, c: Chapters, reducedMotion: boolean): number {
  const end = scrollEnd(c);
  if (!reducedMotion) return Math.min(Math.max(target + units, 0), end);
  if (units === 0) return target;
  const places = stops(c);
  if (units > 0) return places.find((stop) => stop > target + ON_STOP) ?? end;
  return places.findLast((stop) => stop < target - ON_STOP) ?? 0;
}

/** True for a place on the rise, below its top (`riseTop`): there the scroll is continuous and nothing settles. */
export function onRise(place: number, c: Chapters): boolean {
  return place < riseTop(c) - ON_STOP;
}

/**
 * Where a key (an arrow, Page Up or Down, Space; `units` is its distance, signed) takes the target without reduced
 * motion. On the rise it moves by its distance, as M2a's keys did, but never past the rise's top, BOB from above, a
 * stop. From the top on it steps to the next stop down, or up to the one before, whatever its distance, as reduced
 * motion's steps do; up from the top it is back on the rise, by its distance again.
 */
export function keyTarget(target: number, units: number, c: Chapters): number {
  if (units === 0) return target;
  const top = riseTop(c);
  if (units > 0) return onRise(target, c) ? Math.min(target + units, top) : moveTarget(target, units, c, true);
  return target > top + ON_STOP ? moveTarget(target, units, c, true) : Math.max(target + units, 0);
}

/**
 * How far a wheel or a finger must take the target from a stop to go on to the next, px: under it the scroll eases
 * back to the stop. It is less than any one notch of a wheel (Firefox's three lines of `LINE_PX`, 48 px; Chromium's
 * and Safari's 100 to 120 px), so a single notch moves one stop, and it is the distance a swipe needs to take a step
 * with reduced motion (VirtualScroll's SWIPE_STEP_PX).
 */
export const SETTLE_SLOP_PX = 40;

/**
 * Where a wheel or touch gesture comes to rest without reduced motion, once it has ended: `from` is where its target
 * stood when it began, `to` where it ended (a finger's with the glide its lift would carry), `slop` SETTLE_SLOP_PX in
 * units. Past the rise's top every gesture rests on a stop, so a bead's label (which shows only at its stop) shows:
 * - in its direction of travel, on the stop it last passed or left, if it is no more than `slop` past it (a nudge eases
 *   back to the stop it began on; a fling that passed a stop by a hair rests there), else on the next stop on;
 * - a fling may so pass several stops; a single notch or a small swipe moves one;
 * - one that ended on a stop, or went nowhere, rests on it or on the nearer stop.
 * One that comes up out of the rise (`from` on it, travelling down) rests on its top, BOB from above, the end of M2a's
 * rise, unless it carried more than a whole unit past the top: that is a fling, and it settles as any other. One that
 * ends on the rise rests where it is (M2a's rise is continuous). Never past the last stop. The scroll's hold applies
 * after this, as to any input.
 */
export function settleTarget(from: number, to: number, c: Chapters, slop: number): number {
  const end = scrollEnd(c);
  const place = Math.min(Math.max(to, 0), end);
  if (onRise(place, c)) return place;
  const top = riseTop(c);
  if (onRise(from, c) && to > from && to <= top + 1 + ON_STOP) return top;
  const places = stops(c);
  const on = places.find((stop) => Math.abs(stop - place) <= ON_STOP);
  if (on !== undefined) return on;
  // Off a stop and past the rise's top, itself a stop: there is a stop on either side.
  const below = places.findLast((stop) => stop < place) ?? 0;
  const above = places.find((stop) => stop > place) ?? end;
  if (to > from) return place - below <= slop ? below : above;
  if (to < from) return above - place <= slop ? above : below;
  return place - below <= above - place ? below : above;
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
 * last stop), or at `limit`, the most the target may reach now (`holdLimit`; the end by default). A glide that is
 * pushing into the wall has nowhere to go, so it is ended instead of keeping the frame loop awake.
 */
export function pinnedAtEnd(target: number, units: number, c: Chapters, limit = scrollEnd(c)): boolean {
  return (units < 0 && target <= 0) || (units > 0 && target >= Math.min(limit, scrollEnd(c)));
}

/**
 * The most the target may reach under a hold of `hold` units (src/scene/bob/diveHold.ts `diveHoldFor`): the hold, kept
 * within the story, 0 to its last stop (one that is not a number holds nothing). With reduced motion, which rests on
 * stops alone and never travels between them, it is the last stop at or under the hold, so a step that the hold stops is
 * no step at all.
 */
export function holdLimit(hold: number, c: Chapters, reducedMotion: boolean): number {
  const end = scrollEnd(c);
  const limit = Number.isNaN(hold) ? end : Math.min(Math.max(hold, 0), end);
  if (!reducedMotion) return limit;
  return stops(c).findLast((stop) => stop <= limit + ON_STOP) ?? 0;
}

/**
 * Where a target that rests on a hold goes once the hold rises to `limit` (the void is ready), when the input had
 * asked for `asked`, past the old hold: on to the next stop at least (the dive goes on to its end, the overview), or as
 * far as it asked if that is further (End, a long wheel), and never past the new limit.
 */
export function releaseTarget(target: number, asked: number, limit: number, c: Chapters): number {
  return Math.min(limit, Math.max(asked, moveTarget(target, 1, c, true)));
}

/** Where Home and End go: the start of the story and its end, the last stop (the last bead's). */
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
