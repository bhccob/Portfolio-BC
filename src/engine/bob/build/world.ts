/**
 * The quantum stack, built in code (spec 2026-10-28-bob-quantum-stack-design.md; the mock-up Bob approved,
 * .superpowers/holo-world-4-mockup/world.ts and main.ts): the boards threaded on the spine, the CPU socketed on the power
 * board at the top, a socket for each project on its category's board and the project's object floating over it.
 *
 * - **The boards** (./plate.ts): the power board, then a board per category below it, each placed at the top it is posed
 *   with, so the stack opens from closed; each lit by its own power and dimmed by its own light.
 * - **The spine** (./spine.ts), telescoping with the boards, its light running down from the top.
 * - **The CPU,** socketed: a frame round it, its substrate with small parts along its edge, its lid with the compass
 *   engraved, glowing as the power comes on, and a warm glow under it.
 * - **The sockets:** a gold collar, a soft glow, a turning dashed ring and a faint column of light up to the object; a
 *   socket stays when its project rises off it, glowing a little more, waiting for it.
 * - **The objects:** Steady's streak path of seven blocks and its trophy; Porfael's ring of five arcs (shares, never
 *   amounts) and its relic; Jontai Energy's solar module of 16 hologram cells; Cookies Clicker's quartz crystal and two
 *   gold gears ticking once a second; any other project a plain chip. Each floats over its socket facing out from the
 *   spine, and lifted (`lift`) rises along a curve to the spot in front of the camera (../../../scene/bob/spot.ts).
 * - **The beam:** a faint light from the spine at a lifted project's board up to it, as if the machine projected it,
 *   and a lamp on the camera's side of it.
 *
 * It reads no clock of its own: `pose` is given the clock, so the canvas sleeps when the Void stops giving it time. The
 * boards, the spine and the CPU reflect the room it is given, turned with the camera (`turn`); the objects the scene's.
 */
import * as THREE from 'three';
import type { CategoryId } from '~/data/categories';
import { categories } from '~/data/categories';
import { type ProjectId, projects } from '~/data/projects';
import type { QualityTier } from '~/engine/quality';
import { liftAt, type SpotPose } from '~/scene/bob/spot';
import { type BoardPlace, boardCentre, LID_TOP, objectKind, type ObjectKind, STACK } from '~/scene/bob/worldLayout';
import { ease } from '~/scene/bob/worldPath';
import { buildPlate, type PlateModel, seeded } from './plate';
import { buildSpine, type SpineModel } from './spine';

/**
 * How the world looks (the mock-up's numbers, tuned there against the site's darkness limit): its colours; a socket's
 * glow and column; the CPU's lid from dark to powered and its glow beneath; the beam's and the open project's lamp's
 * light at a full lift.
 */
export const WORLD_LOOK = {
  colour: { gold: 0xe2a54a, goldLight: 0xffbf6f, violet: 0x6a35b8, haze: 0x8a6cf2, deep: 0x140a24, night: 0x07040e },
  socket: { glow: 0.2, empty: 0.15, column: 0.2 },
  cpu: { lid: { dark: 0.15, powered: 1.25 }, under: 0.3 },
  beam: 0.16,
  lamp: 9
} as const;

/** What the world is posed by, each frame. */
export interface WorldPose {
  /** The power from the CPU, 0..1: the CPU's lid and the spine's light. */
  power: number;
  /** The light's hit on the CPU, 0..1. */
  flash: number;
  /** The world's clock, s: the pulse, the sockets' rings, the float and the gears. */
  clock: number;
  /** Each project's light: 0 dark, 1 shown, more when in focus. */
  levels: Readonly<Record<ProjectId, number>>;
  /** How open each project is, 0..1. */
  open: Readonly<Record<ProjectId, number>>;
  /** How much the objects float, 0 (still) to 1. */
  float: number;
  /** The world's own light, 0..1: the boards, the spine, the CPU and the sockets; lower while a project is open. */
  world: number;
  /** Each board's top, world y, the power board's first (`boardTops`): the stack closed, opening or open. */
  tops: readonly number[];
  /** Each board's power and light, the power board's first (the path's `boardPower`, `boardLight`). */
  boardPower: readonly number[];
  boardLight: readonly number[];
  /** How far each project has risen off its socket toward the spot, 0..1 (eased here). */
  lift: Readonly<Partial<Record<ProjectId, number>>>;
  /**
   * The spot in front of the camera for an object one metre in radius (`spotFor(shot, aspect, 1, clock)`): each object
   * stands there at its own size, `scale` over its radius. Null while nothing rises.
   */
  spot: SpotPose | null;
  /**
   * How far the objects have sunk into their sockets, 0..1 (the Q&A's closing stack, spec 2026-10-29-bob-stack-2-design.md,
   * goal 1): each lowers onto its socket and shrinks to nothing, hidden by 0.995, as the mock-up's do.
   */
  sink: number;
}

export interface WorldModel {
  group: THREE.Group;
  /** One thing a click can hit per project, `userData.id` naming it; it rides with its object. */
  hits: THREE.Object3D[];
  /** The project's touch points' anchors, one per point in the data's order. */
  anchors(id: ProjectId): THREE.Object3D[];
  /** Where the project's name's line ends. */
  top(id: ProjectId): THREE.Object3D;
  pose(input: WorldPose): void;
  /** Turns what the boards, the spine and the CPU reflect with the camera's azimuth round the stack (rad, 0 toward +z). */
  turn(azimuth: number): void;
  dispose(): void;
}

type Canvas = () => HTMLCanvasElement;

const GOLD = new THREE.Color(WORLD_LOOK.colour.gold);
const GOLD_LIGHT = new THREE.Color(WORLD_LOOK.colour.goldLight);
const HAZE = new THREE.Color(WORLD_LOOK.colour.haze);
/** How far each object turns toward where its views stand, out and to the right (rad). */
const OBJECT_TURN = 0.5;
/** How far an object bobs as it floats, m, and over how long, s. */
const FLOAT = { reach: 0.04, period: 5.5 } as const;

