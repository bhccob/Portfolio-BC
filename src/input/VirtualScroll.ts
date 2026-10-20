import { GestureGroup } from './gesture';
import { Inertia } from './Inertia';
import { type KeyTarget, keyDelta } from './keyDelta';
import { normalizeWheel } from './normalizeWheel';

export interface VirtualScrollOptions {
  /** Pixels in one unit of scroll: the viewport's height (`window.innerHeight`). */
  unitPx: () => number;
  /** The scroll moved by `units` (signed; positive goes down the story). With reduced motion, a step: only the sign counts. */
  onDelta: (units: number) => void;
  /** Home or End. */
  onJump: (to: 'home' | 'end') => void;
  /** Asked at every event: when false the input leaves the event to the browser, and prevents nothing. */
  enabled: () => boolean;
  reducedMotion: () => boolean;
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
 * With reduced motion nothing glides and nothing moves by a distance: a whole wheel gesture (events less than
 * 250 ms apart), a swipe, or a key press gives one `onDelta`, which the caller turns into one step.
 */
export class VirtualScroll {
  private readonly inertia = new Inertia();
  private readonly gesture = new GestureGroup();
  private readonly view: Window;
  private drag: Drag | null = null;

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

  /** Advances the glide by `dtSec`, reporting its pixels through `onDelta`. */
  step(dtSec: number): void {
    if (!this.inertia.active) return;
    if (!this.opts.enabled()) {
      this.inertia.stop();
      return;
    }
    const px = this.inertia.step(dtSec);
    if (px !== 0) this.opts.onDelta(px / this.opts.unitPx());
  }

  /** Ends the glide that is going, or the speed a drag in progress has built up; the touch itself carries on. */
  stopGlide(): void {
    this.inertia.stop();
  }

  /** Ends any glide and forgets the touch in progress. */
  stop(): void {
    this.inertia.stop();
    this.drag = null;
  }

  dispose(): void {
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('touchstart', this.onTouchStart);
    this.el.removeEventListener('touchmove', this.onTouchMove);
    this.el.removeEventListener('touchend', this.onTouchEnd);
    this.el.removeEventListener('touchcancel', this.onTouchEnd);
    this.view.removeEventListener('keydown', this.onKey);
    this.stop();
    this.gesture.reset();
  }

  // ---------------------------------------------------------------- wheel

  private readonly onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey || e.defaultPrevented || !this.opts.enabled()) return;
    e.preventDefault();
    this.inertia.stop();
    const unit = this.opts.unitPx();
    const { px } = normalizeWheel(e, unit);
    if (px === 0) return;
    if (this.opts.reducedMotion()) {
      // A gesture is dozens of events (and a trackpad adds its momentum): only the first one is a step.
      if (this.gesture.begins(e.timeStamp)) this.opts.onDelta(px / unit);
      return;
    }
    this.opts.onDelta(px / unit);
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
    drag.total += px;
    if (this.opts.reducedMotion()) return; // one step when the finger lifts
    this.inertia.track(e.timeStamp, px);
    this.opts.onDelta(px / this.opts.unitPx());
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    const drag = this.drag;
    this.drag = null;
    if (!drag?.claimed || !this.opts.enabled()) return;
    if (e.type === 'touchcancel') {
      this.inertia.stop();
      return;
    }
    if (this.opts.reducedMotion()) {
      if (Math.abs(drag.total) >= SWIPE_STEP_PX) this.opts.onDelta(drag.total / this.opts.unitPx());
      return;
    }
    this.inertia.release(e.timeStamp);
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
    if (typeof delta === 'string') {
      this.opts.onJump(delta);
      return;
    }
    if (this.opts.reducedMotion() && e.repeat) return; // a held key is one step, not a run through the story
    this.opts.onDelta(delta / unit);
  };
}
