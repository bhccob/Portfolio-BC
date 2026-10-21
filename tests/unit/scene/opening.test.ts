import { describe, expect, it } from 'vitest';
import { MIST_LOOK } from '~/engine/v3/build/mist';
import { engraved, ON_STROKES, PIN_COUNT, strokeLengths } from '~/engine/v3/chipSpec';
import { type LoaderClock, type LoaderStage, LOADER, loaderAt } from '~/engine/v3/loaderTimeline';
import { type CameraShot, DESIGN_ASPECT, homeShotFor, loaderShotFor, SHOTS } from '~/engine/v3/shots';
import { LOOK } from '~/scene/v3/look';
import {
  cameraShotAt,
  HOME_CLOCK,
  heldClockInput,
  LOAD_SHARES,
  loadShare,
  type OpeningPose,
  openingPoseAt,
  skipsLoader,
  startPathFor,
  tipAt,
} from '~/scene/v3/openingPose';
import type { Phase } from '~/state/machine';

const LANDSCAPE = DESIGN_ASPECT;
const PORTRAIT = 390 / 844;

/** A clock at `stage`, `local` of the way through it; the full path's engraving and pins for that stage. */
function clock(stage: LoaderStage, local = 0): LoaderClock {
  if (stage === 'engrave') return { stage, local, engraving: local, pins: Math.floor(local * PIN_COUNT) };
  if (stage === 'dark') return { stage, local: 0, engraving: 0, pins: 0 };
  return { stage, local, engraving: 1, pins: PIN_COUNT };
}

/** Every number of a shot, in one list: position, target, fov. */
const numbers = (shot: CameraShot): number[] => [...shot.position, ...shot.target, shot.fov];

function expectShot(actual: CameraShot, expected: CameraShot): void {
  numbers(actual).forEach((value, k) => expect(value).toBeCloseTo(numbers(expected)[k], 9));
}

/** True when every number of `shot` lies between the same number of `a` and `b` (inclusive), and it is neither. */
function between(shot: CameraShot, a: CameraShot, b: CameraShot): boolean {
  const s = numbers(shot);
  const x = numbers(a);
  const y = numbers(b);
  const inside = s.every((v, k) => v >= Math.min(x[k], y[k]) - 1e-12 && v <= Math.max(x[k], y[k]) + 1e-12);
  const differs = (other: number[]) => s.some((v, k) => Math.abs(v - other[k]) > 1e-6);
  return inside && differs(x) && differs(y);
}

describe('cameraShotAt', () => {
  for (const [name, aspect] of [['landscape', LANDSCAPE], ['portrait', PORTRAIT]] as const) {
    it(`${name}: engrave gives loaderMacro, framed for the screen`, () => {
      expectShot(cameraShotAt(clock('engrave', 0.4), aspect), loaderShotFor('loaderMacro', aspect));
      expectShot(cameraShotAt(clock('power', 0.7), aspect), loaderShotFor('loaderMacro', aspect));
    });

    it(`${name}: home gives homeShotFor(aspect)`, () => {
      expectShot(cameraShotAt(clock('home'), aspect), homeShotFor(aspect));
      expectShot(cameraShotAt(clock('home'), aspect, true), homeShotFor(aspect));
    });

    it(`${name}: circuit at local 0.5 lies between loaderMacro and loaderRise`, () => {
      expect(between(cameraShotAt(clock('circuit', 0.5), aspect), loaderShotFor('loaderMacro', aspect), loaderShotFor('loaderRise', aspect))).toBe(true);
    });

    it(`${name}: one continuous flight, macro to rise over the circuit and rise to home over the landing`, () => {
      expectShot(cameraShotAt(clock('circuit', 0), aspect), loaderShotFor('loaderMacro', aspect));
      expectShot(cameraShotAt(clock('circuit', 1), aspect), loaderShotFor('loaderRise', aspect));
      expectShot(cameraShotAt(clock('land', 0), aspect), loaderShotFor('loaderRise', aspect));
      expectShot(cameraShotAt(clock('land', 1), aspect), homeShotFor(aspect));
      expect(between(cameraShotAt(clock('land', 0.5), aspect), loaderShotFor('loaderRise', aspect), homeShotFor(aspect))).toBe(true);
    });

    it(`${name}: with reduced motion the landing cuts to the home at its midpoint and never flies`, () => {
      expectShot(cameraShotAt(clock('land', 0.49), aspect, true), loaderShotFor('loaderMacro', aspect));
      expectShot(cameraShotAt(clock('land', 0.5), aspect, true), homeShotFor(aspect));
      expectShot(cameraShotAt(clock('land', 0.9), aspect, true), homeShotFor(aspect));
    });
  }

  it('frames a phone with the portrait loader shots, not the landscape ones', () => {
    const macro = cameraShotAt(clock('engrave', 0.2), PORTRAIT);
    expect(numbers(macro)).not.toEqual(numbers(SHOTS.loaderMacro));
  });

  it("starts the quick path's dark where its landing begins, high over the rings", () => {
    expectShot(cameraShotAt(clock('dark'), LANDSCAPE), loaderShotFor('loaderRise', LANDSCAPE));
  });

  it('eases: the circuit has barely moved a tenth of the way in', () => {
    const macro = loaderShotFor('loaderMacro', LANDSCAPE);
    const rise = loaderShotFor('loaderRise', LANDSCAPE);
    const early = cameraShotAt(clock('circuit', 0.1), LANDSCAPE);
    const share = (early.position[1] - macro.position[1]) / (rise.position[1] - macro.position[1]);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(0.05);
  });
});

