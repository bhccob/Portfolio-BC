/**
 * What the look back draws besides the beads (spec 2026-10-27-bob-light-path-design.md, goal 7, 8A): the light's trail
 * of the whole way as one fine gold line, out of nothing at its start and brightest at its end, as the light path mock-up
 * Bob approved draws it (.superpowers/light-path-mockup/Mock.tsx); and the small lights of the projects off the way
 * (../../../scene/bob/offPath.ts). No React: the Void mounts them and sets their level from the path each frame.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';

type R3 = readonly [number, number, number];

/** The way line's tube: its segments along the way, its radius (m) and its sides, and its opacity at full level. */
export const WAY_LINE = { segments: 700, radius: 0.022, radial: 6, opacity: 0.85 } as const;

/** The off-the-way lights: their size (m, with distance) and opacity at full level. */
export const OFF_PATH_LIGHT = { size: 0.12, opacity: 0.9 } as const;

/** The way line, its level and its freeing. */
export interface WayLineModel {
  mesh: THREE.Mesh;
  /** Its level, 0..1 (the path's `way`): hidden at 0, else drawn at `WAY_LINE.opacity` times it. */
  setLevel(level: number): void;
  dispose(): void;
}

/**
 * The way through `points` (the path's `wayPoints`) as a tube along a Catmull-Rom curve through them (three's own),
 * its vertex colours the gold light ramped from nothing over its first 18 % and brightening on toward its end; added
 * to what is behind it, writing no depth and taking no fog, hidden until its level is set.
 */
export function buildWayLine(points: readonly R3[]): WayLineModel {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const { segments, radius, radial } = WAY_LINE;
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const colours = new Float32Array(geometry.attributes.position!.count * 3);
  const gold = new THREE.Color(palette.goldLight);
  for (let k = 0; k <= segments; k++) {
    // Out of nothing at its start (the fall above the first bead), brighter toward the last.
    const level = Math.min(1, k / (0.18 * segments)) * (0.3 + 0.7 * (k / segments) ** 1.3);
    for (let r = 0; r <= radial; r++) {
      const at = (k * (radial + 1) + r) * 3;
      colours[at] = gold.r * level;
      colours[at + 1] = gold.g * level;
      colours[at + 2] = gold.b * level;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'way-line';
  mesh.visible = false;
  return {
    mesh,
    setLevel(level) {
      const l = level > 0 ? Math.min(level, 1) : 0;
      mesh.visible = l > 0;
      material.opacity = WAY_LINE.opacity * l;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

/** The off-the-way lights, their level and their freeing. */
export interface OffPathLightsModel {
  points: THREE.Points;
  /** Their level, 0..1 (the way line's): hidden at 0 or with no lights, else drawn at `OFF_PATH_LIGHT.opacity` times it. */
  setLevel(level: number): void;
  dispose(): void;
}

/** A small gold light at each of `places` (offPathPlaces), added to what is behind them, hidden until their level is set. */
export function buildOffPathLights(places: readonly R3[]): OffPathLightsModel {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(places.flatMap((p) => [p[0], p[1], p[2]])), 3));
  const material = new THREE.PointsMaterial({
    color: palette.goldLight,
    size: OFF_PATH_LIGHT.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'off-path-lights';
  points.visible = false;
  return {
    points,
    setLevel(level) {
      const l = level > 0 ? Math.min(level, 1) : 0;
      points.visible = l > 0 && places.length > 0;
      material.opacity = OFF_PATH_LIGHT.opacity * l;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
