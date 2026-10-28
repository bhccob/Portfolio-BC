/**
 * The hologram world, built in code (spec 2026-10-27-bob-hologram-world-design.md; the mock-up Bob approved,
 * .superpowers/holo-world-mockup/world.ts): the round board of dark glass with its circuit drawn in light, the CPU at its
 * centre with the compass engraved on its lid, a pad for each project and the project's object floating above it.
 *
 * - **The board:** a disc of dark glass, and over it the circuit in three layers of light, drawn on a canvas: red the
 *   buses from the CPU to each pad, where the current runs; green the fine traces and their vias; blue the rings, the
 *   compass scale round the rim and the pads' rings. The power lights it from the middle out. A fainter rim below it.
 * - **The CPU:** a dark body on gold pins, its lid edged in gold with the compass rose engraved on top, glowing as the
 *   power comes on, and a warm glow under it.
 * - **The pads:** a soft glow, a dashed ring turning slowly and a faint column of light up to the object.
 * - **The objects:** Funcial's chip with a lock on its lid, which lifts off its die of four glowing quadrants as it
 *   opens; Jontai Energy's solar module of 16 hologram cells, which light in turn; Cookies Clicker's quartz crystal and
 *   two gold gears ticking once a second; any other project a plain chip. Each turned a little toward its views.
 *
 * It reads no clock of its own: `pose` is given the clock, so the canvas sleeps when the Void stops giving it time. The
 * gold and dark metals are lit by the scene's room and the light's own lamp; the world adds no lights.
 */
import * as THREE from 'three';
import { type ProjectId, projects } from '~/data/projects';
import type { QualityTier } from '~/engine/quality';
import { type AreaPlace, BOARD, boardCentre, LID_TOP, OBJECT_MIDDLE, objectKind, type ObjectKind } from '~/scene/bob/worldLayout';

/**
 * How the world looks (the mock-up's numbers, tuned there against the site's darkness limit): its colours; the
 * circuit's canvas size and fine traces by tier and its layers' levels; the glass's fill; the pads' glow and column;
 * the CPU's lid from dark to powered and its glow beneath.
 */
export const WORLD_LOOK = {
  colour: { gold: 0xe2a54a, goldLight: 0xffbf6f, violet: 0x6a35b8, haze: 0x8a6cf2, deep: 0x140a24, night: 0x07040e },
  circuit: {
    size: { high: 2048, medium: 1024, low: 1024 },
    traces: { high: 380, medium: 240, low: 140 },
    bus: 0.32,
    pulse: 1.5,
    fine: 0.17,
    rings: 0.34,
    rim: 0.32
  },
  fill: { centre: 0.95, edge: 0.45, alpha: { dark: 0.55, powered: 0.85 } },
  pad: { glow: 0.2, column: 0.2 },
  cpu: { lid: { dark: 0.15, powered: 1.25 }, under: 0.32 }
} as const;

/** What the world is posed by, each frame. */
export interface WorldPose {
  /** The board's power, 0 (dark) to 1 (lit from the middle out to the rim). */
  power: number;
  /** The light's hit on the CPU, 0..1. */
  flash: number;
  /** The world's clock, s: the pulse, the pads' rings, the float and the gears. */
  clock: number;
  /** Each project's light: 0 dark, 1 shown, more when in focus. */
  levels: Readonly<Record<ProjectId, number>>;
  /** How open each project is, 0..1. */
  open: Readonly<Record<ProjectId, number>>;
  /** How much the objects float, 0 (still) to 1. */
  float: number;
  /** The world's own light, 0..1: the board, the CPU and the rim; lower while a project is open. */
  world: number;
}

export interface WorldModel {
  group: THREE.Group;
  /** One thing a click can hit per project, `userData.id` naming it. */
  hits: THREE.Object3D[];
  /** The project's touch points' anchors, one per point in the data's order. */
  anchors(id: ProjectId): THREE.Object3D[];
  /** Where the project's name's line ends. */
  top(id: ProjectId): THREE.Object3D;
  pose(input: WorldPose): void;
  dispose(): void;
}

type P = [number, number];
type Canvas = () => HTMLCanvasElement;

const GOLD = new THREE.Color(WORLD_LOOK.colour.gold);
const GOLD_LIGHT = new THREE.Color(WORLD_LOOK.colour.goldLight);
const VIOLET = new THREE.Color(WORLD_LOOK.colour.violet);
const HAZE = new THREE.Color(WORLD_LOOK.colour.haze);

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

