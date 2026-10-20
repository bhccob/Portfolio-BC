import type { JSX, ReactNode } from 'react';
import { SceneHost } from '~/scene/SceneHost';
import { Poster } from '~/ui/Poster';
import { SiteHeader } from '~/ui/SiteHeader';

// The root layout's frame. It never unmounts, so neither does the canvas in
// SceneHost: route changes swap only what is inside <main>.
export function Shell({ children }: { children: ReactNode }): JSX.Element {
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
