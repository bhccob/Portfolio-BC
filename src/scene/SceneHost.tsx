import { Component, type JSX, lazy, memo, type ReactNode, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import type { SceneKind } from '~/app/handle';
import { PAGES } from '~/data/pages';
import { useTranslator } from '~/i18n/useTranslator';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { stageWanted } from './gate';
import { LANDING_TIMEOUT_MS, type LandingWatch, landingBackstop, LOAD_TIMEOUT_MS, visibleTimeout } from './timeouts';
import { type WebGLSupport, webglSupport } from './webgl';

// three.js, R3F and drei load only in the browser, after hydration, in their
// own chunk; the prerendered HTML holds the empty host.
const Stage = lazy(() => import('./Stage'));

/** The browser's WebGL, probed once per page view, the first time 3D is wanted. */
let probed: WebGLSupport | null = null;

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

type Fail = (reason: string, error?: unknown) => void;

/**
 * The store as the landing backstop reads it: the phase still LOADING, the page shown having a scene, and every change;
 * and the proof bridge's hold on the opening's clock (`frame.loaderHold`).
 */
const LANDING_WATCH: LandingWatch = {
  loading: () => useScene.getState().phase.kind === 'LOADING',
  shown: () => useScene.getState().scene !== null,
  held: () => frame.loaderHold !== null,
  subscribe: (listener) => useScene.subscribe(listener),
};

/** Catches a Stage that throws while rendering (or a chunk that fails to load), and reports it instead. */
class StageBoundary extends Component<{ onFail: Fail; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onFail('the scene threw', error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** "The needle lost north": the scene is not there, the poster is, and Lite is one link away. */
function FallbackCard(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  return (
    <div className="scene-fallback" role="status">
      <p className="scene-fallback-title">{t.needle.fallback.title}</p>
      <Link className="scene-fallback-link" to={i18n.path(PAGES.lite)}>
        {t.needle.fallback.lite}
      </Link>
    </div>
  );
}

export interface SceneHostProps {
  /** The scene of the page shown: its route's `handle.scene` (src/app/handle.ts), read by the Shell. */
  scene: SceneKind | null;
}

/**
 * The scene's place in the page: the canvas over the poster, or the poster alone.
 *
 * It mounts the Stage only in the browser, after hydration, while 3D is on and the browser has WebGL2 on a GPU
 * (`webglSupport()` is 'ok'). HYDRATION GATING (store.ts): `threeD` from the hook says "on" during the hydration
 * commit whatever the visitor stored, so the gate also needs the hydrated flag and the store's live value; a visitor
 * who switched 3D off never mounts WebGL, not even once.
 *
 * The first Stage waits for a page with a scene (`stageWanted`): a visit that begins on Lite, contact or the not-found
 * page probes no WebGL, fetches no Stage chunk, three.js or texture, and says LOADED at once. Once a Stage is up it
 * stays from page to page; on a page without a scene it sleeps behind the page (the parts inside the canvas read the
 * page's `scene` from the store, where this host puts it, and wake nothing there).
 *
 * Whenever it settles on no Stage (3D off, no WebGL, a software renderer, a failed scene) it says LOADED, so a
 * direct load of `/` leaves LOADING. While a Stage is up it never does: the Stage's opening (src/scene/v3/Opening.tsx)
 * says LOADED itself, once it has played the loader and landed on the home. The Stage tells two moments apart:
 * `onStarted`, its loader built and compiled, which stops the load timeout; and `onReady`, the canvas can show, which
 * fades it in over the poster (and stops the timeout too, if `onStarted` did not come first). A normal opening says
 * `onReady` alone, as its loader shows; one that skips its loader (a visit that began on Lite) says `onStarted` at the
 * same point and `onReady` once its home is warm, so either has LOAD_TIMEOUT_MS to start and then the opening's own
 * give-up time for the home. Without WebGL to speak of,
 * or when the scene fails (it threw, its context was lost for good, the loader was not built after LOAD_TIMEOUT_MS of
 * the page being visible, so a background tab is not given up on, the opening gave up on its load, or it had not landed
 * LANDING_TIMEOUT_MS after the loader showed, counting only the time a scene was on a visible page), 3D goes
 * off for this visit (not stored: the visitor's own choice stays as it was), so the page scrolls natively and the
 * home page's links show, and the fallback card says so with a link to Lite. Switching 3D back on after a failure
 * tries again; without WebGL it cannot, and 3D goes straight back off.
 *
 * The canvas stays invisible (`data-ready` unset) until the loader can show, so the poster, as dark as the loader, is
 * the picture meanwhile.
 * `data-webgl` says what the probe found ('ok', 'none' or 'software'), once it has run.
 */
function SceneHostView({ scene }: SceneHostProps): JSX.Element {
  // false on the server and during hydration, true from the first client render after it.
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);
  const threeD = useScene((state) => state.threeD);
  // A Stage is mounted, so it stays on a page without a scene; kept in step with showStage, during render.
  const [up, setUp] = useState(false);
  const wanted = stageWanted({ hydrated, threeD: threeD && useScene.getState().threeD, scene, up });
  const [support, setSupport] = useState<WebGLSupport | null>(probed);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const run = useRef({ started: false, ready: false, failed: false, cancel: () => {} });

  const unsupported = support === 'none' || support === 'software';
  const showStage = wanted && support === 'ok' && !failed;
  const deciding = wanted && support === null;
  if (up !== showStage) setUp(showStage);

  // The parts inside the canvas read the page's scene from the store, from before they draw the page's first frame.
  useLayoutEffect(() => {
    useScene.getState().setScene(scene);
  }, [scene]);

  useEffect(() => {
    if (wanted && support === null) setSupport((probed ??= webglSupport()));
  }, [wanted, support]);

  useEffect(() => {
    if (wanted && unsupported) useScene.getState().setThreeD(false, { persist: false });
  }, [wanted, unsupported]);

  useEffect(() => {
    if (hydrated && !showStage && !deciding) useScene.getState().dispatch({ type: 'LOADED' });
  }, [hydrated, showStage, deciding]);

  // The visitor switches 3D back on after a failure: try again.
  useEffect(
    () =>
      useScene.subscribe((state, previous) => {
        if (state.threeD && !previous.threeD) setFailed(false);
      }),
    [],
  );

  const fail = useCallback<Fail>((reason, error) => {
    const current = run.current;
    if (current.failed) return;
    current.failed = true;
    current.cancel();
    if (error === undefined) console.warn(`[needle] ${reason}; showing the poster`);
    else console.error(`[needle] ${reason}; showing the poster`, error);
    setFailed(true);
    setReady(false);
    useScene.getState().setThreeD(false, { persist: false });
  }, []);

  // The opening's loader is built and compiled: the load timeout stops, and the canvas stays hidden. A skipped opening
  // (src/scene/v3/openingPose.ts `openingReadiness`) says this first and onReady once its home is warm too, on a budget
  // of its own meanwhile; a normal one says onReady alone, which says this as well.
  const onStarted = useCallback(() => {
    const current = run.current;
    if (current.started || current.failed) return;
    current.started = true;
    current.cancel();
  }, []);

  // The canvas can show: it fades in, and the load timeout stops if it has not. LOADED is the opening's to send, when it lands.
  const onReady = useCallback(() => {
    const current = run.current;
    if (current.ready || current.failed) return;
    current.ready = true;
    current.started = true;
    current.cancel();
    setReady(true);
  }, []);

  // Each Stage mount gets LOAD_TIMEOUT_MS of the page being visible for its loader to be built and compiled (onStarted,
  // or onReady): a tab opened in the background cannot paint or draw, and is not given up on while it waits there.
  useEffect(() => {
    if (!showStage) {
      setReady(false);
      return;
    }
    const current = { started: false, ready: false, failed: false, cancel: () => {} };
    run.current = current;
    current.cancel = visibleTimeout(LOAD_TIMEOUT_MS, () => {
      if (!current.started) fail(`the scene was not ready after ${LOAD_TIMEOUT_MS / 1000} s of the page being visible`);
    });
    return () => current.cancel();
  }, [showStage, fail]);

  // From the loader showing until the phase leaves LOADING, the landing backstop (Ruling 9b) stands behind the opening's
  // own give-up: an opening stalled where its clock cannot see fails as any other scene does.
  useEffect(() => {
    if (!ready) return;
    return landingBackstop(LANDING_WATCH, () =>
      fail(`the opening did not land within ${LANDING_TIMEOUT_MS / 1000} s of the loader showing on a visible page`),
    );
  }, [ready, fail]);

  return (
    <>
      <div className="scene-host" aria-hidden="true" data-ready={ready ? '' : undefined} data-webgl={support ?? undefined}>
        {showStage && (
          <StageBoundary onFail={fail}>
            <Suspense fallback={null}>
              <Stage onStarted={onStarted} onReady={onReady} onFail={fail} />
            </Suspense>
          </StageBoundary>
        )}
      </div>
      {hydrated && (unsupported || failed) && <FallbackCard />}
    </>
  );
}

/**
 * Memoised: the Shell re-renders on every navigation, and only a change of the page's scene reaches the host. The Stage
 * is never handed it as a prop (a Stage render re-renders the post chain): its parts read it from the store.
 */
export const SceneHost = memo(SceneHostView);
