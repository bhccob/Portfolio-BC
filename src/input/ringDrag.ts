/**
 * The Q&A's gold ring by hand (spec 2026-10-29-bob-stack-2-design.md, goal 1: "A drag turns it by hand and lets go onto
 * the nearest question"). A mouse pressed and moved sideways turns the ring by `drag`, one question for each
 * `RING_DRAG_PX` (to the left brings the next one round to the front, as the mock-up's ring turned under the hand); let
 * go, it `release`s, and the scroll turns it on to the nearest question (src/input/scrollLoop.ts `releaseRing`). A press
 * that moves less than `SLOP` is no drag, so a click on a mark stays a click. The mouse only: on a touch screen a swipe
 * is the scroll's step. Only while `active` (the Q&A shown) when the press begins.
 */

/** A drag of this many pixels turns the ring one question. */
export const RING_DRAG_PX = 160;

/** A press that moves less than this, px, is no drag. */
const SLOP = 6;

export interface RingDragWays {
  /** Turns the ring by `units` of the scroll, a question each (positive toward the end). */
  drag(units: number): void;
  /** The drag is over: the ring goes on to the nearest question. */
  release(): void;
}

/** Listens on `target` for a mouse's drags of the ring; answers its taking down. */
export function ringDragOn(target: EventTarget, ways: RingDragWays, active: () => boolean): () => void {
  let held: { from: number; last: number; moved: boolean } | null = null;
  const down = (event: Event): void => {
    const e = event as PointerEvent;
    if (e.pointerType !== 'mouse' || e.button !== 0 || !active()) return;
    held = { from: e.clientX, last: e.clientX, moved: false };
  };
  const move = (event: Event): void => {
    const e = event as PointerEvent;
    if (held === null || e.pointerType !== 'mouse') return;
    if (!held.moved && Math.abs(e.clientX - held.from) <= SLOP) return;
    held.moved = true;
    ways.drag(-(e.clientX - held.last) / RING_DRAG_PX);
    held.last = e.clientX;
  };
  const up = (): void => {
    if (held?.moved) ways.release();
    held = null;
  };
  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
  };
}
