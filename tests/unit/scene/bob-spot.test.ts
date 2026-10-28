import { describe, expect, it } from 'vitest';
import type { CameraShot } from '~/engine/bob/shots';
import { project } from '~/scene/bob/fit';
import { liftAt, riseStep, SPOT, spotFor, type SpotPose } from '~/scene/bob/spot';

type Vec3 = [number, number, number];
const DESK = 16 / 10;
const PHONE = 390 / 844;
/** A board's stop, roughly: the camera out and up, looking at the board. */
const SHOT: CameraShot = { position: [-11.4, -14.6, 13.6], target: [-0.4, -19.6, 0.5], fov: 38, up: [0, 1, 0] };
const PHONE_SHOT: CameraShot = { ...SHOT, fov: 58 };
const RADIUS = 0.6;

/** The camera's own up, a unit long: what a sphere's top and bottom differ along on the screen. */
function cameraUp(shot: CameraShot): Vec3 {
  const f = [0, 1, 2].map((k) => shot.target[k]! - shot.position[k]!) as Vec3;
  const fl = Math.hypot(...f);
  const fw = f.map((v) => v / fl) as Vec3;
  const r: Vec3 = [fw[1] * 0 - fw[2] * 1, fw[2] * 0 - fw[0] * 0, fw[0] * 1 - fw[1] * 0];
  const rl = Math.hypot(...r);
  const rn = r.map((v) => v / rl) as Vec3;
  return [rn[1] * fw[2] - rn[2] * fw[1], rn[2] * fw[0] - rn[0] * fw[2], rn[0] * fw[1] - rn[1] * fw[0]];
}
function cameraRight(shot: CameraShot): Vec3 {
  const f = [0, 1, 2].map((k) => shot.target[k]! - shot.position[k]!) as Vec3;
  const r: Vec3 = [-f[2], 0, f[0]];
  const rl = Math.hypot(...r);
  return r.map((v) => v / rl) as Vec3;
}
const along = (p: Vec3, d: Vec3, k: number): Vec3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];

