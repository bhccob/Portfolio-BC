import { describe, expect, it } from 'vitest';
import { FreeTurn } from '../../src/scripts/three/FreeTurn';
const run = (f: FreeTurn, seconds: number, limit = 0.14) => { let r = { spin: 0, tip: 0 }; for (let i = 0; i < seconds * 60; i++) r = f.step(1 / 60, limit); return r; };
describe('FreeTurn', () => {
  it('ignores small and mostly vertical moves', () => {
    const f = new FreeTurn(); f.down(100, 100, 'touch'); f.move(104, 100, 1000, 800, 0.01); expect(f.engaged).toBe(false);
    f.move(110, 180, 1000, 800, 0.02); expect(f.engaged).toBe(false);
  });
  it('turns clockwise for a drag to the right and keeps spinning after release', () => {
    const f = new FreeTurn(); f.down(0, 0, 'mouse');
    for (let i = 1; i <= 10; i++) f.move(i * 40, 0, 1000, 800, i / 60);
    const during = f.step(1 / 60, 0.14).spin; expect(during).toBeLessThan(0);
    f.up(10 / 60); const after = run(f, 0.3).spin; expect(after).toBeLessThan(during);
  });
  it('settles on a whole turn', () => {
    const f = new FreeTurn(); f.down(0, 0, 'mouse'); for (let i = 1; i <= 10; i++) f.move(i * 40, 0, 1000, 800, i / 60); f.up(10 / 60);
    const { spin } = run(f, 8); expect(Math.abs(spin / (2 * Math.PI) - Math.round(spin / (2 * Math.PI)))).toBeLessThan(0.002);
  });
  it('never tips on touch and clamps the tip on a mouse', () => {
    const t = new FreeTurn(); t.down(0, 0, 'touch'); t.move(200, 150, 1000, 800, 0.1); expect(t.step(1 / 60, 0.14).tip).toBe(0);
    const m = new FreeTurn(); m.down(0, 0, 'mouse'); m.move(20, 790, 1000, 800, 0.1); expect(m.engaged).toBe(true);
    expect(Math.abs(m.step(1 / 60, 0.1).tip)).toBeCloseTo(0.1, 6);
  });
  it('cancels without inertia and stays finite', () => {
    const f = new FreeTurn(); f.down(0, 0, 'mouse'); for (let i = 1; i <= 10; i++) f.move(i * 40, 0, 1000, 800, i / 60);
    const at = f.step(1 / 60, 0.14).spin; f.cancel(); const next = f.step(1 / 60, 0.14).spin; expect(Math.abs(next - at)).toBeLessThan(0.05);
    expect(Number.isFinite(f.step(0, 0.14).spin)).toBe(true);
  });
});

describe('FreeTurn, beyond the brief', () => {
  const flick = (f: FreeTurn, kind: 'mouse' | 'pen' | 'touch', dy = 0) => { f.down(0, 0, kind); for (let i = 1; i <= 10; i++) f.move(i * 40, i * dy, 1000, 800, i / 60); };
  it('engages a touch on a sideways move and a mouse or pen in any direction', () => {
    const t = new FreeTurn(); t.down(0, 0, 'touch'); t.move(30, 10, 1000, 800, 0.1); expect(t.engaged).toBe(true);
    const m = new FreeTurn(); m.down(0, 0, 'mouse'); m.move(2, 40, 1000, 800, 0.1); expect(m.engaged).toBe(true);
    const p = new FreeTurn(); p.down(0, 0, 'pen'); p.move(40, 0, 1000, 800, 0.1); expect(p.engaged).toBe(true);
    const v = new FreeTurn(); v.down(0, 0, 'touch'); v.move(2, 40, 1000, 800, 0.1); expect(v.engaged).toBe(false);
  });
  it('turns once round for a drag of 0.8 of the width, and back the other way', () => {
    const f = new FreeTurn(); f.down(0, 0, 'mouse'); f.move(800, 0, 1000, 800, 0.1); expect(f.step(0, 0.1).spin).toBeCloseTo(-2 * Math.PI, 9);
    f.move(0, 0, 1000, 800, 0.2); expect(f.step(0, 0.1).spin).toBeCloseTo(0, 9);
  });
  it('tips with a mouse or pen, in proportion to the drag, and springs back after release', () => {
    const f = new FreeTurn(); f.down(0, 0, 'pen'); f.move(0, 100, 1000, 800, 0.1);
    expect(f.step(1 / 60, 0.5).tip).toBeCloseTo((100 / 800) * 1.2, 9);
    f.up(0.1); expect(Math.abs(run(f, 2, 0.5).tip)).toBeLessThan(0.001);
  });
  it('holds a tip to a limit that shrinks while it is out', () => {
    const f = new FreeTurn(); f.down(0, 0, 'mouse'); f.move(0, 400, 1000, 800, 0.1);
    expect(f.step(1 / 60, 0.3).tip).toBeCloseTo(0.3, 9); expect(f.step(1 / 60, 0.1).tip).toBeCloseTo(0.1, 9); expect(f.step(1 / 60, 0).tip).toBe(0);
  });
  it('gives no inertia to a drag that stopped before release, then eases to a whole turn', () => {
    const f = new FreeTurn(); flick(f, 'mouse'); const held = f.step(0, 0.14).spin;
    f.up(10 / 60 + 0.25); expect(run(f, 0.5).spin).toBeCloseTo(held, 9);
    const rest = run(f, 8).spin; expect(rest).toBeCloseTo(Math.round(held / (2 * Math.PI)) * 2 * Math.PI, 2);
  });
  it('is caught by a new press while it coasts', () => {
    const f = new FreeTurn(); flick(f, 'mouse'); f.up(10 / 60); const coasting = run(f, 0.3).spin;
    f.down(0, 0, 'mouse'); expect(run(f, 0.3).spin).toBe(coasting);
    f.cancel(); expect(Math.abs(run(f, 0.3).spin - coasting)).toBeLessThan(1e-9);
  });
  it('never tips on a touch even when dragged far, and keeps no state from the last press', () => {
    const f = new FreeTurn(); flick(f, 'touch', 5); expect(f.step(1 / 60, 0.14).tip).toBe(0); f.up(10 / 60);
    f.down(0, 0, 'mouse'); f.move(0, 400, 1000, 800, 1); expect(f.step(1 / 60, 0.14).tip).toBeCloseTo(0.14, 9);
  });
  it('ignores moves without a press and bad numbers', () => {
    const f = new FreeTurn(); f.move(500, 500, 1000, 800, 0.1); expect(f.engaged).toBe(false); expect(f.step(1 / 60, 0.14)).toEqual({ spin: 0, tip: 0 });
    f.down(0, 0, 'mouse'); f.move(Number.NaN, 0, 1000, 800, 0.1); f.move(50, 0, 0, 800, 0.1); f.move(50, 0, 1000, 800, Number.NaN); f.up(Number.NaN);
    expect(Number.isFinite(run(f, 2).spin)).toBe(true); expect(Number.isFinite(f.step(Number.NaN, Number.NaN).spin)).toBe(true);
  });
});
