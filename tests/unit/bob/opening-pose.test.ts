import { describe, expect, it } from 'vitest';
import { NEEDLE_REST, settleAngle } from '~/engine/bob/needle';
import { TRACES_LOOK } from '~/engine/bob/build/traces';
import { HOLD_AT, type LoaderClock, loaderAt, type LoaderPath, QUICK, SCRIPT } from '~/engine/bob/loaderTimeline';
import { PROBE, probeAt } from '~/engine/bob/probePath';
import { FRAMES, homeShotFor, shotFor, wideShotFor } from '~/engine/bob/shots';
import { cameraShotAt, ease, HOME_POSE, LOAD_SHARES, loadShare, openingPoseAt } from '~/scene/bob/openingPose';

/** The full path's clock `t` visible seconds in, for a load that landed at 0.1 s (so nothing holds the script). */
const clockAt = (t: number, skipAt: number | null = null): LoaderClock => loaderAt({ elapsed: t, loadedAt: 0.1, skipAt, path: 'full' });
/** The quick path's clock `q` seconds after the load. */
const quickClock = (q: number): LoaderClock => loaderAt({ elapsed: 1 + q, loadedAt: 1, skipAt: null, path: 'quick' });
/** The reduced path's clock `q` seconds after the load. */
const reducedClock = (q: number): LoaderClock => loaderAt({ elapsed: 1 + q, loadedAt: 1, skipAt: null, path: 'reduced' });

/** The distance from the camera to what it looks at. */
const standOff = (shot: { position: readonly number[]; target: readonly number[] }): number =>
  Math.hypot(shot.position[0] - shot.target[0], shot.position[1] - shot.target[1], shot.position[2] - shot.target[2]);

const WIDE = 16 / 9;
const PHONE = 390 / 844;

describe('the camera on the full path', () => {
  it('frames the whole name until the push-in, then lands on the home shot', () => {
    expect(cameraShotAt(clockAt(5), 'full', 16 / 9)).toEqual(wideShotFor(16 / 9));
    expect(cameraShotAt(clockAt(12.5), 'full', 16 / 9)).toEqual(homeShotFor(16 / 9));
  });

  it('holds the wide shot up to the second the push-in starts, and not a frame longer', () => {
    expect(cameraShotAt(clockAt(0), 'full', WIDE)).toEqual(wideShotFor(WIDE));
    expect(cameraShotAt(clockAt(SCRIPT.camera.start), 'full', WIDE)).toEqual(wideShotFor(WIDE));
    expect(cameraShotAt(clockAt(SCRIPT.camera.start + 0.2), 'full', WIDE)).not.toEqual(wideShotFor(WIDE));
  });

  it('is on the home shot when the push-in ends, exactly', () => {
    expect(cameraShotAt(clockAt(SCRIPT.camera.end), 'full', WIDE)).toEqual(homeShotFor(WIDE));
    expect(cameraShotAt(clockAt(SCRIPT.camera.end), 'full', PHONE)).toEqual(homeShotFor(PHONE));
  });

  it('eases in the middle: the camera is half way at the half, and has hardly left the wide shot at the start', () => {
    const wide = wideShotFor(WIDE);
    const home = homeShotFor(WIDE);
    const half = cameraShotAt(clockAt((SCRIPT.camera.start + SCRIPT.camera.end) / 2), 'full', WIDE);
    expect(half.fov).toBeCloseTo((wide.fov + home.fov) / 2, 9);
    expect(half.position[2]).toBeCloseTo((wide.position[2] + home.position[2]) / 2, 9);

    const first = cameraShotAt(clockAt(SCRIPT.camera.start + 0.05), 'full', WIDE);
    expect(Math.abs(first.position[2] - wide.position[2])).toBeLessThan(0.001 * Math.abs(home.position[2] - wide.position[2]));
  });

  it('comes in monotonically from the wide to the home', () => {
    let last = standOff(wideShotFor(WIDE));
    for (let t = SCRIPT.camera.start; t < SCRIPT.camera.end; t += 0.1) {
      const now = standOff(cameraShotAt(clockAt(t), 'full', WIDE));
      expect(now).toBeLessThanOrEqual(last + 1e-12);
      last = now;
    }
    const landed = standOff(cameraShotAt(clockAt(SCRIPT.camera.end), 'full', WIDE));
    expect(landed).toBeLessThanOrEqual(last + 1e-12);
    expect(landed).toBeCloseTo(standOff(homeShotFor(WIDE)), 9);
  });

  it('frames a portrait screen by its own wide and home shots', () => {
    expect(cameraShotAt(clockAt(5), 'full', PHONE)).toEqual(wideShotFor(PHONE));
    expect(cameraShotAt(clockAt(12.5), 'full', PHONE)).toEqual(homeShotFor(PHONE));
  });

  it('is the clock and the screen alone: the same moment is the same shot', () => {
    expect(cameraShotAt(clockAt(10), 'full', WIDE)).toEqual(cameraShotAt(clockAt(10), 'full', WIDE));
    expect(cameraShotAt(clockAt(10), 'full', WIDE)).not.toEqual(cameraShotAt(clockAt(10), 'full', PHONE));
  });
});

