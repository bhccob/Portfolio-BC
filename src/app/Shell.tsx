import type { JSX, ReactNode } from 'react';
import { useNeedleDebug } from '~/debug/useNeedleDebug';
import { useTranslator } from '~/i18n/useTranslator';
import { useHomeScroll } from '~/input/useHomeScroll';
import { SceneHost } from '~/scene/SceneHost';
import { useRouteSync } from '~/state/routeSync';
import { useThreeDAttribute } from '~/state/store';
import { Poster } from '~/ui/Poster';
import { SiteHeader } from '~/ui/SiteHeader';
import { useNavigationFocus } from './navigationFocus';
import { useRouteAttribute, useRouteHandle } from './routeName';

// The root layout's frame. It never unmounts, so neither does the canvas in
// SceneHost: route changes swap only what is inside <main>.
export function Shell({ children }: { children: ReactNode }): JSX.Element {
  // The matched route's handle (src/app/handle.ts): the kind of page, and the scene it shows, if any.
  const { route, scene } = useRouteHandle();
  const { locale } = useTranslator();
  useRouteSync();
  useThreeDAttribute();
  useRouteAttribute(route);
  // A page reached by a link takes the focus to <main> (the scroll is root.tsx's ScrollRestoration).
  useNavigationFocus();
  // Behind `?proof` only: window.__needleDebug for the proof harness. Before useHomeScroll, whose loop asks for the bridge when it mounts.
  useNeedleDebug(route, locale);
  // The home page does not scroll natively while 3D is on: wheel, touch and keys drive the story instead.
  useHomeScroll(route === 'home');

  // The scene host comes last: its canvas is fixed behind the page (z-index), and the fallback card it may show
  // comes after the page's own content in the reading and tab order.
  return (
    <>
      <Poster />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SceneHost scene={scene} />
    </>
  );
}
