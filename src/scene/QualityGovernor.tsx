import { addTail, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FrameJudge, qualityFor, qualitySteps, tierFor } from '~/engine/quality';
import { useScene } from '~/state/store';
import { setGasQuality } from './gasPass';

export interface QualityGovernorProps {
  /** The rung of the quality ladder the scene draws at (engine/quality), 0 the best. */
  step: number;
  finePointer: boolean;
  /** Frames ran slow: the rung to go down to. */
  onStep(step: number): void;
}

/** What a rung asks of the store and the gas: read by the Stage too, before its first render. */
export function applyStep(step: number, finePointer: boolean): void {
  const quality = qualityFor(step, finePointer);
  const scene = useScene.getState();
  scene.setTier(tierFor(step, finePointer));
  scene.setPost({ samples: quality.samples, bloom: quality.bloom });
  setGasQuality(quality.gas);
}

/**
 * Walks the quality ladder down, never up, as `FrameJudge` judges the frames: each rung sets the pixel ratio (`setDpr`,
 * never above the device's), the tier, the post chain's MSAA and bloom and the gas (`applyStep`), and through the Stage the
 * glass floor's reflection. The canvas renders on demand, so only frames drawn back to back are lengths at all: a sleep
 * between two of them (R3F's tail) starts the count over, and nothing here renders while the scene runs.
 */
export function QualityGovernor({ step, finePointer, onStep }: QualityGovernorProps): null {
  const setDpr = useThree((state) => state.setDpr);
  const [judge] = useState(() => new FrameJudge());
  const current = useRef(step);
  const last = useRef<number | null>(null);
  useLayoutEffect(() => {
    current.current = step;
  }, [step]);

  useEffect(
    () =>
      addTail(() => {
        last.current = null;
        judge.rest();
      }),
    [judge]
  );

  useEffect(() => {
    setDpr([1, qualityFor(step, finePointer).pixelRatio]);
    applyStep(step, finePointer);
  }, [step, finePointer, setDpr]);

  useFrame(() => {
    // While the void and the world are being built the frames are slow for a reason that will pass.
    if (useScene.getState().voidState === 'loading') {
      last.current = null;
      judge.rest();
      return;
    }
    const now = performance.now();
    const before = last.current;
    last.current = now;
    if (before === null) return;
    const down = judge.frame(now - before);
    if (down > 0) {
      const next = Math.min(current.current + down, qualitySteps(finePointer) - 1);
      if (next !== current.current) onStep(next);
    }
  });

  return null;
}
