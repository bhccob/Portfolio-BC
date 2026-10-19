import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildHandheld, PROJECT_CHIPS } from '../../src/scripts/three/device/Handheld';
import { HUB_LAYERS, hubPoseAt } from '../../src/scripts/three/HubChoreography';
describe('buildHandheld', () => {
  const h = buildHandheld();
  it('has the five layers inside the group', () => HUB_LAYERS.forEach((id) => expect(h.layers[id].parent).toBe(h.group)));
  it('carries the project chips in order, apart from the processor', () => {
    expect(h.chips.map((c) => c.userData.slug)).toEqual([...PROJECT_CHIPS]);
    expect(h.processor.userData.slug).toBe('bc-2006');
    expect(h.chips).not.toContain(h.processor);
    h.chips.forEach((c) => expect(c.parent === h.layers.board || c.parent?.parent === h.layers.board).toBe(true));
  });
  it('applies a pose to layer heights', () => {
    const pose = hubPoseAt(0.7); h.applyPose(pose);
    HUB_LAYERS.forEach((id) => expect(h.layers[id].position.y).toBeCloseTo(pose.offsets[id]));
  });
  it('has finite geometry everywhere', () => {
    h.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      const pos = g?.getAttribute?.('position');
      if (pos) for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
    });
  });
  it('stacks screen, board, battery and back without overlapping when closed', () => {
    h.applyPose(hubPoseAt(0)); h.group.updateMatrixWorld(true);
    const span = (id: 'screen' | 'board' | 'battery' | 'back') => new THREE.Box3().setFromObject(h.layers[id]);
    const order = (['back', 'battery', 'board', 'screen'] as const).map(span);
    order.slice(1).forEach((b, k) => expect(b.min.y).toBeGreaterThanOrEqual(order[k].max.y - 1e-3));
  });
});
