/**
 * The light dive as plain numbers (spec 2026-10-25-bob-light-dive-design.md, approved in the third mock-up): from the
 * way's frame (1 to 300, fractional allowed) or the ring's angle to where the camera stands, where the light is and how
 * it glows, which of Bob's facts rides beside it, how far the void has streamed, where the needle and the beads are.
 * Pure, as the journey is (./journey.ts): it imports nothing from React or three, and remembers no frame.
 *
 * Every number is the previs's, tools/blender/light_dive.py (473dead), whose per-frame data the tests hold this to
 * (tests/fixtures/light-dive): the motion is ported function by function (`speed_table`, `track_pose`, `cam_pose`,
 * `side_x`, `light_path`, `trail_point`, `light_radius`, `glow_at`, `fact_at`, `ring_camera_pose`, `ring_bead_position`,
 * `lift_from`, `ring_closeness`, `filament_shape`, the void's clock). The previs works in Blender's frame; here the
 * numbers are worked there and given out in three's: Blender (x, y, z) is three (x, z, -y).
 *
 * Two things differ from the previs, both for the site:
 * - **Any screen.** The previs renders two sizes, 1440x900 and 585x1266. Here a screen of any aspect takes the size
 *   nearer it (`sizeFor`), keeps that size's horizontal field and takes the vertical from the aspect. The way's field is
 *   the site's own top shot's (`topShotFor`: on those two screens the previs's 50 mm and 83.5 mm, from the 12.6 m and
 *   21.35 m it stands at); the ring's is the ring camera's lens, up to an 80-degree vertical field (the phone's ring needs
 *   79), past which the camera stands back along its line to the pivot.
 * - **The pivot.** The light ignites at the needle's pivot where the site's compass holds it at BOB from above, 0.09
 *   above the glass, a metre over the previs's (which had sunk it by its frame 362); the way in's first sink takes that
 *   metre up by frame 36, and from there the light's path is the previs's own (ledger Ruling C).
 */
import { type CameraShot, topShotFor } from '~/engine/bob/shots';

type Vec3 = readonly [number, number, number];
type V3 = [number, number, number];

/** The NeedleOverride of the compass (src/engine/bob/build/compass.ts): the pivot, the size, the point the tip aims at. */
export interface NeedleAt {
  position: Vec3;
  scale: number;
  aim: Vec3 | null;
}

/** The way's frames. */
export const LIGHT_FRAMES = 300;

/**
 * The way's moments (the previs's F_*): the light ignites by IGNITE; the camera is under the glass sky by PASS and turns
 * into the chase over TURN-CHASE (the way in's easings timed to SETTLE); the fall runs FALL to LAND - 1 (the five facts,
 * 40 frames each); the light reaches the ring's centre at ARRIVE and becomes the needle from NEEDLE over NEEDLE_FRAMES;
 * END is the ring's first frame.
 */
export const F = { IGNITE: 8, PASS: 46, TURN: 60, CHASE: 80, SETTLE: 84, FALL: 61, LAND: 261, ARRIVE: 273, NEEDLE: 272, END: 300 } as const;
export const NEEDLE_FRAMES = 10;
/** The beads start to rise into view, the light still flying. */
export const BEADS_IN = 262;

/**
 * The ring, in three's frame: its centre (the needle's pivot, straight under the O), the beads' radius round it, how far
 * below the ring the beads rise from over the landing, the needle's size there, how far the bead passing behind the pivot
 * rises so it never stands on the needle's back tip.
 */
export const RING = { centre: [0, -11, 0] as Vec3, radius: 5.5, rise: 6, needleScale: 2, lift: 0.35 } as const;
/** The projects round the ring, in order, at 0, 120 and 240 degrees: Funcial in front where the light lands. */
export const RING_BEADS = [
  { id: 'funcial', angle: 0 },
  { id: 'jontai-energy', angle: 120 },
  { id: 'cookies-clicker', angle: 240 }
] as const;
const RING_SPACING = 120;

/**
 * Degrees the ring turns for a way frame's scroll: the page scrolls the way's 300 frames over 3 viewport heights (299
 * steps) and the ring 120 degrees a viewport height (~/state/chapters).
 */
export const ORBIT_RATE = 120 / (299 / 3);
/** The landing swings the camera this far round into the orbit, gathering ORBIT_RATE evenly over its 40 frames. */
export const RING_TURN0 = (ORBIT_RATE * (F.END - (F.LAND - 1))) / 2;

export type DiveSize = 'desk' | 'phone';

/** The previs's size nearest a screen of this aspect: the desk's at and above square, the phone's below. */
export function sizeFor(aspect: number): DiveSize {
  return aspect >= 1 ? 'desk' : 'phone';
}

// ---------------------------------------------------------------- helpers (the previs's bob_animate.py)
const clamp01 = (x: number): number => (x > 0 ? (x < 1 ? x : 1) : 0);
const easeIo = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number): number => 1 - (1 - clamp01(x)) ** 3;
const span = (f: number, f0: number, f1: number): number => clamp01((f - f0) / (f1 - f0));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const RAD = Math.PI / 180;

