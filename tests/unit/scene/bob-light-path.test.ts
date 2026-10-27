import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot } from '../../../src/engine/bob/shots';
import { makePath, pathFor, wakeSweep } from '../../../src/scene/bob/lightPath';
import { trailAt } from '../../../src/scene/bob/lightDive';
import { buildChapters, HAND_F } from '../../../src/state/chapters';

type Vec3 = readonly [number, number, number];
const HERE = fileURLToPath(new URL('.', import.meta.url));
/**
 * The light path mock-up Bob approved (2026-10-27), dumped by its own path.ts before the site changed
 * (.superpowers/light-path-mockup/dump-fixtures.ts): `at(p, 0)` every 0.05 of its place from the hand-over, p 0.45, to
 * its end, 15.55, at 1440×900 and 390×844. Its place less its fall is the site's `q`, the place past the path's start.
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

describe("the light's path, ported from the approved mock-up", () => {
  for (const size of ['desk', 'phone'] as const) {
    const fx = load(`path-${size}`);
    const path = makePath(fx.aspect);

    it(`matches the mock-up's ${size} path at every sample`, () => {
      expectNear(path.centres, fx.centres, 'centres');
      for (const s of fx.samples) {
        const where = `${size} q ${s.q.toFixed(2)}`;
        const black = s.part === 'black';
        const part = black ? 'sheet' : s.part;
        // A sample on a boundary between two parts (its place a float sum, as the chapters' starts are) is read from the
        // fixture's side of it: the two sides are the same picture there.
        const f = [s.q, s.q + 1e-12, s.q - 1e-12].map((q) => path.frameAt(q)).find((g) => g.part === part && g.index === s.index) ?? path.frameAt(s.q);
        expect([f.part, f.index], where).toEqual([part, s.index]);
        // Over the sheet the site's t is the sheet's share; the mock-up's black was its first 0.55 alone.
        expectNear(f.t, black ? s.t * 0.55 : s.t, `${where} t`);
        expectNear({ position: f.shot.position, target: f.shot.target, fov: f.shot.fov }, s.shot, `${where} shot`);
        expectNear(f.light.position, s.light, `${where} light`);
        expectNear(f.light.glow, s.glow, `${where} glow`);
        expectNear(f.light.trailLevel, s.trailLevel, `${where} trailLevel`);
        // The second deliberate change: under the sheet the beads hold the look back's end, all at 0.9, where the mock-up's
        // brightening began again with the black and dimmed the first ones to 0.32 at the look back's own stop.
        expectNear(f.beads, black ? s.beads.map((b: object) => ({ ...b, lit: 0.9 })) : s.beads, `${where} beads`);
        expectNear(f.label, s.label && { index: s.label.i, opacity: s.label.opacity }, `${where} label`);
        expectNear(f.points, s.points && { index: s.points.i, opacity: s.points.opacity }, `${where} points`);
        // The one deliberate change: the skip button shows at the look back's own stop, which the mock-up's half-open test hid.
        // The sample there is a float sum a hair off the stop: the stop itself is read from the look's side.
        if (black && s.t === 0) expect(path.frameAt(s.q - 1e-12).skip, `${where} skip`).toBe(true);
        else expect(f.skip, `${where} skip`).toBe(s.skip);
        expectNear([f.way, f.black, f.fog.near, f.fog.far], [s.way, s.black, s.fog.near, s.fog.far], `${where} way, black, fog`);
        expect(f.sky, `${where} sky`).toBe(s.sky);
        expectNear(
          [f.void.bandY, f.void.bandSigma, f.void.band, f.void.bandDistance, f.void.dust, f.void.stream],
          [s.band.y, s.band.sigma, s.band.strength, s.band.distance, s.dust, s.stream],
          `${where} void`
        );
        expect(f.void.ringMist, where).toBe(0);
        expect(f.fact, where).toBeNull();
      }
    });

    it(`draws the ${size} look back's whole way and stands its camera as the mock-up does`, () => {
      expectNear(path.wayPoints, fx.wayPoints, 'wayPoints');
      expectNear({ position: path.lookShot.position, target: path.lookShot.target, fov: path.lookShot.fov }, fx.lookShot, 'lookShot');
    });
  }

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

  it("lets the path's own places push the fall's out as the light leads on, to about a metre", () => {
    const path = makePath(1440 / 900);
    const length = (q: number) => {
      const t = path.frameAt(q).light.trail;
      return t.slice(1).reduce((sum, p, k) => sum + Math.hypot(p.point[0] - t[k]!.point[0], p.point[1] - t[k]!.point[1], p.point[2] - t[k]!.point[2]), 0);
    };
    for (const q of [0.6, 3, 9]) expect(length(q), `at ${q}`).toBeLessThan(1.25);
    // Well past the hand-over the trail is the path's alone: every point on its way, none of the fall's.
    const late = path.frameAt(0.6).light.trail.map((t) => t.point);
    const fall = trailAt(HAND_F, 1440 / 900).slice(1).map((t) => t.point);
    expect(late.some((p) => fall.some((f) => f[0] === p[0] && f[1] === p[1] && f[2] === p[2]))).toBe(false);
  });
});
