import { END_ATTRIBUTE, pageToTop } from '~/scene/bob/endView';
import { STEP_FADE_ATTRIBUTE, STEP_FADE_MS } from '~/scene/bob/stepFade';
import { type ChapterAt, type Chapters, chapterAt, pathStart, placeOfFrame, riseTop, scrollEnd, sheetStart } from '~/state/chapters';
import type { VoidState } from '~/state/store';
import { changedChapter, finishTarget, holdLimit, jumpTarget, keyTarget, moveTarget, onRise, pinnedAtEnd, releaseTarget, restsAtTop, SETTLE_SLOP_PX, stopsFor } from './target';
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
 * About how long `progress` takes to catch up with `target` on the rise, in seconds: M2a's quick pace (about 0.8 s from
 * the home to BOB from above), which Bob approved. maath's `damp` covers 99 % of a move in about 3.3 times it.
 */
export const RISE_SMOOTH = 0.25;

/**
 * The smooth time for a story at `progress` moving toward `target`: RISE_SMOOTH on the rise, and null past it, where the
 * story follows the scroll (`follow`). At a stop it reads the stretch on the target's side, so leaving BOB from above
 * upward is the rise and downward the light dive.
 */
export function smoothTimeAt(c: Chapters, progress: number, target: number): number | null {
  const p = Number.isFinite(progress) ? progress : 0;
  const toward = Number.isFinite(target) && target !== p ? Math.sign(target - p) * 1e-6 : 0;
  return chapterAt(c, p + toward).index === 0 ? RISE_SMOOTH : null;
}

/**
 * The follow past the rise (spec 2026-10-25-bob-light-dive-design.md, "Exactly with my scroll"): the story eases to the
 * scroll's place with a time constant of `tau` seconds, and near it never slower than `floorFramesPerSecond` of the light
 * dive's frames a second, so its tail does not crawl. The mock-up Bob approved, round 3.
 */
export const FOLLOW = { tau: 0.45, floorFramesPerSecond: 12 } as const;

/** The follow's floor, units a second. */
const FOLLOW_FLOOR = FOLLOW.floorFramesPerSecond * (placeOfFrame(2) - placeOfFrame(1));

/** Within this of its goal the follow is on it. */
const FOLLOW_ON = 1e-7;

/**
 * One frame of the follow, `dt` seconds: from `current` toward `goal` by the share of the time constant, or by the
 * floor's step near it, never past it; on it within FOLLOW_ON.
 */
export function follow(current: number, goal: number, dt: number): number {
  const d = goal - current;
  if (d === 0 || !(dt > 0)) return current;
  let step = d * (1 - Math.exp(-dt / FOLLOW.tau));
  const floor = FOLLOW_FLOOR * dt;
  if (Math.abs(step) < floor) step = Math.sign(d) * Math.min(Math.abs(d), floor);
  const next = current + step;
  return Math.abs(goal - next) < FOLLOW_ON ? goal : next;
}

/** The sheet finishes this long after the last input, ms: the scroll has stopped part-way up it. */
export const SHEET_FINISH_MS = 80;

/** The sheet's finish takes this long at the least and at the most, seconds. */
export const FINISH_S = [0.35, 1.2] as const;

/** A key's glide of one unit (one project), seconds, sqrt-scaled for longer ones; and the shortest glide. */
export const GLIDE_S = 1.2;
export const GLIDE_MIN_S = 0.6;

/** The furthest a glide or the finish may first run the wrong way before it turns, units: a hair, 1/300 of a unit. */
const SLACK = 1 / 300;

/** The two moves the loop makes by a curve of its own: the sheet's finish, and a key's glide past the light dive. */
export type TweenKind = 'finish' | 'glide';

/** A move on a cubic Hermite from `from`, at speed `v0`, to `to`, at rest, over `T` seconds, `elapsed` of them gone. */
interface Tween {
  kind: TweenKind;
  from: number;
  to: number;
  v0: number;
  T: number;
  elapsed: number;
}

/** Where a tween stands at `s`, 0..1 of its time. */
function tweenAt(tw: Tween, s: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * tw.from + (s3 - 2 * s2 + s) * tw.T * tw.v0 + (-2 * s3 + 3 * s2) * tw.to;
}

/**
 * How long a tween over `d` units takes, starting at speed `v`: a key's glide max(GLIDE_MIN_S, GLIDE_S x sqrt(d)); the
 * sheet's finish carries on at the speed it had and eases only at its end, over 1.5 d / v (its speed then falls as
 * v (1 - s^2), never rising first), held to FINISH_S, and FINISH_S's longest from a standstill or a speed away from it.
 */
