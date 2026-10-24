import { END_ATTRIBUTE, pageToTop } from '~/scene/bob/endView';
import { STEP_FADE_ATTRIBUTE, STEP_FADE_MS } from '~/scene/bob/stepFade';
import { type ChapterAt, type Chapters, chapterAt, riseTop, scrollEnd } from '~/state/chapters';
import type { VoidState } from '~/state/store';
import { changedChapter, END_WHEEL_SLOP_PX, holdLimit, jumpTarget, keyTarget, moveTarget, onRise, pinnedAtEnd, releaseTarget, SETTLE_SLOP_PX, settleTarget, stopsFor } from './target';
import { VirtualScroll } from './VirtualScroll';

/** maath's `damp`: moves `current[prop]` toward `target` and says whether it is still moving. */
export type Smooth = typeof import('maath/easing').damp;

/** The values the loop reads and writes: the fields of `~/state/frame` it uses. */
export type ScrollFrame = { progress: number; target: number; velocity: number; chapterIndex: number };

/** What the loop needs of the input's glide. */
export interface Glide {
  /** True while a glide is going, or a gesture waits to end, so the loop must keep running. */
  readonly busy: boolean;
  /** Advances the glide by `dtSec`; it moves `frame.target` through the input's own delta. */
  step(dtSec: number): void;
  stop(): void;
}

/**
 * About how long `progress` takes to catch up with `target`, in seconds, by the stretch the story moves through. maath's
 * `damp` covers 99 % of a one-unit move in about 3.3 times its smooth time:
 * - the rise keeps M2a's quick pace (about 0.8 s from the home to BOB from above), which Bob approved;
 * - the dive takes its time, about 3.7 s from BOB from above to the overview, most of it in the first 2 s (Bob,
 *   2026-10-24: the dive was too fast; the Blender preview he approved took about 5 s);
 * - a move between the overview and the beads takes about 2.3 s.
 */
export const RISE_SMOOTH = 0.25;
export const DIVE_SMOOTH = 1.1;
export const GLIDE_SMOOTH = 0.7;

/**
 * The smooth time for a story at `progress` moving toward `target`: the pace of the stretch it moves through. At a stop
 * it reads the stretch on the target's side, so leaving BOB from above upward is the rise and downward the dive.
 */
export function smoothTimeAt(c: Chapters, progress: number, target: number): number {
  const p = Number.isFinite(progress) ? progress : 0;
  const toward = Number.isFinite(target) && target !== p ? Math.sign(target - p) * 1e-6 : 0;
  const index = chapterAt(c, p + toward).index;
  return index === 0 ? RISE_SMOOTH : index === 1 ? DIVE_SMOOTH : GLIDE_SMOOTH;
}

/**
 * The end page stands at rest (`<html data-end="rest">`, written by Home's end view, src/scene/bob/endView.ts): in the
 * page's flow, the document scrolling as any page does. Read off the attribute, so the input knows nothing of Home.
 */
function atEnd(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute(END_ATTRIBUTE) === 'rest';
}

/**
 * Whether an input that goes `direction` (1 down the story, -1 up) is the page's own (VirtualScroll's `yields`): at the
 * end page at rest, every input down, and every input up while the page is scrolled down. At the page's top an input up
 * is the story's: back to Cookies Clicker.
 */
function endPageYields(direction: 1 | -1): boolean {
  return atEnd() && (direction > 0 || window.scrollY > 0);
}

/** Within this many units of the target, progress is on it and the loop sleeps. */
const SETTLED = 1e-4;
/**
 * Within this many units of the end page's stop (the target on `scrollEnd`), progress is on it: the move's 99 % (Ruling
 * 18). The night's smoothstep there is at about 0.9997, so what is left of the page's rise is about 0.1 px and of the
 * night's overlay about 0.0003 of its strength, nothing a visitor sees; the last 1 % of the damp at the beads' pace would
 * take about 1.8 s more, the page looking arrived all the while but still inert, its wheel still the story's. Every other
 * stop, Cookies Clicker's on the way back included, keeps SETTLED.
 */
export const END_SETTLED = 0.01;
/** A frame is never longer than this, in seconds: a tab that was in the background must not lurch the scene. */
const MAX_DT = 0.1;