describe('the camera on the quick path', () => {
  it('starts at 1.08 times the home distance and settles on the home', () => {
    const start = shotFor({ ...FRAMES.home, distance: FRAMES.home.distance * 1.08 }, WIDE);
    expect(cameraShotAt(quickClock(-1), 'quick', WIDE)).toEqual(start);
    expect(cameraShotAt(quickClock(0), 'quick', WIDE)).toEqual(start);
    expect(standOff(start)).toBeCloseTo(standOff(homeShotFor(WIDE)) * 1.08, 9);
    expect(cameraShotAt(quickClock(QUICK.camera.end), 'quick', WIDE)).toEqual(homeShotFor(WIDE));
    expect(cameraShotAt(quickClock(QUICK.home), 'quick', WIDE)).toEqual(homeShotFor(WIDE));
  });

  it('comes in monotonically over the camera span', () => {
    let last = Infinity;
    for (let q = 0; q <= QUICK.camera.end + 1e-9; q += 0.1) {
      const now = standOff(cameraShotAt(quickClock(q), 'quick', WIDE));
      expect(now).toBeLessThanOrEqual(last + 1e-12);
      last = now;
    }
  });

  it('eases: half way through the span it is half way in', () => {
    const start = shotFor({ ...FRAMES.home, distance: FRAMES.home.distance * 1.08 }, WIDE);
    const home = homeShotFor(WIDE);
    const half = cameraShotAt(quickClock(QUICK.camera.end / 2), 'quick', WIDE);
    expect(half.position[2]).toBeCloseTo((start.position[2] + home.position[2]) / 2, 9);
    expect(half.fov).toBeCloseTo((start.fov + home.fov) / 2, 9);
  });

  it('starts from the frame the home shot picks: a square screen is a laptop for it', () => {
    const start = cameraShotAt(quickClock(0), 'quick', 1);
    expect(start).toEqual(shotFor({ ...FRAMES.home, distance: FRAMES.home.distance * 1.08 }, 1));
    expect(cameraShotAt(quickClock(QUICK.home), 'quick', 1)).toEqual(homeShotFor(1));
  });

  it('starts from the portrait frame on a screen taller than wide', () => {
    const start = cameraShotAt(quickClock(0), 'quick', PHONE);
    expect(start).toEqual(shotFor({ ...FRAMES.homePortrait, distance: FRAMES.homePortrait.distance * 1.08 }, PHONE));
    expect(cameraShotAt(quickClock(QUICK.home), 'quick', PHONE)).toEqual(homeShotFor(PHONE));
  });
});

describe('the camera on the reduced path', () => {
  it('never flies: the home shot throughout', () => {
    for (const t of [0, 0.5, 1]) expect(cameraShotAt(reducedClock(t), 'reduced', 16 / 9)).toEqual(homeShotFor(16 / 9));
  });

  it('is the home shot before the load too, and on every screen', () => {
    for (const aspect of [WIDE, 1, PHONE]) {
      expect(cameraShotAt(reducedClock(-1), 'reduced', aspect)).toEqual(homeShotFor(aspect));
      expect(cameraShotAt(reducedClock(0.5), 'reduced', aspect)).toEqual(homeShotFor(aspect));
    }
  });
});

