import * as THREE from 'three';
import { buildBackdrop, type Backdrop } from './Backdrop';
import { buildDust, type Dust } from './Dust';
import { buildHaze, type Haze } from './Haze';

/**
 * The compass's studio and its light: the renderer's tone mapping, a dark
 * room of light cards for the reflections, a white key and a purple rim, fog,
 * the backdrop glowing behind the dial, the haze and the dust. (The pearl, the
 * third light, is the scene's: it moves.) Everything is in the scene from the
 * start, so nothing here recompiles a program later.
 *
 * The values are tuned against the approved hero frame
 * (refs/compass-hero.png). Lit face-on, the lacquer and the gilt land close
 * to the loader's flat colours (plate #1c1030, face #140a24, gilt #d9a520),
 * which the loader crossfades from:
 *   - the key is white (a warm one turns the purple brown) and, with the
 *     room's own light, lights the face to about one, so a lacquer's colour
 *     renders as itself; the warmth is the soft-box's and the pearl's;
 *   - the tone mapping is PBR Neutral's shoulder (shoulder()), without the
 *     toe that would crush the dark lacquer's smallest channel to black;
 *   - the room is dark straight ahead of the face, where a face-on dial
 *     reflects it, and its cards sit where the tilted dial, the curved gilt
 *     and the rims catch them as crisp highlights.
 */
export const COMPASS_STUDIO = {
  background: 0x07040d,
  exposure: 1,
  fog: { color: 0x160c26, density: 0.03 },
  /**
   * The reflections' room, prefiltered through PMREM (`blur` is its sigma):
   * dark walls and a few light cards. A card faces the middle from its
   * bearing (`azimuth` degrees from straight ahead, +Z, toward +X, the right)
   * and `elevation` (degrees up), `width` × `height` degrees across, glowing
   * `radiance` times its colour.
   */
  room: {
    walls: 0x0b0713,
    blur: 0.02,
    intensity: 1,
    cards: [
      // A warm soft-box high and to the left: the key's own reflection in the curved gilt and the rim.
      { azimuth: -40, elevation: 42, width: 34, height: 22, color: 0xffd9a8, radiance: 2.4 },
      // A soft card a little low in front and to the left: the gloss on the tilted lacquer's upper left, gliding as it leans.
      { azimuth: -20, elevation: -14, width: 40, height: 10, color: 0xfff1e0, radiance: 0.8 },
      // A cool card to the right and a purple one behind: the edges' rim light.
      { azimuth: 78, elevation: 12, width: 14, height: 36, color: 0xb59cff, radiance: 1.2 },
      { azimuth: 180, elevation: 20, width: 50, height: 24, color: 0x6a3cff, radiance: 0.6 }
    ]
  },
  /**
   * The key from the upper left, in front; the purple rim from behind and
   * below. Both aim at the face centre. A punctual light gives a diffuse
   * surface its colour times intensity · cos / π: the key's 4.35 at cos 0.71
   * gives the face about 0.98 of it, which with the room and the fog lights a
   * face-on dial to one, so its paints render as themselves there (measured
   * face-on on the page at 1440 x 900, as the loader hands over: gilt #dca631
   * for #d9a520, plate #221633 for #1c1030, face #190d28 for #140a24).
   */
  key: { color: 0xffffff, intensity: 4.35, position: [-3, 4, 5] as const },
  rim: { color: 0x8a5cff, intensity: 1.6, position: [2, -1, -4] as const },
  /**
   * How much of the key, the rim and the room's light (the drive's own room in its metal too) is left with the drive
   * dimmed for the Q&A (the pose's `dim` at 1): low enough that the small drive is clearly secondary to the questions;
   * the tracks' and the sector's glow are their own and stay.
   */
  dim: 0.3,
  /** The backdrop's glow, behind the dial and a little low. */
  backdrop: [0, -0.15, -1] as const,
  /** The box the dust fills, round the dial and in front of it. */
  dust: { min: [-4, -3, -4] as const, max: [4, 3, 2] as const }
} as const;

