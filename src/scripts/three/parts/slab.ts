import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { palette } from '../palette';

/**
 * Rounded slabs, the device's basic part: boxes with rounded corners and soft
 * edges in a satin finish. RoundedBoxGeometry gives one radius to every edge
 * and caps it at half the smallest side, so a thin plate would lose its
 * corners; plates whose corners are rounder than half their height come from
 * `sweep` instead, which keeps the full corner radius seen from above and
 * softens the edges as far as the height allows.
 */

/** Segments in each rounded corner of an outline (a full circle gets four times this). */
const CORNER_SEGMENTS = 8;

/** Segments in each quarter of an edge fillet. */
const FILLET_SEGMENTS = 3;

/** Segments in each rounded edge of a RoundedBoxGeometry. */
const BOX_SEGMENTS = 3;

/** Satin: no metal, a soft highlight. */
const DEFAULT_ROUGHNESS = 0.5;
const CLEARCOAT_ROUGHNESS = 0.35;

/** Triangles with less area than this are dropped from a sweep. */
const DEGENERATE = 1e-14;

/** A rounded rectangle centred on the y axis at height `y`, with the surface normal it carries. */
export interface Ring {
  /** Half the width (x) and half the depth (z). */
  hx: number;
  hz: number;
  /** Corner radius, at most min(hx, hz); 0 gives sharp corners, and 0 everywhere a single point. */
  r: number;
  y: number;
  /** The surface normal in the profile: `out` along the outline's outward normal, `up` along y. */
  out: number;
  up: number;
}

/** Rings joined smoothly, in order; where two strips meet there is a hard edge. */
export interface Strip {
  rings: readonly Ring[];
  /** A vertex colour for the whole strip; any strip with one gives the geometry a colour attribute. */
  color?: number;
}

export interface Finish {
  /** 0.45 to 0.6 keeps the satin look. */
  roughness?: number;
  /** 0.3 on the case parts. */
  clearcoat?: number;
}

/** The device's satin plastic in one colour. */
export function satin(color: number, finish: Finish = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: finish.roughness ?? DEFAULT_ROUGHNESS,
    clearcoat: finish.clearcoat ?? 0,
    clearcoatRoughness: CLEARCOAT_ROUGHNESS
  });
}

let goldMaterial: THREE.MeshPhysicalMaterial | undefined;

/** The one gold of every pin, trace and tab: a satin metal, shared by them all. */
export function gold(): THREE.MeshPhysicalMaterial {
  goldMaterial ??= new THREE.MeshPhysicalMaterial({ color: palette.gold, metalness: 1, roughness: 0.45 });
  return goldMaterial;
}

/**
 * Joins rounded-rectangle rings into a surface. Every ring has the same
 * points at the same angles, so neighbouring rings stitch into quads whatever
 * their size. Triangles face the way their normals point; collapsed ones
 * (a ring shrunk to a point, a straight side of no length) are left out.
 * UVs are planar from above: u runs along x, v from the near edge (+z) to the
 * far one, so an image reads upright to a viewer in front of the device.
 */