describe('the needle', () => {
  it('settles the needle on its rest', () => {
    expect(settleAngle(1)).toBeCloseTo(NEEDLE_REST + 1.92 * Math.exp(-4) * Math.cos(9), 9);
    expect(Math.abs(settleAngle(1) - NEEDLE_REST)).toBeLessThan(0.04);
  });

  it('rests at 38 degrees and swings in from 110 degrees past it', () => {
    expect(NEEDLE_REST).toBeCloseTo((38 * Math.PI) / 180, 12);
    expect(((settleAngle(0) - NEEDLE_REST) * 180) / Math.PI).toBeCloseTo(110, 1);
  });

  it('swings through the rest and back, each swing smaller than the last', () => {
    // cos(9t) is zero at t = pi/18, 3pi/18, ...: the needle is on the rest there, and the extremes between are the damped swings.
    expect(settleAngle(Math.PI / 18)).toBeCloseTo(NEEDLE_REST, 9);
    const peaks = [0, Math.PI / 9, (2 * Math.PI) / 9].map((t) => Math.abs(settleAngle(t) - NEEDLE_REST));
    expect(peaks[0]).toBeGreaterThan(peaks[1]);
    expect(peaks[1]).toBeGreaterThan(peaks[2]);
    expect(settleAngle(Math.PI / 18 + 0.05)).toBeLessThan(NEEDLE_REST); // past the rest, to the other side
  });

  it('reads a time before the swing, or a NaN, as the swing starting', () => {
    expect(settleAngle(-3)).toBe(settleAngle(0));
    expect(settleAngle(Number.NaN)).toBe(settleAngle(0));
  });
});

describe('the easing', () => {
  it('is Perlin smootherstep: 0 at 0, 1 at 1, 0.5 at the half, and flat at both ends', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 12);
    expect(ease(0.01)).toBeLessThan(1e-4);
    expect(1 - ease(0.99)).toBeLessThan(1e-4);
  });

  it('is held to 0..1, and reads a NaN as 0', () => {
    expect(ease(-2)).toBe(0);
    expect(ease(3)).toBe(1);
    expect(ease(Number.NaN)).toBe(0);
  });

  it('only rises', () => {
    let last = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      expect(ease(t)).toBeGreaterThanOrEqual(last);
      last = ease(t);
    }
  });
});

