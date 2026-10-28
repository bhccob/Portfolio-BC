/**
 * A board of the quantum stack, built in code (spec 2026-10-28-bob-quantum-stack-design.md, goal 8; after the mock-up
 * Bob approved, .superpowers/holo-world-4-mockup/plate.ts): a thick round circuit board, its layers showing at the edge,
 * a glossy dark solder mask over raised copper, bare gold pads and white print, and several hundred parts on it in 3D.
 *
 * - **The power board** (`cpu`) carries the CPU's socket print and its power stage: square rings of capacitors, chokes
 *   and switches round where the CPU stands.
 * - **A category board** has a hole through its middle for the spine, ringed by the spine's connector (two print rings
 *   and ninety-six short lines out to vias), a ring of chokes and one of switches; its category's name runs along the
 *   rim on the side its projects face (`facing`).
 * - **On every board:** a bus of sixteen lines from the middle to each project's socket and one of eight to each
 *   processor under a finned heat sink, rows of standing memory modules, big capacitors, chips with their decoupling,
 *   rows of resistors, crystals and headers; copper pours, length-matched serpentines and fine traces in what is left;
 *   the rim's card-edge fingers, stitching vias and compass scale; each socket's pins, ring and number.
 *
 * The layout (`plateLayout`) is plain numbers, seeded, so the same spec is the same board. The textures come from
 * `canvas()`, the print in Martian Mono, which the Void loads before it builds. The light on the board (red its buses,
 * where the current runs; green the fine copper; blue the print) reaches out from the middle with the power. It reads no
 * clock of its own: `set` is given the clock.
 */
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';

type P = [number, number];
type Canvas = () => HTMLCanvasElement;

export interface PlateSpec {
  /** Its radius, m, and the hole through its middle for the spine (0 on the power board, which has none). */
  radius: number;
  hole: number;
  cpu: boolean;
  /** Its projects' sockets (x, z from the spine), and the number the first one is printed with. */
  sockets: P[];
  firstSocket: number;
  /** Its category's name, printed along the rim on the side it faces (rad, 0 toward +z). */
  label: string;
  facing: number;
  seed: number;
}

/**
 * How a board looks by tier: its textures' size, px; the share of its small parts (resistors, capacitors, their rows
 * and the fine traces) it lays; its thickness, m (its top at y = 0).
 */
export const PLATE_LOOK = {
  size: { high: 2048, medium: 1024, low: 1024 },
  parts: { high: 1, medium: 0.6, low: 0.35 },
  thick: 0.2
} as const;

const THICK = PLATE_LOOK.thick;
const GOLD = new THREE.Color(0xe2a54a);
const HAZE = new THREE.Color(0x8a6cf2);

/** A seeded random, 0..1: the same seed, the same board. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function context(c: HTMLCanvasElement, width: number, height = width): CanvasRenderingContext2D {
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  if (!g) throw new TypeError('a board needs a 2D canvas context');
  return g;
}

function texture(c: HTMLCanvasElement, colour = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.anisotropy = 8;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- geometry

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

// ---------------------------------------------------------------- where things stand

/** The grid's cell, m: what is taken is marked on it, so parts and traces never land on each other. */
const CELL = 0.04;

interface Grid {
  /** Whether a rectangle (half sizes hw, hd, turned by yaw, grown by pad) is all free. */
  fits(x: number, z: number, hw: number, hd: number, yaw: number, pad?: number): boolean;
  mark(x: number, z: number, hw: number, hd: number, yaw: number, pad?: number): void;
  markDisc(x: number, z: number, r: number): void;
  markLine(pts: P[], half: number): void;
}

function gridOf(R: number): Grid {
  const N = Math.ceil((2 * R) / CELL);
  const taken = new Uint8Array(N * N);
  const cellOf = (v: number): number => Math.floor((v + R) / CELL);
  // The rim: nothing stands in its last 0.68 m.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (Math.hypot((i + 0.5) * CELL - R, (j + 0.5) * CELL - R) > R - 0.68) taken[j * N + i] = 1;
  /** Every cell of the rectangle: `test` says stop when it returns false. */
  const cells = (x: number, z: number, hw: number, hd: number, yaw: number, pad: number, test: (i: number) => boolean): boolean => {
    const r = Math.hypot(hw, hd) + pad;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let j = cellOf(z - r); j <= cellOf(z + r); j++) {
      for (let i = cellOf(x - r); i <= cellOf(x + r); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) return false;
        const dx = (i + 0.5) * CELL - R - x;
        const dz = (j + 0.5) * CELL - R - z;
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        if (Math.abs(lx) <= hw + pad && Math.abs(lz) <= hd + pad && !test(j * N + i)) return false;
      }
    }
    return true;
  };
  const grid: Grid = {
    fits: (x, z, hw, hd, yaw, pad = 0.03) => cells(x, z, hw, hd, yaw, pad, (i) => taken[i] === 0),
    mark: (x, z, hw, hd, yaw, pad = 0) => void cells(x, z, hw, hd, yaw, pad, (i) => ((taken[i] = 1), true)),
    markDisc: (x, z, r) => grid.mark(x, z, r * 0.71, r * 0.71, Math.PI / 4, r * 0.29),
    markLine: (pts, half) => {
      for (let n = 1; n < pts.length; n++) {
        const [ax, az] = pts[n - 1]!;
        const [bx, bz] = pts[n]!;
        const l = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t <= l; t += CELL) grid.markDisc(ax + ((bx - ax) * t) / l, az + ((bz - az) * t) / l, half);
      }
    }
  };
  return grid;
}

// ---------------------------------------------------------------- the parts

type Kind = 'r' | 'c' | 'soic' | 'qfp' | 'bga' | 'elec' | 'choke' | 'xtal' | 'header' | 'sink' | 'bigcap' | 'dimm';

/** A part on the board: its kind, its middle (x, z), its turn, its footprint's half sizes (pads included), its print name. */
export interface PlatePart {
  kind: Kind;
  x: number;
  z: number;
  yaw: number;
  half: P;
  name: string;
}

/** Each kind's footprint (half sizes, m, pads included). */
const FOOT: Record<Kind, P> = {
  r: [0.042, 0.02],
  c: [0.052, 0.03],
  soic: [0.13, 0.115],
  qfp: [0.205, 0.205],
  bga: [0.27, 0.27],
  elec: [0.105, 0.105],
  choke: [0.125, 0.125],
  xtal: [0.11, 0.045],
  header: [0.22, 0.06],
  sink: [0.32, 0.32],
  bigcap: [0.17, 0.17],
  dimm: [0.66, 0.08]
};
const PREFIX: Record<Kind, string> = { r: 'R', c: 'C', soic: 'U', qfp: 'U', bga: 'U', elec: 'C', choke: 'L', xtal: 'Y', header: 'J', sink: 'U', bigcap: 'C', dimm: 'M' };

