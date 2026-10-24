/**
 * The BOB loader's timeline: which stage the opening is in, how much of each
 * mark the laser has cut and how far the opening, the rise and the push-in
 * have come, from the seconds the loader has been visible, when the home's
 * assets finished loading and when the visitor asked to skip. Pure, and it
 * imports nothing from three, so the loader's tests run it without a browser
 * and the entry bundle can read it beside the Stage's chunk.
 *
 * The full path is the Blender preview (tools/blender/bob_animate_o.py) at its
 * own pace, 6.25 s from black to home, in the spec's section 2.1 (revised
 * 2026-10-22, Bob's pick): the laser cuts the circle alone, and the two B
 * letters are not drawn here (they arrive on the scroll):
 * - a fast load never shortens it, so every first-time visitor sees the O cut;
 * - a load that is still out when the circle is due to close holds the script
 *   just short of it, the laser creeping on, and the script goes on from there
 *   once the load lands;
 * - any input skips: the rest of the script runs in `LOADER.skip` seconds, or
 *   at its own pace when less than that is left, so a skip never
 *   ends later than the show would have.
 *
 * The quick path (the loader was seen before) and the reduced-motion path play
 * no engraving at all, so they run on their own, short spans from the load.
 * Where a visitor has both, reduced wins: it is the path that moves least.
 */
import type { SafeStorage } from '~/engine/core/SafeStorage';

/** The preview's frame rate; the script's frames are over it. */
export const FPS = 24;

/** A span of the script, in seconds. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/** The first and last frame of each span of the preview, and the frame it comes home on. */
const FRAMES = {
  descend: [1, 26],
  circle: [26, 74],
  ticks: [72, 86],
  outer: [74, 96],
  probeOut: [74, 94],
  iris: [80, 96],
  glow: [78, 106],
  rise: [88, 140],
  camera: [80, 140],
  settle: [100, 150],
  home: 150
} as const;

/** The frames `from` to `to` as seconds. */
function frames(from: number, to: number): Span {
  return Object.freeze({ start: from / FPS, end: to / FPS });
}

/**
 * The full path's script, in seconds from the loader's start: the spec's
 * section 7 timings at 24 fps. `descend` is the probe coming down (and the
 * world fading up from black), `circle` is the one cut, `ticks` and `outer`
 * grow the ticks and the outer ring, `probeOut` is the probe leaving, `iris`
 * is the glass inside the circle closing, `glow` the warm light from the
 * tunnel, `rise` the compass coming up, `camera` the push-in, `settle` the
 * needle swinging in, and `home` the second the loader ends. There are no
 * spans for the B letters: the loader never cuts them.
 */
export const SCRIPT = Object.freeze({
  descend: frames(...FRAMES.descend),
  circle: frames(...FRAMES.circle),
  ticks: frames(...FRAMES.ticks),
  outer: frames(...FRAMES.outer),
  probeOut: frames(...FRAMES.probeOut),
  iris: frames(...FRAMES.iris),
  glow: frames(...FRAMES.glow),
  rise: frames(...FRAMES.rise),
  camera: frames(...FRAMES.camera),
  settle: frames(...FRAMES.settle),
  home: FRAMES.home / FPS
});

/** The seconds `from` to `to`, frozen. */
function seconds(from: number, to: number): Span {
  return Object.freeze({ start: from, end: to });
}

/**
 * The quick path's spans, in seconds from the load: the marks are already cut,
 * so `glowIn` fades the world up, then the iris opens, the light rises, the
 * compass comes up, the camera settles and the needle swings in, and `home` is
 * the second the loader ends.
 */
export const QUICK = Object.freeze({
  glowIn: seconds(0, 0.8),
  iris: seconds(0.4, 1.0),
  glow: seconds(0.4, 1.2),
  rise: seconds(0.7, 2.2),
  camera: seconds(0, 2.4),
  settle: seconds(1.4, 2.5),
  home: 2.5
});

/**
 * The loader's timings, in seconds unless said: how far through the circle
 * the script holds while the load is out (`hold`, as a share of its span),
 * how much further the circle creeps while it waits and how slowly
 * (`crawl`, as a share of the circle, and `crawlTau`, the seconds in which it
 * covers about two thirds of that), how long a skip takes, how long the
 * reduced path's fade takes, how long a load may take before the loader gives
 * up, and the most one frame advances the clock (a hidden tab draws no
 * frames, so a long first frame after it must not skip the show).
 */
