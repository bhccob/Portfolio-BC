import { Canvas, useThree } from '@react-three/fiber';
import { type JSX, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { debugBridge } from '~/debug/needleDebug';
import { StageProbe } from '~/debug/StageProbe';
import { countCanvasMount } from '~/debug/stageReport';
import { qualityFor } from '~/engine/quality';
import { frame } from '~/state/frame';
import { Effects } from './Effects';
import { Heartbeat } from './Heartbeat';
import { resetMotion } from './motion';
import { QualityGovernor } from './QualityGovernor';
import { Rig } from './Rig';
import { Studio } from './Studio';
import { RESTORE_TIMEOUT_MS, visibleTimeout } from './timeouts';
import { Opening } from './v3/Opening';

/**
 * A mouse or trackpad: the finer ladder, ring masks and city. Read once, when the Stage's chunk loads (in the browser
 * only).
 */
const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true;

/**
 * The rung reached so far in this page view. A Stage mounted again (3D switched off and on) starts there: the
 * ladder never climbs back within a page view.
 */
let reached = 0;

// The Canvas's own props are constants, so a Stage render never reconfigures the renderer or the camera. `flat`:
// R3F sets no tone mapping of its own (Studio and Effects do). `alpha: false`: the studio is opaque.
const GL = { antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' } as const;
// `manual`: R3F leaves the camera alone on resize; Rig frames it (aspect, view offset) itself.
const CAMERA = { fov: 30, near: 0.1, far: 100, position: [0, 0, 5] as [number, number, number], manual: true };

export interface StageProps {
  /**
   * The opening's loader is built and compiled (its chip, laser, traces and mist), so the load timeout stops, while the
   * canvas stays hidden: said by an opening that skips its loader, which shows only once its home is warm too.
   */
  onStarted(): void;
  /** The canvas can show: the loader's first frame, or a skipped opening's home. Implies `onStarted`. */
  onReady(): void;
  /**
   * The scene failed: the opening could not be built, its load threw or did not finish in time, or the context was lost
   * for good. Called once.
   */
  onFail(reason: string, error?: unknown): void;
}

/**
 * Tells the frame loop while the context is lost, and fails the Stage if it does not come back within
 * RESTORE_TIMEOUT_MS of the page being visible (a browser may restore a background tab's context only once it shows).
 */
function ContextWatch({ onFail }: Pick<StageProps, 'onFail'>): null {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    let cancel = (): void => {};
    const lost = (): void => {
      frame.contextLost = true;
      cancel();
      cancel = visibleTimeout(RESTORE_TIMEOUT_MS, () => onFail(`the WebGL context was lost and not restored within ${RESTORE_TIMEOUT_MS / 1000} s`));
    };
    const restored = (): void => {
      frame.contextLost = false;
      cancel();
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      cancel();
      frame.contextLost = false;
    };
  }, [gl, invalidate, onFail]);
  return null;
}

/**
 * The persistent canvas and the scene in it: the v3 studio, the opening (the loader, landing on the home), the camera
 * rig, the post chain, the quality governor and the heartbeat of the demand frame loop. SceneHost mounts it once 3D is
 * on and WebGL is there, and gives it LOAD_TIMEOUT_MS to say the loader can show; the opening says LOADED itself when
 * it lands.
 *
 * Memoised (its callbacks are stable): a host render, as when the page's scene changes, never re-renders the
 * canvas's tree, whose post chain would rebuild its passes. The parts read what changes (the page's scene, the tier,
 * 3D, the phase) from the store.
 */
export default memo(function Stage({ onStarted, onReady, onFail }: StageProps): JSX.Element {
  const [step, setStep] = useState(() => reached);
  const quality = qualityFor(step, FINE_POINTER);
  // The Canvas's dpr follows the rung, so a Stage render never puts back a ratio the governor has lowered.
  const dpr = useMemo((): [number, number] => [1, quality.pixelRatio], [quality.pixelRatio]);

  // Behind `?proof` the debug bridge is there, and the Stage mounts a probe for it (fps, pixel ratio, camera). Asked once, at mount.
  const [probe] = useState(() => debugBridge() !== null);

  useEffect(() => {
    countCanvasMount(); // a counter, once a mount: the bridge reports it as canvasMounts
    return resetMotion;
  }, []);

  const stepDown = useCallback((next: number) => {
    reached = Math.max(reached, next);
    setStep(next);
  }, []);

  return (
    // R3F 9.8 makes a THREE.Clock per root, which three 0.186 reports once as deprecated (a console warning); no Canvas prop avoids it.
    <Canvas dpr={dpr} frameloop="demand" flat gl={GL} camera={CAMERA}>
      <ContextWatch onFail={onFail} />
      <Studio />
      <Opening clearcoat={quality.clearcoat} finePointer={FINE_POINTER} onStarted={onStarted} onReady={onReady} onFail={onFail} />
      <Rig />
      <Effects />
      <QualityGovernor step={step} finePointer={FINE_POINTER} onStep={stepDown} />
      <Heartbeat />
      {probe && <StageProbe />}
    </Canvas>
  );
});