/** Where the bus from the middle toward `out` starts: the CPU's side on the power board, the spine's ring elsewhere. */
function busStart(spec: PlateSpec, out: P): P {
  if (!spec.cpu) return [out[0] * (spec.hole + 0.18), out[1] * (spec.hole + 0.18)];
  const k = 1.18 / Math.max(Math.abs(out[0]), Math.abs(out[1]));
  return [out[0] * k, out[1] * k];
}

/** The layout and the grid it leaves: the drawing lays its pours and traces in what is still free. */
function layOut(spec: PlateSpec, tier: QualityTier): { parts: PlatePart[]; buses: P[][][]; grid: Grid } {
  const R = spec.radius;
  const grid = gridOf(R);
  const random = seeded(spec.seed);
  const share = PLATE_LOOK.parts[tier];
  const parts: PlatePart[] = [];
  const count: Record<string, number> = {};
  const add = (kind: Kind, x: number, z: number, yaw: number, pad = 0.03): boolean => {
    const [hw, hd] = FOOT[kind];
    if (!grid.fits(x, z, hw, hd, yaw, pad)) return false;
    grid.mark(x, z, hw, hd, yaw, 0.012);
    const p = PREFIX[kind];
    count[p] = (count[p] ?? 0) + 1;
    parts.push({ kind, x, z, yaw, half: [hw, hd], name: `${p}${count[p]! + (p === 'R' ? 100 : 0)}` });
    return true;
  };

  // What nothing else may stand on: the CPU, the spine's hole, the sockets (the rim is the grid's own).
  if (spec.cpu) grid.mark(0, 0, 1.32, 1.32, 0);
  else grid.markDisc(0, 0, spec.hole + 0.14);
  for (const [x, z] of spec.sockets) grid.markDisc(x, z, 1.08);

  // The buses: sixteen lines from the middle to each project's socket.
  const buses = spec.sockets.map(([x, z]) => {
    const l = Math.hypot(x, z);
    const out: P = [x / l, z / l];
    const path = route(busStart(spec, out), [x - out[0] * 1.02, z - out[1] * 1.02]);
    grid.markLine(path, 0.34);
    return Array.from({ length: 16 }, (_, b) => offset(path, (b - 7.5) * 0.032));
  });

  // Heat-sunk processors, each at the end of its own eight-line bus from the middle, on the side away from the projects.
  const sinkBuses: P[][][] = [];
  for (let n = 0; n < 4; n++) {
    const t = spec.facing + Math.PI * (0.42 + n * 0.39);
    const r = R * 0.6;
    const x = Math.sin(t) * r;
    const z = Math.cos(t) * r;
    if (!add('sink', x, z, Math.round(t / (Math.PI / 4)) * (Math.PI / 4), 0.1)) continue;
    const out: P = [Math.sin(t), Math.cos(t)];
    const path = route(busStart(spec, out), [x - out[0] * 0.42, z - out[1] * 0.42]);
    grid.markLine(path, 0.2);
    sinkBuses.push(Array.from({ length: 8 }, (_, b) => offset(path, (b - 3.5) * 0.032)));
  }
  // Rows of standing memory modules near the rim, three to a row.
  for (const t of [spec.facing + Math.PI * 0.75, spec.facing - Math.PI * 0.62]) {
    for (let m = 0; m < 3; m++) {
      const r = R * 0.78 - 0.22 + m * 0.22;
      add('dimm', Math.sin(t) * r, Math.cos(t) * r, t, 0.02);
    }
  }

  // The power stage: on the power board square rings of capacitors, chokes and switches round the CPU; on a category
  // board a ring of chokes and one of switches round the spine.
  const ring = (h: number, step: number, place: (x: number, z: number, yaw: number) => void): void => {
    for (let side = 0; side < 4; side++) {
      for (let u = -h + step / 2; u < h; u += step) {
        const turn = (side * Math.PI) / 2;
        place(Math.cos(turn) * h - Math.sin(turn) * u, Math.sin(turn) * h + Math.cos(turn) * u, -turn);
      }
    }
  };
  if (spec.cpu) {
    ring(1.5, 0.25, (x, z) => add('elec', x, z, 0, 0.01));
    ring(1.86, 0.33, (x, z, yaw) => add('choke', x, z, yaw, 0.02));
    ring(2.2, 0.36, (x, z, yaw) => add('soic', x, z, yaw, 0.03));
  } else {
    const r1 = spec.hole + 0.42;
    const r2 = spec.hole + 0.86;
    for (let t = 0; t < Math.PI * 2; t += 0.3 / r1) add('choke', Math.sin(t) * r1, Math.cos(t) * r1, -t, 0.02);
    for (let t = 0.15; t < Math.PI * 2; t += 0.4 / r2) add('soic', Math.sin(t) * r2, Math.cos(t) * r2, Math.round(-t / (Math.PI / 4)) * (Math.PI / 4), 0.03);
  }
  const inner = spec.cpu ? 2.0 : spec.hole + 1.15;
  const outer = R - 0.75;

  // Memory and controllers: big chips in the gaps between the buses.
  const bgaAngles: number[] = [];
  for (let a = 0; a < 360 && bgaAngles.length < (spec.cpu ? 5 : 4); a += 6) {
    const t = (a * Math.PI) / 180;
    if (bgaAngles.some((b) => Math.abs(((t - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.75)) continue;
    for (const r of [R * 0.45, R * 0.53, R * 0.4]) {
      if (add('bga', Math.sin(t) * r, Math.cos(t) * r, Math.round(t / (Math.PI / 4)) * (Math.PI / 4), 0.06)) {
        bgaAngles.push(t);
        break;
      }
    }
  }

  // Chips scattered over the rest, each turned to the board's grid or 45° off it.
  const scatter = (kind: Kind, n: number, rMin: number, rMax: number, pad: number): void => {
    for (let tries = 0, made = 0; made < n && tries < n * 60; tries++) {
      const r = rMin + random() * (rMax - rMin);
      const t = random() * Math.PI * 2;
      const yaw = random() < 0.75 ? Math.floor(random() * 4) * (Math.PI / 2) : Math.round(t / (Math.PI / 4)) * (Math.PI / 4);
      if (add(kind, Math.sin(t) * r, Math.cos(t) * r, yaw, pad)) made++;
    }
  };
  scatter('qfp', 7, inner, outer - 0.1, 0.08);
  scatter('soic', 14, inner, outer, 0.06);
  scatter('xtal', 4, inner, outer, 0.05);

  // Decoupling capacitors beside every chip, fewer on the lower tiers.
  const decoupling = Math.round(6 * share);
  for (const chip of parts.filter((p) => p.kind === 'qfp' || p.kind === 'soic' || p.kind === 'bga')) {
    const [hw, hd] = FOOT[chip.kind];
    const c = Math.cos(chip.yaw);
    const s = Math.sin(chip.yaw);
    for (let n = 0; n < decoupling; n++) {
      const side = n % 4;
      const along = (random() - 0.5) * 1.4;
      const lx = side === 0 ? hw + 0.07 : side === 1 ? -hw - 0.07 : along * hw;
      const lz = side === 2 ? hd + 0.06 : side === 3 ? -hd - 0.06 : along * hd;
      add(random() < 0.6 ? 'c' : 'r', chip.x + lx * c + lz * s, chip.z - lx * s + lz * c, chip.yaw + (side < 2 ? Math.PI / 2 : 0), 0.008);
    }
  }

  // Rows of resistors, the way a board lays out its arrays.
  for (let rows = 0, tries = 0; rows < Math.round(22 * share) && tries < 900; tries++) {
    const r = inner + random() * (outer - inner);
    const t = random() * Math.PI * 2;
    const yaw = Math.floor(random() * 4) * (Math.PI / 4);
    const len = 5 + Math.floor(random() * 6);
    const kind: Kind = random() < 0.7 ? 'r' : 'c';
    let made = 0;
    for (let n = 0; n < len; n++) {
      const u = (n - len / 2) * (kind === 'r' ? 0.07 : 0.085);
      if (add(kind, Math.sin(t) * r + Math.sin(yaw) * u, Math.cos(t) * r + Math.cos(yaw) * u, yaw + Math.PI / 2, 0.006)) made++;
    }
    if (made > 2) rows++;
  }
  scatter('r', Math.round(120 * share), inner, outer, 0.02);
  scatter('c', Math.round(75 * share), inner, outer, 0.02);
  scatter('header', 3, outer - 0.8, outer, 0.08);
  scatter('bigcap', 7, inner, outer, 0.06);
  return { parts, buses: [...buses, ...sinkBuses], grid };
}

/** The board's parts and its buses (each a bundle of lines), the sockets' first, then the processors'. Pure and seeded. */
export function plateLayout(spec: PlateSpec, tier: QualityTier): { parts: PlatePart[]; buses: P[][][] } {
  const { parts, buses } = layOut(spec, tier);
  return { parts, buses };
}

// ---------------------------------------------------------------- the textures

/** Colours of the board's look (sRGB), and its data texture's values: height, roughness, metalness (0–255). */
const MASK = '#0d0919';
const COPPER = '#1f1638';
const POUR = '#150f29';
const PAD = '#b3893a';
const SILK = '#7a7299';
const HOLE = '#030106';
const D_MASK = 'rgb(0,108,0)';
const D_COPPER = 'rgb(125,100,0)';
const D_POUR = 'rgb(80,104,0)';
const D_PAD = 'rgb(165,72,255)';
const D_SILK = 'rgb(195,205,0)';
const D_HOLE = 'rgb(0,150,0)';

const FONT = '"Martian Mono Variable", ui-monospace, Consolas, monospace';

/** The board's three textures: its light (red the buses, green the copper, blue the print), its colour and its data. */
function drawBoard(spec: PlateSpec, tier: QualityTier, parts: PlatePart[], buses: P[][][], grid: Grid, canvas: Canvas): { glow: THREE.CanvasTexture; base: THREE.CanvasTexture; data: THREE.CanvasTexture } {
  const R = spec.radius;
  const SIZE = PLATE_LOOK.size[tier];
  const K = SIZE / (2 * R);
  const X = (v: number): number => (v + R) * K;
  const glowC = canvas();
  const baseC = canvas();
  const dataC = canvas();
  const glow = context(glowC, SIZE);
  const base = context(baseC, SIZE);
  const data = context(dataC, SIZE);
  const random = seeded(spec.seed + 77);
  glow.fillStyle = '#000';
  glow.fillRect(0, 0, SIZE, SIZE);
  glow.globalCompositeOperation = 'lighter';
  const g = base.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0, '#130c24');
  g.addColorStop(0.6, MASK);
  g.addColorStop(1, '#0a0714');
  base.fillStyle = g;
  base.fillRect(0, 0, SIZE, SIZE);
  data.fillStyle = D_MASK;
  data.fillRect(0, 0, SIZE, SIZE);
  for (const c of [glow, base, data]) {
    c.lineJoin = 'miter';
    c.lineCap = 'round';
  }

  const path = (c: CanvasRenderingContext2D, pts: P[]): void => {
    c.beginPath();
    pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), X(z)) : c.moveTo(X(x), X(z))));
  };
  const stroke = (c: CanvasRenderingContext2D, pts: P[], style: string, w: number): void => {
    c.strokeStyle = style;
    c.lineWidth = w * K;
    path(c, pts);
    c.stroke();
  };
  const disc = (c: CanvasRenderingContext2D, x: number, z: number, r: number, style: string): void => {
    c.fillStyle = style;
    c.beginPath();
    c.arc(X(x), X(z), r * K, 0, Math.PI * 2);
    c.fill();
  };
  const circle = (c: CanvasRenderingContext2D, x: number, z: number, r: number, style: string, w: number): void => {
    c.strokeStyle = style;
    c.lineWidth = w * K;
    c.beginPath();
    c.arc(X(x), X(z), r * K, 0, Math.PI * 2);
    c.stroke();
  };
  /** Copper under the mask: raised a little, lighter, and (when `light` is given) lit on the glow layer. */
  const trace = (pts: P[], w: number, light?: string): void => {
    stroke(base, pts, COPPER, w);
    stroke(data, pts, D_COPPER, w);
    if (light) stroke(glow, pts, light, w);
  };
  const via = (x: number, z: number, r: number, light?: string): void => {
    disc(base, x, z, r, COPPER);
    disc(data, x, z, r, D_COPPER);
    disc(base, x, z, r * 0.45, HOLE);
    disc(data, x, z, r * 0.45, D_HOLE);
    if (light) circle(glow, x, z, r * 0.75, light, r * 0.5);
  };
  /** An exposed gold pad (a rectangle, turned by yaw round x, z). */
  const pad = (x: number, z: number, w: number, d: number, yaw: number): void => {
    for (const [c, s] of [
      [base, PAD],
      [data, D_PAD]
    ] as const) {
      c.save();
      c.translate(X(x), X(z));
      c.rotate(-yaw);
      c.fillStyle = s;
      c.fillRect((-w / 2) * K, (-d / 2) * K, w * K, d * K);
      c.restore();
    }
  };
  /** White print: lines, or words at x, z, `size` m high, turned by `turn`. */
  const silk = (pts: P[], w: number, light = 'rgb(0,0,60)'): void => {
    stroke(base, pts, SILK, w);
    stroke(data, pts, D_SILK, w);
    stroke(glow, pts, light, w);
  };
  const words = (text: string, x: number, z: number, size: number, turn: number, light = 'rgb(0,0,70)', spacing = 0.12): void => {
    for (const [c, s] of [
      [base, SILK],
      [data, D_SILK],
      [glow, light]
    ] as const) {
      c.save();
      c.translate(X(x), X(z));
      c.rotate(turn);
      c.fillStyle = s;
      c.font = `500 ${size * K}px ${FONT}`;
      c.letterSpacing = `${size * K * spacing}px`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, 0, 0);
      c.restore();
    }
  };
  /** Words along an arc of radius r centred on angle a, upright seen from outside the board. */
  const arcWords = (text: string, a: number, r: number, size: number, light: string): void => {
    const step = (size * 0.86) / r;
    [...text].forEach((ch, i) => {
      const t = a + (i - (text.length - 1) / 2) * step;
      words(ch, Math.sin(t) * r, Math.cos(t) * r, size, -t, light, 0);
    });
  };

  // Copper pours: blocks of fine cross-hatched copper where the board is still free.
  const BLOCK = 0.56;
  for (let bz = -R; bz < R; bz += BLOCK) {
    for (let bx = -R; bx < R; bx += BLOCK) {
      const cx = bx + BLOCK / 2;
      const cz = bz + BLOCK / 2;
      if (random() < 0.45 || !grid.fits(cx, cz, BLOCK / 2, BLOCK / 2, 0, 0)) continue;
      for (const [c, s] of [
        [base, POUR],
        [data, D_POUR]
      ] as const) {
        c.save();
        c.beginPath();
        c.rect(X(bx + 0.03), X(bz + 0.03), (BLOCK - 0.06) * K, (BLOCK - 0.06) * K);
        c.clip();
        c.strokeStyle = s;
        c.lineWidth = 0.006 * K;
        c.beginPath();
        for (let u = -BLOCK; u < BLOCK * 2; u += 0.045) {
          c.moveTo(X(bx + u), X(bz));
          c.lineTo(X(bx + u + BLOCK), X(bz + BLOCK));
          c.moveTo(X(bx + u + BLOCK), X(bz));
          c.lineTo(X(bx + u), X(bz + BLOCK));
        }
        c.stroke();
        c.restore();
      }
      grid.mark(cx, cz, BLOCK / 2, BLOCK / 2, 0);
      if (random() < 0.5) via(cx + (random() - 0.5) * 0.3, cz + (random() - 0.5) * 0.3, 0.02, 'rgb(0,60,0)');
    }
  }

  // The rim: card-edge fingers, a ring of stitching vias, the compass scale with its numbers, the outer print.
  for (let d = 0; d < 360; d += 1.2) {
    if (Math.abs(((d + 45) % 90) - 45) < 2.5) continue;
    const t = (d * Math.PI) / 180;
    pad(Math.sin(t) * (R - 0.17), Math.cos(t) * (R - 0.17), 0.055, 0.22, -t + Math.PI / 2);
  }
  for (let t = 0; t < Math.PI * 2; t += 0.1 / (R - 0.4)) via(Math.sin(t) * (R - 0.4), Math.cos(t) * (R - 0.4), 0.018, 'rgb(0,0,70)');
  for (const r of [R - 0.52, R - 0.03]) silk(Array.from({ length: 361 }, (_, i) => [Math.sin((i * Math.PI) / 180) * r, Math.cos((i * Math.PI) / 180) * r] as P), 0.008, r > R - 0.3 ? 'rgb(0,0,150)' : 'rgb(0,0,90)');
  for (let d = 0; d < 360; d += 2) {
    const t = (d * Math.PI) / 180;
    const len = d % 30 === 0 ? 0.16 : d % 10 === 0 ? 0.1 : 0.05;
    silk(
      [
        [Math.sin(t) * (R - 0.52), Math.cos(t) * (R - 0.52)],
        [Math.sin(t) * (R - 0.52 - len), Math.cos(t) * (R - 0.52 - len)]
      ],
      d % 10 === 0 ? 0.012 : 0.007,
      d % 30 === 0 ? 'rgb(0,0,140)' : 'rgb(0,0,80)'
    );
    if (d % 30 === 0) words(String(d).padStart(3, '0'), Math.sin(t) * (R - 0.82), Math.cos(t) * (R - 0.82), 0.075, -t, 'rgb(0,0,110)');
  }

  // Its category's name along the rim, on the side its projects face.
  if (spec.label) arcWords(spec.label.replace('—', '·').toUpperCase(), spec.facing, R - 1.0, 0.13, 'rgb(0,0,200)');

  // Round the spine's hole: its connector ring, ninety-six short lines out from it, each to a via.
  if (!spec.cpu) {
    for (const r of [spec.hole + 0.06, spec.hole + 0.12]) {
      circle(base, 0, 0, r, SILK, 0.008);
      circle(data, 0, 0, r, D_SILK, 0.008);
      circle(glow, 0, 0, r, 'rgb(0,0,150)', 0.008);
    }
    for (let n = 0; n < 96; n++) {
      const t = (n / 96) * Math.PI * 2;
      const r0 = spec.hole + 0.16;
      const r1 = r0 + 0.12 + random() * 0.22;
      const pts: P[] = [
        [Math.sin(t) * r0, Math.cos(t) * r0],
        [Math.sin(t) * r1, Math.cos(t) * r1]
      ];
      trace(pts, 0.008, 'rgb(0,150,0)');
      via(pts[1]![0], pts[1]![1], 0.016, 'rgb(0,120,0)');
    }
  }

  // The CPU's fan-out: forty lines a side, each jogging out to a via.
  if (spec.cpu) {
    for (let side = 0; side < 4; side++) {
      const turn = (side * Math.PI) / 2;
      for (let i = 0; i < 40; i++) {
        const u = (-0.5 + (i + 0.5) / 40) * 2.0;
        const len = 0.12 + random() * 0.32;
        const jog = (random() < 0.5 ? -1 : 1) * random() * 0.14;
        const local: P[] = [
          [u, 1.12],
          [u, 1.12 + len * 0.5],
          [u + jog, 1.12 + len * 0.5 + Math.abs(jog)],
          [u + jog, 1.12 + len + Math.abs(jog)]
        ];
        const pts = local.map(([a, b]) => [a * Math.cos(turn) - b * Math.sin(turn), a * Math.sin(turn) + b * Math.cos(turn)] as P);
        trace(pts, 0.009, 'rgb(0,150,0)');
        const end = pts[pts.length - 1]!;
        via(end[0], end[1], 0.017, 'rgb(0,120,0)');
      }
    }
  }

  // The buses, lit red on the glow layer (the current runs along them), and their vias at the far end.
  for (const lines of buses) {
    for (const pts of lines) {
      trace(pts, 0.014, 'rgb(255,0,0)');
      const end = pts[pts.length - 1]!;
      via(end[0], end[1], 0.02, 'rgb(200,0,0)');
    }
  }

  // Length-matched serpentines in a few free places.
  for (let made = 0, tries = 0; made < 9 && tries < 600; tries++) {
    const r = 2.0 + random() * (R - 2.6);
    const t = random() * Math.PI * 2;
    const yaw = Math.floor(random() * 4) * (Math.PI / 4);
    const cx = Math.sin(t) * r;
    const cz = Math.cos(t) * r;
    if (!grid.fits(cx, cz, 0.42, 0.16, yaw, 0.02)) continue;
    grid.mark(cx, cz, 0.42, 0.16, yaw);
    made++;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let line = 0; line < 6; line++) {
      const lz = -0.13 + line * 0.052;
      const pts: P[] = [];
      for (let u = -0.4; u <= 0.4; u += 0.05) {
        const up = Math.round((u + 0.4) / 0.05) % 2 === 0 ? 0 : 0.022;
        for (const [lx, l2] of [
          [u, lz],
          [u, lz + up]
        ] as const) pts.push([cx + lx * c + l2 * s, cz - lx * s + l2 * c]);
      }
      trace(pts, 0.006, 'rgb(0,140,0)');
    }
  }

  // The parts' footprints: pads, print outlines and names, and short escapes from the chips' pins to vias.
  for (const p of parts) {
    const [hw, hd] = FOOT[p.kind];
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    const at = (lx: number, lz: number): P => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
    const outline = (w: number, d: number): void => silk([at(-w, -d), at(w, -d), at(w, d), at(-w, d), at(-w, -d)], 0.006);
    if (p.kind === 'r' || p.kind === 'c') {
      for (const side of [-1, 1]) pad(...at(side * hw * 0.62, 0), hw * 0.55, hd * 1.6, p.yaw);
      continue;
    }
    if (p.kind === 'soic' || p.kind === 'qfp') {
      const perSide = p.kind === 'soic' ? 4 : 8;
      const sides = p.kind === 'soic' ? [0, 2] : [0, 1, 2, 3];
      for (const side of sides) {
        for (let i = 0; i < perSide; i++) {
          const u = (-0.5 + (i + 0.5) / perSide) * (p.kind === 'soic' ? hw * 1.4 : hw * 1.5);
          const out = (p.kind === 'soic' ? hd : hw) * 0.92;
          const turn = (side * Math.PI) / 2;
          const lx = u * Math.cos(turn) - out * Math.sin(turn);
          const lz = u * Math.sin(turn) + out * Math.cos(turn);
          pad(...at(lx, lz), 0.018, 0.05, p.yaw - turn);
          if (random() < 0.55) {
            const far = out + 0.05 + random() * 0.09;
            const fx = u * Math.cos(turn) - far * Math.sin(turn);
            const fz = u * Math.sin(turn) + far * Math.cos(turn);
            trace([at(lx, lz), at(fx, fz)], 0.007, 'rgb(0,70,0)');
            via(...at(fx, fz), 0.014);
          }
        }
      }
      outline(hw * 0.8, hd * 0.8);
      words(p.name, ...at(0, -hd - 0.06), 0.042, -p.yaw);
      continue;
    }
    if (p.kind === 'dimm') {
      outline(hw, hd);
      for (let i = 0; i < 40; i++) for (const row of [-1, 1]) pad(...at(-hw * 0.92 + (i * hw * 1.84) / 39, row * hd * 0.45), 0.012, 0.03, p.yaw);
      continue;
    }
    if (p.kind === 'bigcap') {
      circle(base, p.x, p.z, hw * 0.98, SILK, 0.008);
      circle(data, p.x, p.z, hw * 0.98, D_SILK, 0.008);
      words(p.name, ...at(0, -hd - 0.06), 0.05, -p.yaw);
      continue;
    }
    if (p.kind === 'bga' || p.kind === 'sink') {
      outline(hw * 1.02, hd * 1.02);
      silk([at(-hw * 1.02, -hd * 0.7), at(-hw * 0.7, -hd * 1.02)], 0.008);
      words(p.name, ...at(0, -hd - 0.08), 0.06, -p.yaw);
      continue;
    }
    if (p.kind === 'elec') {
      circle(base, p.x, p.z, hw * 0.98, SILK, 0.006);
      circle(data, p.x, p.z, hw * 0.98, D_SILK, 0.006);
      for (const side of [-1, 1]) pad(...at(side * hw * 0.55, 0), 0.06, 0.07, p.yaw);
      continue;
    }
    if (p.kind === 'choke') {
      outline(hw, hd);
      for (const side of [-1, 1]) pad(...at(side * hw * 0.62, 0), 0.07, hd * 1.4, p.yaw);
      continue;
    }
    if (p.kind === 'xtal') {
      outline(hw * 1.05, hd * 1.2);
      for (const side of [-1, 1]) pad(...at(side * hw * 0.6, 0), 0.06, 0.05, p.yaw);
      words(p.name, ...at(0, -hd - 0.05), 0.04, -p.yaw);
      continue;
    }
    if (p.kind === 'header') {
      outline(hw, hd);
      for (let i = 0; i < 8; i++) for (const row of [-1, 1]) disc(base, ...at(-hw + 0.03 + i * 0.054, row * 0.025), 0.016, PAD);
      words(p.name, ...at(0, -hd - 0.05), 0.045, -p.yaw);
    }
  }

  // Fine traces wandering through what is left, in straight and 45° runs, a via at each end; fewer on the lower tiers.
  const from = spec.cpu ? 1.4 : spec.hole + 0.3;
  const fine = Math.round((spec.cpu ? 700 : 650) * PLATE_LOOK.parts[tier]);
  for (let n = 0, tries = 0; n < fine && tries < 20000; tries++) {
    const r = from + Math.sqrt(random()) * (R - 0.75 - from);
    const t0 = random() * Math.PI * 2;
    let x = Math.sin(t0) * r;
    let z = Math.cos(t0) * r;
    if (!grid.fits(x, z, 0.02, 0.02, 0, 0.01)) continue;
    let dir = Math.floor(random() * 8);
    const pts: P[] = [[x, z]];
    const segments = 2 + Math.floor(random() * 6);
    for (let s = 0; s < segments; s++) {
      const len = 0.06 + random() * 0.3;
      const a = (dir * Math.PI) / 4;
      const nx = x + Math.cos(a) * len;
      const nz = z + Math.sin(a) * len;
      let clear = true;
      for (let u = 0.25; u <= 1; u += 0.25) if (!grid.fits(x + (nx - x) * u, z + (nz - z) * u, 0.012, 0.012, 0, 0.004)) clear = false;
      if (!clear) break;
      x = nx;
      z = nz;
      pts.push([x, z]);
      if (random() < 0.6) dir = (dir + (random() < 0.5 ? 1 : 7)) % 8;
    }
    if (pts.length < 2) continue;
    n++;
    const level = 60 + Math.floor(random() * 110);
    trace(pts, random() < 0.15 ? 0.012 : 0.007, `rgb(0,${level},0)`);
    for (const q of [pts[0]!, pts[pts.length - 1]!]) via(q[0], q[1], 0.014, `rgb(0,${Math.round(level * 0.8)},0)`);
    grid.markLine(pts, 0.025);
  }

  // Each project's socket: its pins, a print ring, and its number.
  spec.sockets.forEach(([x, z], i) => {
    for (let a = -5; a <= 5; a++) {
      for (let b = -5; b <= 5; b++) {
        if (Math.hypot(a, b) > 5.2) continue;
        disc(base, x + a * 0.105, z + b * 0.105, 0.02, PAD);
        disc(data, x + a * 0.105, z + b * 0.105, 0.02, D_PAD);
      }
    }
    for (const r of [0.98, 1.04]) {
      circle(base, x, z, r, SILK, r < 1 ? 0.01 : 0.005);
      circle(data, x, z, r, D_SILK, 0.01);
      circle(glow, x, z, r, 'rgb(0,0,110)', 0.01);
    }
    const t = Math.atan2(x, z);
    words(`P${String(spec.firstSocket + i).padStart(2, '0')}`, x - Math.sin(t) * 1.17, z - Math.cos(t) * 1.17, 0.07, -t, 'rgb(0,0,110)');
  });

  // The CPU's socket print, and the board's name below it.
  if (spec.cpu) {
    const h = 1.27;
    silk(
      [
        [-h, -h],
        [h, -h],
        [h, h],
        [-h, h],
        [-h, -h]
      ],
      0.012,
      'rgb(0,0,110)'
    );
    silk(
      [
        [-h, h - 0.18],
        [-h + 0.18, h]
      ],
      0.012
    );
    words('BOB', 0, 1.38, 0.09, 0, 'rgb(0,0,120)', 0.5);
  }

  return { glow: texture(glowC), base: texture(baseC, true), data: texture(dataC) };
}

