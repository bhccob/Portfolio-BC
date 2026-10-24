import { useEffect } from 'react';
import { debugBridge } from '~/debug/needleDebug';
import { diveHoldFor } from '~/scene/bob/diveHold';
import { wakeScene } from '~/scene/motion';
import { HOME_CHAPTERS } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { skipSwallower } from './loaderSkip';
import { type Smooth, startHomeScroll } from './scrollLoop';
import { scrollEnabled } from './target';

let loadingDamp: Promise<Smooth> | null = null;

/**
 * maath's `damp`, loaded on the first input rather than with the page. `maath/easing` imports three.js, which
 * the scene keeps out of the page's first load (it is its own chunk, fetched after hydration): a static import
 * here would put all of three.core in front of hydration on every page. Loaded this way it shares that chunk
 * with the scene.
 */
function loadDamp(): Promise<Smooth> {
  loadingDamp ??= import('maath/easing').then(
    (easing) => easing.damp,
    (error: unknown) => {
      loadingDamp = null; // the next mount tries again
      throw error;
    },
  );
  return loadingDamp;
}

/** What `connectHomeScroll` is given of the page: the element it listens on, the unit and the frames. */
export interface HomeScrollPage {
  el: HTMLElement;
  /** Pixels in one unit of scroll: the viewport's height. */
  unitPx: () => number;
  /** requestAnimationFrame and cancelAnimationFrame (the proof bridge's, behind `?proof`). */
  request: (callback: (now: number) => void) => number;
  cancel: (id: number) => void;
  /** Fetches maath's `damp`; `loadDamp` by default. */
  loadSmooth?: () => Promise<Smooth>;
}

/**
 * The home page's scroll (`startHomeScroll`) on `page.el`, wired to the store and to `frame`: what `useHomeScroll` runs
 * while the home page is shown, apart from React so a test runs the very wiring. Answers its taking down.
 *
 * It takes events only while `scrollEnabled` (3D on, the scroll's phases), read live from the store at each event:
 * with 3D off the page scrolls natively and nothing here prevents anything. At the end page at rest (`<html
 * data-end="rest">`, which Home writes) the page scrolls natively too: there `startHomeScroll` leaves the browser every
 * gesture down and every gesture up while the page is scrolled, each gesture to its end, and takes an input up at the
 * page's top back to Cookies Clicker; Home goes to the story's start, the page back at its top first.
 *
 * While a skipped loader's input is still arriving (`skipSwallower`, from `frame.loaderSkipEndsMs`: the fast-forward
 * and `SKIP_SWALLOW_MS` after the landing, then on while the input keeps coming without SKIP_QUIET_MS of quiet, for
 * SKIP_SWALLOW_CAP_MS after the landing at most) the input drops what it hears but still prevents it, so the tail of
 * the wheel or the swipe that skipped neither moves the story nor scrolls the page. It is the input that does this, not
 * `enabled`, because an event `enabled` turns away is left to the browser, and the browser would scroll with it.
 *
 * A requestAnimationFrame loop (not R3F's `useFrame`: the canvas renders on demand) moves `frame.progress`
 * toward `frame.target` and sleeps when it arrives and no glide is going; an input wakes it. It dispatches
 * `CHAPTER` when `progress` crosses into another chapter, and keeps `frame.chapterIndex` in step with
 * `chapterAt` (the route sync reads it when a visitor comes back to `/`). Each frame it asks for also wakes the
 * canvas (`wakeScene`), so the scene draws the frames in which the story moves.
 *
 * The void under the glass holds it (`diveHoldFor` of the store's `voidState`, src/scene/bob/diveHold.ts): while the
 * void loads the target goes no further than the dive's hold over the tunnel's opening (Bob's frame d01), and if it
 * failed no further than BOB from above. When the void's state changes the input is told (`holdChanged`), so a story
 * held over the tunnel goes on once the void is ready, or comes back to BOB from above if it failed. With 3D off the
 * void goes with the Stage and nothing holds the visitor's place back; 3D back on (`resume`) holds a story past the
 * hold until the void is ready again, and then takes it back where it was.
 */
export function connectHomeScroll(page: HomeScrollPage): () => void {
  const home = startHomeScroll({
    el: page.el,
    frame,
    chapters: HOME_CHAPTERS,
    unitPx: page.unitPx,
    // Live from the store, never a value captured at render: during hydration the hook's `threeD` is the default.
    enabled: () => scrollEnabled(useScene.getState()),
    swallow: skipSwallower(
      () => performance.now(),
      () => frame.loaderSkipEndsMs,
    ),
    reducedMotion: () => useScene.getState().reducedMotion,
    threeD: () => useScene.getState().threeD,
    hold: () => diveHoldFor(useScene.getState().voidState),
    holdWaits: () => useScene.getState().voidState !== 'failed',
    onChapter: (at) => useScene.getState().dispatch({ type: 'CHAPTER', chapter: at.id, category: at.category }),
    loadSmooth: page.loadSmooth ?? loadDamp,
    request: (callback) => {
      wakeScene();
      return page.request(callback);
    },
    cancel: page.cancel,
  });

  // 3D switched back on: the story is held if it is past the hold, and its move is finished. The void's state moves the hold.
  const unsubscribe = useScene.subscribe((state, previous) => {
    if (!state.threeD && previous.threeD) home.suspend();
    if (state.threeD && !previous.threeD) home.resume();
    if (state.voidState !== previous.voidState) home.holdChanged();
  });

  return () => {
    unsubscribe();
    home.dispose();
  };
}

/**
 * Drives the home page's story from the wheel, touch and keys, while `onHome` is true: `connectHomeScroll` on the
 * document element, for as long as the home page is shown (the page covers the canvas, so the canvas hears nothing).
 */
export function useHomeScroll(onHome: boolean): void {
  useEffect(() => {
    if (!onHome) return;

    // Behind `?proof` there is a debug bridge, and the loop's frames are asked for through it so the harness can count them
    // apart from the canvas's. Looked up here, once, and never again: without a bridge a frame costs no read of anything.
    const bridge = debugBridge();
    const request = bridge ? (callback: FrameRequestCallback) => bridge.scrollRequest(callback) : (callback: FrameRequestCallback) => requestAnimationFrame(callback);

    return connectHomeScroll({
      el: document.documentElement,
      unitPx: () => Math.max(window.innerHeight, 1),
      request,
      cancel: (id) => cancelAnimationFrame(id),
    });
  }, [onHome]);
}
