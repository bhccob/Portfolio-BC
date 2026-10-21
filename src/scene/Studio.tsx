import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { shoulder } from '~/engine/studio/CompassStudio';
import { buildRoom, type RoomModel } from '~/engine/v3/build/room';
import { buildSky, type SkyModel } from '~/engine/v3/build/sky';
import { LOOK } from './v3/look';

/** The longest step the sky's turn takes in one frame, seconds: a scene waking from sleep does not jump it. */
const MAX_STEP = 0.1;

/**
 * The v3 studio, the ground every v3 scene stands in, built from v3's parts and LOOK (src/scene/v3/look.ts):
 *   - the night as the clear colour and the background, and the fog in the dark violet haze;
 *   - the sky (src/engine/v3/build/sky.ts), the nebula on a sphere far beyond everything, turning slowly on the frames
 *     that are drawn, so it stands still while the scene sleeps;
 *   - the reflection room (src/engine/v3/build/room.ts), prefiltered through PMREM into `scene.environment`, which is
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
  const sky = useRef<SkyModel | null>(null);
  const time = useRef(0);

  // Before the first frame, so nothing is drawn without its light.
  useLayoutEffect(() => {
    shoulder();
    gl.setClearColor(LOOK.background, 1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.CustomToneMapping;
    gl.toneMappingExposure = LOOK.exposure;
    gl.shadowMap.enabled = false;
    scene.background = new THREE.Color(LOOK.background);
    scene.fog = new THREE.FogExp2(LOOK.fog.color, LOOK.fog.density);
    scene.environmentIntensity = LOOK.environment;

    const built = buildSky();
    sky.current = built;
    let room: RoomModel = buildRoom(gl);
    scene.environment = room.environment;

    const lights = (['key', 'rim'] as const).map((name) => {
      const { colour, intensity, position } = LOOK[name];
      const light = new THREE.DirectionalLight(colour, intensity);
      light.name = name;
      light.position.set(position[0], position[1], position[2]);
      return light;
    });
    scene.add(built.mesh, ...lights);

    const relight = (): void => {
      room.dispose();
      room = buildRoom(gl);
      scene.environment = room.environment;
      invalidate();
    };
    gl.domElement.addEventListener('webglcontextrestored', relight);
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', relight);
      sky.current = null;
      scene.remove(built.mesh, ...lights);
      built.dispose();
      room.dispose();
      for (const light of lights) light.dispose();
      scene.background = null;
      scene.fog = null;
      scene.environment = null;
    };
  }, [gl, scene, invalidate]);

  useFrame((_, delta) => {
    time.current += Math.min(Math.max(delta, 0), MAX_STEP);
    sky.current?.setTime(time.current);
  });

  return null;
}
