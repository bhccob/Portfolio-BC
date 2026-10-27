/**
 * The light's path through the projects, as plain numbers (spec 2026-10-27-bob-light-path-design.md): from the place on
 * the home's scroll past the path's start (`q`, in units) to the camera, the light, the void, each bead's state, the
 * labels, the skip button and the fade to black. Pure, as the journey is (./journey.ts): it imports nothing from React or
 * three and remembers no frame, so the same place is the same picture, and the tests read the very pose the scene applies.
 *
 * It is the light path mock-up Bob approved on 2026-10-27 (.superpowers/light-path-mockup/path.ts), ported with its names
 * and numbers, and tied to its own poses (tests/fixtures/light-path). The way, after the light dive hands the light over
 * at way frame `HAND_F`, for each project on the way in order (~/state/chapters):
 * - TRAVEL: the light flows on (out of the fall, or out of the last bead) to the next bead, which waits in the dark;
 * - ORBIT (3A): the light circles the bead a little more than once, behind it and in front, and comes to rest on its
 *   right; the camera pushes in gently; the bead's veins wake where the light passes;
 * - INSIDE: the camera goes through the glass, and the objects build with the scroll;
 * then LOOK (8A): the camera pulls back out and away, and the whole way shows, the trail and every bead on it; and SHEET:
 * the look back fades to black over its first 0.55, the credits rising over the rest (the end page, src/ui/EndPage.tsx).
 *
 * Where it differs from the mock-up, on purpose:
 * - the segments are the home's chapters, on the axis `q = place − pathStart`;
 * - nothing runs by a clock, as the canvas sleeps when the scroll rests: the light does not breathe, and its filaments
 *   crawl by the place alone;
 * - the skip button shows at the look back's own stop too, the sheet's start, which the mock-up's half-open test hid;
 * - the way takes up to five projects: a fourth and fifth bead sit as the second and third do from the one before, and
 *   the look back's camera stands back until it frames every bead.
 */
import type { CameraShot } from '~/engine/bob/shots';
import { shotToward } from '~/engine/bob/shots';
import { type Chapters, frameOfPlace, HAND_F, HOME_CHAPTERS, pathStart } from '~/state/chapters';
import { type FactAt, filamentsAt, lightAt, sizeFor, sparksAt, streamAt, trailAt, trailLevel, voidAt, wayShot } from './lightDive';
import type { LightPose, VoidPose } from './poseTypes';

