import { describe, expect, it } from 'vitest';
import { AngleSpring, blendBearing, wrapAngle } from '~/engine/AngleSpring';
describe('AngleSpring', () => {
  it('overshoots a little, then settles', () => {
    const s = new AngleSpring(); let peak = 0;
    for (let i = 0; i < 120; i++) peak = Math.max(peak, s.step(1, 1 / 60));
    expect(peak).toBeGreaterThan(1.15); expect(peak).toBeLessThan(1.35);
    expect(Math.abs(s.value - 1)).toBeLessThan(0.01);
  });
  it('takes the short way across ±π', () => {
    const s = new AngleSpring(); s.set(3.0);
    for (let i = 0; i < 90; i++) { const v = s.step(-3.0, 1 / 60); expect(Math.abs(v)).toBeGreaterThan(2.5); }
  });
  it('stays finite for zero and huge steps', () => {
    const s = new AngleSpring(); expect(Number.isFinite(s.step(2, 0))).toBe(true); expect(Number.isFinite(s.step(2, 5))).toBe(true);
  });
  it('wraps and blends along the shortest arc', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI); expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(blendBearing(3, -3, 0.5)).toBeCloseTo(Math.PI, 2); expect(blendBearing(0.2, 1.2, 0)).toBeCloseTo(0.2);
  });
});

describe('AngleSpring, beyond the brief', () => {
  it('rests on its target, wrapped, and starts from a set value and speed', () => {
    const s = new AngleSpring(); s.set(4 * Math.PI + 0.5, 2); expect(s.value).toBeCloseTo(0.5, 9); expect(s.velocity).toBe(2);
    for (let i = 0; i < 600; i++) s.step(-1, 1 / 60);
    expect(s.value).toBeCloseTo(-1, 6); expect(Math.abs(s.velocity)).toBeLessThan(1e-6);
  });
  it('keeps the value in (-π, π] while it goes round the seam, and ignores a bad target or step', () => {
    const s = new AngleSpring(); s.set(3.1);
    for (let i = 0; i < 120; i++) { const v = s.step(-3.1, 1 / 60); expect(v).toBeGreaterThan(-Math.PI); expect(v).toBeLessThanOrEqual(Math.PI); }
    s.set(1); expect(s.step(Number.NaN, 1 / 60)).toBe(1); expect(s.step(2, Number.NaN)).toBe(1); expect(s.step(2, -1)).toBe(1);
  });
  it('clamps a stalled frame to a tenth of a second', () => {
    const a = new AngleSpring(); const b = new AngleSpring();
    expect(a.step(1, 5)).toBeCloseTo(b.step(1, 0.1), 12);
  });
  it('does not blend past the ends of the weight', () => {
    expect(blendBearing(0.2, 1.2, 2)).toBeCloseTo(1.2); expect(blendBearing(0.2, 1.2, -1)).toBeCloseTo(0.2);
    expect(wrapAngle(Number.NaN)).toBe(0); expect(wrapAngle(Math.PI)).toBe(Math.PI);
  });
});
