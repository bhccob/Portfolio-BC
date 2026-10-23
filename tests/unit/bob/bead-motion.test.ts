import { describe, expect, it } from 'vitest';
import { BEAD_MOTION, cookiesMotion, funcialMotion, jontaiMotion } from '~/engine/bob/beadMotion';

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

/** Times across several periods of every motion, a few off the whole seconds, so no test only looks at round moments. */
const TIMES = Array.from({ length: 400 }, (_, i) => i * 0.0617);

describe('funcialMotion', () => {
  it('turns the platter once every 40 s, from no turn at 0', () => {
    expect(funcialMotion(0).platter).toBe(0);
    expect(funcialMotion(40).platter).toBeCloseTo(TAU, 12);
    expect(funcialMotion(10).platter).toBeCloseTo(TAU / 4, 12);
    expect(BEAD_MOTION.funcial.turn).toBe(40);
  });

  it('runs the pulse from TP1 (0) to TP4 (1) every 3 s, and wraps', () => {
    expect(funcialMotion(0).pulse).toBe(0);
    expect(funcialMotion(1.5).pulse).toBeCloseTo(0.5, 12);
    expect(funcialMotion(3).pulse).toBeCloseTo(0, 12);
    expect(funcialMotion(4.5).pulse).toBeCloseTo(0.5, 12);
    expect(funcialMotion(2.999).pulse).toBeGreaterThan(0.99);
    for (const t of TIMES) {
      const { pulse } = funcialMotion(t);
      expect(pulse).toBeGreaterThanOrEqual(0);
      expect(pulse).toBeLessThan(1);
      expect(pulse).toBeCloseTo(funcialMotion(t + 3).pulse, 9);
    }
  });

  it('slides the five abacus beads up one after another over 2 s, then holds them at the top', () => {
    expect(funcialMotion(0).abacus).toEqual([0, 0, 0, 0, 0]);
    expect(funcialMotion(2).abacus).toEqual([1, 1, 1, 1, 1]);
    expect(funcialMotion(30).abacus).toEqual([1, 1, 1, 1, 1]);
    for (const t of TIMES) {
      const { abacus } = funcialMotion(t);
      expect(abacus).toHaveLength(5);
      for (let k = 0; k < 5; k++) {
        expect(abacus[k]).toBeGreaterThanOrEqual(0);
        expect(abacus[k]).toBeLessThanOrEqual(1);
        // One after another: a bead moves only once the one before it has arrived.
        if (k > 0 && abacus[k]! > 0) expect(abacus[k - 1]).toBe(1);
      }
    }
    // Each takes its own fifth of the 2 s, eased: bead 3 (k 2) is halfway at 1.0 s.
    expect(funcialMotion(1.0).abacus[2]).toBeCloseTo(0.5, 12);
    expect(funcialMotion(0.8).abacus).toEqual([1, 1, 0, 0, 0]);
  });
});

describe('jontaiMotion', () => {
  it('sweeps the light across the module every 6 s', () => {
    expect(jontaiMotion(0).sweep).toBe(0);
    expect(jontaiMotion(3).sweep).toBeCloseTo(0.5, 12);
    expect(jontaiMotion(6).sweep).toBeCloseTo(0, 12);
    for (const t of TIMES) {
      const { sweep } = jontaiMotion(t);
      expect(sweep).toBeGreaterThanOrEqual(0);
      expect(sweep).toBeLessThan(1);
    }
  });

  it('charges the 16 cells in page order, 0..15, at any time: a cell is never more charged than the one before it', () => {
    let charged = 0;
    for (const t of TIMES) {
      const { cells } = jontaiMotion(t);
      expect(cells).toHaveLength(16);
      for (let k = 0; k < 16; k++) {
        expect(cells[k]).toBeGreaterThanOrEqual(0);
        expect(cells[k]).toBeLessThanOrEqual(1);
        if (k > 0) expect(cells[k]).toBeLessThanOrEqual(cells[k - 1]!);
      }
      if (cells[15] === 1) charged++;
    }
    // At rest none is charged, and every pass charges all sixteen before they let go together.
    expect(jontaiMotion(0).cells.every((c) => c === 0)).toBe(true);
    expect(charged).toBeGreaterThan(0);
    // The charge follows the sweep: halfway through the light's crossing the first cells are full and the last are not.
    const half = jontaiMotion((BEAD_MOTION.jontai.cross / 2) * BEAD_MOTION.jontai.period).cells;
    expect(half[0]).toBe(1);
    expect(half[15]).toBe(0);
  });

  it('charges the cells continuously, so a new pass starts from dark cells and none pops', () => {
    const step = 0.004;
    for (let t = 0; t < 2 * BEAD_MOTION.jontai.period; t += step) {
      const a = jontaiMotion(t).cells;
      const b = jontaiMotion(t + step).cells;
      for (let k = 0; k < 16; k++) expect(Math.abs(b[k]! - a[k]!)).toBeLessThan(0.05);
    }
  });

  it('tilts the module after the sweep, up to 4 degrees, 0.5 s behind it, from no tilt at rest', () => {
    expect(jontaiMotion(0).tilt).toBe(0);
    expect(jontaiMotion(0.5).tilt).toBe(0);
    let most = 0;
    for (const t of TIMES) {
      const { tilt } = jontaiMotion(t);
      expect(Math.abs(tilt)).toBeLessThanOrEqual(4 * DEG + 1e-12);
      most = Math.max(most, Math.abs(tilt));
      // 0.5 s behind: the tilt at t is the one the sweep gave half a second before, the same in every pass.
      if (t >= 0.5) {
        expect(tilt).toBeCloseTo(-4 * DEG * Math.sin(TAU * jontaiMotion(t - 0.5).sweep), 9);
        expect(tilt).toBeCloseTo(jontaiMotion(t + BEAD_MOTION.jontai.period).tilt, 9);
      }
    }
    expect(most).toBeGreaterThan(3.9 * DEG);
    // While the light crosses the top rows the face turns up (negative), toward the bottom rows down (positive).
    expect(jontaiMotion(0.5 + 1.5).tilt).toBeCloseTo(-4 * DEG, 12);
    expect(jontaiMotion(0.5 + 4.5).tilt).toBeCloseTo(4 * DEG, 12);
    expect(BEAD_MOTION.jontai.tilt.lag).toBe(0.5);
  });
});

