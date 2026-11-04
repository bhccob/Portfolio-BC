/**
 * The realistic stars Bob approved with the rings (2026-10-29: "more realistic like unique stars"; spec
 * 2026-10-29-bob-stack-2-design.md, goals 3 and 4; the mock-ups' stars, .superpowers/rings-mockup and fall-mockup): each
 * its own colour by its temperature, from blue-white to deep orange, the cooler and smaller ones most common; its own size,
 * brightness and twinkle; the brightest with a telescope's six-pointed spikes; a few in pairs, a smaller companion of
 * another colour close beside one; and up to a few in a faint shell of gas. One field round the stack (`starsRound`), one
 * along the fall (`starsFall`), kept far enough out that none crosses the light.
 *
 * No React: the Void builds them and poses them on the world's clock, so they stand still while the canvas sleeps and with
 * reduced motion. The low tier makes half the stars. The textures are made on the CPU, so the node tests build them.
 *
 * They draw in four draws, one a picture (./billboards.ts): the glows, the cores, the spikes and the shells. The twinkle
 * is in the shader, so posing them takes two numbers a frame however many there are.
 */
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';
import { BILLBOARD_FRAGMENT, billboardGeometry, billboardMesh } from './billboards';

type Vec3 = readonly [number, number, number];

/**
 * A field of stars: `count` of them (the pairs' companions among them) round `centre`, `inner` to `outer` m out from its
 * axis; on a shell round it (`height` null: up and down as much as 0.9 rad, the axis kept `clear` m clear), or round its
 * vertical line between the heights `height` (top, bottom). At most `pairs` companions and `shells` shells of gas.
 */
export interface StarField {
  count: number;
  centre: Vec3;
  inner: number;
  outer: number;
  height: readonly [number, number] | null;
  clear: number;
  pairs: number;
  shells: number;
  seed: number;
}

/** The stars round the stack (the rings mock-up's), round its axis through `centre`, their shell's middle at `middle` (world y). */
export function starsRound(centre: Vec3, middle: number): StarField {
  return { count: 44, centre: [centre[0], middle, centre[2]], inner: 26, outer: 112, height: null, clear: 22, pairs: 4, shells: 2, seed: 2026 };
}

/** The stars along the fall (the fall mock-up's): round the light's line `line` (x, z), from `top` down to `bottom`. */
export function starsFall(top: number, bottom: number, line: readonly [number, number]): StarField {
  return { count: 170, centre: [line[0], 0, line[1]], inner: 42, outer: 120, height: [top, bottom], clear: 0, pairs: 6, shells: 3, seed: 2026 };
}

/** The stars' colours by temperature and how common each is (the mock-ups'): blue-white to deep orange. */
const SPECTRA: readonly [number, number][] = [
  [0x9db4ff, 0.06],
  [0xaabfff, 0.1],
  [0xd5e0ff, 0.13],
  [0xf6f4ff, 0.15],
  [0xfff1dc, 0.17],
  [0xffdcae, 0.21],
  [0xffbd82, 0.18]
];

/** Brighter than this, a star has spikes. */
const SPIKED = 0.72;

/** What the stars are posed by, each frame. */
export interface StarsPose {
  /** Their light, 0..1: 0 hides them. */
  level: number;
  /** The world's clock, s: each twinkles at its own pace on it. */
  clock: number;
}

/** A star as it was placed. */
export interface Star {
  /** A companion of a pair. */
  pair: boolean;
  at: THREE.Vector3;
  size: number;
  /** Its core's colour. */
  tint: THREE.Color;
  /** Brighter than SPIKED: it has spikes. */
  spiked: boolean;
  shell: boolean;
}

export interface StarsModel {
  /** `stars`: one draw each of the glows, the cores, the spikes and the shells (`stars:glows` and so on). */
  group: THREE.Group;
  /** The stars placed, for the tests. */
  stars: readonly Star[];
  pose(p: StarsPose): void;
  dispose(): void;
}

