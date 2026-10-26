import { describe, expect, it } from 'vitest';
import { LOADER, type LoaderPath, loaderAt, SCRIPT } from '~/engine/bob/loaderTimeline';
import { homeShotFor } from '~/engine/bob/shots';
import { cameraShotAt, HOME_POSE, openingPoseAt } from '~/scene/bob/openingPose';
import {
  HOME_CLOCK,
  heldLoaderInput,
  listensForSkip,
  marksSeen,
  openingReadiness,
  openingStartFor,
  SKIPPED_HOME_BUDGET_MS,
  skipAtFor,
  skipsLoader,
} from '~/scene/bob/openingStart';
import type { Phase } from '~/state/machine';
import { journeyPoseAt } from '~/scene/bob/journey';
import { wayShot } from '~/scene/bob/lightDive';
import { shownProgressFor } from '~/scene/bob/shotSource';
import { placeOfFrame } from '~/state/chapters';

const PATHS: readonly LoaderPath[] = ['full', 'quick', 'reduced'];

describe('where an opening starts', () => {
  const KINDS: Phase['kind'][] = ['LOADING', 'HOME_IDLE', 'LIGHT', 'PROJECTS', 'END', 'PROJECT_FOCUS'];

  it('plays the loader while the page is loading, on the path the visit and the visitor ask for', () => {
    expect(openingStartFor('LOADING', false, false)).toEqual({ skip: false, path: 'full' });
    expect(openingStartFor('LOADING', true, false)).toEqual({ skip: false, path: 'quick' });
    // Reduced beats quick, and quick beats full.
    expect(openingStartFor('LOADING', false, true)).toEqual({ skip: false, path: 'reduced' });
    expect(openingStartFor('LOADING', true, true)).toEqual({ skip: false, path: 'reduced' });
  });

  it('goes straight to the home once the home page has left LOADING: its hero shows, so no loader replays under it', () => {
    for (const seen of [false, true]) {
      for (const reduced of [false, true]) {
        expect(openingStartFor('HOME_IDLE', seen, reduced)).toEqual({ skip: true, path: reduced ? 'reduced' : seen ? 'quick' : 'full' });
      }
    }
    for (const kind of ['LIGHT', 'PROJECTS', 'END'] as const) expect(skipsLoader(kind), kind).toBe(true);
  });

  it("still plays it on a project page, where it runs under the page's scrim as a direct arrival does", () => {
    expect(skipsLoader('PROJECT_FOCUS')).toBe(false);
    expect(skipsLoader('LOADING')).toBe(false);
    expect(openingStartFor('PROJECT_FOCUS', false, false)).toEqual({ skip: false, path: 'full' });
    // Every phase has an answer.
    expect(KINDS.filter(skipsLoader)).toEqual(['HOME_IDLE', 'LIGHT', 'PROJECTS', 'END']);
  });
});

describe('marksSeen', () => {
  it('marks the loader seen when the full show or the quick one lands, never the reduced fade', () => {
    expect(marksSeen('full')).toBe(true);
    expect(marksSeen('quick')).toBe(true);
    expect(marksSeen('reduced')).toBe(false);
  });

  it('so a reduced-motion visit that never saw the show leaves it to come: a later visit with motion plays it whole', () => {
    const start = openingStartFor('LOADING', false, true);
    expect(start.path).toBe('reduced');
    const seen = marksSeen(start.path);
    expect(openingStartFor('LOADING', seen, false).path).toBe('full');
  });
});

describe('listensForSkip: only while a scene is shown', () => {
  it('listens while the full show is skippable and the page shows a scene', () => {
    expect(listensForSkip(true, true)).toBe(true);
  });

  it('does not listen on a page of text reached mid-show (Lite, contact), so that page scrolls', () => {
    expect(listensForSkip(true, false)).toBe(false);
  });

  it('does not listen once the show is not skippable, with a scene or without one', () => {
    expect(listensForSkip(false, true)).toBe(false);
    expect(listensForSkip(false, false)).toBe(false);
  });

  it('listens again when a scene comes back mid-show: the page decides, not the order the two changed in', () => {
    // Project page (scene) -> Lite (none) -> back to the project page, the show still skippable throughout.
    expect([true, false, true].map((shown) => listensForSkip(true, shown))).toEqual([true, false, true]);
  });
});

describe('skipAtFor', () => {
  it('takes the moment of the first skip', () => {
    expect(skipAtFor(3.2, null)).toBe(3.2);
    expect(skipAtFor(0, null)).toBe(0);
  });

  it('keeps the first skip: later input changes nothing', () => {
    expect(skipAtFor(5, 3.2)).toBe(3.2);
    expect(skipAtFor(0.5, 3.2)).toBe(3.2);
    let skipAt: number | null = null;
    for (const elapsed of [2, 2.1, 2.5, 4]) skipAt = skipAtFor(elapsed, skipAt);
    expect(skipAt).toBe(2);
  });

  it('reads a time that is not a number, or before the start, as the start', () => {
    expect(skipAtFor(Number.NaN, null)).toBe(0);
    expect(skipAtFor(-1, null)).toBe(0);
  });

  it('fast-forwards the full show to the home in LOADER.skip once the load is known', () => {
    const skipAt = skipAtFor(3, null);
    const at = (elapsed: number) => loaderAt({ elapsed, loadedAt: 1, skipAt, path: 'full' });
    expect(at(3 + LOADER.skip - 0.01).stage).not.toBe('home');
    expect(at(3 + LOADER.skip).stage).toBe('home');
  });
});

