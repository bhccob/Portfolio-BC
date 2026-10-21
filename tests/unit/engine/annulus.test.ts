import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildAnnulus } from '~/engine/instrument/Annulus';
import { DIAL } from '~/engine/instrument/dialSpec';

/** The UV of the vertex nearest a dial-local point on the face. */
function uvNear(geometry: THREE.BufferGeometry, x: number, z: number): [number, number] {
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const d = (pos.getX(i) - x) ** 2 + (pos.getZ(i) - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return [uv.getX(best), uv.getY(best)];
}

describe('an annulus', () => {
  it('faces +Y, flat at y 0, between its radii', () => {
    const { mesh } = buildAnnulus({ inner: 0.42, outer: 0.56, uv: 'planar' });
    const g = mesh.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBe(0);
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      expect(r).toBeGreaterThan(0.42 - 1e-6); expect(r).toBeLessThan(0.56 + 1e-6);
    }
    const index = g.getIndex()!;
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, index.getX(t + k)));
      const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
      expect(normal.y).toBeGreaterThan(0);
    }
  });
  it('lays polar UVs as bearing / 360 round and 0 → 1 outwards', () => {
    const g = buildAnnulus({ inner: 0.72, outer: 1, uv: 'polar' }).mesh.geometry as THREE.BufferGeometry;
    const [uEast, vEastOuter] = uvNear(g, 1, 0);
    expect(uEast).toBeCloseTo(0.25, 3); expect(vEastOuter).toBe(1);
    const [uSouth, vSouthInner] = uvNear(g, 0, 0.72);
    expect(uSouth).toBeCloseTo(0.5, 3); expect(vSouthInner).toBe(0);
    const [uWest] = uvNear(g, -1, 0);
    expect(uWest).toBeCloseTo(0.75, 3);
  });
  it('lays planar UVs over the face: north up, east right', () => {
    const g = buildAnnulus({ inner: 0.58, outer: 0.7, uv: 'planar' }).mesh.geometry as THREE.BufferGeometry;
    const [uNorth, vNorth] = uvNear(g, 0, -0.7);
    expect(uNorth).toBeCloseTo(0.5, 5); expect(vNorth).toBeCloseTo(0.5 + 0.7 / (2 * DIAL.face), 5);
    const [uEast, vEast] = uvNear(g, 0.7, 0);
    expect(uEast).toBeCloseTo(0.5 + 0.7 / (2 * DIAL.face), 5); expect(vEast).toBeCloseTo(0.5, 5);
  });
  it('rebuilds a ring at new radii, with UVs in range', () => {
    const a = buildAnnulus({ inner: 0.72, outer: 1, uv: 'polar' }); a.setRadii(0.1, 1); const g = a.mesh.geometry as THREE.BufferGeometry;
    g.computeBoundingSphere(); expect(g.boundingSphere!.radius).toBeCloseTo(1, 2);
    const uv = g.getAttribute('uv'); for (let i = 0; i < uv.array.length; i++) { expect(uv.array[i]).toBeGreaterThanOrEqual(0); expect(uv.array[i]).toBeLessThanOrEqual(1); }
    expect(() => a.setRadii(1, 0.5)).toThrow();
  });
  it('refuses radii that are not a ring', () => {
    expect(() => buildAnnulus({ inner: 0.5, outer: 0.5, uv: 'polar' })).toThrow();
    expect(() => buildAnnulus({ inner: -0.1, outer: 0.5, uv: 'polar' })).toThrow();
    expect(() => buildAnnulus({ inner: 0.1, outer: Number.NaN, uv: 'planar' })).toThrow();
  });
});