/** The smoothing when `damp` could not be loaded: no smoothing, progress is the target. */
const snap: Smooth = (current, prop, target) => {
  current[prop] = target;
  return false;
};

export interface ScrollLoopOptions {
  frame: ScrollFrame;
  chapters: Chapters;
  glide: Glide;
  /** Fetches `damp`; called once, when the first move needs it. */
  loadSmooth: () => Promise<Smooth>;
  /** requestAnimationFrame and cancelAnimationFrame, injected so a test owns the frames. */
  request: (callback: (now: number) => void) => number;
  cancel: (id: number) => void;
  /** Whether the 3D switch is on; the loop does not run, and ends a glide, while it is off. */
  threeD: () => boolean;
  /** Progress has moved into another chapter. */
  onChapter: (at: ChapterAt) => void;
  /**
   * Whether the story goes from `progress` to `target` by the step fade instead of travelling there, asked at every
   * frame: with the void failed, a move across the void that is not there (`startHomeScroll`). Without it every move
   * travels.
   */
  fades?: (progress: number, target: number) => boolean;
  /**
   * The step fade's scene host goes dark (true, as a fade begins) or fades back (false, once the frame the progress jumped
   * in is drawn, or the fade is let go): `<html data-step-fade>` (src/styles/base.css). Without it nothing is shown.
   */
  onFade?: (dark: boolean) => void;
}

/**
 * The frame loop of the home page's story: it moves `frame.progress` toward `frame.target`, steps the input's
 * glide, keeps `frame.chapterIndex` in step with the chapters and reports a chapter change. It runs a frame
 * at a time and sleeps when progress is on the target and nothing glides; `wake()` starts it again. Progress is on the
 * target within SETTLED of it, or within END_SETTLED (the move's 99 %) when the target is the end page's stop, and the
 * frame it arrives in lands it there exactly: so the end page comes to rest when it looks arrived.
 *
 * Exactly one frame is ever pending. `wake()` is called by the input at every delta, and a glide's `step`
 * makes deltas from inside a tick, so a `wake()` during a tick does nothing: the tick decides at its end
 * whether to ask for the next frame.
 *
 * **The step fade.** A move that `fades` says is made by the step fade (with the void failed, one across the void that is
 * not there) is never travelled: the scene host goes dark over STEP_FADE_MS (`onFade(true)`) while the progress waits
 * where it stands, then the progress jumps to the target, and the frame after, the jump drawn under the dark host, the
 * host fades back (`onFade(false)`). As reduced motion's step does (src/scene/bob/stepFade.ts `stepFadeAt`), a story
 * that turns back to the side it stands on before the host is dark lets the fade go, and nothing jumps.
 */
export class ScrollLoop {
  private raf = 0; // the pending frame; 0 for none
  private last = 0; // the time of the last tick; 0 after a sleep
  private ticking = false;
  private disposed = false;
  private loading = false;
  private smooth: Smooth | null = null;
  /** The step fade under way, or null: when its host is dark (the frames' clock, ms), and whether the progress has jumped. */
  private fade: { darkAt: number; jumped: boolean } | null = null;

  constructor(private readonly o: ScrollLoopOptions) {}

  /** Starts the loop if there is something to do and it is not already running. */
  readonly wake = (): void => {
    if (this.disposed || this.ticking || this.raf !== 0) return;
    if (!this.o.threeD() || !this.needsFrames()) return;
    if (this.smooth) {
      this.last = 0;
      this.raf = this.o.request(this.tick);
      return;
    }
    if (this.loading) return; // inputs meanwhile only move the target
    this.loading = true;
    this.o.loadSmooth().then(
      (damp) => this.loaded(damp),
      // The browser has already reported the failed fetch. Without damp the story still has to arrive: it snaps.
      () => this.loaded(snap),
    );
  };

  /**
   * Stops the story where it stands: the target on the progress, no velocity, and the damping's own speed let go (maath's
   * `damp` keeps it on the frame object, as `__damp`), so it neither runs on nor jumps when it next moves.
   */
  halt(): void {
    this.o.frame.target = this.o.frame.progress;
    this.letGo();
  }

  /** Lets the damping's speed go and leaves the target where it is, so a story that must turn back turns at once. */
  letGo(): void {
    const { frame } = this.o;
    frame.velocity = 0;
    const state = (frame as { __damp?: Record<string, number> }).__damp;
    if (state) for (const key of Object.keys(state)) state[key] = 0;
  }

