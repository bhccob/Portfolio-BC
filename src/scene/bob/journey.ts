/**
 * The home's journey as plain numbers: from the scroll's progress (0 to 6, in the chapters' units) to where the camera
 * stands, where the needle is and what it points at, which bead has come forward and how lit each bead is, how much of
 * the void's light shows, and how far the void has sunk into the night. Pure, as the rise's pose is (./scrollPose): it
 * imports nothing from React or three and remembers no frame (it keeps only the glides' bends for the last screen
 * shape, `bendsFor`, which give the same pose either way), so the tests read the very pose the scene applies, and a
 * progress sought to a value poses the scene as the scroll did there.
 *
 * The stretches are the home's chapters (~/state/chapters; spec §2.3, "The scroll's stretches"), one stop each, and
 * the scroll rests at their starts:
 * - the rise, 0-1: M2a's pose itself (`scrollPoseAt(riseAt(progress))`), the home at 0 to BOB from above at 1;
 * - the dive, 1-2: BOB from above holds, the camera drops through the O and down the tunnel, and comes out under the
 *   glass to the overview, all three beads in view, where it rests at 2;
 * - the overview, 2-3: the glide from the overview to Funcial's bead, seen close at 3;
 * - the projects, 3-6: the glide from each bead to the next (Jontai Energy at 4, Cookies Clicker at 5); the last
 *   project's stretch, 5-6, is the move into the night (2026-10-24, the end page): the camera, the needle and the beads
 *   hold Cookies as at 5 and only `night` rises, 0 to 1;
 * - the end page, 6: the seventh stop and the end of the scroll (~/state/chapters `scrollEnd`). It is Cookies at rest
 *   in the full night; the page itself is HTML over the scene (the scene sleeps behind it), so the scroll goes no
 *   further and the progress is held to 6.
 * Within each stretch every part eases on a smoothstep, so it leaves a stop and arrives at the next with no speed, and
 * at a stop it is exactly that stop's pose. Within 1e-6 of a stop the progress is the stop, as `riseAt` has it, so a
 * sum's float residue never leaves it a hair off.
 *
 * The numbers are the Blender preview's (tools/blender/bob_scroll.py, frames 362-480: `cam_pose`, the needle's keys,
 * `PROJECTS`, `OVER_LOC`, `OVER_TGT`, `FINAL_CAM`) and spec §7's, in three's frame: Blender (x, y, z) is three
 * (x, z, -y). The glass is the plane y = 0, the camera starts on +z, and under the glass is negative y.
 */
import type { CategoryId } from '~/data/categories';
import type { ProjectId } from '~/data/projects';
import { type CameraShot, FRAMES, shotFor, topShotFor } from '~/engine/bob/shots';
import { type ChapterId, chapterAt, HOME_CHAPTERS, scrollEnd, stops } from '~/state/chapters';
import { mix, riseAt, type ScrollPose, scrollPoseAt, smoothstep, type Span, through } from './scrollPose';

type Vec3 = readonly [number, number, number];
type Quat = readonly [number, number, number, number];

/** A stretch of the journey: one of the home's chapters, seen as the camera's move. */
export type Stretch = 'rise' | 'dive' | 'overview' | 'project' | 'end';

/**
 * Where the journey is: the stretch, how far through it (0 at its stop, toward 1 at the next), and the bead whose
 * stretch it is (0, 1 or 2, in category order) on a project stretch, else null. The last project's stretch holds its
 * bead and carries `local` through the move into the night (`JourneyPose.night`); the end page is a stretch of its own,
 * the last stop, where `local` is 0 and there is no project.
 */
export interface JourneyAt {
  stretch: Stretch;
  local: number;
  project: number | null;
}

/**
 * Where the needle is once it has left the compass, in three's world coordinates: its pivot's `position` (the needle
 * turns about it, its tip 1.15 up its own +Y), its `scale`, and the world point its tip points at (`aim`), or null for
 * straight down.
 */
export interface NeedleOverride {
  position: Vec3;
  scale: number;
  aim: Vec3 | null;
}

/**
 * One moment of the journey:
 * - `at`: the stretch, as `journeyAt` reads it;
 * - `rise`: M2a's scroll pose for the compass, the letters and the iris (the top, `u` 1, from the dive on);
 * - `shot`: the camera;
 * - `needle`: null on the rise, where the compass holds the needle (`setNeedle`, `setNeedleDip`); from the dive's
 *   start, where it is;
 * - `forward[i]`: how far bead i has drifted toward the camera, 0..1 (along `CAMERA_PATH.bead.forward`);
 * - `lit[i]`: its light, 0..1 (`BeadsModel.setLit`, where 0 is a dim 0.15 of it);
 * - `beam`, `mist`: the void's beam of light from the opening and its mist, 0..1;
 * - `night`: how far the void has sunk into the site's night for the end page, 0..1: 0 everywhere up to Cookies
 *   Clicker's stop, a smoothstep of the last project's stretch (the move into the night), 1 at the end page.
 */