/** A seeded generator, 0..1. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A white texture `size` across whose alpha at each pixel is `alpha(x, y)`, x and y -1..1 from the middle. */
function made(size: number, alpha: (x: number, y: number) => number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const a = Math.min(1, Math.max(0, alpha((i / (size - 1)) * 2 - 1, (j / (size - 1)) * 2 - 1)));
      data.set([255, 255, 255, Math.round(255 * a)], (j * size + i) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Linear between the stops [r, alpha], r ascending. */
function stops(r: number, at: readonly (readonly [number, number])[]): number {
  if (r <= at[0]![0]) return at[0]![1];
  for (let k = 1; k < at.length; k++) {
    const [r1, a1] = at[k]!;
    const [r0, a0] = at[k - 1]!;
    if (r <= r1) return a0 + ((a1 - a0) * (r - r0)) / (r1 - r0);
  }
  return at[at.length - 1]![1];
}

/** The core's light: white-hot in the middle, falling fast (the mock-ups' radial gradient). */
const coreTexture = (): THREE.DataTexture =>
  made(128, (x, y) =>
    stops(Math.hypot(x, y), [
      [0, 1],
      [0.035, 1],
      [0.09, 0.5],
      [0.22, 0.11],
      [0.5, 0.025],
      [1, 0]
    ])
  );

/** The telescope's spikes: three long thin lines through the middle at 90°, 30° and 150°, and a short one across. */
const spikeTexture = (): THREE.DataTexture => {
  const spikes = [
    { angle: Math.PI / 2, length: 0.98, width: 0.0086, alpha: 0.9 },
    { angle: Math.PI / 6, length: 0.98, width: 0.0086, alpha: 0.9 },
    { angle: (5 * Math.PI) / 6, length: 0.98, width: 0.0086, alpha: 0.9 },
    { angle: 0, length: 0.47, width: 0.0062, alpha: 0.55 }
  ];
  return made(256, (x, y) => {
    let a = 0;
    for (const s of spikes) {
      const along = x * Math.cos(s.angle) + y * Math.sin(s.angle);
      const across = -x * Math.sin(s.angle) + y * Math.cos(s.angle);
      if (Math.abs(across) > s.width || Math.abs(along) > s.length) continue;
      const u = Math.abs(along) / s.length;
      const fall = u < 0.16 ? 1 - u * (0.65 / 0.16) : 0.35 * (1 - (u - 0.16) / 0.84);
      a += s.alpha * fall;
    }
    return a;
  });
};

/** A soft round light. */
const glowTexture = (): THREE.DataTexture => made(64, (x, y) => Math.pow(Math.max(0, 1 - Math.hypot(x, y)), 2.4));

const ADDED = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } as const;

/**
 * Each star's own light and its place: as bright as `aStar.x` times the level and its twinkle at its own pace (`aStar.y`,
 * phase `aStar.z`), by each layer's `uGain` (held to `uCap`); a shell's light is even, the level alone (`uEven`), and
 * spikes breathe a little with the twinkle (`uBreathe`). The quad faces the camera, `aSize` metres across, as a sprite.
 */
const STAR_VERTEX = /* glsl */ `
  attribute vec3 aAt;
  attribute float aSize;
  attribute vec3 aTint;
  attribute vec3 aStar;
  uniform float uLevel;
  uniform float uClock;
  uniform float uGain;
  uniform float uCap;
  uniform float uEven;
  uniform float uBreathe;
  varying vec2 vUv;
  varying vec3 vColour;
  varying float vOpacity;
  void main() {
    float twinkle = 0.84 + 0.1 * sin(uClock * aStar.y + aStar.z) + 0.06 * sin(uClock * aStar.y * 2.7 + aStar.z * 1.3);
    float light = mix(aStar.x * twinkle, 1.0, uEven) * uLevel;
    vOpacity = min(uCap, light * uGain);
    vColour = aTint;
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(aAt, 1.0);
    mv.xy += position.xy * aSize * mix(1.0, 0.92 + 0.08 * twinkle, uBreathe);
    gl_Position = projectionMatrix * mv;
  }
`;

/** A quad of a layer: its place, its size, its colour and its star's own light. */
interface Quad {
  at: THREE.Vector3;
  size: number;
  tint: THREE.Color;
  base: number;
  rate: number;
  phase: number;
}

/** One layer of the field as one draw. */
function layer(name: string, quads: readonly Quad[], map: THREE.Texture, look: { gain: number; cap?: number; even?: boolean; breathe?: boolean }): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const geometry = billboardGeometry(quads.length);
  const at = new Float32Array(quads.length * 3);
  const size = new Float32Array(quads.length);
  const tint = new Float32Array(quads.length * 3);
  const star = new Float32Array(quads.length * 3);
  quads.forEach((q, k) => {
    q.at.toArray(at, k * 3);
    size[k] = q.size;
    q.tint.toArray(tint, k * 3);
    star.set([q.base, q.rate, q.phase], k * 3);
  });
  geometry.setAttribute('aAt', new THREE.InstancedBufferAttribute(at, 3));
  geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  geometry.setAttribute('aStar', new THREE.InstancedBufferAttribute(star, 3));
  const material = new THREE.ShaderMaterial({
    name,
    vertexShader: STAR_VERTEX,
    fragmentShader: BILLBOARD_FRAGMENT,
    uniforms: {
      uMap: { value: map },
      uLevel: { value: 0 },
      uClock: { value: 0 },
      uGain: { value: look.gain },
      uCap: { value: look.cap ?? 1e6 },
      uEven: { value: look.even ? 1 : 0 },
      uBreathe: { value: look.breathe ? 1 : 0 }
    },
    ...ADDED
  });
  return { mesh: billboardMesh(name, geometry, material), material };
}

