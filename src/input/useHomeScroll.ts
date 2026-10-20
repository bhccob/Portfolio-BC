import { useEffect } from 'react';
import { debugBridge } from '~/debug/needleDebug';
import { wakeScene } from '~/scene/motion';
import { HOME_CHAPTERS } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
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

/**
 * Drives the home page's story from the wheel, touch and keys, while `onHome` is true (`startHomeScroll`).
 *
 * `VirtualScroll` is bound to the document element for as long as the home page is shown. It takes events
 * only while `scrollEnabled` (3D on, the scroll's phases), read live from the store at each event: with 3D
 * off the page scrolls natively and nothing here prevents anything.
 *
 * A requestAnimationFrame loop (not R3F's `useFrame`: the canvas renders on demand) moves `frame.progress`
 * toward `frame.target` and sleeps when it arrives and no glide is going; an input wakes it. It dispatches
 * `CHAPTER` when `progress` crosses into another chapter, and keeps `frame.chapterIndex` in step with
 * `chapterAt` (the route sync reads it when a visitor comes back to `/`). Each frame it asks for also wakes the
 * canvas (`wakeScene`), so the scene draws the frames in which the story moves.
 */
export function useHomeScroll(onHome: boolean): void {
  useEffect(() => {
    if (!onHome) return;

    // Behind `?proof` there is a debug bridge, and the loop's frames are asked for through it so the harness can count them
    // apart from the canvas's. Looked up here, once, and never again: without a bridge a frame costs no read of anything.
    const bridge = debugBridge();
    const requestFrame = bridge ? (callback: FrameRequestCallback) => bridge.scrollRequest(callback) : (callback: FrameRequestCallback) => requestAnimationFrame(callback);

    const home = startHomeScroll({
      el: document.documentElement,
      frame,
      chapters: HOME_CHAPTERS,
      unitPx: () => Math.max(window.innerHeight, 1),
      // Live from the store, never a value captured at render: during hydration the hook's `threeD` is the default.
      enabled: () => scrollEnabled(useScene.getState()),
      reducedMotion: () => useScene.getState().reducedMotion,
      threeD: () => useScene.getState().threeD,
      onChapter: (at) => useScene.getState().dispatch({ type: 'CHAPTER', chapter: at.id, category: at.category }),
      loadSmooth: loadDamp,
      request: (callback) => {
        wakeScene();
        return requestFrame(callback);
      },
      cancel: (id) => cancelAnimationFrame(id),
    });

    // 3D switched back on with the story still on its way: finish the move.
    const unsubscribe = useScene.subscribe((state, previous) => {
      if (state.threeD && !previous.threeD) home.loop.wake();
    });

    return () => {
      unsubscribe();
      home.dispose();
    };
  }, [onHome]);
}