export interface JourneyPose {
  at: JourneyAt;
  rise: ScrollPose;
  shot: CameraShot;
  needle: NeedleOverride | null;
  forward: readonly [number, number, number];
  lit: readonly [number, number, number];
  beam: number;
  mist: number;
  night: number;
}

/** One bead in the void: its project and category, its centre at rest (three's world coordinates) and its radius. */
export interface Bead {
  id: ProjectId;
  category: CategoryId;
  centre: Vec3;
  radius: number;
}

/**
 * The beads, in category order (spec §2.4: 01 Secure element, 02 Front panel, 03 Oscillator), at spec §7's site
 * positions, which are the preview's `PROJECTS` in three's frame: Funcial (1.2, 3.6, -6.9), Jontai (-5.0, 9.5, -5.7)
 * and Cookies (5.4, 13.0, -8.7) in Blender's. Radius 0.95, the preview's shell.
 */
export const BEADS = [
  { id: 'funcial', category: 'secure-element', centre: [1.2, -6.9, -3.6], radius: 0.95 },
  { id: 'jontai-energy', category: 'front-panel', centre: [-5.0, -5.7, -9.5], radius: 0.95 },
  { id: 'cookies-clicker', category: 'oscillator', centre: [5.4, -8.7, -13.0], radius: 0.95 }
] as const satisfies readonly Bead[];

/** The preview's dive stretch: frame 362 (BOB from above) to 442 (the overview), one unit of scroll. */
const DIVE_FRAMES = [362, 442] as const;

/** Frame `f` of the preview as a share of the dive stretch. */
function diveShare(f: number): number {
  return (f - DIVE_FRAMES[0]) / (DIVE_FRAMES[1] - DIVE_FRAMES[0]);
}

/**
 * The void's camera (spec §7, `cam_pose`), in three's frame. The dive's spans are shares of the dive stretch, the
 * preview's frames 362-442 kept in proportion; lenses are millimetres on the preview's 36 mm wide sensor
 * (`lensField`).
 * - `hold`: BOB from above holds, frames 362-372: the top shot itself.
 * - `descent`: frames 372-420, the camera straight down from the top shot to `bottom`, (0, -2.6, 0), 1.4 under the
 *   void's ceiling, looking straight down with -z up the screen. Its field opens from the top shot's (the site's
 *   50 mm: 40.1 degrees across at 16:9, the preview's 39.6) to the 32 mm lens's 58.7. It looks at `look`, 7 under the
 *   glass, the beads' depth (the preview focuses there, `z + 7.0`).
 * - `out`: frames 420-442, coming out of the tunnel: from looking down at `bottom` to standing at `position`
 *   (OVER_LOC, (0, -5.5, -4.4) in Blender's frame) looking at `target` (OVER_TGT, (0, 9.0, -7.2)), the 30 mm lens:
 *   the overview, at rest at the end of the stretch.
 * - `bead`: each project's shot, the preview's FINAL_CAM on Funcial: the camera at `offset` from the bead's centre,
 *   looking at it, the 40 mm lens. The selected bead has drifted `forward` toward the camera (its `f_end`), and the
 *   shot is of the bead where it has come to.
 */
export const CAMERA_PATH = {
  hold: [0, diveShare(372)],
  descent: { span: [diveShare(372), diveShare(420)], bottom: [0, -2.6, 0], look: -7.0, lens: 32 },
  out: { span: [diveShare(420), 1], position: [0, -4.4, 5.5], target: [0, -7.2, -9.0], lens: 30 },
  bead: { offset: [-0.8, 1.0, 6.2], forward: [-0.4, 0.4, 1.4], lens: 40 }
} as const satisfies {
  hold: Span;
  descent: { span: Span; bottom: Vec3; look: number; lens: number };
  out: { span: Span; position: Vec3; target: Vec3; lens: number };
  bead: { offset: Vec3; forward: Vec3; lens: number };
};

/** A bead's centre once it has drifted `share` of the way forward. */
function centreOf(bead: number, share: number): Vec3 {
  const { centre } = BEADS[bead]!;
  const { forward } = CAMERA_PATH.bead;
  return [centre[0] + forward[0] * share, centre[1] + forward[1] * share, centre[2] + forward[2] * share];
}

/** The needle's pivot at BOB from above: on the armillary, sunk flat to 0.09 above the glass. */
const NEEDLE_PIVOT: Vec3 = [0, 0.09, 0];

/** The pivot of the preview's needle when it points at Funcial: its `nloc` (-1.4, 0.8, -7.9) on the armillary. */
const NEEDLE_BY_FUNCIAL: Vec3 = [NEEDLE_PIVOT[0] - 1.4, NEEDLE_PIVOT[1] - 7.9, NEEDLE_PIVOT[2] - 0.8];

