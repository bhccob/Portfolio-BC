/**
 * The stardust (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; the mock-up's `dustWorld`, Bob's mix:
 * "dissolve for the tower"): the closed tower as points of light over its own surface, which rise in arcs and drift out
 * and down into a wide field under where it stood, slowly turning round the core, a wave running out along it. One
 * `THREE.Points` and one shader: each point has its place on the tower, its place in the field and its own random
 * numbers, and the shader moves it between them from the way out's flight (src/scene/bob/wayOut.ts).
 */
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';
import type { WayOutView } from '~/scene/bob/wayOut';

type Vec3 = readonly [number, number, number];

/** The closed tower the points stand on: the stack's centre, each board's top closed (the power board first), its radii. */
export interface StardustSpec {
  centre: Vec3;
  tops: readonly number[];
  /** The power board's radius, m. */
  core: number;
  /** A category board's radius, m. */
  radius: number;
}

/** How the stardust shows this frame. */
export interface StardustPose {
  /** The points over the tower, 0..1. */
  show: number;
  /** Their flight out to the field, 0..1. */
  flight: number;
  /** The world's clock, s: the field's turn and wave, the twinkle. */
  clock: number;
  /** The screen's px per radian of view: a point's size at its distance. */
  scale: number;
}

export interface StardustModel {
  points: THREE.Points;
  pose(p: StardustPose): void;
  dispose(): void;
}

/** The points by the tier (the spec's). */
const COUNT: Readonly<Record<QualityTier, number>> = { high: 70_000, medium: 35_000, low: 18_000 };
/** A board's thickness, m (src/scene/bob/worldLayout.ts `STACK.thick`): the rim's points stand down to it. */
const THICK = 0.2;
/** The share of a board's points on its top (the rest on its rim). */
const ON_TOP = 0.6;
/** The field: how far under the tower's foot, how far out (m), how far round from a point's own angle, how thick. */
const FIELD = { below: 7, from: 9, span: 100, spread: (25 * Math.PI) / 180, thick: 0.5 } as const;
/** The share of the points that are gold; the gold and the violet. */
const GOLD = { share: 0.3, colour: [1, 0.66, 0.3], violet: [0.45, 0.32, 1] } as const;

/** The points the tier draws. */
export function stardustCount(tier: QualityTier): number {
  return COUNT[tier];
}

/** The mock-up's hash: a number 0..1 for `k` and `salt`. */
function hash(k: number, salt: number): number {
  const x = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * `count` points of the stardust, pure: each on the closed tower (a board at random, the power board with `core`: 60%
 * on its top, the rest on its rim down to its thickness), its place in the field (at its own angle give or take 25°,
 * 9 to 109 m out, more of them near the middle, 7 m under the foot), its random numbers, and its colour.
 */
export function sampleStardust(spec: StardustSpec, count: number): { tower: Float32Array; field: Float32Array; rand: Float32Array; colour: Float32Array } {
  const [cx, , cz] = spec.centre;
  const tops = spec.tops;
  const foot = tops[tops.length - 1]! - THICK;
  const tower = new Float32Array(count * 3);
  const field = new Float32Array(count * 3);
  const rand = new Float32Array(count * 4);
  const colour = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const b = Math.min(tops.length - 1, Math.floor(hash(i, 1) * tops.length));
    const R = b === 0 ? spec.core : spec.radius;
    const a = hash(i, 2) * Math.PI * 2;
    const onTop = hash(i, 3) < ON_TOP;
    const r = onTop ? R * Math.sqrt(hash(i, 4)) : R;
    const y = onTop ? tops[b]! : tops[b]! - THICK * hash(i, 4);
    tower.set([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], i * 3);
    const fa = a + (hash(i, 5) * 2 - 1) * FIELD.spread;
    const fr = FIELD.from + FIELD.span * Math.pow(hash(i, 6), 0.9);
    field.set([cx + Math.cos(fa) * fr, foot - FIELD.below + (hash(i, 7) - 0.5) * FIELD.thick, cz + Math.sin(fa) * fr], i * 3);
    rand.set([hash(i, 11), hash(i, 12), hash(i, 13), hash(i, 14)], i * 4);
    colour.set(hash(i, 15) < GOLD.share ? GOLD.colour : GOLD.violet, i * 3);
  }
  return { tower, field, rand, colour };
}

