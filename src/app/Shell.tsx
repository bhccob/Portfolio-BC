import { type JSX, type ReactNode, useEffect } from 'react';
import { SceneHost } from '~/scene/SceneHost';
import type { Phase } from '~/state/machine';
import { useRouteSync } from '~/state/routeSync';
import { useScene, useThreeDAttribute } from '~/state/store';
import { Poster } from '~/ui/Poster';
import { SiteHeader } from '~/ui/SiteHeader';

declare global {
  interface Window {
    /** The scene's phase, for the proof harness. Temporary: Task 8 replaces it with `window.__needleDebug`. */
    __needleScene?: () => Phase;
  }
}

// The root layout's frame. It never unmounts, so neither does the canvas in
// SceneHost: route changes swap only what is inside <main>.
export function Shell({ children }: { children: ReactNode }): JSX.Element {
  useRouteSync();
  useThreeDAttribute();

  // Temporary, for the proof harness (`?proof` in the first URL); Task 8 replaces it with `window.__needleDebug`.
  useEffect(() => {
    if (!window.location.search.includes('proof')) return;
    window.__needleScene = () => useScene.getState().phase;
    return () => {
      delete window.__needleScene;
    };
  }, []);

  return (
    <>
      <Poster />
      <SceneHost />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