/**
 * The needle in the void (spec §7, "The needle in the void"; the preview's needle keys), in three's frame. Spans are
 * shares of the dive stretch.
 * - `pivot`: where the open compass holds it at BOB from above, on the armillary sunk flat to 0.09 above the glass
 *   (`COMPASS_LOOK.iris.flatY`, the preview's ARM_FLAT_Z), its tip straight down.
 * - `sink`: it sinks `depth` into the tunnel, frames 362-376. The preview sinks it over 330-362, while the camera
 *   is still rising; on the site the compass holds the needle all through the rise, so the sink starts as the dive
 *   does, and ends where the lead begins.
 * - `lead`: it leads the dive to `depth` under the armillary, frames 376-424.
 * - `grow`: it grows to `scale` times its size, frames 400-442. The preview's runs on to 450, past the overview; here
 *   it is grown at the overview's stop.
 * - `offset`: at each project stop the needle stands at this offset from the bead's centre (come forward) and points
 *   at it: the preview's needle by Funcial, `NEEDLE_BY_FUNCIAL`, where its tip touches the bead's lacquer (p10).
 * - `aimLead`: on a glide the tip swings to the next bead within this share of the stretch, ahead of the needle's
 *   own move, so it points the way (spec §2.4: "scrolling further swings the needle to the next bead").
 * - `withdraw`: on a glide from one bead to the next the needle backs off up to this far along its own axis (away from
 *   the bead it points at, `offset`'s way) and comes in again at the next, so it never passes the bead it leaves
 *   nearer than it stood at the stop. The beads lie so that the straight line from one needle place to the next runs
 *   past the bead it leaves (from Jontai to Cookies within 2.1 m of Jontai's centre, the tip deep in its shell).
 */
export const NEEDLE_PATH = {
  pivot: NEEDLE_PIVOT,
  sink: { span: [0, diveShare(376)], depth: 1.0 },
  lead: { span: [diveShare(376), diveShare(424)], depth: 9.5 },
  grow: { span: [diveShare(400), 1], scale: 1.9 },
  offset: [
    NEEDLE_BY_FUNCIAL[0] - centreOf(0, 1)[0],
    NEEDLE_BY_FUNCIAL[1] - centreOf(0, 1)[1],
    NEEDLE_BY_FUNCIAL[2] - centreOf(0, 1)[2]
  ],
  aimLead: 0.6,
  withdraw: 2.0
} as const satisfies {
  pivot: Vec3;
  sink: { span: Span; depth: number };
  lead: { span: Span; depth: number };
  grow: { span: Span; scale: number };
  offset: Vec3;
  aimLead: number;
  withdraw: number;
};

/** The void's ceiling, the glass's underside at the foot of the tunnel (`GLASS_LOOK.well.bottom`, the preview's WELL_BOTTOM). */
export const VOID_CEILING = -1.2;

/**
 * The highest a camera in the void stands back to: 1 m under its ceiling. A narrow screen stands the void's shots back
 * along their view lines (`fieldFor`); the overview looks a little down, so standing back raises it, and on a phone the
 * whole of the width would put it above the glass. It stops here, where the ceiling is the top of the picture's sky.
 */
export const VOID_ROOF = VOID_CEILING - 1;

/** The top shot's height on a laptop (on a narrower screen the top shot stands higher, `topShotFor`). */
const TOP_D = FRAMES.top.distance;

/** The descent's height at `e` of it on a laptop: from the top shot's 12.6 to the bottom's -2.6. */
function laptopHeight(e: number): number {
  return mix(TOP_D, CAMERA_PATH.descent.bottom[1], e);
}

/** How far through the eased descent a laptop's camera reaches the glass: a narrower screen's extra height is shed by then. */
const GLASS_SHARE = TOP_D / (TOP_D - CAMERA_PATH.descent.bottom[1]);

/** The home's DIVE chapter, whose unit is the dive stretch. */
const DIVE_UNIT = HOME_CHAPTERS.units.find((unit) => unit.id === 'DIVE')!;

/**
 * The preview's frame of d01 (docs/design/bob-compass/d01-dive-tunnel.webp, Bob's approved frame of the dive: the M2b
 * preview's still m2b-0400.png, which it matches to a mean of 1 in 255 a pixel, against 26 to 28 for its frames 372 and
 * 442 and p08). The camera stands 3.1 above the glass on the opening's axis, looking straight down it, with the 38.8 mm
 * lens: the tunnel's lit wall is a warm ring round the frame (its foot, the dark opening onto the void, 0.79 of the
 * frame's half-width across; its mouth just past the width, the flattened rings in the corners) and the needle's disc is
 * in the middle.
 */
const D01_FRAME = 400;

/**
 * The progress at which the dive's camera stands at d01's pose, Bob's approved frame of the glowing tunnel: where the
 * scroll holds while the void loads (Task 11's `diveHoldFor`). It is the preview's frame `D01_FRAME` in the dive's own unit (`diveShare`, frames
 * 362-442), 1.475, at which the descent's eased share is the preview's own (`CAMERA_PATH.descent` keeps the preview's
 * frames and its `ease_io` is the same smoothstep), so a laptop's camera is `cam_pose(400)` itself. It is over the
 * opening, above the glass on every screen (a phone's, whose top shot stands higher, is 1.3 above a laptop's
 * here), so the void, hidden until the camera is under the glass, is never seen before it is ready: the view down the
 * opening stays dark, as d01's middle is. (From inside the well, whose wall is a cylinder of the opening's radius from
 * -0.08 to -1.2, no lens of the site's could see the wall glow: it would need more than 138 degrees.)
 */
