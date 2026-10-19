import * as THREE from 'three';
import { DIAL } from './dialSpec';

/**
 * A flat ring of the dial: in the dial's XZ plane at y = 0, facing +Y, one
 * column of an inner and an outer vertex per step round, the first column
 * repeated at the end so the UVs can close the seam.
 *
 * Two UV layouts:
 *   - `polar` (the pattern ring): u = bearing / 360, clockwise from north, 0 at
 *     north and 1 back at north; v = 0 at the inner edge, 1 at the outer. A
 *     strip canvas has y = 0 at the ring's outer edge, and three.js flips a
 *     CanvasTexture so the canvas top lands at v = 1: outermost.
 *   - `planar` (the painted face): u = 0.5 + x / (2 F), v = 0.5 - z / (2 F)
 *     for the face radius F, so the face canvas lies flat with north up.
 */
export interface Annulus {
  mesh: THREE.Mesh;
  /** Moves the ring's edges in place; throws unless 0 <= inner < outer. */
  setRadii(inner: number, outer: number): void;
}

export interface AnnulusOptions {
  inner: number;
  outer: number;
  /** Steps round the ring (default 256). */
  segments?: number;
  uv: 'polar' | 'planar';
  /** The radius the planar UVs span 0..1 over (default DIAL.face). */
  faceRadius?: number;
}

function checkRadii(inner: number, outer: number): void {
  if (!Number.isFinite(inner) || !Number.isFinite(outer) || inner < 0 || outer <= inner) {
    throw new RangeError(`An annulus needs 0 <= inner < outer, not ${inner} and ${outer}`);
  }
}

export function buildAnnulus(options: AnnulusOptions): Annulus {
  const { inner, outer, segments = 256, uv: layout, faceRadius = DIAL.face } = options;
  checkRadii(inner, outer);
  if (!Number.isInteger(segments) || segments < 3) throw new RangeError(`An annulus needs at least 3 segments, not ${segments}`);
  if (!(faceRadius > 0) || !Number.isFinite(faceRadius)) throw new RangeError(`A face radius must be positive, not ${faceRadius}`);

  const columns = segments + 1;
  const positions = new Float32Array(columns * 2 * 3);
  const normals = new Float32Array(columns * 2 * 3);
  const uvs = new Float32Array(columns * 2 * 2);
  const index: number[] = [];
  for (let i = 0; i < columns; i++) {
    normals.set([0, 1, 0, 0, 1, 0], i * 6);
    if (i < segments) {
      const a = i * 2; // inner, then outer, of this column
      const b = a + 2; // ... and of the next
      // Counter-clockwise seen from +Y.
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  const uv = new THREE.BufferAttribute(uvs, 2);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', uv);
  geometry.setIndex(index);

  const fill = (r0: number, r1: number): void => {
    for (let i = 0; i < columns; i++) {
      const bearing = (i / segments) * 2 * Math.PI;
      const sin = Math.sin(bearing);
      const cos = Math.cos(bearing);
      [r0, r1].forEach((r, k) => {
        const vertex = i * 2 + k;
        const x = r * sin;
        const z = -r * cos;
        positions.set([x, 0, z], vertex * 3);
        if (layout === 'polar') uvs.set([i / segments, k], vertex * 2);
        else uvs.set([0.5 + x / (2 * faceRadius), 0.5 - z / (2 * faceRadius)], vertex * 2);
      });
    }
    position.needsUpdate = true;
    uv.needsUpdate = true;
    geometry.boundingBox = null;
    geometry.boundingSphere = null;
  };
  fill(inner, outer);

  const mesh = new THREE.Mesh(geometry);
  return {
    mesh,
    setRadii(r0: number, r1: number): void {
      checkRadii(r0, r1);
      fill(r0, r1);
    }
  };
}