function context(c: HTMLCanvasElement, size: number): CanvasRenderingContext2D {
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new TypeError('the world needs a 2D canvas context');
  return g;
}

function texture(c: HTMLCanvasElement, colour = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.anisotropy = 8;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- textures drawn once

function glowTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const g = context(c, 256);
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return texture(c);
}

function speckleTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const g = context(c, 512);
  g.fillStyle = '#120e18';
  g.fillRect(0, 0, 512, 512);
  const random = seeded(31);
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(30 + random() * 40);
    g.fillStyle = `rgba(${v},${v - 6},${v + 10},${0.25 + random() * 0.3})`;
    g.fillRect(random() * 512, random() * 512, 1 + random() * 1.5, 1 + random() * 1.5);
  }
  return texture(c, true);
}

/** The compass rose engraved on the CPU's lid: rings and a scale, four long points and four short, each lit and shaded. */
function compassTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const size = 1024;
  const g = context(c, size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.translate(size / 2, size / 2);
  const s = size / 2;
  g.strokeStyle = '#fff';
  for (const [r, w] of [
    [0.84, 0.014],
    [0.76, 0.006],
    [0.3, 0.006]
  ] as const) {
    g.lineWidth = w * s;
    g.beginPath();
    g.arc(0, 0, r * s, 0, Math.PI * 2);
    g.stroke();
  }
  for (let d = 0; d < 360; d += 5) {
    const a = (d * Math.PI) / 180;
    const inner = d % 45 === 0 ? 0.7 : 0.76;
    g.lineWidth = (d % 45 === 0 ? 0.012 : 0.006) * s;
    g.beginPath();
    g.moveTo(Math.cos(a) * inner * s, Math.sin(a) * inner * s);
    g.lineTo(Math.cos(a) * 0.84 * s, Math.sin(a) * 0.84 * s);
    g.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const len = (i % 2 === 0 ? 0.66 : 0.4) * s;
    const w = (i % 2 === 0 ? 0.1 : 0.07) * s;
    const tip = [Math.cos(a) * len, Math.sin(a) * len] as const;
    for (const [turn, shade] of [
      [-Math.PI / 2, '#fff'],
      [Math.PI / 2, '#6a6a6a']
    ] as const) {
      g.fillStyle = shade;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a + turn) * w, Math.sin(a + turn) * w);
      g.lineTo(tip[0], tip[1]);
      g.closePath();
      g.fill();
    }
  }
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(0, 0, 0.05 * s, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 0.01 * s;
  g.stroke();
  return texture(c);
}

/** A plain chip's lid: only its frame, no emblem. */
function frameTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const size = 128;
  const g = context(c, size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#777';
  g.lineWidth = size * 0.012;
  g.strokeRect(size * 0.12, size * 0.12, size * 0.76, size * 0.76);
  return texture(c);
}

/** A chip's die: four quadrants of fine circuit blocks, violet and gold. */
function dieTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const size = 512;
  const g = context(c, size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  const random = seeded(53);
  const tints = [
    [120, 90, 255],
    [255, 170, 80],
    [150, 90, 240],
    [255, 200, 110]
  ] as const;
  const gap = size * 0.03;
  const half = (size - gap) / 2;
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * (half + gap);
    const oy = Math.floor(q / 2) * (half + gap);
    const [r, gg, b] = tints[q]!;
    const grad = g.createRadialGradient(ox + half / 2, oy + half / 2, 0, ox + half / 2, oy + half / 2, half * 0.75);
    grad.addColorStop(0, `rgba(${r},${gg},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0.16)`);
    g.fillStyle = grad;
    g.fillRect(ox, oy, half, half);
    for (let i = 0; i < 260; i++) {
      const w = 4 + random() * 22;
      const h = 3 + random() * 10;
      const x = ox + 6 + random() * (half - 12 - w);
      const y = oy + 6 + random() * (half - 12 - h);
      const v = 0.25 + random() * 0.75;
      g.fillStyle = `rgba(${Math.min(255, r + 60)},${Math.min(255, gg + 60)},${Math.min(255, b + 60)},${v * 0.6})`;
      g.fillRect(x, y, w, h);
    }
    g.strokeStyle = `rgba(${Math.min(255, r + 90)},${Math.min(255, gg + 90)},${Math.min(255, b + 90)},0.9)`;
    g.lineWidth = 3;
    g.strokeRect(ox + 1.5, oy + 1.5, half - 3, half - 3);
  }
  return texture(c, true);
}

/** The CPU's substrate: dark, with rows of tiny gold contacts round its edge and a gold triangle at pin one. */
function substrateTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const size = 512;
  const g = context(c, size);
  g.fillStyle = '#100c17';
  g.fillRect(0, 0, size, size);
  const random = seeded(5);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(60,48,80,${0.2 + random() * 0.3})`;
    g.fillRect(random() * size, random() * size, 1.5, 1.5);
  }
  g.fillStyle = '#9c7634';
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 46; i++) {
      for (const row of [0, 1]) {
        const u = 22 + (i * (size - 44)) / 45;
        const v = 8 + row * 9;
        const [x, y] = (
          [
            [u, v],
            [size - v, u],
            [size - u, size - v],
            [v, size - u]
          ] as const
        )[side]!;
        g.fillRect(x - 2, y - 2, 4, 4);
      }
    }
  }
  g.beginPath();
  g.moveTo(26, 26);
  g.lineTo(52, 26);
  g.lineTo(26, 52);
  g.fill();
  return texture(c, true);
}

// ---------------------------------------------------------------- shaders of the sockets, the beam and the objects

const UV_VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const RING_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform vec3 uGold;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float a = atan(p.y, p.x) + uTime * 0.12;
    float dash = step(0.35, fract(a * 24.0 / 6.2831853));
    float tick = step(0.9, fract(a * 4.0 / 6.2831853));
    gl_FragColor = vec4(uGold * (dash * 0.55 + tick * 0.9) * uLevel, 1.0);
  }
`;