export type Vec3 = [number, number, number];
type R3 = readonly [number, number, number];

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;
const add = (a: R3, b: R3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: R3, b: R3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: R3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: R3, b: R3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: R3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: R3): Vec3 => mul(a, 1 / (len(a) || 1));
const cross = (a: R3, b: R3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
/** How far `x` is from `a` to `b`, held to 0..1. */
const seg = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** The mock-up's ease: a cubic in and out, `x` held to 0..1. */
export function ease(x: number): number {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
const hermite = (p0: number, m0: number, p1: number, m1: number, x: number): number => {
  const t = clamp01(x);
  return (2 * t ** 3 - 3 * t ** 2 + 1) * p0 + (t ** 3 - 2 * t ** 2 + t) * m0 + (3 * t ** 2 - 2 * t ** 3) * p1 + (t ** 3 - t ** 2) * m1;
};
const hermite3 = (p0: R3, m0: R3, p1: R3, m1: R3, t: number): Vec3 => [
  hermite(p0[0], m0[0], p1[0], m1[0], t),
  hermite(p0[1], m0[1], p1[1], m1[1], t),
  hermite(p0[2], m0[2], p1[2], m1[2], t)
];

// ---------------------------------------------------------------- the beads' places and the light's orbits

/**
 * Each bead's centre from the one before it (the first from the light at the hand-over): on down, and to the side. A
 * fourth and a fifth sit from theirs as the second and the third do, so the way keeps zigzagging down.
 */
const OFFSETS: readonly R3[] = [
  [0.6, -3.0, -5.2],
  [-4.0, -2.3, 3.0],
  [5.6, -2.0, 3.0]
];
const offsetOf = (i: number): R3 => OFFSETS[i < OFFSETS.length ? i : i % 2 === 1 ? 1 : 2]!;
/** The orbit's radius, m. */
export const R_ORBIT = 1.5;
/** The orbit's plane, rolled a little, as the 3A mock-up's ellipse is. */
const ROLL = -9 * DEG;
/**
 * Each orbit, in its own angle: 0 on the bead's right, pi/2 in front of it. The light comes down to the bead's back,
 * circles it a little more than once (1.31 turns), behind it and in front, and comes to rest at its front right.
 */
export const ORBIT = { from: -Math.PI / 2, to: 0.12 * Math.PI + TAU } as const;
/** The way the camera looks at each bead from: in front, a little above. */
export const TOWARD: Vec3 = norm([0, 0.13, 1]);
/** The camera's distance from a bead as the orbit starts and as it ends (the gentle push-in), m. */
const D_ORBIT = [8.6, 7.3] as const;
/** The camera's distance from a bead inside it; on a phone a little further out, so the objects fit across the narrow screen. */
const D_INSIDE = { desk: 1.75, phone: 2.3 } as const;
/** The light's speed into an orbit, m a unit of scroll. */
const V_IN = 2.6;
/** How far back along the way the light's trail reaches, m. */
const TRAIL = { desk: 1.2, phone: 1.0 } as const;
/** The look back frames every bead within this share of the frame's half-width and half-height. */
const LOOK_MARGIN = 0.85;
/** The filaments' crawl: way frames of their shapes a unit of scroll. */
const FIL_RATE = 16;
/** The sheet's fade to black takes its first this much. */
const BLACK = 0.55;

export type PathPart = 'travel' | 'orbit' | 'inside' | 'look' | 'sheet';

/** The veins: none woken yet, waking along the orbit (its angle so far, and now), or all awake. */
export type Wake = { kind: 'none' } | { kind: 'orbit'; from: number; now: number } | { kind: 'full' };

export interface BeadView {
  /** The bead's place on the way, 0 for the first. */
  index: number;
  centre: Vec3;
  /** A point its porthole turns to. */
  facing: Vec3;
  /** Whether it is in the scene: not before the light leads to it, nor once it has faded behind. */
  visible: boolean;
  /** Its light, 0..1 (the beads' `setLit`). */
  lit: number;
  /** How much of it shows, 0..1: the bead left behind fades into the dark, and the next one out of it. */
  fade: number;
  /** How far its object has built, 0..1. */
  build: number;
  wake: Wake;
}

/** One moment of the path. */
export interface PathFrame {
  part: PathPart;
  /** The project's place on the way in a travel, an orbit and an inside; -1 in the look back and the sheet. */
  index: number;
  /** How far through the part, 0..1 (over the sheet, its share). */
  t: number;
  shot: CameraShot;
  light: LightPose;
  /** Bob's fact riding with the light: none on the path (the journey runs the fall's last one out, ./journey.ts). */
  fact: FactAt | null;
  void: VoidPose;
  beads: BeadView[];
  /** The bead label beside the light: which bead and how much. */
  label: { index: number; opacity: number } | null;
  /** The touch points of a bead seen inside. */
  points: { index: number; opacity: number } | null;
  /** Whether the skip button shows: from the first orbit through the look back's own stop. */
  skip: boolean;
  /** The look back's line of the whole way, 0..1. */
  way: number;
  /** The fade to black, 0..1. */
  black: number;
  fog: { near: number; far: number };
  /** Whether the glass sky above shows: not in the look back, which looks up toward it, nor in the black. */
  sky: boolean;
}

export interface Path {
  /** How many projects the way visits. */
  count: number;
  centres: readonly Vec3[];
  /** The whole way, for the look back's line: the fall's last stretch and each travel, joined behind each bead. */
  wayPoints: readonly Vec3[];
  /** The look back's camera at rest. */
  lookShot: CameraShot;
  /** The point at `angle` on bead `index`'s orbit. */
  orbitAt(index: number, angle: number): Vec3;
  /** The path at `q` units past its start. */
  frameAt(q: number): PathFrame;
}

/** A stretch of the path on its own axis: a chapter unit's part, its project's place, and where it starts and ends. */
interface Segment {
  kind: PathPart;
  i: number;
  a: number;
  b: number;
  length: number;
}

const PARTS: Readonly<Record<string, PathPart>> = { TRAVEL: 'travel', ORBIT: 'orbit', INSIDE: 'inside', LOOK: 'look', SHEET: 'sheet' };

/** The path's segments from the chapters: each ends where the next begins, so a stop is in exactly one. */
function segmentsOf(c: Chapters): Segment[] {
  const start = pathStart(c);
  const units = c.units.filter((u) => u.id in PARTS);
  return units.map((u, k) => {
    const a = u.start - start;
    const next = units[k + 1];
    return { kind: PARTS[u.id]!, i: u.project ?? -1, a, b: next ? next.start - start : a + u.length, length: u.length };
  });
}

/**
 * How far the light's sweep has gone round a bead on the screen: `toView(angle)` is the point at that angle of its
 * orbit in the camera's view (x, y), `centre` the bead's centre there. From `from` to `now` in 64 steps, each step's turn
 * taken the short way round and summed, so a sweep of more than a turn counts as more: where it started (`start`, the
 * angle in the view), how far it has gone (`span`, radians) and which way (`dir`).
 */
export function wakeSweep(
  toView: (angle: number) => readonly [number, number],
  centre: readonly [number, number],
  from: number,
  now: number
): { start: number; span: number; dir: 1 | -1 } {
  const angleOf = (th: number): number => {
    const [x, y] = toView(th);
    return Math.atan2(y - centre[1], x - centre[0]);
  };
  const steps = 64;
  let prev = angleOf(from);
  const start = prev;
  let swept = 0;
  for (let k = 1; k <= steps; k++) {
    const a = angleOf(from + ((now - from) * k) / steps);
    const d = a - prev;
    swept += Math.atan2(Math.sin(d), Math.cos(d));
    prev = a;
  }
  return { start, span: Math.abs(swept), dir: swept >= 0 ? 1 : -1 };
}

/** Whether the frame is the look back's: its part, or its own stop, the sheet's start. */
export function lookingBack(frame: Pick<PathFrame, 'part' | 't'>): boolean {
  return frame.part === 'look' || (frame.part === 'sheet' && frame.t === 0);
}

/**
 * Where `p` falls in a camera at `shot` on a screen of this aspect: x and y as shares of the half-width and half-height
 * (NDC), and its distance in front of the camera. Three's own projection, done by hand so this module needs none of three.
 */
function frameOf(p: R3, shot: CameraShot, aspect: number): { x: number; y: number; z: number } {
  const forward = norm(sub(shot.target, shot.position));
  const right = norm(cross(forward, shot.up ?? [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(p, shot.position);
  const z = dot(d, forward);
  const tanV = Math.tan((shot.fov * DEG) / 2);
  return { x: dot(d, right) / (z * tanV * aspect), y: dot(d, up) / (z * tanV), z };
}

/** The path on a screen of this aspect (the fall's hand-over and the fields depend on it), over the chapters `c`. */
export function makePath(aspect: number, c: Chapters = HOME_CHAPTERS): Path {
  const size = sizeFor(aspect);
  const phone = size === 'phone';
  const SEGMENTS = segmentsOf(c);
  const find = (kind: PathPart, i: number): Segment => SEGMENTS.find((s) => s.kind === kind && s.i === i)!;
  const segmentAt = (q: number): { s: Segment; t: number } => {
    for (const s of SEGMENTS) if (q < s.b) return { s, t: clamp01((q - s.a) / s.length) };
    return { s: SEGMENTS[SEGMENTS.length - 1]!, t: 1 };
  };
  const count = SEGMENTS.filter((s) => s.kind === 'orbit').length;
  const START = pathStart(c);

  const handLight = lightAt(HAND_F, aspect);
  const handShot = wayShot(HAND_F, aspect);
  const L_H = handLight.position as Vec3;
  const centres: Vec3[] = [];
  for (let i = 0, at: Vec3 = L_H; i < count; i++) {
    at = add(at, offsetOf(i));
    centres.push(at);
  }

  // The orbit's frame: u to the camera's right, w toward the camera (level), rolled about w.
  const up: Vec3 = [0, 1, 0];
  const right = norm(cross(mul(TOWARD, -1), up));
  const u = norm(add(mul(right, Math.cos(ROLL)), mul(up, Math.sin(ROLL))));
  const w = norm([TOWARD[0], 0, TOWARD[2]]);
  const orbitAt = (i: number, th: number): Vec3 => add(centres[i]!, add(mul(u, R_ORBIT * Math.cos(th)), mul(w, R_ORBIT * Math.sin(th))));
  const orbitDir = (th: number): Vec3 => norm(mul(add(mul(u, -Math.sin(th)), mul(w, Math.cos(th))), Math.sign(ORBIT.to - ORBIT.from)));
  const rest = (i: number): Vec3 => orbitAt(i, ORBIT.to);

  // The field: at least 30 degrees tall, and wide enough across for the orbit and its label beside it.
  const fieldAt = (d: number, halfWidth: number): number => Math.max(30, (2 * Math.atan(Math.tan(Math.atan(halfWidth / d)) / aspect)) / DEG);
  const arriveHalf = phone ? R_ORBIT + 0.45 : R_ORBIT + 1.9;
  const arrival = (i: number, d: number): CameraShot => ({
    position: add(centres[i]!, mul(TOWARD, d)),
    target: centres[i]!,
    fov: fieldAt(d, arriveHalf),
    up: [0, 1, 0],
    sway: 0
  });
  const inside = (i: number, k: number): CameraShot => {
    const d = lerp(D_ORBIT[1], D_INSIDE[size], k);
    return {
      position: add(centres[i]!, mul(TOWARD, d)),
      target: add(centres[i]!, [0, -0.12 * k, 0]),
      fov: lerp(fieldAt(D_ORBIT[1], arriveHalf), phone ? 72 : 40, k),
      up: [0, 1, 0],
      sway: 0
    };
  };
  /** The bead from far off, small in the dark ahead, with room above it for the light coming down to it. */
  const approach = (i: number): CameraShot => ({
    position: add(centres[i]!, add(mul(TOWARD, 12.5), [0, 1.1, 0])),
    target: add(centres[i]!, [0, 0.5, 0]),
    fov: fieldAt(12.5, arriveHalf),
    up: [0, 1, 0],
    sway: 0
  });

  // The look back: in front of the last bead and below it, looking back up the way to the first; past three beads it
  // stands back along its line until it frames them all.
  const lookShot: CameraShot = (() => {
    const last = centres[count - 1] ?? L_H;
    const mid = count > 0 ? mul(centres.reduce((sum, centre) => add(sum, centre)), 1 / count) : L_H;
    const position = add(last, phone ? [-0.6, -0.4, 12.5] : [0.9, -0.2, 4.6]);
    const target = add(mid, phone ? [-0.2, -0.8, -1.0] : [-0.6, -0.4, -1.0]);
    const shot: CameraShot = { position, target, fov: phone ? 74 : 54, up: [0, 1, 0], sway: 0 };
    if (count <= 3) return shot;
    const frames = (s: CameraShot): boolean =>
      centres.every((centre) => {
        const v = frameOf(centre, s, aspect);
        return v.z > 0 && Math.abs(v.x) <= LOOK_MARGIN && Math.abs(v.y) <= LOOK_MARGIN;
      });
    let back = 1;
    let backed = shot;
    while (!frames(backed) && back < 6) {
      back += 0.05;
      backed = { ...shot, position: add(target, mul(sub(position, target), back)) };
    }
    return backed;
  })();

  const fallLight = (q: number): Vec3 => lightAt(frameOfPlace(START + q), aspect).position as Vec3;
  const fallDir = norm(sub(handLight.position, lightAt(HAND_F - 1, aspect).position));

  /** Where the light is at place q (before the path, in the fall, for the trail). */
  const lightPos = (q: number): Vec3 => {
    if (q < 0) return fallLight(q);
    const { s, t } = segmentAt(q);
    if (s.kind === 'travel') {
      const i = s.i;
      const start = i === 0 ? L_H : rest(i - 1);
      const end = orbitAt(i, ORBIT.from);
      const T = s.length;
      const gap = len(sub(end, start));
      // Out of the fall at its own speed and direction, or out of the last bead from rest along its orbit's way.
      const m0 = i === 0 ? mul(fallDir, 2.0 * T) : mul(orbitDir(ORBIT.to), gap * 0.9);
      const m1 = mul(orbitDir(ORBIT.from), V_IN * T);
      // From rest, the second and later ease in; the first carries the fall's speed on.
      const k = hermite(0, i === 0 ? 1 : 0, 1, 1, t);
      return hermite3(start, m0, end, m1, k);
    }
    if (s.kind === 'orbit') return orbitAt(s.i, orbitAngle(s.i, t));
    if (s.kind === 'inside') return rest(s.i);
    return rest(count - 1);
  };

  /** The light's angle round bead i at t of its orbit: in at V_IN, round, and to rest. */
  function orbitAngle(i: number, t: number): number {
    const sweep = Math.abs(ORBIT.to - ORBIT.from);
    const s0 = (V_IN * find('orbit', i).length) / (R_ORBIT * sweep);
    return ORBIT.from + (ORBIT.to - ORBIT.from) * hermite(0, s0, 1, 0, t);
  }

  /**
   * The fall's own trail as it stood at the hand-over (./lightDive.ts `trailAt`), behind the light there, and its length:
   * the path's trail begins as it, so nothing of the trail jumps at the hand-over.
   */
  const fallTrail = trailAt(HAND_F, aspect).slice(1).map((t) => t.point as Vec3);
  const fallTrailLength = fallTrail.reduce((sum, p, k) => sum + len(sub(p, k === 0 ? L_H : fallTrail[k - 1]!)), 0);
  /** How long the trail may be: about TRAIL m, and at the hand-over all of the fall's. */
  const trailBudget = Math.max(TRAIL[size], fallTrailLength);

  /**
   * The trail: the light's places just passed, newest first, back along the path to about TRAIL m; back past the
   * hand-over, on through the fall's own last trail, which the path's places push out as the light leads on. Each point's
   * share of the fade (`u`) is how far back along the trail it lies.
   */
  const trailAtQ = (q: number): { point: Vec3; u: number }[] => {
    const points: Vec3[] = [lightPos(q)];
    let gone = 0;
    const add = (p: Vec3): void => {
      gone += len(sub(p, points[points.length - 1]!));
      points.push(p);
    };
    let handOver = false;
    for (let k = 1; k <= 90 && gone < trailBudget; k++) {
      const at = q - k * 0.006;
      if (at <= 0) {
        handOver = true;
        break;
      }
      add(lightPos(at));
    }
    // Back to the hand-over within its length: on through the fall's own trail behind it.
    if (handOver && gone < trailBudget) {
      if (q > 0) add(L_H);
      for (let k = 0; k < fallTrail.length && gone < trailBudget; k++) add(fallTrail[k]!);
    }
    const run: number[] = [0];
    for (let k = 1; k < points.length; k++) run.push(run[k - 1]! + len(sub(points[k]!, points[k - 1]!)));
    const total = run[run.length - 1]! || 1;
    return points.map((point, k) => ({ point, u: run[k]! / total }));
  };

  /**
   * The whole way, for the look back's line: the fall's last stretch and each travel, joined through the points behind
   * the beads (the beads hide it there), so it reads as one line from bead to bead, not the orbits' loops.
   */
  const wayPoints: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const s = find('travel', i);
    for (let k = i === 0 ? 16 : 3; k <= 38; k++) wayPoints.push(lightPos(s.a + (s.length * k) / 46));
    wayPoints.push(sub(centres[i]!, mul(TOWARD, 1.0)));
  }

  /** The camera at q. */
  const shotAt = (q: number): CameraShot => {
    const { s, t } = segmentAt(q);
    if (s.kind === 'travel') {
      const d0 = arrival(s.i, D_ORBIT[0]);
      const far = approach(s.i);
      if (s.i === 0) {
        // The fall's own chase carried on with the light, then back and level, the bead small ahead, then in to it.
        const at = lightPos(q);
        const carried: CameraShot = { ...handShot, position: add(at, sub(handShot.position, L_H)), target: add(at, sub(handShot.target, L_H)) };
        if (t < 0.5) return shotToward(carried, far, ease(t / 0.5));
        return shotToward(far, d0, ease((t - 0.5) / 0.5));
      }
      // Out through the glass, across to the next bead far off, and in to it.
      const a = inside(s.i - 1, 1);
      const b = arrival(s.i - 1, D_ORBIT[1]);
      if (t < 0.28) return shotToward(a, b, ease(t / 0.28));
      if (t < 0.62) return shotToward(b, far, ease((t - 0.28) / 0.34));
      return shotToward(far, d0, ease((t - 0.62) / 0.38));
    }
    if (s.kind === 'orbit') return arrival(s.i, lerp(D_ORBIT[0], D_ORBIT[1], ease(t)));
    if (s.kind === 'inside') return inside(s.i, ease(seg(t, 0, 0.6)));
    const last = count - 1;
    if (s.kind === 'look') {
      if (t < 0.24) return shotToward(inside(last, 1), arrival(last, D_ORBIT[1]), ease(t / 0.24));
      return shotToward(arrival(last, D_ORBIT[1]), lookShot, ease((t - 0.24) / 0.76));
    }
    return lookShot;
  };

  const fogFor = (shot: CameraShot, look: number): { near: number; far: number } => {
    const d = len(sub(shot.position, shot.target));
    const near = Math.max(14, d + 5) + 26 * look;
    return { near, far: near + 36 + 20 * look };
  };

  // The rest of the fall's state, held from the hand-over on.
  const handVoid = voidAt(HAND_F, aspect);
  const handStream = streamAt(HAND_F);
  const handTrail = trailLevel(HAND_F);
  const firstOrbit = count > 0 ? find('orbit', 0).a : Number.POSITIVE_INFINITY;
  const lookEnd = SEGMENTS.find((s) => s.kind === 'look')!.b;

  function frameAt(q: number): PathFrame {
    const { s, t } = segmentAt(Math.max(q, 0));
    const shot = shotAt(Math.max(q, 0));
    const fwd = norm(sub(shot.target, shot.position));
    const black = s.kind === 'sheet' ? ease(seg(t * s.length, 0, BLACK)) : 0;
    // The filaments crawl to and fro over the fall's frames by the place alone, so they hold still when the scroll rests.
    const fil = 70 + Math.abs(((Math.max(q, 0) * FIL_RATE) % 360) - 180);
    const light: LightPose = {
      position: lightPos(Math.max(q, 0)),
      radius: handLight.radius,
      glow: handLight.glow * (1 - black),
      stretch: 0,
      yaw: Math.atan2(-fwd[0], -fwd[2]),
      trail: trailAtQ(Math.max(q, 0)),
      trailLevel: handTrail,
      filaments: filamentsAt(fil),
      sparks: sparksAt(fil)
    };
    const look = s.kind === 'look' ? ease(seg(t, 0.2, 0.9)) : s.kind === 'sheet' ? 1 : 0;

    // Which bead the way is at: its travel, orbit or inside; all of them from the look back on.
    const current = s.kind === 'travel' || s.kind === 'orbit' || s.kind === 'inside' ? s.i : count;
    const beads: BeadView[] = centres.map((centre, i) => {
      const facing = add(centre, mul(TOWARD, 30));
      let visible = i <= current;
      let fade = 1;
      let lit = 0;
      let wake: Wake = { kind: 'none' };
      let build = i < current ? 1 : 0;
      if (i < current) {
        // One bead in view on the way: the one left behind goes once the camera has crossed to the next.
        fade = current === count ? 1 : s.kind === 'travel' && i === current - 1 ? 1 - ease(seg(t, 0.38, 0.7)) : 0;
        visible = fade > 0;
        wake = { kind: 'full' };
        // Behind the light: it dims as the light leads on, and wakes again in the look back.
        lit = s.kind === 'travel' && i === current - 1 ? lerp(1, 0.32, ease(seg(t, 0.15, 0.7))) : 0.32;
        // Under the sheet they hold the look back's end, all awake: the look back's own stop is the sheet's start.
        if (current === count) lit = lerp(0.32, 0.9, ease(seg(s.kind === 'look' ? t : 1, 0.25 + 0.12 * i, 0.55 + 0.12 * i)));
      } else if (i === current) {
        if (s.kind === 'travel') {
          fade = ease(seg(t, i === 0 ? 0.2 : 0.5, i === 0 ? 0.55 : 0.78));
          visible = fade > 0;
          lit = 0.12 * ease(seg(t, 0.55, 1));
        } else if (s.kind === 'orbit') {
          lit = lerp(0.12, 0.9, ease(seg(t, 0.05, 0.85)));
          wake = { kind: 'orbit', from: ORBIT.from, now: orbitAngle(i, t) };
        } else {
          lit = 1;
          wake = { kind: 'full' };
          build = ease(seg(t, 0.22, 1));
        }
      }
      if (s.kind === 'look' || s.kind === 'sheet') {
        visible = true;
        wake = { kind: 'full' };
        build = 1;
        if (i === count - 1) lit = 0.9;
      }
      return { index: i, centre, facing, visible, lit, fade, build, wake };
    });

    let label: PathFrame['label'] = null;
    if (s.kind === 'orbit') label = { index: s.i, opacity: ease(seg(t, 0.84, 0.98)) };
    if (s.kind === 'inside') label = { index: s.i, opacity: 1 - ease(seg(t, 0.04, 0.2)) };
    let points: PathFrame['points'] = null;
    if (s.kind === 'inside') points = { index: s.i, opacity: ease(seg(t, 0.6, 0.78)) };
    if (s.kind === 'travel' && s.i > 0) points = { index: s.i - 1, opacity: 1 - ease(seg(t, 0, 0.14)) };
    if (s.kind === 'look') points = { index: count - 1, opacity: 1 - ease(seg(t, 0, 0.1)) };

    return {
      part: s.kind,
      index: s.kind === 'look' || s.kind === 'sheet' ? -1 : s.i,
      t,
      shot,
      light,
      fact: null,
      void: { ...handVoid, band: handVoid.band * (1 - 0.35 * look), ringMist: 0, stream: handStream },
      beads,
      label,
      points,
      skip: q >= firstOrbit && q <= lookEnd,
      way: s.kind === 'look' ? ease(seg(t, 0.22, 0.8)) : s.kind === 'sheet' ? 1 : 0,
      black,
      fog: fogFor(shot, look),
      sky: !(s.kind === 'look' && t > 0.3) && s.kind !== 'sheet'
    };
  }

  return { count, centres, wayPoints, lookShot, orbitAt, frameAt };
}

/** The last path made by `pathFor`, and the aspect it was made for. */
let kept: { aspect: number; path: Path } | null = null;

/** The home's path on a screen of this aspect, kept for the last aspect asked: every frame asks, and a resize makes it anew. */
export function pathFor(aspect: number): Path {
  if (kept === null || kept.aspect !== aspect) kept = { aspect, path: makePath(aspect) };
  return kept.path;
}