  /**
   * Ends the loop: the pending frame is cancelled, a tick that is already queued does nothing, no velocity is left behind,
   * and no step fade leaves the host dark.
   */
  dispose(): void {
    this.disposed = true;
    if (this.raf !== 0) this.o.cancel(this.raf);
    this.raf = 0;
    this.o.frame.velocity = 0;
    this.endFade();
  }

  private loaded(smooth: Smooth): void {
    this.smooth = smooth;
    this.wake();
  }

  /**
   * Whether the loop has something to do: progress more than `settled` off its target, a glide going, or a step fade
   * under way. `wake` asks with SETTLED, so a story left within END_SETTLED of the end page (3D switched off, or the home
   * left, mid-move) still gets the frame that lands it there.
   */
  private needsFrames(settled = SETTLED): boolean {
    return Math.abs(this.o.frame.target - this.o.frame.progress) > settled || this.o.glide.busy || this.fade !== null;
  }

  /** How near its target progress is on it: END_SETTLED with the target on the end page's stop, else SETTLED. */
  private settledFor(target: number): number {
    return target === scrollEnd(this.o.chapters) ? END_SETTLED : SETTLED;
  }

  /** The step fade under way is over: its host fades back. */
  private endFade(): void {
    if (this.fade === null) return;
    this.fade = null;
    this.o.onFade?.(false);
  }

  /**
   * The step fade's part of a frame at `now` (the class's doc, "The step fade"): answers whether it has the progress this
   * frame, which then waits where it stands, or jumps to the target once the host is dark.
   */
  private stepFade(now: number): boolean {
    const { frame } = this.o;
    if (this.fade?.jumped) this.endFade(); // the jump has been drawn under the dark host: it fades back
    const across = this.o.fades?.(frame.progress, frame.target) === true;
    if (this.fade === null) {
      if (!across) return false;
      this.fade = { darkAt: now + STEP_FADE_MS, jumped: false };
      this.letGo();
      this.o.onFade?.(true);
      return true;
    }
    if (!across) {
      // Turned back to the side it stands on before the host was dark: nothing jumps, and the host fades back from there.
      this.endFade();
      return false;
    }
    if (now < this.fade.darkAt) return true;
    frame.progress = frame.target;
    this.fade.jumped = true;
    return true;
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.smooth) return;
    const { frame, chapters, glide } = this.o;
    if (!this.o.threeD()) {
      glide.stop(); // 3D was switched off while it ran: the glide ends, the story stays where it is
      frame.velocity = 0;
      this.endFade(); // and a step fade is let go, so the host is not left dark
      return;
    }
    const dt = this.last === 0 ? 1 / 60 : Math.min(Math.max((now - this.last) / 1000, 0), MAX_DT);
    this.last = now;

    this.ticking = true;
    try {
      glide.step(dt);
      const before = frame.progress;
      const faded = this.stepFade(now);
      const settled = this.settledFor(frame.target);
      if (!faded) this.smooth(frame, 'progress', frame.target, smoothTimeAt(chapters, frame.progress, frame.target), dt, Infinity, undefined, settled);
      const arrived = !this.needsFrames(settled);
      if (arrived) {
        frame.progress = frame.target; // on it, exactly: the next frame would snap it, but the loop sleeps first
        // At the end page the damping still has some speed at 99 % (about 0.025 units a second): it is let go with the
        // rest, so a move off the end page leaves from a standstill.
        if (settled === END_SETTLED) this.letGo();
      }
      frame.velocity = faded || arrived || dt <= 0 ? 0 : (frame.progress - before) / dt;

      const at = changedChapter(chapters, frame.progress, frame.chapterIndex, arrived || faded);
      if (at) {
        frame.chapterIndex = at.index;
        this.o.onChapter(at);
      }
      if (!arrived && !this.disposed) this.raf = this.o.request(this.tick);
    } finally {
      this.ticking = false;
    }
  };
}

