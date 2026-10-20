import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { registerStageProbe, RollingFps } from './stageReport';

/**
 * The Stage's part of the debug bridge (`window.__needleDebug`): it keeps a rolling mean of the frames the canvas draws and
 * tells the bridge the canvas's pixel ratio, that mean and the camera. The Stage mounts it only when the page was opened
 * with `?proof`, so a visitor's canvas runs no probe: nothing here runs per frame except under that flag.
 */
export function StageProbe(): null {
  const get = useThree((state) => state.get);
  const [meter] = useState(() => new RollingFps());

  useEffect(
    () =>
      registerStageProbe(() => {
        const { viewport, camera } = get();
        const { x, y, z } = camera.position;
        return { dpr: viewport.dpr, fps: meter.mean(), camera: { position: [x, y, z], fov: (camera as { fov?: number }).fov ?? 0 } };
      }),
    [get, meter],
  );

  useFrame(() => meter.push(performance.now()));
  return null;
}
