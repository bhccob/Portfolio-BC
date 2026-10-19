import { describe, expect, it } from 'vitest';
import { HUB_LAYERS, hubPoseAt } from '../../src/scripts/three/HubChoreography';
describe('hubPoseAt', () => {
  it('is closed at 0 and fully apart at 1', () => {
    expect(hubPoseAt(0).explode).toBe(0);
    expect(hubPoseAt(0).offsets).toEqual({ screen: 0.29, frame: 0.05, board: 0.19, battery: 0.05, back: 0 });
    expect(hubPoseAt(1).explode).toBe(1);
  });
  it('orders the layers top to bottom when apart', () => {
    const ys = HUB_LAYERS.map((l) => hubPoseAt(1).offsets[l]);
    ys.slice(1).forEach((y, k) => expect(y).toBeLessThan(ys[k]));
  });
  it('clamps and never returns NaN', () => {
    expect(hubPoseAt(-1)).toEqual(hubPoseAt(0)); expect(hubPoseAt(2)).toEqual(hubPoseAt(1));
    expect(hubPoseAt(Number.NaN)).toEqual(hubPoseAt(0)); expect(hubPoseAt(Infinity)).toEqual(hubPoseAt(1));
    for (let i = 0; i <= 100; i++) {
      const p = hubPoseAt(i / 100);
      [...p.camera.position, ...p.camera.target, p.explode, p.callouts].forEach((n) => expect(Number.isFinite(n)).toBe(true));
    }
  });
  it('opens monotonically and shows callouts only near the hub', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) { const e = hubPoseAt(i / 100).explode; expect(e).toBeGreaterThanOrEqual(last); last = e; }
    expect(hubPoseAt(0.3).callouts).toBe(0); expect(hubPoseAt(0.6).callouts).toBe(1);
  });
});