// ---------------------------------------------------------------- the parts in 3D

function partMaterials(canvas: Canvas) {
  const epoxy = new THREE.MeshStandardMaterial({ color: 0x0b0910, roughness: 0.5, metalness: 0.15 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x2c2228, roughness: 0.62, metalness: 0.05 });
  const tin = new THREE.MeshStandardMaterial({ color: 0xa8a3b6, roughness: 0.32, metalness: 1 });
  const lead = new THREE.MeshStandardMaterial({ color: 0xd2a54c, roughness: 0.3, metalness: 1 });
  const choke = new THREE.MeshStandardMaterial({ color: 0x1b1922, roughness: 0.7, metalness: 0.2 });
  const sleeveC = canvas();
  const sleeveG = context(sleeveC, 256, 64);
  sleeveG.fillStyle = '#211236';
  sleeveG.fillRect(0, 0, 256, 64);
  sleeveG.fillStyle = '#5a4a7a';
  sleeveG.fillRect(0, 0, 40, 64);
  const sleeve = new THREE.MeshStandardMaterial({ map: texture(sleeveC, true), roughness: 0.38, metalness: 0.25 });
  const topC = canvas();
  const topG = context(topC, 128);
  topG.fillStyle = '#8f8a9c';
  topG.fillRect(0, 0, 128, 128);
  topG.strokeStyle = '#4b4756';
  topG.lineWidth = 5;
  topG.beginPath();
  topG.moveTo(64, 14);
  topG.lineTo(64, 114);
  topG.moveTo(64, 64);
  topG.lineTo(20, 30);
  topG.moveTo(64, 64);
  topG.lineTo(108, 30);
  topG.stroke();
  const capTop = new THREE.MeshStandardMaterial({ map: texture(topC, true), roughness: 0.3, metalness: 1 });
  const markC = canvas();
  const markG = context(markC, 256);
  markG.fillStyle = '#0d0b12';
  markG.fillRect(0, 0, 256, 256);
  markG.fillStyle = '#2c2838';
  markG.font = `500 26px ${FONT}`;
  markG.textAlign = 'center';
  markG.fillText('BC7G10', 128, 120);
  markG.fillText('2614 A', 128, 156);
  markG.beginPath();
  markG.arc(36, 36, 10, 0, Math.PI * 2);
  markG.fill();
  const bgaTop = new THREE.MeshStandardMaterial({ map: texture(markC, true), roughness: 0.45, metalness: 0.15 });
  const sink = new THREE.MeshStandardMaterial({ color: 0x2c2934, roughness: 0.34, metalness: 0.9 });
  const module = new THREE.MeshStandardMaterial({ color: 0x1a1426, roughness: 0.45, metalness: 0.3 });
  return { epoxy, ceramic, tin, lead, choke, sleeve, capTop, bgaTop, sink, module };
}

