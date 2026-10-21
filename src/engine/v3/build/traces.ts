/**
 * The 64 circuit traces of the v3 opening as one three.js object: thin lines
 * on the board that run out from the chip's pins, glow dimly when the chip
 * powers up, and then lift off the board and bend into the compass's rings.
 * The shapes are Task 4's (`tracePoints`), written straight into the buffer,
 * so what the scene draws is exactly what the trace tests check.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import { TRACE, tracePoints } from '~/engine/v3/traces';

/**
 * How the traces look, all colours as multiples of a palette colour in linear
 * light. `rest` is the unpowered trace: dark brass, barely there on the black
 * board, as in frame 01. `lit` is the power-on level, `setGlow(1)`: a dim
 * amber current (spec §2.1), its luminance well under the bloom's threshold of
 * 1, so the 64 lines never bloom into streaks. `lift` raises the lines a hair
 * off the board plane, so they never z-fight a board drawn at `CHIP.board`.
 */
export const TRACES_LOOK = {
  rest: { colour: palette.brass, level: 0.05 },
  lit: { colour: palette.gold, level: 0.55 },
  lift: 0.0006
} as const;

/** The traces as the scene holds them. */
export interface TracesModel {
  /** All 64 traces in one buffer of line segments: trace `i`'s 47 segments are segments `47 i` to `47 i + 46`. */
  lines: THREE.LineSegments;
  /** Poses every trace at `t` (0..1) of the move from board to ring, through `tracePoints`. */
  setT(t: number): void;
  /** Sets the glow: 0 the unpowered dark brass, 1 the dim power-on amber; held to 0..1. */
  setGlow(level: number): void;
  /** Frees the buffer and the material. */
  dispose(): void;
}

/** The segments of one trace: its 48 points make 47 segments, two vertices each. */
const SEGMENTS = TRACE.points - 1;

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * Builds the traces, posed on the board (`t` 0) and unpowered (glow 0). One
 * `LineSegments` holds all 64, so the whole circuit is a single draw call, and
 * its bounds are fixed once to the union of the board and the ring shapes:
 * every pose in between lies inside them (each point moves on a straight line
 * from one to the other), so the lines are never culled by stale bounds and
 * nothing is recomputed per frame.
 */
export function buildTraces(): TracesModel {
  const positions = new Float32Array(TRACE.count * SEGMENTS * 2 * 3);
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', attribute);

  const path = new Float32Array(TRACE.points * 3);
  const write = (t: number): void => {
    for (let i = 0; i < TRACE.count; i++) {
      tracePoints(i, t, path);
      const base = i * SEGMENTS * 6;
      for (let k = 0; k < SEGMENTS; k++) {
        // Segment k runs from point k to point k + 1: copied, not recomputed, so the ends stay bit-exact.
        positions.set(path.subarray(k * 3, k * 3 + 6), base + k * 6);
      }
    }
    attribute.needsUpdate = true;
  };

  write(1);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!.clone();
  write(0);
  geometry.computeBoundingBox();
  geometry.boundingBox!.union(bounds);
  geometry.boundingSphere = geometry.boundingBox!.getBoundingSphere(new THREE.Sphere());

  const rest = new THREE.Color(TRACES_LOOK.rest.colour).multiplyScalar(TRACES_LOOK.rest.level);
  const lit = new THREE.Color(TRACES_LOOK.lit.colour).multiplyScalar(TRACES_LOOK.lit.level);
  const material = new THREE.LineBasicMaterial({ name: 'traces:lines', color: rest.clone() });

  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'traces:lines';
  lines.position.y = TRACES_LOOK.lift;

  // The pose the buffer holds: a held clock sets the same t every frame, and that need not upload the buffer again.
  let shown = 0;
  return {
    lines,
    setT(t) {
      const next = clamp01(t);
      if (next === shown) return;
      shown = next;
      write(next);
    },
    setGlow(level) {
      material.color.lerpColors(rest, lit, clamp01(level));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
