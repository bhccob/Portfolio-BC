import { type ChapterAt, type Chapters, chapterAt, riseTop, scrollEnd } from '~/state/chapters';
import { changedChapter, holdLimit, jumpTarget, keyTarget, moveTarget, onRise, pinnedAtEnd, releaseTarget, SETTLE_SLOP_PX, settleTarget } from './target';
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

  /**
   * Stops the story where it stands: the target on the progress, no velocity, and the damping's own speed let go (maath's
   * `damp` keeps it on the frame object, as `__damp`), so it neither runs on nor jumps when it next moves.
   */
  halt(): void {
    const { frame } = this.o;
    frame.target = frame.progress;
    frame.velocity = 0;
    const state = (frame as { __damp?: Record<string, number> }).__damp;
    if (state) for (const key of Object.keys(state)) state[key] = 0;
  }

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
      this.smooth(frame, 'progress', frame.target, smoothTimeAt(chapters, frame.progress, frame.target), dt, Infinity, undefined, SETTLED);
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
  /**
   * Whether the hold now is one that lifts by itself (the void loads, or will: its state is not `failed`), asked when the
   * hold comes down past the target: a story it takes back keeps its place for the hold's lifting, where a failure's
   * lets it go. Without it every hold that comes down lets the place go.
   */
  holdWaits?: () => boolean;
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
 * size takes at least one stop, a finger's nudge within the slop eases back, a swipe takes one stop, a fling as many as it
 * passed, and one that comes up out of the rise rests on its top, BOB from above, unless it carried more than a whole
 * unit past it. A new wheel gesture or key while a settle eases starts from where the story stands, and a finger set
 * down halts the ease there. A lift reckons in the glide it would leave and ends it, so the one damped move
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
 */
export function startHomeScroll(o: HomeScrollOptions): HomeScroll {
  const { frame, chapters } = o;
  const top = riseTop(chapters);
  /** The most the target may reach now. */
  const limitNow = (): number => holdLimit(o.hold?.() ?? scrollEnd(chapters), chapters, o.reducedMotion());
  /** Where the last input asked the target to be, past the hold it rests on; null when it asked for no more than the hold. */
  let asked: number | null = null;
  /** Puts the target where an input asked, held to the limit, and notes what the hold kept from it. */
  const askFor = (place: number): number => {
    const limit = limitNow();
    frame.target = Math.min(place, limit);
    asked = place > limit ? place : null;
    return limit;
  };
  const end = scrollEnd(chapters);
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
  } | null = null;
  /** A settle has put the target on a stop and no input has come since: a new one starts from where the story stands. */
  let settling = false;
  /** The settle's slop for what drives a gesture, in units: a finger's SETTLE_SLOP_PX, a wheel's none. */
  const slopOf = (by: 'wheel' | 'finger'): number => (by === 'finger' ? SETTLE_SLOP_PX / Math.max(o.unitPx(), 1) : 0);
  /** The place an input starts from: where the story stands while a settle eases it, else the target. */
  const startPlace = (): number => (settling ? frame.progress : frame.target);
  /** Whether an input of `units` goes against the way the story is moving. */
  const reverses = (units: number): boolean => units !== 0 && Math.sign(units) === -Math.sign(frame.velocity);

  const loop: ScrollLoop = new ScrollLoop({
    ...o,
    glide: {
      get busy() {
        return scroll.busy || scroll.waiting;
      },
      step: (dtSec) => scroll.step(dtSec),
      stop: () => scroll.stop(),
    },
  });

  const scroll: VirtualScroll = new VirtualScroll(o.el, {
    unitPx: o.unitPx,
    onDelta: (units, by) => {
      let place: number;
      let limit = Number.POSITIVE_INFINITY;
      if (o.reducedMotion()) {
        place = moveTarget(frame.target, units, chapters, true);
      } else if (by === 'key' || by === 'held') {
        gesture = null; // a key puts the target on its stop: a wheel it cut short has nothing left to settle
        if (reverses(units)) loop.halt(); // a key that turns a moving story back turns it at once
        const base = startPlace(); // a key during a settle steps from where the story stands
        if (by === 'held' && !onRise(base, chapters)) return;
        settling = false;
        place = keyTarget(base, units, chapters);
      } else {
        if (by !== 'glide') {
          if (gesture === null) {
            // A gesture begun while a settle eases starts from where the story stands, and takes the target over at once.
            // One that turns a moving story back also lets its speed go, so it turns at once at the slower void pace.
            if (reverses(units)) loop.halt();
            else if (settling) frame.target = frame.progress;
            gesture = { from: frame.target, reach: frame.target, anchor: frame.target, direction: 0, by };
          }
          settling = false;
          gesture.by = by;
          gesture.reach = Math.min(Math.max(gesture.reach + units, 0), end);
          if (Math.abs(gesture.reach - gesture.anchor) > slopOf(gesture.by)) {
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
      }
      limit = Math.min(limit, askFor(place));
      if (pinnedAtEnd(frame.target, units, chapters, limit)) scroll.stopGlide();
      loop.wake();
    },
    onJump: (to) => {
      gesture = null;
      settling = false;
      askFor(jumpTarget(to, chapters));
      loop.wake();
    },
    onTouchDown: () => {
      // A finger set down while a settle eases halts it where it stands, and is a gesture from there: its lift (a tap
      // included) settles the story on a stop again.
      if (!settling || frame.progress === frame.target) return false;
      loop.halt();
      settling = false;
      gesture = { from: frame.progress, reach: frame.progress, anchor: frame.progress, direction: 0, by: 'finger' };
      return true;
    },
    onGestureEnd: (glide) => {
      const g = gesture;
      gesture = null;
      if (g === null || o.reducedMotion()) return;
      // Where it carried: its reach (held to the story's ends, not to the hold) and the glide its lift would leave.
      const reach = Math.min(Math.max(g.reach + glide, 0), end);
      if (onRise(reach, chapters)) return; // it rests where it ends, its glide (if any) as M2a's
      scroll.stopGlide();
      // Its direction as it ended: a lift's glide goes the way the finger last went.
      const direction = glide !== 0 ? Math.sign(glide) : g.direction;
      let place = settleTarget(g.from, reach, chapters, slopOf(g.by), direction || undefined);
      if (o.threeD()) {
        // One that went into the hold asks for no more than the stop just past it, as a glide that presses into the hold
        // is ended there: the void's ready takes it on to that stop, not as far as the glide would have gone.
        const limit = limitNow();
        if (reach > limit) place = Math.min(place, moveTarget(limit, 1, chapters, true));
        askFor(place);
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
    swallow: o.swallow,
    wake: loop.wake,
  });

  /**
   * A story placed past the hold while the input was away (Back from a project page puts it at the bead's stop,
   * src/state/routeSync.ts; 3D switched off and on at a bead's stop) is held as an input's would be: the target rests on
   * the hold and the place is kept as `asked`, for `holdChanged` to let go to; the story waits there too, so the camera
   * never comes out into a void not yet there, and its chapter follows it.
   */
  const holdStory = (): void => {
    const limit = limitNow();
    // A target past the hold, or a progress past it on its way back (3D switched off mid-move): either is held.
    if (!(frame.target > limit) && !(frame.progress > limit)) return;
    if (frame.target > limit) askFor(Math.max(frame.target, asked ?? frame.target));
    frame.progress = Math.min(frame.progress, limit);
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
      if (frame.target > limit) {
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
    dispose: () => {
      loop.dispose();
      scroll.dispose();
    },
  };
}