export interface CompassStudio {
  dust: Dust;
  /** Moves the dust and the haze on to `seconds`. */
  setTime(seconds: number): void;
  /** Dims the key, the rim and the room's light: 0 full strength … 1 to COMPASS_STUDIO.dim of it (dimmed). */
  setDim(t: number): void;
  /** Prefilters the room again: after a lost context, whose copy lived only on the GPU. */
  relight(): void;
  dispose(): void;
}

/**
 * The renderer's CustomToneMapping: Khronos PBR Neutral (three's
 * NeutralToneMapping) without its toe. Below 0.8 a colour is drawn as it is,
 * so a lacquer lit to its own colour renders as that colour, deep purples
 * included; above, the highlights roll off and desaturate as Neutral's do.
 * Exported for the post chain's last effect (src/scene/ShoulderToneMapping),
 * which runs this very source on the composer's linear buffer.
 */
export const SHOULDER = /* glsl */ `vec3 CustomToneMapping( vec3 color ) {
	const float StartCompression = 0.8;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}`;

/** Puts SHOULDER in three's tone mapping chunk (once), for every program compiled after. */
export function shoulder(): void {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  const plain = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (chunk.includes(plain)) THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(plain, SHOULDER);
}

/** What the studio's light is multiplied by at dim `t` (0..1, held there; NaN reads as 0): 1 down to COMPASS_STUDIO.dim. */
export function dimmed(t: number): number {
  const x = Number.isNaN(t) ? 0 : Math.min(1, Math.max(0, t));
  if (x <= 0) return 1;
  if (x >= 1) return COMPASS_STUDIO.dim;
  return 1 + (COMPASS_STUDIO.dim - 1) * x;
}

/** The direction a card faces the middle from, unit length. */
function bearing(azimuth: number, elevation: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(azimuth);
  const e = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/** The reflections' room (COMPASS_STUDIO.room) as a scene for PMREM; dispose() frees it. */
function darkRoom(): { scene: THREE.Scene; dispose(): void } {
  const { walls, cards } = COMPASS_STUDIO.room;
  const scene = new THREE.Scene();
  const radius = 10;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(radius * 2, 32, 16), new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }));
  scene.add(shell);
  const plane = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.Material[] = [shell.material];
  for (const card of cards) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(card.color).multiplyScalar(card.radiance), side: THREE.DoubleSide });
    materials.push(material);
    const mesh = new THREE.Mesh(plane, material);
    mesh.position.copy(bearing(card.azimuth, card.elevation).multiplyScalar(radius));
    mesh.scale.set(2 * radius * Math.tan(THREE.MathUtils.degToRad(card.width / 2)), 2 * radius * Math.tan(THREE.MathUtils.degToRad(card.height / 2)), 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  return {
    scene,
    dispose() {
      shell.geometry.dispose();
      plane.dispose();
      for (const material of materials) material.dispose();
    }
  };
}

/** Sets up `renderer` and `scene` for the compass and fills the studio, with room for `dust` motes at most. */
export function buildCompassStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene, dust: number): CompassStudio {
  const look = COMPASS_STUDIO;
  shoulder();
  renderer.setClearColor(look.background, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.CustomToneMapping;
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
    environment = pmrem.fromScene(room.scene, look.room.blur);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
  };
  relight();

  const lit = (['key', 'rim'] as const).map((name): ['key' | 'rim', THREE.DirectionalLight] => {
    const { color, intensity, position } = look[name];
    const light = new THREE.DirectionalLight(color, intensity);
    light.name = name;
    light.position.set(position[0], position[1], position[2]);
    return [name, light];
  });
  const lights = lit.map(([, light]) => light);
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
    setDim(t) {
      // Intensities are uniforms: no program changes.
      const factor = dimmed(t);
      for (const [name, light] of lit) light.intensity = look[name].intensity * factor;
      scene.environmentIntensity = look.room.intensity * factor;
    },
    relight,
    dispose() {
      for (const part of [backdrop, motes, haze]) part.dispose();
      environment?.dispose();
      for (const light of lights) light.dispose();
    }
  };
}
