import { GESTURE_GAP_MS, GestureGroup } from './gesture';
import { Inertia } from './Inertia';
import { type KeyTarget, keyDelta } from './keyDelta';
import { normalizeWheel } from './normalizeWheel';

/**
 * Where a delta came from: the wheel, a finger on the glass, the glide a finger's lift left, a key pressed, or a key
 * held down (its repeats).
 */
export type DeltaSource = 'wheel' | 'finger' | 'glide' | 'key' | 'held';

export interface VirtualScrollOptions {
  /** Pixels in one unit of scroll: the viewport's height (`window.innerHeight`). */
  unitPx: () => number;
  /**
   * The scroll moved by `units` (signed; positive goes down the story), from `by`. With reduced motion, a step: only the
   * sign counts.
   */
  onDelta: (units: number, by: DeltaSource) => void;
  /** Home or End. */
  onJump: (to: 'home' | 'end') => void;
  /**
   * A wheel or touch gesture that moved the scroll has ended, without reduced motion (where each is already a step):
   * - the wheel's, once it has been quiet for GESTURE_GAP_MS, as the frames that `step` it count;
   * - a finger's, when it lifts; `glide` is how far, in units (signed), the glide its lift starts would carry, 0 for none,
   *   and the caller may end that glide (`stopGlide`) to settle the scroll itself;
   * - either, with no glide, when it is cut short: a touchcancel, a second finger, the scroll no longer enabled under
   *   it, or `stop`.
   * The caller settles its target on a stop from here (src/input/target.ts `settleTarget`). Without it nothing is told.
   */
  onGestureEnd?: (glide: number) => void;
  /** Asked at every event: when false the input leaves the event to the browser, and prevents nothing. */
  enabled: () => boolean;
  reducedMotion: () => boolean;
  /**
   * Asked at every event the input takes (after `enabled`, so it never changes what the browser keeps): when true
   * the event is taken and prevented as ever, and dropped. Nothing moves, no glide starts or goes on, and the page
   * does not scroll either, which is the point: the tail of the gesture that skipped the loader arrives after the
   * home has begun and must not scroll it. A tap is still the browser's, as ever; a swipe that is under way when
   * this turns false carries on from where the finger is. Without it nothing is dropped.
   */
  swallow?: () => boolean;
  /** Called when a glide begins (the finger lifted while moving), so a frame loop that went to sleep can run `step`. */
  wake?: () => void;
}

/** How far a finger must travel before it is a swipe and not a tap, in px. */
const TOUCH_SLOP_PX = 6;
/** With reduced motion, how far a swipe must travel to take one step, in px. */
const SWIPE_STEP_PX = 40;

interface Drag {
  x0: number;
  y0: number;
  lastY: number;
  /** Everything the finger moved since the slop was passed, in the scroll's direction (px). */
  total: number;
  /** True once the movement is a vertical swipe: from then on the input has the touch. */
  claimed: boolean;
}

/**
 * Turns the wheel, a finger and the keyboard into scroll deltas, in units of a viewport height. It does not
 * scroll anything itself and it keeps no position: the caller moves its own target by `onDelta` and `onJump`.
 *
 * It is bound to the element it is given, which for the home page is the document element: the page covers
 * the canvas, so an event aimed at the canvas never arrives. Keys are heard on the window.
 *
 * The input takes an event, and prevents the browser's own handling of it, only while `enabled()` says so,
 * and never takes:
 * - a wheel with ctrl held (a pinch, the browser's zoom);
 * - a key with ctrl, meta or alt held, one already handled, one typed into a text field (see `keyDelta`);
 * - a touch of two fingers (the pinch), a tap, or a swipe that goes sideways.
 *
 * While `swallow()` says so it takes the events it would take and prevents them, but moves nothing for them.
 *
 * With reduced motion nothing glides and nothing moves by a distance: a whole wheel gesture (events less than
 * 250 ms apart), a swipe, or a key press gives one `onDelta`, which the caller turns into one step.
 *
 * Without it each wheel or touch gesture that moved the scroll is told when it ends (`onGestureEnd`), so the caller
 * can settle the story on a stop.
 */