describe('the pose on the full path', () => {
  it('hands the builders the shares the clock holds', () => {
    for (const t of [0.4, 2, 5, 7, 9, 9.7, 10.4, 11.2, 12]) {
      const clock = clockAt(t);
      const pose = openingPoseAt(clock, 'full');
      expect(pose.strokes).toEqual(clock.strokes);
      expect(pose.ticks).toBe(clock.ticks);
      expect(pose.outer).toBe(clock.outer);
      expect(pose.iris).toBe(clock.iris);
      expect(pose.wellGlow).toBe(clock.glow);
      expect(pose.rise).toBe(clock.rise);
      expect(pose.needleSettle).toBe(clock.settle);
    }
  });

  it('poses the probe as the probe path has it', () => {
    for (const t of [0.4, 2, 5, 7, 9, 9.7, 10.4, 12]) {
      const clock = clockAt(t);
      expect(openingPoseAt(clock, 'full').probe).toEqual(probeAt(clock));
    }
  });

  it('shows the compass whole from the first frame: it is hidden by the glass, not by a fade', () => {
    for (const t of [0, 0.2, 0.5, 3, 12]) expect(openingPoseAt(clockAt(t), 'full').reveal).toBe(1);
  });

  it('settles the needle by the settle share of the clock', () => {
    expect(openingPoseAt(clockAt(SCRIPT.settle.start - 0.1), 'full').needleSettle).toBe(0);
    expect(openingPoseAt(clockAt((SCRIPT.settle.start + SCRIPT.settle.end) / 2), 'full').needleSettle).toBeCloseTo(0.5, 9);
    expect(openingPoseAt(clockAt(SCRIPT.settle.end), 'full').needleSettle).toBe(1);
  });

  it('rises from the black: the traces start at nothing and reach 0.09 as the descent ends', () => {
    expect(openingPoseAt(clockAt(0), 'full').traces).toBe(0);
    expect(openingPoseAt(clockAt(SCRIPT.descend.end), 'full').traces).toBeCloseTo(0.09, 12);
    expect(openingPoseAt(clockAt(SCRIPT.descend.end), 'full').traces).toBe(TRACES_LOOK.level);
    expect(openingPoseAt(clockAt(SCRIPT.descend.end + 5), 'full').traces).toBeCloseTo(0.09, 12);
    expect(openingPoseAt(clockAt((SCRIPT.descend.start + SCRIPT.descend.end) / 2), 'full').traces).toBeCloseTo(0.045, 9);
  });

  it('never lets the traces rise above 0.09 or fall back', () => {
    let last = 0;
    for (let t = 0; t <= 13; t += 0.05) {
      const traces = openingPoseAt(clockAt(t), 'full').traces;
      expect(traces).toBeGreaterThanOrEqual(last - 1e-12);
      expect(traces).toBeLessThanOrEqual(0.09 + 1e-12);
      last = traces;
    }
  });

  it('thickens the smoke from 0 to 1 over the first 2.5 seconds', () => {
    expect(openingPoseAt(clockAt(0), 'full').smoke).toBe(0);
    expect(openingPoseAt(clockAt(1.25), 'full').smoke).toBeCloseTo(0.5, 9);
    expect(openingPoseAt(clockAt(2.5), 'full').smoke).toBe(1);
    expect(openingPoseAt(clockAt(9), 'full').smoke).toBe(1);
    let last = 0;
    for (let t = 0; t <= 3; t += 0.05) {
      const smoke = openingPoseAt(clockAt(t), 'full').smoke;
      expect(smoke).toBeGreaterThanOrEqual(last - 1e-12);
      last = smoke;
    }
  });

  it('keeps the smoke at 1 while the load holds the script, and the engraving lit', () => {
    // the load lands late: the script waits at HOLD_AT, long after the smoke is up
    const held = loaderAt({ elapsed: HOLD_AT + 6, loadedAt: HOLD_AT + 8, skipAt: null, path: 'full' });
    expect(openingPoseAt(held, 'full').smoke).toBe(1);
    expect(openingPoseAt(held, 'full').engraveGlow).toBe(1);
  });

  it('lights the engraving as the first stroke starts to be cut', () => {
    expect(openingPoseAt(clockAt(0), 'full').engraveGlow).toBe(0);
    expect(openingPoseAt(clockAt(SCRIPT.leftB.start), 'full').engraveGlow).toBe(1);
    expect(openingPoseAt(clockAt(SCRIPT.leftB.start + 1), 'full').engraveGlow).toBe(1);
  });

  it('follows a skip as it follows any script: the pose is a function of the clock', () => {
    const skipped = clockAt(5, 4.5);
    expect(openingPoseAt(skipped, 'full').probe).toEqual(probeAt(skipped));
    expect(openingPoseAt(skipped, 'full').strokes).toEqual(skipped.strokes);
  });
});