/** Blender's frame to three's. */
const toThree = (v: Vec3): V3 => [v[0], v[2], -v[1]];
/** `v` turned about Blender's Z by `a` radians. */
const rotZ = (v: Vec3, a: number): V3 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];

/** From p0 at slope m0 to p1 at slope m1 over t 0..1 (slopes a unit of t): the previs's `hermite` and `turn` (m1 0). */
function hermite(p0: number, m0: number, p1: number, m1: number, x: number): number {
  const t = clamp01(x);
  return (2 * t ** 3 - 3 * t ** 2 + 1) * p0 + (t ** 3 - 2 * t ** 2 + t) * m0 + (3 * t ** 2 - 2 * t ** 3) * p1 + (t ** 3 - t ** 2) * m1;
}

// ---------------------------------------------------------------- the fields
/** The tangent of half the horizontal field of a lens on the previs's 36 mm wide sensor. */
const tanH = (lens: number): number => 18 / lens;
/** The lens whose horizontal half-field has this tangent. */
const lensOf = (th: number): number => 18 / th;
/** The tangent of half the vertical field of a lens on a screen of this aspect. */
const tanV = (lens: number, aspect: number): number => tanH(lens) / aspect;

/** The way's lens on this screen: the site's top shot's field, fitted across, as the previs's 50 mm and 83.5 mm are. */
function wayLens(aspect: number): number {
  return lensOf(Math.tan((topShotFor(aspect).fov * RAD) / 2) * aspect);
}

/** The camera's height at BOB from above on this screen: the site's top shot's. */
const topHeight = (aspect: number): number => topShotFor(aspect).position[1];

// ---------------------------------------------------------------- the light's path (the previs's speed table)
const RING_HEIGHT = -11; // Blender z
const P0_PREVIS = -0.91; // the previs's pivot at its frame 362 (sunk 1.0 under the armillary's 0.09)
const P0_SITE = 0.09; // the site's at BOB from above: the compass holds the needle there
const V_PEAK = 0.13;

function speedTable(vFall: number): number[] {
  const s = new Array<number>(F.END + 1).fill(0);
  for (let f = 1; f <= F.END; f++) {
    let v: number;
    if (f <= F.IGNITE) v = 0;
    else if (f <= 22) v = V_PEAK * easeIo((f - F.IGNITE) / (22 - F.IGNITE));
    else if (f <= 36) v = V_PEAK;
    else if (f <= 80) v = lerp(V_PEAK, vFall, easeIo((f - 36) / 44));
    else if (f <= F.ARRIVE) v = vFall;
    else v = 0;
    s[f] = v;
  }
  return s;
}

function anchorTable(vFall: number, p0: number): number[] {
  const s = speedTable(vFall);
  const z = new Array<number>(F.END + 1).fill(p0);
  for (let f = 2; f <= F.END; f++) z[f] = z[f - 1]! - s[f]!;
  return z;
}

/** The fall's speed that lands the light on the ring's plane at ARRIVE (the previs's bisection, from its own pivot). */
const V_FALL = (() => {
  let lo = 0.0005;
  let hi = 0.3;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (anchorTable(mid, P0_PREVIS)[F.ARRIVE]! > RING_HEIGHT) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
})();

/**
 * The light's height at each integer frame (Blender z): the previs's, but starting from the site's pivot, the extra metre
 * taken up over frames 8-36 on a sine-squared share (no corner in the speed), so it is the previs's own from 36 on.
 */
