import { GESTURE_GAP_MS, GestureGroup } from './gesture';
import { Inertia } from './Inertia';
import { type KeyTarget, keyDelta } from './keyDelta';
import { normalizeWheel } from './normalizeWheel';

/**
 * Where a delta came from: the wheel, a finger on the glass, the glide a finger's lift left, a key pressed, a key held
 * down (its repeats), or a sideways drag of the ring (a mouse, a pen or a finger).
 */
export type DeltaSource = 'wheel' | 'finger' | 'glide' | 'key' | 'held' | 'drag';

/** Degrees of the ring a CSS px of a sideways drag turns it: one project, 120 degrees, is 480 px. */
export const DRAG_DEG = 0.25;

/** The degrees between two projects round the ring: a drag's units are its degrees over this. */
const PROJECT_DEG = 120;

/**
 * How far a touch or a press must go before it is a move and not a tap, px: a finger's first DRAG_LOCK_PX decide its
 * axis (sideways a ring drag, upright a scroll), and a mouse's decide that it drags.
 */
export const DRAG_LOCK_PX = 6;

/** The page's controls: a press on one is the control's, never a drag. */
const CONTROLS = 'a, button, input, select, textarea, summary, label';

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
   * The caller rests a gesture that came up out of the rise on its top from here (src/input/target.ts `restsAtTop`), and
   * counts the sheet's quiet from a lift. Without it nothing is told.
   */
  onGestureEnd?: (glide: number) => void;
  /**
   * A finger has come down on the glass, the scroll enabled: answers whether it took hold of the story (it halted a
   * settle under way). A touch that took hold is a gesture from its start, so its lift ends one (`onGestureEnd`) even
   * when it never moved: a tap.
   */
  onTouchDown?: () => boolean;
  /** Asked at every event: when false the input leaves the event to the browser, and prevents nothing. */
  enabled: () => boolean;
  reducedMotion: () => boolean;
  /**
   * Whether the gesture is the page's own (the end page, which scrolls as any page does: src/input/scrollLoop.ts), asked
   * with the way it goes, 1 down the story and -1 up, for every event the input would take, after `enabled`: when true
   * the event is left to the browser, which scrolls the page, and nothing is prevented, moved, swallowed or settled for
   * it. The answer is decided once per gesture and holds to its end, so a gesture never changes hands half-way (a fling
   * up the page that reaches its top stops there, and only a new gesture at the top is the story's):
   * - the wheel: its gesture's first event decides it for the whole gesture, until GESTURE_GAP_MS of quiet (an event that
   *   goes neither way, a sideways wheel, asks as one down);
   * - a finger: its first movement past the touch slop decides it for the whole drag, and a drag left to the page starts
   *   no glide at its lift;
   * - a key: each press decides alone, End as a key down; Home asks nothing, as it always goes to the story's start.
   * Without it nothing is the page's.
   */
  yields?: (direction: 1 | -1) => boolean;
  /**
   * Asked at every event the input takes (after `enabled` and `yields`, so it never changes what the browser keeps):
   * when true the event is taken and prevented as ever, and dropped. Nothing moves, no glide starts or goes on, and the
   * page does not scroll either, which is the point: the tail of the gesture that skipped the loader arrives after the
   * home has begun and must not scroll it. A tap is still the browser's, as ever; a swipe that is under way when
   * this turns false carries on from where the finger is. Without it nothing is dropped.
   */
  swallow?: () => boolean;
  /** Called when a glide begins (the finger lifted while moving), so a frame loop that went to sleep can run `step`. */
  wake?: () => void;
  /**
   * Whether a sideways drag may take the ring now, asked as a press or a touch begins and as a touch decides its axis:
   * the story stands in the ring (src/input/scrollLoop.ts). A drag then reports `onDelta(dx · DRAG_DEG / 120, 'drag')`
   * for every move, a mouse's or a pen's held down (pointer events) or a finger's that went sideways (touch events),
   * and nothing settles it: no gesture end, no glide. Without it no drag is taken, and a sideways swipe is ignored.
   */
  dragging?: () => boolean;
}

/** How far a finger must travel before it is a swipe and not a tap, in px: the drag's lock. */
const TOUCH_SLOP_PX = DRAG_LOCK_PX;
/** With reduced motion, how far a swipe must travel to take one step, in px. */
const SWIPE_STEP_PX = 40;

