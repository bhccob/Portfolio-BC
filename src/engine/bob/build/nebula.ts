/**
 * The nebula round the way (spec 2026-10-27-bob-nebula-space-design.md, goals 1 and 2; the first mock-up's, branch
 * nebula-mock, made 3D): what the light falls through and the camera flies through, from the fall on.
 *
 * - **The clouds** are the gas now (./volume.ts, spec 2026-10-28-bob-quantum-stack-design.md, goal 9), marched in 3D
 *   and laid over all of this at the far plane, so its dark lanes hide the stars behind them.
 * - **The far shell**: the mock-up's cloud shell, kept faint behind it all.
 * - **Stars** in two depths and **dust** along the shell's filaments, as in the mock-up.
 * - **The far bands**: a few engraved gold orbit bands far behind (the engraved way's engraving), turning slowly with
 *   the place on the scroll, not with the clock, so the canvas still sleeps at rest; each fades out as the camera comes
 *   into its plane, where it would be a thin line across the picture.
 *
 * Everything is drawn additively over the dark and writes no depth (the beads' own depth hides what is behind them).
 */
import * as THREE from 'three';
import { engravedMaterial, engravingTexture, ringGeometry } from '~/engine/bob/build/engraved';
import type { QualityTier } from '~/engine/quality';
import type { NebulaLevels } from '~/scene/bob/nebulaWay';

type Vec3 = readonly [number, number, number];

/**
 * How the nebula looks (my calls, tuned by the proof harness's luminance gate and against the first mock-up's stills):
 * the far shell's size, two colours and level, the stars' and the dust's counts by tier and their level, and the
 * bands' count by tier and level.
 */
export const NEBULA_LOOK = {
  shell: { radius: 62, scale: 1.6, level: 0.12, deep: 0x3c1b72, wisp: 0xa874f2 },
  stars: { far: { high: 2600, medium: 1400, low: 700 }, near: { high: 700, medium: 350, low: 180 }, level: 1 },
  dust: { far: { high: 14000, medium: 7000, low: 2500 }, near: { high: 4500, medium: 2200, low: 800 }, level: 0.8 },
  bands: { count: { high: 4, medium: 2, low: 1 }, level: 0.5 }
} as const;

/** The lattice the clouds' noise reads: LATTICE × LATTICE values, seeded, wrapping round. */
const LATTICE = 64;

/** The noise lattices made so far, one a seed. */
const lattices = new Map<number, Float32Array>();

/** The lattice of `seed`, made once. */
function lattice(seed: number): Float32Array {
  let made = lattices.get(seed);
  if (!made) {
    const random = seeded(seed * 7919 + 17);
    made = new Float32Array(LATTICE * LATTICE);
    for (let i = 0; i < made.length; i++) made[i] = random();
    lattices.set(seed, made);
  }
  return made;
}

/** Value noise on the plane from a seeded lattice, wrapping every LATTICE units, for the clouds' textures. */
function noise2(x: number, y: number, values: Float32Array): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x0 = xi & (LATTICE - 1);
  const y0 = (yi & (LATTICE - 1)) * LATTICE;
  const x1 = (xi + 1) & (LATTICE - 1);
  const y1 = ((yi + 1) & (LATTICE - 1)) * LATTICE;
  const a = values[y0 + x0]! + (values[y0 + x1]! - values[y0 + x0]!) * u;
  const b = values[y1 + x0]! + (values[y1 + x1]! - values[y1 + x0]!) * u;
  return a + (b - a) * v;
}

/** Four octaves of `noise2`, from the lattice of `seed`. */
function fbm2(x: number, y: number, seed: number): number {
  const values = lattice(seed);
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < 4; i++) {
    s += a * noise2(x, y, values);
    x = x * 2.03 + 0.17;
    y = y * 2.03 + 0.17;
    a *= 0.5;
  }
  return s;
}

// ---------------------------------------------------------------- the far shell, the stars and the dust

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform float uLevel;
  uniform float uScale;
  uniform vec3 uDeep;
  uniform vec3 uWisp;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
      s += a * noise(p);
      p = p * 2.03 + 0.17;
      a *= 0.5;
    }
    return s;
  }
  void main() {
    vec3 p = normalize(vDir) * uScale + 3.1;
    float n = fbm(p);
    float m = fbm(p * 2.2 + vec3(7.3, 1.1, 4.7) + n * 1.5);
    float cloud = smoothstep(0.42, 0.86, n);
    float fil = pow(1.0 - abs(2.0 * fbm(p * 4.6 + m * 2.2) - 1.0), 5.0) * cloud;
    gl_FragColor = vec4((uDeep * cloud * (0.4 + 0.6 * m) + uWisp * fil * 0.9) * uLevel, 1.0);
  }