const ANCHOR_Z: number[] = (() => {
  const z = anchorTable(V_FALL, P0_PREVIS);
  const weights = Array.from({ length: F.END + 1 }, (_, f) => (f > F.IGNITE && f <= 36 ? Math.sin((Math.PI * (f - F.IGNITE)) / (36 - F.IGNITE)) ** 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let taken = 0;
  for (let f = 0; f <= F.END; f++) {
    taken += weights[f]!;
    z[f] = z[f]! + (P0_SITE - P0_PREVIS) * (1 - taken / total);
  }
  for (let f = F.ARRIVE; f <= F.END; f++) z[f] = RING_HEIGHT;
  return z;
})();

/** The light's height at frame f (fractional), between the integer frames. */
function anchorAt(f: number): number {
  const c = Math.min(Math.max(f, 1), F.END);
  const i = Math.floor(c);
  return i >= F.END ? ANCHOR_Z[F.END]! : lerp(ANCHOR_Z[i]!, ANCHOR_Z[i + 1]!, c - i);
}

// ---------------------------------------------------------------- the camera following the light
const D_PASS = 2.4;
const THETA_SWING = 95 * RAD;
const D_SWING = 5;
const Y_FALL = 0.56;
const U_CHASE = 0.05;
const D_CHASE = 4.5;
const BAND_Y_CHASE = 0.3;
const GLIDE = Math.atan(V_FALL / U_CHASE);
const STREAM_IN = [F.TURN, F.CHASE] as const;
const STREAM_OUT = [F.ARRIVE - 10, F.ARRIVE] as const;

/** The camera's position angle from straight above in the chase, on this screen. */
function chaseAngle(aspect: number): number {
  const tv = tanV(wayLens(aspect), aspect);
  const above = Math.atan((0.5 - BAND_Y_CHASE) * 2 * tv) + Math.atan((Y_FALL - 0.5) * 2 * tv);
  return Math.PI / 2 - GLIDE - above;
}

/** The way in's swing at frame f: the position angle and distance, and their rates a frame. */
function swing(f: number): [number, number, number, number] {
  const x = span(f, F.PASS, F.SETTLE);
  const rate = (6 * x * (1 - x)) / (F.SETTLE - F.PASS);
  return [THETA_SWING * easeIo(x), lerp(D_PASS, D_SWING, easeIo(x)), THETA_SWING * rate, (D_SWING - D_PASS) * rate];
}

const [TURN_TH, TURN_D, TURN_TH_RATE, TURN_D_RATE] = swing(F.TURN);

/** A camera pose in Blender's frame: where it stands, its pitch (Euler X, 0 straight down) and yaw (Euler Z), its lens. */
interface Pose {
  loc: V3;
  th: number;
  yaw: number;
  lens: number;
  /** The camera's distance to the light (the way) or the pivot (the ring), for its look-at point. */
  reach: number;
}

/** The camera following the light: its pose and its distance d and aim tilt dl (the previs's `track_pose`). */
function trackPose(f: number, aspect: number): Pose & { d: number; dl: number } {
  const lens = wayLens(aspect);
  const d0 = topHeight(aspect) - P0_SITE;
  let th: number;
  let d: number;
  if (f <= F.PASS) {
    th = 0;
    d = f <= F.IGNITE ? d0 : lerp(d0, D_PASS, easeIo(span(f, F.IGNITE, F.PASS)));
  } else if (f <= F.TURN) {
    [th, d] = swing(f);
  } else {
    const t = span(f, F.TURN, F.CHASE);
    const n = F.CHASE - F.TURN;
    th = hermite(TURN_TH, TURN_TH_RATE * n, chaseAngle(aspect), 0, t);
    d = hermite(TURN_D, TURN_D_RATE * n, D_CHASE, 0, t);
  }
  const dl = Math.atan((Y_FALL - 0.5) * 2 * tanV(lens, aspect)) * easeIo(span(f, F.FALL, F.FALL + 32));
  const z = anchorAt(f);
  return { loc: [0, -d * Math.sin(th), z + d * Math.cos(th)], th: th + dl, yaw: 0, lens, reach: d, d, dl };
}

// ---------------------------------------------------------------- the ring's camera
/** The ring camera of each size: outside the ring on the front bead's side, `height` above it, looking down `pitch`. */
const RING_CAM = {
  desk: { distance: 15, height: 4.5, pitch: 19, lens: 35 },
  phone: { distance: 12.1, height: 5.64, pitch: 25, lens: 47 }
} as const;
/** The widest vertical field the ring takes: past it the camera stands back along its line to the pivot. */
const RING_MAX_VFOV = 80;
const RING_C: V3 = [0, 0, RING_HEIGHT];

/**
 * The ring camera carried `azimuth` degrees round the ring's axis (the previs's `ring_camera_pose`), on this screen. The
 * ring stands RING_TURN0 round in the world, so the camera at azimuth -RING_TURN0 is on Blender's -Y side, the chase's.
 */
function ringPose(azimuth: number, aspect: number): Pose {
  const c = RING_CAM[sizeFor(aspect)];
  const yaw = -(azimuth + RING_TURN0) * RAD;
  const tv = tanV(c.lens, aspect);
  const back = Math.max(1, tv / Math.tan((RING_MAX_VFOV / 2) * RAD));
  const off = rotZ([0, -c.distance * back, c.height * back], yaw);
  const loc: V3 = [RING_C[0] + off[0], RING_C[1] + off[1], RING_C[2] + off[2]];
  return { loc, th: (90 - c.pitch) * RAD, yaw, lens: back > 1 ? lensOf(tanH(c.lens)) : c.lens, reach: Math.hypot(...off) };
}

/** The vertical field of a pose's lens on this screen, degrees, held to the ring's widest. */
function fovOf(lens: number, aspect: number): number {
  return Math.min((2 * Math.atan(tanV(lens, aspect))) / RAD, RING_MAX_VFOV);
}

/** A Blender pose as the site's camera shot: no parallax (`sway` 0), as every shot in the void. */
function shotOf(p: Pose, aspect: number): CameraShot {
  const forward = rotZ([0, Math.sin(p.th), -Math.cos(p.th)], p.yaw);
  const up = rotZ([0, Math.cos(p.th), Math.sin(p.th)], p.yaw);
  const target: V3 = [p.loc[0] + forward[0] * p.reach, p.loc[1] + forward[1] * p.reach, p.loc[2] + forward[2] * p.reach];
  return { position: toThree(p.loc), target: toThree(target), fov: fovOf(p.lens, aspect), up: toThree(up), sway: 0 };
}

/** Where the pivot (on the ring's axis) sits on the frame, from the top, for a camera at `loc` pitched `th` facing the axis. */
function anchorY(loc: Vec3, th: number, lens: number, aspect: number, anchorZ: number): number {
  const rho = Math.hypot(loc[0], loc[1]);
  const beta = Math.atan2(loc[2] - anchorZ, rho);
  return 0.5 + Math.tan(beta - (Math.PI / 2 - th)) / (2 * tanV(lens, aspect));
}

/**
 * The camera at way frame f (the previs's `cam_pose`): following the light down through the O and into the chase, then,
 * in the landing, leaving the chase on its own course and swinging out and round into the ring camera, gathering the
 * orbit's own turn so it carries straight on into the ring's.
 */
function wayPose(f: number, aspect: number): Pose {
  const tp = trackPose(Math.min(f, F.LAND - 1), aspect);
  if (f <= F.LAND - 1) return trackPose(f, aspect);
  const rp = ringPose(0, aspect);
  if (f >= F.END) return rp;
  const n = F.END - (F.LAND - 1);
  const t = span(f, F.LAND - 1, F.END);
  const rho0 = Math.hypot(tp.loc[0], tp.loc[1]);
  const z0 = tp.loc[2];
  const rho1 = Math.hypot(rp.loc[0] - RING_C[0], rp.loc[1] - RING_C[1]);
  const z1 = rp.loc[2];
  const rho = hermite(rho0, 0, rho1, 0, t);
  const z = hermite(z0, -V_FALL * n, z1, 0, t);
  const turned = hermite(0, 0, RING_TURN0, ORBIT_RATE * n, t);
  const yaw = -turned * RAD;
  const off = rotZ([0, -rho, 0], yaw);
  const loc: V3 = [RING_C[0] + off[0], RING_C[1] + off[1], z];
  const e = easeIo(t);
  const lens = lerp(tp.lens, rp.lens, e);
  const yS = lerp(Y_FALL, anchorY(rp.loc, rp.th, rp.lens, aspect, RING_HEIGHT), e);
  const beta = Math.atan2(z - anchorAt(f), rho);
  const th = Math.PI / 2 - (beta - Math.atan((yS - 0.5) * 2 * tanV(lens, aspect)));
  return { loc, th, yaw, lens, reach: Math.hypot(rho, z - anchorAt(f)) };
}

/** The camera at way frame f (fractional allowed) on a screen of this aspect: BOB from above at 1, the ring's at 300. */
export function wayShot(f: number, aspect: number): CameraShot {
  if (f <= 1) return topShotFor(aspect);
  return shotOf(wayPose(f, aspect), aspect);
}

/** The camera `angle` degrees round the ring on a screen of this aspect: 0 is Funcial in front (the way's frame 300). */
export function ringShot(angle: number, aspect: number): CameraShot {
  return shotOf(ringPose(angle, aspect), aspect);
}

// ---------------------------------------------------------------- the light
const SIDE_A = { desk: 0.1, phone: 0.08 } as const;
const SIDE_S = [-1, 1, -1, 1, -1] as const;
const LIGHT_ALPHA = { desk: [0.011, 0.025], phone: [0.022, 0.05] } as const;

/** The side the current fact's move takes the light to (-1 left, 1 right); null outside the fall. */
function sideAt(f: number): -1 | 1 | null {
  if (!(f >= F.FALL && f < F.LAND)) return null;
  return SIDE_S[Math.floor((f - F.FALL) / 40)]!;
}

/** The light's x on the frame (0 left .. 1 right) at frame f, 0.5 outside the fall. */
function sideX(f: number, aspect: number): number {
  const s = sideAt(f);
  if (s === null) return 0.5;
  const k = (f - F.FALL) % 40;
  return 0.5 + s * SIDE_A[sizeFor(aspect)] * Math.sin((Math.PI * k) / 40) ** 2;
}

/** The light's centre at frame f (Blender's frame): down the axis, and across it by what puts it at sideX on the frame. */
function lightCentre(f: number, aspect: number): V3 {
  const tp = trackPose(f, aspect);
  const dx = (sideX(f, aspect) - 0.5) * 2 * tp.d * Math.cos(tp.dl) * tanH(tp.lens);
  return [dx, 0, anchorAt(f)];
}

/** The light's brightness, filaments included: lit over 1-8, a slow breath, out as it becomes the needle. */
function glowAt(f: number): number {
  if (f <= 1) return 0;
  let g = easeIo(span(f, 1, F.IGNITE));
  if (f > F.IGNITE) g *= 1 - 0.08 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (f - F.IGNITE)) / 48));
  g *= 1 - easeIo(span(f, F.NEEDLE + 1, F.NEEDLE + NEEDLE_FRAMES - 1));
  return clamp01(g);
}

