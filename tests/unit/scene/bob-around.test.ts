import { describe, expect, it } from 'vitest';
import type { CameraShot } from '~/engine/bob/shots';
import { around, aroundShot, turnedRound } from '~/scene/bob/around';

type Vec3 = readonly [number, number, number];
const C: Vec3 = [1, -5, 2];
const at = (angle: number, r: number, y: number): Vec3 => [C[0] + Math.cos(angle) * r, y, C[2] + Math.sin(angle) * r];
const flat = (p: Vec3): number => Math.hypot(p[0] - C[0], p[2] - C[2]);
const angleOf = (p: Vec3): number => Math.atan2(p[2] - C[2], p[0] - C[0]);

describe('around: the way from one place to another round the board, never across it', () => {
  it("keeps its distance from the centre between the two ends' distances", () => {
    const a = at(2.8, 7, 0);
    const b = at(0.1, 4, 3);
    for (let k = 0; k <= 40; k++) {
      const r = flat(around(a, b, C, k / 40));
      expect(r).toBeGreaterThanOrEqual(4 - 1e-9);
      expect(r).toBeLessThanOrEqual(7 + 1e-9);
    }
  });

  it('turns the short way', () => {
    // From 170° to -170°: 20° through 180°, not 340° the other way.
    const p = around(at((170 * Math.PI) / 180, 5, 0), at((-170 * Math.PI) / 180, 5, 0), C, 0.5);
    expect(Math.abs(Math.abs(angleOf(p)) - Math.PI)).toBeLessThan(1e-9);
  });

  it('ends exactly at each end, and rises evenly', () => {
    const a = at(1, 6, -1);
    const b = at(-2, 3, 5);
    expect(around(a, b, C, 0)).toEqual(a.map((v) => expect.closeTo(v, 12)));
    expect(around(a, b, C, 1)).toEqual(b.map((v) => expect.closeTo(v, 12)));
    expect(around(a, b, C, 0.25)[1]).toBeCloseTo(0.5, 12);
  });

  it('goes straight near the axis', () => {
    const a: Vec3 = [C[0] + 0.2, 4, C[2]];
    const b = at(1, 6, 0);
    const p = around(a, b, C, 0.5);
    expect(p).toEqual([(a[0] + b[0]) / 2, 2, (a[2] + b[2]) / 2].map((v) => expect.closeTo(v, 12)));
  });

  it('moves a shot by its position and its target, and its field evenly', () => {
    const a: CameraShot = { position: at(0.3, 8, 4), target: at(0.3, 2.6, 0), fov: 40, up: [0, 1, 0] };
    const b: CameraShot = { position: at(2.6, 8, 4), target: at(2.6, 2.6, 0), fov: 30, up: [0, 1, 0] };
    const mid = aroundShot(a, b, C, 0.5);
    expect(mid.fov).toBeCloseTo(35, 12);
    expect(flat(mid.position)).toBeCloseTo(8, 9);
    expect(flat(mid.target)).toBeCloseTo(2.6, 9);
    expect(angleOf(mid.position)).toBeCloseTo(1.45, 9);
    expect(mid.up).toEqual([0, 1, 0]);
  });
});

describe('turnedRound: a shot turned round the centre, as the camera turns on the way down to a floor', () => {
  const shot: CameraShot = { position: at(0.4, 9, 6), target: at(0.4, 1.5, 2), fov: 38, up: [0, 1, 0], sway: 0 };

  it('turns its position and its target by the angle, each at its own distance and height', () => {
    const turned = turnedRound(shot, C, -1.2);
    expect(angleOf(turned.position)).toBeCloseTo(0.4 - 1.2, 9);
    expect(angleOf(turned.target)).toBeCloseTo(0.4 - 1.2, 9);
    expect(flat(turned.position)).toBeCloseTo(9, 9);
    expect(flat(turned.target)).toBeCloseTo(1.5, 9);
    expect(turned.position[1]).toBe(6);
    expect(turned.target[1]).toBe(2);
  });

  it('keeps the rest of the shot, and a whole turn is the shot itself', () => {
    const whole = turnedRound(shot, C, -2 * Math.PI);
    expect(whole.position).toEqual(shot.position.map((v) => expect.closeTo(v, 9)));
    expect(whole.target).toEqual(shot.target.map((v) => expect.closeTo(v, 9)));
    expect({ fov: whole.fov, up: whole.up, sway: whole.sway }).toEqual({ fov: 38, up: [0, 1, 0], sway: 0 });
  });
});
