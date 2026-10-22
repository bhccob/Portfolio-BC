import { LOADER, SCRIPT } from '~/engine/bob/loaderTimeline';

/**
 * How long the scene may take to start, from the moment SceneHost decides to mount it (its chunk to download, the
 * opening's glass, engraving, traces, probe and smoke to build and their programs to compile: the Stage's onStarted,
 * or onReady) before the page gives up on it and falls back to the poster, ms of the page being visible
 * (visibleTimeout): 12 s is a scene that is not coming. From then on the opening waits for the rest of the load,
 * LOADER.giveUp visible seconds at most, by its loader's clock (src/engine/bob/loaderTimeline.ts) or, when it skips the
 * loader, by a budget of that length (SKIPPED_HOME_BUDGET_MS); LANDING_TIMEOUT_MS stands behind a loader.
 */
export const LOAD_TIMEOUT_MS = 12_000;

/** The slack the landing backstop gives a working opening past its longest show, seconds: frames that ran slow. */
const LANDING_MARGIN = 5;

/**
 * The backstop behind the opening's own give-up (Ruling 9b), ms of a scene on a visible page (`whileShown`): from the
 * loader showing (SceneHost's onReady) until the phase leaves LOADING. An opening that works lands well inside it: its
 * load gives up after LOADER.giveUp visible seconds, and no show runs longer after a load than the full script
 * (SCRIPT.home, 6.25 s: a load that lands late holds the script at the circle and plays only the rest), and a margin
 * follows. Past it the opening has stalled where its own clock cannot see (a frame loop that stopped, a promise that
 * never settled), and the scene fails as any other failure does.
 */
export const LANDING_TIMEOUT_MS = Math.round((LOADER.giveUp + SCRIPT.home + LANDING_MARGIN) * 1000);

/** How long a lost WebGL context may stay lost before the page falls back to the poster, ms of the page being visible. */
export const RESTORE_TIMEOUT_MS = 4_000;

/** As much of `document` as a visible-time timer reads. */
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Calls `expire` once the page has been visible for `ms`, all told. The clock stops while the page is hidden and goes
 * on with what was left when it shows again: a tab opened in the background (a middle click) runs no animation frames,
 * so the scene cannot paint or draw there, and the time it waits is not the scene's to answer for. Answers its cancel;
 * either way it lets go of its listener.
 */
export function visibleTimeout(ms: number, expire: () => void, doc: VisibilitySource = document): () => void {
  let left = ms;
  let since = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let over = false;

  const pause = (): void => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    left -= Date.now() - since;
  };
  const run = (): void => {
    if (over || timer !== undefined) return;
    since = Date.now();
    timer = setTimeout(() => {
      timer = undefined;
      end();
      expire();
    }, Math.max(0, left));
  };
  const changed = (): void => (doc.visibilityState === 'hidden' ? pause() : run());
  const end = (): void => {
    over = true;
    doc.removeEventListener('visibilitychange', changed);
  };

  doc.addEventListener('visibilitychange', changed);
  changed();
  return () => {
    pause();
    end();
  };
}

/** As much of the store as `whileShown` reads: whether the page shown has a scene, and a way to hear that change. */
export interface SceneShown {
  shown(): boolean;
  /** Calls `listener` when `shown` may have changed; answers the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/**
 * The page's visibility narrowed to the time a scene is on it, for `visibleTimeout`: hidden while the page is hidden
 * (as `doc` says) or shows no scene (Lite, contact, not found, where the canvas sleeps and an opening's clock waits
 * with it), visible otherwise. A visitor who leaves the home for Lite mid-opening and reads there for a minute has not
 * kept the opening from landing, so the landing backstop does not count that minute. Each listener added is heard by
 * both sources and let go of by both.
 */
export function whileShown(doc: VisibilitySource, scene: SceneShown): VisibilitySource {
  const stops = new Map<() => void, () => void>();
  return {
    get visibilityState(): DocumentVisibilityState {
      return doc.visibilityState === 'hidden' || !scene.shown() ? 'hidden' : 'visible';
    },
    addEventListener(type, listener) {
      doc.addEventListener(type, listener);
      stops.get(listener)?.();
      stops.set(listener, scene.subscribe(listener));
    },
    removeEventListener(type, listener) {
      doc.removeEventListener(type, listener);
      stops.get(listener)?.();
      stops.delete(listener);
    },
  };
}

/**
 * As much of the store as `landingBackstop` reads: the phase is LOADING, the page shows a scene, and its changes; and
 * whether the proof bridge holds the opening's clock (`seekLoader`), which stops it on purpose.
 */
export interface LandingWatch extends SceneShown {
  loading(): boolean;
  held(): boolean;
}

/**
 * The landing backstop (Ruling 9b), started when the loader shows (SceneHost's onReady): if the phase is still LOADING
 * after LANDING_TIMEOUT_MS of a scene on a visible page (`whileShown`), it calls `fail`, once, and SceneHost fails the
 * scene as it fails any other (3D off for the visit, LOADED, the fallback card). It stands down for good the moment the
 * phase leaves LOADING, and starts nothing if it already has (a skipped opening, a direct arrival on a page). If its
 * time runs out while a seek holds the opening's clock (`?proof` only), the stall is the bridge's and not the
 * opening's: it waits a whole LANDING_TIMEOUT_MS again from there. Answers the stop, for a Stage that goes away first;
 * either way it lets go of every listener.
 */
export function landingBackstop(store: LandingWatch, fail: () => void, doc: VisibilitySource = document): () => void {
  if (!store.loading()) return () => {};
  let unsubscribe = (): void => {};
  let cancel = (): void => {};
  const arm = (): void => {
    cancel = visibleTimeout(
      LANDING_TIMEOUT_MS,
      () => {
        if (store.loading() && store.held()) return arm();
        unsubscribe();
        if (store.loading()) fail();
      },
      whileShown(doc, store),
    );
  };
  arm();
  unsubscribe = store.subscribe(() => {
    if (store.loading()) return;
    cancel();
    unsubscribe();
  });
  return () => {
    cancel();
    unsubscribe();
  };
}