export interface HomeScrollOptions extends Omit<ScrollLoopOptions, 'glide' | 'fades' | 'onFade'> {
  el: HTMLElement;
  /** Pixels in one unit of scroll: the viewport's height. */
  unitPx: () => number;
  /** Whether the input takes events now (3D on, a phase the scroll moves through); asked at every event. */
  enabled: () => boolean;
  reducedMotion: () => boolean;
  /** Whether the input drops what it takes now, still preventing it (`VirtualScrollOptions.swallow`); asked at every event. */
  swallow?: () => boolean;
  /**
   * The most the target may reach now, in units (src/scene/bob/diveHold.ts `diveHoldFor`: the dive holds over the tunnel's
   * opening while the void loads), asked at every input and at `holdChanged`; with reduced motion the last stop at or under it
   * (`holdLimit`). Without it nothing holds but the end of the story.
   */
  hold?: () => number;
  /**
   * Whether the hold now is one that lifts by itself (the void loads, or will: its state is not `failed`), asked when the
   * hold comes down past the target: a story it takes back keeps its place for the hold's lifting, where a failure's
   * lets it go. Without it every hold that comes down lets the place go.
   */
  holdWaits?: () => boolean;
  /**
   * The void's state (the store's `voidState`), asked at every input and frame. With it `failed` the story rests only on
   * `stopsFor`'s stops (the home, BOB from above, the end page), the end page stands past the hold, and every move
   * between the end page and the stops short of it is the step fade. Without it the void is taken to be there.
   */
  voidState?: () => VoidState;
}

export interface HomeScroll {
  scroll: VirtualScroll;
  loop: ScrollLoop;
  /**
   * The hold has changed (the void is ready, loading again, or failed); nothing at all while 3D is off, when the loop
   * does not run and the scene is not shown (`resume` then holds the story when 3D is back). A target above the new
   * hold comes back to it: for a hold that waits (`holdWaits`) as a story past the hold is held when this starts, its
   * place kept for the hold's lifting, the progress with it; for a failure what the input had asked past the old one is
   * let go. A target that rests on the old hold, which the input asked to take further, goes on (`releaseTarget`: to
   * the next stop at least, as far as it asked at most); then the loop runs to it.
   */
  holdChanged(): void;
  /**
   * 3D is going off: the wheel or touch gesture under way (a wheel still in its quiet) is finished at once, settled on
   * its stop from its reach, before the void goes with the Stage, so its idle hold neither clamps nor caps it.
   */
  suspend(): void;
  /**
   * 3D is back on: a story past the hold now (the void went with the Stage, so it is idle), its target or its progress,
   * is held as at the start, its place kept, so the void's `ready` takes it back there; then the loop finishes the move.
   */
  resume(): void;
  /**
   * The nav's link to the end page (`.end-link`, a keyboard's and a screen reader's way there with 3D on): the story goes
   * to the end by the End key's own path (VirtualScroll's `jump('end')`, then `onJump`): the damped move, with reduced
   * motion a step, with the void failed past the hold by the step fade, and while the void loads the hold, then on to the
   * end once it is ready (`asked`, `holdChanged`). Answers whether the input took it: not while it takes no input (3D
   * off, a phase off the scroll) nor while a skipped loader's tail is dropped.
   */
  toEnd(): boolean;
  /**
   * Whether the story is headed for the end page now: 3D on, and its target on the end, or the end asked for past a hold
   * that keeps it (`asked`). False once an input takes the target elsewhere (a turn back), or the hold lets it go.
   */
  headedToEnd(): boolean;
  /**
   * The header's name on the home page: the story goes to its start by the Home key's own path (VirtualScroll's
   * `jump('home')`, then `onJump`: the page to its top first, then the move, or the step fade where the void failed).
   * Answers whether the input took it: not while it takes no input (3D off, a phase off the scroll, such as a bead
   * opening) nor while a skipped loader's tail is dropped, where the link is left to navigate.
   */
  toTop(): boolean;
  dispose(): void;
}