/** Builds the field `field` for `tier`, dark. */
export function buildStars(field: StarField, tier: QualityTier): StarsModel {
  const group = new THREE.Group();
  group.name = 'stars';
  group.visible = false;
  const textures = { core: coreTexture(), spikes: spikeTexture(), glow: glowTexture() };
  const random = seeded(field.seed);
  const white = new THREE.Color(1, 1, 1);
  const haze = new THREE.Color(0x8a6cf2);
  const low = tier === 'low';
  const count = low ? Math.round(field.count / 2) : field.count;
  const pairsMost = low ? Math.floor(field.pairs / 2) : field.pairs;
  const shellsMost = low ? Math.floor(field.shells / 2) : field.shells;
  const spectrum = (): THREE.Color => {
    let u = random();
    for (const [colour, weight] of SPECTRA) if ((u -= weight) <= 0) return new THREE.Color(colour);
    return new THREE.Color(SPECTRA[SPECTRA.length - 1]![0]);
  };
  const stars: Star[] = [];
  const cores: Quad[] = [];
  const glows: Quad[] = [];
  const spikes: Quad[] = [];
  const gases: Quad[] = [];
  let pairs = 0;
  let shells = 0;
  const add = (at: THREE.Vector3, size: number, tint: THREE.Color, bright: number, shell: boolean, pair: boolean): void => {
    const spiked = bright > SPIKED;
    // The generator's draws in the order they always came, so this is the very field Bob approved.
    const rate = 0.6 + random() * 2.2;
    const phase = random() * 9;
    const own = { base: bright, rate, phase, at };
    const coreTint = tint.clone().lerp(white, 0.55);
    cores.push({ ...own, size, tint: coreTint });
    glows.push({ ...own, size: size * 2.6, tint: tint.clone() });
    if (spiked) spikes.push({ ...own, size: size * (3.2 + bright * 3), tint: tint.clone().lerp(white, 0.3) });
    if (shell) gases.push({ ...own, size: size * 11, tint: tint.clone().lerp(haze, 0.4) });
    stars.push({ pair, at, size, tint: coreTint, spiked, shell });
  };

  const [cx, cy, cz] = field.centre;
  while (stars.length < count) {
    const az = random() * Math.PI * 2;
    const r = field.inner + random() ** 0.7 * (field.outer - field.inner);
    let at: THREE.Vector3;
    if (field.height === null) {
      // On a shell round the stack, up and down a little less than round, the axis kept clear.
      const el = (random() * 2 - 1) * 0.9;
      at = new THREE.Vector3(cx + Math.sin(az) * Math.cos(el) * r, cy + Math.sin(el) * r * 0.7, cz + Math.cos(az) * Math.cos(el) * r);
      if (Math.hypot(at.x - cx, at.z - cz) < field.clear) continue;
    } else {
      const [top, bottom] = field.height;
      at = new THREE.Vector3(cx + Math.sin(az) * r, bottom + random() * (top - bottom), cz + Math.cos(az) * r);
    }
    // Most stars are faint; the reach of a star's light grows a little with distance, so far ones are not lost.
    const bright = random() ** 2.2;
    const size = (0.9 + bright * 3.4) * (0.7 + r / 90);
    const shell = shells < shellsMost && bright > 0.6 && random() < 0.5;
    if (shell) shells++;
    add(at, size, spectrum(), 0.35 + bright * 0.65, shell, false);
    if (stars.length < count && pairs < pairsMost && bright > 0.4 && random() < 0.35) {
      pairs++;
      const off = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(size * 0.7);
      add(at.clone().add(off), size * 0.55, spectrum(), 0.3 + bright * 0.4, false, true);
    }
  }

  const layers = [
    layer('stars:glows', glows, textures.glow, { gain: 0.2 }),
    layer('stars:cores', cores, textures.core, { gain: 1.15, cap: 1 }),
    ...(spikes.length > 0 ? [layer('stars:spikes', spikes, textures.spikes, { gain: 0.55, breathe: true })] : []),
    ...(gases.length > 0 ? [layer('stars:shells', gases, textures.glow, { gain: 0.05, even: true })] : [])
  ];
  for (const { mesh } of layers) group.add(mesh);

  return {
    group,
    stars,
    pose({ level, clock }) {
      const shown = Math.min(Math.max(level, 0), 1);
      group.visible = shown > 0.001;
      if (!group.visible) return;
      for (const { material } of layers) {
        material.uniforms.uLevel!.value = shown;
        material.uniforms.uClock!.value = clock;
      }
    },
    dispose() {
      for (const { mesh, material } of layers) {
        mesh.geometry.dispose();
        material.dispose();
      }
      textures.core.dispose();
      textures.spikes.dispose();
      textures.glow.dispose();
    }
  };
}
