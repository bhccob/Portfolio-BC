import type { ChapterAt, Chapters } from '~/state/chapters';
import { changedChapter, jumpTarget, moveTarget, pinnedAtEnd } from './target';
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
}

export interface HomeScroll {
  scroll: VirtualScroll;
  loop: ScrollLoop;
  dispose(): void;
}

/**
 * Wires the input to the loop: `VirtualScroll` on `el` moves `frame.target` (by a distance, or with reduced
 * motion to the next or previous stop), and wakes the loop. A glide that is pushing into an end of the story
 * is ended there, so it does not keep the loop awake. `dispose()` takes both down.
 */
export function startHomeScroll(o: HomeScrollOptions): HomeScroll {
  const { frame, chapters } = o;

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
      frame.target = moveTarget(frame.target, units, chapters, o.reducedMotion());
      if (pinnedAtEnd(frame.target, units, chapters)) scroll.stopGlide();
      loop.wake();
    },
    onJump: (to) => {
      frame.target = jumpTarget(to, chapters);
      loop.wake();
    },
    enabled: o.enabled,
    reducedMotion: o.reducedMotion,
    wake: loop.wake,
  });

  // Back from another page with the story still on its way: finish the move.
  loop.wake();

  return {
    scroll,
    loop,
    dispose: () => {
      loop.dispose();
      scroll.dispose();
    },
  };
}
