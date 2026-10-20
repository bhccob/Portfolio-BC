import { describe, expect, it } from 'vitest';
import { bearingOf } from '~/engine/instrument/dialSpec';
import { DRIVE, TRACKS, armBearing, headBearing, headPoint } from '~/engine/instrument/drive';
const radii = [...TRACKS.map((id) => DRIVE.tracks[id]), DRIVE.parkRadius];
describe('the drive geometry', () => {
  it('puts the head exactly on the radius the arm is asked for', () => {
    for (const r of radii) {
      const a = armBearing(r);
      expect(a).not.toBeNull();
      expect(Math.hypot(...headPoint(a!))).toBeCloseTo(r, 6);
    }
  });
  it('turns the arm one way only as the head moves in or out', () => {
    const at = Array.from({ length: 61 }, (_, k) => armBearing(0.5 + k * 0.01)!);
    const steps = at.slice(1).map((a, k) => a - at[k]);
    expect(steps.every((d) => d > 0) || steps.every((d) => d < 0)).toBe(true);
  });
  it('has no solution out of reach', () => {
    expect(armBearing(3)).toBeNull(); expect(armBearing(0)).toBeNull(); expect(armBearing(Number.NaN)).toBeNull();
  });
  it('reads the head\'s dial bearing off the head point', () => {
    for (const r of radii) expect(headBearing(r)).toBeCloseTo((bearingOf(...headPoint(armBearing(r)!)) * 180) / Math.PI, 9);
    expect(Number.isNaN(headBearing(3))).toBe(true);
  });
  it('pins the arm to known bearings, not only to its own formulas', () => {
    expect(Math.abs(armBearing(0.88)! - -7.2)).toBeLessThan(0.1); expect(Math.abs(headBearing(0.88) - 72.8)).toBeLessThan(0.2);
    expect(Math.abs(armBearing(DRIVE.parkRadius)! - 3.0)).toBeLessThan(0.1);
  });
  it('measures the head from the pivot along the arm', () => {
    const [px, pz] = DRIVE.pivot;
    for (const a of [0, 45, -24, 267, 180]) {
      const [x, z] = headPoint(a);
      expect(Math.hypot(x - px, z - pz)).toBeCloseTo(DRIVE.armLength, 9);
    }
    // North is -z and east is +x: an arm at bearing 0 points north, at 90 east.
    expect(headPoint(0)[0]).toBeCloseTo(DRIVE.pivot[0], 9); expect(headPoint(0)[1]).toBeCloseTo(DRIVE.pivot[1] - DRIVE.armLength, 9);
    expect(headPoint(90)[0]).toBeCloseTo(DRIVE.pivot[0] + DRIVE.armLength, 9);
  });
  it('swings the arm in from the corner over the platter, the head on the north-east half of the dial', () => {
    const [px, pz] = DRIVE.pivot;
    for (const r of radii) {
      const [x, z] = headPoint(armBearing(r)!);
      // The side of the line from the centre to the pivot: the cross product, negative on the north-east half.
      expect(px * z - pz * x).toBeLessThan(0);
    }
    expect(armBearing(DRIVE.tracks.funcial)!).toBeGreaterThan(-90); expect(armBearing(DRIVE.tracks.funcial)!).toBeLessThan(90);
  });
  it('keeps the arm out of the rings: the pivot sits beyond the platters, the park ramp just past the rim', () => {
    expect(Math.hypot(...DRIVE.pivot)).toBeGreaterThan(DRIVE.platter.outer);
    expect(DRIVE.parkRadius).toBeGreaterThan(DRIVE.platter.outer);
    expect(DRIVE.armLength + DRIVE.yoke).toBeCloseTo(0.82 + 0.6, 9);
  });
  it('lists the tracks outer to inner, each inside the platter', () => {
    expect([...TRACKS]).toEqual(['funcial', 'jontai-energy', 'cookies-clicker', 'next']);
    const r = TRACKS.map((id) => DRIVE.tracks[id]);
    expect(r).toEqual([0.88, 0.76, 0.64, 0.52]);
    expect([...r].sort((a, b) => b - a)).toEqual(r);
    for (const radius of r) {
      expect(radius).toBeGreaterThanOrEqual(DRIVE.platter.inner + 0.1); expect(radius).toBeLessThanOrEqual(DRIVE.platter.outer - 0.05);
    }
  });
});