export interface LightAt {
  /** The light's centre, three's frame. */
  position: Vec3;
  /** Its radius, m: a share of the frame's width while the camera follows it, fixed from the landing on. */
  radius: number;
  /** Its brightness, 0..1: 0 before it ignites and once it is the needle. */
  glow: number;
  /** How far it is drawn out along the needle, 0..1. */
  stretch: number;
  /** The camera's yaw (three's turn about Y), so its halo and its stretch face as the camera does. */
  yaw: number;
}

/** The light at way frame f on a screen of this aspect. */
export function lightAt(f: number, aspect: number): LightAt {
  const [a8, af] = LIGHT_ALPHA[sizeFor(aspect)];
  const ff = Math.min(f, F.LAND - 1);
  const a = ff <= F.IGNITE ? a8 * easeOut(span(ff, 1, F.IGNITE)) : lerp(a8, af, easeIo(span(ff, F.IGNITE, F.SETTLE)));
  const tp = trackPose(ff, aspect);
  return {
    position: toThree(lightCentre(f, aspect)),
    radius: Math.max(a, 1e-4) * 2 * tp.d * Math.cos(tp.dl) * tanH(tp.lens),
    glow: glowAt(f),
    stretch: easeIo(span(f, F.NEEDLE, F.NEEDLE + NEEDLE_FRAMES)),
    yaw: wayPose(f, aspect).yaw
  };
}

