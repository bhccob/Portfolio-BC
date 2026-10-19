import * as THREE from 'three';

/**
 * The handheld's machined shapes. Every part is a rounded rectangle seen from
 * above, swept along a section profile: rings of the outline at different
 * heights and sizes, each carrying the exact surface normal of its place on
 * the profile, so a fillet is truly round to the light and a flat face stays
 * flat right up to its edge (no faceting, no smoothing across the face). A
 * new strip starts a hard edge, a new material group or a new UV layout.
 *
 * Adapted from milestone 1's `parts/slab.ts` (removed with the toy device in milestone 2).
 */

/** Segments in each rounded corner of an outline. */
const CORNER_SEGMENTS = 8;

/** Triangles with less area than this are dropped. */
const DEGENERATE = 1e-14;

/** A rounded rectangle centred on the y axis at height `y`, with the profile normal it carries. */
export interface Ring {
  /** Half the width (x) and half the depth (z). */
  hx: number;
  hz: number;
  /** Corner radius, at most min(hx, hz). */
  r: number;
  y: number;
  /** The surface normal in the profile: `out` along the outline's outward normal, `up` along y. */
  out: number;
  up: number;
}

/**
 * How a strip is laid out in texture space:
 * - `fit`: planar from above, 0..1 across the given half extents, the image's top towards −Z
 *   (three flips textures, so v = 1 is the image's top row);
 * - `world`: planar from above, one tile every `tile` world units, u along x;
 * - `wrap`: u along the outline and v down the profile, one tile every `tile` units
 *   (from u0, v0), so a brushed grain runs round the walls, or a small smooth patch of an
 *   image is drawn out round them.
 */
export type UvLayout =
  | { kind: 'fit'; hx: number; hz: number }
  | { kind: 'world'; tile: number }
  | { kind: 'wrap'; tile: number; u0?: number; v0?: number };

export interface Strip {
  rings: readonly Ring[];
  uv: UvLayout;
  /** Material group index (default 0). */
  group?: number;
}

/** A rounded rectangle's base outline: full width, depth and corner radius. */
export interface Outline {
  width: number;
  depth: number;
  radius: number;
}

/** A point of a section profile: `g` grows the outline outwards (negative: inwards), `a` is the normal's angle (0 out, π/2 up). */
export interface ProfilePoint {
  g: number;
  y: number;
  a: number;
}

/**
 * The fillet of radius `r` rounding the convex corner at (g, y) between the
 * faces whose normals point at angles `a1` and `a2` (a2 > a1, counter-clockwise
 * in the profile). A zero radius gives a hard corner: two points, one per normal.
 */
export function fillet(g: number, y: number, a1: number, a2: number, r: number, steps = 4): ProfilePoint[] {
  if (r <= 0) return [{ g, y, a: a1 }, { g, y, a: a2 }];
  const mid = (a1 + a2) / 2;
  const reach = r / Math.cos((a2 - a1) / 2);
  const cg = g - reach * Math.cos(mid);
  const cy = y - reach * Math.sin(mid);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = a1 + ((a2 - a1) * i) / steps;
    return { g: cg + r * Math.cos(a), y: cy + r * Math.sin(a), a };
  });
}

/** The outline grown by `p.g` at height `p.y`, carrying the point's normal. */
export function ringAt(base: Outline, p: ProfilePoint): Ring {
  return {
    hx: Math.max(0, base.width / 2 + p.g),
    hz: Math.max(0, base.depth / 2 + p.g),
    r: Math.max(0, base.radius + p.g),
    y: p.y,
    out: Math.cos(p.a),
    up: Math.sin(p.a)
  };
}

/** Rings along a profile. */
export function ringsAt(base: Outline, points: readonly ProfilePoint[]): Ring[] {
  return points.map((p) => ringAt(base, p));
}

/** A single point on the y axis, closing a cap like the tip of a fan. */
export function centre(y: number, up: number): Ring {
  return { hx: 0, hz: 0, r: 0, y, out: 0, up };
}

