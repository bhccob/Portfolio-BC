import { describe, expect, it } from 'vitest';
import { easeInOutQuart } from '~/input/scrollLoop';
import { circleFor, easeInOutQuartInverse, flightSpeed, flightTravel, starDepth, WAY_OUT, wayOutAt } from '~/scene/bob/wayOut';

/** The Q&A's marks: six questions and the end's. */
const MARKS = 7;
/** The place in the Q&A at `s` seconds of the blueprint (from -1) or of the flight (from 5), as the scroll's turn plays it. */
const inBlueprint = (s: number): number => -1 + easeInOutQuart(s / WAY_OUT.blueprint);
const inFlight = (s: number): number => 5 + easeInOutQuart(s / WAY_OUT.flight);

describe('easeInOutQuartInverse: the turn eased in and out, turned back to its time', () => {
  it('gives back the share of time for each share of the way', () => {
    for (const x of [0, 0.05, 0.2, 0.37, 0.5, 0.61, 0.8, 0.97, 1]) expect(easeInOutQuartInverse(easeInOutQuart(x))).toBeCloseTo(x, 9);
    expect(easeInOutQuartInverse(-1)).toBe(0);
    expect(easeInOutQuartInverse(2)).toBe(1);
  });
});

describe('wayOutAt: the mock-up\'s clock and every stage, from the place in the Q&A', () => {
  it('is the floor before the door and at it: nothing drawn, the scene whole', () => {
    for (const p of [null, -1]) {
      const v = wayOutAt(p, MARKS);
      expect(v.stretch).toBe('floor');
      expect([v.dark, v.lines, v.fly, v.panel, v.skyIn, v.circleIn]).toEqual([0, 0, 0, 0, 0, 0]);
    }
  });

  it('plays the blueprint on the mock-up\'s own clock, whatever the turn\'s ease', () => {
    for (const s of [0.5, 1.6, 3.1, 4.9, 6]) {
      const v = wayOutAt(inBlueprint(s), MARKS);
      expect(v.stretch).toBe('blueprint');
      expect(v.s).toBeCloseTo(s, 6);
    }
  });

  it('draws the lines from 0.8 s down the screen, darkens the scene from 1.6 s, all dark by 3.6 s as the lines go', () => {
    const at = (s: number) => wayOutAt(inBlueprint(s), MARKS);
    expect([at(0.7).lines, at(0.7).sweep, at(0.7).dark]).toEqual([0, 0, 0]);
    expect(at(1.2).lines).toBeCloseTo(0.55, 6);
    expect(at(2.2).sweep).toBeCloseTo(1, 6);
    expect(at(1.5).dark).toBe(0);
    expect(at(2.4).dark).toBeCloseTo(0.8, 6);
    expect(at(3.6).dark).toBeCloseTo(1, 6);
    expect(at(3.6).lines).toBeCloseTo(0, 6);
  });

  it('sends the sparks off from 2.8 s to 5 s, rests the stars by 5.6 s, the panel in from 4.9 s over 0.8 s, the circle by 6.2 s', () => {
    const at = (s: number) => wayOutAt(inBlueprint(s), MARKS);
    expect(at(2.7).fly).toBe(0);
    expect(at(3.9).fly).toBeCloseTo(0.5, 6);
    expect(at(5.0).fly).toBeCloseTo(1, 6);
    expect(at(5.6).skyRest).toBeCloseTo(1, 6);
    expect(at(4.8).panel).toBe(0);
    expect(at(5.3).panel).toBeCloseTo(0.5, 6);
    expect(at(5.7).panel).toBeCloseTo(1, 6);
    expect(at(6.2).circleIn).toBeCloseTo(1, 6);
    expect(at(6.2).frameFade).toBeCloseTo(0, 6);
    expect(at(6).share).toBeCloseTo(1 / 7, 9);
  });

  it('closes the circle a seventh a question, the end\'s mark the last', () => {
    for (let k = 0; k <= 5; k++) {
      const v = wayOutAt(k, MARKS);
      expect(v.stretch).toBe('qa');
      expect(v.share).toBeCloseTo((k + 1) / 7, 9);
      expect([v.dark, v.panel, v.skyIn, v.circleIn, v.past]).toEqual([1, 1, 1, 1, 0]);
    }
    expect(wayOutAt(2.5, MARKS).share).toBeCloseTo(3.5 / 7, 9);
  });

  it('flies on the mock-up\'s clock: the list away by 1.1 s, the light to the circle\'s head and round it by 1.6 s, the end\'s words from 2.8 s', () => {
    const at = (s: number) => wayOutAt(inFlight(s), MARKS);
    expect(at(1).stretch).toBe('flight');
    expect(at(1).s).toBeCloseTo(1, 6);
    expect(at(0.1).lightFly).toBe(0);
    expect(at(0.9).lightFly).toBeCloseTo(1, 6);
    expect(at(1.6).round).toBeCloseTo(1, 6);
    expect(at(1.6).share).toBeCloseTo(1, 6);
    expect(at(0.9).share).toBeCloseTo(6 / 7, 6);
    expect(at(1.1).past).toBeCloseTo(1, 6);
    expect(at(0.8).panel).toBeCloseTo(0, 6);
    expect(at(2.7).endOn).toBe(false);
    expect(at(2.9).endOn).toBe(true);
    expect(at(3).markRing).toBe(0);
    expect(at(4.8).markRing).toBeCloseTo(1, 6);
  });

  it('is the end at the end\'s mark: the end\'s words on, the flight over', () => {
    const v = wayOutAt(6, MARKS);
    expect(v.stretch).toBe('end');
    expect([v.endOn, v.markRing, v.past, v.panel]).toEqual([true, 1, 1, 0]);
    expect(v.s).toBe(WAY_OUT.flight);
  });
});