export function tweenTime(kind: TweenKind, d: number, v: number): number {
  if (kind === 'glide') return Math.max(GLIDE_MIN_S, GLIDE_S * Math.sqrt(Math.abs(d)));
  if (!(v * d > 0)) return FINISH_S[1];
  return Math.min(Math.max((1.5 * Math.abs(d)) / Math.abs(v), FINISH_S[0]), FINISH_S[1]);
}

/**
 * The speed a tween may start with: the speed on screen, `v`, but toward its end no more than 3|d|/T (so it never runs
 * past it), and against it no more than takes it `slack` the wrong way before it turns back.
 */
export function startSpeed(v: number, d: number, T: number, slack: number): number {
  if (v * d >= 0) {
    const most = (3 * Math.abs(d)) / T;
    return Math.min(Math.max(v, -most), most);
  }
  // How far the curve first runs the wrong way for a start speed u: its highest T u h1(s) - |d| h2(s), before s = 1/3.
  const back = (u: number): number => {
    let most = 0;
    for (let i = 1; i <= 40; i++) {
      const s = i / 100;
      most = Math.max(most, T * u * (s - 2 * s * s + s * s * s) - Math.abs(d) * (3 * s * s - 2 * s * s * s));
    }
    return most;
  };
  if (back(Math.abs(v)) <= slack) return v;
  let lo = 0;
  let hi = Math.abs(v);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (back(mid) <= slack) lo = mid;
    else hi = mid;
  }
  return Math.sign(v) * lo;
}

/** maath's `damp` keeps its speed on the object it moves, under this key of `__damp`. */
const DAMP_SPEED = 'velocity_progress';

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
 * is the story's: the sheet slides back down over the look back.
 */
function endPageYields(direction: 1 | -1): boolean {
  return atEnd() && (direction > 0 || window.scrollY > 0);
}

/** Within this many units of the target, progress is on it and the loop sleeps. */
const SETTLED = 1e-4;
/**
 * Within this many units of the end page's stop (the target on `scrollEnd`), progress is on it: the move's 99 % (Ruling
 * 18), so the end page comes to rest when it looks arrived. Every other stop keeps SETTLED.
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
   * frame: Home and End, and with the void failed a move across the void that is not there (`startHomeScroll`). Without
   * it every move travels.
   */
  fades?: (progress: number, target: number) => boolean;
  /**
   * The step fade's scene host goes dark (true, as a fade begins) or fades back (false, once the frame the progress jumped
   * in is drawn, or the fade is let go): `<html data-step-fade>` (src/styles/base.css). Without it nothing is shown.
   */
  onFade?: (dark: boolean) => void;
  /**
   * Whether the sheet may finish by itself now (not with reduced motion, nor while a finger is on the glass), asked at
   * every frame. Without it the sheet never finishes.
   */
  finishes?: () => boolean;
}