interface Drag {
  x0: number;
  y0: number;
  lastX: number;
  lastY: number;
  /** True once the movement went sideways in the ring: a drag of the ring, to its lift. */
  ring: boolean;
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
 * - a touch of two fingers (the pinch), a tap, or a swipe that goes sideways;
 * - a gesture or a key that `yields()` says is the page's own: one gesture, wheel or finger, stays the page's to its end.
 *
 * While `swallow()` says so it takes the events it would take and prevents them, but moves nothing for them.
 *
 * With reduced motion nothing glides and nothing moves by a distance: a whole wheel gesture (events less than
 * 250 ms apart), a swipe, or a key press gives one `onDelta`, which the caller turns into one step.
 *
 * Without it each wheel or touch gesture that moved the scroll is told when it ends (`onGestureEnd`).
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
  /** The finger down took hold of the story (`onTouchDown`): its lift ends a gesture even if it never moved. */
  private holding = false;
  /** Groups the wheel's events into the gestures `yields` decides, one answer each. */
  private readonly wheelGestures = new GestureGroup();
  /** The wheel's gesture under way is the page's (`yields` said so at its first event). */
  private wheelYielded = false;
  /** A mouse or a pen held down in the ring, and whether it has dragged past the lock; null while none is. */
  private press: { id: number; x0: number; lastX: number; moved: boolean } | null = null;
  /** A press has dragged the ring and let go: the click its release makes is swallowed, so it opens nothing. */
  private swallowClick = false;

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
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    this.view.addEventListener('keydown', this.onKey);
    this.view.addEventListener('click', this.onClick, { capture: true });
  }

  /** True while a glide is going, so the caller must keep calling `step` every frame. */
  get busy(): boolean {
    return this.inertia.active;
  }

  /** True while a wheel gesture waits out its quiet to end, so the caller must keep calling `step`, which counts it. */
  get waiting(): boolean {
    return this.quiet !== null;
  }

  /** True while a finger is on the glass and the input has it (its drag, or its hold of the story): it has not lifted. */
  get touching(): boolean {
    return this.drag !== null || this.holding;
  }

  /** True while the ring is being dragged, by a press or a finger. */
  private get draggingRing(): boolean {
    return this.press?.moved === true || this.drag?.ring === true;
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
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerUp);
    this.view.removeEventListener('keydown', this.onKey);
    this.view.removeEventListener('click', this.onClick, { capture: true });
    this.press = null;
    // The gesture under way is dropped, not ended: nobody is there to settle it.
    this.open = false;
    this.quiet = null;
    this.stop();
    this.gesture.reset();
    this.wheelGestures.reset();
    this.wheelYielded = false;
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
    const unit = this.opts.unitPx();
    const { px } = normalizeWheel(e, unit);
    if (this.wheelYields(e.timeStamp, px)) return; // the page's, as its whole gesture is: the browser scrolls it
    e.preventDefault();
    this.inertia.stop();
    if (this.opts.swallow?.()) {
      this.gesture.begins(e.timeStamp); // the burst goes on being one gesture, so its tail after the swallowing is no step
      return;
    }
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

  /**
   * Whether the wheel's event at `timeMs`, of `px` (down the story for a positive one), is the page's: the first event of
   * a gesture asks `yields`, and every other event of it, less than GESTURE_GAP_MS after the one before, keeps that
   * answer, whichever way it goes and whatever `yields` would say now. The gestures are told apart by the events' own
   * times, as reduced motion's steps are: a gesture left to the page wakes no frame that could count its quiet.
   */
  private wheelYields(timeMs: number, px: number): boolean {
    const yields = this.opts.yields;
    if (!yields) return false;
    if (this.wheelGestures.begins(timeMs)) this.wheelYielded = yields(px < 0 ? -1 : 1);
    return this.wheelYielded;
  }

  // ---------------------------------------------------------------- touch

  private readonly onTouchStart = (e: TouchEvent): void => {
    this.drag = null;
    if (!this.opts.enabled()) return;
    this.inertia.stop(); // a finger on the glass stops it
    this.holding = !this.opts.reducedMotion() && this.opts.onTouchDown?.() === true;
    if (this.holding) {
      this.open = true;
      this.quiet = null;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0]!;
    this.drag = { x0: touch.clientX, y0: touch.clientY, lastX: touch.clientX, lastY: touch.clientY, ring: false, total: 0, claimed: false };
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
    if (drag.ring) {
      // A drag of the ring, to its lift: every move turns it, whichever way it goes now.
      if (e.cancelable) e.preventDefault();
      this.dragBy(touch.clientX - drag.lastX);
      drag.lastX = touch.clientX;
      return;
    }
    if (!drag.claimed) {
      const dx = touch.clientX - drag.x0;
      const dy = touch.clientY - drag.y0;
      if (Math.hypot(dx, dy) < TOUCH_SLOP_PX) return; // still a tap, so the click stays possible
      if (Math.abs(dx) > Math.abs(dy)) {
        // A swipe sideways turns the ring, in the ring; anywhere else it is not the input's.
        if (this.opts.reducedMotion() || this.opts.dragging?.() !== true) {
          this.drag = null;
          return;
        }
        drag.ring = true;
        drag.claimed = true;
        if (e.cancelable) e.preventDefault();
        this.inertia.stop();
        this.dragBy(touch.clientX - drag.x0);
        drag.lastX = touch.clientX;
        return;
      }
      // A finger going up the glass goes down the story. A drag the page has (`yields`) is the browser's to its lift: it
      // scrolls the page, and the input neither prevents nor tracks any of it, so it leaves no glide.
      if (this.opts.yields?.(dy < 0 ? 1 : -1)) {
        this.drag = null;
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
    const holding = this.holding;
    this.holding = false;
    if (!drag?.claimed) {
      if (holding) this.endGesture(0); // a tap that took hold of the story (onTouchDown) ends its gesture; any other ends none
      return;
    }
    if (drag.ring) return; // a drag of the ring leaves the ring where it let go: no glide, nothing to settle
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

  // ---------------------------------------------------------------- the ring's drag: a mouse or a pen

  /** A drag of `dx` px, as the ring's turn in units: dropped while the input swallows. */
  private dragBy(dx: number): void {
    if (dx === 0 || this.opts.swallow?.()) return;
    this.opts.onDelta((dx * DRAG_DEG) / PROJECT_DEG, 'drag');
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.swallowClick = false;
    this.press = null;
    if (e.pointerType === 'touch' || e.button !== 0 || !this.opts.enabled()) return; // a finger is the touch events'
    if (this.opts.reducedMotion() || this.opts.dragging?.() !== true) return;
    if ((e.target as Element | null)?.closest?.(CONTROLS)) return; // a press on a control is the control's
    // Its mouse events are the drag's: no text is selected as it moves. The click its release makes still comes.
    e.preventDefault();
    this.press = { id: e.pointerId, x0: e.clientX, lastX: e.clientX, moved: false };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const press = this.press;
    if (press === null || e.pointerId !== press.id) return;
    if (!this.opts.enabled()) {
      this.press = null;
      return;
    }
    if (!press.moved) {
      if (Math.abs(e.clientX - press.x0) < DRAG_LOCK_PX) return; // still a click
      press.moved = true;
      this.inertia.stop();
    }
    this.dragBy(e.clientX - press.lastX);
    press.lastX = e.clientX;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const press = this.press;
    if (press === null || e.pointerId !== press.id) return;
    this.press = null;
    this.swallowClick = press.moved; // a release after a drag makes a click: it is the drag's, and opens nothing
  };

  /** The click a drag's release makes, swallowed before anything hears it (the Void's click on a bead, a link's). */
  private readonly onClick = (e: MouseEvent): void => {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // ---------------------------------------------------------------- keys

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (this.draggingRing) return; // a key pressed while the ring is dragged does nothing
    if (!this.opts.enabled()) return;
    const unit = this.opts.unitPx();
    const delta = keyDelta({ key: e.key, shiftKey: e.shiftKey, target: e.target as KeyTarget | null }, unit);
    if (delta === null) return;
    // Each key asks alone whether the page has it, End as a key down; Home always goes to the story's start.
    if (delta !== 'home' && this.opts.yields?.(delta === 'end' || delta > 0 ? 1 : -1)) return;
    e.preventDefault();
    if (typeof delta === 'string') {
      this.jump(delta);
      return;
    }
    this.inertia.stop();
    if (this.opts.swallow?.()) return;
    if (this.opts.reducedMotion() && e.repeat) return; // a held key is one step, not a run through the story
    this.opts.onDelta(delta / unit, e.repeat ? 'held' : 'key');
  };

  /**
   * Home's or End's jump (`to`), as a press of the key makes it once the input has taken it: the glide stopped, then
   * `onJump`. The keys come here, and so do the page's own ways to the story's ends: the header's name on the home
   * (src/input/scrollLoop.ts `HomeScroll.toTop`) and the nav's link to the end page (`HomeScroll.toEnd`). Answers whether
   * it moved the story: not while the input takes nothing (`enabled`), nor while a skipped loader's tail is being dropped
   * (`swallow`), which moves nothing. A key is taken and prevented then all the same (`onKey`), as the swallow takes every
   * key; a link that asked is left to do what it would do without the story, so the header's name navigates.
   */
  jump(to: 'home' | 'end'): boolean {
    if (!this.opts.enabled()) return false;
    this.inertia.stop();
    if (this.opts.swallow?.()) return false;
    this.opts.onJump(to);
    return true;
  }
}
