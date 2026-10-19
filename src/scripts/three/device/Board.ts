import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DeviceMaterials } from './materials';
import { canPaint, paintChipTops, type ChipTop } from './print';
import { centre, fillet, plate, ringAt, ringsAt, sweep, type Outline } from './shapes';
import { FOOTPRINTS, type UvRect } from './textures';
import { instanced } from './hardware';

/**
 * The board: a 3.0 × 1.69 × 0.04 PCB with pcb.webp printed on its top. The
 * chips stand exactly on the footprints printed there (FOOTPRINTS, mapped
 * from the image to the board's top with the image's top towards −Z): three
 * project chips and the larger BC-2006 processor, black epoxy QFPs on gull-
 * wing leads with their names in white; the empty Next footprint gets a low
 * socket frame with gold contacts and no chip. A flex cable runs from the J1
 * connector over the +Z edge and down to the battery, and is re-laid every
 * pose so it always spans the gap.
 */

export const BOARD: Outline = { width: 3.0, depth: 1.69, radius: 0.05 };
export const BOARD_THICKNESS = 0.04;

/** The project chips, in the order the hub lists them. */
export const PROJECT_CHIPS = ['funcial', 'jontai-energy', 'cookies-clicker', 'next'] as const;

/** What the chips say when no label is handed in. */
const DEFAULT_NAMES: Readonly<Record<string, string>> = {
  funcial: 'Funcial',
  'jontai-energy': 'Jontai Energy',
  'cookies-clicker': 'Cookies Clicker',
  'bc-2006': 'BC-2006'
};

/** A chip package, sized to its footprint (measured on the board texture). */
interface Package {
  /** From the footprint's edge to the body's (the pad ring and the gap inside it). */
  inset: number;
  height: number;
  /** Leads per side, their pitch and width. */
  leads: number;
  pitch: number;
  leadWidth: number;
}

/** U2..U4: 13 pads a side at 0.0176, the body inside the silkscreen square. */
const SMALL_QFP: Package = { inset: 0.031, height: 0.04, leads: 13, pitch: 0.0176, leadWidth: 0.0085 };

/** U1: 30 pads a side at 0.0156. */
const LARGE_QFP: Package = { inset: 0.038, height: 0.045, leads: 30, pitch: 0.0156, leadWidth: 0.0072 };

/** The gap under a chip's body where the leads leave it. */
const LIFT = 0.004;