/** One instanced mesh of `geometry` for every placement in `at` (each a position and a yaw). */
function instanced(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], at: [THREE.Vector3, number][]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, at.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  at.forEach(([p, yaw], i) => mesh.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(up, yaw), one)));
  mesh.count = at.length;
  return mesh;
}

function buildParts(parts: PlatePart[], mats: ReturnType<typeof partMaterials>): THREE.Group {
  const group = new THREE.Group();
  group.name = 'plate:parts';
  const lists: Record<string, [THREE.Vector3, number][]> = {};
  const put = (name: string, p: PlatePart, lx: number, y: number, lz: number, yaw = 0): void => {
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    (lists[name] ??= []).push([new THREE.Vector3(p.x + lx * c + lz * s, y, p.z - lx * s + lz * c), p.yaw + yaw]);
  };
  for (const p of parts) {
    const [hw, hd] = FOOT[p.kind];
    switch (p.kind) {
      case 'r':
      case 'c': {
        const h = p.kind === 'r' ? 0.022 : 0.04;
        put(p.kind === 'r' ? 'rBody' : 'cBody', p, 0, h / 2, 0);
        for (const side of [-1, 1]) put(p.kind === 'r' ? 'rEnd' : 'cEnd', p, side * hw * 0.62, h / 2, 0);
        break;
      }
      case 'soic':
        put('soic', p, 0, 0.03, 0);
        for (const side of [-1, 1]) for (let i = 0; i < 4; i++) put('soicLead', p, (-0.5 + (i + 0.5) / 4) * hw * 1.4, 0.012, side * hd * 0.84);
        break;
      case 'qfp':
        put('qfp', p, 0, 0.026, 0);
        for (let side = 0; side < 4; side++) {
          const turn = (side * Math.PI) / 2;
          for (let i = 0; i < 8; i++) {
            const u = (-0.5 + (i + 0.5) / 8) * hw * 1.5;
            const out = hw * 0.86;
            put('qfpLead', p, u * Math.cos(turn) - out * Math.sin(turn), 0.01, u * Math.sin(turn) + out * Math.cos(turn), turn);
          }
        }
        break;
      case 'bga':
        put('bga', p, 0, 0.035, 0);
        break;
      case 'sink':
        put('bga', p, 0, 0.035, 0);
        put('sinkBase', p, 0, 0.085, 0);
        for (let f = 0; f < 11; f++) put('fin', p, 0, 0.23, -0.25 + f * 0.05);
        break;
      case 'bigcap':
        put('bigcap', p, 0, 0.21, 0, Math.PI * 0.8);
        break;
      case 'dimm':
        put('slot', p, 0, 0.045, 0);
        put('module', p, 0, 0.26, 0);
        for (let i = 0; i < 8; i++) for (const side of [-1, 1]) put('dimmChip', p, -0.53 + i * 0.152, 0.27, side * 0.02);
        break;
      case 'elec':
        put('elec', p, 0, 0.14, 0, Math.PI * 0.8);
        break;
      case 'choke':
        put('choke', p, 0, 0.085, 0);
        put('chokeTop', p, 0, 0.172, 0);
        break;
      case 'xtal':
        put('xtal', p, 0, 0.04, 0);
        break;
      case 'header':
        put('header', p, 0, 0.03, 0);
        for (let i = 0; i < 8; i++) for (const row of [-1, 1]) put('pin', p, -hw + 0.03 + i * 0.054, 0.07, row * 0.025);
    }
  }
  const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);
  const shapes: Record<string, () => [THREE.BufferGeometry, THREE.Material | THREE.Material[]]> = {
    rBody: () => [box(0.058, 0.022, 0.032), mats.epoxy],
    rEnd: () => [box(0.014, 0.024, 0.034), mats.tin],
    cBody: () => [box(0.075, 0.04, 0.05), mats.ceramic],
    cEnd: () => [box(0.016, 0.042, 0.052), mats.tin],
    soic: () => [box(0.2, 0.05, 0.15), mats.epoxy],
    soicLead: () => [box(0.014, 0.014, 0.05), mats.lead],
    qfp: () => [box(0.3, 0.045, 0.3), mats.epoxy],
    qfpLead: () => [box(0.011, 0.01, 0.05), mats.lead],
    bga: () => [box(0.5, 0.06, 0.5), [mats.epoxy, mats.epoxy, mats.bgaTop, mats.epoxy, mats.epoxy, mats.epoxy]],
    elec: () => [new THREE.CylinderGeometry(0.095, 0.095, 0.28, 28), [mats.sleeve, mats.capTop, mats.sleeve]],
    choke: () => [box(0.24, 0.16, 0.24), mats.choke],
    chokeTop: () => [box(0.25, 0.012, 0.13), mats.tin],
    xtal: () => [new THREE.CapsuleGeometry(0.035, 0.12, 4, 12).rotateZ(Math.PI / 2), mats.tin],
    header: () => [box(0.44, 0.06, 0.11), mats.epoxy],
    pin: () => [box(0.014, 0.14, 0.014), mats.lead],
    sinkBase: () => [box(0.56, 0.04, 0.56), mats.sink],
    fin: () => [box(0.56, 0.26, 0.016), mats.sink],
    bigcap: () => [new THREE.CylinderGeometry(0.15, 0.15, 0.42, 32), [mats.sleeve, mats.capTop, mats.sleeve]],
    slot: () => [box(1.3, 0.09, 0.13), mats.epoxy],
    module: () => [box(1.22, 0.34, 0.026), mats.module],
    dimmChip: () => [box(0.12, 0.1, 0.012), mats.epoxy]
  };
  for (const [name, at] of Object.entries(lists)) {
    const [geometry, material] = shapes[name]!();
    const mesh = instanced(geometry, material, at);
    mesh.name = `plate:${name}`;
    group.add(mesh);
  }
  return group;
}

