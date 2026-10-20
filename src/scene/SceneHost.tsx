import { type JSX, lazy, Suspense, useSyncExternalStore } from 'react';

// three.js, R3F and drei load only in the browser, after hydration, in their
// own chunk; the prerendered HTML holds the empty host.
const Stage = lazy(() => import('./Stage'));

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function SceneHost(): JSX.Element {
  // false on the server and during hydration, true from the first client render after it.
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);

  return (
    <div className="scene-host" aria-hidden="true">
      {hydrated && (
        <Suspense fallback={null}>
          <Stage />
        </Suspense>
      )}
    </div>
  );
}