/** A footprint's centre and size on the board's top (local x, z). */
export interface Spot {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/** A footprint in the image (origin top-left) as a spot on the board: image top → −Z. */
export function spotOf(rect: UvRect): Spot {
  return {
    x: ((rect.u0 + rect.u1) / 2 - 0.5) * BOARD.width,
    z: ((rect.v0 + rect.v1) / 2 - 0.5) * BOARD.depth,
    width: (rect.u1 - rect.u0) * BOARD.width,
    depth: (rect.v1 - rect.v0) * BOARD.depth
  };
}

/** One gull-wing lead pointing +Z from the body's edge at z = 0 to `reach`, standing on y = 0. */
function leadGeometry(pkg: Package, reach: number): THREE.BufferGeometry {
  const t = 0.0028;
  const w = pkg.leadWidth;
  const exit = LIFT + pkg.height * 0.38;
  const shoulder = new THREE.BoxGeometry(w, t, 0.009).translate(0, exit, 0.0025);
  const run = 0.005;
  const drop = exit - t / 2;
  const leg = new THREE.BoxGeometry(w, Math.hypot(run, drop), t)
    .rotateX(Math.atan2(-run, drop))
    .translate(0, (exit + t / 2) / 2, 0.007 + run / 2);
  const footStart = 0.0105;
  const foot = new THREE.BoxGeometry(w, t, reach - footStart).translate(0, t / 2, (footStart + reach) / 2);
  const lead = mergeGeometries([shoulder, leg, foot])!;
  shoulder.dispose();
  leg.dispose();
  foot.dispose();
  return lead;
}

/** A QFP standing on `spot`, its origin on the board's top at the footprint's centre. */
function qfp(
  slug: string,
  spot: Spot,
  pkg: Package,
  m: DeviceMaterials,
  top: THREE.Material | undefined,
  leadMaterial: THREE.Material
): THREE.Mesh {
  const width = spot.width - 2 * pkg.inset;
  const depth = spot.depth - 2 * pkg.inset;
  const geometry = plate({ width, depth, radius: 0.012 }, pkg.height, 0.008, 0.003, {
    top: { uv: { kind: 'fit', hx: width / 2, hz: depth / 2 }, group: 1 },
    side: { uv: { kind: 'wrap', tile: 0.5 } },
    bottom: { uv: { kind: 'world', tile: 0.5 } }
  }).translate(0, LIFT, 0);
  const body = new THREE.Mesh(geometry, top ? [m.epoxy, top] : m.epoxy);
  body.position.set(spot.x, BOARD_THICKNESS, spot.z);
  body.name = `chip:${slug}`;
  body.userData.slug = slug;

  const reach = pkg.inset - 0.003;
  const spots: [number, number, number][] = [];
  const yaw: number[] = [];
  for (let i = 0; i < pkg.leads; i++) {
    const along = (i - (pkg.leads - 1) / 2) * pkg.pitch;
    spots.push([along, 0, depth / 2], [width / 2, 0, -along], [-along, 0, -depth / 2], [-width / 2, 0, along]);
    yaw.push(0, Math.PI / 2, Math.PI, -Math.PI / 2);
  }
  body.add(instanced(leadGeometry(pkg, reach), leadMaterial, spots, `chip:${slug}:leads`, yaw));
  return body;
}

/** The socket frame's height, and how far it reaches out past the footprint and in over its pads. */
const SOCKET_HEIGHT = 0.022;
const SOCKET_OUT = 0.008;
const SOCKET_IN = 0.046;

/**
 * The empty Next socket: a low dark frame over the footprint's pads with gold
 * contacts on its top, open in the middle so the printed footprint shows. Its
 * floor is never drawn but answers rays, so the whole footprint picks as one.
 */
function socket(spot: Spot, m: DeviceMaterials): THREE.Mesh {
  const base: Outline = { width: spot.width, depth: spot.depth, radius: 0.02 };
  const quarter = Math.PI / 2;
  const H = SOCKET_HEIGHT;
  const profile = [
    ...fillet(SOCKET_OUT, 0, -quarter, 0, 0),
    ...fillet(SOCKET_OUT, H, 0, quarter, 0.004, 3),
    ...fillet(-SOCKET_IN, H, quarter, Math.PI, 0.004, 3),
    ...fillet(-SOCKET_IN, 0, Math.PI, 3 * quarter, 0)
  ];
  const geometry = sweep([
    { rings: ringsAt(base, profile), uv: { kind: 'world', tile: 0.5 } },
    {
      rings: [ringAt(base, { g: -SOCKET_IN, y: 0.001, a: quarter }), centre(0.001, 1)],
      uv: { kind: 'world', tile: 0.5 },
      group: 1
    }
  ]);
  const mesh = new THREE.Mesh(geometry, [m.plastic, m.pickOnly]);
  mesh.position.set(spot.x, BOARD_THICKNESS, spot.z);
  mesh.name = 'chip:next';
  mesh.userData.slug = 'next';

  // Gold contact fingers across the frame's top, pointing in.
  const length = 0.028;
  const contact = new THREE.BoxGeometry(0.0075, 0.0022, length);
  const mid = SOCKET_IN - 0.004 - length / 2;
  const spots: [number, number, number][] = [];
  const yaw: number[] = [];
  const side = (span: number): number[] => {
    const count = Math.floor((span - 0.1) / 0.022);
    return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * 0.022);
  };
  const y = H + 0.0011;
  for (const along of side(spot.width)) {
    spots.push([along, y, spot.depth / 2 - mid], [along, y, -spot.depth / 2 + mid]);
    yaw.push(0, 0);
  }
  for (const along of side(spot.depth)) {
    spots.push([spot.width / 2 - mid, y, along], [-spot.width / 2 + mid, y, along]);
    yaw.push(Math.PI / 2, Math.PI / 2);
  }
  mesh.add(instanced(contact, m.gold, spots, 'chip:next:contacts', yaw));
  return mesh;
}