// ---------------------------------------------------------------- the board

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vXZ = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uPower;
  uniform float uLevel;
  uniform float uR;
  uniform vec3 uGold;
  uniform vec3 uViolet;
  varying vec2 vXZ;
  void main() {
    vec4 t = texture2D(uMap, vXZ / (2.0 * uR) + 0.5);
    float r = length(vXZ);
    // The power reaches out from the middle; its front a bright ring, gone once it has reached the rim.
    float reach = uPower * uR * 1.2;
    float on = 1.0 - smoothstep(reach - 0.6, reach, r);
    float dr = (r - reach) * 2.4;
    float front = exp(-dr * dr) * (1.0 - step(0.999, uPower));
    float pulse = pow(max(0.0, 0.5 + 0.5 * sin(r * 1.7 - uTime * 1.4)), 12.0);
    vec3 c = uGold * t.r * (0.32 + 1.6 * pulse)
           + mix(uViolet, uGold, 0.3) * t.g * 0.18
           + mix(uGold, uViolet, 0.35) * t.b * 0.3;
    c += uViolet * exp(-(uR - r) * 14.0) * 0.22;
    c = c * on + uGold * (t.r + t.g * 0.5 + t.b * 0.5) * front * 1.3;
    gl_FragColor = vec4(c * uLevel, 1.0);
  }