describe('the held clock (seekLoader)', () => {
  const held = (seconds: number, path: LoaderPath = 'full') => loaderAt(heldLoaderInput(seconds, path));

  it("is a load that had landed from the start, on the visit's own path, with no skip", () => {
    expect(heldLoaderInput(5, 'full')).toEqual({ elapsed: 5, loadedAt: 0, skipAt: null, path: 'full' });
    expect(heldLoaderInput(1, 'quick')).toEqual({ elapsed: 1, loadedAt: 0, skipAt: null, path: 'quick' });
  });

  it('plays the full script at its own seconds: a still never waits on the circle', () => {
    for (const seconds of [1.0, 2.0, 3.0, 3.5, 4.5, SCRIPT.home]) expect(held(seconds).script).toBeCloseTo(seconds, 12);
    expect(held(1).stage).toBe('dark');
    expect(held(2).stage).toBe('engrave');
    expect(held(3.5).stage).toBe('open');
    expect(held(4.5).stage).toBe('rise');
    expect(held(SCRIPT.home).stage).toBe('home');
    // Past the circle's hold, which a load still out would stop at.
    expect(held(3.5).strokes[4]).toBe(1);
  });

  it('reads a bad time as the start, as the live clock does', () => {
    expect(held(Number.NaN).script).toBe(0);
    expect(held(-1).script).toBe(0);
  });
});

describe("a skipped opening's clock", () => {
  it('stands at home, the circle cut, open and risen, and no B drawn', () => {
    expect(HOME_CLOCK.stage).toBe('home');
    expect(HOME_CLOCK.script).toBe(SCRIPT.home);
    expect(HOME_CLOCK.strokes).toEqual([0, 0, 0, 0, 1]);
    for (const share of ['ticks', 'outer', 'iris', 'glow', 'rise', 'camera', 'settle', 'fade'] as const) expect(HOME_CLOCK[share], share).toBe(1);
    expect(Object.isFrozen(HOME_CLOCK)).toBe(true);
    expect(Object.isFrozen(HOME_CLOCK.strokes)).toBe(true);
  });

  it('poses the home every path lands on, with the camera on the home shot', () => {
    for (const path of PATHS) {
      expect(openingPoseAt(HOME_CLOCK, path), path).toEqual(HOME_POSE);
      for (const aspect of [16 / 9, 390 / 844]) expect(cameraShotAt(HOME_CLOCK, path, aspect), `${path} ${aspect}`).toEqual(homeShotFor(aspect));
    }
  });
});

describe('what an opening tells SceneHost (openingReadiness)', () => {
  it('keeps one rule for the load timeout: either path has started once its loader is warm, as a normal mount always has', () => {
    for (const skip of [false, true]) {
      expect(openingReadiness(skip, { loader: false, home: false }), `skip ${skip}`).toEqual({ started: false, shown: false, budget: false });
      expect(openingReadiness(skip, { loader: true, home: false }).started, `skip ${skip}`).toBe(true);
      expect(openingReadiness(skip, { loader: true, home: true }), `skip ${skip}`).toEqual({ started: true, shown: true, budget: false });
    }
  });

  it("shows a normal mount's loader at once, its home's load then the loader clock's to give up on", () => {
    expect(openingReadiness(false, { loader: true, home: false })).toEqual({ started: true, shown: true, budget: false });
  });

  it("keeps a skipped mount's canvas hidden until its home is warm, on a budget of its own meanwhile", () => {
    expect(openingReadiness(true, { loader: true, home: false })).toEqual({ started: true, shown: false, budget: true });
    // The budget is the loader's own give-up time, so a visit that began on Lite has the whole of it, as a loader would.
    expect(SKIPPED_HOME_BUDGET_MS).toBe(LOADER.giveUp * 1000);
  });
});

describe("the Opening's shot in the light dive", () => {
  it("is the journey's, the way's own shot at each frame, on a desk and on a phone", () => {
    for (const aspect of [1440 / 900, 390 / 844]) {
      for (const f of [1, 30, 61, 121, 261, 300]) {
        const p = placeOfFrame(f);
        // As the Opening writes it each frame: the journey's pose at the progress the home poses the scene at.
        const at = shownProgressFor('journey', false, p, p, p);
        expect(journeyPoseAt(at, aspect).shot, `frame ${f} at ${aspect}`).toEqual(wayShot(f, aspect));
      }
    }
  });
});
