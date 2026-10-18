import { describe, expect, it } from 'vitest';
import { LAYERS, poseAt, sectionAt, SECTIONS, type Pose } from '../../src/scripts/three/Teardown';

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
    expect(poseAt(Infinity)).toEqual(poseAt(1));
    expect(poseAt(-Infinity)).toEqual(poseAt(0));
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

describe('poseAt aside', () => {
  it('keeps every layer in place at the start', () => {
    const { aside } = poseAt(0);
    LAYERS.forEach((id) => expect(aside[id]).toBe(0));
  });
  it('has every layer above the back plate aside at the end', () => {
    expect(poseAt(1).aside).toEqual({ shell: 1, screen: 1, board: 1, battery: 1, back: 0 });
  });
  it('has the shell and the screen aside on the board', () => {
    expect(poseAt(0.5).aside).toEqual({ shell: 1, screen: 1, board: 0, battery: 0, back: 0 });
  });
  it('moves aside monotonically and stays finite', () => {
    let last = poseAt(0).aside;
    for (let i = 1; i <= 400; i++) {
      const { aside } = poseAt(i / 400);
      LAYERS.forEach((id) => {
        expect(Number.isFinite(aside[id])).toBe(true);
        expect(aside[id]).toBeGreaterThanOrEqual(last[id]);
      });
      last = aside;
    }
  });
});

describe('poseAt camera blend', () => {
  const expectCamera = (actual: Pose['camera'], expected: Pose['camera']): void => {
    [...actual.position, ...actual.target].forEach((n, k) =>
      expect(n).toBeCloseTo([...expected.position, ...expected.target][k], 6)
    );
  };
  /** Where section `i` has finished arriving: 40 % of its span in. */
  const settledAt = (i: number): number => {
    const from = SECTIONS[i].from;
    const to = SECTIONS[i + 1]?.from ?? 1;
    return from + 0.4 * (to - from);
  };

  it.each(SECTIONS.slice(1).map((section, k) => [section.id, k + 1] as const))(
    '%s starts from the settled camera of the section before',
    (_, i) => {
      const previous = i === 1 ? poseAt(0).camera : poseAt(settledAt(i - 1)).camera;
      expectCamera(poseAt(SECTIONS[i].from).camera, previous);
    }
  );
  it.each(SECTIONS.slice(1).map((section, k) => [section.id, k + 1] as const))(
    '%s holds its settled camera until the next section',
    (_, i) => {
      const to = SECTIONS[i + 1]?.from ?? 1;
      expectCamera(poseAt(to - 1e-9).camera, poseAt(settledAt(i)).camera);
    }
  );
});

describe('sectionAt', () => {
  it.each([
    [0.159, 'hello'], [0.16, 'about'], [0.339, 'about'], [0.34, 'projects'],
    [0.66, 'offduty'], [0.84, 'spec'], [1, 'spec']
  ])('%f → %s', (p, id) => expect(sectionAt(p)).toBe(id));
});