export const TUNNEL_HOLD = DIVE_UNIT.start + DIVE_UNIT.length * diveShare(D01_FRAME);

/** The width of the preview's sensor, millimetres (Blender's default; the preview renders 16:9, fitted across). */
const SENSOR = 36;

const RAD = Math.PI / 180;

/** The horizontal field of view of a `mm` lens on the preview's camera, degrees: `2 atan(18 / mm)`. */
export function lensField(mm: number): number {
  return (2 * Math.atan(SENSOR / 2 / mm)) / RAD;
}

/**
 * A horizontal field of view `hfov` (degrees) on a screen of this aspect: the vertical `fov` that sees it, and how
 * many times its distance the camera stands back (`back`) so a narrow screen still sees the same width. It is
 * `shotFor`'s own rule, on a frame one unit off whose half-width is the field's: the vertical field is
 * `2 atan(tan(hfov / 2) / aspect)`, held at `MAX_VFOV`, past which the camera stands back to
 * `tan(hfov / 2) / (aspect tan(MAX_VFOV / 2))` times the distance; `back` is 1 where the field fits. A bad aspect reads
 * as 16:9 and one thinner than 0.25 as 0.25, as there.
 */
export function fieldFor(hfov: number, aspect: number): { fov: number; back: number } {
  const shot = shotFor({ distance: 1, elevation: 0, targetY: 0, halfWidth: Math.tan((hfov * RAD) / 2) }, aspect);
  return { fov: shot.fov, back: shot.position[2] };
}

/** A pose the camera passes through: the shot's numbers and the camera's turn, for gliding to the next. */
interface Key {
  position: Vec3;
  target: Vec3;
  fov: number;
  turn: Quat;
  distance: number;
}

const UP: Vec3 = [0, 1, 0];
const AHEAD: Vec3 = [0, 0, -1];
const DOWN_UP: Vec3 = [0, 0, -1];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalise(a: Vec3): Vec3 {
  const l = length(a);
  return l > 0 ? scale(a, 1 / l) : a;
}

function mix3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

/** The rotation whose matrix has the columns `x`, `y` and `z`, as a quaternion (three's `setFromRotationMatrix`). */
function turnOfBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  const [m11, m21, m31] = x;
  const [m12, m22, m32] = y;
  const [m13, m23, m33] = z;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s];
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    return [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s];
  }
  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    return [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s];
  }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
}

/** The turn of a camera at `eye` looking at `target` with `up` up, as three's `lookAt` makes it (it looks down its -Z). */
function lookTurn(eye: Vec3, target: Vec3, up: Vec3): Quat {
  let z = sub(eye, target);
  if (length(z) === 0) z = [0, 0, 1];
  z = normalise(z);
  let x = cross(up, z);
  if (length(x) === 0) {
    // `up` is along the view line: three nudges the view a hair off it.
    z = normalise(Math.abs(up[2]) === 1 ? [z[0] + 1e-4, z[1], z[2]] : [z[0], z[1], z[2] + 1e-4]);
    x = cross(up, z);
  }
  x = normalise(x);
  return turnOfBasis(x, cross(z, x), z);
}

/** `v` turned by `q` (three's `applyQuaternion`). */
function rotate(q: Quat, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [v[0] + qw * tx + qy * tz - qz * ty, v[1] + qw * ty + qz * tx - qx * tz, v[2] + qw * tz + qx * ty - qy * tx];
}

/** The turn `t` of the way from `a` to `b`, the shorter way round (three's `slerp`). */
function slerp(a: Quat, b: Quat, t: number): Quat {
  if (t <= 0) return a;
  if (t >= 1) return b;
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    [bx, by, bz, bw] = [-bx, -by, -bz, -bw];
    cos = -cos;
  }
  if (cos >= 1) return a;
  const sin2 = 1 - cos * cos;
  if (sin2 <= Number.EPSILON) {
    const q: Quat = [mix(a[0], bx, t), mix(a[1], by, t), mix(a[2], bz, t), mix(a[3], bw, t)];
    const l = Math.hypot(...q);
    return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
  }
  const sin = Math.sqrt(sin2);
  const half = Math.atan2(sin, cos);
  const ka = Math.sin((1 - t) * half) / sin;
  const kb = Math.sin(t * half) / sin;
  return [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb];
}

function keyOf(position: Vec3, target: Vec3, fov: number, up: Vec3): Key {
  return { position, target, fov, turn: lookTurn(position, target, up), distance: length(sub(position, target)) };
}

/**
 * The key for a shot in the void, from `position` looking at `target` through a `lens`, on a screen of this aspect:
 * the field as `fieldFor` gives it, and the camera stood back along its view line by `back` (the target stays, so the
 * fog's distance follows; ~/engine/bob/look `fogFor`), but never above `VOID_ROOF`. On a laptop it is the preview's
 * pose itself.
 */
