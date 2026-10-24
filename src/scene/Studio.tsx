import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { buildRoom, type RoomModel } from '~/engine/bob/build/room';
import { shoulder } from '~/engine/studio/shoulder';
import { LOOK } from './bob/look';

/**
 * The BOB studio, the ground the scene stands in, built from LOOK (src/scene/bob/look.ts):
 *   - the preview's black as the clear colour and the background, and linear fog of the same black
 *     (LOOK.fog, the colour of the background), so the far glass fades into the black it ends against and shows no
 *     horizon line; no sky beyond (v3's nebula is gone: the black is the sky);
 *   - the reflection room (src/engine/bob/build/room.ts), prefiltered through PMREM into `scene.environment`, which is
 *     what makes the metal gold and keeps the glass smoked;
 *   - one dim warm key light from the upper left for the gold and a faint violet rim from behind (LOOK.key, LOOK.rim);
 *   - no dust (restraint, spec §4): the quality ladder's `dust` rung goes unused.
 * It sets the renderer up as milestone 1's did (sRGB output, the shoulder as CustomToneMapping, LOOK.exposure); Effects
 * then decides whether the renderer tone-maps or the post chain does.
 *
 * A lost context takes the prefiltered room with it, which lived only on the GPU: it is built again on restore.
 */
export function Studio(): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  // Before the first frame, so nothing is drawn without its light.
  useLayoutEffect(() => {
    shoulder();
    gl.setClearColor(LOOK.background, 1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.CustomToneMapping;
    gl.toneMappingExposure = LOOK.exposure;
    gl.shadowMap.enabled = false;
    scene.background = new THREE.Color(LOOK.background);
    scene.fog = new THREE.Fog(LOOK.fog.color, LOOK.fog.near, LOOK.fog.far);
    scene.environmentIntensity = LOOK.environment;

    let room: RoomModel = buildRoom(gl);
    scene.environment = room.environment;

    const lights = (['key', 'rim'] as const).map((name) => {
      const { colour, intensity, position } = LOOK[name];
      const light = new THREE.DirectionalLight(colour, intensity);
      light.name = name;
      light.position.set(position[0], position[1], position[2]);
      return light;
    });
    scene.add(...lights);

    const relight = (): void => {
      room.dispose();
      room = buildRoom(gl);
      scene.environment = room.environment;
      invalidate();
    };
    gl.domElement.addEventListener('webglcontextrestored', relight);
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', relight);
      scene.remove(...lights);
      room.dispose();
      for (const light of lights) light.dispose();
      scene.background = null;
      scene.fog = null;
      scene.environment = null;
    };
  }, [gl, scene, invalidate]);

  return null;
}