/**
 * Wires the input to the loop: `VirtualScroll` on `el` moves `frame.target` (by a distance, or with reduced
 * motion to the next or previous stop), and wakes the loop. A glide that is pushing into an end of the story
 * is ended there, so it does not keep the loop awake. `dispose()` takes both down.
 *
 * **The stops.** Past the rise's top (`riseTop`, BOB from above) every input comes to rest on a stop, so a bead's label,
 * which shows only at its stop, shows. A key steps there to the next stop or the one before (`keyTarget`), a held key
 * past the top being the one step its press took; on the rise a key moves by its distance, as M2a's did, up to the top.
 * A wheel or a finger moves the target by its distance, as on the rise, and when its gesture ends (VirtualScroll's
 * `onGestureEnd`: the wheel quiet for GESTURE_GAP_MS, or the finger's lift) the target goes on to the stop that
 * `settleTarget` names, from where the gesture began, how far it carried (its reach: its deltas held to the story's ends
 * but not to the hold, so a push against 0 or the last stop counts for nothing and a push into the hold is still a fling)
 * and which way it was going as it ended (a gesture that turned back settles the way it turned): a wheel gesture of any
 * size takes at least one stop (but from the end page, where a nudge within END_WHEEL_SLOP_PX eases back, so a pixel of
 * a trackpad at the page's top stays there), a finger's nudge within the slop eases back, a swipe takes one stop, a
 * fling as many as it passed, and one that comes up out of the rise rests on its top, BOB from above, unless it carried
 * more than a whole unit past it. A new wheel gesture or key while a settle eases starts from where the story stands,
 * and a finger set down halts the ease there. A lift reckons in the glide it would leave and ends it, so the one damped move
 * of the loop carries the swipe to its stop, with no glide slowing to a crawl first. A gesture that ends on the rise
 * rests where it ends, and its glide runs as M2a's did, held to the rise. The move to the stop is the loop's own damped
 * one (`smoothTimeAt`: quick on the rise, slower down the dive and between the beads), never a jump, and the loop lands
 * progress on the stop exactly. With reduced motion every input is already a step to a stop (`moveTarget`).
 *
 * **The hold.** Every move of the target, a delta, a settle or a jump, is clamped to `hold` (`holdLimit` of it): a
 * wheel, a swipe or End past it rests on it, and a glide that presses into it is ended there, as at the end. The place
 * the input asked for past it is kept (`asked`), until the next input that stays within it: when the hold rises
 * (`holdChanged`) the story goes on from the hold toward it (`releaseTarget`). A wheel or touch gesture that went into the
 * hold asks, once it ends, for the stop just past the hold and no further. Nothing past the hold is stored as a
 * debt: scrolling back up from the hold moves the story at once. A story that is already past the hold when this
 * starts (the route sync's Back to a bead's stop) is held the same way, its progress with it.
 *
 * **The end page.** Once the story rests at the end (`<html data-end="rest">`) the page stands in the flow and its own
 * scroll is the browser's (VirtualScroll's `yields`, `endPageYields`): every input down is the page's, and every input
 * up while the page is scrolled down. Each wheel gesture or drag keeps the answer its start had to its end, so a fling up
 * the page that reaches the top stops there, and a gesture that brought the story into the night (its target pinned at
 * the end, so no glide carries on) never scrolls the page either. At the top a new input up is the story's again: a
 * notch or a swipe settles back on Cookies Clicker, and an arrow, Page Up or Shift+Space steps there. Home goes to the
 * story's start from anywhere, the page back at its top first.
 *
 * **A failed void** (`voidState` `failed`). The hold stands at BOB from above, and the keys and the settle step among
 * `stopsFor`'s stops, the home, BOB from above and the end page. The end page stands past the hold (spec
 * 2026-10-24-bob-end-page-design.md, goal 6): a wheel or a swipe still rests at BOB from above, but a key's step or End
 * from there, or the page's link (`toEnd`), goes to the end page, and a story at the end page stays there. Every move
 * between the end page and the stops short of it, either way, is the step fade (the loop's `fades`), never a camera move
 * through a void that is not there: the scene host goes dark (`<html data-step-fade>`, set here unless reduced motion's own
 * fade, Home's, is the one on screen), the progress waits, jumps once the host is dark, and the host fades back. From
 * the end page's top an arrow, Page Up or Shift+Space steps back to BOB from above, and a wheel gesture or a swipe up takes
 * that one step, the rest of it spent; Home goes to the story's start by the fade. The rise between the home and BOB
 * from above stays the rise.
 */