/**
 * The flex cable's half-width where it leaves J1, the half-width it necks
 * down to before the bend, the bend radius and where it turns down (just
 * past the board's +Z edge).
 */
const FLEX_HALF = 0.43;
const FLEX_NECK = 0.16;
const FLEX_BEND = 0.02;
const FLEX_DOWN_Z = BOARD.depth / 2 + 0.03;
/** It leaves J1's latch at this z and this height above the board's top. */
const FLEX_START_Z = 0.735;
const FLEX_RISE = 0.012;
/** Segments in each of the flex's two bends. */
const FLEX_STEPS = 8;
/** World units per repeat of the flex's trace texture along its length. */
const FLEX_TILE = 0.25;

export interface BoardParts {
  object: THREE.Group;
  chips: THREE.Mesh[];
  processor: THREE.Mesh;
  /**
   * Lays the flex from J1 to where it lands on the battery's connector:
   * `landY` is that height in the board's own frame, `landZ` its z.
   */
  setFlex(landY: number, landZ: number): void;
  /** Paints the chip names again (once the font has loaded). */
  redraw(): void;
}

/** Points along the flex: four on the top run (two wide, the neck, the bend's start), the two bends, the turn at the bottom and the end. */
const FLEX_POINTS = 2 * FLEX_STEPS + 6;

function flexGeometry(): THREE.BufferGeometry {
  const points = FLEX_POINTS;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(points * 2 * 3), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(points * 2 * 3), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(points * 2 * 2), 2));
  const indices: number[] = [];
  for (let i = 0; i + 1 < points; i++) {
    const a = 2 * i;
    indices.push(a, a + 3, a + 1, a, a + 2, a + 3);
  }
  geometry.setIndex(indices);
  return geometry;
}

