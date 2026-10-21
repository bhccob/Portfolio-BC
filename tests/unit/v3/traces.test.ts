import { describe, expect, it } from 'vitest';
import { bearingOf, DIAL, onDial } from '~/engine/instrument/dialSpec';
import { CHIP, PIN_COUNT, pinPosition } from '~/engine/v3/chipSpec';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';
import { boardPath, ringPath, TRACE, tracePoints } from '~/engine/v3/traces';

/** Point `k` of a flat xyz path. */
function at(path: Float32Array, k: number): [number, number, number] {
  return [path[k * 3], path[k * 3 + 1], path[k * 3 + 2]];
}

/** The distance of point `k` of a path from the compass's axis. */
function radiusAt(path: Float32Array, k: number): number {
  return Math.hypot(path[k * 3], path[k * 3 + 2]);
}

/** The bearing of point `k` of a path, in radians (the dial's frame). */
function bearingAt(path: Float32Array, k: number): number {
  return bearingOf(path[k * 3], path[k * 3 + 2]);
}

/** The shortest distance from the point (px, pz) to the polyline through a path's xz, which is what two traces have to keep apart. */
function distanceToPath(px: number, pz: number, path: Float32Array): number {
  let best = Infinity;
  for (let k = 0; k < TRACE.points - 1; k++) {
    const [ax, , az] = at(path, k);
    const [bx, , bz] = at(path, k + 1);
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), pz - (az + dz * t)));
  }
  return best;
}

describe('traces', () => {
  it('are the board paths at 0 and the ring arcs at 1, with the same point count', () => {
    const out = new Float32Array(TRACE.points * 3);
    for (const i of [0, 17, 63]) {
      expect(Array.from(tracePoints(i, 0, out))).toEqual(Array.from(boardPath(i)));
      expect(Array.from(tracePoints(i, 1, out))).toEqual(Array.from(ringPath(i)));
    }
  });
  it('end each ring arc on its gilt rule', () => {
    const p = ringPath(5);
    for (let k = 0; k < TRACE.points; k++) expect(Math.hypot(p[k * 3], p[k * 3 + 2])).toBeCloseTo(DIAL.rules[5 % 4], 6);
  });
  it('do not all move at once: at t = 0.2 some traces are still on the board', () => {
    const out = new Float32Array(TRACE.points * 3);
    const still = [...Array(TRACE.count).keys()].filter((i) => Array.from(tracePoints(i, 0.2, out)).join() === Array.from(boardPath(i)).join());
    expect(still.length).toBeGreaterThan(0);
    expect(still.length).toBeLessThan(TRACE.count);
  });
});

describe('the traces as a set', () => {
  it('count one to a pin, 48 points each', () => {
    expect(TRACE.count).toBe(PIN_COUNT);
    expect(TRACE.points).toBe(48);
    expect(boardPath(0)).toHaveLength(TRACE.points * 3);
    expect(ringPath(0)).toHaveLength(TRACE.points * 3);
  });
  it('refuse an index that is not a pin', () => {
    const out = new Float32Array(TRACE.points * 3);
    for (const bad of [-1, 64, 1.5, Number.NaN]) {
      expect(() => boardPath(bad)).toThrow(RangeError);
      expect(() => ringPath(bad)).toThrow(RangeError);
      expect(() => tracePoints(bad, 0.5, out)).toThrow(RangeError);
    }
  });
  it('hand out copies: writing to a path does not change the next one', () => {
    const first = boardPath(3);
    first.fill(9);
    expect(boardPath(3)[0]).not.toBe(9);
    const arc = ringPath(3);
    arc.fill(9);
    expect(ringPath(3)[0]).not.toBe(9);
  });
});