export class VirtualScroll {
  private readonly inertia = new Inertia();
  private readonly gesture = new GestureGroup();
  private readonly view: Window;
  private drag: Drag | null = null;
  /** A wheel or touch gesture has moved the scroll and has not yet ended (`onGestureEnd`). */
  private open = false;
  /** Ms of quiet since the wheel's last event, while a wheel gesture is open and no finger has taken it over; else null. */
  private quiet: number | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly opts: VirtualScrollOptions,
  ) {
    this.view = el.ownerDocument.defaultView ?? window;
    // passive: false on the two that may prevent the browser's scroll; the others never prevent anything.
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    this.view.addEventListener('keydown', this.onKey);
  }

  /** True while a glide is going, so the caller must keep calling `step` every frame. */
  get busy(): boolean {
    return this.inertia.active;
  }

  /** True while a wheel gesture waits out its quiet to end, so the caller must keep calling `step`, which counts it. */
  get waiting(): boolean {
    return this.quiet !== null;
  }

  /**
   * Advances the glide by `dtSec`, reporting its pixels through `onDelta`, and counts a wheel gesture's quiet, ending the
   * gesture once there has been GESTURE_GAP_MS of it.
   */
  step(dtSec: number): void {
    if (this.inertia.active) {
      if (!this.opts.enabled() || this.opts.swallow?.()) {
        this.inertia.stop();
      } else {
        const px = this.inertia.step(dtSec);
        if (px !== 0) this.opts.onDelta(px / this.opts.unitPx(), 'glide');
      }
    }
    if (this.quiet === null) return;
    this.quiet += Math.max(dtSec, 0) * 1000;
    if (this.quiet >= GESTURE_GAP_MS) this.endGesture(0);
  }

  /** Ends the glide that is going, or the speed a drag in progress has built up; the touch itself carries on. */
  stopGlide(): void {
    this.inertia.stop();
  }

  /** Ends any glide, forgets the touch in progress, and ends the gesture under way (`onGestureEnd`, with no glide). */
  stop(): void {
    this.inertia.stop();
    this.drag = null;
    this.endGesture(0);
  }

  dispose(): void {
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('touchstart', this.onTouchStart);
    this.el.removeEventListener('touchmove', this.onTouchMove);
    this.el.removeEventListener('touchend', this.onTouchEnd);
    this.el.removeEventListener('touchcancel', this.onTouchEnd);
    this.view.removeEventListener('keydown', this.onKey);
    // The gesture under way is dropped, not ended: nobody is there to settle it.
    this.open = false;
    this.quiet = null;
    this.stop();
    this.gesture.reset();
  }

  /** The gesture under way has ended: tells the caller once, with the glide its end leaves (units). */
  private endGesture(glide: number): void {
    this.quiet = null;
    if (!this.open) return;
    this.open = false;
    this.opts.onGestureEnd?.(glide);
  }

  // ---------------------------------------------------------------- wheel

  private readonly onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || e.defaultPrevented || !this.opts.enabled()) return;
    e.preventDefault();
    this.inertia.stop();
    if (this.opts.swallow?.()) {
      this.gesture.begins(e.timeStamp); // the burst goes on being one gesture, so its tail after the swallowing is no step
      return;
    }
    const unit = this.opts.unitPx();
    const { px } = normalizeWheel(e, unit);
    if (px === 0) return;
    if (this.opts.reducedMotion()) {
      // A gesture is dozens of events (and a trackpad adds its momentum): only the first one is a step.
      if (this.gesture.begins(e.timeStamp)) this.opts.onDelta(px / unit, 'wheel');
      return;
    }
    // The gesture goes on until the wheel has been quiet for GESTURE_GAP_MS (a trackpad's momentum is part of it).
    this.open = true;
    this.quiet = 0;
    this.opts.onDelta(px / unit, 'wheel');
  };

  // ---------------------------------------------------------------- touch

  private readonly onTouchStart = (e: TouchEvent): void => {
    this.drag = null;
    if (!this.opts.enabled()) return;
    this.inertia.stop(); // a finger on the glass stops it
    if (e.touches.length !== 1) return;
    const touch = e.touches[0]!;
    this.drag = { x0: touch.clientX, y0: touch.clientY, lastY: touch.clientY, total: 0, claimed: false };
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    if (!this.opts.enabled() || e.touches.length !== 1) {
      this.drag = null; // a second finger is a pinch, which the browser has
      this.inertia.stop();
      this.endGesture(0);
      return;
    }
    const touch = e.touches[0]!;
    if (!drag.claimed) {
      const dx = touch.clientX - drag.x0;
      const dy = touch.clientY - drag.y0;
      if (Math.hypot(dx, dy) < TOUCH_SLOP_PX) return; // still a tap, so the click stays possible
      if (Math.abs(dx) > Math.abs(dy)) {
        this.drag = null; // a swipe sideways is not the scroll's
        return;
      }
      drag.claimed = true;
    }
    if (e.cancelable) e.preventDefault();
    const px = drag.lastY - touch.clientY; // the finger goes up, the story goes down
    drag.lastY = touch.clientY;
    if (this.opts.swallow?.()) return; // dropped, but the finger stays the input's: the page does not scroll under it
    drag.total += px;
    if (this.opts.reducedMotion()) return; // one step when the finger lifts
    // The finger has the gesture now, to its lift: a wheel's quiet no longer ends it.
    this.open = true;
    this.quiet = null;
    this.inertia.track(e.timeStamp, px);
    this.opts.onDelta(px / this.opts.unitPx(), 'finger');
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    const drag = this.drag;
    this.drag = null;
    if (!drag?.claimed) return;
    if (!this.opts.enabled() || e.type === 'touchcancel' || this.opts.swallow?.()) {
      this.inertia.stop();
      this.endGesture(0);
      return;
    }
    if (this.opts.reducedMotion()) {
      if (Math.abs(drag.total) >= SWIPE_STEP_PX) this.opts.onDelta(drag.total / this.opts.unitPx(), 'finger');
      return;
    }
    this.inertia.release(e.timeStamp);
    // The lift ends the gesture, with the glide it would leave; the caller may end that glide itself.
    this.endGesture(this.inertia.distance / this.opts.unitPx());
    if (this.inertia.active) this.opts.wake?.();
  };

  // ---------------------------------------------------------------- keys

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (!this.opts.enabled()) return;
    const unit = this.opts.unitPx();
    const delta = keyDelta({ key: e.key, shiftKey: e.shiftKey, target: e.target as KeyTarget | null }, unit);
    if (delta === null) return;
    e.preventDefault();
    this.inertia.stop();
    if (this.opts.swallow?.()) return;
    if (typeof delta === 'string') {
      this.opts.onJump(delta);
      return;
    }
    if (this.opts.reducedMotion() && e.repeat) return; // a held key is one step, not a run through the story
    this.opts.onDelta(delta / unit, e.repeat ? 'held' : 'key');
  };
}
