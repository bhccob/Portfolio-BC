import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildStars, type StarsModel, starsFall, starsRound } from '~/engine/bob/build/stars';

const ROUND = starsRound([0, 0, 0], -9);
const FALL = starsFall(80, -20, [1.5, -2]);

/** The stars of a field: each its core sprite (the main stars, `stars:star:<k>`, and the companions of pairs). */
const cores = (model: StarsModel): THREE.Sprite[] => model.group.children.filter((o) => /^stars:(star|pair):/.test(o.name)) as THREE.Sprite[];
const opacity = (s: THREE.Sprite): number => (s.material as THREE.SpriteMaterial).opacity;

// The realistic stars Bob approved with the rings (2026-10-29: "more realistic like unique stars"; spec
// 2026-10-29-bob-stack-2-design.md, goal 3), round the stack and along the fall.
describe('the stars', () => {
  it("places 44 stars round the stack, none near its axis", () => {
    expect(ROUND).toMatchObject({ count: 44, inner: 26, outer: 112, height: null, clear: 22, pairs: 4, shells: 2 });
    const stars = buildStars(ROUND, 'high');
    const all = cores(stars);
    expect(all).toHaveLength(44);
    for (const s of all.filter((o) => o.name.startsWith('stars:star:'))) expect(Math.hypot(s.position.x, s.position.z)).toBeGreaterThanOrEqual(22);
    expect(all.filter((o) => o.name.startsWith('stars:pair:')).length).toBeLessThanOrEqual(4);
    expect(stars.group.children.filter((o) => o.name.startsWith('stars:shell:')).length).toBeLessThanOrEqual(2);
    stars.dispose();
  });

  it("places the fall's 170 between 42 and 120 m out", () => {
    expect(FALL).toMatchObject({ count: 170, inner: 42, outer: 120, height: [80, -20], pairs: 6, shells: 3 });
    const stars = buildStars(FALL, 'high');
    const main = cores(stars).filter((o) => o.name.startsWith('stars:star:'));
    expect(cores(stars)).toHaveLength(170);
    for (const s of main) {
      const out = Math.hypot(s.position.x - 1.5, s.position.z + 2);
      expect(out).toBeGreaterThanOrEqual(42);
      expect(out).toBeLessThanOrEqual(120);
      expect(s.position.y).toBeLessThanOrEqual(80);
      expect(s.position.y).toBeGreaterThanOrEqual(-20);
    }
    stars.dispose();
  });

  it('tints them by temperature, the cool and small most common', () => {
    const stars = buildStars(FALL, 'high');
    const all = cores(stars);
    const warm = all.filter((s) => (s.material as THREE.SpriteMaterial).color.r > (s.material as THREE.SpriteMaterial).color.b + 0.02).length;
    const blue = all.filter((s) => (s.material as THREE.SpriteMaterial).color.b > (s.material as THREE.SpriteMaterial).color.r + 0.02).length;
    expect(warm).toBeGreaterThan(blue);
    const sizes = all.map((s) => s.scale.x).sort((a, b) => a - b);
    const middle = (sizes[0]! + sizes.at(-1)!) / 2;
    expect(sizes.filter((x) => x < middle).length / sizes.length).toBeGreaterThan(0.6);
    stars.dispose();
  });

  it('gives spikes only to the brightest', () => {
    const stars = buildStars(FALL, 'high');
    const spikes = stars.group.children.filter((o) => o.name.startsWith('stars:spikes:'));
    expect(spikes.length).toBeGreaterThan(0);
    expect(spikes.length).toBeLessThan(cores(stars).length * 0.3);
    stars.dispose();
  });

  it('halves them on low', () => {
    const stars = buildStars(ROUND, 'low');
    expect(cores(stars)).toHaveLength(22);
    stars.dispose();
  });

  it('stands still with the clock still, and twinkles on it', () => {
    const stars = buildStars(ROUND, 'high');
    stars.pose({ level: 1, clock: 4 });
    const seen = cores(stars).map(opacity);
    stars.pose({ level: 1, clock: 4 });
    expect(cores(stars).map(opacity)).toEqual(seen);
    stars.pose({ level: 1, clock: 6 });
    expect(cores(stars).map(opacity)).not.toEqual(seen);
    stars.pose({ level: 0, clock: 6 });
    expect(stars.group.visible).toBe(false);
    stars.dispose();
  });
});
