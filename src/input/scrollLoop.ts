import type { ChapterAt, Chapters } from '~/state/chapters';
import { changedChapter, holdLimit, jumpTarget, moveTarget, pinnedAtEnd, releaseTarget } from './target';
import { VirtualScroll } from './VirtualScroll';

/** maath's `damp`: moves `current[prop]` toward `target` and says whether it is still moving. */
export type Smooth = typeof import('maath/easing').damp;

/** The values the loop reads and writes: the fields of `~/state/frame` it uses. */
export type ScrollFrame = { progress: number; target: number; velocity: number; chapterIndex: number };

/** What the loop needs of the input's glide. */
export interface Glide {
  /** True while a glide is going, so the loop must keep running. */
  readonly busy: boolean;
  /** Advances the glide by `dtSec`; it moves `frame.target` through the input's own delta. */
  step(dtSec: number): void;
  stop(): void;
}

/** About how long `progress` takes to catch up with `target`, in seconds. */
const SMOOTH_TIME = 0.25;
/** Within this many units of the target, progress is on it and the loop sleeps. */
const SETTLED = 1e-4;
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
}

/**
 * The frame loop of the home page's story: it moves `frame.progress` toward `frame.target`, steps the input's
 * glide, keeps `frame.chapterIndex` in step with the chapters and reports a chapter change. It runs a frame
 * at a time and sleeps when progress is on the target and nothing glides; `wake()` starts it again.
 *
 * Exactly one frame is ever pending. `wake()` is called by the input at every delta, and a glide's `step`
 * makes deltas from inside a tick, so a `wake()` during a tick does nothing: the tick decides at its end
 * whether to ask for the next frame.
 */
export class ScrollLoop {
  private raf = 0; // the pending frame; 0 for none
  private last = 0; // the time of the last tick; 0 after a sleep
  private ticking = false;
  private disposed = false;
  private loading = false;
  private smooth: Smooth | null = null;

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

  /** Ends the loop: the pending frame is cancelled, a tick that is already queued does nothing, and no velocity is left behind. */
  dispose(): void {
    this.disposed = true;
    if (this.raf !== 0) this.o.cancel(this.raf);
    this.raf = 0;
    this.o.frame.velocity = 0;
  }

  private loaded(smooth: Smooth): void {
    this.smooth = smooth;
    this.wake();
  }

  private needsFrames(): boolean {
    return Math.abs(this.o.frame.target - this.o.frame.progress) > SETTLED || this.o.glide.busy;
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.smooth) return;
    const { frame, chapters, glide } = this.o;
    if (!this.o.threeD()) {
      glide.stop(); // 3D was switched off while it ran: the glide ends, the story stays where it is
      frame.velocity = 0;
      return;
    }
    const dt = this.last === 0 ? 1 / 60 : Math.min(Math.max((now - this.last) / 1000, 0), MAX_DT);
    this.last = now;

    this.ticking = true;
    try {
      glide.step(dt);
      const before = frame.progress;
      this.smooth(frame, 'progress', frame.target, SMOOTH_TIME, dt, Infinity, undefined, SETTLED);
      const arrived = !this.needsFrames();
      if (arrived) frame.progress = frame.target; // on it, exactly: the next frame would snap it, but the loop sleeps first
      frame.velocity = arrived || dt <= 0 ? 0 : (frame.progress - before) / dt;

      const at = changedChapter(chapters, frame.progress, frame.chapterIndex, arrived);
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

export interface HomeScrollOptions extends Omit<ScrollLoopOptions, 'glide'> {
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
}

export interface HomeScroll {
  scroll: VirtualScroll;
  loop: ScrollLoop;
  /**
   * The hold has changed (the void is ready, or failed): a target above the new one comes back to it (and what the
   * input had asked past the old one is let go); a target that rests on the old hold, which the input asked to take
   * further, goes on (`releaseTarget`: to the next stop at least, as far as it asked at most); then the loop runs to it.
   */
  holdChanged(): void;
  dispose(): void;
}

/**
 * Wires the input to the loop: `VirtualScroll` on `el` moves `frame.target` (by a distance, or with reduced
 * motion to the next or previous stop), and wakes the loop. A glide that is pushing into an end of the story
 * is ended there, so it does not keep the loop awake. `dispose()` takes both down.
 *
 * **The hold.** Every move of the target, a delta or a jump, is clamped to `hold` (`holdLimit` of it): a wheel, a
 * swipe or End past it rests on it, and a glide that presses into it is ended there, as at the end. The place the input
 * asked for past it is kept (`asked`), until the next input that stays within it: when the hold rises
 * (`holdChanged`) the story goes on from the hold toward it (`releaseTarget`). Nothing past the hold is stored as a
 * debt: scrolling back up from the hold moves the story at once. A story that is already past the hold when this
 * starts (the route sync's Back to a bead's stop) is held the same way, its progress with it.
 */
export function startHomeScroll(o: HomeScrollOptions): HomeScroll {
  const { frame, chapters } = o;
  /** The most the target may reach now. */
  const limitNow = (): number => holdLimit(o.hold?.() ?? chapters.total, chapters, o.reducedMotion());
  /** Where the last input asked the target to be, past the hold it rests on; null when it asked for no more than the hold. */
  let asked: number | null = null;
  /** Puts the target where an input asked, held to the limit, and notes what the hold kept from it. */
  const askFor = (place: number): number => {
    const limit = limitNow();
    frame.target = Math.min(place, limit);
    asked = place > limit ? place : null;
    return limit;
  };

  const loop: ScrollLoop = new ScrollLoop({
    ...o,
    glide: {
      get busy() {
        return scroll.busy;
      },
      step: (dtSec) => scroll.step(dtSec),
      stop: () => scroll.stop(),
    },
  });

  const scroll: VirtualScroll = new VirtualScroll(o.el, {
    unitPx: o.unitPx,
    onDelta: (units) => {
      const limit = askFor(moveTarget(frame.target, units, chapters, o.reducedMotion()));
      if (pinnedAtEnd(frame.target, units, chapters, limit)) scroll.stopGlide();
      loop.wake();
    },
    onJump: (to) => {
      askFor(jumpTarget(to, chapters));
      loop.wake();
    },
    enabled: o.enabled,
    reducedMotion: o.reducedMotion,
    swallow: o.swallow,
    wake: loop.wake,
  });

  // A story placed past the hold while the input was away (Back from a project page puts it at the bead's stop,
  // src/state/routeSync.ts) is held as an input's would be: the target rests on the hold and what was asked is kept
  // for `holdChanged` to let go; the story waits there too, so the camera never comes out into a void not yet there,
  // and its chapter follows it.
  if (frame.target > limitNow()) {
    askFor(frame.target);
    frame.progress = Math.min(frame.progress, frame.target);
    frame.velocity = 0;
    const at = changedChapter(chapters, frame.progress, frame.chapterIndex, true);
    if (at) {
      frame.chapterIndex = at.index;
      o.onChapter(at);
    }
  }

  // Back from another page with the story still on its way: finish the move.
  loop.wake();

  return {
    scroll,
    loop,
    holdChanged: () => {
      const limit = limitNow();
      if (frame.target > limit) {
        // The hold came down (the void failed): what was asked past it is let go with it.
        frame.target = limit;
        asked = null;
      } else if (asked !== null && limit > frame.target) {
        frame.target = releaseTarget(frame.target, asked, limit, chapters);
        asked = asked > limit ? asked : null;
      }
      loop.wake();
    },
    dispose: () => {
      loop.dispose();
      scroll.dispose();
    },
  };
}