const FACING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vFacing = abs(dot(n, normalize(cameraPosition - w.xyz)));
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const COLUMN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform vec3 uViolet;
  uniform vec3 uGold;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float edge = pow(clamp(1.0 - vFacing, 0.0, 1.0), 2.0);
    float rise = 1.0 - vUv.y;
    float streak = 0.6 + 0.4 * sin(vUv.x * 6.2831853 * 36.0);
    float scan = 0.75 + 0.25 * sin(vUv.y * 60.0 - uTime * 2.0);
    gl_FragColor = vec4(mix(uViolet, uGold, 0.25) * edge * rise * rise * streak * scan * uLevel, 1.0);
  }
`;

/** The beam up to a lifted project: violet going gold toward it, brighter at its edges, scanning up. */
const BEAM_FRAGMENT = /* glsl */ `
  uniform float uLevel;
  uniform float uTime;
  uniform vec3 uViolet;
  uniform vec3 uGold;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float edge = pow(clamp(1.0 - vFacing, 0.0, 1.0), 1.5);
    float scan = 0.7 + 0.3 * sin(vUv.y * 50.0 - uTime * 3.0);
    vec3 c = mix(uViolet, uGold, 0.35 + 0.4 * vUv.y) * (0.25 + edge) * scan * smoothstep(0.0, 0.25, vUv.y);
    gl_FragColor = vec4(c * uLevel, 1.0);
  }
`;

const CELL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLit;
  uniform float uLevel;
  uniform vec3 uGold;
  uniform vec3 uViolet;
  varying vec2 vUv;
  void main() {
    vec2 e = min(vUv, 1.0 - vUv);
    float rim = smoothstep(0.05, 0.0, min(e.x, e.y));
    float fingers = step(0.965, fract(vUv.x * 5.0)) * 0.5 + step(0.95, fract(vUv.y * 2.0)) * 0.7;
    float scan = 0.85 + 0.15 * sin(vUv.y * 90.0 + uTime * 1.6);
    vec3 c = uViolet * (0.22 + fingers * 0.5) * scan + uGold * rim * 0.9;
    gl_FragColor = vec4(c * (0.4 + uLit) * uLevel, 1.0);
  }
`;

const CRYSTAL_FRAGMENT = /* glsl */ `
  uniform float uLevel;
  uniform float uTime;
  uniform vec3 uViolet;
  varying float vFacing;
  varying float vY;
  void main() {
    float f = pow(clamp(1.0 - vFacing, 0.0, 1.0), 1.6);
    float scan = 0.8 + 0.2 * sin(vY * 140.0 - uTime * 2.4);
    vec3 c = mix(uViolet * 0.35, vec3(0.8, 0.72, 0.95), f) * (0.22 + 0.75 * f) * scan;
    gl_FragColor = vec4(c * uLevel, 1.0);
  }
`;

/** A day of Steady's streak path: dark violet, warm and rimmed once marked. */
const BLOCK_FRAGMENT = /* glsl */ `
  uniform float uLit;
  uniform float uLevel;
  uniform vec3 uViolet;
  uniform vec3 uWarm;
  varying vec2 vUv;
  void main() {
    vec2 e = min(vUv, 1.0 - vUv);
    float rim = smoothstep(0.08, 0.0, min(e.x, e.y));
    vec3 c = (mix(uViolet * 0.2, uWarm * 0.5, uLit) * (0.3 + 0.5 * uLit) + uWarm * rim * (0.2 + 0.5 * uLit)) * 0.6;
    gl_FragColor = vec4(c * uLevel, 1.0);
  }
`;

/** One of Porfael's arcs: a share of the ring, in fine bands. */
const ARC_FRAGMENT = /* glsl */ `
  uniform float uLevel;
  uniform vec3 uTint;
  varying vec2 vUv;
  void main() {
    float band = 0.55 + 0.45 * sin(vUv.x * 60.0);
    gl_FragColor = vec4(uTint * (0.3 + 0.35 * band) * uLevel, 1.0);
  }
`;

const additive = <M extends THREE.Material>(material: M): M => {
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.AdditiveBlending;
  return material;
};

// ---------------------------------------------------------------- the build

interface Made {
  body: THREE.Group;
  anchors: THREE.Object3D[];
  top: THREE.Object3D;
  set(clock: number, open: number, level: number): void;
}

function anchor(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const a = new THREE.Object3D();
  a.position.set(x, y, z);
  parent.add(a);
  return a;
}

/**
 * `n` anchors for a project's touch points: the object's own places first (`places`), any more on a ring round the
 * object's middle, so every point the data has is pinned somewhere on it.
 */
function anchorsFor(parent: THREE.Object3D, places: readonly (readonly [number, number, number])[], n: number, ring: { r: number; y: number }): THREE.Object3D[] {
  return Array.from({ length: n }, (_, k) => {
    const p = places[k];
    if (p) return anchor(parent, p[0], p[1], p[2]);
    const a = ((k - places.length) / Math.max(1, n - places.length)) * Math.PI * 2;
    return anchor(parent, Math.cos(a) * ring.r, ring.y, Math.sin(a) * ring.r);
  });
}

/** A board's printed name: its category's number and kind, in Dutch, the site's first language (as the mock-up's). */
const boardLabel = (category: CategoryId | null): string => (category ? categories.byId(category).heading('nl') : '');