describe('the pose on the quick and reduced paths', () => {
  const paths: [LoaderPath, (q: number) => LoaderClock][] = [
    ['quick', quickClock],
    ['reduced', reducedClock]
  ];

  it('fades the compass and the engraving in by the fade of the clock', () => {
    for (const [path, clockFor] of paths) {
      for (const q of [-1, 0, 0.2, 0.4, 0.6, 1]) {
        const clock = clockFor(q);
        const pose = openingPoseAt(clock, path);
        expect(pose.reveal, `${path} ${q}`).toBe(clock.fade);
        expect(pose.engraveGlow, `${path} ${q}`).toBe(clock.fade);
      }
    }
    expect(openingPoseAt(quickClock(0.4), 'quick').reveal).toBeCloseTo(0.5, 9);
    expect(openingPoseAt(reducedClock(0.5), 'reduced').reveal).toBeCloseTo(0.5, 9);
  });

  it('has the marks cut, the probe away and the smoke up from the first frame', () => {
    for (const [path, clockFor] of paths) {
      for (const q of [-1, 0, 0.3, 1]) {
        const pose = openingPoseAt(clockFor(q), path);
        expect(pose.strokes).toEqual([1, 1, 1, 1, 1]);
        expect(pose.ticks).toBe(1);
        expect(pose.outer).toBe(1);
        expect(pose.probe).toEqual({ x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false });
        expect(pose.smoke).toBe(1);
      }
    }
  });

  it('brings the traces up with the fade, and the opening, the light and the rise by their own shares', () => {
    const clock = quickClock(0.4);
    const pose = openingPoseAt(clock, 'quick');
    expect(pose.traces).toBeCloseTo(0.09 * ease(0.5), 9);
    expect(pose.iris).toBe(clock.iris);
    expect(pose.wellGlow).toBe(clock.glow);
    expect(pose.rise).toBe(clock.rise);
    expect(pose.needleSettle).toBe(clock.settle);
  });
});

describe('the home pose', () => {
  it('poses the home as every path lands on it', () => {
    expect(openingPoseAt(clockAt(12.5), 'full')).toEqual(HOME_POSE);
    expect(openingPoseAt(quickClock(2.5), 'quick')).toEqual(HOME_POSE);
  });

  it('is the home on the reduced path too, and when a skip or a late load ends the full one', () => {
    expect(openingPoseAt(reducedClock(1), 'reduced')).toEqual(HOME_POSE);
    expect(openingPoseAt(clockAt(40), 'full')).toEqual(HOME_POSE);
    expect(openingPoseAt(clockAt(6, 5), 'full')).toEqual(HOME_POSE);
    expect(openingPoseAt(loaderAt({ elapsed: HOLD_AT + 20, loadedAt: HOLD_AT + 3, skipAt: null, path: 'full' }), 'full')).toEqual(HOME_POSE);
  });

  it('has everything cut, open and risen', () => {
    expect(HOME_POSE.strokes).toEqual([1, 1, 1, 1, 1]);
    expect(HOME_POSE).toMatchObject({
      ticks: 1,
      outer: 1,
      engraveGlow: 1,
      traces: TRACES_LOOK.level,
      iris: 1,
      wellGlow: 1,
      rise: 1,
      reveal: 1,
      needleSettle: 1,
      smoke: 1
    });
    expect(HOME_POSE.probe).toEqual({ x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false });
  });

  it('is the pose the probe path and the timeline give at the home', () => {
    expect(HOME_POSE.probe).toEqual(probeAt(clockAt(12.5)));
    const home = clockAt(12.5);
    expect(HOME_POSE.strokes).toEqual(home.strokes);
    expect(HOME_POSE.needleSettle).toBe(home.settle);
  });

  it('cannot be changed by the code that reads it', () => {
    expect(Object.isFrozen(HOME_POSE)).toBe(true);
    expect(Object.isFrozen(HOME_POSE.strokes)).toBe(true);
    expect(Object.isFrozen(HOME_POSE.probe)).toBe(true);
  });

  it('is not the pose of any moment before the home', () => {
    expect(openingPoseAt(clockAt(5), 'full')).not.toEqual(HOME_POSE);
    expect(openingPoseAt(quickClock(1), 'quick')).not.toEqual(HOME_POSE);
    expect(openingPoseAt(reducedClock(0.5), 'reduced')).not.toEqual(HOME_POSE);
  });
});

describe('the load shares', () => {
  it('weighs the two parts of the load of the home and makes whole of them', () => {
    expect(LOAD_SHARES).toEqual({ paint: 0.6, warm: 0.4 });
    expect(loadShare({ paint: false, warm: false })).toBe(0);
    expect(loadShare({ paint: true, warm: false })).toBeCloseTo(0.6, 12);
    expect(loadShare({ paint: false, warm: true })).toBeCloseTo(0.4, 12);
    expect(loadShare({ paint: true, warm: true })).toBe(1);
  });
});