`;

function shellMesh(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const look = NEBULA_LOOK;
  const material = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    uniforms: { uLevel: { value: 0 }, uScale: { value: look.shell.scale }, uDeep: { value: new THREE.Color(look.shell.deep) }, uWisp: { value: new THREE.Color(look.shell.wisp) } },
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(look.shell.radius, 64, 32), material);
  mesh.name = 'nebula:shell';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** A seeded generator (mulberry32), so the stars, the dust and the bands are the same every load. */
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

const POINT_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColour;
  varying vec3 vColour;
  void main() {
    vColour = aColour;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  uniform float uLevel;
  varying vec3 vColour;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vColour * exp(-dot(c, c) * 18.0) * uLevel, 1.0);
  }
`;

/** Points from their places, sizes and colours, drawn as soft dots. */
function points(name: string, pos: number[], size: number[], colour: number[]): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geometry.setAttribute('aColour', new THREE.Float32BufferAttribute(colour, 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    uniforms: { uLevel: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const p = new THREE.Points(geometry, material);
  p.name = name;
  p.frustumCulled = false;
  // Under the gas's layer (renderOrder -5): its dark lanes hide them.
  p.renderOrder = -10;
  return p;
}

/** A direction on the sphere from two draws. */
function direction(random: () => number): [number, number, number] {
  const u = random() * 2 - 1;
  const th = random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [Math.cos(th) * s, u, Math.sin(th) * s];
}

/** `count` stars between `rMin` and `rMax` round the middle: small and soft, a few bigger, gold, violet or white. */
function stars(name: string, count: number, rMin: number, rMax: number, seed: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const random = seeded(seed);
  const pos: number[] = [];
  const size: number[] = [];
  const colour: number[] = [];
  const tints = [new THREE.Color(0xffbf6f), new THREE.Color(0xb9a2ff), new THREE.Color(0xfff4e6)];
  for (let i = 0; i < count; i++) {
    const d = direction(random);
    const r = rMin + (rMax - rMin) * Math.sqrt(random());
    pos.push(d[0] * r, d[1] * r, d[2] * r);
    const big = random() < 0.08;
    size.push(big ? 0.9 + random() * 0.8 : 0.25 + random() * 0.4);
    const c = tints[random() < 0.35 ? 0 : random() < 0.5 ? 1 : 2]!;
    const k = (big ? 0.9 : 0.45) * (0.5 + random() * 0.5);
    colour.push(c.r * k, c.g * k, c.b * k);
  }
  return points(name, pos, size, colour);
}

/** Fine dust gathered where the far shell's clouds are, between `rMin` and `rMax`: tiny soft points, violet, a little gold. */
function dust(name: string, count: number, rMin: number, rMax: number, seed: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const random = seeded(seed);
  const pos: number[] = [];
  const size: number[] = [];
  const colour: number[] = [];
  const tints = [new THREE.Color(0xb486ff), new THREE.Color(0xd08cff), new THREE.Color(0x8f6bff), new THREE.Color(0xffbf6f), new THREE.Color(0xfff4e6)];
  for (let tries = 0; pos.length / 3 < count && tries < count * 12; tries++) {
    const d = direction(random);
    // Its density: patches of the plane's noise round the sphere, read off the direction.
    const lon = Math.atan2(d[2], d[0]);
    const n = fbm2(lon * 1.6 + 3.1, d[1] * 2.4 + 3.1, 5);
    const m = fbm2(lon * 4.6 + n * 2.2, d[1] * 6.8 + n * 2.2, 6);
    const density = Math.min(1, Math.max(0, (n - 0.38) / 0.36)) * (1 - Math.abs(2 * m - 1)) ** 2;
    if (random() > density) continue;
    const r = rMin + (rMax - rMin) * random();
    pos.push(d[0] * r, d[1] * r, d[2] * r);
    size.push(0.18 + random() * 0.3);
    const pick = random();
    const c = tints[pick < 0.08 ? 3 : pick < 0.12 ? 4 : pick < 0.45 ? 0 : pick < 0.75 ? 1 : 2]!;
    const k = 0.4 + random() * 0.6;
    colour.push(c.r * k, c.g * k, c.b * k);
  }
  return points(name, pos, size, colour);
}

// ---------------------------------------------------------------- the nebula

/** How square on a band must be seen to show (|its axis · the way to it|): none below the first, whole past the second. */
const EDGE_ON = [0.25, 0.5] as const;

export interface NebulaModel {
  group: THREE.Group;
  /**
   * Each part's level (../../../scene/bob/nebulaWay.ts `nebulaLevels`), the place on the scroll, which turns the bands,
   * and the camera's place (`eye`, world), from which a band seen edge on fades out; without it none fades.
   */
  update(levels: NebulaLevels, place: number, eye?: Vec3): void;
  dispose(): void;
}

/**
 * The nebula round `middle` (the world's centre) at the ladder's `tier`,
 * hidden until a level is above 0. `canvas` makes the canvases its textures are drawn on.
 *
 * @throws TypeError when a canvas gives no 2D context.
 */
export function buildNebula(
  middle: readonly [number, number, number],
  tier: QualityTier,
  canvas: () => HTMLCanvasElement = () => document.createElement('canvas')
): NebulaModel {
  const look = NEBULA_LOOK;
  const group = new THREE.Group();
  group.name = 'nebula';
  group.visible = false;

  // Round the world's middle: the far shell, the stars, the dust and the bands.
  const around = new THREE.Group();
  around.position.set(...middle);
  group.add(around);
  const shell = shellMesh();
  const starsFar = stars('nebula:stars:far', look.stars.far[tier], 44, 58, 5);
  const starsNear = stars('nebula:stars:near', look.stars.near[tier], 18, 34, 9);
  const dustFar = dust('nebula:dust:far', look.dust.far[tier], 46, 58, 31);
  const dustNear = dust('nebula:dust:near', look.dust.near[tier], 24, 36, 37);
  around.add(shell, starsFar, starsNear, dustFar, dustNear);

  const map = engravingTexture(canvas());
  const random = seeded(23);
  const bands: { pivot: THREE.Object3D; ring: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; turn: number; speed: number }[] = [];
  for (let k = 0; k < look.bands.count[tier]; k++) {
    const r = 12 + k * 5.5 + random() * 3;
    const pivot = new THREE.Object3D();
    pivot.rotation.set((random() < 0.5 ? -1 : 1) * (0.45 + random() * 0.5), random() * Math.PI, (random() - 0.5) * 0.8);
    pivot.position.set((random() - 0.5) * 8, (random() - 0.5) * 6, (random() - 0.5) * 8);
    const material = engravedMaterial(map, { base: 0.95, glow: 0, reach: 1 }, [0, 0, 0]);
    material.uniforms.uFog!.value.set(30, 70);
    const ring = new THREE.Mesh(ringGeometry(r, 1.1 + k * 0.15, Math.round((2 * Math.PI * r) / 5.5)), material);
    ring.name = `nebula:band:${k}`;
    ring.frustumCulled = false;
    pivot.add(ring);
    around.add(pivot);
    bands.push({ pivot, ring, turn: pivot.rotation.y, speed: (random() < 0.5 ? -1 : 1) * (0.012 + random() * 0.01) });
  }

  const pointsParts = [starsFar, starsNear, dustFar, dustNear];
  const centre = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  /** How square on the camera at `eye` sees `ring`: 1 along its axis and well off its plane, 0 in its plane. */
  const facing = (ring: THREE.Object3D, eye: Vec3): number => {
    ring.getWorldPosition(centre);
    normal.set(0, 1, 0).applyQuaternion(ring.getWorldQuaternion(turn));
    centre.set(centre.x - eye[0], centre.y - eye[1], centre.z - eye[2]);
    const d = centre.length();
    const k = d > 1e-9 ? Math.abs(normal.dot(centre)) / d : 1;
    const t = Math.min(1, Math.max(0, (k - EDGE_ON[0]) / (EDGE_ON[1] - EDGE_ON[0])));
    return t * t * (3 - 2 * t);
  };
  return {
    group,
    update({ clouds: c, bands: b }, place, eye) {
      const cl = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;
      const bl = Number.isFinite(b) ? Math.max(0, Math.min(1, b)) : 0;
      group.visible = cl > 0 || bl > 0;
      shell.material.uniforms.uLevel!.value = cl * look.shell.level;
      starsFar.material.uniforms.uLevel!.value = cl * look.stars.level;
      starsNear.material.uniforms.uLevel!.value = cl * look.stars.level;
      dustFar.material.uniforms.uLevel!.value = cl * look.dust.level;
      dustNear.material.uniforms.uLevel!.value = cl * look.dust.level;
      const at = Number.isFinite(place) ? place : 0;
      for (const band of bands) band.pivot.rotation.y = band.turn + band.speed * at * 10;
      if (eye !== undefined && bl > 0) group.updateMatrixWorld(true);
      for (const band of bands) band.ring.material.uniforms.uLevel!.value = bl * look.bands.level * (eye === undefined || bl <= 0 ? 1 : facing(band.ring, eye));
    },
    dispose() {
      shell.geometry.dispose();
      shell.material.dispose();
      for (const p of pointsParts) {
        p.geometry.dispose();
        p.material.dispose();
      }
      for (const band of bands) {
        band.ring.geometry.dispose();
        band.ring.material.dispose();
      }
      map.dispose();
    }
  };
}
