import { describe, expect, it } from 'vitest';
import { AngleSpring } from '~/engine/AngleSpring';
import { NEEDLE_REST, settleAngle } from '~/engine/bob/needle';
import { DRIFT, driftAngle, isAiming, NEEDLE_SPRING, needleAngleFor, nextDriftRest } from '~/engine/bob/needleAim';
import type { Phase } from '~/state/machine';

describe('needleAngleFor', () => {
  it('points the needle at the pointer, clockwise from up', () => {
    expect(needleAngleFor({ x: 100, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(0, 9);
    expect(needleAngleFor({ x: 200, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(Math.PI / 2, 9);
    expect(needleAngleFor({ x: 0, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('reads screen pixels with y down: up and to the right is a quarter of a half turn', () => {
    expect(needleAngleFor({ x: 150, y: 50 }, { x: 100, y: 100 })).toBeCloseTo(Math.PI / 4, 9);
    expect(needleAngleFor({ x: 50, y: 50 }, { x: 100, y: 100 })).toBeCloseTo(-Math.PI / 4, 9);
    // Straight below is half a turn, either way round.
    expect(Math.abs(needleAngleFor({ x: 100, y: 300 }, { x: 100, y: 100 }))).toBeCloseTo(Math.PI, 9);
  });

  it('depends on the direction alone, not on how far the pointer is', () => {
    const near = needleAngleFor({ x: 130, y: 60 }, { x: 100, y: 100 });
    const far = needleAngleFor({ x: 400, y: -300 }, { x: 100, y: 100 });
    expect(far).toBeCloseTo(near, 9);
  });

  it('has no answer for a pointer on the pivot itself or a point that is not a number', () => {
    expect(needleAngleFor({ x: 100, y: 100 }, { x: 100, y: 100 })).toBeNaN();
    expect(needleAngleFor({ x: Number.NaN, y: 0 }, { x: 100, y: 100 })).toBeNaN();
    expect(needleAngleFor({ x: 0, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 100 })).toBeNaN();
  });
});

describe('driftAngle', () => {
  it('drifts around the rest within 0.6 rad', () => {
    for (let t = 0; t < 30; t += 0.5) expect(Math.abs(driftAngle(t) - NEEDLE_REST)).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it('is NEEDLE_REST + 0.6 sin(2 pi t / 14): at the rest at 0, its widest a quarter period in, round again after 14 s', () => {
    expect(DRIFT).toEqual({ depth: 0.6, period: 14 });
    expect(driftAngle(0)).toBe(NEEDLE_REST);
    expect(driftAngle(3.5)).toBeCloseTo(NEEDLE_REST + 0.6, 12);
    expect(driftAngle(10.5)).toBeCloseTo(NEEDLE_REST - 0.6, 12);
    for (const t of [0.3, 2, 7.7, 12.25]) expect(driftAngle(t + 14)).toBeCloseTo(driftAngle(t), 9);
    expect(driftAngle(5)).toBeCloseTo(NEEDLE_REST + 0.6 * Math.sin((2 * Math.PI * 5) / 14), 12);
  });

  it('reads a time that is not a number as rest', () => {
    expect(driftAngle(Number.NaN)).toBe(NEEDLE_REST);
    expect(driftAngle(Number.POSITIVE_INFINITY)).toBe(NEEDLE_REST);
  });
});

describe('nextDriftRest', () => {
  it('is the first whole drift period at or after a time, where the drift is back at its rest', () => {
    expect(nextDriftRest(0)).toBe(0);
    expect(nextDriftRest(0.1)).toBe(14);
    expect(nextDriftRest(12)).toBe(14);
    expect(nextDriftRest(14)).toBe(14);
    expect(nextDriftRest(14.01)).toBe(28);
    for (const t of [3, 12, 20, 41]) expect(driftAngle(nextDriftRest(t))).toBeCloseTo(NEEDLE_REST, 12);
  });

  it('reads a time that is not a number, or before 0, as 0', () => {
    expect(nextDriftRest(Number.NaN)).toBe(0);
    expect(nextDriftRest(-3)).toBe(0);
  });
});

describe('the needle spring', () => {
  it("is v3's, heavy and a little under-damped", () => {
    expect(NEEDLE_SPRING).toEqual({ zeta: 0.55, omega: 3.2 });
  });

  it("takes over the loader's needle without a snap: from settleAngle(1) it moves only a hair on its first frame", () => {
    const spring = new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    const handed = settleAngle(1);
    // The settle ends 1.8 degrees short of the rest, which the spring then closes.
    expect(Math.abs(handed - NEEDLE_REST)).toBeGreaterThan(0.02);
    spring.set(handed, 0);
    const first = spring.step(NEEDLE_REST, 1 / 60);
    expect(Math.abs(first - handed)).toBeLessThan(1e-3);
    for (let i = 0; i < 600; i++) spring.step(NEEDLE_REST, 1 / 60);
    expect(spring.value).toBeCloseTo(NEEDLE_REST, 4);
  });
});

describe('isAiming', () => {
  it('aims on the home page at rest and nowhere else', () => {
    expect(isAiming('HOME_IDLE', 'home')).toBe(true);
    const others: Phase['kind'][] = ['LOADING', 'FOCUS_COUNTRY', 'COUNTRY_PAGE', 'DISSECT', 'MORPH', 'VOID_ENTRY', 'PROJECTS', 'PROJECT_FOCUS'];
    for (const kind of others) expect(isAiming(kind, 'home'), kind).toBe(false);
    expect(isAiming('HOME_IDLE', 'project')).toBe(false);
    expect(isAiming('HOME_IDLE', 'country')).toBe(false);
    expect(isAiming('HOME_IDLE', null)).toBe(false);
  });
});
