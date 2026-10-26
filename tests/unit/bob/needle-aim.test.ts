import { describe, expect, it } from 'vitest';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import { NEEDLE_REST, settleAngle } from '~/engine/bob/needle';
import { aimsAt, DRIFT, driftAngle, isAiming, NEEDLE_SPRING, needleAngleAt, needleAngleFor, nextDriftRest } from '~/engine/bob/needleAim';
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
    const others: Phase['kind'][] = ['LOADING', 'LIGHT', 'PROJECTS', 'END', 'PROJECT_FOCUS'];
    for (const kind of others) expect(isAiming(kind, 'home'), kind).toBe(false);
    expect(isAiming('HOME_IDLE', 'project')).toBe(false);
    expect(isAiming('HOME_IDLE', null)).toBe(false);
  });
});

describe('aimsAt', () => {
  it('aims only at the home itself, the rise at exactly 0', () => {
    expect(aimsAt('HOME_IDLE', 'home', 0)).toBe(true);
    for (const u of [1e-9, 0.01, 0.5, 0.999, 1]) expect(aimsAt('HOME_IDLE', 'home', u), `u ${u}`).toBe(false);
  });

  it('never aims where isAiming does not, whatever the rise', () => {
    const others: Phase['kind'][] = ['LOADING', 'LIGHT', 'PROJECTS', 'END', 'PROJECT_FOCUS'];
    for (const kind of others) expect(aimsAt(kind, 'home', 0), kind).toBe(false);
    expect(aimsAt('HOME_IDLE', 'project', 0)).toBe(false);
    expect(aimsAt('HOME_IDLE', null, 0)).toBe(false);
  });

  it('reads a rise that is not a number as off the home: the needle holds rather than aim from a bad frame', () => {
    expect(aimsAt('HOME_IDLE', 'home', Number.NaN)).toBe(false);
  });

  it("holds the spring's target through a scroll off the home and back, and the needle takes up the aim from where it is", () => {
    // Home's rule, frame by frame: the target moves only while aimsAt says so, and the spring is never set from it.
    const spring = new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    spring.set(0.4, 0);
    let target = 0.4;
    const dt = 1 / 60;
    const rises = [...Array.from({ length: 30 }, () => 0), ...Array.from({ length: 120 }, (_, i) => Math.min(1, (i + 1) / 60)), ...Array.from({ length: 60 }, (_, i) => Math.max(0, 1 - (i + 1) / 30)), ...Array.from({ length: 120 }, () => 0)];
    let last = spring.value;
    let held: number | null = null;
    for (let i = 0; i < rises.length; i++) {
      const u = rises[i];
      // The pointer swings round the whole dial, crossing straight down, all the while.
      const pointer = Math.PI * Math.sin(i / 30);
      if (aimsAt('HOME_IDLE', 'home', u)) target = pointer;
      if (u > 0) {
        held ??= target;
        expect(target, `frame ${i}`).toBe(held);
      } else held = null;
      const value = spring.step(target, dt);
      // No snap: the needle moves on by at most its spring's speed, the whole way out and back.
      expect(Math.abs(wrapAngle(value - last)), `frame ${i}`).toBeLessThan(0.2);
      last = value;
    }
  });
});

describe('needleAngleAt', () => {
  it("is the spring's own angle at the home itself", () => {
    for (const value of [0, 0.7, -2, Math.PI, -3.1]) expect(needleAngleAt(value, 1.2, 0)).toBe(value);
    // A rise that is not a number is the home's: the dip is 0 there.
    expect(needleAngleAt(-3.1, 3.1, Number.NaN)).toBe(-3.1);
  });

  it("up the rise is the spring's angle unwrapped about the held target", () => {
    for (const u of [1e-9, 0.3, 1]) {
      // Either side of the target, on the same side of the seam, it is the spring's angle as it is.
      expect(needleAngleAt(0.5, 0.7, u)).toBeCloseTo(0.5, 12);
      expect(needleAngleAt(-2, -2.4, u)).toBeCloseTo(-2, 12);
      // Across straight down from the target it goes on round: just past +π, not back at -π.
      expect(needleAngleAt(-Math.PI + 0.04, Math.PI - 0.01, u)).toBeCloseTo(Math.PI + 0.04, 12);
      expect(needleAngleAt(Math.PI - 0.04, -Math.PI + 0.01, u)).toBeCloseTo(-Math.PI - 0.04, 12);
    }
  });

  it('stays continuous while a spring settling on a target by straight down crosses the seam, up the rise', () => {
    const spring = new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega);
    spring.set(2.2, 0);
    const target = Math.PI - 0.01;
    let crossings = 0;
    let last = needleAngleAt(spring.value, target, 0.5);
    let previous = spring.value;
    for (let i = 0; i < 240; i++) {
      const value = spring.step(target, 1 / 60);
      if (Math.sign(value) !== Math.sign(previous)) crossings++;
      previous = value;
      const angle = needleAngleAt(value, target, 0.5);
      expect(Math.abs(angle - last), `frame ${i}`).toBeLessThan(0.1);
      last = angle;
    }
    // The wrapped spring does cross the seam, twice: the case the unwrapping is for.
    expect(crossings).toBeGreaterThanOrEqual(2);
  });
});