/**
 * The frame loop of the home page's story: it moves `frame.progress` toward `frame.target`, steps the input's
 * glide, keeps `frame.chapterIndex` in step with the chapters and reports a chapter change. It runs a frame
 * at a time and sleeps when progress is on the target and nothing glides; `wake()` starts it again. Progress is on the
 * target within SETTLED of it, or within END_SETTLED (the move's 99 %) when the target is the end page's stop, and the
 * frame it arrives in lands it there exactly.
 *
 * **The pace.** On the rise the story moves by M2a's damp (RISE_SMOOTH). Past it, it follows the scroll (`follow`): the
 * light dive and the light's path move exactly with the scroll, eased by FOLLOW's 0.45 s, with no stop of their own. A move
 * across BOB from above hands the speed over, so nothing stops there.
 *
 * **The sheet's finish** ("Follow, then finish"). With the target part-way up the sheet, the story past the light dive,
 * SHEET_FINISH_MS of frames since the last input (`input`) and the sheet free to finish (`finishes`), the loop takes the
 * story on by a curve of its own (`finishTarget`): to the end page if the last input went down, else back onto the look
 * back. **A key's glide** (`glideTo`) is the same curve from where the story stands. While one runs the target is where
 * it goes (`heading`); a target moved from outside lets it go, and the follow takes the story on from where it is.
 *
 * Exactly one frame is ever pending. `wake()` is called by the input at every delta, and a glide's `step`
 * makes deltas from inside a tick, so a `wake()` during a tick does nothing: the tick decides at its end
 * whether to ask for the next frame.
 *
 * **The step fade.** A move that `fades` says is made by the step fade (Home and End, and with the void failed one
 * across the void that is not there) is never travelled: the scene host goes dark over STEP_FADE_MS (`onFade(true)`)
 * while the progress waits where it stands, then the progress jumps to the target, and the frame after, the jump drawn
 * under the dark host, the host fades back (`onFade(false)`). As reduced motion's step does (src/scene/bob/stepFade.ts
 * `stepFadeAt`), a story that turns back to the side it stands on before the host is dark lets the fade go, and nothing
 * jumps.
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
  /** The sheet's finish or a key's glide under way, or null. */
  private tween: Tween | null = null;
  /** Ms of frames since the last input: the sheet finishes once there are SHEET_FINISH_MS of them. */
  private quiet = Number.POSITIVE_INFINITY;
  /** The way the last input went: 1 down the story, -1 up, 0 none yet. */
  private lastDirection = 0;
  /** The last frame moved the story by the rise's damp: a move onto the rise hands it the follow's speed first. */
  private damping = false;

  constructor(private readonly o: ScrollLoopOptions) {}

  /** The tween under way: the sheet's finish, a key's glide, or null. */
  get tweening(): TweenKind | null {
    return this.tween?.kind ?? null;
  }

  /** Where the tween under way goes, or null. */
  get heading(): number | null {
    return this.tween?.to ?? null;
  }

  /** A step fade is under way and has not yet jumped: the story still stands where it was, the host going dark. */
  get fading(): boolean {
    return this.fade !== null && !this.fade.jumped;
  }

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
      // The browser has already reported the failed fetch. Without damp the story still has to arrive: the rise snaps.
      () => this.loaded(snap),
    );
  };

  /**
   * An input has moved the story, `direction` its way (1 down, -1 up, 0 for none, which leaves the last one's): the
   * sheet's finish counts its quiet from here.
   */
  input(direction: number): void {
    this.quiet = 0;
    if (direction !== 0) this.lastDirection = Math.sign(direction);
  }

  /**
   * A key's glide to `to`: the target goes there and the story glides from where it stands, with the speed it has, eased
   * to rest there over `tweenTime`. Nothing to glide when it is there already.
   */
  glideTo(to: number): void {
    this.o.frame.target = to;
    this.startTween(to, 'glide');
  }

  /** Lets the tween under way go: the follow takes the story on from where it stands. */
  stopTween(): void {
    this.tween = null;
  }

  /**
   * Stops the story where it stands: the target on the progress, no tween, no velocity, and the damping's own speed let
   * go (maath's `damp` keeps it on the frame object, as `__damp`), so it neither runs on nor jumps when it next moves.
   */
  halt(): void {
    this.o.frame.target = this.o.frame.progress;
    this.tween = null;
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
   * Ends the loop: the pending frame is cancelled, a tick that is already queued does nothing, no velocity or tween is
   * left behind, and no step fade leaves the host dark.
   */
  dispose(): void {
    this.disposed = true;
    if (this.raf !== 0) this.o.cancel(this.raf);
    this.raf = 0;
    this.o.frame.velocity = 0;
    this.tween = null;
    this.endFade();
  }

  private loaded(smooth: Smooth): void {
    this.smooth = smooth;
    this.wake();
  }

  /**
   * Whether the loop has something to do: progress more than `settled` off its target, a glide going, a step fade or a
   * tween under way, or the sheet waiting out its quiet to finish. `wake` asks with SETTLED, so a story left within
   * END_SETTLED of the end page (3D switched off, or the home left, mid-move) still gets the frame that lands it there.
   */
  private needsFrames(settled = SETTLED): boolean {
    const { frame } = this.o;
    return Math.abs(frame.target - frame.progress) > settled || this.o.glide.busy || this.fade !== null || this.tween !== null || this.finishWaits();
  }

  /** The target is part-way up the sheet and the sheet may finish: the loop counts the quiet until it does. */
  private finishWaits(): boolean {
    return this.tween === null && this.o.finishes?.() === true && finishTarget(this.o.frame.target, this.lastDirection, this.o.chapters) !== null;
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
      this.tween = null;
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

  /** Starts a tween of `kind` to `to` from where the story stands, with its speed on screen. */
  private startTween(to: number, kind: TweenKind): void {
    const { frame } = this.o;
    const from = frame.progress;
    const d = to - from;
    if (d === 0) {
      this.tween = null;
      return;
    }
    const v = Number.isFinite(frame.velocity) ? frame.velocity : 0;
    const T = tweenTime(kind, d, v);
    this.tween = { kind, from, to, v0: startSpeed(v, d, T, SLACK), T, elapsed: 0 };
  }

  /** One frame of the tween under way, `dt` seconds; one whose target was moved from outside is let go. */
  private stepTween(dt: number): boolean {
    const { frame } = this.o;
    const tw = this.tween;
    if (tw === null) return false;
    if (frame.target !== tw.to) {
      this.tween = null;
      return false;
    }
    tw.elapsed += dt;
    if (tw.elapsed >= tw.T) {
      frame.progress = tw.to;
      this.tween = null;
    } else {
      frame.progress = tweenAt(tw, tw.elapsed / tw.T);
    }
    return true;
  }

  /** One frame of the plain move to the target: the rise's damp, or past it the follow. */
  private ease(dt: number, settled: number): void {
    const { frame, chapters } = this.o;
    const smoothTime = smoothTimeAt(chapters, frame.progress, frame.target);
    if (smoothTime === null) {
      this.damping = false;
      frame.progress = follow(frame.progress, frame.target, dt);
      return;
    }
    if (!this.damping) {
      // Onto the rise from the follow or a tween: the damp carries on at the speed the story had.
      const damped = frame as { __damp?: Record<string, number> };
      (damped.__damp ??= {})[DAMP_SPEED] = Number.isFinite(frame.velocity) ? frame.velocity : 0;
      this.damping = true;
    }
    this.smooth!(frame, 'progress', frame.target, smoothTime, dt, Infinity, undefined, settled);
  }

  /** The sheet's finish begins, once it waits and its quiet is over, and the story is past the light dive. */
  private finishIfDue(): void {
    const { frame, chapters } = this.o;
    if (this.tween !== null || this.fade !== null || this.quiet < SHEET_FINISH_MS || this.o.finishes?.() !== true) return;
    if (frame.progress < pathStart(chapters)) return; // in the light dive the story runs on into the path first
    const to = finishTarget(frame.target, this.lastDirection, chapters);
    if (to === null) return;
    frame.target = to;
    this.startTween(to, 'finish');
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.smooth) return;
    const { frame, chapters, glide } = this.o;
    if (!this.o.threeD()) {
      glide.stop(); // 3D was switched off while it ran: the glide ends, the story stays where it is
      this.tween = null;
      frame.velocity = 0;
      this.endFade(); // and a step fade is let go, so the host is not left dark
      return;
    }
    const dt = this.last === 0 ? 1 / 60 : Math.min(Math.max((now - this.last) / 1000, 0), MAX_DT);
    this.last = now;

    this.ticking = true;
    try {
      glide.step(dt);
      this.quiet += dt * 1000;
      const before = frame.progress;
      const faded = this.stepFade(now);
      const settled = this.settledFor(frame.target);
      if (!faded && !this.stepTween(dt)) this.ease(dt, settled);
      if (!faded) this.finishIfDue();
      const arrived = !this.needsFrames(settled);
      if (arrived) {
        frame.progress = frame.target; // on it, exactly: the next frame would snap it, but the loop sleeps first
        // At the end page the damping may still have some speed at 99 %: it is let go with the rest, so a move off the end
        // page leaves from a standstill.
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

export interface HomeScrollOptions extends Omit<ScrollLoopOptions, 'glide' | 'fades' | 'onFade' | 'finishes'> {
  el: HTMLElement;
  /** Pixels in one unit of scroll: the viewport's height. */
  unitPx: () => number;
  /** Whether the input takes events now (3D on, a phase the scroll moves through); asked at every event. */
  enabled: () => boolean;
  reducedMotion: () => boolean;
  /** Whether the input drops what it takes now, still preventing it (`VirtualScrollOptions.swallow`); asked at every event. */
  swallow?: () => boolean;
  /**
   * The most the target may reach now, in units (src/scene/bob/landingHold.ts `landingHoldFor`: the landing hold while
   * the beads load), asked at every input and at `holdChanged`; with reduced motion the last stop at or under it
   * (`holdLimit`). Without it nothing holds but the end of the story.
   */
  hold?: () => number;
  /**
   * Whether the hold now is one that lifts by itself (the beads load, or will: the void's state is not `failed`), asked
   * when the hold comes down: a story it takes back keeps its place for the hold's lifting, where a failure's lets it go.
   * Without it every hold that comes down lets the place go.
   */
  holdWaits?: () => boolean;
  /**
   * The void's state (the store's `voidState`), asked at every input and frame. With it `failed` the keys step only among
   * `stopsFor`'s stops (the home, BOB from above, the landing hold, the end page), the end page stands past the hold, and
   * every move between the end page and the places short of it is the step fade. Without it the void is taken to be there.
   */
  voidState?: () => VoidState;
}

export interface HomeScroll {
  scroll: VirtualScroll;
  loop: ScrollLoop;
  /**
   * The hold has changed (the beads are ready, loading again, or failed); nothing at all while 3D is off, when the loop
   * does not run and the scene is not shown (`resume` then holds the story when 3D is back). A target above the new
   * hold comes back to it: for a hold that waits (`holdWaits`) as a story past the hold is held when this starts, its
   * place kept for the hold's lifting, the progress with it; for a failure what the input had asked past it is let go. A
   * target that rests on the old hold, which the input asked to take further, goes on (`releaseTarget`: to the next
   * stop at least, as far as it asked at most); then the loop runs to it.
   */
  holdChanged(): void;
  /**
   * 3D is going off: the wheel or touch gesture under way (a wheel still in its quiet) is finished at once, before the
   * void goes with the Stage, so its idle hold neither clamps nor caps it.
   */
  suspend(): void;
  /**
   * 3D is back on: a story past the hold now (the void went with the Stage, so it is idle), its target or its progress,
   * is held as at the start, its place kept, so the void's `ready` takes it back there; then the loop finishes the move.
   */
  resume(): void;
  /**
   * The nav's link to the end page (`.end-link`) and the path's skip button: the story goes to the end by the End key's
   * own path (VirtualScroll's `jump('end')`, then `onJump`): the step fade, and while the beads load the follow to the
   * hold, then the fade on to the end once they are ready (`asked`, `holdChanged`). Answers whether the input took it:
   * not while it takes no input (3D off, a phase off the scroll) nor while a skipped loader's tail is dropped.
   */
  toEnd(): boolean;
  /**
   * Whether the story is headed for the end page now: 3D on, and its target on the end, or the end asked for past a hold
   * that keeps it (`asked`). False once an input takes the target elsewhere (a turn back), or the hold lets it go.
   */
  headedToEnd(): boolean;
  /**
   * The header's name on the home page: the story goes to its start by the Home key's own path (VirtualScroll's
   * `jump('home')`, then `onJump`: the page to its top first, then the step fade, or the follow back up from the light
   * dive). Answers whether the input took it: not while it takes no input (3D off, a phase off the scroll, such as a bead
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
 * **The rise.** On the rise the scroll is M2a's: a wheel, a finger and a key move the target by their distance, a
 * finger's glide runs on the rise and ends at its top, and a gesture that comes up out of the rise rests on its top,
 * BOB from above, unless it carried more than a whole unit past it (`restsAtTop`). A new gesture or key while that rest
 * eases starts from where the story stands, and a finger set down halts the ease there.
 *
 * **Past the rise** (spec 2026-10-25-bob-light-dive-design.md, "Exactly with my scroll"). A wheel and a finger move the
 * target by their distance and the story follows (`follow`): the light dive's frames and the light's path go exactly with
 * the scroll, and stay wherever it stops, between two projects too. A finger's glide carries on as a page's would, ended
 * at the end page or the hold. The sheet finishes by itself once the scroll stops part-way up it ("Follow, then finish",
 * the loop's `finishTarget`); input during the finish, or a key's glide, rides along when it goes the tween's own way
 * short of its end, and otherwise stops it, the target where the input put it. A key steps among the key stops
 * (`keyTarget`: each fact, each project, the end page), counted from where a glide is going: within the light dive the
 * target moves and the follow eases after it, and a move that starts or ends past it glides (`glideTo`). Home and End
 * keep their meaning: End goes to the end page by the step fade from anywhere; Home goes to the start by the step fade
 * from the path, the sheet and the end page, and by the follow back up from the light dive. With reduced motion every
 * input is a step to a key stop (`moveTarget`), and nothing glides or finishes by itself.
 *
 * **The hold.** Every move of the target, a delta, a step or a jump, is clamped to `hold` (`holdLimit` of it): a wheel,
 * a swipe or a key past it rests on it, and a glide that presses into it is ended there, as at the end. The place the
 * input asked for past it is kept (`asked`: for a wheel or a finger the furthest its gesture reached), until the next
 * input that stays within it: when the hold rises (`holdChanged`) the story goes on from the hold toward it
 * (`releaseTarget`). Nothing past the hold is stored as a debt: scrolling back up from the hold moves the story at once.
 * A story that is already past the hold when this starts (the route sync's Back to a bead's stop) is held the same way,
 * its progress with it.
 *
 * **The end page.** Once the story rests at the end (`<html data-end="rest">`) the page stands in the flow and its own
 * scroll is the browser's (VirtualScroll's `yields`, `endPageYields`): every input down is the page's, and every input
 * up while the page is scrolled down. Each wheel gesture or swipe keeps the answer its start had to its end, so a fling up
 * the page that reaches the top stops there, and a gesture that brought the story to the end never scrolls the page
 * either. At the top a new input up is the story's again: the sheet slides back down, and finishes onto the look back.
 *
 * **A failed void** (`voidState` `failed`). The hold stands at the landing hold, and the keys step among `stopsFor`'s
 * stops, the home, BOB from above, the hold and the end page. The end page stands past the hold: a wheel or a swipe still
 * rests at the hold, but a key's step or End from there, or the page's link (`toEnd`), goes to the end page, and a story
 * at the end page stays there. Every move between the end page and the places short of it, either way, is the step fade
 * (the loop's `fades`), never a camera move through a void that is not there: the scene host goes dark (`<html
 * data-step-fade>`, set here unless reduced motion's own fade, Home's, is the one on screen), the progress waits, jumps
 * once the host is dark, and the host fades back. From the end page's top an arrow, Page Up or Shift+Space steps back to
 * the hold, and a wheel gesture or a swipe up takes that one step, the rest of it spent (a finger first has its slop,
 * SETTLE_SLOP_PX, so a waver at the page's top makes no fade); Home goes to the story's start by the fade.
 */
export function startHomeScroll(o: HomeScrollOptions): HomeScroll {
  const { frame, chapters } = o;
  const top = riseTop(chapters);
  const path = pathStart(chapters);
  const sheet = sheetStart(chapters);
  const end = scrollEnd(chapters);
  /** The void failed: the end page stands alone past the hold, reached and left by the step fade. */
  const failed = (): boolean => o.voidState?.() === 'failed';
  /** The stops a key, and reduced motion's every input, steps among now (`stopsFor` the void's state). */
  const stopsNow = (): number[] => stopsFor(chapters, o.voidState?.() ?? 'ready');
  /** The most the target may reach now. */
  const limitNow = (): number => holdLimit(o.hold?.() ?? end, chapters, o.reducedMotion(), stopsNow());
  /** Whether `place` may stand past the hold: the end page, with the void failed. */
  const pastHold = (place: number): boolean => place === end && failed();
  /** Where the last input asked the target to be, past the hold it rests on; null when it asked for no more than the hold. */
  let asked: number | null = null;
  /** Where Home or End asked to go by the step fade, until the fade is over or another input moves the target; else null. */
  let fadeTo: number | null = null;
  /**
   * Puts the target where an input asked, held to the limit, and notes what the hold kept from it. With `past` a place the
   * hold lets stand past it (`pastHold`, the end page with the void failed) is not held: a key's step or a jump to it, or
   * an input that leaves a story already there; a wheel or a finger going on from the hold never is.
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
     * Where it has carried: its deltas as given, held to the story's ends (0 and the end page) but not to the hold, so a
     * long push into the hold asks as far as it went, and a push against an end counts for nothing.
     */
    reach: number;
    /** Where its direction was last read, and the direction (1 down, -1 up, 0 none yet): it changes once it moves past the slop. */
    anchor: number;
    direction: number;
    /** What drives it: a wheel, or a finger, which has its slop at a failed void's end page. */
    by: 'wheel' | 'finger';
    /** It has taken its one step off the end page of a failed void: the rest of it moves nothing. */
    spent: boolean;
  } | null = null;
  /** A lift's glide began on the rise: it runs on the rise alone, and ends at its top. */
  let glideOnRise = false;
  /** A gesture up out of the rise has been rested on its top and no input has come since: a new one starts from where the story stands. */
  let settling = false;
  /** A finger's slop, in units: how far it must take the story from a failed void's end page before it steps back. */
  const slopOf = (by: 'wheel' | 'finger'): number => (by === 'finger' ? SETTLE_SLOP_PX : 0) / Math.max(o.unitPx(), 1);
  /** The place an input starts from: where the story stands while the rest at the top eases it, else the target. */
  const startPlace = (): number => (settling ? frame.progress : frame.target);
  /** Whether the story must turn back to reach `place`: it lies behind the way the story is moving. */
  const turnsBack = (place: number): boolean => place !== frame.progress && Math.sign(place - frame.progress) === -Math.sign(frame.velocity);
  /** Whether the story goes from `progress` to `target` by the step fade: Home's or End's, or across a failed void. */
  const fades = (progress: number, target: number): boolean =>
    (failed() && (progress >= end) !== (target >= end)) || (fadeTo !== null && target === fadeTo && progress !== target);

  /** `<html data-step-fade>` is set by this input: it takes away only what it set (Home's reduced-motion fade sets it too). */
  let fadeShown = false;
  /** The step fade's host dark or back, as the loop says: not with reduced motion, whose every step Home fades already. */
  const showFade = (dark: boolean): void => {
    if (!dark) fadeTo = null; // the fade is over, or let go: a later move to the same place travels
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
    fades,
    onFade: showFade,
    finishes: () => !o.reducedMotion() && !scroll.touching,
  });

  const scroll: VirtualScroll = new VirtualScroll(o.el, {
    unitPx: o.unitPx,
    onDelta: (units, by) => {
      // A step fade on its way: an input in its own way leaves it to jump; one against it lets it go, from where the story
      // still stands, and a key's press against it is that and no more: the story stays.
      const fading = loop.fading ? Math.sign(frame.target - frame.progress) : 0;
      if (fading !== 0 && Math.sign(units) === fading) {
        loop.input(units);
        return;
      }
      if (fading !== 0) {
        gesture = null;
        fadeTo = null;
        frame.target = frame.progress;
        asked = null;
        if (by === 'key' || by === 'held') {
          loop.input(units);
          loop.wake();
          return;
        }
      }
      fadeTo = null; // any other input takes the target over from a Home or an End
      let place: number;
      let limit = Number.POSITIVE_INFINITY;
      // A key's step may take the story past the hold to the end page of a failed void (`pastHold`); a wheel or a finger
      // only leaves a story there that is there already.
      let stepped = false;
      if (o.reducedMotion()) {
        loop.stopTween();
        place = moveTarget(frame.target, units, chapters, true, stopsNow());
        stepped = by === 'key' || by === 'held';
        // A step the hold keeps (a wheel or a finger past the hold of a failed void) asks, for the hold's lifting, for
        // the next of the key stops: a void there again goes on to the first project, not to the end page.
        if (!stepped && place > limitNow() && !pastHold(frame.target)) place = moveTarget(frame.target, units, chapters, true);
      } else if (by === 'key' || by === 'held') {
        gesture = null; // a key puts the target on its stop: a wheel it cut short has nothing left
        glideOnRise = false;
        const base = loop.heading ?? startPlace(); // counted from where a glide is going, or where the story stands
        if (by === 'held' && !onRise(base, chapters)) return;
        settling = false;
        place = keyTarget(base, units, chapters, stopsNow());
        stepped = true;
      } else {
        if (by !== 'glide') {
          if (gesture === null) {
            // A gesture begun while the rest at the top eases starts from where the story stands, and takes the target over
            // at once; so does one that goes against a moving story, so it turns back from there.
            if (settling || (units !== 0 && loop.tweening === null && Math.sign(units) === -Math.sign(frame.velocity))) frame.target = frame.progress;
            gesture = { from: frame.target, reach: frame.target, anchor: frame.target, direction: 0, by, spent: false };
            glideOnRise = false;
          }
          if (gesture.spent) return; // its one step off a failed void's end page is taken
          settling = false;
          gesture.by = by;
          gesture.reach = Math.min(Math.max(gesture.reach + units, 0), end);
          if (Math.abs(gesture.reach - gesture.anchor) > slopOf(gesture.by)) {
            gesture.direction = Math.sign(gesture.reach - gesture.anchor);
            gesture.anchor = gesture.reach;
          }
        }
        // During the sheet's finish or a key's glide the input lands beside where the story stands.
        const heading = loop.heading;
        place = moveTarget(heading === null ? frame.target : frame.progress, units, chapters, false);
        if (heading !== null) {
          const way = Math.sign(heading - frame.progress);
          const past = way !== 0 && (place - heading) * way > 1e-9;
          if (way !== 0 && !past && Math.sign(place - frame.progress) === way) {
            // In the tween's own way and short of its end: it rides along, and takes the story there anyway.
            loop.input(units);
            loop.wake();
            return;
          }
          loop.stopTween(); // against it, or past its end: the scroll stays where the input put it
        }
        // A glide that a lift began on the rise runs on the rise alone: it ends at the top.
        if (by === 'glide' && units > 0 && glideOnRise) {
          place = Math.min(place, Math.max(frame.target, top));
          limit = top;
        }
        // With the void failed nothing lies between the end page and the hold: a wheel or a finger that goes up from the
        // end page takes one step back to the hold (the step fade), and the rest of its gesture is spent. A finger first
        // has its slop: while it has carried no further than SETTLE_SLOP_PX the story stays at the end page (a waver, a
        // pull at the page's top), and its lift leaves it there with no fade.
        if (gesture !== null && by !== 'glide' && place < end && pastHold(frame.target)) {
          if (end - gesture.reach <= slopOf(gesture.by)) {
            place = end;
          } else {
            place = moveTarget(end, -1, chapters, true, stopsNow());
            gesture.spent = true;
          }
        }
      }
      // A place behind a moving story lets its speed go, so it turns at once.
      if (!o.reducedMotion() && turnsBack(place)) loop.letGo();
      limit = Math.min(limit, askFor(place, stepped || pastHold(frame.target)));
      // A wheel or a finger that pushed into the hold asks as far as its gesture went, for the hold's lifting.
      if (asked !== null && gesture !== null && gesture.reach > asked) asked = gesture.reach;
      // A key's move that starts or ends past the light dive glides there; within it the follow eases after the target.
      if (stepped && !o.reducedMotion()) {
        if ((frame.target >= path || frame.progress >= path) && !fades(frame.progress, frame.target)) loop.glideTo(frame.target);
        else loop.stopTween();
      }
      loop.input(units);
      if (pinnedAtEnd(frame.target, units, chapters, limit)) scroll.stopGlide();
      loop.wake();
    },
    onJump: (to) => {
      gesture = null;
      settling = false;
      glideOnRise = false;
      loop.stopTween();
      // Home goes to the story's start from the end page too, the page back at its top first: the end's rest is then
      // left from the top, where Home's end view finds the page and scrolls nothing again.
      if (to === 'home') pageToTop();
      const place = jumpTarget(to, chapters);
      askFor(place, true);
      // End fades to the end page from anywhere; Home fades to the start from the path, the sheet and the end page, and
      // from the light dive and the rise the story goes back up by the follow and the rise's damp.
      fadeTo = to === 'end' || frame.progress >= path ? place : null;
      loop.input(0);
      loop.wake();
    },
    onTouchDown: () => {
      // A finger set down while the rest at the top eases halts it where it stands, and is a gesture from there.
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
        scroll.stopGlide(); // it took its one step off the end page: no glide carries on
        return;
      }
      if (g.by === 'finger') loop.input(0); // the sheet's quiet counts from the lift
      // Where it carried: its reach (held to the story's ends, not to the hold) and the glide its lift would leave.
      const reach = Math.min(Math.max(g.reach + glide, 0), end);
      glideOnRise = onRise(reach, chapters);
      // Its direction as it ended: a lift's glide goes the way the finger last went.
      const direction = glide !== 0 ? Math.sign(glide) : g.direction;
      // Lifted part-way up the sheet, a finger hands over to the finish at once, the way it last went: no glide crawls
      // it on, and the finish carries on at the speed the story has ("Follow, then finish").
      if (g.by === 'finger' && frame.target > sheet && frame.target < end) {
        scroll.stopGlide();
        loop.input(direction);
        loop.wake();
        return;
      }
      if (!glideOnRise && restsAtTop(g.from, reach, chapters, direction || undefined)) {
        scroll.stopGlide();
        if (o.threeD()) {
          askFor(top);
        } else {
          // 3D has gone off under it: the gesture is finished on the top, and the hold is `resume`'s to apply.
          frame.target = top;
          asked = null;
        }
        settling = true;
      }
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
   * src/state/routeSync.ts; 3D switched off and on on the path) is held as an input's would be: the target rests on the
   * hold and the place is kept as `asked`, for `holdChanged` to let go to; the story waits there too, so the camera never
   * comes out onto a path whose beads are not there yet, and its chapter follows it. A failed void's end page is not held (`pastHold`): a
   * story there stays there.
   */
  const holdStory = (): void => {
    const limit = limitNow();
    const held = (place: number): boolean => place > limit && !pastHold(place);
    // A target past the hold, or a progress past it on its way back (3D switched off mid-move): either is held.
    if (!held(frame.target) && !held(frame.progress)) return;
    loop.stopTween();
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
          // The beads will be there again (they load anew): the story waits on the hold, its place kept for then.
          holdStory();
        } else {
          // The hold came down for good (the void failed): what was asked past it is let go with it.
          frame.target = limit;
          asked = null;
          fadeTo = null;
        }
      } else if (asked !== null && limit > frame.target) {
        frame.target = releaseTarget(frame.target, asked, limit, chapters);
        asked = asked > limit ? asked : null;
      } else if (o.holdWaits?.() === false) {
        // A hold that will not lift (the void failed) keeps nothing that was asked past it.
        asked = null;
        fadeTo = null;
      }
      loop.wake();
    },
    suspend: () => {
      // The gesture under way is finished at once, before the Stage (and the void with it) goes.
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
