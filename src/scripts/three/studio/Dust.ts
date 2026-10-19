import * as THREE from 'three';
import { random } from './noise';

/**
 * Dust in the air: motes drifting slowly down and sideways, lit gold where
 * they pass through the beam and barely there outside it. Most are placed in
 * the beam's cone, the rest around the stage. One buffer of the most motes
 * any quality step draws; a step draws the first `count` of them. Additive,
 * and sized by distance, so near motes are larger and softer.
 */

export interface DustOptions {
  /** The beam's source, its radius there, and its radius at the floor. */
  apex: readonly [number, number, number];
  top: number;
  radius: number;
  /** The floor's height: motes drift down to it and start again at the top. */
  floor: number;
  /** The most motes ever drawn. */
  max: number;
}

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
  intensity: 1.8
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
  p.x += sin(t * (0.11 + 0.17 * aSeed) + aSeed * 40.0) * 0.16;
  p.z += cos(t * (0.09 + 0.13 * aSeed) + aSeed * 23.0) * 0.16;
  float down = clamp((uApex.y - p.y) / (uApex.y - uFloor), 0.0, 1.0);
  float cone = mix(uTop, uRadius, down);
  float inside = 1.0 - smoothstep(cone * 0.6, cone * 1.05, length(p.xz - uApex.xz));
  float twinkle = 0.6 + 0.4 * sin(t * (0.7 + 1.3 * aSeed) + aSeed * 90.0);
  float ends = smoothstep(0.0, 0.5, p.y - uFloor) * (1.0 - smoothstep(uSpan - 0.8, uSpan, p.y - uFloor));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = aSize * uScale / max(0.1, -mv.z);
  // Under a pixel, a mote is drawn at one pixel and dimmed by the area it lacks.
  vLight = mix(0.05, 1.0, inside) * mix(1.0, 0.55, down) * twinkle * ends * min(1.0, size * size);
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

export function buildDust(options: DustOptions): Dust {
  const next = random(1337);
  const [ax, ay, az] = options.apex;
  const span = DUST.ceiling - options.floor;
  const positions = new Float32Array(options.max * 3);
  const seeds = new Float32Array(options.max);
  const sizes = new Float32Array(options.max);
  for (let i = 0; i < options.max; i++) {
    const y = options.floor + next() * span;
    let x: number;
    let z: number;
    if (next() < DUST.inBeam) {
      const down = Math.min(1, Math.max(0, (ay - y) / (ay - options.floor)));
      const cone = options.top + (options.radius - options.top) * down;
      const r = Math.sqrt(next()) * cone;
      const angle = next() * Math.PI * 2;
      x = ax + Math.cos(angle) * r;
      z = az + Math.sin(angle) * r;
    } else {
      x = ax + (next() - 0.5) * 9;
      z = az + (next() - 0.6) * 7;
    }
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
  // The motes drift up to 0.16 either way of where they were placed, and over the whole height band.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(ax, options.floor + span / 2, az), Math.hypot(6, span / 2));
  const material = new THREE.ShaderMaterial({
    name: 'studio:dust',
    uniforms: {
      uColor: { value: new THREE.Color(DUST.color) },
      uIntensity: { value: DUST.intensity },
      uTime: { value: 0 },
      uScale: { value: 400 },
      uFloor: { value: options.floor },
      uSpan: { value: span },
      uApex: { value: new THREE.Vector3(ax, ay, az) },
      uTop: { value: options.top },
      uRadius: { value: options.radius }
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