export const LOADER = {
  hold: 0.92,
  crawl: 0.06,
  crawlTau: 4,
  skip: 1.0,
  reducedFade: 1.0,
  giveUp: 25,
  maxStep: 0.1
} as const;

/** The key under which the browser remembers that the loader has played (in `localStorage`). */
export const LOADER_SEEN_KEY = 'bob-loader-seen';

/**
 * The script second at which the circle stands at `LOADER.hold` of its cut:
 * where the script stops while the load is out.
 */
export const HOLD_AT = (FRAMES.circle[0] + LOADER.hold * (FRAMES.circle[1] - FRAMES.circle[0])) / FPS;

/** Which of the three openings plays. */
export type LoaderPath = 'full' | 'quick' | 'reduced';

/** What the timeline needs to know, once a frame. */
export interface LoaderInput {
  /** Visible seconds since the loader began (see `advanceClock`). */
  elapsed: number;
  /** The `elapsed` at which the home's assets finished loading, or null while they have not. */
  loadedAt: number | null;
  /** The `elapsed` at which the visitor asked to skip, or null if they have not. */
  skipAt: number | null;
  /** Which opening to play. */
  path: LoaderPath;
}

/** The loader's stages, in the order they play. */
export type LoaderStage = 'dark' | 'engrave' | 'open' | 'rise' | 'home';