function layFlex(geometry: THREE.BufferGeometry, landY: number, landZ: number): void {
  const top = BOARD_THICKNESS + FLEX_RISE;
  const bottom = Math.min(landY, top - 0.002);
  const bend = Math.min(FLEX_BEND, (top - bottom) / 2);
  // [y, z, half-width]: wide out of J1, necking down before the board's edge.
  const path: [number, number, number][] = [
    [top, FLEX_START_Z, FLEX_HALF],
    [top, FLEX_START_Z + 0.035, FLEX_HALF],
    [top, FLEX_START_Z + 0.085, FLEX_NECK],
    [top, FLEX_DOWN_Z - bend, FLEX_NECK]
  ];
  for (let i = 1; i <= FLEX_STEPS; i++) {
    const phi = (i / FLEX_STEPS) * (Math.PI / 2);
    path.push([top - bend + bend * Math.cos(phi), FLEX_DOWN_Z - bend + bend * Math.sin(phi), FLEX_NECK]);
  }
  path.push([bottom + bend, FLEX_DOWN_Z, FLEX_NECK]);
  for (let i = 1; i <= FLEX_STEPS; i++) {
    const phi = (i / FLEX_STEPS) * (Math.PI / 2);
    path.push([bottom + bend - bend * Math.sin(phi), FLEX_DOWN_Z - bend + bend * Math.cos(phi), FLEX_NECK]);
  }
  path.push([bottom, Math.min(landZ, FLEX_DOWN_Z - bend), FLEX_NECK]);

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  let along = 0;
  path.forEach(([y, z, half], i) => {
    const [py, pz] = path[Math.max(0, i - 1)];
    const [ny, nz] = path[Math.min(path.length - 1, i + 1)];
    if (i > 0) along += Math.hypot(y - py, z - pz);
    let ty = ny - py;
    let tz = nz - pz;
    const length = Math.hypot(ty, tz) || 1;
    ty /= length;
    tz /= length;
    for (const side of [0, 1]) {
      const k = 2 * i + side;
      position.setXYZ(k, side ? half : -half, y, z);
      normal.setXYZ(k, 0, tz, -ty);
      // u runs edge to edge everywhere, so the traces fan out with the flex where it widens.
      uv.setXY(k, side, along / FLEX_TILE);
    }
  });
  position.needsUpdate = true;
  normal.needsUpdate = true;
  uv.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function buildBoard(m: DeviceMaterials, labels: Readonly<Record<string, string>> = {}): BoardParts {
  const object = new THREE.Group();
  object.name = 'board';

  const slab = new THREE.Mesh(
    plate(BOARD, BOARD_THICKNESS, 0.004, 0.004, {
      top: { uv: { kind: 'fit', hx: BOARD.width / 2, hz: BOARD.depth / 2 }, group: 1 },
      side: { uv: { kind: 'wrap', tile: 1 } },
      bottom: { uv: { kind: 'world', tile: 1 } }
    }),
    [m.pcbEdge, m.pcb]
  );
  slab.name = 'board:slab';
  object.add(slab);

  // The chips' tops, printed with their names where a canvas can be drawn.
  const name = (slug: string): string => labels[slug] ?? DEFAULT_NAMES[slug] ?? '';
  const projectSlugs = PROJECT_CHIPS.filter((slug) => slug !== 'next');
  const size = (pkg: Package, spot: Spot): { width: number; depth: number } => ({
    width: spot.width - 2 * pkg.inset,
    depth: spot.depth - 2 * pkg.inset
  });
  let projectTops: THREE.Material[] = [];
  let processorTop: THREE.Material | undefined;
  const redraws: (() => void)[] = [];
  if (canPaint()) {
    const painted = paintChipTops(
      projectSlugs.map((slug): ChipTop => ({ text: name(slug), ...size(SMALL_QFP, spotOf(FOOTPRINTS[slug])) }))
    );
    const cpu = paintChipTops([{ text: name('bc-2006'), mark: true, ...size(LARGE_QFP, spotOf(FOOTPRINTS['bc-2006'])) }]);
    const topMaterial = (map: THREE.Texture, slug: string): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ name: `chip-top:${slug}`, map, metalness: 0, roughness: 0.55 });
    projectTops = painted.textures.map((map, i) => topMaterial(map, projectSlugs[i]));
    processorTop = topMaterial(cpu.textures[0], 'bc-2006');
    redraws.push(painted.draw, cpu.draw);
  }

  const chips: THREE.Mesh[] = PROJECT_CHIPS.map((slug) => {
    const spot = spotOf(FOOTPRINTS[slug]);
    if (slug === 'next') return socket(spot, m);
    return qfp(slug, spot, SMALL_QFP, m, projectTops[projectSlugs.indexOf(slug)], m.steel);
  });
  const processor = qfp('bc-2006', spotOf(FOOTPRINTS['bc-2006']), LARGE_QFP, m, processorTop, m.gold);
  object.add(...chips, processor);

  // J1: a low housing over the printed connector, its latch on the +Z side where the flex goes in.
  const j1 = spotOf(FOOTPRINTS.connector);
  const housing = new THREE.Mesh(
    plate({ width: j1.width - 0.06, depth: 0.085, radius: 0.006 }, 0.02, 0.003, 0.001, {
      top: { uv: { kind: 'world', tile: 0.5 } },
      side: { uv: { kind: 'world', tile: 0.5 } },
      bottom: { uv: { kind: 'world', tile: 0.5 } }
    }),
    m.plastic
  );
  housing.position.set(j1.x, BOARD_THICKNESS, FLEX_START_Z - 0.055);
  housing.name = 'board:j1';
  const latch = new THREE.Mesh(
    plate({ width: j1.width - 0.09, depth: 0.034, radius: 0.004 }, 0.022, 0.004, 0.001, {
      top: { uv: { kind: 'world', tile: 0.5 } },
      side: { uv: { kind: 'world', tile: 0.5 } },
      bottom: { uv: { kind: 'world', tile: 0.5 } }
    }),
    m.epoxy
  );
  latch.position.set(j1.x, BOARD_THICKNESS, FLEX_START_Z);
  latch.name = 'board:j1-latch';
  object.add(housing, latch);

  // The flex.
  const flex = new THREE.Mesh(flexGeometry(), m.flex);
  flex.name = 'board:flex';
  flex.position.x = j1.x;
  object.add(flex);
  const setFlex = (landY: number, landZ: number): void => layFlex(flex.geometry, landY, landZ);
  setFlex(-0.02, 0.6);

  return { object, chips, processor, setFlex, redraw: () => redraws.forEach((draw) => draw()) };
}
