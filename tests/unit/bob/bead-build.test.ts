import { describe, expect, it } from 'vitest';
import { buildPose, WAKE } from '~/engine/bob/beadBuild';

const closeTo = (x: number) => expect.closeTo(x, 9);

describe("buildPose: a bead's object built with the scroll, as the light path mock-up Bob approved builds it", () => {
  it('builds Funcial: the abacus rises, its beads slide, the screen lights', () => {
    expect(buildPose('funcial', 0)).toEqual({ time: 0, slide: 0, abacus: 0.02, screen: 0 });
    expect(buildPose('funcial', 0.5)).toEqual({ time: 1.5, slide: closeTo((2.3 * 0.14) / 0.6), abacus: 1, screen: 1 });
    expect(buildPose('funcial', 1)).toEqual({ time: 3, slide: 2.3, abacus: 1, screen: 1 });
  });

  it('builds Jontai Energy: the cells light one by one, and the screen', () => {
    expect(buildPose('jontai-energy', 0)).toEqual({ time: 0, screen: 0 });
    expect(buildPose('jontai-energy', 0.5)).toEqual({ time: closeTo((4.6 * 0.38) / 0.88), screen: 1 });
  });

  it('builds Cookies Clicker: the wheels meet, then the train ticks', () => {
    expect(buildPose('cookies-clicker', 0)).toEqual({ time: 0, apart: 1, screen: 0 });
    expect(buildPose('cookies-clicker', 0.5)).toEqual({ time: closeTo((7 * 0.02) / 0.52), apart: 0, screen: 1 });
  });

  it('reads a build outside 0..1, or not a number, as held to it', () => {
    expect(buildPose('funcial', -1)).toEqual(buildPose('funcial', 0));
    expect(buildPose('funcial', 2)).toEqual(buildPose('funcial', 1));
    expect(buildPose('cookies-clicker', Number.NaN)).toEqual(buildPose('cookies-clicker', 0));
  });
});

describe("the veins' levels", () => {
  it('sleeps the veins at 0.12, wakes them to 1.4, and glows them 2.6 just behind the light', () => {
    expect(WAKE).toEqual({ rest: 0.12, lit: 1.4, hot: 2.6 });
  });
});