// ---------------------------------------------------------------- the board's circuit

/** A route from s to e in straight and 45° runs: the long way first, then the diagonal. */
function route(s: P, e: P): P[] {
  const dx = e[0] - s[0];
  const dz = e[1] - s[1];
  if (Math.abs(dx) >= Math.abs(dz)) return [s, [s[0] + Math.sign(dx) * (Math.abs(dx) - Math.abs(dz)), s[1]], e];
  return [s, [s[0], s[1] + Math.sign(dz) * (Math.abs(dz) - Math.abs(dx))], e];
}

/** `pts` moved `d` to its left, the corners mitred. */
function offset(pts: P[], d: number): P[] {
  const normals = pts.slice(1).map((p, i) => {
    const q = pts[i]!;
    const l = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
    return [-(p[1] - q[1]) / l, (p[0] - q[0]) / l] as P;
  });
  return pts.map((p, i) => {
    const a = normals[Math.max(0, i - 1)]!;
    const b = normals[Math.min(normals.length - 1, i)]!;
    let m: P = [a[0] + b[0], a[1] + b[1]];
    const l = Math.hypot(m[0], m[1]) || 1;
    m = [m[0] / l, m[1] / l];
    const k = d / Math.max(0.3, m[0] * a[0] + m[1] * a[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}

/** The circuit on a canvas of `size` px, the board's (x, z) round its centre: buses red, fine traces green, rings blue. */
function circuitTexture(c: HTMLCanvasElement, size: number, traces: number, pads: readonly P[]): THREE.CanvasTexture {
  const g = context(c, size);
  const R = BOARD.radius;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  const k = size / (2 * R);
  const X = (x: number) => (x + R) * k;
  const w = (px: number) => (px * size) / 2048;
  const random = seeded(7);
  const stroke = (pts: P[], colour: string, width: number) => {
    g.strokeStyle = colour;
    g.lineWidth = w(width);
    g.lineJoin = 'miter';
    g.lineCap = 'round';
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z))));
    g.stroke();
  };
  const ring = (x: number, z: number, r: number, colour: string, width: number, fill = false) => {
    g.beginPath();
    g.arc(X(x), X(z), r * k, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = colour;
      g.fill();
    } else {
      g.strokeStyle = colour;
      g.lineWidth = w(width);
      g.stroke();
    }
  };
  const inCpu = (x: number, z: number) => Math.abs(x) < 0.98 && Math.abs(z) < 0.98;
  const onPad = (x: number, z: number) => pads.some((p) => Math.hypot(x - p[0], z - p[1]) < 0.78);

  // The fine traces, wandering in straight and 45° runs, a via at each end.
  for (let n = 0; n < traces; n++) {
    let x = 0;
    let z = 0;
    do {
      const r = Math.sqrt(random()) * 3.65;
      const t = random() * Math.PI * 2;
      x = Math.cos(t) * r;
      z = Math.sin(t) * r;
    } while (inCpu(x, z) || onPad(x, z));
    let dir = Math.floor(random() * 8);
    const pts: P[] = [[x, z]];
    const segments = 2 + Math.floor(random() * 5);
    for (let s = 0; s < segments; s++) {
      const len = 0.08 + random() * 0.34;
      const a = (dir * Math.PI) / 4;
      const nx = x + Math.cos(a) * len;
      const nz = z + Math.sin(a) * len;
      if (Math.hypot(nx, nz) > 3.7 || inCpu(nx, nz) || onPad(nx, nz)) break;
      x = nx;
      z = nz;
      pts.push([x, z]);
      if (random() < 0.6) dir = (dir + (random() < 0.5 ? 1 : 7)) % 8;
    }
    if (pts.length < 2) continue;
    const level = 90 + Math.floor(random() * 120);
    stroke(pts, `rgb(0,${level},0)`, random() < 0.2 ? 3 : 1.6);
    for (const p of [pts[0]!, pts[pts.length - 1]!]) ring(p[0], p[1], 0.014, `rgb(0,${level},0)`, 1.6);
  }

  // The CPU's pins fanning out on every side.
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 18; i++) {
      const u = -0.5 + (i + 0.5) / 18;
      const len = 0.12 + random() * 0.38;
      const jog = (random() < 0.5 ? -1 : 1) * random() * 0.2;
      const local: P[] = [
        [u * 1.1, 0.66],
        [u * 1.1, 0.66 + len * 0.5],
        [u * 1.1 + jog, 0.66 + len * 0.5 + Math.abs(jog)],
        [u * 1.1 + jog, 0.66 + len + Math.abs(jog)]
      ];
      const turn = (side * Math.PI) / 2;
      const pts = local.map(([a, b]) => [a * Math.cos(turn) - b * Math.sin(turn), a * Math.sin(turn) + b * Math.cos(turn)] as P);
      stroke(pts, 'rgb(0,200,0)', 1.6);
      const end = pts[pts.length - 1]!;
      ring(end[0], end[1], 0.012, 'rgb(0,200,0)', 1.4);
    }
  }

  // The buses: a bundle of five from the CPU's edge toward each pad, a via at the pad.
  for (const [px, pz] of pads) {
    const l = Math.hypot(px, pz) || 1;
    const out: P = [px / l, pz / l];
    const edge = 0.74 / Math.max(Math.abs(out[0]), Math.abs(out[1]));
    const s: P = [out[0] * edge, out[1] * edge];
    const e: P = [px - out[0] * 0.66, pz - out[1] * 0.66];
    const path = route(s, e);
    for (let b = -2; b <= 2; b++) {
      const pts = offset(path, b * 0.055);
      stroke(pts, 'rgb(255,0,0)', 4.5);
      const end = pts[pts.length - 1]!;
      ring(end[0], end[1], 0.022, 'rgb(255,0,0)', 0, true);
    }
  }

  // The rings: the rim, the compass scale inside it, a dashed ring, the CPU's frame and each pad's rings.
  ring(0, 0, 3.94, 'rgb(0,0,255)', 4);
  ring(0, 0, 3.985, 'rgb(0,0,160)', 2);
  ring(0, 0, 3.72, 'rgb(0,0,150)', 1.6);
  for (let d = 0; d < 360; d += 2) {
    const len = d % 90 === 0 ? 0.26 : d % 10 === 0 ? 0.15 : 0.07;
    const a = (d * Math.PI) / 180;
    stroke(
      [
        [Math.cos(a) * 3.72, Math.sin(a) * 3.72],
        [Math.cos(a) * (3.72 + len), Math.sin(a) * (3.72 + len)]
      ],
      d % 10 === 0 ? 'rgb(0,0,230)' : 'rgb(0,0,140)',
      d % 90 === 0 ? 3 : 1.6
    );
  }
  g.setLineDash([w(10), w(16)]);
  ring(0, 0, 3.25, 'rgb(0,0,120)', 1.6);
  g.setLineDash([]);
  for (const h of [0.86, 0.93]) {
    stroke(
      [
        [-h, -h],
        [h, -h],
        [h, h],
        [-h, h],
        [-h, -h]
      ],
      'rgb(0,0,170)',
      h < 0.9 ? 2.4 : 1.4
    );
  }
  for (const [px, pz] of pads) {
    ring(px, pz, 0.6, 'rgb(0,0,220)', 3);
    ring(px, pz, 0.48, 'rgb(0,0,140)', 1.6);
    for (let d = 0; d < 360; d += 15) {
      const t = (d * Math.PI) / 180;
      stroke(
        [
          [px + Math.cos(t) * 0.63, pz + Math.sin(t) * 0.63],
          [px + Math.cos(t) * 0.7, pz + Math.sin(t) * 0.7]
        ],
        'rgb(0,0,160)',
        1.6
      );
    }
  }
  return texture(c);
}

