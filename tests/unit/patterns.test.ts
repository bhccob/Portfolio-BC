import { describe, expect, it } from 'vitest';
import { REPEATS, STRIP, paintHome, sweepCoverage } from '../../src/scripts/three/instrument/patterns';
import { paintFace } from '../../src/scripts/three/instrument/face';
function mockCtx() { const calls: string[] = []; const fills: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, { get: (t, k) => k in t ? t[k as string] : (...a: unknown[]) => { calls.push(String(k)); return { addColorStop: () => {} }; },
    set: (t, k, v) => { if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') fills.push(v.toLowerCase()); t[k as string] = v; return true; } });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, fills }; }
describe('ring patterns', () => {
  it('paints every home over the whole strip', () => {
    for (const home of ['plain', 'china', 'aruba', 'rotterdam'] as const) {
      const { ctx, calls } = mockCtx(); paintHome(ctx, home, STRIP.coarse.width, STRIP.coarse.height);
      expect(calls.includes('fillRect')).toBe(true);
    }
  });
  it('uses Aruba\'s star red and Rotterdam\'s pylon blue only in their own homes', () => {
    const colours = (home: 'plain' | 'china' | 'aruba' | 'rotterdam') => { const m = mockCtx(); paintHome(m.ctx, home, 2048, 128); return m.fills; };
    expect(colours('aruba')).toContain('#e4002b'); expect(colours('china')).not.toContain('#e4002b');
    expect(colours('rotterdam')).toContain('#9cc3e6'); expect(colours('aruba')).not.toContain('#9cc3e6');
  });
  it('tiles with whole repeats', () => {
    expect(Number.isInteger(REPEATS.china) && Number.isInteger(REPEATS.arubaWaves) && Number.isInteger(REPEATS.rotterdam)).toBe(true);
  });
  it('sweeps from the origin both ways', () => {
    expect(sweepCoverage(0.25, 0.25, 0)).toBe(0);
    expect(sweepCoverage(0.25, 0.25, 0.3)).toBe(1);
    expect(sweepCoverage(0.75, 0.25, 0.3)).toBe(0);
    for (let u = 0; u <= 1; u += 0.05) expect(sweepCoverage(u, 0.25, 1)).toBe(1);
    expect(sweepCoverage(0.2, 0.25, 0.3)).toBeCloseTo(sweepCoverage(0.3, 0.25, 0.3));
    expect(sweepCoverage(0.98, 0.02, 0.2)).toBe(1); // across the seam
    expect(sweepCoverage(Number.NaN, 0.25, 0.5)).toBe(sweepCoverage(0, 0.25, 0.5));
  });
  it('paints the face and its roughness/metalness map', () => {
    const c = mockCtx(); const m = mockCtx(); paintFace(c.ctx, m.ctx, 1024);
    const draws = c.calls.filter((k) => ['fill', 'fillRect', 'stroke', 'lineTo'].includes(k)).length;
    expect(draws).toBeGreaterThanOrEqual(360); // at least one stroke per degree tick
    expect(c.fills).toContain('#d9a520'); expect(m.calls.includes('fillRect')).toBe(true);
  });
});
