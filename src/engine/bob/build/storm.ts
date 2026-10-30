/**
 * The storm behind everything, built in code (spec 2026-10-30-bob-storm-design.md; Bob picked the storm nebula, painted
 * and animated): its plates (src/assets/storm), since round 8 (spec 2026-10-30-bob-moonlit-3d-design.md, Bob picked the
 * moonlit storm) rendered from real volume clouds in Blender (tools/blender/storm_plates.py): the storm wall, the sea of
 * storm, a bank of storm with its own alpha for the flats, and the lightning's glow inside the wall and the bank.
 *
 * - **The sky**: a sphere drawn at the far plane round the camera (a skybox: no translation, depth 1, no depth written),
 *   first of all, so it stands at infinity behind whatever the scene draws, the glass's mirror included: the wall above
 *   the horizon, the sea below; each plate stirred in place by the gas's noise (./volume.ts), panning very slowly, a
 *   second larger copy drifting over it for depth, the whole breathing slowly. Above the glass, what lies below the
 *   horizon is kept near black, so the glass's far edge draws no line against it.
 * - **The flats**: three flats curved round behind the compass (-z) and standing on the glass, far to near, each a part
 *   of the bank plate, the sky let through between its clouds by the plate's own alpha, each drifting at its own pace
 *   (./storm.ts's STORM.flats), so they shift against each other as the camera sways.
 * - **The flash**: the lightning's glow inside the clouds round the flash's way, from the flash plates, at the flash's
 *   strength times STORM.flash.gain; the sea has none.
 *
 * It reads no clock of its own: `pose` is given the storm's clock, its levels and its flash (src/scene/bob/storm.ts).
 */
import * as THREE from 'three';
import { STORM } from '~/scene/bob/storm';
import { noiseTexture } from './volume';

type Vec3 = readonly [number, number, number];

/** The sky's light at level 1 (the plates are dark paintings: lit up so the glass's mirror holds them). */
export const STORM_SKY = { light: 1.5 } as const;
/** The flats' arc round behind the compass, rad. */
const ARC = (200 * Math.PI) / 180;
/** How far below the glass's top the flats' feet stand, m. */
const FOOT = -0.3;

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = (projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0)).xyww;
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  precision highp sampler3D;
  uniform sampler2D uWall;
  uniform sampler2D uSea;
  uniform sampler2D uWallFlash;
  uniform sampler3D uNoise;
  uniform float uTime;
  uniform float uFlash;
  uniform float uFlashGain;
  uniform vec3 uFlashDir;
  uniform float uLevel;
  uniform float uAbove;
  uniform float uSeaLevel;
  varying vec3 vDir;
  const float PI = 3.14159265;

  // A plate's colour at (u, v), stirred by a slow noise so the clouds roll in place.
  vec3 plate(sampler2D map, vec2 uv, float seed) {
    vec3 n = texture(uNoise, vec3(uv * vec2(2.2, 1.1), uTime * 0.012 + seed)).gba - 0.5;
    return texture2D(map, uv + n.xy * 0.012).rgb;
  }

  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, -d.z);
    float el = asin(clamp(d.y, -1.0, 1.0));
    // The plates span some 220 degrees round the back, mirrored at their ends, panning very slowly.
    float u = 0.5 + az / (PI * 1.25) + uTime * 0.0012;
    u = abs(fract(u * 0.5) * 2.0 - 1.0);
    vec3 colour;
    float off = acos(clamp(dot(d, uFlashDir), -1.0, 1.0)) / 0.5;
    if (el >= 0.0) {
      // The wall: the middle of its storm on the horizon, mirrored past its ends up and down.
      float v = el / 0.8 + 0.4;
      vec3 near = plate(uWall, vec2(u, v), 0.0);
      vec3 far = plate(uWall, vec2(u * 0.8 + 0.1 + uTime * 0.0008, v * 0.85 + 0.08), 0.37);
      colour = max(near, far * 0.55) + far * 0.12;
      // A flash deep in the storm: the lightning's glow inside the clouds round its way.
      colour += texture2D(uWallFlash, vec2(u, v)).rgb * exp(-off * off) * uFlash * uFlashGain;
      // Above the glass the storm stands on a dark base at the horizon, so it rises out of the night, never from a line.
      colour *= mix(1.0, 0.15 + 0.85 * smoothstep(0.0, 0.1, el), uAbove);
    } else {
      // The sea below: the middle of its storm on the horizon, mirrored past its ends.
      float v = 0.6 + el / 0.8;
      vec3 near = plate(uSea, vec2(u, v), 0.61);
      vec3 far = plate(uSea, vec2(u * 0.85 + 0.07 - uTime * 0.0007, v * 0.9 + 0.05), 0.83);
      colour = max(near, far * 0.55) + far * 0.12;
      // Under the falling light, darker on its own; above the glass, below its far edge, near black.
      colour *= uSeaLevel;
      colour *= mix(1.0, smoothstep(-0.05, 0.0, el) * 0.15, uAbove);
    }
    // A slow breath in the whole storm.
    colour *= 0.9 + 0.1 * sin(uTime * 0.45);
    gl_FragColor = vec4(colour * uLevel, 1.0);
  }