describe('cookiesMotion', () => {
  it('counts whole beats at 1 Hz', () => {
    expect(cookiesMotion(0.5).beat).toBe(0);
    expect(cookiesMotion(1.2).beat).toBe(1);
    expect(cookiesMotion(7.99).beat).toBe(7);
    expect(cookiesMotion(8).beat).toBe(8);
  });

  it('turns wheel k 360°/(12·(k+1)) per beat, each the other way from its neighbour, as meshed wheels turn', () => {
    const at = (t: number) => cookiesMotion(t).wheels;
    expect(at(0)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    for (let k = 0; k < 8; k++) {
      const perBeat = at(5.5)[k]! - at(4.5)[k]!;
      expect(Math.abs(perBeat)).toBeCloseTo(TAU / (12 * (k + 1)), 12);
      if (k > 0) expect(Math.sign(perBeat)).toBe(-Math.sign(at(5.5)[k - 1]! - at(4.5)[k - 1]!));
    }
    expect(at(0.5)).toHaveLength(8);
  });

  it('moves the wheels only within 0.12 s of a beat: stop, start', () => {
    const step = 0.01;
    for (let i = 0; i < 400; i++) {
      const t = i * step + 0.003;
      const a = cookiesMotion(t).wheels;
      const b = cookiesMotion(t + step).wheels;
      const moved = a.some((angle, k) => Math.abs(b[k]! - angle) > 1e-12);
      const sinceBeat = t - Math.floor(t);
      // Between t and t + step the train moves only if that span reaches into the first 0.12 s after a beat.
      const reaches = sinceBeat < BEAD_MOTION.cookies.ease || sinceBeat + step > 1;
      expect(moved, `t ${t}`).toBe(reaches);
    }
    // Within the ease it is moving, and it starts and ends with no speed (no snap).
    expect(cookiesMotion(2.06).wheels[0]).not.toBeCloseTo(cookiesMotion(2.0).wheels[0]!, 6);
    expect(cookiesMotion(2.12).wheels[0]).toBeCloseTo(cookiesMotion(2.5).wheels[0]!, 12);
    expect(cookiesMotion(1.999999).wheels[0]).toBeCloseTo(cookiesMotion(2).wheels[0]!, 9);
    expect(BEAD_MOTION.cookies.ease).toBe(0.12);
  });

  it('swings the balance to and fro, through its rest at every beat', () => {
    expect(cookiesMotion(0).balance).toBe(0);
    let most = 0;
    for (const t of TIMES) {
      const { balance } = cookiesMotion(t);
      expect(Math.abs(balance)).toBeLessThanOrEqual(BEAD_MOTION.cookies.balance + 1e-12);
      most = Math.max(most, Math.abs(balance));
    }
    expect(most).toBeGreaterThan(0.9 * BEAD_MOTION.cookies.balance);
    for (const beat of [1, 2, 5]) expect(cookiesMotion(beat).balance).toBeCloseTo(0, 12);
    // One way in one beat, the other way in the next.
    expect(Math.sign(cookiesMotion(0.5).balance)).toBe(-Math.sign(cookiesMotion(1.5).balance));
  });
});

describe('every motion', () => {
  it('reads a time that is not finite as 0', () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(funcialMotion(t)).toEqual(funcialMotion(0));
      expect(jontaiMotion(t)).toEqual(jontaiMotion(0));
      expect(cookiesMotion(t)).toEqual(cookiesMotion(0));
    }
  });

  it('writes into the object it is handed, so a frame makes none', () => {
    const f = funcialMotion(0);
    const fArrays = f.abacus;
    expect(funcialMotion(1.3, f)).toBe(f);
    expect(f.abacus).toBe(fArrays);
    expect(f).toEqual(funcialMotion(1.3));
    const j = jontaiMotion(0);
    const cells = j.cells;
    expect(jontaiMotion(2.2, j)).toBe(j);
    expect(j.cells).toBe(cells);
    expect(j).toEqual(jontaiMotion(2.2));
    const c = cookiesMotion(0);
    const wheels = c.wheels;
    expect(cookiesMotion(3.04, c)).toBe(c);
    expect(c.wheels).toBe(wheels);
    expect(c).toEqual(cookiesMotion(3.04));
  });

  it('is the same picture at the same time', () => {
    for (const t of [0.3, 7.7, 41.2]) {
      expect(funcialMotion(t)).toEqual(funcialMotion(t));
      expect(jontaiMotion(t)).toEqual(jontaiMotion(t));
      expect(cookiesMotion(t)).toEqual(cookiesMotion(t));
    }
  });
});
