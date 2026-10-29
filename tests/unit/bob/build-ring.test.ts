import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { RING_MARKS } from '~/data/qa';
import { buildRing, type RingModel, type RingPose } from '~/engine/bob/build/ring';
import { RING, ringTurnFor } from '~/scene/bob/qaRing';

const pose = (over: Partial<RingPose> = {}): RingPose => ({
  centre: [0, 0, 0],
  scale: 1,
  turn: 0,
  level: 1,
  close: 1,
  place: 0,
  lit: 0,
  flash: null,
  clock: 0,
  ...over
});
const named = (model: RingModel, name: string): THREE.Object3D => {
  const found = model.group.getObjectByName(name);
  if (!found) throw new Error(`no part named ${name}`);
  return found;
};
/** How bright mark `k`'s light is, its glow's opacity. */
const glowOf = (model: RingModel, k: number): number => ((named(model, `ring:mark:${k}:glow`) as THREE.Sprite).material as THREE.SpriteMaterial).opacity;

// The Q&A's gold ring round the stack (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up's make).
describe('the ring', () => {
  it('builds a mark per question and a bigger last one', () => {
    const ring = buildRing(RING_MARKS, null);
    for (let k = 0; k < RING_MARKS; k++) named(ring, `ring:mark:${k}`);
    expect(ring.group.getObjectByName(`ring:mark:${RING_MARKS}`)).toBeUndefined();
    const plate = (k: number) => ((named(ring, `ring:mark:${k}:plate`) as THREE.Mesh).geometry as THREE.BoxGeometry).parameters;
    expect(plate(RING_MARKS - 1).depth).toBeGreaterThan(plate(0).depth);
    // The end's mark has a gold ring standing on it; no other has.
    named(ring, `ring:mark:${RING_MARKS - 1}:seal`);
    expect(ring.group.getObjectByName('ring:mark:0:seal')).toBeUndefined();
    named(ring, 'ring:band');
    named(ring, 'ring:dial');
    ring.dispose();
  });

  it('is hidden at level 0', () => {
    const ring = buildRing(RING_MARKS, null);
    ring.pose(pose({ level: 0 }));
    expect(ring.group.visible).toBe(false);
    ring.pose(pose({ level: 0.5 }));
    expect(ring.group.visible).toBe(true);
    ring.dispose();
  });

  it('puts mark k at the front at its turn', () => {
    const ring = buildRing(RING_MARKS, null);
    const at = new THREE.Vector3();
    for (let k = 0; k < RING_MARKS; k++) {
      ring.pose(pose({ turn: ringTurnFor(k, RING_MARKS), place: k }));
      ring.markAt(k, at);
      expect(Math.atan2(at.x, at.z), `mark ${k}`).toBeCloseTo(RING.azimuth, 6);
      expect(Math.hypot(at.x, at.z)).toBeCloseTo(RING.radius, 1);
    }
    // Where it stands and how big: its middle and its scale.
    ring.pose(pose({ centre: [2, 5, -1], scale: 0.5, turn: ringTurnFor(0, RING_MARKS) }));
    ring.markAt(0, at);
    expect(Math.hypot(at.x - 2, at.z + 1)).toBeCloseTo(RING.radius * 0.5, 1);
    ring.dispose();
  });

  it('lights the mark it is at, and all its marks at lit 1', () => {
    const ring = buildRing(RING_MARKS, null);
    ring.pose(pose({ place: 2 }));
    expect(glowOf(ring, 2)).toBeGreaterThan(glowOf(ring, 4));
    ring.pose(pose({ place: 6, lit: 1 }));
    const all = Array.from({ length: RING_MARKS }, (_, k) => glowOf(ring, k));
    for (const g of all) expect(g).toBeCloseTo(all[RING_MARKS - 1]!, 6);
    // The mark it lands on flashes: its light, already whole, swells.
    ring.pose(pose({ place: 3 }));
    const still = named(ring, 'ring:mark:3:glow').scale.x;
    ring.pose(pose({ place: 3, flash: { mark: 3, amount: 0.8 } }));
    expect(named(ring, 'ring:mark:3:glow').scale.x).toBeGreaterThan(still);
    ring.dispose();
  });

  it('frees everything it made', () => {
    const ring = buildRing(RING_MARKS, null);
    const spies: ReturnType<typeof vi.fn>[] = [];
    ring.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) spies.push(vi.spyOn(mesh.geometry, 'dispose') as unknown as ReturnType<typeof vi.fn>);
      const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const m of materials) spies.push(vi.spyOn(m, 'dispose') as unknown as ReturnType<typeof vi.fn>);
    });
    ring.dispose();
    expect(spies.length).toBeGreaterThan(5);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});