`;

/** The edge's layers, bottom to top: mask, copper and dark board, glass weave. */
function sideTextures(canvas: Canvas): { map: THREE.CanvasTexture; data: THREE.CanvasTexture } {
  const rows: [string, string, number][] = [
    ['#120b22', 'rgb(0,110,0)', 6],
    ['#b3893a', 'rgb(0,80,255)', 3],
    ['#17121c', 'rgb(0,200,0)', 22],
    ['#b3893a', 'rgb(0,80,255)', 3],
    ['#1d1724', 'rgb(0,210,0)', 56],
    ['#b3893a', 'rgb(0,80,255)', 3],
    ['#17121c', 'rgb(0,200,0)', 22],
    ['#b3893a', 'rgb(0,80,255)', 3],
    ['#1d1724', 'rgb(0,210,0)', 56],
    ['#b3893a', 'rgb(0,80,255)', 3],
    ['#17121c', 'rgb(0,200,0)', 22],
    ['#b3893a', 'rgb(0,80,255)', 3],
    ['#120b22', 'rgb(0,110,0)', 6]
  ];
  const total = rows.reduce((s, r) => s + r[2], 0);
  const mapC = canvas();
  const dataC = canvas();
  const mapG = context(mapC, 4, total);
  const dataG = context(dataC, 4, total);
  let y = 0;
  for (const [colour, d, h] of rows) {
    mapG.fillStyle = colour;
    mapG.fillRect(0, y, 4, h);
    dataG.fillStyle = d;
    dataG.fillRect(0, y, 4, h);
    y += h;
  }
  return { map: texture(mapC, true), data: texture(dataC) };
}

export interface PlateModel {
  group: THREE.Group;
  /** `power` 0..1 the light reaching out from the middle, `level` the whole board's (dim while a project is open). */
  set(clock: number, power: number, level: number): void;
  /** Turns what its metal and gloss reflect with the camera's azimuth, so the board looks the same from every side. */
  turn(azimuth: number): void;
  dispose(): void;
}

/** The board of `spec` at this tier, its metal and gloss reflecting `room` (none: unlit by a room). */
export function buildPlate(spec: PlateSpec, tier: QualityTier, room: THREE.Texture | null, canvas: Canvas = () => document.createElement('canvas')): PlateModel {
  const R = spec.radius;
  const { parts, buses, grid } = layOut(spec, tier);
  const maps = drawBoard(spec, tier, parts, buses, grid, canvas);
  const group = new THREE.Group();
  group.name = 'plate';

  // The top: a glossy dark mask over raised copper, its pads bare gold.
  const flatDisc = (segments: number): THREE.BufferGeometry => (spec.hole > 0 ? new THREE.RingGeometry(spec.hole, R, segments, 2) : new THREE.CircleGeometry(R, segments)).rotateX(-Math.PI / 2);
  const topDisc = flatDisc(256);
  const pos = topDisc.getAttribute('position');
  const uv = topDisc.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getZ(i) / (2 * R) + 0.5);
  const plate = new THREE.MeshPhysicalMaterial({
    map: maps.base,
    bumpMap: maps.data,
    bumpScale: 2.2,
    roughnessMap: maps.data,
    metalnessMap: maps.data,
    roughness: 1,
    metalness: 1,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3
  });
  const top = new THREE.Mesh(topDisc, plate);
  top.name = 'plate:top';

  // The light on it.
  const glowMaterial = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms: {
      uMap: { value: maps.glow },
      uTime: { value: 0 },
      uPower: { value: 0 },
      uLevel: { value: 1 },
      uR: { value: R },
      uGold: { value: GOLD.clone() },
      uViolet: { value: HAZE.clone() }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const light = new THREE.Mesh(topDisc.clone(), glowMaterial);
  light.name = 'plate:light';
  light.position.y = 0.002;
  light.renderOrder = 2;

  // The edge, the spine's hole's wall, and the underside.
  const side = sideTextures(canvas);
  const edgeMaterial = new THREE.MeshStandardMaterial({ map: side.map, roughnessMap: side.data, metalnessMap: side.data, roughness: 1, metalness: 1 });
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, THICK, 256, 1, true).translate(0, -THICK / 2, 0), edgeMaterial);
  edge.name = 'plate:edge';
  const dimming: THREE.MeshStandardMaterial[] = [plate, edgeMaterial];
  if (spec.hole > 0) {
    const wallMaterial = edgeMaterial.clone();
    wallMaterial.side = THREE.BackSide;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(spec.hole, spec.hole, THICK, 96, 1, true).translate(0, -THICK / 2, 0), wallMaterial);
    wall.name = 'plate:wall';
    edge.add(wall);
    dimming.push(wallMaterial);
  }
  const bottom = new THREE.Mesh(flatDisc(128).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: 0x07050c, roughness: 0.8 }));
  bottom.name = 'plate:bottom';
  bottom.position.y = -THICK;
  const underMaterial = new THREE.MeshBasicMaterial({ color: HAZE.clone().multiplyScalar(0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const under = new THREE.Mesh(new THREE.RingGeometry(R - 0.04, R + 0.01, 256).rotateX(-Math.PI / 2), underMaterial);
  under.name = 'plate:under';
  under.position.y = -THICK - 0.3;
  under.renderOrder = 2;

  const mats = partMaterials(canvas);
  const partsGroup = buildParts(parts, mats);
  group.add(top, light, edge, bottom, under, partsGroup);

  // What dims with the board, and what reflects the room: every lit material on it, by its light and its colour.
  const dimmed = [...dimming, ...Object.values(mats)].map((m) => {
    m.envMap = room;
    return { m, colour: m.color.clone(), reflects: m === plate ? 0.2 : 0.3 };
  });
  const u = glowMaterial.uniforms;
  return {
    group,
    set(clock, power, level) {
      u.uTime!.value = clock;
      u.uPower!.value = power;
      u.uLevel!.value = level;
      underMaterial.opacity = power * level;
      const lit = 0.06 + 0.94 * level;
      for (const { m, colour, reflects } of dimmed) {
        m.color.copy(colour).multiplyScalar(lit);
        m.envMapIntensity = reflects * lit;
      }
    },
    turn(azimuth) {
      for (const { m } of dimmed) m.envMapRotation.y = azimuth;
    },
    dispose() {
      const textures = new Set<THREE.Texture>();
      const materials = new Set<THREE.Material>();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.geometry) return;
        mesh.geometry.dispose();
        for (const m of ([] as THREE.Material[]).concat(mesh.material)) materials.add(m);
      });
      for (const m of materials) {
        for (const [key, value] of Object.entries(m)) if (key !== 'envMap' && (value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
        const uniforms = (m as THREE.ShaderMaterial).uniforms;
        if (uniforms) for (const v of Object.values(uniforms)) if ((v.value as THREE.Texture)?.isTexture) textures.add(v.value as THREE.Texture);
        m.dispose();
      }
      for (const t of textures) t.dispose();
    }
  };
}
