/**
 * The v3 sky as three.js objects: a dark violet nebula (spec §2.2) on a large
 * sphere seen from inside, a few faint fixed stars on it, all turning so
 * slowly that only a still taken minutes apart would show it. It is the
 * background of every v3 scene and must stay the darkest thing in them: the
 * constellations, not the sky, are where the stars are. Its clouds are the
 * studio's smoke (src/engine/studio/noise.ts), layered on the sphere by its
 * own shader, so nothing here needs a canvas. No React: Task 12a's Studio
 * mounts it.
 */
import * as THREE from 'three';
import { glowTexture, random, smokeTexture } from '~/engine/studio/noise';
import { palette } from '~/engine/palette';

/**
 * How the sky looks, in linear light.
 *
 * - `radius`: the sphere's, far beyond everything else, well inside the
 *   camera's far plane.
 * - `background`: the night between the clouds; the scene's clear colour
 *   must be the same (Task 12a's LOOK.background).
 * - `nebula`: the clouds, each a puff of the smoke texture laid on the sphere
 *   round `centre` (a direction; north is -Z, the home's camera looks that
 *   way), reaching `size` out from it along and across its own axes (in the
 *   plane touching the sphere there, where 1 is 45 degrees out), turned by
 *   `turn` radians and weighing `weight`. Two flank the
 *   view above the horizon, as in frame 05; one hangs faintly above the ship;
 *   one is behind the camera for the views that turn round. Where they are
 *   densest the night takes `peak` of the deep violet (at most 0.18, so the
 *   brightest cloud stays near-black).
 * - `stars`: `count` points spread evenly over the sphere (a handful in any
 *   view), cream at `brightness` (a luminance of at most about 0.18), `size`
 *   pixels across, from a fixed `seed`.
 * - `turn`: seconds a full turn takes: twenty minutes.
 */
export const SKY_LOOK = {
  radius: 30,
  background: palette.night,
  nebula: {
    colour: palette.nebula,
    peak: 0.18,
    layers: [
      { centre: [-0.55, 0.17, -0.82], size: [0.6, 0.26], turn: 0.3, weight: 0.9 },
      { centre: [0.58, 0.14, -0.8], size: [0.65, 0.24], turn: -0.35, weight: 0.85 },
      { centre: [-0.08, 0.32, -0.94], size: [0.5, 0.2], turn: 0.12, weight: 0.45 },
      { centre: [0.25, 0.2, 0.95], size: [0.8, 0.35], turn: 0.9, weight: 0.6 }
    ]
  },
  stars: { count: 64, colour: palette.cream, brightness: [0.05, 0.22], size: 2.5, seed: 2006 },
  turn: 1200
} as const;

/** The sky's draw order: first of all, as the farthest thing, and its stars right after it. */
const SKY_RENDER_ORDER = -10;

/** The sky as the scene holds it. */
export interface SkyModel {
  /** `sky`: the sphere, with its stars (`sky:stars`) as a child that turns with it. */
  mesh: THREE.Mesh;
  /** Turns the sky to where it is at `seconds` (NaN reads as 0): one turn every SKY_LOOK.turn seconds. */
  setTime(seconds: number): void;
  /** Frees the sphere, the stars, their materials and both textures. */
  dispose(): void;
}

const vertexShader = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Each cloud is the smoke texture laid on the plane touching the sphere at
 * its centre (a gnomonic projection, straight lines staying straight), turned
 * and stretched; outside the puff the texture's alpha is 0, so a cloud ends
 * where its puff does. The densities add up to at most 1, which is
 * `uNebula`, the violet times its peak, over the night. A little dither keeps
 * the dark gradient from banding.
 */
const fragmentShader = /* glsl */ `
uniform sampler2D uSmoke;
uniform vec3 uBackground;
uniform vec3 uNebula;
uniform vec3 uCentres[LAYERS];
uniform vec4 uShapes[LAYERS];
varying vec3 vDirection;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 d = normalize(vDirection);
  float density = 0.0;
  for (int i = 0; i < LAYERS; i++) {
    vec3 c = uCentres[i];
    float facing = dot(d, c);
    if (facing <= 0.0) continue;
    vec3 across = normalize(cross(vec3(0.0, 1.0, 0.0), c));
    vec3 up = cross(c, across);
    vec2 p = vec2(dot(d, across), dot(d, up)) / facing;
    float s = sin(uShapes[i].z);
    float k = cos(uShapes[i].z);
    p = mat2(k, s, -s, k) * p;
    density += uShapes[i].w * texture2D(uSmoke, 0.5 + 0.5 * p / uShapes[i].xy).a;
  }
  gl_FragColor = vec4(uBackground + uNebula * min(density, 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}`;

/** The faint fixed stars: `count` points evenly over a sphere just inside the sky's, each its own faint cream. */
function fixedStars(): { points: THREE.Points; dispose(): void } {
  const { count, colour, brightness, size, seed } = SKY_LOOK.stars;
  const next = random(seed);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const cream = new THREE.Color(colour);
  const radius = SKY_LOOK.radius * 0.97;
  for (let i = 0; i < count; i++) {
    // Even over the sphere: a uniform height and a uniform turn.
    const y = 2 * next() - 1;
    const angle = 2 * Math.PI * next();
    const ring = Math.sqrt(1 - y * y);
    positions.set([radius * ring * Math.cos(angle), radius * y, radius * ring * Math.sin(angle)], i * 3);
    // Mostly at the faint end, a few a little brighter.
    const b = brightness[0] + (brightness[1] - brightness[0]) * next() ** 2;
    colours.set([cream.r * b, cream.g * b, cream.b * b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const glow = glowTexture(16);
  const material = new THREE.PointsMaterial({
    name: 'sky:stars',
    size,
    sizeAttenuation: false,
    map: glow,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'sky:stars';
  points.renderOrder = SKY_RENDER_ORDER + 1;
  return {
    points,
    dispose() {
      geometry.dispose();
      material.dispose();
      glow.dispose();
    }
  };
}

/**
 * Builds the sky at time 0. It writes no depth and draws first, so whatever
 * the scene holds lies over it; it takes no fog (it is the farthest thing,
 * and fog would only flatten it to the fog's colour).
 */
export function buildSky(): SkyModel {
  const { nebula } = SKY_LOOK;
  const smoke = smokeTexture(128, 41);
  const geometry = new THREE.SphereGeometry(SKY_LOOK.radius, 48, 24);
  const material = new THREE.ShaderMaterial({
    name: 'sky',
    defines: { LAYERS: nebula.layers.length },
    uniforms: {
      uSmoke: { value: smoke },
      uBackground: { value: new THREE.Color(SKY_LOOK.background) },
      uNebula: { value: new THREE.Color(nebula.colour).multiplyScalar(nebula.peak) },
      uCentres: { value: nebula.layers.map(({ centre }) => new THREE.Vector3(...centre).normalize()) },
      uShapes: { value: nebula.layers.map(({ size, turn, weight }) => new THREE.Vector4(size[0], size[1], turn, weight)) }
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky';
  mesh.renderOrder = SKY_RENDER_ORDER;
  mesh.raycast = () => {};
  const stars = fixedStars();
  mesh.add(stars.points);

  return {
    mesh,
    setTime(seconds) {
      const t = Number.isFinite(seconds) ? seconds : 0;
      const into = ((t % SKY_LOOK.turn) + SKY_LOOK.turn) % SKY_LOOK.turn;
      mesh.rotation.y = (into / SKY_LOOK.turn) * 2 * Math.PI;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      smoke.dispose();
      stars.dispose();
    }
  };
}