function voidKey(position: Vec3, target: Vec3, lens: number, aspect: number): Key {
  const { fov, back } = fieldFor(lensField(lens), aspect);
  const rise = position[1] - target[1];
  const room = rise > 0 ? (VOID_ROOF - target[1]) / rise : Number.POSITIVE_INFINITY;
  const k = Math.max(1, Math.min(back, room));
  const at = k === 1 ? position : add(target, scale(sub(position, target), k));
  return keyOf(at, target, fov, UP);
}

/** The overview: all three beads in view. */
function overviewKey(aspect: number): Key {
  return voidKey(CAMERA_PATH.out.position, CAMERA_PATH.out.target, CAMERA_PATH.out.lens, aspect);
}

/** Bead `bead` seen close, come forward. */
function beadKey(bead: number, aspect: number): Key {
  const centre = centreOf(bead, 1);
  return voidKey(add(centre, CAMERA_PATH.bead.offset), centre, CAMERA_PATH.bead.lens, aspect);
}

/**
 * The bottom of the dive, just under the tunnel, looking straight down. Its field is the 32 mm lens's, held at
 * `MAX_VFOV` on a narrow screen; it does not stand back (above it is the tunnel), so a phone sees less across here.
 */
function bottomKey(aspect: number): Key {
  const { bottom, look, lens } = CAMERA_PATH.descent;
  return keyOf(bottom, [bottom[0], look, bottom[2]], fieldFor(lensField(lens), aspect).fov, DOWN_UP);
}

/** The shot a key is, at a stop. No parallax in the void: see `glide`. */
function shotOf(key: Key): CameraShot {
  return { position: key.position, target: key.target, fov: key.fov, up: rotate(key.turn, UP), sway: 0 };
}

/**
 * The shot `e` of the way from `a` to `b`, moved aside by `shift`: the position and the field in straight lines, the
 * turn the shorter way round, and the look-at point ahead of the camera at the distance between theirs. Its `up` is
 * the camera's own, and it has no parallax (`sway` 0): near straight down the Rig's orbit would swing the camera, and
 * in the void the selected bead's label stands beside the bead where the shot puts it.
 */
function glide(a: Key, b: Key, e: number, shift: Vec3): CameraShot {
  const turn = slerp(a.turn, b.turn, e);
  const position = add(mix3(a.position, b.position, e), shift);
  const target = add(position, scale(rotate(turn, AHEAD), mix(a.distance, b.distance, e)));
  return { position, target, fov: mix(a.fov, b.fov, e), up: rotate(turn, UP), sway: 0 };
}

/** How near a glide may pass a bead's centre: its radius (0.95) and a clear 1.55 m. */
const GLIDE_CLEARANCE = 2.5;

/** How many points of a glide `bendFor` checks. */
const BEND_SAMPLES = 48;

/** Where the beads are `e` of the way through a glide from bead `from` (null: the overview) to bead `to`. */
function beadsOnGlide(from: number | null, to: number, e: number): Vec3[] {
  return BEADS.map((_, bead) => centreOf(bead, bead === to ? e : bead === from ? 1 - e : 0));
}

const NO_BEND: Vec3 = [0, 0, 0];

/**
 * How far a glide from `a` to `b` (from bead `from`, null for the overview, to bead `to`) bends aside at its middle,
 * as a vector: the glide is moved `bend * sin(pi e)` at `e` of it, so it leaves and reaches its stops on its straight
 * line. It is none where the straight line passes every bead's centre at least GLIDE_CLEARANCE off, the beads drifting
 * as the glide moves them. Otherwise it bends away from the bead it passes nearest, along the line from that bead's
 * centre to the nearest point (up, where it runs through the centre), by the least that clears every bead at each of
 * BEND_SAMPLES points (at each, the least move along that way that puts the point the clearance off, over the sine
 * there), held so the camera never rises above `VOID_ROOF`.
 *
 * From Jontai to Cookies, on a laptop, the straight line runs 0.9 m from Funcial's centre, inside its shell, on its far
 * side: the glide bends up and away over it, about 2 m at its middle, and Funcial passes behind and under the camera. A
 * phone, standing further back, passes it 5.4 m off and does not bend.
 */
function bendFor(a: Vec3, b: Vec3, from: number | null, to: number): Vec3 {
  const samples: { at: Vec3; sine: number; beads: Vec3[] }[] = [];
  let nearest = GLIDE_CLEARANCE;
  let away: Vec3 = UP;
  for (let k = 1; k < BEND_SAMPLES; k++) {
    const e = k / BEND_SAMPLES;
    const sample = { at: mix3(a, b, e), sine: Math.sin(Math.PI * e), beads: beadsOnGlide(from, to, e) };
    samples.push(sample);
    for (const centre of sample.beads) {
      const v = sub(sample.at, centre);
      const d = length(v);
      if (d < nearest) {
        nearest = d;
        away = d > 1e-9 ? scale(v, 1 / d) : UP;
      }
    }
  }
  if (nearest >= GLIDE_CLEARANCE) return NO_BEND;
  let size = 0;
  let roof = Number.POSITIVE_INFINITY;
  for (const { at, sine, beads } of samples) {
    if (away[1] > 0) roof = Math.min(roof, (VOID_ROOF - at[1]) / (away[1] * sine));
    for (const centre of beads) {
      const v = sub(at, centre);
      const along = dot(v, away);
      const short = GLIDE_CLEARANCE * GLIDE_CLEARANCE - dot(v, v);
      if (short > 0) size = Math.max(size, (-along + Math.sqrt(along * along + short)) / sine);
    }
  }
  return scale(away, Math.max(0, Math.min(size, roof)));
}

