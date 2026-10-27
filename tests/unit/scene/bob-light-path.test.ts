import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot } from '../../../src/engine/bob/shots';
import { makePath, pathFor, wakeSweep } from '../../../src/scene/bob/lightPath';
import { trailAt } from '../../../src/scene/bob/lightDive';
import { arrivalStop, buildChapters, HAND_F, HOME_CHAPTERS, pathStart, sheetStart, type Chapters } from '../../../src/state/chapters';

type Vec3 = readonly [number, number, number];
const HERE = fileURLToPath(new URL('.', import.meta.url));
/**
 * The light path mock-up Bob approved (2026-10-27), dumped by its own path.ts before the site changed
 * (.superpowers/light-path-mockup/dump-fixtures.ts). Since the 3D world (spec 2026-10-27-bob-nebula-space-design.md,
 * revision 2: no circling, no inside on the scroll) only its beads' places and its look back's camera still hold.
 */
const load = (name: string) => JSON.parse(readFileSync(join(HERE, '../../fixtures/light-path', `${name}.json`), 'utf8'));

/** Every number in `actual` within `tol` (relative past 1) of the one in `expected`, at the same place in the same shape. */
function expectNear(actual: unknown, expected: unknown, where: string, tol = 1e-9): void {
  if (typeof expected === 'number') {
    expect(typeof actual, where).toBe('number');
    expect(Math.abs((actual as number) - expected), `${where}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(expected)));
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), where).toBe(true);
    expect((actual as unknown[]).length, where).toBe(expected.length);
    expected.forEach((e, k) => expectNear((actual as unknown[])[k], e, `${where}[${k}]`, tol));
  } else if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', where).toBe(true);
    expect(Object.keys(actual as object).sort(), where).toEqual(Object.keys(expected).sort());
    for (const [k, e] of Object.entries(expected)) expectNear((actual as Record<string, unknown>)[k], e, `${where}.${k}`, tol);
  } else {
    expect(actual, where).toEqual(expected);
  }
}

/** Where `p` falls through `shot` on a screen of this aspect, NDC (and z < 1 in front of the camera). */
function project(p: Vec3, shot: CameraShot, aspect: number): { x: number; y: number; z: number } {
  const camera = new PerspectiveCamera(50, aspect, 0.05, 400);
  applyCameraShot(camera, shot, aspect);
  const v = new Vector3(p[0], p[1], p[2]).project(camera);
  return { x: v.x, y: v.y, z: v.z };
}

/** The light's angle round bead i in its orbit's plane (0 on its right, pi/2 toward the camera). */
function angleRound(path: ReturnType<typeof makePath>, i: number, p: Vec3): number {
  const c = path.centres[i]!;
  const u = path.orbitAt(i, 0).map((v, k) => (v - c[k]!) / 1.5);
  const w = path.orbitAt(i, Math.PI / 2).map((v, k) => (v - c[k]!) / 1.5);
  const d = p.map((v, k) => v - c[k]!);
  return Math.atan2(d[0]! * w[0]! + d[1]! * w[1]! + d[2]! * w[2]!, d[0]! * u[0]! + d[1]! * u[1]! + d[2]! * u[2]!);
}

/** The frames of bead i's travel and arrival, every 0.005 of the place. */
function framesTo(path: ReturnType<typeof makePath>, i: number) {
  const out: { q: number; f: ReturnType<ReturnType<typeof makePath>['frameAt']> }[] = [];
  for (let q = 0; q < 40; q += 0.005) {
    const f = path.frameAt(q);
    if (f.part === 'look' || f.part === 'sheet') break;
    if (f.index === i) out.push({ q, f });
  }
  return out;
}

const chaptersOf = (n: number): Chapters => buildChapters({ path: Array.from({ length: n }, (_, k) => `c${k}`) });
const ASPECTS = [1440 / 900, 390 / 844];

describe("the light's path: straight to rest beside each bead, no circling (the 3D world)", () => {
  for (const size of ['desk', 'phone'] as const) {
    const fx = load(`path-${size}`);
    const path = makePath(fx.aspect);
    it(`keeps the ${size} beads' places and the look back's camera as approved`, () => {
      expectNear(path.centres, fx.centres, 'centres');
      expectNear({ position: path.lookShot.position, target: path.lookShot.target, fov: path.lookShot.fov }, fx.lookShot, 'lookShot');
    });
  }

  it('lays each project out as a travel and an arrival, and nothing else on the way', () => {
    const path = makePath(1.6);
    const parts = new Set<string>();
    for (let q = 0; q < 12; q += 0.01) parts.add(path.frameAt(q).part);
    expect([...parts]).toEqual(['travel', 'arrive', 'look', 'sheet']);
  });

  it('flies the light to rest beside each bead, never round it nor through it', () => {
    for (const aspect of ASPECTS) {
      const path = makePath(aspect);
      for (let i = 0; i < path.count; i++) {
        const c = path.centres[i]!;
        const w = path.orbitAt(i, Math.PI / 2).map((v, k) => (v - c[k]!) / 1.5);
        for (const { f } of framesTo(path, i)) {
          const d = f.light.position.map((v, k) => v - c[k]!);
          const where = `bead ${i} at ${aspect.toFixed(2)}, ${f.part} t ${f.t.toFixed(2)}`;
          // Never inside the bead, nor grazing it.
          expect(Math.hypot(...d), where).toBeGreaterThan(1.1);
          // Behind the bead's middle only well above it: it never goes round the back at the bead's height.
          const behind = d[0]! * w[0]! + d[1]! * w[1]! + d[2]! * w[2]! < -0.2;
          if (behind && Math.hypot(...d) < 4.5) expect(d[1]!, where).toBeGreaterThan(1.15);
        }
        // Its angle round the bead once near it settles at the rest, on the bead's front right.
        expect(angleRound(path, i, path.restAt(i))).toBeCloseTo(0.12 * Math.PI, 9);
        const end = path.frameAt(arrivalStop(HOME_CHAPTERS, HOME_CHAPTERS.units.filter((u) => u.id === 'ARRIVE')[i]!.category!) - pathStart(HOME_CHAPTERS));
        expect(end.part, `bead ${i}'s stop`).toBe('arrive');
        expectNear(end.light.position, path.restAt(i), `bead ${i} rest`, 1e-6);
      }
    }
  });

  it('rests the light there through the arrival', () => {
    const path = makePath(1.6);
    for (let i = 0; i < path.count; i++) {
      for (const { f } of framesTo(path, i).filter(({ f }) => f.part === 'arrive' && f.t >= 0.5)) expectNear(f.light.position, path.restAt(i), `bead ${i} t ${f.t.toFixed(2)}`, 1e-9);
    }
  });

  it('frames the whole bead at each arrival, with space round it, three projects and five', () => {
    for (const n of [3, 5]) {
      const c = chaptersOf(n);
      for (const aspect of ASPECTS) {
        const path = makePath(aspect, c);
        for (let i = 0; i < n; i++) {
          const f = path.frameAt(arrivalStop(c, `c${i}`) - pathStart(c));
          const centre = path.centres[i]!;
          const top = project([centre[0], centre[1] + 0.95, centre[2]], f.shot, aspect);
          const bottom = project([centre[0], centre[1] - 0.95, centre[2]], f.shot, aspect);
          const middle = project(centre, f.shot, aspect);
          const where = `${n} bead ${i} at ${aspect.toFixed(2)}`;
          expect((top.y - bottom.y) / 2, where).toBeLessThanOrEqual(0.42);
          for (const v of [top, bottom]) expect(Math.abs(v.y), where).toBeLessThanOrEqual(0.84);
          expect(Math.abs(middle.x), where).toBeLessThanOrEqual(0.84);
        }
      }
    }
  });

  it('wakes the veins as the light comes to rest', () => {
    const path = makePath(1.6);
    for (let i = 0; i < path.count; i++) {
      const frames = framesTo(path, i);
      for (const { f } of frames.filter(({ f }) => f.part === 'travel')) expect(f.beads[i]!.wake.kind, `bead ${i} on its travel`).toBe('none');
      const mid = frames.find(({ f }) => f.part === 'arrive' && f.t >= 0.5)!.f.beads[i]!.wake;
      expect(mid.kind).toBe('orbit');
      if (mid.kind === 'orbit') expect(Math.abs(mid.now - mid.from)).toBeGreaterThan(0.5);
      expect(frames.at(-1)!.f.beads[i]!.wake.kind).toBe('full');
    }
  });

  it("shows the label from the arrival's 0.3 on, whole by its stop, and never on a travel", () => {
    const path = makePath(1.6);
    const frames = framesTo(path, 1);
    for (const { f } of frames.filter(({ f }) => f.part === 'travel')) expect(f.label?.index === 1 && f.label.opacity > 0).toBe(false);
    const at = (t: number) => frames.find(({ f }) => f.part === 'arrive' && f.t >= t)!.f.label;
    expect(at(0.2)?.opacity ?? 0).toBe(0);
    expect(at(0.45)?.opacity ?? 0).toBeGreaterThan(0);
    expect(at(0.65)?.opacity).toBe(1);
  });

  it('never shows the touch points on the scroll: they are the inside\'s', () => {
    const path = makePath(1.6);
    for (let q = 0; q < 12; q += 0.01) expect(path.frameAt(q).points, `q ${q.toFixed(2)}`).toBeNull();
  });

  it("shows the skip button from the first arrival through the look back's own stop", () => {
    const path = makePath(1.6);
    const first = HOME_CHAPTERS.units.find((u) => u.id === 'ARRIVE')!.start - pathStart(HOME_CHAPTERS);
    const stop = sheetStart(HOME_CHAPTERS) - pathStart(HOME_CHAPTERS);
    expect(path.frameAt(first - 0.01).skip).toBe(false);
    expect(path.frameAt(first + 0.01).skip).toBe(true);
    expect(path.frameAt(stop).skip).toBe(true);
    expect(path.frameAt(stop + 0.05).skip).toBe(false);
  });

  it('sweeps the wake the way the light goes round, in the view', () => {
    const round = (a: number) => [Math.cos(a), Math.sin(a)] as const;
    const half = wakeSweep(round, [0, 0], 0, Math.PI);
    expect(half.start).toBeCloseTo(0, 9);
    expect(half.span).toBeCloseTo(Math.PI, 9);
    expect(half.dir).toBe(1);
    const back = wakeSweep((a) => round(-a), [0, 0], 0, 2.5 * Math.PI);
    expect(back.span).toBeCloseTo(2.5 * Math.PI, 9);
    expect(back.dir).toBe(-1);
  });

  it('a new aspect keeps the part, the bead and t', () => {
    for (const q of [0.4, 2.0, 5.1, 9.9, 13.0]) {
      const a = makePath(1440 / 900).frameAt(q);
      const b = makePath(900 / 1440).frameAt(q);
      expect([b.part, b.index, b.t, b.beads.map((x) => x.visible)]).toEqual([a.part, a.index, a.t, a.beads.map((x) => x.visible)]);
    }
  });

  it('the look back frames every bead, with four and five projects', () => {
    for (const n of [4, 5]) {
      for (const aspect of [1440 / 900, 390 / 844]) {
        const path = makePath(aspect, buildChapters({ path: Array.from({ length: n }, (_, k) => `c${k}`) }));
        expect(path.count).toBe(n);
        for (const c of path.centres) {
          const v = project(c, path.lookShot, aspect);
          expect(Math.abs(v.x), `${n} at ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.85);
          expect(Math.abs(v.y), `${n} at ${aspect.toFixed(2)}`).toBeLessThanOrEqual(0.85);
          expect(v.z).toBeLessThan(1);
        }
      }
    }
  });

  it('runs by the scroll alone: the same place is the same frame', () => {
    expect(makePath(1.6).frameAt(3.3)).toEqual(makePath(1.6).frameAt(3.3));
    expect(pathFor(1.6)).toBe(pathFor(1.6));
  });

  it('imports neither three nor React: a pure module, as the journey is', () => {
    const source = readFileSync(join(HERE, '../../../src/scene/bob/lightPath.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"](?:three|react|@react-three\/[\w-]+)['"]/);
  });
});

describe("the light's trail across the hand-over", () => {
  it("starts the path's trail as the fall's own last one, so nothing jumps at the hand-over", () => {
    for (const aspect of [1440 / 900, 390 / 844]) {
      const fall = trailAt(HAND_F, aspect);
      const path = makePath(aspect).frameAt(0).light.trail;
      expectNear(path.map((t) => t.point), fall.map((t) => t.point), `trail at ${aspect.toFixed(2)}`, 1e-12); // -0 and 0 alike
      expect(path[0]!.u).toBe(0);
      expect(path.at(-1)!.u).toBe(1);
    }
  });

  it("lets the path's own places push the fall's out as the light leads on, as long as the fall's own tail", () => {
    const path = makePath(1440 / 900);
    const length = (q: number) => {
      const t = path.frameAt(q).light.trail;
      return t.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.point[0] - t[k]!.point[0], p.point[1] - t[k]!.point[1], p.point[2] - t[k]!.point[2]), 0);
    };
    // The fall's tail at the hand-over (Bob, 2026-10-27: bigger and longer, about 1.6 m), and the path's no longer.
    const hand = trailAt(HAND_F, 1440 / 900);
    const fallLength = hand.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.point[0] - hand[k]!.point[0], p.point[1] - hand[k]!.point[1], p.point[2] - hand[k]!.point[2]), 0);
    expect(fallLength).toBeGreaterThan(1.4);
    for (const q of [0.6, 3, 9]) expect(length(q), `at ${q}`).toBeLessThan(fallLength + 0.25);
    // Well past the hand-over the trail is the path's alone: every point on its way, none of the fall's.
    const late = path.frameAt(0.6).light.trail.map((t) => t.point);
    const fall = trailAt(HAND_F, 1440 / 900).slice(1).map((t) => t.point);
    expect(late.some((p) => fall.some((f) => f[0] === p[0] && f[1] === p[1] && f[2] === p[2]))).toBe(false);
  });
});