const BOARD_VERTEX = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vXZ = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CIRCUIT_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uPower;
  uniform float uLevel;
  uniform float uR;
  uniform vec3 uGold;
  uniform vec3 uViolet;
  uniform vec4 uLook;
  uniform float uRim;
  varying vec2 vXZ;
  void main() {
    vec4 t = texture2D(uMap, vXZ / (2.0 * uR) + 0.5);
    float r = length(vXZ);
    float reach = uPower * uR * 1.25;
    float on = 1.0 - smoothstep(reach - 0.5, reach, r);
    float front = exp(-(r - reach) * (r - reach) * 9.0) * (1.0 - step(0.999, uPower));
    float pulse = pow(max(0.0, 0.5 + 0.5 * sin(r * 2.4 - uTime * 1.5)), 10.0);
    vec3 c = uGold * t.r * (uLook.x + uLook.y * pulse)
           + mix(uViolet, uGold, 0.3) * t.g * uLook.z
           + mix(uGold, uViolet, 0.35) * t.b * uLook.w;
    c += uViolet * exp(-(uR - r) * 16.0) * uRim;
    c = c * on + uGold * (t.r + t.g * 0.5 + t.b * 0.5) * front * 1.4;
    gl_FragColor = vec4(c * uLevel, 1.0);
  }