/** The points of one ring, counter-clockwise from +X, with the first repeated at the end (a seam for `wrap` UVs). */
function ringPoints(ring: Ring): { x: number; z: number; nx: number; nz: number }[] {
  const points: { x: number; z: number; nx: number; nz: number }[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const sx = corner === 0 || corner === 3 ? 1 : -1;
    const sz = corner < 2 ? 1 : -1;
    for (let step = 0; step <= CORNER_SEGMENTS; step++) {
      const angle = (corner + step / CORNER_SEGMENTS) * (Math.PI / 2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      points.push({ x: sx * (ring.hx - ring.r) + ring.r * cos, z: sz * (ring.hz - ring.r) + ring.r * sin, nx: cos, nz: sin });
    }
  }
  points.push({ ...points[0] });
  return points;
}

/**
 * Joins the strips' rings into one indexed geometry with a material group per
 * `group` index. Triangles face the way their normals point; collapsed ones
 * are left out.
 */
export function sweep(strips: readonly Strip[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const byGroup = new Map<number, number[]>();

  const triangle = (into: number[], a: number, b: number, c: number): void => {
    const p = (i: number, k: number): number => positions[i * 3 + k];
    const ux = p(b, 0) - p(a, 0);
    const uy = p(b, 1) - p(a, 1);
    const uz = p(b, 2) - p(a, 2);
    const vx = p(c, 0) - p(a, 0);
    const vy = p(c, 1) - p(a, 1);
    const vz = p(c, 2) - p(a, 2);
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < DEGENERATE) return;
    let facing = 0;
    for (const i of [a, b, c]) facing += cx * normals[i * 3] + cy * normals[i * 3 + 1] + cz * normals[i * 3 + 2];
    if (facing < 0) into.push(a, c, b);
    else into.push(a, b, c);
  };

  for (const strip of strips) {
    const group = strip.group ?? 0;
    if (!byGroup.has(group)) byGroup.set(group, []);
    const into = byGroup.get(group)!;
    const first = positions.length / 3;
    let perRing = 0;
    let down = 0;
    strip.rings.forEach((ring, k) => {
      if (k > 0) {
        const prev = strip.rings[k - 1];
        down += Math.hypot(ring.hx - prev.hx, ring.y - prev.y);
      }
      const points = ringPoints(ring);
      perRing = points.length;
      const length = Math.hypot(ring.out, ring.up) || 1;
      let along = 0;
      points.forEach((pt, i) => {
        if (i > 0) along += Math.hypot(pt.x - points[i - 1].x, pt.z - points[i - 1].z);
        positions.push(pt.x, ring.y, pt.z);
        normals.push((ring.out * pt.nx) / length, ring.up / length, (ring.out * pt.nz) / length);
        const uv = strip.uv;
        if (uv.kind === 'fit') uvs.push((pt.x + uv.hx) / (2 * uv.hx), (uv.hz - pt.z) / (2 * uv.hz));
        else if (uv.kind === 'world') uvs.push(pt.x / uv.tile, -pt.z / uv.tile);
        else uvs.push((uv.u0 ?? 0) + along / uv.tile, (uv.v0 ?? 0) - down / uv.tile);
      });
    });
    for (let k = 0; k + 1 < strip.rings.length; k++) {
      const a = first + k * perRing;
      const b = a + perRing;
      for (let i = 0; i + 1 < perRing; i++) {
        triangle(into, a + i, a + i + 1, b + i + 1);
        triangle(into, a + i, b + i + 1, b + i);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const indices: number[] = [];
  [...byGroup.keys()].sort((a, b) => a - b).forEach((group) => {
    const list = byGroup.get(group)!;
    geometry.addGroup(indices.length, list.length, group);
    indices.push(...list);
  });
  geometry.setIndex(indices);
  return geometry;
}

/** What a plate's three surfaces look like. */
export interface PlateFaces {
  top: { uv: UvLayout; group?: number };
  side: { uv: UvLayout; group?: number };
  bottom: { uv: UvLayout; group?: number };
}

/**
 * A solid rounded plate standing on y = 0: the outline from above, its top
 * and bottom edges filleted (each radius capped at half the height and at
 * the corner radius, so a thin plate still keeps its corners).
 */
export function plate(base: Outline, height: number, topEdge: number, bottomEdge: number, faces: PlateFaces): THREE.BufferGeometry {
  const cap = Math.min(height / 2, base.width / 2, base.depth / 2);
  const ft = Math.min(topEdge, cap);
  const fb = Math.min(bottomEdge, cap);
  const lower = fillet(0, 0, -Math.PI / 2, 0, fb, 3);
  const upper = fillet(0, height, 0, Math.PI / 2, ft, 4);
  return sweep([
    { rings: [centre(0, -1), ringAt(base, lower[0])], ...faces.bottom },
    { rings: ringsAt(base, [...lower, ...upper]), ...faces.side },
    { rings: [ringAt(base, upper[upper.length - 1]), centre(height, 1)], ...faces.top }
  ]);
}

/** A flat rounded rectangle facing up at y = 0, UVs fitted across it (upright, image top towards −Z). */
export function panel(base: Outline): THREE.BufferGeometry {
  const fit: UvLayout = { kind: 'fit', hx: base.width / 2, hz: base.depth / 2 };
  return sweep([{ rings: [centre(0, 1), ringAt(base, { g: 0, y: 0, a: Math.PI / 2 })], uv: fit }]);
}

/**
 * A flat band between the outline grown by `inner` and by `outer`, facing up
 * at y = 0: an outline drawn round a part.
 */
export function band(base: Outline, inner: number, outer: number): THREE.BufferGeometry {
  const up = Math.PI / 2;
  return sweep([{ rings: [ringAt(base, { g: inner, y: 0, a: up }), ringAt(base, { g: outer, y: 0, a: up })], uv: { kind: 'world', tile: 1 } }]);
}

/**
 * A half-round bead of radius `r` lying round the outline grown by `g`, in
 * the plane y = 0 and rising towards +y: the polished lip of a port or hole.
 */
export function bead(base: Outline, g: number, r: number): THREE.BufferGeometry {
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI - (i / 6) * Math.PI;
    points.push({ g: g + r * Math.cos(a), y: r * Math.sin(a), a });
  }
  return sweep([{ rings: ringsAt(base, points), uv: { kind: 'world', tile: 1 } }]);
}
