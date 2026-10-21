/**
 * The faint circuit traces over the glass as one three.js object: the 70
 * 45-degree walks and a small ring at each end, as line segments in dim gold.
 * Where they run is Task 6's layout (~/engine/bob/traces), so what the scene
 * draws is what the layout tests check. No React: the Opening (Task 10) mounts
 * the group and fades the lines in with `setLevel` as the loader opens.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import { TRACE, type TraceLayout } from '~/engine/bob/traces';

/**
 * How the traces look. `colour` is the palette's gold and `level` the share of
 * it they are drawn in at rest: dim, a hair of light on the black glass.
 * `lift` raises the lines off the glass so they never z-fight the floor. The
 * numbers are first values: a later task tunes them under the luminance gate.
 */
export const TRACES_LOOK = {
  colour: palette.gold,
  level: 0.09,
  lift: 0.0008
} as const;

/** The traces as the scene holds them. */
export interface TracesModel {
  /** `traces`: all the lines in one draw, `traces:lines`. */
  group: THREE.Group;
  /** Draws the lines in the gold times `level` (held to 0 or more; NaN reads as 0). */
  setLevel(level: number): void;
  /** Frees the buffer and the material. */
  dispose(): void;
}

/**
 * Builds the traces for `layout`, at `TRACES_LOOK.level`. Each trace is a
 * run of segments between its points, and each pad a ring of
 * `TRACE.pad.segments` segments round its centre; all of them go in one buffer
 * of `LineSegments`, the traces first and then the pads, so the whole circuit
 * is a single draw call.
 */
export function buildTraces(layout: TraceLayout): TracesModel {
  const { radius, segments } = TRACE.pad;
  const length = layout.traces.reduce((sum, trace) => sum + trace.length - 1, 0) + layout.pads.length * segments;
  const positions = new Float32Array(length * 2 * 3);
  let at = 0;
  const vertex = (x: number, z: number): void => {
    positions[at++] = x;
    positions[at++] = 0;
    positions[at++] = z;
  };
  for (const trace of layout.traces) {
    for (let i = 1; i < trace.length; i++) {
      vertex(trace[i - 1][0], trace[i - 1][1]);
      vertex(trace[i][0], trace[i][1]);
    }
  }
  for (const [x, z] of layout.pads) {
    for (let s = 0; s < segments; s++) {
      const a = (2 * Math.PI * s) / segments;
      const b = (2 * Math.PI * (s + 1)) / segments;
      vertex(x + radius * Math.cos(a), z + radius * Math.sin(a));
      vertex(x + radius * Math.cos(b), z + radius * Math.sin(b));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const gold = new THREE.Color(TRACES_LOOK.colour);
  const material = new THREE.LineBasicMaterial({ name: 'traces:lines', color: gold.clone().multiplyScalar(TRACES_LOOK.level) });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'traces:lines';
  lines.position.y = TRACES_LOOK.lift;

  const group = new THREE.Group();
  group.name = 'traces';
  group.add(lines);

  return {
    group,
    setLevel(level) {
      material.color.copy(gold).multiplyScalar(Number.isFinite(level) && level > 0 ? level : 0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
