import { describe, expect, it } from 'vitest';
import { COUNTRY_IDS } from '~/data/directions';
import {
  aimSource,
  BREATHE,
  breathAt,
  clearOfHero,
  GLOW_FADE,
  glowToward,
  HERO_ROOM,
  IDLE_SECONDS,
  idleRuns,
  isAiming,
  LABEL,
  labelSide,
  labelSpot,
  PULSE,
  pulseAt,
  type ScreenBox,
} from '~/scene/v3/homePose';
import type { Phase } from '~/state/machine';

describe('the idle motion', () => {
  it('runs for 12 s', () => {
    expect(IDLE_SECONDS).toBe(12);
  });

  it('breathes the needle tip ±10 % over 4 s, from its own glow', () => {
    expect(BREATHE).toEqual({ depth: 0.1, period: 4 });
    expect(breathAt(0)).toBeCloseTo(1, 12);
    expect(breathAt(1)).toBeCloseTo(1.1, 12);
    expect(breathAt(2)).toBeCloseTo(1, 12);
    expect(breathAt(3)).toBeCloseTo(0.9, 12);
    expect(breathAt(4 + 1)).toBeCloseTo(breathAt(1), 12);
    for (let t = 0; t < 8; t += 0.1) {
      expect(breathAt(t)).toBeGreaterThanOrEqual(0.9 - 1e-12);
      expect(breathAt(t)).toBeLessThanOrEqual(1.1 + 1e-12);
    }
  });

  it("pulses the city's glow ±5 % over 9 s, very slowly", () => {
    expect(PULSE).toEqual({ depth: 0.05, period: 9 });
    expect(pulseAt(0)).toBeCloseTo(1, 12);
    expect(pulseAt(9 / 4)).toBeCloseTo(1.05, 12);
    expect(pulseAt((3 * 9) / 4)).toBeCloseTo(0.95, 12);
    expect(pulseAt(9 + 2)).toBeCloseTo(pulseAt(2), 12);
    // Slow: never more than a hundredth of the glow in a 60th of a second.
    for (let t = 0; t < 9; t += 1 / 60) expect(Math.abs(pulseAt(t + 1 / 60) - pulseAt(t))).toBeLessThan(0.01 / 60 * 4);
  });

  it('reads a time that is not finite as their rest, the glow as built', () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(breathAt(t)).toBe(1);
      expect(pulseAt(t)).toBe(1);
    }
  });
});

describe('glowToward', () => {
  /** Steps `glowToward` at 60 fps for `seconds`, from `level` to `goal`; answers every level on the way. */
  function fade(level: number, goal: number, seconds: number): number[] {
    const out = [level];
    for (let i = 0; i < Math.round(seconds * 60); i++) out.push(glowToward(out[out.length - 1], goal, 1 / 60));
    return out;
  }

  it('brightens a constellation the needle comes to over 0.4 s, and dims one it leaves the same way', () => {
    expect(GLOW_FADE).toBe(0.4);
    const up = fade(0.3, 1, GLOW_FADE);
    expect(up.at(-1)!).toBeGreaterThan(1 - 0.05 * 0.7);
    expect(up[12]).toBeLessThan(0.95); // a fifth of a second in, still on its way
    const down = fade(1, 0.3, GLOW_FADE);
    expect(down.at(-1)!).toBeLessThan(0.3 + 0.05 * 0.7);
  });

  it('never overshoots, moves only toward the goal, and arrives exactly, so the scene can count it still', () => {
    const up = fade(0.3, 1, 1.5);
    for (let i = 1; i < up.length; i++) {
      expect(up[i]).toBeGreaterThanOrEqual(up[i - 1]);
      expect(up[i]).toBeLessThanOrEqual(1);
    }
    expect(up.at(-1)).toBe(1);
    expect(fade(1, 0.3, 1.5).at(-1)).toBe(0.3);
  });

  it('takes a long frame (a wake from sleep) as the whole way, a frame of no time as no step', () => {
    expect(glowToward(0.3, 1, 5)).toBe(1);
    expect(glowToward(0.5, 1, 0)).toBe(0.5);
    expect(glowToward(0.5, 1, -1)).toBe(0.5);
    expect(glowToward(0.5, 1, Number.NaN)).toBe(0.5);
    expect(glowToward(Number.NaN, 0.3, 1 / 60)).toBe(0.3);
  });
});