export function sweep(strips: readonly Strip[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const coloured = strips.some((strip) => strip.color !== undefined);
  const tint = new THREE.Color();
  const perRing = 4 * (CORNER_SEGMENTS + 1);

  const triangle = (a: number, b: number, c: number): void => {
    const ux = positions[b * 3] - positions[a * 3];
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3];
    const vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    const vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < DEGENERATE) return;
    let facing = 0;
    for (const i of [a, b, c]) {
      facing += cx * normals[i * 3] + cy * normals[i * 3 + 1] + cz * normals[i * 3 + 2];
    }
    if (facing < 0) indices.push(a, c, b);
    else indices.push(a, b, c);
  };

  for (const strip of strips) {
    tint.set(strip.color ?? 0xffffff);
    const first = positions.length / 3;
    for (const ring of strip.rings) {
      const length = Math.hypot(ring.out, ring.up) || 1;
      for (let corner = 0; corner < 4; corner++) {
        const sx = corner === 0 || corner === 3 ? 1 : -1;
        const sz = corner < 2 ? 1 : -1;
        for (let step = 0; step <= CORNER_SEGMENTS; step++) {
          const angle = (corner + step / CORNER_SEGMENTS) * (Math.PI / 2);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          positions.push(sx * (ring.hx - ring.r) + ring.r * cos, ring.y, sz * (ring.hz - ring.r) + ring.r * sin);
          normals.push((ring.out * cos) / length, ring.up / length, (ring.out * sin) / length);
          if (coloured) colors.push(tint.r, tint.g, tint.b);
        }
      }
    }
    for (let k = 0; k + 1 < strip.rings.length; k++) {
      const a = first + k * perRing;
      const b = a + perRing;
      for (let i = 0; i < perRing; i++) {
        const next = (i + 1) % perRing;
        triangle(a + i, a + next, b + next);
        triangle(a + i, b + next, b + i);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(planarUv(positions), 2));
  if (coloured) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function planarUv(positions: readonly number[]): number[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const spanX = maxX - minX || 1;
  const spanZ = maxZ - minZ || 1;
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    uv.push((positions[i] - minX) / spanX, (maxZ - positions[i + 2]) / spanZ);
  }
  return uv;
}

/** A single point on the y axis, closing a sweep like the tip of a fan. */
function centre(y: number, up: number): Ring {
  return { hx: 0, hz: 0, r: 0, y, out: 0, up };
}

/**
 * The outline of a `width` × `depth` rounded rectangle grown by `grow` on
 * every side (a negative value shrinks it, as an inset of the outline would).
 */
export function outline(width: number, depth: number, radius: number, grow: number, y: number, out: number, up: number): Ring {
  return { hx: width / 2 + grow, hz: depth / 2 + grow, r: Math.max(0, radius + grow), y, out, up };
}

/** A solid plate centred on its origin: full corner radius from above, edges filleted up to half the height. */
function plate(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
  const corner = Math.min(radius, width / 2, depth / 2);
  const fillet = Math.min(corner, height / 2);
  const rings: Ring[] = [centre(-height / 2, -1)];
  for (const side of [-1, 1]) {
    const middle = side * (height / 2 - fillet);
    for (let step = 0; step <= FILLET_SEGMENTS; step++) {
      // The bottom fillet turns from facing down to facing out, the top one from out to up.
      const phi = ((side < 0 ? step - FILLET_SEGMENTS : step) / FILLET_SEGMENTS) * (Math.PI / 2);
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      rings.push(outline(width, depth, corner, -fillet * (1 - cos), middle + fillet * sin, cos, sin));
    }
  }
  rings.push(centre(height / 2, 1));
  return sweep([{ rings }]);
}

/**
 * The geometry of a slab centred on its origin. `radius` rounds the corners
 * seen from above; the edges take the same radius, up to half the height.
 */
export function slabGeometry(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
  if (radius <= Math.min(width, height, depth) / 2) {
    return new RoundedBoxGeometry(width, height, depth, BOX_SEGMENTS, radius);
  }
  return plate(width, height, depth, radius);
}

/** A rounded satin slab centred on its origin (see `slabGeometry`). */
export function slab(width: number, height: number, depth: number, radius: number, color: number, finish: Finish = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(slabGeometry(width, height, depth, radius), satin(color, finish));
  mesh.name = 'slab';
  return mesh;
}

/** A flat rounded rectangle facing up, centred on its origin, with UVs across it (0 to 1, upright). */
export function panelGeometry(width: number, depth: number, radius: number): THREE.BufferGeometry {
  const corner = Math.min(radius, width / 2, depth / 2);
  return sweep([{ rings: [centre(0, 1), outline(width, depth, corner, 0, 0, 0, 1)] }]);
}

/** The top case of the handheld: a rounded lid with a window, its walls hanging below. */
export interface CaseShape {
  width: number;
  depth: number;
  radius: number;
  /** Thickness of the top; the top surface is at this height, its underside at 0. */
  top: number;
  /** Thickness of the side walls. */
  wall: number;
  /** How far the walls reach below the origin. */
  drop: number;
  /** The window through the top, centred. */
  opening: { width: number; depth: number; radius: number };
}

/** Fillet on the case's top outer edge: chunky, as on a toy. */
const CASE_TOP_EDGE = 0.05;

/** Fillet where the walls meet the back plate, so the seam reads as a soft groove. */
const CASE_BOTTOM_EDGE = 0.015;

/** Fillet on the window's rim. */
const CASE_LIP = 0.015;

/** Rings rounding an edge with radius `fillet`, from angle `from` to `to` (radians; 0 faces out, a quarter turn up). */
function arc(
  ring: (grow: number, y: number, out: number, up: number) => Ring,
  fillet: number,
  middle: number,
  from: number,
  to: number,
  steps: number
): Ring[] {
  return Array.from({ length: steps + 1 }, (_, step) => {
    const phi = from + ((to - from) * step) / steps;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    return ring(-fillet * (1 - cos), middle + fillet * sin, cos, sin);
  });
}

/**
 * The case as one closed surface: the outer wall rising into the rounded top
 * edge, the top across to the window, the window's rim and wall, then the
 * underside, the inner wall and the rim the walls stand on.
 */
export function caseGeometry(shape: CaseShape): THREE.BufferGeometry {
  const { width, depth, radius, top, wall, drop, opening } = shape;
  const rim = -drop;
  const body = (grow: number, y: number, out: number, up: number): Ring => outline(width, depth, radius, grow, y, out, up);
  const hole = (grow: number, y: number, out: number, up: number): Ring =>
    outline(opening.width, opening.depth, opening.radius, grow, y, out, up);
  const inner = (y: number, out: number, up: number): Ring => body(-wall, y, out, up);

  const outside: Ring[] = [
    ...arc(body, CASE_BOTTOM_EDGE, rim + CASE_BOTTOM_EDGE, -Math.PI / 2, 0, 2),
    ...arc(body, CASE_TOP_EDGE, top - CASE_TOP_EDGE, 0, Math.PI / 2, 4)
  ];
  // The window's rim rounds over from the top into the window, so its normals turn inwards.
  for (let step = 0; step <= 2; step++) {
    const psi = (step / 2) * (Math.PI / 2);
    const cos = Math.cos(psi);
    const sin = Math.sin(psi);
    outside.push(hole(CASE_LIP * (1 - sin), top - CASE_LIP + CASE_LIP * cos, -sin, cos));
  }
  outside.push(hole(0, 0, -1, 0));

  return sweep([
    { rings: outside },
    { rings: [hole(0, 0, 0, -1), inner(0, 0, -1)] },
    { rings: [inner(0, -1, 0), inner(rim, -1, 0)] },
    { rings: [inner(rim, 0, -1), body(-CASE_BOTTOM_EDGE, rim, 0, -1)] }
  ]);
}