/** The bends of the glides past the dive for the last screen shape asked: the overview's to Funcial, then each bead's to the next. */
let bends: { aspect: number; glides: Vec3[] } | null = null;

/**
 * The bends of the void's glides on a screen of this aspect (`bendFor`): index 0 is the overview's to Funcial, index
 * p + 1 bead p's to the next. They depend on the screen's shape alone, and `bendFor` checks a few dozen points, so they
 * are worked out once per shape, not on every frame; the pose is the same either way.
 */
function bendsFor(aspect: number): Vec3[] {
  if (bends === null || !Object.is(bends.aspect, aspect)) {
    const glides = [bendFor(overviewKey(aspect).position, beadKey(0, aspect).position, null, 0)];
    for (let p = 0; p < BEADS.length - 1; p++) glides.push(bendFor(beadKey(p, aspect).position, beadKey(p + 1, aspect).position, p, p + 1));
    bends = { aspect, glides };
  }
  return bends.glides;
}

/**
 * The descent at `local` of the dive stretch: straight down from the top shot, the height on the stretch's eased
 * share `e`, from 12.6 to -2.6 on a laptop. A narrower screen's top shot stands higher (it stands back to hold the
 * name across); that extra height is shed on a smoothstep of its own by the time a laptop's camera reaches the glass,
 * so from the glass down every screen's camera is at the same height. It looks at a point straight
 * below it, from the glass (the top shot's look-at point) down to the beads' depth, and its field opens from the top
 * shot's to the bottom's.
 */
function descentShot(local: number, aspect: number): CameraShot {
  const top = topShotFor(aspect);
  const e = smoothstep(through(local, CAMERA_PATH.descent.span));
  const extra = top.position[1] - TOP_D;
  const y = laptopHeight(e) + extra * (1 - smoothstep(e / GLASS_SHARE));
  const x = mix(top.position[0], 0, e);
  const z = mix(top.position[2], 0, e);
  return {
    position: [x, y, z],
    target: [x, mix(top.target[1], CAMERA_PATH.descent.look, e), z],
    fov: mix(top.fov, fieldFor(lensField(CAMERA_PATH.descent.lens), aspect).fov, e),
    up: DOWN_UP,
    sway: 0
  };
}

/** The camera at `local` of the dive stretch: the hold, the descent, then out of the tunnel to the overview. */
function diveShot(local: number, aspect: number): CameraShot {
  if (local <= CAMERA_PATH.hold[1]) return topShotFor(aspect);
  if (local <= CAMERA_PATH.descent.span[1]) return descentShot(local, aspect);
  return glide(bottomKey(aspect), overviewKey(aspect), smoothstep(through(local, CAMERA_PATH.out.span)), NO_BEND);
}

/** The needle's pivot at the overview: at the foot of its lead, straight under the compass. */
const NEEDLE_AT_OVERVIEW: Vec3 = [NEEDLE_PATH.pivot[0], NEEDLE_PATH.pivot[1] - NEEDLE_PATH.lead.depth, NEEDLE_PATH.pivot[2]];

/** How far ahead of the pivot the tip's aim point stands at a bead: the pivot's distance from the bead's centre. */
const AIM_REACH = length(NEEDLE_PATH.offset);

/** The way the needle backs off a bead: along its own axis, away from the bead's centre. */
const BACK_OFF = normalise(NEEDLE_PATH.offset);

/** The needle by bead `bead`, come forward. */
function needleBy(bead: number): Vec3 {
  return add(centreOf(bead, 1), NEEDLE_PATH.offset);
}

/** The needle at `local` of the dive stretch: it sinks, leads the camera down and grows, its tip straight down. */
function diveNeedle(local: number): NeedleOverride {
  const { pivot, sink, lead, grow } = NEEDLE_PATH;
  const sunk = mix(0, -sink.depth, smoothstep(through(local, sink.span)));
  const depth = mix(sunk, -lead.depth, smoothstep(through(local, lead.span)));
  return {
    position: [pivot[0], pivot[1] + depth, pivot[2]],
    scale: mix(1, grow.scale, smoothstep(through(local, grow.span))),
    aim: null
  };
}

/** How lit each bead is at the overview: all three alike, half way. */
const OVERVIEW_LIT = 0.5;

const NONE: readonly [number, number, number] = [0, 0, 0];

function each(f: (bead: number) => number): readonly [number, number, number] {
  return [f(0), f(1), f(2)];
}

/** The stretch each of the home's chapters is. */
const STRETCHES: Record<ChapterId, Stretch> = { HOME: 'rise', DIVE: 'dive', VOID_ENTRY: 'overview', PROJECTS: 'project', END: 'end' };

/** The index of the first PROJECTS unit: project p is unit FIRST_PROJECT + p. */
const FIRST_PROJECT = HOME_CHAPTERS.units.findIndex((unit) => unit.id === 'PROJECTS');