// ---------------------------------------------------------------- the trail
/**
 * How many way frames the tail's sideways moves take to draw in toward the light (1/e): it keeps the full height of the
 * light's path above it, and only a lean toward where the light came from (Bob, 2026-10-27: not a snake).
 */
const TAIL_SWAY = 14;
const TRAIL_FRAMES = 110;
const TRAIL_PILLAR = { laid: [52, 62], fade: [F.TURN, 70] } as const;
/** The trail fades out in the landing. */
export const TRAIL_OUT = [254, 274] as const;
const TRAIL_LENGTH = 2.8;
/** From the chase on, the tail rises this far above the light (m): Bob's "bigger and longer". */
const TRAIL_CHASE_LENGTH = 1.6;

export interface TrailPoint {
  /** Where the light passed, carried back toward the camera, three's frame. */
  point: Vec3;
  /** How far along the trail's fade it is, 0 at the light to 1 at its tail. */
  u: number;
}

/**
 * The trail at way frame f: the light's past places, newest first, each with its share of the fade; empty before the
 * light ignites. Down the shaft they are the past places themselves (the previs's `build_trail`); from the camera's turn
 * to the side on, they keep their height above the light, so the tail stands above it as it falls, and their sideways
 * moves draw in toward the light as they age (TAIL_SWAY). The previs carried them back toward the camera instead, which
 * from the camera's height drew the tail below the light (Bob, 2026-10-27: "the tail sits below, not above").
 */
export function trailAt(f: number, aspect: number): TrailPoint[] {
  const out: TrailPoint[] = [];
  const now = lightCentre(f, aspect);
  const pillar = easeIo(span(f, TRAIL_PILLAR.fade[0], TRAIL_PILLAR.fade[1]));
  const length = lerp(TRAIL_LENGTH, TRAIL_CHASE_LENGTH, easeIo(span(f, F.TURN, F.CHASE)));
  let run = 0;
  let last: V3 | null = null;
  for (let k = 0; k <= TRAIL_FRAMES; k++) {
    const g = f - k;
    if (g < F.IGNITE) break;
    const then = lightCentre(g, aspect);
    let p: V3;
    if (f <= F.TURN) {
      p = then;
    } else {
      const w = lerp(1, Math.exp(-(f - g) / TAIL_SWAY), easeIo(span(f, F.TURN, F.CHASE)));
      p = [now[0] + (then[0] - now[0]) * w, then[1], then[2]];
    }
    if (last) {
      const step = Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
      if (step < 1e-5) continue;
      run += step;
    }
    const u = Math.max(k / TRAIL_FRAMES, run / length, pillar * (1 - easeIo(span(g, TRAIL_PILLAR.laid[0], TRAIL_PILLAR.laid[1]))));
    if (u > 1) break;
    out.push({ point: toThree(p), u });
    last = p;
  }
  return out;
}

/** How strongly the trail shows at frame f: in from 40 to SETTLE, out over TRAIL_OUT. */
export function trailLevel(f: number): number {
  return easeIo(span(f, 40, F.SETTLE)) * (1 - easeIo(span(f, TRAIL_OUT[0], TRAIL_OUT[1])));
}

// ---------------------------------------------------------------- the filaments
const FIL_STEP = 6;
export const FIL_N = 10;
const FILAMENTS = ['tendril', 'tendril', 'tendril', 'tendril', 'tendril', 'arc', 'arc', 'arc'] as const;