/** Where the opening stands. Every share is 0..1. */
export interface LoaderClock {
  stage: LoaderStage;
  /**
   * The position in the full script, in seconds. On the full path it is where
   * the opening is, it stands still while the load is out, and it never runs
   * past `SCRIPT.home`. On the quick
   * and reduced paths the full script has already played (the marks are cut,
   * the probe has gone), so it is `SCRIPT.home` throughout; their own time is
   * in the shares below.
   */
  script: number;
  /**
   * How much of each stroke is cut, in `STROKE_ORDER` (the left B, its bar, the right B, its bar, the circle). The
   * loader cuts the circle alone, so the first four are always 0 and only the last runs from 0 to 1.
   */
  strokes: readonly [number, number, number, number, number];
  /** How far the 144 ticks have grown. */
  ticks: number;
  /** How far the thin outer ring is drawn. */
  outer: number;
  /** How far the glass inside the circle has closed, like an iris. */
  iris: number;
  /** How far the warm light from the tunnel has come up. */
  glow: number;
  /** How far the compass has come up out of the opening. */
  rise: number;
  /** How far the camera has pushed in from the wide shot to the home. */
  camera: number;
  /** How far the needle's swing has settled. */
  settle: number;
  /** How far the world has faded up from black (on the reduced path, how far the page has faded in). */
  fade: number;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** How far `time` is through `span`, 0..1. */
function through(time: number, span: Span): number {
  return clamp01((time - span.start) / (span.end - span.start));
}

/** How far the circle has crept `waited` seconds into the wait for the load: `hold` at first, `hold + crawl` at most. */
function crawlAt(waited: number): number {
  return LOADER.hold + LOADER.crawl * (1 - Math.exp(-(waited > 0 ? waited : 0) / LOADER.crawlTau));
}

/** A time that is a real, non-negative number, or null. */
function timeOrNull(time: number | null): number | null {
  return time !== null && Number.isFinite(time) ? Math.max(0, time) : null;
}

/** Where the full path stands: the script second, and the least the circle may show (the crawl reached so far, or 0 before any wait). */
interface Playback {
  script: number;
  circleFloor: number;
}

/**
 * The full path's script second at `elapsed` seconds, for a load that landed at
 * `loadedAt` (null while it has not) and a skip pressed at `skipAt` (null if
 * none).
 *
 * Without a skip the script is `elapsed`, until it reaches the hold at `H`. A
 * load that landed by then (`loadedAt <= H`) never stops it. Otherwise it
 * waits at `H` until the load lands at `L`, and goes on from there at its own
 * pace: `H + (elapsed - L)`. The circle creeps while it waits; the floor is
 * that crawl, kept once the wait is over, so the circle never goes back.
 *
 * A skip pressed after the load is known (`skipAt >= loadedAt`) runs the rest
 * of the script, from wherever it stood, in `LOADER.skip` seconds, or in what
 * is left of it if that is less: the script plays at its own pace
 * from there, so a skip in its last second still lands when the show would
 * have, never later. A skip
 * pressed before that fast-forwards, at that same rate, to `H`; waits there,
 * the circle creeping from the moment it arrives; and runs the rest, from `H`,
 * in `LOADER.skip` seconds from the moment the load has landed and it is there.
 *
 * The script never goes past `SCRIPT.home`: once there it stays, and a skip
 * pressed after it has nothing left to run, so it cannot run the script back.
 */
function playFull(elapsed: number, loadedAt: number | null, skipAt: number | null): Playback {
  const { script, circleFloor } = playUncapped(elapsed, loadedAt, skipAt);
  return { script: Math.min(script, SCRIPT.home), circleFloor };
}

/** `playFull` before its script is held to `SCRIPT.home`. */
function playUncapped(elapsed: number, loadedAt: number | null, skipAt: number | null): Playback {
  const H = HOLD_AT;
  const home = SCRIPT.home;
  const L = loadedAt;
  const stalls = L === null || L > H;
  const plain = (t: number): number => (!stalls ? t : L !== null && t >= L ? H + (t - L) : Math.min(t, H));
  const crept = (t: number, from: number, until: number): number => (t < from ? 0 : crawlAt(Math.min(t, until) - from));

  if (skipAt === null || elapsed < skipAt) {
    return { script: plain(elapsed), circleFloor: stalls ? crept(elapsed, H, L ?? Infinity) : 0 };
  }

  if (L !== null && skipAt >= L) {
    // A skip pressed after the home starts from the home, not past it (past it, the compression would run the script back).
    const from = Math.min(plain(skipAt), home);
    // The rest in LOADER.skip, or in what is left of it at its own pace (the load is in, so the script runs
    // at 1 s a second from here), whichever is sooner. Nothing left (a skip at or after the home) is the home at once.
    const lasts = Math.min(LOADER.skip, home - from);
    const u = lasts > 0 ? (elapsed - skipAt) / lasts : 1;
    return { script: u >= 1 ? home : from + (home - from) * u, circleFloor: stalls ? crept(elapsed, H, L) : 0 };
  }

  // The skip came before the load was known. Its own pace changes nothing here: the rest from H (home - H, 3.3 s) is
  // always longer than LOADER.skip, so the skip's second is the sooner end.
  const from = Math.min(skipAt, H);
  const holdAt = skipAt < H ? skipAt + ((H - from) * LOADER.skip) / (home - from) : H;
  const goAt = L === null ? Infinity : Math.max(holdAt, L);
  let script: number;
  if (elapsed < holdAt) script = from + ((home - from) * (elapsed - skipAt)) / LOADER.skip;
  else if (elapsed < goAt) script = H;
  else {
    const u = (elapsed - goAt) / LOADER.skip;
    script = u >= 1 ? home : H + (home - H) * u;
  }
  return { script, circleFloor: crept(elapsed, holdAt, goAt) };
}

/** The full path's clock at this script second, with the circle at least `circleFloor`. */
function fullClock({ script, circleFloor }: Playback): LoaderClock {
  const stage: LoaderStage =
    script < SCRIPT.descend.end ? 'dark' : script < SCRIPT.circle.end ? 'engrave' : script < SCRIPT.rise.start ? 'open' : script < SCRIPT.home ? 'rise' : 'home';
  return {
    stage,
    script,
    strokes: [0, 0, 0, 0, Math.max(circleFloor, through(script, SCRIPT.circle))],
    ticks: through(script, SCRIPT.ticks),
    outer: through(script, SCRIPT.outer),
    iris: through(script, SCRIPT.iris),
    glow: through(script, SCRIPT.glow),
    rise: through(script, SCRIPT.rise),
    camera: through(script, SCRIPT.camera),
    settle: through(script, SCRIPT.settle),
    fade: through(script, SCRIPT.descend)
  };
}

/** The quick path's clock `q` seconds after the load (negative before it). */
function quickClock(q: number): LoaderClock {
  const stage: LoaderStage = q < 0 ? 'dark' : q < QUICK.rise.start ? 'open' : q < QUICK.home ? 'rise' : 'home';
  return {
    stage,
    script: SCRIPT.home,
    strokes: [0, 0, 0, 0, 1],
    ticks: 1,
    outer: 1,
    iris: through(q, QUICK.iris),
    glow: through(q, QUICK.glow),
    rise: through(q, QUICK.rise),
    camera: through(q, QUICK.camera),
    settle: through(q, QUICK.settle),
    fade: through(q, QUICK.glowIn)
  };
}

/** The reduced path's clock `q` seconds after the load (negative before it): everything in place, the page fading in. */
function reducedClock(q: number): LoaderClock {
  const fade = through(q, seconds(0, LOADER.reducedFade));
  return {
    stage: q < 0 ? 'dark' : q < LOADER.reducedFade ? 'rise' : 'home',
    script: SCRIPT.home,
    strokes: [0, 0, 0, 0, 1],
    ticks: 1,
    outer: 1,
    iris: 1,
    glow: 1,
    rise: 1,
    camera: 1,
    settle: 1,
    fade
  };
}

/**
 * Where the opening stands. The path decides which script plays:
 * - `full`: the preview's script (`SCRIPT`), `dark` until the descent ends,
 *   `engrave` until the circle is cut, `open` until the compass starts to
 *   rise, `rise` until `SCRIPT.home`, then `home`. See `playFull` for the hold
 *   on a late load and the skip.
 * - `quick`: `dark` until the load, then `open` and `rise` over the `QUICK`
 *   spans from the load, and `home` at `QUICK.home`. The cut marks are whole
 *   throughout. A skip is ignored: the path is short already.
 * - `reduced`: `dark` until the load, then `rise` for the fade over
 *   `LOADER.reducedFade`, then `home`. Every share but the fade is 1
 *   throughout, so the camera is at home and nothing moves. A skip is ignored.
 *
 * A NaN or negative time reads as 0 and a NaN `loadedAt` or `skipAt` as
 * absent, so a bad frame cannot send a stage backwards.
 */
export function loaderAt(input: LoaderInput): LoaderClock {
  const elapsed = input.elapsed > 0 ? input.elapsed : 0;
  const loadedAt = timeOrNull(input.loadedAt);
  if (input.path === 'quick') return quickClock(loadedAt === null ? -1 : elapsed - loadedAt);
  if (input.path === 'reduced') return reducedClock(loadedAt === null ? -1 : elapsed - loadedAt);
  return fullClock(playFull(elapsed, loadedAt, timeOrNull(input.skipAt)));
}

/**
 * The loader's clock `dt` seconds on: `elapsed` plus `dt` held to 0..`maxStep`.
 * A hidden tab draws no frames, so the long frame after it counts for
 * `maxStep` at most and the show picks up where it stopped; a negative or NaN
 * `dt` counts as nothing, so the clock never runs backwards, and a NaN or
 * negative `elapsed` reads as 0, as `loaderAt` reads it.
 */
export function advanceClock(elapsed: number, dt: number): number {
  return (elapsed > 0 ? elapsed : 0) + (dt > 0 ? Math.min(dt, LOADER.maxStep) : 0);
}

/**
 * Whether the loader should give up and let the page through: the load has
 * not finished after `LOADER.giveUp` visible seconds. A load that finished
 * (`loadedAt` set) never gives up, however long the show then runs. A
 * `loadedAt` that is not a finite number (NaN) reads as not loaded, as
 * `loaderAt` reads it, so the loader still gives up on it.
 */
export function loaderGaveUp(elapsed: number, loadedAt: number | null): boolean {
  return (loadedAt === null || !Number.isFinite(loadedAt)) && elapsed >= LOADER.giveUp;
}

/**
 * Whether the loader has played in this browser. Pass `SafeStorage.local()` at
 * runtime. A storage that throws, or any stored value but '1', reads as not
 * seen, so the visitor gets the whole show rather than none.
 */
export function loaderSeen(storage: SafeStorage): boolean {
  return storage.get(LOADER_SEEN_KEY) === '1';
}

/**
 * Marks the loader as played in this browser. Pass `SafeStorage.local()` at
 * runtime. A storage that throws is ignored, as `SafeStorage` does for every
 * write.
 */
export function markLoaderSeen(storage: SafeStorage): void {
  storage.set(LOADER_SEEN_KEY, '1');
}

/**
 * Which opening a visit plays: reduced motion plays the fade, whether or not
 * the loader was seen; otherwise a seen loader plays the quick path and a
 * first visit the full show.
 */
export function pathFor(seen: boolean, reduced: boolean): LoaderPath {
  return reduced ? 'reduced' : seen ? 'quick' : 'full';
}