export function buildWorld(boards: readonly BoardPlace[], tier: QualityTier, room: THREE.Texture | null, canvas: Canvas = () => document.createElement('canvas')): WorldModel {
  const look = WORLD_LOOK;
  const group = new THREE.Group();
  group.name = 'world';
  const centre = boardCentre();

  const glow = glowTexture(canvas());
  const speckle = speckleTexture(canvas());
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 1, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0912, metalness: 0.55, roughness: 0.48, map: speckle });

  /** A lid: gold edges and a dark top whose engraving (`emblem`) glows gold. */
  const lid = (size: number, height: number, emblem: THREE.Texture, glowing: number, edges: THREE.Material = gold): { mesh: THREE.Mesh; top: THREE.MeshStandardMaterial } => {
    const top = new THREE.MeshStandardMaterial({
      color: 0x110d16,
      metalness: 0.35,
      roughness: 0.62,
      map: speckle,
      emissive: GOLD,
      emissiveMap: emblem,
      emissiveIntensity: glowing
    });
    return { mesh: new THREE.Mesh(new THREE.BoxGeometry(size, height, size), [edges, edges, top, dark, edges, edges]), top };
  };

  /** A chip's pins: `perSide` on each side of a `size` body, reaching `reach` out and down to the board. */
  const pins = (size: number, perSide: number, reach: number, y: number): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size * 0.022, size * 0.024, reach), gold, perSide * 4);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const upright = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (let side = 0; side < 4; side++) {
      q.setFromAxisAngle(upright, (side * Math.PI) / 2);
      for (let i = 0; i < perSide; i++) {
        const u = (-0.5 + (i + 0.5) / perSide) * size * 0.86;
        m.compose(new THREE.Vector3(u, y, size / 2 + reach / 2 - reach * 0.15).applyQuaternion(q), q, one);
        mesh.setMatrixAt(n++, m);
      }
    }
    return mesh;
  };

  // The boards, the power board first, and the spine they are threaded on.
  const holders: THREE.Group[] = [];
  const plates: PlateModel[] = [];
  let first = 1;
  boards.forEach((board, k) => {
    const holder = new THREE.Group();
    holder.name = `world:board:${k}`;
    holder.position.set(centre[0], board.top, centre[2]);
    const plate = buildPlate(
      {
        radius: board.radius,
        hole: board.hole,
        cpu: k === 0,
        sockets: board.sockets.map((s) => s.at),
        firstSocket: first,
        label: boardLabel(board.category),
        facing: board.facing,
        seed: k === 0 ? 2025 : 2026 + (k - 1) * 31
      },
      tier,
      room,
      canvas
    );
    first += board.sockets.length;
    holder.add(plate.group);
    group.add(holder);
    holders.push(holder);
    plates.push(plate);
  });
  const spine: SpineModel = buildSpine({ tops: boards.map((b) => b.top), radii: boards.map((b) => b.radius), hole: STACK.hole, thick: STACK.thick }, tier, room);
  const spineHolder = new THREE.Group();
  spineHolder.name = 'world:spine';
  spineHolder.position.set(centre[0], 0, centre[2]);
  spineHolder.add(spine.group);
  group.add(spineHolder);

  // The CPU on the power board, socketed.
  const cpu = new THREE.Group();
  cpu.name = 'world:cpu';
  const cpuMetal = new THREE.MeshStandardMaterial({ color: 0x1a1622, metalness: 0.85, roughness: 0.34, envMap: room });
  const cpuEdges = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 1, roughness: 0.4, envMap: room });
  const cpuBase = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.04, 2.46), cpuMetal);
  cpuBase.position.y = 0.02;
  cpu.add(cpuBase);
  for (let side = 0; side < 4; side++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.12, 0.12), [cpuMetal, cpuMetal, cpuEdges, cpuMetal, cpuMetal, cpuMetal]);
    const turn = (side * Math.PI) / 2;
    bar.position.set(Math.sin(turn) * 1.31, 0.06, Math.cos(turn) * 1.31);
    bar.rotation.y = turn;
    cpu.add(bar);
  }
  const substrate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 2.2), [
    cpuMetal,
    cpuMetal,
    new THREE.MeshStandardMaterial({ map: substrateTexture(canvas()), roughness: 0.55, metalness: 0.2 }),
    cpuMetal,
    cpuMetal,
    cpuMetal
  ]);
  substrate.position.y = 0.07;
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.035, 0.04), new THREE.MeshStandardMaterial({ color: 0x2c2228, roughness: 0.6 }), 4 * 22);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (let side = 0; side < 4; side++) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side * Math.PI) / 2);
      for (let i = 0; i < 22; i++) caps.setMatrixAt(n++, m.compose(new THREE.Vector3(-0.74 + (i * 1.48) / 21, 0.118, 0.95).applyQuaternion(q), q, one));
    }
  }
  const cap = lid(1.66, 0.1, compassTexture(canvas()), look.cpu.lid.dark, cpuEdges);
  cap.mesh.name = 'world:cpu:lid';
  cap.mesh.position.y = LID_TOP - 0.05;
  const cpuGlowMaterial = additive(new THREE.MeshBasicMaterial({ map: glow, color: GOLD, opacity: 0 }));
  const cpuGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5).rotateX(-Math.PI / 2), cpuGlowMaterial);
  cpuGlow.position.y = 0.012;
  cpuGlow.renderOrder = 3;
  cpu.add(substrate, caps, cap.mesh, cpuGlow);
  holders[0]?.add(cpu);
  const cpuDims = [cpuMetal, cpuEdges].map((m) => ({ m, colour: m.color.clone() }));

  // The objects.
  const plainMap = frameTexture(canvas());
  const dieMap = dieTexture(canvas());
  const testPoints = (id: ProjectId): number => projects.byId(id)?.testPoints.length ?? 0;

  const chip = (id: ProjectId): Made => {
    const made = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.62), dark);
    base.position.y = 0.035;
    const dieMaterial = new THREE.MeshBasicMaterial({ map: dieMap, color: new THREE.Color(0.3, 0.3, 0.3) });
    const die = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48).rotateX(-Math.PI / 2), dieMaterial);
    die.position.y = 0.0705;
    const top = lid(0.6, 0.04, plainMap, 0.6);
    top.mesh.name = `world:object:${id}:lid`;
    top.mesh.position.y = 0.092;
    made.add(base, pins(0.62, 11, 0.08, 0.02), die, top.mesh);
    const q = 0.12;
    const anchors = anchorsFor(
      made,
      [
        [-q, 0.075, -q],
        [q, 0.075, -q],
        [-q, 0.075, q],
        [q, 0.075, q],
        [0, 0.075, 0]
      ],
      testPoints(id),
      { r: 0.3, y: 0.075 }
    );
    return {
      body: made,
      anchors,
      top: anchor(made, 0, 0.2, 0),
      set(_clock, open, level) {
        const o = smooth(open);
        top.mesh.position.y = 0.092 + o * 0.3;
        top.mesh.rotation.x = -o * 0.16;
        top.mesh.rotation.z = o * 0.08;
        dieMaterial.color.setScalar((0.3 + o * 0.75) * level);
        top.top.emissiveIntensity = 0.6 * level;
      }
    };
  };

  /** Steady: its streak path, seven blocks stepping away (a marked day each), a small gold trophy at the week's end. */
  const streak = (id: ProjectId): Made => {
    const made = new THREE.Group();
    const warm = new THREE.Color(0xe8c890);
    const materials: THREE.ShaderMaterial[] = [];
    const blocks: THREE.Object3D[] = [];
    for (let i = 0; i < 7; i++) {
      const s = 0.15 * (1 - i * 0.055);
      const m = additive(
        new THREE.ShaderMaterial({
          vertexShader: UV_VERTEX,
          fragmentShader: BLOCK_FRAGMENT,
          uniforms: { uLit: { value: 0 }, uLevel: { value: 1 }, uViolet: { value: HAZE }, uWarm: { value: warm } }
        })
      );
      materials.push(m);
      const block = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), m);
      block.name = `world:object:${id}:block:${i}`;
      // Stepping away and a little up along a gentle curve, as the app's path recedes into the distance.
      block.position.set(-0.4 + i * 0.12, 0.09 + i * 0.03, -i * 0.07 + Math.sin(i * 0.7) * 0.03);
      block.renderOrder = 4;
      made.add(block);
      blocks.push(block);
    }
    const trophy = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 1, roughness: 0.35, emissive: GOLD, emissiveIntensity: 0.1 });
    const cup = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0),
          new THREE.Vector2(0.05, 0),
          new THREE.Vector2(0.05, 0.015),
          new THREE.Vector2(0.015, 0.03),
          new THREE.Vector2(0.015, 0.07),
          new THREE.Vector2(0.06, 0.1),
          new THREE.Vector2(0.065, 0.17),
          new THREE.Vector2(0.055, 0.17),
          new THREE.Vector2(0.0, 0.12)
        ],
        32
      ),
      trophy
    );
    cup.name = `world:object:${id}:trophy`;
    cup.position.set(-0.4 + 7 * 0.12 + 0.02, 0.09 + 7 * 0.03 - 0.06, -7 * 0.07);
    made.add(cup);
    const anchors = anchorsFor(
      made,
      [
        [blocks[0]!.position.x, blocks[0]!.position.y + 0.08, blocks[0]!.position.z],
        [blocks[2]!.position.x, blocks[2]!.position.y + 0.08, blocks[2]!.position.z],
        [blocks[4]!.position.x, blocks[4]!.position.y + 0.07, blocks[4]!.position.z],
        [blocks[6]!.position.x, blocks[6]!.position.y + 0.06, blocks[6]!.position.z],
        [cup.position.x, cup.position.y + 0.14, cup.position.z]
      ],
      testPoints(id),
      { r: 0.45, y: 0.2 }
    );
    return {
      body: made,
      anchors,
      top: anchor(made, 0, 0.5, -0.2),
      set(_clock, open, level) {
        materials.forEach((m, i) => {
          // Three days marked at rest; opened, the rest one after another.
          m.uniforms.uLit!.value = i < 3 ? 1 : Math.min(1, Math.max(0, open * 2.4 - ((i - 3) / 4) * 1.4));
          m.uniforms.uLevel!.value = level;
        });
        trophy.emissiveIntensity = (0.1 + 0.9 * open) * level;
      }
    };
  };

  /** Porfael: a portfolio's allocation as a ring of five arcs (shares only, never amounts), a gold relic turning at its middle. */
  const portfolio = (id: ProjectId): Made => {
    const made = new THREE.Group();
    const ring = new THREE.Group();
    ring.position.y = 0.3;
    ring.rotation.x = -Math.PI / 2 + 0.75;
    made.add(ring);
    const shares = [0.34, 0.24, 0.18, 0.14, 0.1];
    const gap = 0.07;
    const arcs: { mesh: THREE.Mesh; mid: number; material: THREE.ShaderMaterial }[] = [];
    let start = 0;
    shares.forEach((share, i) => {
      const sweep = share * Math.PI * 2 - gap;
      const material = additive(
        new THREE.ShaderMaterial({
          vertexShader: UV_VERTEX,
          fragmentShader: ARC_FRAGMENT,
          uniforms: { uLevel: { value: 1 }, uTint: { value: i % 2 === 0 ? HAZE.clone() : GOLD.clone() } },
          side: THREE.DoubleSide
        })
      );
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 10, 64, sweep), material);
      mesh.name = `world:object:${id}:arc:${i}`;
      mesh.rotation.z = start;
      mesh.renderOrder = 4;
      ring.add(mesh);
      arcs.push({ mesh, mid: start + sweep / 2, material });
      start += share * Math.PI * 2;
    });
    const relic = new THREE.Group();
    relic.position.y = 0.3;
    const glowing = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 1, roughness: 0.3, emissive: GOLD, emissiveIntensity: 0.12 });
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.035, 6).rotateX(Math.PI / 2), glowing);
    medal.name = `world:object:${id}:relic`;
    const inset = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 6).rotateX(Math.PI / 2), dark);
    relic.add(medal, inset);
    made.add(relic);
    const onArc = (i: number): readonly [number, number, number] => {
      const a = arcs[i]!.mid;
      return [Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.06];
    };
    // The arcs' anchors on the tipped ring, the relic's at its middle.
    const anchors = anchorsFor(ring, [onArc(0), onArc(1), onArc(2), onArc(3), [0, 0, 0.03]], testPoints(id), { r: 0.32, y: 0 });
    return {
      body: made,
      anchors,
      top: anchor(made, 0, 0.75, 0),
      set(clock, open, level) {
        arcs.forEach(({ mesh, mid, material }) => {
          const out = 0.05 * open;
          mesh.position.set(Math.cos(mid) * out, Math.sin(mid) * out, 0);
          material.uniforms.uLevel!.value = (0.6 + 0.5 * open) * level;
        });
        relic.rotation.y = clock * 0.5;
        glowing.emissiveIntensity = (0.12 + 0.8 * open) * level;
      }
    };
  };

  const solar = (id: ProjectId): Made => {
    const made = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.5;
    tilt.position.y = 0.12;
    made.add(tilt);
    const size = 0.84;
    const cell = 0.19;
    const gap = (size - cell * 4) / 5;
    const geometry = new THREE.PlaneGeometry(cell, cell).rotateX(-Math.PI / 2);
    const cellAt = (i: number): [number, number] => [-size / 2 + gap + cell / 2 + (i % 4) * (cell + gap), -size / 2 + gap + cell / 2 + Math.floor(i / 4) * (cell + gap)];
    const materials = Array.from({ length: 16 }, (_, i) => {
      const m = additive(
        new THREE.ShaderMaterial({
          vertexShader: UV_VERTEX,
          fragmentShader: CELL_FRAGMENT,
          uniforms: { uTime: { value: 0 }, uLit: { value: 0 }, uLevel: { value: 1 }, uGold: { value: GOLD }, uViolet: { value: HAZE } },
          side: THREE.DoubleSide
        })
      );
      const mesh = new THREE.Mesh(i === 0 ? geometry : geometry.clone(), m);
      mesh.name = `world:object:${id}:cell:${i}`;
      const [x, z] = cellAt(i);
      mesh.position.set(x, 0, z);
      mesh.renderOrder = 4;
      tilt.add(mesh);
      return m;
    });
    for (let side = 0; side < 4; side++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(size + 0.03, 0.022, 0.016), gold);
      const turn = (side * Math.PI) / 2;
      bar.position.set(Math.sin(turn) * (size / 2 + 0.008), 0, Math.cos(turn) * (size / 2 + 0.008));
      bar.rotation.y = turn;
      tilt.add(bar);
    }
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: WORLD_LOOK.colour.night, transparent: true, opacity: 0.55, depthWrite: false })
    );
    back.position.y = -0.004;
    tilt.add(back);
    const anchors = anchorsFor(
      tilt,
      [0, 6, 11, 15].map((i) => {
        const [x, z] = cellAt(i);
        return [x, 0.004, z] as const;
      }),
      testPoints(id),
      { r: 0.5, y: 0.004 }
    );
    return {
      body: made,
      anchors,
      top: anchor(tilt, 0, 0.02, -size / 2),
      set(clock, open, level) {
        materials.forEach((m, i) => {
          m.uniforms.uTime!.value = clock;
          m.uniforms.uLit!.value = Math.min(1, Math.max(0, open * 2.2 - (i / 16) * 1.2));
          m.uniforms.uLevel!.value = level;
        });
      }
    };
  };

  const crystal = (id: ProjectId): Made => {
    const made = new THREE.Group();
    const lathe = new THREE.LatheGeometry([new THREE.Vector2(0, -0.34), new THREE.Vector2(0.1, -0.21), new THREE.Vector2(0.1, 0.21), new THREE.Vector2(0, 0.34)], 6).toNonIndexed();
    lathe.computeVertexNormals();
    const glassMaterial = additive(
      new THREE.ShaderMaterial({
        vertexShader: FACING_VERTEX,
        fragmentShader: CRYSTAL_FRAGMENT,
        uniforms: { uLevel: { value: 1 }, uTime: { value: 0 }, uViolet: { value: HAZE } },
        side: THREE.DoubleSide
      })
    );
    const stone = new THREE.Group();
    stone.position.set(-0.13, 0.38, 0);
    stone.rotation.z = 0.12;
    const glass = new THREE.Mesh(lathe, glassMaterial);
    glass.renderOrder = 4;
    const edgeMaterial = additive(new THREE.LineBasicMaterial({ color: GOLD_LIGHT }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(lathe, 10), edgeMaterial);
    edges.renderOrder = 4;
    stone.add(glass, edges);
    const gear = (teeth: number, outer: number, root: number, hole: number, windows: number): THREE.ExtrudeGeometry => {
      const shape = new THREE.Shape();
      const step = (Math.PI * 2) / teeth;
      for (let i = 0; i < teeth; i++) {
        const a = i * step;
        const pts: [number, number][] = [
          [root, a],
          [outer, a + step * 0.18],
          [outer, a + step * 0.48],
          [root, a + step * 0.66]
        ];
        pts.forEach(([r, t], j) => (i === 0 && j === 0 ? shape.moveTo(Math.cos(t) * r, Math.sin(t) * r) : shape.lineTo(Math.cos(t) * r, Math.sin(t) * r)));
      }
      shape.closePath();
      const middle = new THREE.Path();
      middle.absarc(0, 0, hole, 0, Math.PI * 2, true);
      shape.holes.push(middle);
      for (let w = 0; w < windows; w++) {
        const a = (w / windows) * Math.PI * 2;
        const p = new THREE.Path();
        p.absarc(Math.cos(a) * root * 0.55, Math.sin(a) * root * 0.55, root * 0.2, 0, Math.PI * 2, true);
        shape.holes.push(p);
      }
      return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 24 }).translate(0, 0, -0.015);
    };
    const big = new THREE.Mesh(gear(14, 0.17, 0.145, 0.025, 5), gold);
    big.name = `world:object:${id}:gear:big`;
    big.position.set(0.17, 0.25, 0.02);
    const small = new THREE.Mesh(gear(9, 0.11, 0.088, 0.018, 0), gold);
    small.name = `world:object:${id}:gear:small`;
    small.position.set(0.17 + 0.255, 0.25 + 0.03, 0.02);
    made.add(stone, big, small);
    const anchors = anchorsFor(
      made,
      [
        [0.17 + 0.16, 0.25 + 0.06, 0.03],
        [0.17 + 0.255, 0.28, 0.04],
        [-0.13 + 0.036, 0.38 + 0.3, 0],
        [-0.13 - 0.034, 0.38 - 0.28, 0],
        [0.17, 0.25, 0.04]
      ],
      testPoints(id),
      { r: 0.35, y: 0.38 }
    );
    return {
      body: made,
      anchors,
      top: anchor(made, -0.13, 0.76, 0),
      set(clock, open, level) {
        // One tick a second: a quick step, then still.
        const tick = Math.floor(clock) + Math.min(1, (clock - Math.floor(clock)) / 0.16) ** 0.5;
        big.rotation.z = -tick * ((Math.PI * 2) / 14);
        small.rotation.z = tick * ((Math.PI * 2) / 9) + 0.2;
        stone.rotation.y = clock * 0.25;
        glassMaterial.uniforms.uTime!.value = clock;
        glassMaterial.uniforms.uLevel!.value = (0.55 + open * 0.3) * level;
        edgeMaterial.opacity = Math.min(1, (0.3 + open * 0.3) * level);
      }
    };
  };

  const makers: Record<ObjectKind, (id: ProjectId) => Made> = { streak, portfolio, chip, solar, crystal };

  /** A project's socket on its board: a gold collar, a glow, a turning dashed ring and a faint column up to the object. */
  const socketMetal = new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 1, roughness: 0.36 });
  const socketFor = (id: ProjectId): { group: THREE.Group; set(clock: number, level: number, empty: number): void } => {
    const socket = new THREE.Group();
    socket.name = `world:socket:${id}`;
    const collar = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.86, 0),
          new THREE.Vector2(0.97, 0),
          new THREE.Vector2(0.97, 0.045),
          new THREE.Vector2(0.9, 0.06),
          new THREE.Vector2(0.86, 0.06)
        ],
        96
      ),
      socketMetal
    );
    const glowMaterial = additive(new THREE.MeshBasicMaterial({ map: glow, color: HAZE }));
    const socketGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2), glowMaterial);
    socketGlow.name = `world:socket:${id}:glow`;
    socketGlow.position.y = 0.006;
    const ringMaterial = additive(new THREE.ShaderMaterial({ vertexShader: UV_VERTEX, fragmentShader: RING_FRAGMENT, uniforms: { uTime: { value: 0 }, uLevel: { value: 1 }, uGold: { value: GOLD } } }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.79, 160).rotateX(-Math.PI / 2), ringMaterial);
    ring.position.y = 0.012;
    const columnMaterial = additive(
      new THREE.ShaderMaterial({
        vertexShader: FACING_VERTEX,
        fragmentShader: COLUMN_FRAGMENT,
        uniforms: { uTime: { value: 0 }, uLevel: { value: 1 }, uViolet: { value: HAZE }, uGold: { value: GOLD } },
        side: THREE.DoubleSide
      })
    );
    const height = STACK.hover * 0.9;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, height, 64, 1, true).translate(0, height / 2, 0), columnMaterial);
    for (const m of [socketGlow, ring, column]) m.renderOrder = 3;
    socket.add(collar, socketGlow, ring, column);
    return {
      group: socket,
      set(clock, level, empty) {
        glowMaterial.opacity = (look.socket.glow + look.socket.empty * empty) * level;
        ringMaterial.uniforms.uTime!.value = clock;
        ringMaterial.uniforms.uLevel!.value = level;
        columnMaterial.uniforms.uTime!.value = clock;
        columnMaterial.uniforms.uLevel!.value = look.socket.column * level * (1 - empty);
      }
    };
  };

  interface Placed {
    id: ProjectId;
    board: number;
    at: readonly [number, number];
    made: Made;
    root: THREE.Group;
    /** The object's middle in its own space, and the radius round it that holds it all, at scale 1. */
    middle: THREE.Vector3;
    radius: number;
    socket: ReturnType<typeof socketFor>;
    phase: number;
  }

  const placed: Placed[] = [];
  const hits: THREE.Object3D[] = [];
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  boards.forEach((board, k) => {
    for (const s of board.sockets) {
      const socket = socketFor(s.id);
      socket.group.position.set(s.at[0], 0, s.at[1]);
      holders[k]!.add(socket.group);
      const made = makers[objectKind(s.id)](s.id);
      made.body.rotation.y = OBJECT_TURN;
      const root = new THREE.Group();
      root.name = `world:object:${s.id}`;
      root.add(made.body);
      root.updateMatrixWorld(true);
      const sphere = new THREE.Box3().setFromObject(made.body).getBoundingSphere(new THREE.Sphere());
      const hit = new THREE.Mesh(new THREE.SphereGeometry(sphere.radius * 1.05, 12, 8), invisible);
      hit.name = `world:hit:${s.id}`;
      hit.position.copy(sphere.center);
      hit.userData.id = s.id;
      root.add(hit);
      hits.push(hit);
      group.add(root);
      placed.push({ id: s.id, board: k, at: s.at, made, root, middle: sphere.center.clone(), radius: sphere.radius, socket, phase: placed.length * 2.1 });
    }
  });

  // The beam from the spine up to a lifted project, and the lamp that lights it on the camera's side.
  const beamMaterial = additive(
    new THREE.ShaderMaterial({
      vertexShader: FACING_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: { uLevel: { value: 0 }, uTime: { value: 0 }, uViolet: { value: HAZE }, uGold: { value: GOLD_LIGHT } },
      side: THREE.DoubleSide
    })
  );
  // A cone one unit long along +y, narrow at the spine, wide at the project: posed each frame.
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.06, 1, 48, 1, true).translate(0, 0.5, 0), beamMaterial);
  beam.name = 'world:beam';
  beam.frustumCulled = false;
  beam.renderOrder = 4;
  beam.visible = false;
  const showLight = new THREE.PointLight(GOLD_LIGHT, 0, 7, 1.6);
  showLight.name = 'world:showLight';
  group.add(beam, showLight);

  const find = (id: ProjectId): Placed => {
    const p = placed.find((q) => q.id === id);
    if (!p) throw new RangeError(`"${id}" is not on the stack`);
    return p;
  };

  // Scratch for posing.
  const upright = new THREE.Vector3(0, 1, 0);
  const across = new THREE.Vector3(1, 0, 0);
  const qYaw = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const offset = new THREE.Vector3();
  const base = new THREE.Vector3();
  const toward = new THREE.Vector3();
  const middleAt = new THREE.Vector3();

  return {
    group,
    hits,
    anchors: (id) => find(id).made.anchors,
    top: (id) => find(id).made.top,
    pose({ power, flash, clock, levels, open, float, world, tops, boardPower, boardLight, lift, spot, sink }) {
      holders.forEach((holder, k) => {
        holder.position.y = tops[k] ?? boards[k]!.top;
        plates[k]!.set(clock, boardPower[k] ?? power, (boardLight[k] ?? 1) * world);
      });
      spine.pose([...tops]);
      spine.set(clock, power, world);
      cap.top.emissiveIntensity = (look.cpu.lid.dark + (look.cpu.lid.powered - look.cpu.lid.dark) * power) * (0.2 + 0.8 * world) + flash;
      cpuGlowMaterial.opacity = look.cpu.under * power * world + flash * 0.6;
      for (const { m, colour } of cpuDims) {
        m.color.copy(colour).multiplyScalar(0.3 + 0.7 * world);
        m.envMapIntensity = 0.34 * (0.2 + 0.8 * world);
      }

      let shown: Placed | null = null;
      let lit = 0;
      for (const p of placed) {
        const top = tops[p.board] ?? boards[p.board]!.top;
        const level = levels[p.id] ?? 0;
        const risen = ease(lift[p.id] ?? 0);
        // On its socket: floating over it, facing out from the spine, at the stack's size.
        const bob = Math.sin((clock * Math.PI * 2) / FLOAT.period + p.phase) * FLOAT.reach * float;
        const yaw = Math.atan2(p.at[0], p.at[1]);
        // Sunk into its socket as the stack closes: down onto it and smaller, gone before the boards meet.
        const shrink = Math.max(0.001, 1 - sink);
        const size = STACK.scale * shrink;
        offset.copy(p.middle).multiplyScalar(size).applyAxisAngle(upright, yaw);
        const onSocket: SpotPose = {
          centre: [centre[0] + p.at[0] + offset.x, top + (STACK.hover + bob) * shrink + offset.y, centre[2] + p.at[1] + offset.z],
          yaw,
          tilt: 0,
          scale: size
        };
        p.root.visible = sink < 0.995;
        const now = spot && risen > 0 ? liftAt(onSocket, { ...spot, scale: spot.scale / p.radius }, risen) : onSocket;
        qYaw.setFromAxisAngle(upright, now.yaw);
        qTilt.setFromAxisAngle(across, now.tilt);
        p.root.quaternion.copy(qYaw).multiply(qTilt);
        offset.copy(p.middle).multiplyScalar(now.scale).applyQuaternion(p.root.quaternion);
        p.root.position.set(now.centre[0] - offset.x, now.centre[1] - offset.y, now.centre[2] - offset.z);
        p.root.scale.setScalar(now.scale);
        p.made.set(clock, open[p.id] ?? 0, level);
        p.socket.set(clock, (boardLight[p.board] ?? 1) * world, risen);
        if (risen > lit) {
          lit = risen;
          shown = p;
        }
      }

      beamMaterial.uniforms.uTime!.value = clock;
      if (shown && spot) {
        // From the spine's core at the project's own board up to its middle.
        const top = tops[shown.board] ?? boards[shown.board]!.top;
        base.set(centre[0], top + 0.25, centre[2]);
        shown.root.updateMatrix();
        middleAt.copy(shown.middle).applyMatrix4(shown.root.matrix);
        toward.copy(middleAt).sub(base);
        const length = toward.length();
        const width = shown.radius * shown.root.scale.x * 0.55;
        beam.position.copy(base);
        beam.quaternion.setFromUnitVectors(upright, toward.normalize());
        beam.scale.set(width, length, width);
        beam.visible = true;
        beamMaterial.uniforms.uLevel!.value = look.beam * lit;
        // The lamp on the side the object faces, the camera's, and above it.
        showLight.position.set(middleAt.x + Math.sin(spot.yaw) * 2.2, middleAt.y + 1.2, middleAt.z + Math.cos(spot.yaw) * 2.2);
        showLight.intensity = look.lamp * lit;
      } else {
        beam.visible = false;
        beamMaterial.uniforms.uLevel!.value = 0;
        showLight.intensity = 0;
      }
    },
    turn(azimuth) {
      for (const plate of plates) plate.turn(azimuth);
      spine.turn(azimuth);
      for (const { m } of cpuDims) m.envMapRotation.y = azimuth;
    },
    dispose() {
      for (const plate of plates) plate.dispose();
      spine.dispose();
      const textures = new Set<THREE.Texture>([glow, speckle, plainMap, dieMap]);
      const materials = new Set<THREE.Material>([invisible]);
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.geometry) return;
        mesh.geometry.dispose();
        for (const m of ([] as THREE.Material[]).concat(mesh.material)) materials.add(m);
      });
      for (const m of materials) {
        // The room is the scene's, not the world's: it stays.
        for (const [key, value] of Object.entries(m)) if (key !== 'envMap' && (value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
        const uniforms = (m as THREE.ShaderMaterial).uniforms;
        if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as THREE.Texture)?.isTexture) textures.add(u.value as THREE.Texture);
        m.dispose();
      }
      for (const t of textures) t.dispose();
      showLight.dispose();
    }
  };
}
