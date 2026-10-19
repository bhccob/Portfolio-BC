import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOADING, SEEN_KEY, huntAt, huntRate, loadedShare, loaderVerdict, readout, screenBearing } from '../../src/scripts/compass/loading';
describe('the loader', () => {
  it('weighs the parts and clamps them', () => {
    expect(loadedShare({})).toBe(0); expect(loadedShare({ scene: 1, textures: 1, warm: 1 })).toBeCloseTo(1);
    expect(loadedShare({ scene: 2, textures: -1 })).toBeCloseTo(LOADING.weights.scene);
  });
  it('never counts down, and reaches 100 only when loaded', () => {
    let shown = 0; for (let i = 0; i < 300; i++) shown = readout(shown, 0.6, 1 / 60); expect(shown).toBeCloseTo(0.6, 2);
    expect(readout(0.6, 0.3, 1 / 60)).toBe(0.6); expect(readout(0.99, 0.999, 1)).toBeLessThan(1);
  });
  it('settles only after the minimum, and gives up at ten seconds', () => {
    expect(loaderVerdict(0.5, true)).toBe('wait'); expect(loaderVerdict(1.2, true)).toBe('settle');
    expect(loaderVerdict(9.9, false)).toBe('wait'); expect(loaderVerdict(10, false)).toBe('give-up'); expect(loaderVerdict(12, true)).toBe('settle');
  });
  it('hunts and reads screen bearings north-up', () => {
    expect(Number.isFinite(huntAt(3))).toBe(true); expect(huntAt(1)).not.toBe(huntAt(2));
    expect(screenBearing(0, -10)).toBeCloseTo(0); expect(screenBearing(10, 0)).toBeCloseTo(Math.PI / 2);
  });
  it('hands over the hunt at its own speed', () => {
    // The derivative, by a central difference.
    for (const t of [0, 0.7, 2.5]) expect(huntRate(t)).toBeCloseTo((huntAt(t + 1e-4) - huntAt(t - 1e-4)) / 2e-4, 2);
  });
  it('marks the session under the key the boot script reads', () => {
    const layout = readFileSync(new URL('../../src/layouts/BenchLayout.astro', import.meta.url), 'utf8');
    expect(layout).toContain(`sessionStorage.getItem('${SEEN_KEY}')`);
  });
});
