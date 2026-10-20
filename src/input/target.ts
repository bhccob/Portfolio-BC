import { type ChapterAt, type Chapters, chapterAt, stops } from '~/state/chapters';
import { type Phase, SCROLL_PHASES } from '~/state/machine';

/** How near a stop the scroll counts as being on it, in units: a target a hair short of a stop is on the stop. */
const ON_STOP = 1e-6;

/**
 * Where the scroll target goes for a delta of `units` (one unit is a viewport height of scroll).
 * Normally it moves by the delta and stays inside the story, 0 to `c.total`. With reduced motion it does not
 * move by a distance but to a place: the next stop down the story for a delta down, the previous one up for
 * a delta up, whatever the size of the delta (a stop is the start of a chapter, or the end).
 */
export function moveTarget(target: number, units: number, c: Chapters, reducedMotion: boolean): number {
  if (!reducedMotion) return Math.min(Math.max(target + units, 0), c.total);
  if (units === 0) return target;
  const places = stops(c);
  if (units > 0) return places.find((stop) => stop > target + ON_STOP) ?? c.total;
  return places.findLast((stop) => stop < target - ON_STOP) ?? 0;
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
 * True when a delta of `units` has left `target` against an end of the story: a delta up at 0, or down at the end.
 * A glide that is pushing into the wall has nowhere to go, so it is ended instead of keeping the frame loop awake.
 */
export function pinnedAtEnd(target: number, units: number, c: Chapters): boolean {
  return (units < 0 && target <= 0) || (units > 0 && target >= c.total);
}

/** Where Home and End go: the start of the story and its end. */
export function jumpTarget(to: 'home' | 'end', c: Chapters): number {
  return to === 'home' ? 0 : c.total;
}

/**
 * Whether the scroll input takes the wheel, touch and keys: only with 3D on and only in the phases the scroll
 * moves through. Anywhere else (loading, a country in focus, a page) the input leaves the browser its own.
 */
export function scrollEnabled(state: { threeD: boolean; phase: Phase }): boolean {
  return state.threeD && SCROLL_PHASES.has(state.phase.kind);
}