describe('the open spot: where an opened project stands in front of the camera, which stays', () => {
  it('keeps the spot of the mock-up Bob approved', () => {
    expect(SPOT).toEqual({
      desk: { ndc: [0.3, 0.16], across: 0.5, distance: 0.34 },
      phone: { ndc: [0, 0.42], width: 0.66, height: 0.32, distance: 0.3 },
      tilt: 0.42,
      rise: 1.5,
      sink: 1.3,
      lift: 1.6,
      sway: 0.12
    });
  });

  it("stands the object's middle at +0.3, +0.16 on a laptop and the top middle on a phone", () => {
    const desk = project(spotFor(SHOT, DESK, RADIUS, 0).centre, SHOT, DESK);
    expect(desk.front).toBe(true);
    expect(desk.x).toBeCloseTo(0.3, 3);
    expect(desk.y).toBeCloseTo(0.16, 3);
    const phone = project(spotFor(PHONE_SHOT, PHONE, RADIUS, 0).centre, PHONE_SHOT, PHONE);
    expect(phone.x).toBeCloseTo(0, 3);
    expect(phone.y).toBeCloseTo(0.42, 3);
    // In front of the camera, at its share of the camera's distance to what it looks at.
    const d = Math.hypot(...([0, 1, 2].map((k) => SHOT.target[k]! - SHOT.position[k]!) as Vec3));
    const spot = spotFor(SHOT, DESK, RADIUS, 0).centre;
    expect(Math.hypot(...([0, 1, 2].map((k) => spot[k]! - SHOT.position[k]!) as Vec3))).toBeCloseTo(0.34 * d, 9);
  });

  it("sizes it to half the screen's height on a laptop, and to fit a phone's width", () => {
    const desk = spotFor(SHOT, DESK, RADIUS, 0);
    const up = cameraUp(SHOT);
    const top = project(along(desk.centre, up, RADIUS * desk.scale), SHOT, DESK);
    const bottom = project(along(desk.centre, up, -RADIUS * desk.scale), SHOT, DESK);
    expect((top.y - bottom.y) / 2).toBeCloseTo(0.5, 3);

    const phone = spotFor(PHONE_SHOT, PHONE, RADIUS, 0);
    const right = cameraRight(PHONE_SHOT);
    const pUp = cameraUp(PHONE_SHOT);
    const across = (project(along(phone.centre, right, RADIUS * phone.scale), PHONE_SHOT, PHONE).x - project(along(phone.centre, right, -RADIUS * phone.scale), PHONE_SHOT, PHONE).x) / 2;
    const tall = (project(along(phone.centre, pUp, RADIUS * phone.scale), PHONE_SHOT, PHONE).y - project(along(phone.centre, pUp, -RADIUS * phone.scale), PHONE_SHOT, PHONE).y) / 2;
    // At most 0.66 of the width and 0.32 of the height: one of them exactly.
    expect(across).toBeLessThanOrEqual(0.66 + 1e-3);
    expect(tall).toBeLessThanOrEqual(0.32 + 1e-3);
    expect(Math.max(across / 0.66, tall / 0.32)).toBeCloseTo(1, 3);
  });

  it('faces the camera, tipped 0.42 toward it', () => {
    const spot = spotFor(SHOT, DESK, RADIUS, 0);
    expect(spot.yaw).toBeCloseTo(Math.atan2(SHOT.position[0] - spot.centre[0], SHOT.position[2] - spot.centre[2]), 12);
    expect(spot.tilt).toBe(0.42);
    // It sways a little round that, slowly, with the clock.
    const later = spotFor(SHOT, DESK, RADIUS, Math.PI);
    expect(later.yaw - spot.yaw).toBeCloseTo(0.12, 9);
    expect(later.centre).toEqual(spot.centre);
  });

  it('curves up off the socket and over to the spot', () => {
    const socket: SpotPose = { centre: [-3, -19, 2], yaw: 0.4, tilt: 0, scale: 1.9 };
    const spot = spotFor(SHOT, DESK, RADIUS, 0);
    expect(liftAt(socket, spot, 0)).toEqual(socket);
    const there = liftAt(socket, spot, 1);
    there.centre.forEach((v, k) => expect(v).toBeCloseTo(spot.centre[k]!, 12));
    expect(there.yaw).toBeCloseTo(spot.yaw, 12);
    expect(there.tilt).toBeCloseTo(spot.tilt, 12);
    expect(there.scale).toBeCloseTo(spot.scale, 12);
    const half = liftAt(socket, spot, 0.5);
    const straight = (k: number): number => (socket.centre[k]! + spot.centre[k]!) / 2;
    expect(half.centre[1] - straight(1)).toBeGreaterThanOrEqual(0.8 - 1e-12);
    expect(half.centre[0]).toBeCloseTo(straight(0), 12);
    expect(half.centre[2]).toBeCloseTo(straight(2), 12);
    // It turns the short way round.
    const behind = liftAt({ ...socket, yaw: Math.PI - 0.1 }, { ...spot, yaw: -Math.PI + 0.1 }, 0.5);
    expect(Math.abs(Math.cos(behind.yaw) + 1)).toBeLessThan(1e-9);
  });

  it('rises in 1.5 s and sinks in 1.3 s at a steady pace', () => {
    let rise = 0;
    for (let k = 0; k < 15; k++) rise = riseStep(rise, true, 0.05);
    expect(rise).toBeCloseTo(0.5, 12);
    for (let k = 0; k < 15; k++) rise = riseStep(rise, true, 0.05);
    expect(rise).toBe(1);
    expect(riseStep(1, true, 0.5)).toBe(1);
    rise = riseStep(1, false, 0.65);
    expect(rise).toBeCloseTo(0.5, 12);
    rise = riseStep(rise, false, 0.65);
    expect(rise).toBeCloseTo(0, 12);
    expect(riseStep(0, false, 0.5)).toBe(0);
    // Turned round part way, it goes back from where it is.
    expect(riseStep(0.4, false, 0.13)).toBeCloseTo(0.3, 12);
  });

  it('re-places for a new screen shape', () => {
    const wide = spotFor(SHOT, DESK, RADIUS, 0);
    const narrow = spotFor(SHOT, PHONE, RADIUS, 0);
    const a = project(wide.centre, SHOT, DESK);
    const b = project(narrow.centre, SHOT, PHONE);
    expect(a.x).toBeCloseTo(0.3, 3);
    expect(a.y).toBeCloseTo(0.16, 3);
    expect(b.x).toBeCloseTo(0, 3);
    expect(b.y).toBeCloseTo(0.42, 3);
    expect(narrow.scale).not.toBeCloseTo(wide.scale, 3);
  });
});