describe('isAiming', () => {
  const KINDS: Phase['kind'][] = ['LOADING', 'HOME_IDLE', 'FOCUS_COUNTRY', 'COUNTRY_PAGE', 'DISSECT', 'MORPH', 'VOID_ENTRY', 'PROJECTS', 'PROJECT_FOCUS'];

  it('aims the needle at the pointer only on the home page at rest: HOME_IDLE, with the home scene shown', () => {
    for (const kind of KINDS) {
      expect(isAiming(kind, 'home'), kind).toBe(kind === 'HOME_IDLE');
      expect(isAiming(kind, 'country'), kind).toBe(false);
      expect(isAiming(kind, null), kind).toBe(false);
    }
  });
});

describe('aimSource', () => {
  it('follows a mouse once it has moved', () => {
    expect(aimSource(true, true, true)).toBe('pointer');
  });

  it("drifts between the constellations before the mouse has moved, and always on a touch screen, which has no pointer to follow", () => {
    expect(aimSource(true, true, false)).toBe('drift');
    expect(aimSource(true, false, false)).toBe('drift');
    expect(aimSource(true, false, true)).toBe('drift');
  });

  it('holds where it points anywhere but the home at rest', () => {
    for (const fine of [true, false]) for (const moved of [true, false]) expect(aimSource(false, fine, moved)).toBe('hold');
  });
});

describe('idleRuns', () => {
  const base = { now: 1_000, until: 2_000, reduced: false, drifting: false, resting: true };

  it('runs until its while is over', () => {
    expect(idleRuns(base)).toBe(true);
    expect(idleRuns({ ...base, now: 1_999.9 })).toBe(true);
    expect(idleRuns({ ...base, now: 2_000 })).toBe(false);
  });

  it('runs on past it while the drift travels, so the needle falls asleep resting on a constellation', () => {
    expect(idleRuns({ ...base, now: 2_500, drifting: true, resting: false })).toBe(true);
    expect(idleRuns({ ...base, now: 2_500, drifting: true, resting: true })).toBe(false);
    // A pointer-led needle has no drift to wait for.
    expect(idleRuns({ ...base, now: 2_500, drifting: false, resting: false })).toBe(false);
  });

  it('never runs under reduced motion: no twinkle, breathe, pulse or drift at all', () => {
    expect(idleRuns({ ...base, reduced: true })).toBe(false);
    expect(idleRuns({ ...base, reduced: true, now: 2_500, drifting: true, resting: false })).toBe(false);
  });
});

describe('labelSide', () => {
  it('names each constellation on its side away from the compass: China east, Aruba west, the ship above', () => {
    expect(labelSide('china')).toBe('east');
    expect(labelSide('aruba')).toBe('west');
    expect(labelSide('netherlands')).toBe('north');
    for (const id of COUNTRY_IDS) expect(['east', 'west', 'north']).toContain(labelSide(id));
  });
});