/** A seeded generator (mulberry32) with uniform and gaussian draws: each filament's shape is the same for the same frame. */
function rng(seed: number): { uniform: (a: number, b: number) => number; gauss: () => number } {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    uniform: (a, b) => a + (b - a) * next(),
    gauss: () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next())
  };
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : v;
};
const cross = (a: Vec3, b: Vec3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function unit(r: ReturnType<typeof rng>): V3 {
  for (;;) {
    const v: V3 = [r.gauss(), r.gauss(), r.gauss()];
    if (Math.hypot(...v) > 1e-3) return norm(v);
  }
}

function basis(d: V3): [V3, V3] {
  const p = norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  return [p, norm(cross(d, p))];
}

/** Filament k's n-th shape, in units of the light's radius, light-local (Blender's frame). */
function filamentShape(k: number, n: number): V3[] {
  const r = rng(9173 * (k + 1) + 31 * n);
  const pts: V3[] = [];
  if (FILAMENTS[k] === 'tendril') {
    const d = unit(r);
    const [p, q] = basis(d);
    const reach = r.uniform(1.6, 2.5);
    for (let i = 0; i < FIL_N; i++) {
      const t = i / (FIL_N - 1);
      const j = i === 0 ? 0 : 0.17 * t ** 0.6;
      const a = j * r.uniform(-1, 1);
      const b = j * r.uniform(-1, 1);
      const len = lerp(0.9, reach, t);
      pts.push([d[0] * len + p[0] * a + q[0] * b, d[1] * len + p[1] * a + q[1] * b, d[2] * len + p[2] * a + q[2] * b]);
    }
  } else {
    const a = unit(r);
    const [p, q] = basis(a);
    const ang = r.uniform(50, 85) * RAD;
    const b = norm([a[0] * Math.cos(ang) + p[0] * Math.sin(ang), a[1] * Math.cos(ang) + p[1] * Math.sin(ang), a[2] * Math.cos(ang) + p[2] * Math.sin(ang)]);
    for (let i = 0; i < FIL_N; i++) {
      const t = i / (FIL_N - 1);
      const dir = norm([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
      const rad = 1.03 + 0.32 * Math.sin(Math.PI * t) + (i === 0 || i === FIL_N - 1 ? 0 : r.uniform(-0.06, 0.06));
      const w = r.uniform(-0.05, 0.05) * Math.sin(Math.PI * t);
      pts.push([dir[0] * rad + q[0] * w, dir[1] * rad + q[1] * w, dir[2] * rad + q[2] * w]);
    }
  }
  return pts;
}

export interface FilamentAt {
  /** Its points in units of the light's radius, light-local, three's frame. */
  points: Vec3[];
  /** Its brightness, 0.1..1, times the light's glow. */
  brightness: number;
}

/**
 * The light's electric filaments at way frame f: each takes a new shape every FIL_STEP frames and eases into it, so they
 * crawl and never flicker, by the frame alone (the canvas sleeps when the scroll rests); they fade as the light becomes
 * the needle.
 */
export function filamentsAt(f: number): FilamentAt[] {
  const n = Math.floor(f / FIL_STEP);
  const t = easeIo((f - n * FIL_STEP) / FIL_STEP);
  const fade = 1 - easeIo(span(f, F.NEEDLE - 4, F.NEEDLE + 6));
  return FILAMENTS.map((_, k) => {
    const a = filamentShape(k, n);
    const b = filamentShape(k, n + 1);
    return {
      points: a.map((pa, i) => toThree([lerp(pa[0], b[i]![0], t), lerp(pa[1], b[i]![1], t), lerp(pa[2], b[i]![2], t)])),
      brightness: fade * (0.55 + 0.45 * Math.sin((2 * Math.PI * f) / (37 + 6 * k) + 1.7 * k))
    };
  });
}

// ---------------------------------------------------------------- the sparks
/** The sparks off the tail (Bob, 2026-10-27: "a few electricity sparks"): how many, the points of each. */
export const SPARK_N = 3;
export const SPARK_PTS = 7;
/** How many way frames a spark lives, flashing up and out, before it jumps from another place. */
const SPARK_STEP = 5;

export interface SparkAt {
  /** Where along the tail it jumps from: the trail's share of the fade, 0 at the light. */
  u: number;
  /** Its points from there, in units of the light's radius, three's frame; the first at the tail. */
  points: Vec3[];
  /** How bright it is now, 0..1. */
  brightness: number;
}

/** Spark k's n-th life: a jagged line out from the tail, sideways round it and a little up, 1.4 to 2.8 radii long. */
function sparkShape(k: number, n: number): { u: number; points: Vec3[] } {
  const r = rng(4409 * (k + 1) + 53 * n);
  const u = r.uniform(0.04, 0.4);
  const th = r.uniform(0, 2 * Math.PI);
  const d: V3 = [Math.cos(th), r.uniform(-0.1, 0.5), Math.sin(th)];
  const len = r.uniform(1.4, 2.8);
  const points: Vec3[] = [[0, 0, 0]];
  for (let i = 1; i < SPARK_PTS; i++) {
    const t = i / (SPARK_PTS - 1);
    const j = r.uniform(-0.38, 0.38) * (1 - 0.4 * t);
    const lift = r.uniform(-0.18, 0.18);
    points.push([d[0] * len * t - d[2] * j, d[1] * len * t + lift, d[2] * len * t + d[0] * j]);
  }
  return { u, points };
}

/**
 * The sparks at way frame f (on the path, its filaments' frame): each flashes up and out over SPARK_STEP frames, then
 * jumps from another place on the tail; a third of a life apart, so one or two show at a time and never all three. By
 * the frame alone, as the filaments: they crackle as the scroll moves and hold still when it rests.
 */
export function sparksAt(f: number): SparkAt[] {
  return Array.from({ length: SPARK_N }, (_, k) => {
    const g = f + (k * SPARK_STEP) / SPARK_N;
    const n = Math.floor(g / SPARK_STEP);
    const t = (g - n * SPARK_STEP) / SPARK_STEP;
    return { ...sparkShape(k, n), brightness: Math.sin(Math.PI * t) ** 2 };
  });
}

// ---------------------------------------------------------------- the facts
export interface FactAt {
  /** The fact riding with the light, 0 to 4, or null. */
  index: number | null;
  /** Its opacity: in over 6 frames, out over 6. */
  opacity: number;
  /** The side the light's move takes it to: the label rides on the other. */
  side: -1 | 1 | null;
}

/** The fact at way frame f: fact i over 61 + 40 i .. 100 + 40 i. */
export function factAt(f: number): FactAt {
  if (!(f >= F.FALL && f <= F.LAND - 1)) return { index: null, opacity: 0, side: null };
  const i = Math.min(Math.floor((f - F.FALL) / 40), 4);
  const k = f - F.FALL - 40 * i;
  const opacity = easeIo(Math.min(1, (k + 1) / 6)) * easeIo(Math.min(1, (40 - k) / 6));
  return { index: i, opacity, side: SIDE_S[i]! };
}

// ---------------------------------------------------------------- the void
/** The glass top dims over these way frames as the camera comes down to it (the previs's TOP_FADE); the glass dissolves from two frames in. */
export const TOP_FADE = [14, 28] as const;
const BAND = { desk: { y: 0.4, sigma: 0.075 }, phone: { y: 0.4, sigma: 0.045 } } as const;
/** How far ahead of the camera the band hangs, m: near in the way, behind the ring from the landing (258-272). */
const BAND_D = 12;
const BAND_D_RING = { desk: 26, phone: 30 } as const;

/** How far the void has streamed toward the camera by way frame f, m: the light's travel, easing out as it arrives. */
export function streamAt(f: number): number {
  let s = 0;
  const whole = Math.floor(Math.min(Math.max(f, 0), F.END));
  const speed = (g: number): number => U_CHASE * easeIo(span(g, STREAM_IN[0], STREAM_IN[1])) * (1 - easeIo(span(g, STREAM_OUT[0], STREAM_OUT[1])));
  for (let g = 1; g <= whole; g++) s += speed(g);
  if (whole < F.END) s += speed(whole + 1) * (f - whole);
  return s;
}

export interface VoidAt {
  /** The mist band's strength, 0..1 (in over 20-60). */
  band: number;
  /** Where the band's middle is on the frame (from the top), and its width (the fall-off's sigma), shares of the height. */
  bandY: number;
  bandSigma: number;
  /** How far ahead of the camera the band hangs, m: 12 in the way, out to 26 (desk) or 30 (phone) over 258-272. */
  bandDistance: number;
  /** How far the band's wisps have dissolved into the ring's world-fixed mist, 0..1 (272-296). */
  ringMist: number;
  /** The dust's glow, 0..1 (28-60, after the passage's blur). */
  dust: number;
  /** How far the glass top (its letters, rings and glow) has dimmed away, 0..1 (14-28). */
  topFade: number;
  /** How far the floor's glass and the well have dissolved, 0..1 (16-28): the void opens all round the light. */
  glassDissolve: number;
}

/** The void at way frame f on a screen of this aspect (the previs's `void_state`). */
export function voidAt(f: number, aspect: number): VoidAt {
  const b = BAND[sizeFor(aspect)];
  const chaseY = lerp(b.y + 0.02, BAND_Y_CHASE, easeIo(span(f, F.TURN, F.CHASE)));
  return {
    band: easeIo(span(f, 20, 60)),
    bandY: lerp(chaseY, b.y - 0.04, easeIo(span(f, F.LAND - 1, F.END))),
    bandSigma: b.sigma,
    bandDistance: lerp(BAND_D, BAND_D_RING[sizeFor(aspect)], easeIo(span(f, 258, 272))),
    ringMist: easeIo(span(f, 272, 296)),
    dust: easeIo(span(f, 28, 60)),
    topFade: easeIo(span(f, TOP_FADE[0], TOP_FADE[1])),
    glassDissolve: easeIo(span(f, TOP_FADE[0] + 2, TOP_FADE[1]))
  };
}

// ---------------------------------------------------------------- the needle and the beads
/** The point the needle's tip aims at for a camera of this yaw: the bead the camera faces, at the ring's radius. */
function aimFor(yaw: number): Vec3 {
  const d = rotZ([0, -RING.radius, 0], yaw);
  return toThree([RING_C[0] + d[0], RING_C[1] + d[1], RING_C[2]]);
}

/**
 * The needle at the ring's centre `angle` degrees round: its tip toward the bead the camera faces, at twice the compass
 * needle's size, nothing holding it.
 */
export function ringNeedle(angle: number): NeedleAt {
  return { position: RING.centre, scale: RING.needleScale, aim: aimFor(-(angle + RING_TURN0) * RAD) };
}

/** How bright the needle glows as it arrives, times its rest glow. */
const NEEDLE_GLOW = 6;

/** The needle's glow at way frame f: NEEDLE_GLOW at the arrival, eased down to its rest glow, 1, by frame 296. */
export function needleGlow(f: number): number {
  return lerp(NEEDLE_GLOW, 1, easeIo(span(f, F.ARRIVE, 296)));
}

/** The needle at way frame f: none before the light becomes it; drawn out of the light from NEEDLE over NEEDLE_FRAMES. */
export function wayNeedle(f: number): NeedleAt | null {
  if (f < F.NEEDLE) return null;
  if (f >= F.END) return ringNeedle(0);
  const t = easeIo(span(f, F.NEEDLE, F.NEEDLE + NEEDLE_FRAMES));
  return { position: RING.centre, scale: RING.needleScale * (0.45 + 0.55 * t), aim: aimFor(wayPose(f, 1).yaw) };
}

/** The bead at `angle`'s angle from a camera at azimuth `cam`, -180 .. 180. */
const relTo = (angle: number, cam: number): number => ((((angle - cam + 180) % 360) + 360) % 360) - 180;
/** How far a bead rises as it passes behind the pivot, seen from a camera at azimuth `cam`. */
const liftFrom = (angle: number, cam: number): number => RING.lift * easeIo((Math.abs(relTo(angle, cam)) - RING_SPACING) / (180 - RING_SPACING));
/** How near the front a bead is, eased: 1 in front, 0 a bead's spacing or more away. */
const closeness = (angle: number, cam: number): number => easeIo(1 - Math.abs(relTo(angle, cam)) / RING_SPACING);

/** A bead's centre at `angle` round the ring (Blender's frame), the ring set RING_TURN0 round. */
function beadCentre(angle: number): V3 {
  const a = (angle + RING_TURN0) * RAD;
  return [RING_C[0] - RING.radius * Math.sin(a), RING_C[1] - RING.radius * Math.cos(a), RING_C[2]];
}

export interface BeadAt {
  id: (typeof RING_BEADS)[number]['id'];
  /** Its centre, three's frame. */
  position: Vec3;
  /** The point its porthole turns to: the camera. */
  towards: Vec3;
  /** Its light, 0..1: the front bead's answering glow, the others' dim. */
  lit: number;
  /** Whether it is in the scene yet. */
  shown: boolean;
}

/** The beads `angle` degrees round the ring on a screen of this aspect. */
export function ringBeads(angle: number, aspect: number): BeadAt[] {
  const cam = ringShot(angle, aspect).position;
  return RING_BEADS.map(({ id, angle: at }) => {
    const c = beadCentre(at);
    return { id, position: toThree([c[0], c[1], c[2] + liftFrom(at, angle)]), towards: cam, lit: closeness(at, angle), shown: true };
  });
}

/** The beads at way frame f on a screen of this aspect: rising into view from BEADS_IN, Funcial answering on arrival. */
export function beadsAt(f: number, aspect: number): BeadAt[] {
  if (f >= F.END) return ringBeads(0, aspect);
  const pose = wayPose(f, aspect);
  const az = -pose.yaw / RAD - RING_TURN0;
  const rise = easeOut(span(f, BEADS_IN, 292));
  const cam = toThree(pose.loc);
  return RING_BEADS.map(({ id, angle: at }) => {
    const c = beadCentre(at);
    const lit = at === 0 ? easeIo(span(f, F.ARRIVE, F.END)) : 0;
    return { id, position: toThree([c[0], c[1], c[2] + liftFrom(at, az) - RING.rise * (1 - rise)]), towards: cam, lit, shown: f >= BEADS_IN };
  });
}

/** A bead's centre at rest `angle` degrees round the ring, three's frame: where it stands with no lift and fully risen. */
export function beadRest(angle: number): Vec3 {
  return toThree(beadCentre(angle));
}
