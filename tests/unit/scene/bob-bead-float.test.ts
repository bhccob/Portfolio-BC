import { describe, expect, it } from 'vitest';
import { FLOAT, floatAt, floatRuns, turnToward } from '~/scene/bob/beadFloat';
import { IDLE_SECONDS } from '~/scene/bob/look';

const DEG = Math.PI / 180;

describe('the float: the bead at its arrival drifts up and down and sways a little', () => {
  it('floats within 6 cm and 1.5 degrees, the same at the same time', () => {
    expect(FLOAT).toMatchObject({ lift: 0.06, period: 5.5, idle: IDLE_SECONDS });
    expect(FLOAT.sway).toBeCloseTo(1.5 * DEG, 12);
    expect(FLOAT.turnMax).toBeCloseTo(12 * DEG, 12);
    let top = 0;
    let lean = 0;
    for (let t = 0; t <= 30; t += 0.05) {
      for (const phase of [0, 1, 2]) {
        const f = floatAt(t, phase);
        expect(Math.abs(f.y)).toBeLessThanOrEqual(0.06 + 1e-12);
        expect(Math.abs(f.roll)).toBeLessThanOrEqual(1.5 * DEG + 1e-12);
        expect(Math.abs(f.pitch)).toBeLessThanOrEqual(1.5 * DEG + 1e-12);
        top = Math.max(top, Math.abs(f.y));
        lean = Math.max(lean, Math.abs(f.roll), Math.abs(f.pitch));
        expect(floatAt(t, phase)).toEqual(f); // a time is a pose: nothing kept between calls
      }
    }
    // It does move, near the whole of its range.
    expect(top).toBeGreaterThan(0.055);
    expect(lean).toBeGreaterThan(1.3 * DEG);
    // At rest, 0, it stands where the path puts it; one period on, it is back there; beads drift apart by their phase.
    expect(floatAt(0, 0)).toEqual({ y: 0, roll: 0, pitch: 0 });
    expect(floatAt(FLOAT.period, 0).y).toBeCloseTo(0, 12);
    expect(floatAt(1, 1).y).not.toBeCloseTo(floatAt(1, 0).y, 3);
    // A time that is not a number is rest.
    expect(floatAt(Number.NaN, 0)).toEqual({ y: 0, roll: 0, pitch: 0 });
  });
});

describe('the turn: toward the pointer over the bead', () => {
  const bead = { x: 700, y: 450, r: 160 };

  it('turns toward the pointer, at most 12 degrees, none with the pointer away', () => {
    // Over its middle: no turn; to its right, it turns right (yaw > 0); above it, up (pitch > 0).
    expect(turnToward({ x: 700, y: 450 }, bead)).toEqual({ yaw: 0, pitch: 0 });
    const right = turnToward({ x: 780, y: 450 }, bead);
    expect(right.yaw).toBeCloseTo(6 * DEG, 9);
    expect(right.pitch).toBeCloseTo(0, 12);
    const up = turnToward({ x: 700, y: 370 }, bead);
    expect(up.pitch).toBeCloseTo(6 * DEG, 9);
    expect(up.yaw).toBeCloseTo(0, 12);
    // At its edge, the most: 12 degrees, and never past it, corner or not.
    expect(turnToward({ x: 860, y: 450 }, bead).yaw).toBeCloseTo(12 * DEG, 9);
    const corner = turnToward({ x: 800, y: 350 }, bead);
    expect(Math.hypot(corner.yaw, corner.pitch)).toBeLessThanOrEqual(12 * DEG + 1e-12);
    // Away from it (past a tenth more than its radius), or no pointer at all: none.
    expect(turnToward({ x: 700 + 160 * 1.11, y: 450 }, bead)).toEqual({ yaw: 0, pitch: 0 });
    expect(turnToward({ x: 100, y: 100 }, bead)).toEqual({ yaw: 0, pitch: 0 });
    expect(turnToward({ x: Number.NaN, y: 450 }, bead)).toEqual({ yaw: 0, pitch: 0 });
    expect(turnToward({ x: 700, y: 450 }, { x: 700, y: 450, r: 0 })).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe('floatRuns: the float and the turn draw frames only for a while', () => {
  it('runs for 12 s after the last input, never with reduced motion', () => {
    expect(floatRuns(0, false)).toBe(true);
    expect(floatRuns(11.9, false)).toBe(true);
    expect(floatRuns(12, false)).toBe(false); // the canvas sleeps
    expect(floatRuns(0, true)).toBe(false);
    expect(floatRuns(Number.NaN, false)).toBe(false);
  });
});