describe('labelSpot', () => {
  const view = { width: 1440, height: 900 };
  const label = { width: 70, height: 16 };
  // China, Aruba and the ship as the 1440 x 900 home shows them (their stars' boxes and anchors, CSS px).
  const china: ScreenBox = { left: 1111, top: 228, right: 1334, bottom: 559 };
  const aruba: ScreenBox = { left: 97, top: 289, right: 358, bottom: 581 };
  const ship: ScreenBox = { left: 659, top: 174, right: 783, bottom: 323 };
  const spot = (...args: Parameters<typeof labelSpot> extends [...infer A, unknown] ? A : never): [number, number] => labelSpot(...args, [0, 0]);

  it('sets the name just past the figure on its outer side, level with the anchor', () => {
    expect(spot('east', china, { x: 1238, y: 423 }, label, view)).toEqual([1334 + LABEL.gap, 423 - 8]);
    expect(spot('west', aruba, { x: 206, y: 382 }, label, view)).toEqual([97 - LABEL.gap - 70, 382 - 8]);
  });

  it('sets the ship\'s name above its masts, centred on it', () => {
    expect(spot('north', ship, { x: 721, y: 250 }, label, view)).toEqual([721 - 35, 174 - LABEL.gap - 16]);
  });

  it('puts the name above the figure when its outer side has no room on the screen, as on a phone', () => {
    const phone = { width: 390, height: 844 };
    const phoneChina: ScreenBox = { left: 302, top: 418, right: 361, bottom: 515 };
    const phoneAruba: ScreenBox = { left: 15, top: 436, right: 105, bottom: 521 };
    expect(spot('east', phoneChina, { x: 337, y: 478 }, label, phone)).toEqual([337 - 35, 418 - LABEL.gap - 16]);
    // Centred on Aruba's anchor it would start 19 px off the left edge: it is held at the margin.
    expect(spot('west', phoneAruba, { x: 51, y: 466 }, { width: 140, height: 16 }, phone)).toEqual([LABEL.margin, 436 - LABEL.gap - 16]);
  });

  it('keeps the whole label on the screen, inside the margin', () => {
    const wide = { width: 300, height: 20 };
    const [x, y] = spot('north', { left: 0, top: 5, right: 40, bottom: 60 }, { x: 10, y: 30 }, wide, view);
    expect(x).toBe(LABEL.margin);
    expect(y).toBe(LABEL.margin);
    const [, low] = spot('east', { left: 100, top: 850, right: 200, bottom: 899 }, { x: 150, y: 895 }, label, view);
    expect(low).toBe(view.height - LABEL.margin - label.height);
  });

  it('writes into the pair it is given and answers it, so a frame makes no new array', () => {
    const out: [number, number] = [0, 0];
    expect(labelSpot('east', china, { x: 1238, y: 423 }, label, view, out)).toBe(out);
    expect(out).toEqual([1334 + LABEL.gap, 415]);
  });
});

