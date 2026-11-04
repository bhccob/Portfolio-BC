import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildStars, type StarsModel, starsFall, starsRound } from '~/engine/bob/build/stars';

const ROUND = starsRound([0, 0, 0], -9);
const FALL = starsFall(80, -20, [1.5, -2]);

/** A layer's draw and a uniform of it. */
const draw = (model: StarsModel, name: string): THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> => model.group.getObjectByName(name) as THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;

// The realistic stars Bob approved with the rings (2026-10-29: "more realistic like unique stars"; spec
// 2026-10-29-bob-stack-2-design.md, goal 3), round the stack and along the fall.
describe('the stars', () => {
  it("places 44 stars round the stack, none near its axis", () => {
    expect(ROUND).toMatchObject({ count: 44, inner: 26, outer: 112, height: null, clear: 22, pairs: 4, shells: 2 });
    const model = buildStars(ROUND, 'high');
    expect(model.stars).toHaveLength(44);
    for (const s of model.stars.filter((o) => !o.pair)) expect(Math.hypot(s.at.x, s.at.z)).toBeGreaterThanOrEqual(22);
    expect(model.stars.filter((o) => o.pair).length).toBeLessThanOrEqual(4);
    expect(model.stars.filter((o) => o.shell).length).toBeLessThanOrEqual(2);
    model.dispose();
  });

  it("places the fall's 170 between 42 and 120 m out", () => {
    expect(FALL).toMatchObject({ count: 170, inner: 42, outer: 120, height: [80, -20], pairs: 6, shells: 3 });
    const model = buildStars(FALL, 'high');
    expect(model.stars).toHaveLength(170);
    for (const s of model.stars.filter((o) => !o.pair)) {
      const out = Math.hypot(s.at.x - 1.5, s.at.z + 2);
      expect(out).toBeGreaterThanOrEqual(42);
      expect(out).toBeLessThanOrEqual(120);
      expect(s.at.y).toBeLessThanOrEqual(80);
      expect(s.at.y).toBeGreaterThanOrEqual(-20);
    }
    model.dispose();
  });

  it('tints them by temperature, the cool and small most common', () => {
    const model = buildStars(FALL, 'high');
    const warm = model.stars.filter((s) => s.tint.r > s.tint.b + 0.02).length;
    const blue = model.stars.filter((s) => s.tint.b > s.tint.r + 0.02).length;
    expect(warm).toBeGreaterThan(blue);
    const sizes = model.stars.map((s) => s.size).sort((a, b) => a - b);
    const middle = (sizes[0]! + sizes.at(-1)!) / 2;
    expect(sizes.filter((x) => x < middle).length / sizes.length).toBeGreaterThan(0.6);
    model.dispose();
  });

  it('gives spikes only to the brightest', () => {
    const model = buildStars(FALL, 'high');
    const spiked = model.stars.filter((s) => s.spiked).length;
    expect(spiked).toBeGreaterThan(0);
    expect(spiked).toBeLessThan(model.stars.length * 0.3);
    expect(draw(model, 'stars:spikes').geometry.instanceCount).toBe(spiked);
    model.dispose();
  });

  it('halves them on low', () => {
    const model = buildStars(ROUND, 'low');
    expect(model.stars).toHaveLength(22);
    model.dispose();
  });

  it('draws the whole field in at most four draws, however many stars it has', () => {
    const model = buildStars(FALL, 'high');
    const meshes = model.group.children as THREE.Mesh<THREE.InstancedBufferGeometry>[];
    expect(meshes.map((m) => m.name).sort()).toEqual(['stars:cores', 'stars:glows', 'stars:shells', 'stars:spikes']);
    expect(draw(model, 'stars:cores').geometry.instanceCount).toBe(170);
    expect(draw(model, 'stars:glows').geometry.instanceCount).toBe(170);
    // As their sprites were: additive, never writing depth, and no fog.
    for (const m of meshes) {
      const material = m.material as THREE.ShaderMaterial;
      expect(material.blending).toBe(THREE.AdditiveBlending);
      expect(material.depthWrite).toBe(false);
      expect(material.transparent).toBe(true);
    }
    model.dispose();
  });

  it('twinkles on the clock alone, and hides at level 0', () => {
    const model = buildStars(ROUND, 'high');
    const uniforms = draw(model, 'stars:cores').material.uniforms;
    model.pose({ level: 1, clock: 4 });
    model.group.visible = true;
    expect(uniforms.uClock!.value).toBe(4);
    expect(uniforms.uLevel!.value).toBe(1);
    model.pose({ level: 0.5, clock: 6 });
    expect(uniforms.uClock!.value).toBe(6);
    expect(uniforms.uLevel!.value).toBe(0.5);
    model.pose({ level: 0, clock: 6 });
    expect(model.group.visible).toBe(false);
    model.dispose();
  });
});
