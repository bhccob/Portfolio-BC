import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { applyCameraShot, type CameraShot, topShotFor } from '../../../src/engine/bob/shots';
import {
  BEADS_IN,
  F,
  factAt,
  lightAt,
  ORBIT_RATE,
  RING,
  RING_TURN0,
  ringBeads,
  ringNeedle,
  ringShot,
  sizeFor,
  voidAt,
  wayNeedle,
  wayShot,
} from '../../../src/scene/bob/lightDive';

type Vec3 = readonly [number, number, number];
const HERE = fileURLToPath(new URL('.', import.meta.url));
const load = (name: string) => JSON.parse(readFileSync(join(HERE, '../../fixtures/light-dive', `${name}.json`), 'utf8'));
/** The previs's two frame sizes (tools/blender/light_dive.py SIZES). */
const FRAME = { desk: [1440, 900], phone: [585, 1266] } as const;

/** Where `p` falls on a frame of this aspect through `shot`: x, y from the top left in shares of the width and height. */
function project(p: Vec3, shot: CameraShot, aspect: number): { x: number; y: number } {
  const camera = new PerspectiveCamera();
  applyCameraShot(camera, shot, aspect);
  const v = new Vector3(p[0], p[1], p[2]).project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

/** The distance in pixels between two frame points (shares) on a frame of w by h. */
const px = (a: { x: number; y: number }, b: readonly number[] | { x: number; y: number }, w: number, h: number): number => {
  const [bx, by] = Array.isArray(b) ? b : [(b as { x: number }).x, (b as { y: number }).y];
  return Math.hypot((a.x - bx) * w, (a.y - by) * h);
};

/** The camera's azimuth round the ring's axis, degrees, from the camera's horizontal place. */
const azimuthOf = (shot: CameraShot): number =>
  (Math.atan2(-(shot.position[0] - RING.centre[0]), shot.position[2] - RING.centre[2]) * 180) / Math.PI;

describe('the light dive, ported from the previs (tools/blender/light_dive.py, 473dead)', () => {
  it.each(['desk', 'phone'] as const)('puts the light where the previs drew it on every way frame (%s)', (size) => {
    const [w, h] = FRAME[size];
    const a = w / h;
    let worst = { f: 0, d: 0 };
    for (const e of load(`way-${size}`) as { f: number; light: { x: number; y: number } }[]) {
      if (e.f >= F.END) continue; // the light has become the needle
      const d = px(project(lightAt(e.f, a).position, wayShot(e.f, a), a), e.light, w, h);
      if (d > worst.d) worst = { f: e.f, d };
    }
    expect(worst.d, `the worst at frame ${worst.f}`).toBeLessThan(1);
  });

  it.each(['desk', 'phone'] as const)('puts the beads and the needle where the previs drew them round the ring (%s)', (size) => {
    const [w, h] = FRAME[size];
    const a = w / h;
    for (const e of load(`ring-${size}`) as { angle: number; proj: { beads: number[][]; needle: { front: number[]; back: number[] } } }[]) {
      const shot = ringShot(e.angle, a);
      ringBeads(e.angle, a).forEach((b, i) => expect(px(project(b.position, shot, a), e.proj.beads[i]!, w, h), `bead ${i} at ${e.angle}`).toBeLessThan(1));
      const n = ringNeedle(e.angle);
      const dir = new Vector3(...n.aim!).sub(new Vector3(...n.position)).normalize().multiplyScalar(1.15 * n.scale);
      const tip = new Vector3(...n.position).add(dir);
      expect(px(project([tip.x, tip.y, tip.z], shot, a), e.proj.needle.front, w, h), `the needle's front tip at ${e.angle}`).toBeLessThan(1.5);
    }
  });

  it('hands the way to the ring with no seam, turning at the orbit rate', () => {
    for (const a of [1440 / 900, 1366 / 657, 585 / 1266]) {
      expect(wayShot(300, a)).toEqual(ringShot(0, a));
      expect(azimuthOf(wayShot(300, a)) - azimuthOf(wayShot(299.9, a))).toBeCloseTo(ORBIT_RATE * 0.1, 3);
    }
    expect(RING_TURN0).toBeCloseTo((ORBIT_RATE * 40) / 2, 10);
  });

  it('keeps the fall speed to the arrival: the light never slows before the ring', () => {
    const v = (f: number) => lightAt(f, 1.6).position[1] - lightAt(f + 1, 1.6).position[1];
    for (let f = 100; f < F.ARRIVE - 1; f++) expect(v(f)).toBeCloseTo(v(100), 6);
    expect(lightAt(F.ARRIVE, 1.6).position[1]).toBeCloseTo(RING.centre[1], 6);
  });

  it('shows each fact once, in order, beside a side move of a tenth of the width', () => {
    expect([81, 121, 161, 201, 241].map((f) => factAt(f))).toEqual([0, 1, 2, 3, 4].map((i) => ({ index: i, opacity: 1, side: [-1, 1, -1, 1, -1][i] })));
    expect(factAt(60)).toEqual({ index: null, opacity: 0, side: null });
    expect(factAt(261)).toEqual({ index: null, opacity: 0, side: null });
  });

  it("starts from the site's own top shot, and the previs's desk and phone tops are the site's", () => {
    for (const a of [1440 / 900, 1366 / 657, 585 / 1266]) expect(wayShot(1, a)).toEqual(topShotFor(a));
    expect(topShotFor(585 / 1266).position[1]).toBeCloseTo(21.35, 1);
  });

  it('takes the desk sizes at and above square, the phone sizes below', () => {
    expect([sizeFor(1.6), sizeFor(1), sizeFor(0.99), sizeFor(0.46)]).toEqual(['desk', 'desk', 'phone', 'phone']);
  });

  it('raises the beads from their rise while the light still flies, and lands the needle at the centre', () => {
    expect(BEADS_IN).toBe(262);
    expect(wayNeedle(F.NEEDLE - 1)).toBeNull();
    expect(wayNeedle(F.END)).toEqual(ringNeedle(0));
    expect(voidAt(20, 1.6).band).toBe(0);
    expect(voidAt(60, 1.6).band).toBe(1);
  });

  it('stands the mist band 12 m off the camera in the fall, and behind the ring from the landing: 26 m on a desk, 30 on a phone', () => {
    for (const f of [20, 121, 258]) expect(voidAt(f, 1.6).bandDistance).toBe(12);
    expect(voidAt(272, 1.6).bandDistance).toBe(26);
    expect(voidAt(300, 0.46).bandDistance).toBe(30);
    expect(voidAt(265, 1.6).bandDistance).toBeGreaterThan(12);
    expect(voidAt(265, 1.6).bandDistance).toBeLessThan(26);
  });
});