describe('clearOfHero', () => {
  const view = { width: 1440, height: 900 };
  // The hero's three lines as the 1440 x 900 home lays them out (CSS px): the name and tagline at the upper left, the
  // scroll cue low in the middle. The tagline is its English wording's; the name is wide-tracked, 567 px.
  const hero: ScreenBox[] = [
    { left: 64, top: 133, right: 631, bottom: 207 },
    { left: 64, top: 223, right: 297, bottom: 239 },
    { left: 687, top: 811, right: 756, bottom: 824 },
  ];
  const ship: ScreenBox = { left: 659, top: 174, right: 783, bottom: 323 };
  const aruba: ScreenBox = { left: 97, top: 289, right: 358, bottom: 581 };
  const china: ScreenBox = { left: 1111, top: 228, right: 1334, bottom: 559 };
  const nothing: ScreenBox = { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY };
  /** labelSpot, then clearOfHero, as Home's placer does. */
  const place = (side: Parameters<typeof labelSpot>[0], figure: ScreenBox, anchor: { x: number; y: number }, label: { width: number; height: number }, size = view, lines: readonly ScreenBox[] = hero): [number, number] => {
    const spot = labelSpot(side, figure, anchor, label, size, [0, 0]);
    return clearOfHero(spot, figure, anchor, label, size, lines, spot);
  };

  it('keeps 80 px of clear sky between a name and the hero', () => {
    expect(HERO_ROOM).toBe(80);
  });

  it("moves the ship's name under the ship where it would stand beside the hero's name, in either language", () => {
    // Above the masts the English name would begin 19 px right of BOB CHUNG's last letter, the Dutch one 46 px.
    for (const width of [141, 89]) expect(place('north', ship, { x: 721, y: 250 }, { width, height: 16 })).toEqual([721 - width / 2, 323 + LABEL.gap]);
  });

  it('leaves a name that is far from the hero where it stands', () => {
    const label = { width: 70, height: 16 };
    expect(place('east', china, { x: 1238, y: 423 }, label)).toEqual([1334 + LABEL.gap, 415]);
    // Aruba's, 136 px below the tagline at the design size.
    expect(place('west', aruba, { x: 206, y: 382 }, label)).toEqual([97 - LABEL.gap - 70, 374]);
    // The ship's on a wide screen: BOB CHUNG ends at 664 and the name begins at 917.
    const wide: ScreenBox[] = [{ left: 64, top: 147, right: 664, bottom: 225 }, { left: 64, top: 245, right: 322, bottom: 262 }, { left: 951, top: 1010, right: 1020, bottom: 1023 }];
    expect(place('north', { left: 899, top: 237, right: 1021, bottom: 500 }, { x: 960, y: 330 }, { width: 89, height: 16 }, { width: 1920, height: 1080 }, wide)).toEqual([960 - 44.5, 237 - LABEL.gap - 16]);
  });

  it("moves Aruba's name under its figure when the hero's tagline is within 80 px, as at 1024 x 768", () => {
    const small = { width: 1024, height: 768 };
    const lines: ScreenBox[] = [{ left: 51, top: 123, right: 454, bottom: 176 }, { left: 51, top: 190, right: 220, bottom: 203 }, { left: 480, top: 700, right: 540, bottom: 712 }];
    const figure: ScreenBox = { left: 100, top: 226, right: 290, bottom: 421 };
    // Beside the figure (level with its anchor, at y 252) the name would be 49 px below the tagline.
    expect(labelSpot('west', figure, { x: 190, y: 260 }, { width: 50, height: 16 }, small, [0, 0])).toEqual([100 - LABEL.gap - 50, 252]);
    expect(place('west', figure, { x: 190, y: 260 }, { width: 50, height: 16 }, small, lines)).toEqual([190 - 25, 421 + LABEL.gap]);
  });

  it('meets nothing where the hero is not on the page', () => {
    expect(place('north', ship, { x: 721, y: 250 }, { width: 141, height: 16 }, view, [nothing, nothing, nothing])).toEqual([721 - 70.5, 174 - LABEL.gap - 16]);
    expect(place('north', ship, { x: 721, y: 250 }, { width: 141, height: 16 }, view, [])).toEqual([721 - 70.5, 174 - LABEL.gap - 16]);
  });

  it('keeps the name where it was if under the figure is within reach of a line too', () => {
    const block: ScreenBox = { left: 500, top: 330, right: 900, bottom: 400 };
    expect(place('north', ship, { x: 721, y: 250 }, { width: 141, height: 16 }, view, [...hero, block])).toEqual([721 - 70.5, 174 - LABEL.gap - 16]);
  });

  it('holds the name inside the screen, as the margin does for labelSpot', () => {
    const low: ScreenBox = { left: 650, top: 700, right: 790, bottom: 890 };
    const [, y] = clearOfHero([650, 690], low, { x: 720 }, { width: 140, height: 16 }, view, [{ left: 600, top: 650, right: 800, bottom: 700 }], [0, 0]);
    expect(y).toBe(view.height - LABEL.margin - 16);
  });

  it('writes into the pair it is given (the spot itself, or another) and answers it', () => {
    const spot: [number, number] = [650.5, 146];
    expect(clearOfHero(spot, ship, { x: 721 }, { width: 141, height: 16 }, view, hero, spot)).toBe(spot);
    expect(spot).toEqual([650.5, 323 + LABEL.gap]);
    const out: [number, number] = [0, 0];
    expect(clearOfHero([1346, 415], china, { x: 1238 }, { width: 70, height: 16 }, view, hero, out)).toBe(out);
    expect(out).toEqual([1346, 415]);
  });
});