describe('the board paths', () => {
  it('start at the outer end of their pin, on the board plane', () => {
    for (let i = 0; i < PIN_COUNT; i++) {
      const pin = pinPosition(i);
      const [x, y, z] = at(boardPath(i), 0);
      const push = CHIP.pinLength / 2;
      const expected = {
        top: [pin.x, pin.z - push],
        right: [pin.x + push, pin.z],
        bottom: [pin.x, pin.z + push],
        left: [pin.x - push, pin.z]
      }[pin.side];
      expect(x).toBeCloseTo(expected[0], 6);
      expect(z).toBeCloseTo(expected[1], 6);
      expect(y).toBeCloseTo(CHIP.board, 6);
    }
  });
  it('stay on the board plane and end between radius 0.75 and 0.98', () => {
    for (let i = 0; i < PIN_COUNT; i++) {
      const p = boardPath(i);
      for (let k = 0; k < TRACE.points; k++) expect(p[k * 3 + 1]).toBeCloseTo(CHIP.board, 6);
      const r = radiusAt(p, TRACE.points - 1);
      expect(r).toBeGreaterThanOrEqual(0.75);
      expect(r).toBeLessThanOrEqual(0.98);
    }
  });
  it('run outward, so every trace ends farther from the chip than it starts and never turns back', () => {
    for (let i = 0; i < PIN_COUNT; i++) {
      const p = boardPath(i);
      for (let k = 1; k < TRACE.points; k++) expect(radiusAt(p, k)).toBeGreaterThan(radiusAt(p, k - 1));
    }
  });
  it('are routed like a board: straight runs and 45 degree bends', () => {
    for (let i = 0; i < PIN_COUNT; i++) {
      const p = boardPath(i);
      let off = 0;
      for (let k = 0; k < TRACE.points - 1; k++) {
        const heading = Math.atan2(p[(k + 1) * 3] - p[k * 3], p[(k + 1) * 3 + 2] - p[k * 3 + 2]);
        const eighths = heading / (Math.PI / 4);
        if (Math.abs(eighths - Math.round(eighths)) > 1e-3) off++;
      }
      // A segment that holds a bend between its two points is the only one off the 45 degree grid, and a trace has two bends at most.
      expect(off).toBeLessThanOrEqual(2);
    }
  });
  it('keep clear of one another: no two traces come closer than a trace is wide', () => {
    const paths = [...Array(PIN_COUNT).keys()].map((i) => boardPath(i));
    let closest = Infinity;
    for (let a = 0; a < PIN_COUNT; a++) {
      for (let b = a + 1; b < PIN_COUNT; b++) {
        for (let k = 0; k < TRACE.points; k++) closest = Math.min(closest, distanceToPath(paths[a][k * 3], paths[a][k * 3 + 2], paths[b]));
      }
    }
    // The pins are CHIP.size / 16 = 0.0175 apart, which is as close as two traces get; a trace is no wider than a pin (0.008).
    expect(closest).toBeGreaterThan(CHIP.pinWidth);
  });
  it('differ from one another: neighbouring traces take different routes', () => {
    const keys = new Set([...Array(PIN_COUNT).keys()].map((i) => Array.from(boardPath(i)).map((v) => v.toFixed(4)).join()));
    expect(keys.size).toBe(PIN_COUNT);
    // And they are not copies of one shape shifted along: the 16 on a side end at 16 different radii.
    const radii = new Set([...Array(16).keys()].map((i) => radiusAt(boardPath(i), TRACE.points - 1).toFixed(4)));
    expect(radii.size).toBe(16);
  });
});

