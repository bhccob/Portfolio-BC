import * as THREE from 'three';
import { random } from './noise';

/**
 * Dust in the air: motes drifting slowly down and sideways. In a beam (the
 * hub), they are lit gold where they pass through it and barely there outside
 * it; most are placed in the beam's cone, the rest around the stage. In a
 * volume (the compass), they are spread evenly through a box and lit alike.
 * One buffer of the most motes any quality step draws; a step draws the first
 * `count` of them. Additive, and sized by distance, so near motes are larger
 * and softer.
 */

export type Vec3 = readonly [number, number, number];

/** A box the motes fill, drifting down from its top to its bottom and starting again at the top. */
export interface DustVolume {
  min: Vec3;
  max: Vec3;
}

interface DustBeam {
  /** The beam's source, its radius there, and its radius at the floor. */
  apex: Vec3;
  top: number;
  radius: number;
  /** The floor's height: motes drift down to it and start again at the top. */
  floor: number;
  volume?: undefined;
}

interface DustBox {
  /** Spread evenly through this box and lit alike, in place of a beam. */
  volume: DustVolume;
}

/** Motes in a beam, or in a volume; either way at most `max` of them. */
export type DustOptions = (DustBeam | DustBox) & {
  /** The most motes ever drawn. */
  max: number;
};

export interface Dust {
  points: THREE.Points;
  /** Draws the first `count` motes. */
  setCount(count: number): void;
  setTime(seconds: number): void;
  /** Half the drawing buffer's height in device pixels: a mote's size in pixels is its world size times this over its depth. */
  setScale(halfHeight: number): void;
  dispose(): void;
}

export const DUST = {
  color: 0xffd877,
  /** Share of the motes placed inside the beam. */
  inBeam: 0.72,
  /** The height band they drift in, above the floor. */
  ceiling: 6.5,
  intensity: 1.8,
  /** How far a mote sways either way of where it was placed. */
  sway: 0.16
} as const;

const vertexShader = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uTime;
uniform float uScale;
uniform float uFloor;
uniform float uSpan;
uniform vec3 uApex;
uniform float uTop;
uniform float uRadius;
varying float vLight;
void main() {
  vec3 p = position;
  float t = uTime;
  p.y = uFloor + mod(p.y - uFloor - t * (0.015 + 0.045 * aSeed), uSpan);
  p.x += sin(t * (0.11 + 0.17 * aSeed) + aSeed * 40.0) * ${DUST.sway.toFixed(2)};
  p.z += cos(t * (0.09 + 0.13 * aSeed) + aSeed * 23.0) * ${DUST.sway.toFixed(2)};
#ifdef DUST_VOLUME
  float lit = 1.0;
#else
  float down = clamp((uApex.y - p.y) / (uApex.y - uFloor), 0.0, 1.0);
  float cone = mix(uTop, uRadius, down);
  float inside = 1.0 - smoothstep(cone * 0.6, cone * 1.05, length(p.xz - uApex.xz));
  float lit = mix(0.05, 1.0, inside) * mix(1.0, 0.55, down);
#endif
  float twinkle = 0.6 + 0.4 * sin(t * (0.7 + 1.3 * aSeed) + aSeed * 90.0);
  float ends = smoothstep(0.0, 0.5, p.y - uFloor) * (1.0 - smoothstep(uSpan - 0.8, uSpan, p.y - uFloor));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = aSize * uScale / max(0.1, -mv.z);
  // Under a pixel, a mote is drawn at one pixel and dimmed by the area it lacks.
  vLight = lit * twinkle * ends * min(1.0, size * size);
  gl_PointSize = clamp(size, 1.0, 10.0);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vLight;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float disc = 1.0 - smoothstep(0.15, 1.0, d);
  gl_FragColor = vec4(uColor * (uIntensity * vLight * disc * disc), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Where the motes drift: the band's bottom and height, a point the beam's uniforms take, and a sphere holding every mote. */
interface Field {
  floor: number;
  span: number;
  apex: Vec3;
  top: number;
  radius: number;
  bounds: THREE.Sphere;
  place(next: () => number, y: number): [number, number];
}

function beamField(options: DustBeam): Field {
  const [ax, ay, az] = options.apex;
  const span = DUST.ceiling - options.floor;
  return {
    floor: options.floor,
    span,
    apex: options.apex,
    top: options.top,
    radius: options.radius,
    // The motes drift up to the sway either way of where they were placed, and over the whole height band.
    bounds: new THREE.Sphere(new THREE.Vector3(ax, options.floor + span / 2, az), Math.hypot(6, span / 2)),
    place(next, y) {
      if (next() < DUST.inBeam) {
        const down = Math.min(1, Math.max(0, (ay - y) / (ay - options.floor)));
        const cone = options.top + (options.radius - options.top) * down;
        const r = Math.sqrt(next()) * cone;
        const angle = next() * Math.PI * 2;
        return [ax + Math.cos(angle) * r, az + Math.sin(angle) * r];
      }
      return [ax + (next() - 0.5) * 9, az + (next() - 0.6) * 7];
    }
  };
}

function volumeField({ min, max }: DustVolume): Field {
  const centre = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const half = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  return {
    floor: min[1],
    span: max[1] - min[1],
    // Unread in a volume (DUST_VOLUME); kept finite.
    apex: [centre.x, max[1], centre.z],
    top: 0,
    radius: 0,
    bounds: new THREE.Sphere(centre, half + DUST.sway),
    place: (next) => [min[0] + next() * (max[0] - min[0]), min[2] + next() * (max[2] - min[2])]
  };
}

export function buildDust(options: DustOptions): Dust {
  const next = random(1337);
  const field = options.volume ? volumeField(options.volume) : beamField(options);
  const positions = new Float32Array(options.max * 3);
  const seeds = new Float32Array(options.max);
  const sizes = new Float32Array(options.max);
  for (let i = 0; i < options.max; i++) {
    const y = field.floor + next() * field.span;
    const [x, z] = field.place(next, y);
    positions.set([x, y, z], i * 3);
    seeds[i] = next();
    // Mostly fine motes, a few large, near ones that read as soft flecks.
    const s = next();
    sizes[i] = 0.014 + 0.026 * s * s + (s > 0.96 ? 0.05 : 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.boundingSphere = field.bounds;
  const material = new THREE.ShaderMaterial({
    name: 'studio:dust',
    defines: options.volume ? { DUST_VOLUME: '' } : {},
    uniforms: {
      uColor: { value: new THREE.Color(DUST.color) },
      uIntensity: { value: DUST.intensity },
      uTime: { value: 0 },
      uScale: { value: 400 },
      uFloor: { value: field.floor },
      uSpan: { value: field.span },
      uApex: { value: new THREE.Vector3(...field.apex) },
      uTop: { value: field.top },
      uRadius: { value: field.radius }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'studio:dust';
  points.renderOrder = 6;
  points.raycast = () => {};
  geometry.setDrawRange(0, options.max);
  return {
    points,
    setCount: (count) => geometry.setDrawRange(0, Math.max(0, Math.min(options.max, Math.floor(count)))),
    setTime: (seconds) => (material.uniforms.uTime.value = seconds),
    setScale: (halfHeight) => (material.uniforms.uScale.value = halfHeight),
    dispose: () => {
      geometry.dispose();
      material.dispose();
    }
  };
}
