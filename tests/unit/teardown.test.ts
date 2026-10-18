import { describe, expect, it } from 'vitest';
import { LAYERS, poseAt, sectionAt } from '../../src/scripts/three/Teardown';

describe('poseAt', () => {
  it('starts closed on hello', () => {
    const p = poseAt(0);
    expect(p.explode).toBe(0);
    expect(p.section).toBe('hello');
    expect(p.focus).toBeNull();
    expect(p.offsets).toEqual({ shell: 0.3, screen: 0.24, board: 0.12, battery: 0.04, back: 0 });
    expect(p.camera.position).toEqual([3.2, 3.0, 4.2]);
  });
  it('ends fully apart on the back plate', () => {
    const p = poseAt(1);
    expect(p.explode).toBe(1);
    expect(p.section).toBe('spec');
    expect(p.focus).toBe('back');
  });
  it('clamps out-of-range and NaN progress', () => {
    expect(poseAt(-0.5)).toEqual(poseAt(0));
    expect(poseAt(1.7)).toEqual(poseAt(1));
    expect(poseAt(Number.NaN)).toEqual(poseAt(0));
  });
  it('keeps layers ordered, finite, and opening monotonically', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const p = poseAt(i / 100);
      expect(p.explode).toBeGreaterThanOrEqual(last);
      last = p.explode;
      const ys = LAYERS.map((l) => p.offsets[l]);
      ys.slice(1).forEach((y, k) => expect(y).toBeLessThan(ys[k]));
      [...p.camera.position, ...p.camera.target].forEach((n) => expect(Number.isFinite(n)).toBe(true));
    }
  });
});

describe('sectionAt', () => {
  it.each([
    [0.159, 'hello'], [0.16, 'about'], [0.339, 'about'], [0.34, 'projects'],
    [0.66, 'offduty'], [0.84, 'spec'], [1, 'spec']
  ])('%f → %s', (p, id) => expect(sectionAt(p)).toBe(id));
});