describe('the ring arcs', () => {
  it('lie just under their ring: at its height less 0.009', () => {
    for (let i = 0; i < PIN_COUNT; i++) {
      const p = ringPath(i);
      for (let k = 0; k < TRACE.points; k++) expect(p[k * 3 + 1]).toBeCloseTo(GLASS_RINGS[i % 4].y - 0.009, 6);
    }
  });
  it('are centred on the bearing of their pin and span 22.5 degrees', () => {
    for (let i = 0; i < PIN_COUNT; i++) {
      const pin = pinPosition(i);
      const p = ringPath(i);
      const [fx, , fz] = at(p, 0);
      const [lx, , lz] = at(p, TRACE.points - 1);
      const span = Math.abs(((bearingAt(p, TRACE.points - 1) - bearingAt(p, 0)) * 180) / Math.PI);
      expect(Math.min(span, 360 - span)).toBeCloseTo(22.5, 3);
      // The two ends sit half the span either side of the pin's bearing: their sum points at it.
      expect(bearingOf(fx + lx, fz + lz)).toBeCloseTo(bearingOf(pin.x, pin.z), 5);
    }
  });
  it('step evenly along the arc', () => {
    const p = ringPath(9);
    const first = Math.hypot(p[3] - p[0], p[5] - p[2]);
    for (let k = 1; k < TRACE.points; k++) expect(Math.hypot(p[k * 3] - p[(k - 1) * 3], p[k * 3 + 2] - p[(k - 1) * 3 + 2])).toBeCloseTo(first, 5);
  });
  it('turn the way their trace leans, so the board path and the arc unfold the same way', () => {
    // Pin 3 is on the left half of the top side, which leans left (counter-clockwise); pin 12 is on its right half, which leans right.
    const sweep = (i: number) => {
      const p = ringPath(i);
      return Math.sign(Math.sin(bearingAt(p, TRACE.points - 1) - bearingAt(p, 0)));
    };
    expect(sweep(3)).toBe(-1);
    expect(sweep(12)).toBe(1);
  });
  it('are where onDial puts them', () => {
    const p = ringPath(20);
    const [x, , z] = at(p, 0);
    const b = bearingOf(x, z);
    const [ex, ez] = onDial((b * 180) / Math.PI, DIAL.rules[20 % 4]);
    expect(x).toBeCloseTo(ex, 6);
    expect(z).toBeCloseTo(ez, 6);
  });
});

describe('tracePoints', () => {
  it('writes into the array it is given and returns it', () => {
    const out = new Float32Array(TRACE.points * 3);
    expect(tracePoints(2, 0.5, out)).toBe(out);
  });
  it('holds a trace on the board until its turn, then moves it, then holds it on the ring', () => {
    const out = new Float32Array(TRACE.points * 3);
    // Trace 0 has no delay: it is moving at t = 0.1. Trace 7 waits 7/8 * 0.35 = 0.30625.
    expect(Array.from(tracePoints(0, 0.1, out))).not.toEqual(Array.from(boardPath(0)));
    expect(Array.from(tracePoints(7, 0.3, out))).toEqual(Array.from(boardPath(7)));
    expect(Array.from(tracePoints(7, 0.4, out))).not.toEqual(Array.from(boardPath(7)));
  });
  it('is exactly the ring arc by t = 1 for every trace, and exactly the board before any', () => {
    const out = new Float32Array(TRACE.points * 3);
    for (let i = 0; i < PIN_COUNT; i++) {
      expect(Array.from(tracePoints(i, 1, out))).toEqual(Array.from(ringPath(i)));
      expect(Array.from(tracePoints(i, 0, out))).toEqual(Array.from(boardPath(i)));
    }
  });
  it('reads t outside 0..1 as held to it', () => {
    const out = new Float32Array(TRACE.points * 3);
    expect(Array.from(tracePoints(11, 7, out))).toEqual(Array.from(ringPath(11)));
    expect(Array.from(tracePoints(11, -2, out))).toEqual(Array.from(boardPath(11)));
    expect(Array.from(tracePoints(11, Number.NaN, out))).toEqual(Array.from(boardPath(11)));
  });
  it('moves every point between the board and the ring, and eases', () => {
    const out = new Float32Array(TRACE.points * 3);
    const a = boardPath(0);
    const b = ringPath(0);
    // Trace 0 has no delay, so t is its own progress; smootherstep(0.5) = 0.5 exactly.
    tracePoints(0, 0.5, out);
    for (let n = 0; n < out.length; n++) expect(out[n]).toBeCloseTo((a[n] + b[n]) / 2, 5);
    // Smootherstep is slow to start: a tenth of the way in, the move is far less than a tenth.
    tracePoints(0, 0.1, out);
    const moved = Math.hypot(out[0] - a[0], out[1] - a[1], out[2] - a[2]);
    const whole = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    expect(moved).toBeLessThan(whole * 0.02);
  });
});