describe('the flight\'s speed and how far it has come', () => {
  it('sets off after the circle closes, flies fastest from 2.6 s to 3 s, and slows to a drift by 4.8 s (the mock-up\'s SPEED)', () => {
    expect(flightSpeed(1.5)).toBe(0);
    expect(flightSpeed(2.8)).toBe(1.6);
    expect(flightSpeed(4.8)).toBeCloseTo(0.03, 9);
  });

  it('is the speed added up: none before 1.6 s, then always on, 2.429 by the end', () => {
    expect(flightTravel(1.6)).toBe(0);
    expect(flightTravel(2.6)).toBeCloseTo(1.6 * (9 / 14), 9);
    expect(flightTravel(3)).toBeCloseTo(1.6 * (9 / 14) + 0.64, 9);
    expect(flightTravel(4.8)).toBeCloseTo(1.6 * (9 / 14) + 0.64 + 0.7605, 9);
    // The sum of small steps, as the mock-up's frames added it.
    let sum = 0;
    for (let s = 0; s < 4.8; s += 1e-4) sum += flightSpeed(s + 5e-5) * 1e-4;
    expect(flightTravel(4.8)).toBeCloseTo(sum, 4);
  });

  it('takes the circle past the camera as the flight peaks', () => {
    expect(wayOutAt(inFlight(1.6), MARKS).ringZ).toBe(1);
    expect(wayOutAt(inFlight(2.4), MARKS).ringZ).toBeLessThan(0.5);
    expect(wayOutAt(inFlight(3), MARKS).ringZ).toBe(0.02);
  });
});

describe('starDepth: a star of the flight, flown past and come round again far ahead', () => {
  it('comes nearer as the flight goes on, never nearer than the camera\'s plane', () => {
    expect(starDepth(1, 0, 3)).toEqual({ z: 1, again: false });
    expect(starDepth(2, 0.5, 3).z).toBeCloseTo(1.5, 12);
    for (let travel = 0; travel <= 2.43; travel += 0.01) {
      const d = starDepth(1.1, travel, 7);
      expect(d.z).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('comes round again between 1.8 and 3.2 ahead once it is past, and goes on from there with the flight', () => {
    const before = starDepth(1, 0.9, 5);
    const after = starDepth(1, 0.95, 5);
    expect(before.again).toBe(false);
    expect(after.again).toBe(true);
    expect(after.z).toBeGreaterThan(1.7);
    expect(after.z).toBeLessThanOrEqual(3.2);
    expect(starDepth(1, 1.05, 5).z).toBeCloseTo(after.z - 0.1, 12);
  });
});

describe('circleFor: where the circle stands on a screen', () => {
  it('stands round the middle of a laptop, 360 px at 1440x900, as the mock-up', () => {
    expect(circleFor({ width: 1440, height: 900 })).toEqual({ x: 720, y: 450, r: 360 });
    expect(circleFor({ width: 1920, height: 1080 })).toEqual({ x: 960, y: 540, r: 432 });
  });

  it('stands higher and smaller on a phone, clear of the list at the bottom', () => {
    const c = circleFor({ width: 390, height: 844 });
    expect(c.x).toBe(195);
    expect(c.y).toBeLessThan(844 * 0.35);
    expect(c.r).toBeLessThan(195);
    expect(c.y - c.r).toBeGreaterThan(60);
  });
});