describe('openingPoseAt', () => {
  const FULL = { quick: false, reduced: false };
  const REDUCED = { quick: false, reduced: true };
  const QUICK = { quick: true, reduced: false };
  const QUICK_REDUCED = { quick: true, reduced: true };

  /** The home's ground, the same whichever path ran (Ruling 3). */
  const HOME: Partial<OpeningPose> = {
    veil: 0,
    engraving: 1,
    cooled: true,
    pins: PIN_COUNT,
    power: LOOK.home.current,
    rest: LOOK.home.chip,
    traces: 1,
    formed: 1,
    needle: 1,
    city: 1,
    stars: 1,
    mist: MIST_LOOK.home,
  };

  it('lands every path on the same home: the chip dimmed under the hub, ON whole and cool, all 64 pins lit', () => {
    for (const path of [FULL, REDUCED, QUICK, QUICK_REDUCED]) {
      const pose = openingPoseAt(clock('home'), path);
      expect(pose).toMatchObject(HOME);
      expect(pose.laser.shown).toBe(false);
    }
    expect(LOOK.home.chip).toBeLessThan(1);
  });

  it('engraves on the full path: the laser cuts where the clock says, the pins fill, nothing of the compass yet', () => {
    const at = { stage: 'engrave', local: 0.4, engraving: 0.4, pins: 20 } as const;
    const pose = openingPoseAt(at, FULL);
    expect(pose).toMatchObject({ veil: 0, engraving: 0.4, cooled: false, pins: 20, power: 0, rest: 1, traces: 0, formed: 0, needle: null, city: 0, stars: 0, mist: 1 });
    expect(pose.laser).toEqual({ shown: true, on: true, lift: 0, glide: 0 });
  });

  it('powers up, lifts the probe and glides it over the centre, then sets it down there for the needle to grow from', () => {
    const start = openingPoseAt(clock('power', 0), FULL);
    const end = openingPoseAt(clock('power', 1), FULL);
    expect(start.power).toBe(0);
    expect(end.power).toBe(1);
    expect(start.laser).toMatchObject({ shown: true, on: false, lift: 0, glide: 0 });
    expect(end.laser.lift).toBeGreaterThan(0);
    expect(end.laser.glide).toBe(1);
    // The circuit takes over where the power-on leaves off, and ends with the probe standing over the centre.
    expect(openingPoseAt(clock('circuit', 0), FULL).laser).toEqual(end.laser);
    expect(openingPoseAt(clock('circuit', 1), FULL).laser).toMatchObject({ shown: true, lift: 0, glide: 1 });
    // ...where the needle's first form stands, once the landing begins.
    const land = openingPoseAt(clock('land', 0), FULL);
    expect(land.laser.shown).toBe(false);
    expect(land.needle).toBe(0);
  });

  it('keeps the city flat through the close shot and raises it with the circuit', () => {
    expect(openingPoseAt(clock('engrave', 0.9), FULL).city).toBe(0);
    expect(openingPoseAt(clock('power', 1), FULL).city).toBe(0);
    expect(openingPoseAt(clock('circuit', 0), FULL).city).toBe(0);
    const half = openingPoseAt(clock('circuit', 0.5), FULL).city;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(openingPoseAt(clock('circuit', 1), FULL).city).toBe(1);
    expect(openingPoseAt(clock('land', 0), FULL).city).toBe(1);
  });

  it('bends the traces through the circuit and forms the glass only in its second half', () => {
    expect(openingPoseAt(clock('circuit', 0.3), FULL).traces).toBe(0.3);
    expect(openingPoseAt(clock('circuit', 0.5), FULL).formed).toBe(0);
    const late = openingPoseAt(clock('circuit', 0.75), FULL).formed;
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(1);
    expect(openingPoseAt(clock('circuit', 1), FULL).formed).toBe(1);
    expect(openingPoseAt(clock('land', 0), FULL)).toMatchObject({ traces: 1, formed: 1 });
  });

  it('dims the chip to the home over the landing, and lets the constellations in', () => {
    const start = openingPoseAt(clock('land', 0), FULL);
    const end = openingPoseAt(clock('land', 1), FULL);
    expect(start).toMatchObject({ power: 1, rest: 1, stars: 0 });
    expect(end).toMatchObject({ power: LOOK.home.current, rest: LOOK.home.chip, stars: 1, needle: 1 });
  });

  it('thins the mist from 1 to the home over the circuit and the landing, never thickening', () => {
    const stages: [LoaderStage, number][] = [['engrave', 0.5], ['power', 0.5], ['circuit', 0], ['circuit', 0.5], ['circuit', 1], ['land', 0.5], ['land', 1], ['home', 0]];
    const mist = stages.map(([stage, local]) => openingPoseAt(clock(stage, local), FULL).mist);
    expect(mist[0]).toBe(1);
    expect(mist[mist.length - 1]).toBeCloseTo(MIST_LOOK.home, 9);
    for (let k = 1; k < mist.length; k++) expect(mist[k]).toBeLessThanOrEqual(mist[k - 1] + 1e-12);
  });

  it('reduced: a static engraved ON with the pins filling, no laser at all, then a dip through the night', () => {
    const still = openingPoseAt({ stage: 'engrave', local: 0.3, engraving: 1, pins: 19 }, REDUCED);
    expect(still).toMatchObject({ engraving: 1, cooled: true, pins: 19, formed: 0, needle: null, veil: 0 });
    expect(still.laser.shown).toBe(false);
    const dip = [0, 0.25, 0.5, 0.75, 1].map((local) => openingPoseAt({ stage: 'land', local, engraving: 1, pins: PIN_COUNT }, REDUCED));
    expect(dip.map((pose) => pose.veil)).toEqual([0, expect.any(Number), 1, expect.any(Number), 0]);
    expect(dip[1].veil).toBeGreaterThan(0);
    expect(dip[3].veil).toBeGreaterThan(0);
    // Under the night the chip's pose gives way to the home's, in one cut.
    expect(dip[1]).toMatchObject({ formed: 0, needle: null });
    expect(dip[3]).toMatchObject({ formed: 1, needle: 1, traces: 1, rest: LOOK.home.chip });
    for (const pose of dip) expect(pose.laser.shown).toBe(false);
  });

  it('quick: the dark is the night, and the landing lifts it', () => {
    expect(openingPoseAt(clock('dark'), QUICK).veil).toBe(1);
    const lifting = [0, 0.5, 1].map((local) => openingPoseAt({ stage: 'land', local, engraving: 0, pins: 0 }, QUICK).veil);
    expect(lifting[0]).toBe(1);
    expect(lifting[1]).toBeGreaterThan(0);
    expect(lifting[1]).toBeLessThan(1);
    expect(lifting[2]).toBe(0);
    // Under the night and through the landing, the quick path already shows the home's ground (Ruling 3).
    expect(openingPoseAt({ stage: 'land', local: 0.5, engraving: 0, pins: 0 }, QUICK)).toMatchObject({ ...HOME, veil: lifting[1] });
  });

  it('quick with reduced motion: the night holds to the midpoint, then lifts', () => {
    const veil = (local: number) => openingPoseAt({ stage: 'land', local, engraving: 0, pins: 0 }, QUICK_REDUCED).veil;
    expect(veil(0)).toBe(1);
    expect(veil(0.4)).toBe(1);
    expect(veil(0.75)).toBeGreaterThan(0);
    expect(veil(0.75)).toBeLessThan(1);
    expect(veil(1)).toBe(0);
  });

  it('poses every moment of a real full run with finite numbers', () => {
    for (let elapsed = 0; elapsed < 8; elapsed += 0.05) {
      const at = loaderAt({ elapsed, shown: Math.min(1, elapsed / 3), loadedAt: elapsed >= 3 ? 3 : null, quick: false, reduced: false });
      const pose = openingPoseAt(at, FULL);
      for (const value of [pose.veil, pose.engraving, pose.power, pose.rest, pose.traces, pose.formed, pose.city, pose.stars, pose.mist, pose.laser.lift, pose.laser.glide]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    expect(LOADER.engraveMin).toBeLessThan(3);
  });
});

describe('tipAt', () => {
  it('starts at the top of the O and ends at the top of the N', () => {
    expect(tipAt(0)).toEqual(ON_STROKES[0].points[0]);
    const last = ON_STROKES[ON_STROKES.length - 1].points;
    expect(tipAt(1)).toEqual(last[last.length - 1]);
  });

  it("follows the stroke being cut: half way along the N's diagonal when the cut is there", () => {
    const lengths = strokeLengths(ON_STROKES);
    const total = lengths.reduce((a, b) => a + b, 0);
    const t = (lengths[0] + lengths[1] + lengths[2] / 2) / total;
    expect(engraved(ON_STROKES, t)[2]).toBeCloseTo(0.5, 9);
    const [x, z] = tipAt(t);
    const [from, to] = ON_STROKES[2].points;
    expect(x).toBeCloseTo((from[0] + to[0]) / 2, 9);
    expect(z).toBeCloseTo((from[1] + to[1]) / 2, 9);
  });

  it('reads NaN and out-of-range shares as held to 0..1', () => {
    expect(tipAt(Number.NaN)).toEqual(tipAt(0));
    expect(tipAt(-2)).toEqual(tipAt(0));
    expect(tipAt(7)).toEqual(tipAt(1));
  });
});

describe('the load shares', () => {
  it('weighs the painted masks 0.6 and the warmed home 0.4, whole at exactly 1', () => {
    expect(LOAD_SHARES).toEqual({ paint: 0.6, warm: 0.4 });
    expect(loadShare({ paint: false, warm: false })).toBe(0);
    expect(loadShare({ paint: true, warm: false })).toBeCloseTo(0.6, 12);
    expect(loadShare({ paint: true, warm: true })).toBe(1);
  });
});

describe('the held clock (seekLoader, Ruling 2)', () => {
  const FULL = { quick: false, reduced: false };
  const E = LOADER.engraveMin;
  const held = (seconds: number, path = FULL): LoaderClock => loaderAt(heldClockInput(seconds, path));

  it('fakes a load that fills in step with the engraving, whole at the least engraving time', () => {
    expect(heldClockInput(0.6, FULL)).toEqual({ elapsed: 0.6, shown: 0.6 / E, loadedAt: E, quick: false, reduced: false });
    expect(heldClockInput(E, FULL).shown).toBe(1);
    expect(heldClockInput(9, FULL).shown).toBe(1);
    expect(heldClockInput(0, FULL).shown).toBe(0);
    expect(heldClockInput(1, { quick: true, reduced: true })).toMatchObject({ quick: true, reduced: true });
  });

  it("shows the pins filling with the engraving, not a finished load's 64 at an early moment", () => {
    for (const seconds of [0.6, 1.6]) {
      const at = held(seconds);
      expect(at.stage).toBe('engrave');
      expect(at.engraving).toBeCloseTo(seconds / E, 12);
      expect(at.pins).toBe(loaderAt({ elapsed: seconds, shown: seconds / E, loadedAt: null, quick: false, reduced: false }).pins);
      expect(at.pins).toBeGreaterThan(0);
      expect(at.pins).toBeLessThan(PIN_COUNT);
    }
    expect(held(0.6).pins).toBeLessThan(held(1.6).pins);
  });

  it("lands each of Task 14's still moments in the stage it is named for, and the end at home", () => {
    expect(held(E + 0.4).stage).toBe('power');
    expect(held(E + LOADER.power + 0.8).stage).toBe('circuit');
    expect(held(E + LOADER.power + LOADER.circuit + 0.7).stage).toBe('land');
    expect(held(E + LOADER.power + LOADER.circuit + LOADER.land).stage).toBe('home');
    expect(held(60).stage).toBe('home');
  });

  it("takes the visit's own path: a quick visit's held moments are the night, then its landing", () => {
    const QUICK = { quick: true, reduced: false };
    expect(held(1, QUICK).stage).toBe('dark');
    expect(held(E + LOADER.quick / 2, QUICK).stage).toBe('land');
    expect(held(E + LOADER.quick, QUICK).stage).toBe('home');
  });
});

describe('where an opening starts (Ruling 9c)', () => {
  const KINDS: Phase['kind'][] = ['LOADING', 'HOME_IDLE', 'FOCUS_COUNTRY', 'COUNTRY_PAGE', 'DISSECT', 'MORPH', 'VOID_ENTRY', 'PROJECTS', 'PROJECT_FOCUS'];

  it('plays the loader while the page is loading, on the path the visit and the visitor ask for', () => {
    expect(startPathFor('LOADING', false, false)).toEqual({ skip: false, path: { quick: false, reduced: false } });
    expect(startPathFor('LOADING', true, false)).toEqual({ skip: false, path: { quick: true, reduced: false } });
    expect(startPathFor('LOADING', false, true)).toEqual({ skip: false, path: { quick: false, reduced: true } });
  });

  it('goes straight to the home once the home page has left LOADING: its hero shows, so no loader replays under it', () => {
    for (const seen of [false, true]) {
      for (const reduced of [false, true]) {
        expect(startPathFor('HOME_IDLE', seen, reduced)).toEqual({ skip: true, path: { quick: seen, reduced } });
      }
    }
    for (const kind of ['FOCUS_COUNTRY', 'DISSECT', 'MORPH', 'VOID_ENTRY', 'PROJECTS'] as const) expect(skipsLoader(kind), kind).toBe(true);
  });

  it("still plays it on a country or project page, where it runs under the page's scrim as a direct arrival does", () => {
    expect(skipsLoader('COUNTRY_PAGE')).toBe(false);
    expect(skipsLoader('PROJECT_FOCUS')).toBe(false);
    expect(skipsLoader('LOADING')).toBe(false);
    // Every phase has an answer.
    expect(KINDS.filter(skipsLoader)).toEqual(['HOME_IDLE', 'FOCUS_COUNTRY', 'DISSECT', 'MORPH', 'VOID_ENTRY', 'PROJECTS']);
  });

  it('starts a skipped opening on a clock already at home, all its pins lit, posed as every path lands', () => {
    expect(HOME_CLOCK).toEqual({ stage: 'home', local: 0, engraving: 1, pins: PIN_COUNT });
    expect(Object.isFrozen(HOME_CLOCK)).toBe(true);
    const FULL = { quick: false, reduced: false };
    const landed = loaderAt({ elapsed: 99, shown: 1, loadedAt: 1, quick: false, reduced: false });
    expect(openingPoseAt(HOME_CLOCK, FULL)).toEqual(openingPoseAt(landed, FULL));
  });
});
