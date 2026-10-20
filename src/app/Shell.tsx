import { type JSX, type ReactNode, useEffect } from 'react';
import { useHomeScroll } from '~/input/useHomeScroll';
import { SceneHost } from '~/scene/SceneHost';
import { frame } from '~/state/frame';
import type { Phase } from '~/state/machine';
import { useRouteSync } from '~/state/routeSync';
import { useScene, useThreeDAttribute } from '~/state/store';
import { Poster } from '~/ui/Poster';
import { SiteHeader } from '~/ui/SiteHeader';
import { useRouteAttribute, useRouteName } from './routeName';

declare global {
  interface Window {
    /** The scene's phase, for the proof harness. Temporary: Task 8 replaces it with `window.__needleDebug`. */
    __needleScene?: () => Phase;
    /** The per-frame values (progress, target, chapterIndex...), for the proof harness. Temporary: Task 8 replaces it with `window.__needleDebug`. */
    __needleFrame?: typeof frame;
    /**
     * The scroll loop's requestAnimationFrame, behind `?proof`, so the harness can wrap it and count the loop's own
     * frames apart from the canvas's (useHomeScroll). Temporary: Task 8 replaces it with `window.__needleDebug`.
     */
    __needleScrollRequest?: (callback: FrameRequestCallback) => number;
  }
}

// The root layout's frame. It never unmounts, so neither does the canvas in
// SceneHost: route changes swap only what is inside <main>.
export function Shell({ children }: { children: ReactNode }): JSX.Element {
  const route = useRouteName();
  useRouteSync();
  useThreeDAttribute();
  useRouteAttribute(route);
  // The home page does not scroll natively while 3D is on: wheel, touch and keys drive the story instead.
  useHomeScroll(route === 'home');

  // Temporary, for the proof harness (`?proof` in the first URL); Task 8 replaces it with `window.__needleDebug`.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('proof')) return;
    window.__needleScene = () => useScene.getState().phase;
    window.__needleFrame = frame;
    window.__needleScrollRequest = (callback) => requestAnimationFrame(callback);
    return () => {
      delete window.__needleScene;
      delete window.__needleFrame;
      delete window.__needleScrollRequest;
    };
  }, []);

  // The scene host comes last: its canvas is fixed behind the page (z-index), and the fallback card it may show
  // comes after the page's own content in the reading and tab order.
  return (
    <>
      <Poster />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SceneHost />
    </>
  );
}