/** The last project, whose stretch holds its bead through the move into the night (the END unit follows it, so it is not the last unit). */
const LAST_PROJECT = HOME_CHAPTERS.units.filter((unit) => unit.id === 'PROJECTS').length - 1;

/** Where the scroll ends and the end page stands: the progress is held to it, so everything from here on is the end page. */
const END_AT = scrollEnd(HOME_CHAPTERS);

/** Within this much of a stop, the progress is on it, as `riseAt` has it: a sum's float residue is the stop. */
const SNAP = 1e-6;

const STOPS = stops(HOME_CHAPTERS);

/** The progress held to the scroll's range, 0 to its end (NaN reads as 0), and on a stop within SNAP of it. */
function settled(progress: number): number {
  const p = progress > 0 ? (progress < END_AT ? progress : END_AT) : 0;
  for (const stop of STOPS) if (Math.abs(p - stop) < SNAP) return stop;
  return p;
}

/**
 * A bead seen close, the project page's view of it: the camera `standOff` in front of the porthole, along
 * the bead's facing, with the `lens` of the beads' stops (40 mm).
 */
export const FOCUS_VIEW = { standOff: 1.6, lens: CAMERA_PATH.bead.lens } as const;

/** Which way a bead faces at rest: its porthole looks along its root's +z (~/engine/bob/build/beads), and its root is not turned. */
const FACING: Vec3 = [0, 0, 1];

/**
 * The close view of bead `id` on a screen of this aspect: beside the journey, not a stretch of it, it is the
 * view a project page stands over and the end of the flight into the porthole (./focus.ts). The bead is where it stands
 * at its stop, come forward (its centre plus `CAMERA_PATH.bead.forward`, as `journeyPoseAt` poses it there), and the
 * camera stands `FOCUS_VIEW.standOff` (1.6) in front of its porthole, the front of its shell, on the porthole's axis,
 * looking at the bead's centre: 2.55 from it. The field is the beads' 40 mm through `fieldFor`, as every shot in the void
 * has it (`voidKey`), so a phone keeps the same width across and stands back along the same axis (level with the bead,
 * nowhere near the void's roof). Unlike the journey's shots it lets the pointer's parallax in (`sway` 1), as the home
 * under a page of text has it: the page stands still over a bead that breathes with the pointer.
 */
export function focusShotFor(id: ProjectId, aspect: number): CameraShot {
  const bead = BEADS.findIndex((b) => b.id === id);
  const { radius } = BEADS[bead]!;
  const centre = centreOf(bead, 1);
  const key = voidKey(add(centre, scale(FACING, radius + FOCUS_VIEW.standOff)), centre, FOCUS_VIEW.lens, aspect);
  return { position: key.position, target: key.target, fov: key.fov, up: rotate(key.turn, UP), sway: 1 };
}

/**
 * Bead `bead` held at its stop, as the pose has it at the start of its stretch: the shot its close shot, the needle by
 * it pointing at its centre, the bead forward and lit and the others back and unlit, the void's light full. Every
 * project's stop is this, and the last project's stretch (the move into the night) and the end page hold it.
 */
function heldBead(bead: number, aspect: number): Pick<JourneyPose, 'shot' | 'needle' | 'forward' | 'lit' | 'beam' | 'mist'> {
  const forward = each((other) => (other === bead ? 1 : 0));
  const needle = { position: needleBy(bead), scale: NEEDLE_PATH.grow.scale, aim: centreOf(bead, 1) };
  return { shot: shotOf(beadKey(bead, aspect)), needle, forward, lit: forward, beam: 1, mist: 1 };
}

/**
 * The shot `e` of the way from `a` to `b` (0 is `a` and 1 is `b`, exactly): the camera, the look-at point and the field
 * in straight lines, the up between theirs (absent read as +Y) and the parallax between (absent read as the whole of
 * it). The flight into a porthole is this from the bead's stop to its close view, eased (./focus.ts): both look at the
 * bead's centre, so the line runs from in front of the bead straight to its porthole, never through its shell.
 */
export function shotToward(a: CameraShot, b: CameraShot, e: number): CameraShot {
  if (!(e > 0)) return a;
  if (e >= 1) return b;
  const up = normalise(mix3(a.up ?? UP, b.up ?? UP, e));
  return {
    position: mix3(a.position, b.position, e),
    target: mix3(a.target, b.target, e),
    fov: mix(a.fov, b.fov, e),
    up,
    sway: mix(a.sway ?? 1, b.sway ?? 1, e)
  };
}

/**
 * Where the journey is at this progress: the chapter it is in (~/state/chapters `chapterAt`, without hysteresis) as a
 * stretch, how far through it, and the project of a project stretch. A stop starts its stretch (1 is the dive at 0, 3
 * is Funcial's stretch at 0, 5 is Cookies' move into the night at 0); every project's stretch has its real `local`, the
 * last included (5.5 is half way into the night). 6 is the end page, the scroll's end: at 6 and above it is
 * `{ stretch: 'end', local: 0, project: null }`. NaN reads as 0, the progress is held to 0..6, and within 1e-6 of a stop
 * it is the stop.
 */