`;

const FLAT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const FLAT_FRAGMENT = /* glsl */ `
  precision highp sampler3D;
  uniform sampler2D uBank;
  uniform sampler2D uBankFlash;
  uniform sampler3D uNoise;
  uniform float uTime;
  uniform float uFlash;
  uniform float uFlashGain;
  uniform float uFlashU;
  uniform float uLevel;
  uniform float uShift;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uFoot;
  varying vec2 vUv;
  void main() {
    vec2 uv = vec2(vUv.x * uScale + uShift + uTime * uSpeed, mix(uFoot, 0.97, vUv.y));
    vec3 n = texture(uNoise, vec3(uv * vec2(2.6, 1.3), uTime * 0.014 + uShift)).gba - 0.5;
    vec4 bank = texture2D(uBank, uv + n.xy * 0.01);
    vec3 c = bank.rgb;
    // The sky between the clouds is let through by the plate's own alpha; the flat's edges fade.
    float a = bank.a;
    a *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    // The lightning's glow inside the bank, round the flash's place along the arc.
    float off = (vUv.x - uFlashU) / 0.16;
    c += texture2D(uBankFlash, uv).rgb * exp(-off * off) * uFlash * uFlashGain;
    c *= 0.9 + 0.1 * sin(uTime * 0.45 + uShift * 9.0);
    gl_FragColor = vec4(c * uLevel * a, a);
  }
`;

/** What the storm is posed by, each frame. */
export interface StormPose {
  /** The storm's clock, s: it drifts, rolls and flashes on it, so it stands still while the clock does. */
  clock: number;
  /**
   * The sky's level, the flats' and the sea's below the horizon (src/scene/bob/storm.ts's `stormLevels`, the first two
   * times its fade in), 0..1.
   */
  sky: number;
  flats: number;
  sea: number;
  /** The flash: its strength, 0..1, and its way out from the camera (`stormFlash`). */
  flash: { strength: number; dir: Vec3 };
  /** The camera it is drawn for: above the glass or under it. */
  camera: THREE.Camera;
}

export interface StormModel {
  group: THREE.Group;
  pose(input: StormPose): void;
  dispose(): void;
}

/** The storm's plates, loaded by the caller (src/scene/bob/stormPlates.ts). */
export interface StormPlates {
  /** The sky above the horizon and the sea of storm below it, opaque. */
  wall: THREE.Texture;
  sea: THREE.Texture;
  /** One bank of storm with its own alpha, for the flats. */
  bank: THREE.Texture;
  /** The lightning's glow alone, inside the wall and inside the bank. */
  wallFlash: THREE.Texture;
  bankFlash: THREE.Texture;
}

/** The storm over its plates. */
export function buildStorm(plates: StormPlates): StormModel {
  const noise = noiseTexture();
  const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      uWall: { value: plates.wall },
      uSea: { value: plates.sea },
      uWallFlash: { value: plates.wallFlash },
      uNoise: { value: noise },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uFlashGain: { value: STORM.flash.gain },
      uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
      uLevel: { value: STORM_SKY.light },
      uAbove: { value: 1 },
      uSeaLevel: { value: 1 }
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), skyMaterial);
  sky.name = 'storm:sky';
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  const group = new THREE.Group();
  group.name = 'storm';
  group.add(sky);

  const flats = STORM.flats.map((flat, k) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: FLAT_VERTEX,
      fragmentShader: FLAT_FRAGMENT,
      uniforms: {
        uBank: { value: plates.bank },
        uBankFlash: { value: plates.bankFlash },
        uNoise: { value: noise },
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uFlashGain: { value: STORM.flash.gain },
        uFlashU: { value: 0.5 },
        uLevel: { value: flat.level },
        uShift: { value: flat.shift },
        uSpeed: { value: flat.speed },
        uScale: { value: flat.scale },
        uFoot: { value: flat.foot }
      },
      side: THREE.BackSide,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      fog: false
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(flat.radius, flat.radius, flat.height, 128, 1, true, Math.PI - ARC / 2, ARC), m);
    mesh.name = `storm:flat:${k}`;
    mesh.position.y = flat.height / 2 + FOOT;
    mesh.renderOrder = 1 + k;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });

  const u = skyMaterial.uniforms;
  return {
    group,
    pose({ clock, sky: skyLevel, flats: flatsLevel, sea, flash, camera }) {
      group.visible = skyLevel > 0 || flatsLevel > 0;
      u.uTime!.value = clock;
      u.uLevel!.value = STORM_SKY.light * skyLevel;
      u.uFlash!.value = flash.strength;
      (u.uFlashDir!.value as THREE.Vector3).set(...flash.dir);
      u.uAbove!.value = camera.position.y > 0 ? 1 : 0;
      u.uSeaLevel!.value = sea;
      sky.visible = skyLevel > 0;
      // Where the flash is along the flats' arc: straight behind is the middle.
      const flashU = 0.5 - Math.atan2(flash.dir[0], -flash.dir[2]) / ARC;
      STORM.flats.forEach((flat, k) => {
        const mesh = flats[k]!;
        const fu = (mesh.material as THREE.ShaderMaterial).uniforms;
        mesh.visible = flatsLevel > 0;
        fu.uLevel!.value = flat.level * flatsLevel;
        fu.uTime!.value = clock;
        fu.uFlash!.value = flash.strength;
        fu.uFlashU!.value = flashU;
      });
    },
    dispose() {
      for (const mesh of [sky, ...flats]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      for (const plate of Object.values(plates)) plate.dispose();
      noise.dispose();
    }
  };
}
