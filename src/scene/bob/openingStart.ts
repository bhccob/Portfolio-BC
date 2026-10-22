/**
 * The BOB opening's wiring as plain rules (Ruling 3): how an opening begins
 * (straight at the home, or playing the loader on which path), which skip
 * counts, what clock a held moment of the proof bridge stands at, and what an
 * opening tells SceneHost as its build goes on. Pure, and apart from types it
 * imports only the loader's timeline, so the tests run it without R3F, the
 * GLTF loader or a browser; the Opening (Opening.tsx) applies exactly these.
 */
import { LOADER, type LoaderClock, type LoaderInput, type LoaderPath, loaderAt, pathFor, SCRIPT } from '~/engine/bob/loaderTimeline';
import type { Phase } from '~/state/machine';

/**
 * Whether an opening goes straight to the home and plays no loader (Ruling
 * 9c): the phase has already left LOADING for one of the home page's own
 * phases (HOME_IDLE, a scroll chapter). Its hero then shows (`data-loading`
 * is off), so a loader played now would run under it: 3D switched back on
 * after a failure or a toggle, a visit that began on Lite, or a visitor back
 * on the home after leaving the opening mid-way. LOADING plays the loader,
 * and so does a project page: there it runs under the page's scrim, as a
 * direct arrival's does (spec section 2.1), and lands on the home view behind
 * the page.
 */
export function skipsLoader(phase: Phase['kind']): boolean {
  return phase !== 'LOADING' && phase !== 'PROJECT_FOCUS';
}

/** How an opening begins: straight at the home (`skip`), or playing the loader on its `path`. */
export interface OpeningStart {
  skip: boolean;
  path: LoaderPath;
}

/**
 * How an opening mounted in this phase begins: `skip` as `skipsLoader` says,
 * and the path as `pathFor` says, the quick one if the loader was `seen` in
 * this browser and the reduced one if the visitor asks for less motion
 * (reduced beats quick, and quick beats full). The path is kept for a skipped
 * opening too: a seek still plays it.
 */
export function openingStartFor(phase: Phase['kind'], seen: boolean, reduced: boolean): OpeningStart {
  return { skip: skipsLoader(phase), path: pathFor(seen, reduced) };
}

/**
 * Whether landing on this path marks the loader seen in this browser (`markLoaderSeen`). A later visit is one after
 * the full show has played once (spec §2.1), so the full path marks it (whether it played whole or was skipped), and
 * so does the quick path, which only plays once it is marked; the reduced path's fade is no show, and leaves a visitor
 * who later lets motion back on the whole of it.
 */
export function marksSeen(path: LoaderPath): boolean {
  return path !== 'reduced';
}

/**
 * Whether the opening listens for a skip now (Ruling 30): only while the full show is `skippable` and the page shows
 * a scene (`sceneShown`: the store's `scene` is not null). The skip's listener sits on `window` and prevents every
 * wheel turn, scrolling key and one-finger drag it hears, so it must not outlive the scene: a visitor who leaves for a
 * page of text mid-show (Lite, contact) gets a page that draws no frame, so the loader never lands there, and that
 * page would never scroll. Back on a page with a scene, it listens again, and a later skip keeps the first ask's time.
 */
export function listensForSkip(skippable: boolean, sceneShown: boolean): boolean {
  return skippable && sceneShown;
}

/**
 * The loader seconds a skip stands at, once the visitor has asked at
 * `elapsed`: the first skip's (`current`, once there is one), as the
 * timeline fast-forwards from the first press and later input only adds to
 * the tail it swallows. A time that is not a number, or before the start,
 * reads as the start.
 */
export function skipAtFor(elapsed: number, current: number | null): number {
  if (current !== null) return current;
  return elapsed > 0 ? elapsed : 0;
}

/**
 * What the loader's timeline is asked for a clock the proof bridge holds at
 * `seconds` (`seekLoader`): that many visible seconds of a load that had
 * landed from the start (`loadedAt` 0), with no skip, on the visit's own path.
 * So a still at any moment of the full show is the script at that very second
 * and never the circle's wait for a load, whatever the real load did: the
 * harness holds 1.75, 5.0, 8.25 s and so on, and gets those moments of the
 * preview.
 */
export function heldLoaderInput(seconds: number, path: LoaderPath): LoaderInput {
  return { elapsed: seconds, loadedAt: 0, skipAt: null, path };
}

/**
 * The clock of an opening that skipped its loader: the full script at its
 * end, everything cut, open and risen, so it poses the same home every path
 * lands on (`HOME_POSE`). Frozen all through.
 */
export const HOME_CLOCK: Readonly<LoaderClock> = (() => {
  const clock = loaderAt({ elapsed: SCRIPT.home, loadedAt: 0, skipAt: null, path: 'full' });
  Object.freeze(clock.strokes);
  return Object.freeze(clock);
})();

/**
 * How long a skipped opening's home may take to load once its loader is warm,
 * ms of the page being visible: the loader's own give-up time
 * (`LOADER.giveUp`). A skipped mount (a visit that began on Lite, say) thus has
 * the load budget a loader has: SceneHost's LOAD_TIMEOUT_MS to start, and then
 * this for the home.
 */
export const SKIPPED_HOME_BUDGET_MS = LOADER.giveUp * 1000;

/** What an opening tells SceneHost, and what runs, given how far its build has gone. */
export interface OpeningReadiness {
  /** Its loader is built and compiled: the load timeout stops (the Stage's `onStarted`; `onReady` implies it). */
  started: boolean;
  /** The canvas can show (the Stage's `onReady`): the loader's first frame, or a skipped opening's home. */
  shown: boolean;
  /** The home's own budget runs (SKIPPED_HOME_BUDGET_MS of visible time): started but not shown, so no clock gives up. */
  budget: boolean;
}

/**
 * One rule for both kinds of mount (carried from v3): an opening has started
 * once its loader's objects are warm, however it goes on, so SceneHost's load
 * timeout covers the same work for every mount. A normal opening shows then
 * too, and its loader's clock gives up on the home's load (`LOADER.giveUp`). A
 * skipped one stays hidden until its home is warm too, so the canvas fades in
 * straight onto the home, and meanwhile its own budget stands in for the clock
 * it does not run.
 */
export function openingReadiness(skip: boolean, warm: { loader: boolean; home: boolean }): OpeningReadiness {
  const started = warm.loader;
  const shown = started && (!skip || warm.home);
  return { started, shown, budget: started && !shown };
}