/**
 * How the stardust shows at the way out's stage `out` (null off it): nothing before its points come up (2.5 s into the
 * dissolve); then its points, whole once they fly; the world's clock, still with reduced motion; the screen's scale.
 */
export function stardustPose(out: WayOutView | null, clock: number, reduced: boolean, pxPerRad: number): StardustPose | null {
  if (out === null || (out.points <= 0 && out.flight <= 0)) return null;
  return { show: out.flight > 0 ? 1 : out.points, flight: out.flight, clock: reduced ? 0 : clock, scale: pxPerRad };
}

const VERTEX = /* glsl */ `
attribute vec3 aField;
attribute vec4 aRand;
attribute vec3 aCol;
uniform float uA;
uniform float uTime;
uniform float uShow;
uniform float uScale;
uniform vec3 uCentre;
varying vec3 vCol;
varying float vB;
varying float vA;
void main() {
  // Each point flies on its own share of the flight (staggered over 40% of it).
  float a = smoothstep(aRand.x * 0.4, aRand.x * 0.4 + 0.6, uA);
  vA = a;
  // The field turns slowly round the core, the inner faster, and a wave runs out along it.
  vec2 rel = aField.xz - uCentre.xz;
  float d = length(rel);
  float turn = uTime * 0.5 / (d + 12.0);
  vec3 field = aField;
  field.xz = uCentre.xz + vec2(cos(turn) * rel.x - sin(turn) * rel.y, sin(turn) * rel.x + cos(turn) * rel.y);
  field.y += sin(d * 0.09 - uTime * 0.6 + aRand.y * 1.5) * 0.9;
  // On its way, an arc: up 5 to 14 m and 4 m aside at its top.
  vec3 p = mix(position, field, a);
  float arc = sin(a * 3.14159);
  p.y += arc * (5.0 + 9.0 * aRand.z);
  p.xz += vec2(cos(aRand.w * 6.2832), sin(aRand.w * 6.2832)) * arc * 4.0;
  vCol = aCol;
  vB = uShow * mix(1.0, 0.5, a) * (0.75 + 0.25 * sin(uTime * 1.3 + aRand.z * 40.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uScale * (0.07 + 0.05 * aRand.z) * (1.0 + 0.6 * a) / -mv.z, 1.0, 6.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
varying vec3 vCol;
varying float vB;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float k = smoothstep(0.5, 0.05, r);
  gl_FragColor = vec4(vCol * vB * k * 0.2 * (1.0 + 3.0 * vA), 1.0);
}`;

/** The stardust for `spec` at the tier's count: hidden until posed. */
export function buildStardust(spec: StardustSpec, tier: QualityTier): StardustModel {
  const count = stardustCount(tier);
  const { tower, field, rand, colour } = sampleStardust(spec, count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(tower, 3));
  geometry.setAttribute('aField', new THREE.BufferAttribute(field, 3));
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
  geometry.setAttribute('aCol', new THREE.BufferAttribute(colour, 3));
  const foot = spec.tops[spec.tops.length - 1]! - THICK;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: 0 },
      uTime: { value: 0 },
      uShow: { value: 0 },
      uScale: { value: 600 },
      uCentre: { value: new THREE.Vector3(spec.centre[0], foot, spec.centre[2]) }
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'stardust';
  points.frustumCulled = false;
  points.visible = false;
  return {
    points,
    pose({ show, flight, clock, scale }) {
      material.uniforms.uShow!.value = show;
      material.uniforms.uA!.value = flight;
      material.uniforms.uTime!.value = clock;
      material.uniforms.uScale!.value = scale;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