export function startHomeScroll(o: HomeScrollOptions): HomeScroll {
  const { frame, chapters } = o;
  const top = riseTop(chapters);
  const end = scrollEnd(chapters);
  /** The most the target may reach now. */
  const limitNow = (): number => holdLimit(o.hold?.() ?? end, chapters, o.reducedMotion());
  /** The void failed: the end page stands alone past the hold, reached and left by the step fade. */
  const failed = (): boolean => o.voidState?.() === 'failed';
  /** The stops the story rests on now (`stopsFor` the void's state). */
  const stopsNow = (): number[] => stopsFor(chapters, o.voidState?.() ?? 'ready');
  /** Whether `place` may stand past the hold: the end page, with the void failed. */
  const pastHold = (place: number): boolean => place === end && failed();
  /** Where the last input asked the target to be, past the hold it rests on; null when it asked for no more than the hold. */
  let asked: number | null = null;
  /**
   * Puts the target where an input asked, held to the limit, and notes what the hold kept from it. With `past` a place the
   * hold lets stand past it (`pastHold`, the end page with the void failed) is not held: a key's step or a jump to it, or
   * an input that leaves a story already there; a wheel or a finger going on from BOB from above never is.
   */
  const askFor = (place: number, past = false): number => {
    const limit = limitNow();
    const stands = past && place > limit && pastHold(place);
    frame.target = stands ? place : Math.min(place, limit);
    asked = place > limit && !stands ? place : null;
    return limit;
  };
  /** The wheel or touch gesture under way, null while none is. */
  let gesture: {
    /** Where the target stood when it began. */
    from: number;
    /**
     * Where it has carried: its deltas as given, held to the story's ends (0 and the last stop) but not to the hold, so a
     * long push into the hold is the fling it was, and a push against an end counts for nothing.
     */
    reach: number;
    /** Where its direction was last read, and the direction (1 down, -1 up, 0 none yet): it changes once it moves past the slop. */
    anchor: number;
    direction: number;
    /** What drives it: a wheel, whose every gesture steps, or a finger, which has the slop. */
    by: 'wheel' | 'finger';
    /** It has taken its one step off the end page of a failed void: the rest of it moves nothing, and nothing settles. */
    spent: boolean;
  } | null = null;
  /** A settle has put the target on a stop and no input has come since: a new one starts from where the story stands. */
  let settling = false;
  /**
   * The settle's slop, in units, for what drives a gesture that began `from`: a finger's SETTLE_SLOP_PX; a wheel's none,
   * but END_WHEEL_SLOP_PX for one that began at the end page (at its top, where an input up is the story's), so a
   * pixel's nudge there settles back on it. So a wheel gesture anywhere else steps one stop at least.
   */
  const slopOf = (by: 'wheel' | 'finger', from: number): number =>
    (by === 'finger' ? SETTLE_SLOP_PX : from === end ? END_WHEEL_SLOP_PX : 0) / Math.max(o.unitPx(), 1);
  /** The place an input starts from: where the story stands while a settle eases it, else the target. */
  const startPlace = (): number => (settling ? frame.progress : frame.target);
  /** Whether the story must turn back to reach `place`: it lies behind the way the story is moving. */
  const turnsBack = (place: number): boolean => place !== frame.progress && Math.sign(place - frame.progress) === -Math.sign(frame.velocity);

  /** `<html data-step-fade>` is set by this input: it takes away only what it set (Home's reduced-motion fade sets it too). */
  let fadeShown = false;
  /** The step fade's host dark or back, as the loop says: not with reduced motion, whose every step Home fades already. */
  const showFade = (dark: boolean): void => {
    const on = dark && !o.reducedMotion();
    if (on === fadeShown || typeof document === 'undefined') return;
    fadeShown = on;
    document.documentElement.toggleAttribute(STEP_FADE_ATTRIBUTE, on);
  };

  const loop: ScrollLoop = new ScrollLoop({
    ...o,
    glide: {
      get busy() {
        return scroll.busy || scroll.waiting;
      },
      step: (dtSec) => scroll.step(dtSec),
      stop: () => scroll.stop(),
    },
    // With the void failed, the end page on one side and everything short of it on the other: no frame between.
    fades: (progress, target) => failed() && (progress >= end) !== (target >= end),
    onFade: showFade,
  });

  const scroll: VirtualScroll = new VirtualScroll(o.el, {
    unitPx: o.unitPx,
    onDelta: (units, by) => {
      let place: number;
      let limit = Number.POSITIVE_INFINITY;
      // A key's step may take the story past the hold to the end page of a failed void (`pastHold`); a wheel or a finger
      // only leaves a story there that is there already.
      let stepped = false;
      if (o.reducedMotion()) {
        place = moveTarget(frame.target, units, chapters, true, stopsNow());
        stepped = by === 'key' || by === 'held';
        // A step the hold keeps (a wheel or a finger past BOB from above of a failed void) asks, for the hold's lifting,
        // for the next of every stop, as the settle does: a void there again goes on to the overview, not the end page.
        if (!stepped && place > limitNow() && !pastHold(frame.target)) place = moveTarget(frame.target, units, chapters, true);
      } else if (by === 'key' || by === 'held') {
        gesture = null; // a key puts the target on its stop: a wheel it cut short has nothing left to settle
        const base = startPlace(); // a key during a settle steps from where the story stands
        if (by === 'held' && !onRise(base, chapters)) return;
        settling = false;
        place = keyTarget(base, units, chapters, stopsNow());
        stepped = true;
      } else {
        if (by !== 'glide') {
          if (gesture === null) {
            // A gesture begun while a settle eases starts from where the story stands, and takes the target over at once;
            // so does one that goes against a moving story, so it turns back from there.
            if (settling || (units !== 0 && Math.sign(units) === -Math.sign(frame.velocity))) frame.target = frame.progress;
            gesture = { from: frame.target, reach: frame.target, anchor: frame.target, direction: 0, by, spent: false };
          }
          if (gesture.spent) return; // its one step off a failed void's end page is taken
          settling = false;
          gesture.by = by;
          gesture.reach = Math.min(Math.max(gesture.reach + units, 0), end);
          if (Math.abs(gesture.reach - gesture.anchor) > slopOf(gesture.by, gesture.from)) {
            gesture.direction = Math.sign(gesture.reach - gesture.anchor);
            gesture.anchor = gesture.reach;
          }
        }
        place = moveTarget(frame.target, units, chapters, false);
        // A glide runs only on the rise (a lift that would carry it past settles at once instead): it ends at the top.
        if (by === 'glide' && units > 0) {
          place = Math.min(place, Math.max(frame.target, top));
          limit = top;
        }
        // With the void failed nothing lies between the end page and BOB from above: a wheel or a finger that goes up from
        // the end page takes one step back to BOB from above (the step fade), and the rest of its gesture is spent. A finger
        // first has its slop: while it has carried no further than SETTLE_SLOP_PX the story stays at the end page (a
        // waver, a pull at the page's top), and a lift there settles back on it with no fade. A wheel has its own there,
        // END_WHEEL_SLOP_PX, the same way: a nudge stays, a notch steps.
        if (gesture !== null && by !== 'glide' && place < end && pastHold(frame.target)) {
          if (end - gesture.reach <= slopOf(gesture.by, gesture.from)) {
            place = end;
          } else {
            place = moveTarget(end, -1, chapters, true, stopsNow());
            gesture.spent = true;
          }
        }
      }
      // A place behind a moving story lets its speed go, so it turns at once, at the void's slower pace too.
      if (!o.reducedMotion() && turnsBack(place)) loop.letGo();
      limit = Math.min(limit, askFor(place, stepped || pastHold(frame.target)));
      if (pinnedAtEnd(frame.target, units, chapters, limit)) scroll.stopGlide();
      loop.wake();
    },
    onJump: (to) => {
      gesture = null;
      settling = false;
      // Home goes to the story's start from the end page too, the page back at its top first: the end's rest is then
      // left from the top, where Home's end view finds the page and scrolls nothing again.
      if (to === 'home') pageToTop();
      askFor(jumpTarget(to, chapters), true);
      loop.wake();
    },
    onTouchDown: () => {
      // A finger set down while a settle eases halts it where it stands, and is a gesture from there: its lift (a tap
      // included) settles the story on a stop again.
      if (!settling || frame.progress === frame.target) return false;
      loop.halt();
      settling = false;
      gesture = { from: frame.progress, reach: frame.progress, anchor: frame.progress, direction: 0, by: 'finger', spent: false };
      return true;
    },
    onGestureEnd: (glide) => {
      const g = gesture;
      gesture = null;
      if (g === null || o.reducedMotion()) return;
      if (g.spent) {
        scroll.stopGlide(); // it took its one step off the end page: nothing settles, and no glide carries on
        return;
      }
      // Where it carried: its reach (held to the story's ends, not to the hold) and the glide its lift would leave.
      const reach = Math.min(Math.max(g.reach + glide, 0), end);
      if (onRise(reach, chapters)) return; // it rests where it ends, its glide (if any) as M2a's
      scroll.stopGlide();
      // Its direction as it ended: a lift's glide goes the way the finger last went.
      const direction = glide !== 0 ? Math.sign(glide) : g.direction;
      let place = settleTarget(g.from, reach, chapters, slopOf(g.by, g.from), direction || undefined, stopsNow());
      if (o.threeD()) {
        if (pastHold(g.from) && pastHold(place)) {
          // One at a failed void's end page that never left it (one that went up from it is spent) leaves the story there.
          askFor(place, true);
        } else {
          // One that went into the hold asks for no more than the stop just past it, as a glide that presses into the hold
          // is ended there: the void's ready takes it on to that stop, not as far as the glide would have gone.
          const limit = limitNow();
          if (reach > limit) place = Math.min(place, moveTarget(limit, 1, chapters, true));
          askFor(place);
        }
      } else {
        // 3D has gone off under it: the gesture is finished on its stop, and the hold is `resume`'s to apply once 3D is
        // back (the void went with the Stage, and its idle hold is not the visitor's).
        frame.target = place;
        asked = null;
      }
      settling = true;
      loop.wake();
    },
    enabled: o.enabled,
    reducedMotion: o.reducedMotion,
    yields: endPageYields,
    swallow: o.swallow,
    wake: loop.wake,
  });

  /**
   * A story placed past the hold while the input was away (Back from a project page puts it at the bead's stop,
   * src/state/routeSync.ts; 3D switched off and on at a bead's stop) is held as an input's would be: the target rests on
   * the hold and the place is kept as `asked`, for `holdChanged` to let go to; the story waits there too, so the camera
   * never comes out into a void not yet there, and its chapter follows it. A failed void's end page is not held
   * (`pastHold`): a story there stays there.
   */
  const holdStory = (): void => {
    const limit = limitNow();
    const held = (place: number): boolean => place > limit && !pastHold(place);
    // A target past the hold, or a progress past it on its way back (3D switched off mid-move): either is held.
    if (!held(frame.target) && !held(frame.progress)) return;
    if (held(frame.target)) askFor(Math.max(frame.target, asked ?? frame.target));
    if (held(frame.progress)) frame.progress = limit;
    frame.velocity = 0;
    const at = changedChapter(chapters, frame.progress, frame.chapterIndex, true);
    if (at) {
      frame.chapterIndex = at.index;
      o.onChapter(at);
    }
  };

  holdStory();
  // Back from another page with the story still on its way: finish the move.
  loop.wake();

  return {
    scroll,
    loop,
    holdChanged: () => {
      // 3D off: the void went with the Stage (idle), but the loop does not run and nothing is shown, so the visitor's
      // place stays as it is; `resume` holds it when 3D is back.
      if (!o.threeD()) return;
      const limit = limitNow();
      if (frame.target > limit && !pastHold(frame.target)) {
        if (o.holdWaits?.()) {
          // The void will be there again (it loads anew): the story waits on the hold, its place kept for then.
          holdStory();
        } else {
          // The hold came down for good (the void failed): what was asked past it is let go with it.
          frame.target = limit;
          asked = null;
        }
      } else if (asked !== null && limit > frame.target) {
        frame.target = releaseTarget(frame.target, asked, limit, chapters);
        asked = asked > limit ? asked : null;
      }
      loop.wake();
    },
    suspend: () => {
      // The gesture under way is finished at once, on its stop, before the Stage (and the void with it) goes.
      scroll.stop();
    },
    resume: () => {
      holdStory();
      loop.wake();
    },
    toEnd: () => scroll.jump('end'),
    headedToEnd: () => o.threeD() && (frame.target === end || asked === end),
    toTop: () => scroll.jump('home'),
    dispose: () => {
      loop.dispose();
      scroll.dispose();
    },
  };
}