`;

const FILL_FRAGMENT = /* glsl */ `
  uniform float uR;
  uniform float uAlpha;
  uniform vec3 uDeep;
  uniform vec3 uViolet;
  uniform vec2 uShade;
  varying vec2 vXZ;
  void main() {
    float r = length(vXZ) / uR;
    vec3 c = mix(uDeep * uShade.x, uDeep * uShade.y, r) + uViolet * exp(-(1.0 - r) * 30.0) * 0.12;
    gl_FragColor = vec4(c, uAlpha * (1.0 - smoothstep(0.985, 1.0, r)));
  }
`;

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

/** A padlock on a chip's lid, drawn so it reads the right way up from outside, where its views look in from. */
function lockTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const size = 256;
  const g = context(c, size);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = size * 0.035;
  g.beginPath();
  g.arc(size / 2, size * 0.44, size * 0.1, Math.PI, 0);
  g.lineTo(size * 0.6, size * 0.5);
  g.moveTo(size * 0.4, size * 0.5);
  g.lineTo(size * 0.4, size * 0.44);
  g.stroke();
  g.fillRect(size * 0.35, size * 0.5, size * 0.3, size * 0.2);
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(size / 2, size * 0.58, size * 0.025, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#777';
  g.lineWidth = size * 0.008;
  g.strokeRect(size * 0.12, size * 0.12, size * 0.76, size * 0.76);
  const t = texture(c);
  t.flipY = true;
  return t;
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

// ---------------------------------------------------------------- shaders of the pads and the objects

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

const additive = (material: THREE.Material): THREE.Material => {
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
  /** How high the object's middle stands above its float, m. */
  middle: number;
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

export function buildWorld(places: readonly AreaPlace[], tier: QualityTier, canvas: Canvas = () => document.createElement('canvas')): WorldModel {
  const look = WORLD_LOOK;
  const group = new THREE.Group();
  group.name = 'world';
  const centre = boardCentre();
  group.position.set(...centre);

  const glow = glowTexture(canvas());
  const speckle = speckleTexture(canvas());
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a520, metalness: 1, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0912, metalness: 0.55, roughness: 0.48, map: speckle });

  /** A lid: gold edges and a dark top whose engraving (`emblem`) glows gold. */
  const lid = (size: number, height: number, emblem: THREE.Texture, glowing: number): { mesh: THREE.Mesh; top: THREE.MeshStandardMaterial } => {
    const top = new THREE.MeshStandardMaterial({
      color: 0x110d16,
      metalness: 0.35,
      roughness: 0.62,
      map: speckle,
      emissive: GOLD,
      emissiveMap: emblem,
      emissiveIntensity: glowing
    });
    return { mesh: new THREE.Mesh(new THREE.BoxGeometry(size, height, size), [gold, gold, top, dark, gold, gold]), top };
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

  // The board.
  const pads: P[] = places.flatMap((a) => a.projects.map((p): P => [p.pad[0] - centre[0], p.pad[2] - centre[2]]));
  const board = new THREE.Group();
  board.name = 'world:board';
  const disc = new THREE.CircleGeometry(BOARD.radius, 160).rotateX(-Math.PI / 2);
  const fillMaterial = new THREE.ShaderMaterial({
    vertexShader: BOARD_VERTEX,
    fragmentShader: FILL_FRAGMENT,
    uniforms: {
      uR: { value: BOARD.radius },
      uAlpha: { value: look.fill.alpha.dark },
      uDeep: { value: new THREE.Color(look.colour.deep) },
      uViolet: { value: VIOLET },
      uShade: { value: new THREE.Vector2(look.fill.centre, look.fill.edge) }
    },
    transparent: true,
    depthWrite: false
  });
  const fill = new THREE.Mesh(disc, fillMaterial);
  fill.name = 'world:board:glass';
  fill.renderOrder = 1;
  const c = look.circuit;
  const circuitMaterial = additive(
    new THREE.ShaderMaterial({
      vertexShader: BOARD_VERTEX,
      fragmentShader: CIRCUIT_FRAGMENT,
      uniforms: {
        uMap: { value: circuitTexture(canvas(), c.size[tier], c.traces[tier], pads) },
        uTime: { value: 0 },
        uPower: { value: 0 },
        uLevel: { value: 1 },
        uR: { value: BOARD.radius },
        uGold: { value: GOLD },
        uViolet: { value: HAZE },
        uLook: { value: new THREE.Vector4(c.bus, c.pulse, c.fine, c.rings) },
        uRim: { value: c.rim }
      }
    })
  ) as THREE.ShaderMaterial;
  const circuit = new THREE.Mesh(disc.clone(), circuitMaterial);
  circuit.name = 'world:board:circuit';
  circuit.position.y = 0.002;
  circuit.renderOrder = 2;
  const underMaterial = additive(new THREE.MeshBasicMaterial({ color: VIOLET.clone().multiplyScalar(0.6) })) as THREE.MeshBasicMaterial;
  const under = new THREE.Mesh(new THREE.RingGeometry(BOARD.radius - 0.03, BOARD.radius, 160).rotateX(-Math.PI / 2), underMaterial);
  under.name = 'world:board:under';
  under.position.y = -0.22;
  under.renderOrder = 2;
  board.add(fill, circuit, under);
  group.add(board);

  // The CPU.
  const cpu = new THREE.Group();
  cpu.name = 'world:cpu';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.16, 1.24), dark);
  body.position.y = 0.1;
  const cap = lid(1.1, 0.05, compassTexture(canvas()), look.cpu.lid.dark);
  cap.mesh.position.y = LID_TOP - 0.025;
  const cpuGlowMaterial = additive(new THREE.MeshBasicMaterial({ map: glow, color: GOLD, opacity: 0 })) as THREE.MeshBasicMaterial;
  const cpuGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2), cpuGlowMaterial);
  cpuGlow.position.y = 0.01;
  cpuGlow.renderOrder = 3;
  cpu.add(body, cap.mesh, pins(1.24, 20, 0.16, 0.05), cpuGlow);
  group.add(cpu);

  // The pads and the objects.
  const lockMap = lockTexture(canvas());
  const plainMap = frameTexture(canvas());
  const dieMap = dieTexture(canvas());
  const testPoints = (id: ProjectId): number => projects.byId(id)?.testPoints.length ?? 0;

  const chip = (id: ProjectId, emblem: THREE.Texture): Made => {
    const made = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.62), dark);
    base.position.y = 0.035;
    const dieMaterial = new THREE.MeshBasicMaterial({ map: dieMap, color: new THREE.Color(0.3, 0.3, 0.3) });
    const die = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48).rotateX(-Math.PI / 2), dieMaterial);
    die.position.y = 0.0705;
    const top = lid(0.6, 0.04, emblem, 0.6);
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
      middle: OBJECT_MIDDLE.chip,
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
      ) as THREE.ShaderMaterial;
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
      middle: OBJECT_MIDDLE.solar,
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
    ) as THREE.ShaderMaterial;
    const stone = new THREE.Group();
    stone.position.set(-0.13, 0.38, 0);
    stone.rotation.z = 0.12;
    const glass = new THREE.Mesh(lathe, glassMaterial);
    glass.renderOrder = 4;
    const edgeMaterial = additive(new THREE.LineBasicMaterial({ color: GOLD_LIGHT })) as THREE.LineBasicMaterial;
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
      middle: OBJECT_MIDDLE.crystal,
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

  // Steady's streak path and Porfael's ring stand as the old lock chip and a plain chip until the stack brings their own.
  const makers: Record<ObjectKind, (id: ProjectId) => Made> = {
    streak: (id) => chip(id, lockMap),
    portfolio: (id) => chip(id, plainMap),
    chip: (id) => chip(id, plainMap),
    solar,
    crystal
  };

  interface Placed {
    id: ProjectId;
    made: Made;
    float: THREE.Group;
    pad: { set(clock: number, level: number): void };
    phase: number;
  }

  const placed: Placed[] = [];
  const hits: THREE.Object3D[] = [];
  for (const area of places) {
    for (const { id, pad, out } of area.projects) {
      const holder = new THREE.Group();
      holder.name = `world:project:${id}`;
      holder.position.set(pad[0] - centre[0], 0, pad[2] - centre[2]);
      // Its local +z points out from the CPU, toward where its views look in from.
      holder.rotation.y = Math.atan2(out[0], out[2]);

      const padGroup = new THREE.Group();
      padGroup.name = `world:pad:${id}`;
      const glowMaterial = additive(new THREE.MeshBasicMaterial({ map: glow, color: HAZE })) as THREE.MeshBasicMaterial;
      const padGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), glowMaterial);
      padGlow.position.y = 0.006;
      const ringMaterial = additive(
        new THREE.ShaderMaterial({ vertexShader: UV_VERTEX, fragmentShader: RING_FRAGMENT, uniforms: { uTime: { value: 0 }, uLevel: { value: 1 }, uGold: { value: GOLD } } })
      ) as THREE.ShaderMaterial;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.545, 128).rotateX(-Math.PI / 2), ringMaterial);
      ring.position.y = 0.008;
      const columnMaterial = additive(
        new THREE.ShaderMaterial({
          vertexShader: FACING_VERTEX,
          fragmentShader: COLUMN_FRAGMENT,
          uniforms: { uTime: { value: 0 }, uLevel: { value: 1 }, uViolet: { value: HAZE }, uGold: { value: GOLD } },
          side: THREE.DoubleSide
        })
      ) as THREE.ShaderMaterial;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, BOARD.hover * 0.9, 64, 1, true).translate(0, (BOARD.hover * 0.9) / 2, 0), columnMaterial);
      for (const m of [padGlow, ring, column]) m.renderOrder = 3;
      padGroup.add(padGlow, ring, column);

      const made = makers[objectKind(id)](id);
      made.body.rotation.y = BOARD.turn;
      const float = new THREE.Group();
      float.name = `world:object:${id}`;
      float.position.y = BOARD.hover;
      float.add(made.body);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.name = `world:hit:${id}`;
      hit.position.y = made.middle;
      hit.userData.id = id;
      float.add(hit);
      hits.push(hit);
      holder.add(padGroup, float);
      group.add(holder);
      placed.push({
        id,
        made,
        float,
        phase: placed.length * 2.1,
        pad: {
          set(clock, level) {
            glowMaterial.opacity = look.pad.glow * level;
            ringMaterial.uniforms.uTime!.value = clock;
            ringMaterial.uniforms.uLevel!.value = level;
            columnMaterial.uniforms.uTime!.value = clock;
            columnMaterial.uniforms.uLevel!.value = look.pad.column * level;
          }
        }
      });
    }
  }

  const find = (id: ProjectId): Placed => {
    const p = placed.find((q) => q.id === id);
    if (!p) throw new RangeError(`"${id}" is not on the world`);
    return p;
  };

  return {
    group,
    hits,
    anchors: (id) => find(id).made.anchors,
    top: (id) => find(id).made.top,
    pose({ power, flash, clock, levels, open, float, world }) {
      circuitMaterial.uniforms.uTime!.value = clock;
      circuitMaterial.uniforms.uPower!.value = power;
      circuitMaterial.uniforms.uLevel!.value = world;
      fillMaterial.uniforms.uAlpha!.value = look.fill.alpha.dark + (look.fill.alpha.powered - look.fill.alpha.dark) * power;
      underMaterial.opacity = power * world;
      cap.top.emissiveIntensity = (look.cpu.lid.dark + (look.cpu.lid.powered - look.cpu.lid.dark) * power) * world + flash;
      cpuGlowMaterial.opacity = look.cpu.under * power * world + flash * 0.6;
      for (const p of placed) {
        const level = levels[p.id] ?? 0;
        const opened = open[p.id] ?? 0;
        p.float.position.y = BOARD.hover + Math.sin((clock * Math.PI * 2) / 5.5 + p.phase) * 0.035 * float;
        p.made.set(clock, opened, level);
        p.pad.set(clock, level * (1 - 0.65 * opened));
      }
    },
    dispose() {
      const textures = new Set<THREE.Texture>([glow, speckle, lockMap, plainMap, dieMap]);
      const materials = new Set<THREE.Material>();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.geometry) return;
        mesh.geometry.dispose();
        for (const m of ([] as THREE.Material[]).concat(mesh.material)) materials.add(m);
      });
      for (const m of materials) {
        for (const value of Object.values(m)) if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
        const uniforms = (m as THREE.ShaderMaterial).uniforms;
        if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as THREE.Texture)?.isTexture) textures.add(u.value as THREE.Texture);
        m.dispose();
      }
      for (const t of textures) t.dispose();
    }
  };
}