export function journeyAt(progress: number): JourneyAt {
  const chapter = chapterAt(HOME_CHAPTERS, settled(progress));
  const stretch = STRETCHES[chapter.id];
  if (stretch === 'end') return { stretch, local: 0, project: null };
  if (stretch !== 'project') return { stretch, local: chapter.local, project: null };
  return { stretch, local: chapter.local, project: chapter.index - FIRST_PROJECT };
}

/**
 * The journey's pose at this progress on a screen of this aspect (width over height). The progress reads as
 * `journeyAt` reads it.
 * - **The rise** (0-1) is M2a's: the shot is `scrollPoseAt(riseAt(progress), aspect).shot` itself, the beads are back
 *   and dim, the void dark, and the compass holds the needle.
 * - **The dive** (1-2): the top shot holds, then the descent and the way out to the overview (`diveShot`). The needle
 *   leaves the compass where it holds it, sinks, leads and grows (`diveNeedle`). The void's beam and mist rise from 0
 *   at its start to 1 at the overview, and the beads' light to half.
 * - **The overview** (2-3) glides to Funcial's shot. Funcial comes forward and lights up while the others dim. The
 *   needle comes up beside it, its tip swinging from straight down to the bead within `aimLead` of the stretch.
 * - **Each project** p (3 + p to 4 + p) glides from bead p's shot to the next's, bending round a bead in the way
 *   (`bendFor`); bead p drifts back and dims as the next comes forward and lights, and the needle backs off bead p,
 *   swings to the next bead ahead of its move and comes in to it. The last project's stretch (5-6) is no glide: it
 *   holds Cookies, the shot, the needle and the beads as at 5, and `night` rises on a smoothstep of it, 0 to 1: the
 *   move into the night.
 * - **The end page** (6) is Cookies held in the full night: its pose with `night` 1.
 * At a stop the shot is that stop's key shot exactly, the selected bead is forward and lit (1) and the others back and
 * unlit (0), and the needle stands by it, its aim the bead's centre. `night` is 0 everywhere before the last project's
 * stretch.
 */
export function journeyPoseAt(progress: number, aspect: number): JourneyPose {
  const p = settled(progress);
  const at = journeyAt(p);
  const rise = scrollPoseAt(riseAt(p), aspect);
  const { local } = at;

  if (at.stretch === 'rise') return { at, rise, shot: rise.shot, needle: null, forward: NONE, lit: NONE, beam: 0, mist: 0, night: 0 };

  if (at.stretch === 'dive') {
    const glow = smoothstep(local);
    const lit = OVERVIEW_LIT * glow;
    return { at, rise, shot: diveShot(local, aspect), needle: diveNeedle(local), forward: NONE, lit: [lit, lit, lit], beam: glow, mist: glow, night: 0 };
  }

  if (at.stretch === 'end') return { at, rise, ...heldBead(LAST_PROJECT, aspect), night: 1 };

  const e = smoothstep(local);
  const swing = smoothstep(through(local, [0, NEEDLE_PATH.aimLead]));

  if (at.stretch === 'overview') {
    const lit = each((bead) => mix(OVERVIEW_LIT, bead === 0 ? 1 : 0, e));
    const forward = each((bead) => (bead === 0 ? e : 0));
    const base = { at, rise, forward, lit, beam: 1, mist: 1, night: 0 };
    const over = overviewKey(aspect);
    if (local === 0) return { ...base, shot: shotOf(over), needle: { position: NEEDLE_AT_OVERVIEW, scale: NEEDLE_PATH.grow.scale, aim: null } };
    const first = beadKey(0, aspect);
    const shift = scale(bendsFor(aspect)[0]!, Math.sin(Math.PI * e));
    const position = mix3(NEEDLE_AT_OVERVIEW, needleBy(0), e);
    const aim = mix3(add(position, [0, -AIM_REACH, 0]), centreOf(0, e), swing);
    return { ...base, shot: glide(over, first, e, shift), needle: { position, scale: NEEDLE_PATH.grow.scale, aim } };
  }

  const from = at.project!;
  if (from === LAST_PROJECT) return { at, rise, ...heldBead(from, aspect), night: e };
  if (local === 0) return { at, rise, ...heldBead(from, aspect), night: 0 };
  const to = from + 1;
  const forward = each((bead) => (bead === from ? 1 - e : bead === to ? e : 0));
  const a = beadKey(from, aspect);
  const b = beadKey(to, aspect);
  const sine = Math.sin(Math.PI * e);
  const shift = scale(bendsFor(aspect)[from + 1]!, sine);
  const position = add(mix3(needleBy(from), needleBy(to), e), scale(BACK_OFF, NEEDLE_PATH.withdraw * sine));
  const aim = mix3(centreOf(from, 1 - e), centreOf(to, e), swing);
  return { at, rise, shot: glide(a, b, e, shift), needle: { position, scale: NEEDLE_PATH.grow.scale, aim }, forward, lit: forward, beam: 1, mist: 1, night: 0 };
}
