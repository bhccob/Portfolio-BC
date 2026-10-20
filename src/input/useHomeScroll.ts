import { useEffect } from 'react';
import { HOME_CHAPTERS } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { changedChapter, jumpTarget, moveTarget, scrollEnabled } from './target';
import { VirtualScroll } from './VirtualScroll';

type Damp = typeof import('maath/easing').damp;

/** About how long `progress` takes to catch up with `target`, in seconds. */
const SMOOTH_TIME = 0.25;
/** Within this many units of the target, progress is on it and the loop sleeps. */
const SETTLED = 1e-4;
/** A frame is never longer than this, in seconds: a tab that was in the background must not lurch the scene. */
const MAX_DT = 0.1;

let loadingDamp: Promise<Damp> | null = null;

/**
 * maath's `damp`, loaded on the first input rather than with the page. `maath/easing` imports three.js, which
 * the scene keeps out of the page's first load (it is its own chunk, fetched after hydration): a static import
 * here would put all of three.core in front of hydration on every page. Loaded this way it shares that chunk
 * with the scene.
 */
function loadDamp(): Promise<Damp> {
  loadingDamp ??= import('maath/easing').then(
    (easing) => easing.damp,
    (error: unknown) => {
      loadingDamp = null; // the next input tries again
      throw error;
    },
  );
  return loadingDamp;
}

/**
 * Drives the home page's story from the wheel, touch and keys, while `onHome` is true.
 *
 * `VirtualScroll` is bound to the document element for as long as the home page is shown. It takes events
 * only while `scrollEnabled` (3D on, the scroll's phases), read live from the store at each event: with 3D
 * off the page scrolls natively and nothing here prevents anything.
 *
 * A requestAnimationFrame loop (not R3F's `useFrame`: the canvas renders on demand) moves `frame.progress`
 * toward `frame.target` and sleeps when it arrives and no glide is going; an input wakes it. It dispatches
 * `CHAPTER` when `progress` crosses into another chapter, and keeps `frame.chapterIndex` in step with
 * `chapterAt` (the route sync reads it when a visitor comes back to `/`).
 */
export function useHomeScroll(onHome: boolean): void {
  useEffect(() => {
    if (!onHome) return;

    let raf = 0;
    let last = 0;
    let disposed = false;
    let smooth: Damp | null = null;

    const needsFrames = (): boolean => Math.abs(frame.target - frame.progress) > SETTLED || scroll.busy;

    const wake = (): void => {
      if (raf !== 0 || !useScene.getState().threeD || !needsFrames()) return;
      if (!smooth) {
        // The first move: fetch damp, then run. Inputs meanwhile only move the target.
        loadDamp().then(
          (damp) => {
            smooth = damp;
            if (!disposed) wake();
          },
          () => undefined, // the failed fetch is already in the console; the next input retries
        );
        return;
      }
      last = 0;
      raf = requestAnimationFrame(tick);
    };

    const syncChapter = (settled: boolean): void => {
      const at = changedChapter(HOME_CHAPTERS, frame.progress, frame.chapterIndex, settled);
      if (!at) return;
      frame.chapterIndex = at.index;
      useScene.getState().dispatch({ type: 'CHAPTER', chapter: at.id, category: at.category });
    };

    const tick = (now: number): void => {
      raf = 0;
      if (!smooth) return;
      if (!useScene.getState().threeD) {
        scroll.stop(); // 3D was switched off while it ran: the glide ends, the story stays where it is
        frame.velocity = 0;
        return;
      }
      const dt = last === 0 ? 1 / 60 : Math.min(Math.max((now - last) / 1000, 0), MAX_DT);
      last = now;

      scroll.step(dt);
      const before = frame.progress;
      smooth(frame, 'progress', frame.target, SMOOTH_TIME, dt, Infinity, undefined, SETTLED);
      const arrived = !needsFrames();
      if (arrived) frame.progress = frame.target; // on it, exactly: the next frame would snap it, but the loop sleeps first
      frame.velocity = dt > 0 ? (frame.progress - before) / dt : 0;
      syncChapter(arrived);

      if (arrived) frame.velocity = 0;
      else raf = requestAnimationFrame(tick);
    };

    const scroll: VirtualScroll = new VirtualScroll(document.documentElement, {
      unitPx: () => Math.max(window.innerHeight, 1),
      onDelta: (units) => {
        frame.target = moveTarget(frame.target, units, HOME_CHAPTERS, useScene.getState().reducedMotion);
        wake();
      },
      onJump: (to) => {
        frame.target = jumpTarget(to, HOME_CHAPTERS);
        wake();
      },
      // Live from the store, never a value captured at render: during hydration the hook's `threeD` is the default.
      enabled: () => scrollEnabled(useScene.getState()),
      reducedMotion: () => useScene.getState().reducedMotion,
      wake,
    });

    // Back from another page with the story still on its way, or 3D switched back on: finish the move.
    wake();
    const unsubscribe = useScene.subscribe((state, previous) => {
      if (state.threeD && !previous.threeD) wake();
    });

    return () => {
      disposed = true;
      unsubscribe();
      cancelAnimationFrame(raf);
      scroll.dispose();
    };
  }, [onHome]);
}
