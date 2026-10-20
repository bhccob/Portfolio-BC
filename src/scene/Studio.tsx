import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type * as THREE from 'three';
import { buildCompassStudio, type CompassStudio } from '~/engine/studio/CompassStudio';
import { HERO_POSE } from './Compass';

/** The longest step the dust and the haze take in one frame, seconds: a scene waking from sleep does not jump them. */
const MAX_STEP = 0.1;

export interface StudioProps {
  /** How many dust motes drift now (the quality ladder's `dust`). */
  dust: number;
  /** The most motes any rung of this pointer's ladder draws: the buffer is made that big once. */
  maxDust: number;
}

/**
 * The compass's studio, ported as it was (engine/studio/CompassStudio): the background and fog, the dark room of
 * light cards prefiltered for the reflections, the white key and the purple rim, the backdrop's glow, the haze and
 * the dust. It sets the renderer up as revision 4 did (sRGB output, the shoulder as CustomToneMapping); Effects
 * then decides whether the renderer tone-maps or the post chain does.
 *
 * The dust and the haze move only on frames that are drawn, so they stand still while the scene sleeps. A lost
 * context takes the prefiltered room with it, which lived only on the GPU: it is built again on restore.
 */
export function Studio({ dust, maxDust }: StudioProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const height = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);
  const studio = useRef<CompassStudio | null>(null);
  const time = useRef(0);

  // Before the first frame, so nothing is drawn without its light.
  useLayoutEffect(() => {
    const before = new Set<THREE.Object3D>(scene.children);
    const built = buildCompassStudio(gl, scene, maxDust);
    const added = scene.children.filter((child) => !before.has(child));
    built.setDim(HERO_POSE.dim);
    studio.current = built;
    const relight = (): void => {
      built.relight();
      invalidate();
    };
    gl.domElement.addEventListener('webglcontextrestored', relight);
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', relight);
      studio.current = null;
      built.dispose();
      scene.remove(...added);
      scene.background = null;
      scene.fog = null;
      scene.environment = null;
    };
  }, [gl, scene, invalidate, maxDust]);

  useEffect(() => {
    studio.current?.dust.setCount(dust);
    invalidate();
  }, [dust, invalidate]);

  // A mote's size in pixels is its world size times half the drawing buffer's height over its depth.
  useEffect(() => {
    studio.current?.dust.setScale((height * dpr) / 2);
    invalidate();
  }, [height, dpr, invalidate]);

  useFrame((_, delta) => {
    time.current += Math.min(Math.max(delta, 0), MAX_STEP);
    studio.current?.setTime(time.current);
  });

  return null;
}
