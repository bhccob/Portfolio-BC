import { PerformanceMonitor } from '@react-three/drei';
import { addTail, useThree } from '@react-three/fiber';
import { type JSX, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { qualityFor, qualitySteps, tierFor } from '~/engine/quality';
import { useScene } from '~/state/store';

export interface QualityGovernorProps {
  /** The rung of the quality ladder the scene draws at (engine/quality), 0 the best. */
  step: number;
  finePointer: boolean;
  /** Frames ran slow: the next rung down. */
  onStep(step: number): void;
}

/**
 * Walks the quality ladder down, never up, as drei's PerformanceMonitor judges the frame rate: each decline is one
 * rung (engine/quality's `qualitySteps`), which sets the pixel ratio (`setDpr`, never above the device's), the tier
 * (`tierFor`: high, medium, low; the store's `setTier`), and through the Stage the glass floor's reflection. An incline
 * is ignored: a page view never climbs back.
 *
 * The canvas renders on demand, so the monitor sees only the frames that are drawn. A sleep between two of them is
 * not a slow frame: the monitor is started afresh every time the scene goes to sleep (R3F's tail), so it only ever
 * measures runs of frames drawn back to back.
 */
export function QualityGovernor({ step, finePointer, onStep }: QualityGovernorProps): JSX.Element {
  const setDpr = useThree((state) => state.setDpr);
  const [run, setRun] = useState(0);
  const current = useRef(step);
  useLayoutEffect(() => {
    current.current = step;
  }, [step]);

  useEffect(() => addTail(() => setRun((n) => n + 1)), []);

  useEffect(() => {
    setDpr([1, qualityFor(step, finePointer).pixelRatio]);
    useScene.getState().setTier(tierFor(step, finePointer));
  }, [step, finePointer, setDpr]);

  const decline = useCallback(() => {
    if (current.current >= qualitySteps(finePointer) - 1) return;
    onStep(current.current + 1);
  }, [finePointer, onStep]);

  return <PerformanceMonitor key={run} onDecline={decline} />;
}
