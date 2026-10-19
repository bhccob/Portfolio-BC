import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildBackdrop, type Backdrop } from './Backdrop';
import { buildDust, type Dust } from './Dust';
import { buildHaze, type Haze } from './Haze';

/**
 * The compass's studio and its light: the renderer's tone mapping, a dark
 * room's soft-boxes for the reflections, a warm key and a purple rim, fog,
 * the backdrop glowing behind the dial, the haze and the dust. (The pearl, the
 * third light, is the scene's: it moves.) Everything is in the scene from the
 * start, so nothing here recompiles a program later.
 *
 * These are starting values: Task 6 tunes them against the approved hero
 * frame (refs/compass-hero.png) and records the final numbers here.
 */
export const COMPASS_STUDIO = {
  background: 0x07040d,
  exposure: 1,
  fog: { color: 0x160c26, density: 0.03 },
  /** RoomEnvironment through PMREM: its walls darkened, its soft-boxes kept, its furniture out; `blur` is PMREM's sigma. */
  room: { walls: 0x100b16, blur: 0.04, intensity: 0.8 },
  /** The warm key from the upper left, in front; the purple rim from behind and below. Both aim at the face centre. */
  key: { color: 0xffe2b8, intensity: 2.2, position: [-3, 4, 5] as const },
  rim: { color: 0x8a5cff, intensity: 1.6, position: [2, -1, -4] as const },
  /** The backdrop's glow, behind the dial and a little low. */
  backdrop: [0, -0.15, -1] as const,
  /** The box the dust fills, round the dial and in front of it. */
  dust: { min: [-4, -3, -4] as const, max: [4, 3, 2] as const }
} as const;

export interface CompassStudio {
  dust: Dust;
  /** Moves the dust and the haze on to `seconds`. */
  setTime(seconds: number): void;
  /** Prefilters the room again: after a lost context, whose copy lived only on the GPU. */
  relight(): void;
  dispose(): void;
}

/** RoomEnvironment with its walls darkened and its furniture out (it would show as hard shapes in the brass); its soft-boxes stay. */
function darkRoom(): RoomEnvironment {
  const room = new RoomEnvironment();
  room.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh) object.visible = false;
    const material = (object as THREE.Mesh).material;
    if (material instanceof THREE.MeshStandardMaterial && material.side === THREE.BackSide) material.color.set(COMPASS_STUDIO.room.walls);
  });
  return room;
}

/** Sets up `renderer` and `scene` for the compass and fills the studio, with room for `dust` motes at most. */
export function buildCompassStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene, dust: number): CompassStudio {
  const look = COMPASS_STUDIO;
  renderer.setClearColor(look.background, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.shadowMap.enabled = false;
  scene.background = new THREE.Color(look.background);
  scene.fog = new THREE.FogExp2(look.fog.color, look.fog.density);
  scene.environmentIntensity = look.room.intensity;

  let environment: THREE.WebGLRenderTarget | null = null;
  const relight = (): void => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = darkRoom();
    environment?.dispose();
    environment = pmrem.fromScene(room, look.room.blur);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
  };
  relight();

  const lights = (['key', 'rim'] as const).map((name) => {
    const { color, intensity, position } = look[name];
    const light = new THREE.DirectionalLight(color, intensity);
    light.name = name;
    light.position.set(position[0], position[1], position[2]);
    return light;
  });
  const backdrop: Backdrop = buildBackdrop({ direction: look.backdrop });
  const motes = buildDust({ max: dust, volume: look.dust });
  const haze: Haze = buildHaze();
  scene.add(...lights, backdrop.mesh, motes.points, haze.group);

  return {
    dust: motes,
    setTime(seconds) {
      motes.setTime(seconds);
      haze.setTime(seconds);
    },
    relight,
    dispose() {
      for (const part of [backdrop, motes, haze]) part.dispose();
      environment?.dispose();
      for (const light of lights) light.dispose();
    }
  };
}
