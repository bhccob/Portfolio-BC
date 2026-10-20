import { Canvas, useThree } from '@react-three/fiber';
import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { qualityFor, qualitySteps } from '~/engine/quality';
import { frame } from '~/state/frame';
import { Compass } from './Compass';
import { Effects } from './Effects';
import { Heartbeat } from './Heartbeat';
import { resetMotion } from './motion';
import { QualityGovernor } from './QualityGovernor';
import { Rig } from './Rig';
import { Studio } from './Studio';
import { RESTORE_TIMEOUT_MS } from './timeouts';

declare global {
  interface Window {
    /** How many times the Stage has mounted; the proof harness expects 1 across navigation. */
    __needleMounts?: number;
  }
}

/** A mouse or trackpad: the finer ladder and paint. Read once, when the Stage's chunk loads (in the browser only). */
const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true;

/** The most dust motes any rung of this pointer's ladder draws. */
const MAX_DUST = Math.max(...Array.from({ length: qualitySteps(FINE_POINTER) }, (_, step) => qualityFor(step, FINE_POINTER).dust));

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
  /** The compass is ready: built, painted, its textures settled (or waited for) and its programs compiled. */
  onReady(): void;
  /** The scene failed: the compass could not be built, or the context was lost for good. Called once. */
  onFail(reason: string, error?: unknown): void;
}

/** Tells the frame loop while the context is lost, and fails the Stage if it does not come back in time. */
function ContextWatch({ onFail }: Pick<StageProps, 'onFail'>): null {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    let timer = 0;
    const lost = (): void => {
      frame.contextLost = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onFail(`the WebGL context was lost and not restored within ${RESTORE_TIMEOUT_MS / 1000} s`), RESTORE_TIMEOUT_MS);
    };
    const restored = (): void => {
      frame.contextLost = false;
      window.clearTimeout(timer);
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      window.clearTimeout(timer);
      frame.contextLost = false;
    };
  }, [gl, invalidate, onFail]);
  return null;
}

/**
 * The persistent canvas and the scene in it: the studio, the compass, the camera rig, the post chain, the quality
 * governor and the heartbeat of the demand frame loop. SceneHost mounts it once 3D is on and WebGL is there, and
 * gives it LOAD_TIMEOUT_MS to say it is ready.
 */
export default function Stage({ onReady, onFail }: StageProps): JSX.Element {
  const [step, setStep] = useState(() => reached);
  const quality = qualityFor(step, FINE_POINTER);
  // The Canvas's dpr follows the rung, so a Stage render never puts back a ratio the governor has lowered.
  const dpr = useMemo((): [number, number] => [1, quality.pixelRatio], [quality.pixelRatio]);

  useEffect(() => {
    window.__needleMounts = (window.__needleMounts ?? 0) + 1;
    return resetMotion;
  }, []);

  const stepDown = useCallback((next: number) => {
    reached = Math.max(reached, next);
    setStep(next);
  }, []);

  return (
    <Canvas dpr={dpr} frameloop="demand" flat gl={GL} camera={CAMERA}>
      <ContextWatch onFail={onFail} />
      <Studio dust={quality.dust} maxDust={MAX_DUST} />
      <Compass clearcoat={quality.clearcoat} finePointer={FINE_POINTER} onReady={onReady} onFail={onFail} />
      <Rig />
      <Effects />
      <QualityGovernor step={step} finePointer={FINE_POINTER} onStep={stepDown} />
      <Heartbeat />
    </Canvas>
  );
}
