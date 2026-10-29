import { describe, expect, it } from 'vitest';
import { nearestSphere } from '~/scene/bob/voidPose';

describe('which project the pointer is on', () => {
  it('picks the sphere whose middle the ray passes nearest, not the nearest to the camera', () => {
    // A big sphere in front, a small one behind it, the ray straight through the small one's middle and the big one's edge.
    const spheres = [
      { centre: [0.9, 0, -10] as const, radius: 1.1 },
      { centre: [0, 0, -14] as const, radius: 0.5 }
    ];
    expect(nearestSphere([0, 0, 0], [0, 0, -1], spheres)).toBe(1);
    // Through the big one's middle: the big one.
    expect(nearestSphere([0.9, 0, 0], [0, 0, -1], spheres)).toBe(0);
  });

  it('picks none when the ray passes through no sphere, or only behind the camera', () => {
    const spheres = [{ centre: [3, 0, -10] as const, radius: 1 }];
    expect(nearestSphere([0, 0, 0], [0, 0, -1], spheres)).toBeNull();
    expect(nearestSphere([3, 0, 0], [0, 0, 1], spheres)).toBeNull();
    expect(nearestSphere([0, 0, 0], [0, 0, -1], [])).toBeNull();
  });
});
