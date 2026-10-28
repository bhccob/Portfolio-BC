import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot } from '~/engine/bob/shots';
import { fitDistance, project } from '~/scene/bob/fit';

type Vec3 = [number, number, number];
const DEG = Math.PI / 180;

/** What three makes of `p` for `shot`, NDC. */
function three(p: Vec3, shot: CameraShot, aspect: number): { x: number; y: number } {
  const camera = new PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  const v = new Vector3(...p).project(camera);
  return { x: v.x, y: v.y };
}

describe('framing by fit', () => {
  it('projects the target to the middle and a point to its right to the right', () => {
    const shot: CameraShot = { position: [2, 5, 12], target: [0, 1, 0], fov: 38 };
    const middle = project([0, 1, 0], shot, 1.6);
    expect(middle.x).toBeCloseTo(0, 12);
    expect(middle.y).toBeCloseTo(0, 12);
    expect(middle.front).toBe(true);
    const right = project([3, 1, 0], shot, 1.6);
    expect(right.x).toBeGreaterThan(0);
    // The very projection three makes, for points all round.
    for (const p of [[3, 1, 0], [-2, 4, 1], [1, -3, -4], [0.5, 2, 6]] as Vec3[]) {
      for (const aspect of [1.6, 390 / 844]) {
        const ours = project(p, shot, aspect);
        const theirs = three(p, shot, aspect);
        expect(ours.x).toBeCloseTo(theirs.x, 9);
        expect(ours.y).toBeCloseTo(theirs.y, 9);
      }
    }
    // Behind the camera is not in front.
    expect(project([4, 10, 24], shot, 1.6).front).toBe(false);
  });

  it('finds the nearest distance that holds every point inside the box', () => {
    const ring: Vec3[] = Array.from({ length: 48 }, (_, k) => {
      const a = (k / 48) * Math.PI * 2;
      return [Math.sin(a) * 6.2, -5.6, Math.cos(a) * 6.2];
    });
    const target: Vec3 = [0, -5.4, 0];
    const box = [-0.64, 0.64, -0.64, 0.64] as const;
    for (const [aspect, azimuth, elevation, fov] of [
      [1.6, -40 * DEG, 17 * DEG, 38],
      [390 / 844, 35 * DEG, 14 * DEG, 58],
      [1.6, 0, 30 * DEG, 38]
    ] as const) {
      const out: Vec3 = [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];
      const at = (d: number): CameraShot => ({ position: [target[0] + out[0] * d, target[1] + out[1] * d, target[2] + out[2] * d], target, fov });
      const inside = (shot: CameraShot): boolean =>
        ring.every((p) => {
          const s = project(p, shot, aspect);
          return s.front && s.x >= box[0] && s.x <= box[1] && s.y >= box[2] && s.y <= box[3];
        });
      const d = fitDistance(ring, target, azimuth, elevation, fov, aspect, box);
      expect(d).toBeGreaterThan(4);
      expect(d).toBeLessThan(120);
      expect(inside(at(d))).toBe(true);
      expect(inside(at(d * 0.98))).toBe(false);
    }
  });
});
