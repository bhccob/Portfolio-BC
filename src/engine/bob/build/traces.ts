/**
 * The faint circuit traces under the glass as one three.js object: the 70
 * 45-degree walks and a small ring at each end, as line segments in dim gold.
 * Where they run is Task 6's layout (~/engine/bob/traces), so what the scene
 * draws is what the layout tests check. No React: the Opening (Task 10) mounts
 * the group and fades the lines in with `setLevel` as the loader opens.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import { TRACE, type TraceLayout } from '~/engine/bob/traces';
import { GLASS_RENDER_ORDER } from '~/engine/bob/build/glassFloor';

/**
 * How the traces look. `colour` is the palette's gold and `depth` how far under
 * the glass they lie (the lines sit at y = -`depth`, laid beneath it as in the
 * preview). `level` is the share of the gold they are drawn in at rest.
 * M1 drew them on the glass at 0.09; now the floor (92 % opaque) lets only a
 * little of what lies under it through, so they are drawn brighter.
 * 0.65 was measured, not derived: Task 9 took the 1440x900 home still of M1 and
 * of this build and compared the traces' brightness with the same mask (M1 0.084,
 * this build 0.075, a mean Rec. 709 luma of the sRGB values at the traces' own
 * pixels; the brightness summed over the same dilated mask is the same to 1 %).
 * The number only holds for the floor's opacity (`GLASS_LOOK.reflection.opacity`):
 * retune them together.
 */
export const TRACES_LOOK = {
  colour: palette.gold,
  level: 0.65,
  depth: 0.015
} as const;

/**
 * The traces' draw order: one before the glass (GLASS_RENDER_ORDER) and after the
 * sky (-10) and the mirror under the floor (MIRROR_RENDER_ORDER). The floor is
 * transparent, so it draws after every opaque thing and tints what lies under
 * it; the traces are opaque and draw before it, over the mirror, so it dims them.
 */
export const TRACES_RENDER_ORDER = GLASS_RENDER_ORDER - 1;

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
  // No depth test and no depth write: the mirror under the floor lies nearer the glass than the lines and is opaque, so
  // a test against it would hide them, and a write would hide what the floor draws over them. They are the bottom layer.
  const material = new THREE.LineBasicMaterial({
    name: 'traces:lines',
    color: gold.clone().multiplyScalar(TRACES_LOOK.level),
    depthTest: false,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'traces:lines';
  lines.position.y = -TRACES_LOOK.depth;
  lines.renderOrder = TRACES_RENDER_ORDER;

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
