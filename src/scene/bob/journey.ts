/**
 * The home's journey as plain numbers: from the scroll's progress (0 to 7, in the chapters' units) to where the camera
 * stands, where the light, its fact and the needle are, where each bead stands round the ring and how lit it is, the
 * void's state, and how far the end page has slid up. Pure, as the rise's pose is (./scrollPose): it imports nothing from
 * React or three and remembers no frame, so the tests read the very pose the scene applies, and a progress sought to a
 * value poses the scene as the scroll did there.
 *
 * The stretches are the home's chapters (~/state/chapters; spec 2026-10-25-bob-light-dive-design.md):
 * - the rise, 0-1: M2a's pose itself (`scrollPoseAt(riseAt(progress))`), the home at 0 to BOB from above at 1;
 * - the light dive, 1-4: the way's frames 1 to 300 of the previs (./lightDive.ts), linearly: the needle lights up into
 *   the light, which flows away through the void past Bob's five facts and lands as the needle at the ring's centre;
 * - the ring, 4-6: the camera round the ring of projects, 120 degrees a unit, exactly with the scroll: Funcial in front
 *   at 4, Jontai Energy at 5, Cookies Clicker at 6;
 * - the sheet, 6-7: Cookies Clicker held while the end page slides up from below, `sheet` 0 to 1;
 * - the end page, 7: the scroll's end; the page is HTML over the scene (the scene sleeps behind it).
 * Within 1e-6 of a stop the progress is the stop, as `riseAt` has it, so a sum's float residue never leaves it a hair off.
 */
import type { CategoryId } from '~/data/categories';
import type { ProjectId } from '~/data/projects';
import { type CameraShot, shotFor } from '~/engine/bob/shots';
import { chapterAt, HOME_CHAPTERS, LIGHT_UNITS, lightStart, ringStart, riseTop, scrollEnd, sheetStart, stops } from '~/state/chapters';
import {
  type BeadAt,
  BEADS_IN,
  beadRest,
  beadsAt,
  type FactAt,
  factAt,
  type FilamentAt,
  filamentsAt,
  type LightAt,
  lightAt,
  ringBeads,
  ringNeedle,
  ringShot,
  streamAt,
  type TrailPoint,
  trailAt,
  trailLevel,
  type VoidAt,
  voidAt,
  wayNeedle,
  wayShot
} from './lightDive';
import { riseAt, type ScrollPose, scrollPoseAt, smoothstep } from './scrollPose';

type Vec3 = readonly [number, number, number];

/** A stretch of the journey: one of the home's chapters, seen as the camera's move. */
export type Stretch = 'rise' | 'light' | 'ring' | 'sheet' | 'end';

/**
 * Where the journey is: the stretch and how far through it (`local`, 0 at its start); in the light dive the way's frame
 * (1 to 300); in the ring, the sheet and the end the ring's angle (degrees, 0 Funcial in front, 240 Cookies Clicker);
 * and the project in front (0, 1 or 2, in category order) where the ring's angle is within PROJECT_NEAR of a project's,
 * else null (and null at the end page).
 */
export interface JourneyAt {
  stretch: Stretch;
  local: number;
  frame: number | null;
  angle: number | null;
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

/** The light with what is drawn of it: its trail's points and level, and its filaments. */
export interface LightPose extends LightAt {
  trail: TrailPoint[];
  trailLevel: number;
  filaments: FilamentAt[];
}

/** The void's state, with how far it has streamed toward the camera (m). */
export interface VoidPose extends VoidAt {
  stream: number;
}

/**
 * One moment of the journey:
 * - `at`: where it is, as `journeyAt` reads it;
 * - `rise`: M2a's scroll pose for the compass, the letters and the iris (the top, `u` 1, from the light dive on);
 * - `shot`: the camera;
 * - `ignite`: how far the compass's needle has given itself to the light, 0..1 (0 on the rise, 1 from the way's frame 8);
 * - `light`: the light, null outside the light dive;
 * - `fact`: Bob's fact riding with it, null outside the light dive;
 * - `needle`: null while the compass holds it (the rise and the light dive until the light becomes it), else where it is;
 * - `beads`: each bead's place, facing, light and whether it is in the scene, in category order; null until the beads
 *   rise into view in the landing;
 * - `void`: the void's state, null on the rise;
 * - `sheet`: how far the end page has slid up over the ring, 0..1.
 */
export interface JourneyPose {
  at: JourneyAt;
  rise: ScrollPose;
  shot: CameraShot;
  ignite: number;
  light: LightPose | null;
  fact: FactAt | null;
  needle: NeedleOverride | null;
  beads: readonly BeadAt[] | null;
  void: VoidPose | null;
  sheet: number;
}

/** One bead: its project and category, its centre at rest round the ring (three's world coordinates) and its radius. */
export interface Bead {
  id: ProjectId;
  category: CategoryId;
  centre: Vec3;
  radius: number;
}

/** The degrees between projects round the ring. */
const SPACING = 120;

/** How near a project's angle the ring stands for that project to be the one in front (its label, its door). */
export const PROJECT_NEAR = 20;

/**
 * The beads, in category order (01 Secure element, 02 Front panel, 03 Oscillator), at their rest places round the ring
 * (./lightDive.ts `RING_BEADS`: 0, 120 and 240 degrees). Radius 0.95, the shell.
 */
export const BEADS = [
  { id: 'funcial', category: 'secure-element', centre: beadRest(0), radius: 0.95 },
  { id: 'jontai-energy', category: 'front-panel', centre: beadRest(SPACING), radius: 0.95 },
  { id: 'cookies-clicker', category: 'oscillator', centre: beadRest(2 * SPACING), radius: 0.95 }
] as const satisfies readonly Bead[];

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

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/**
 * A bead seen close, the project page's view of it: the camera `standOff` in front of the porthole, along the line from
 * the bead to the camera at its ring stop (the porthole faces that camera), with the `lens` of a close view (40 mm).
 */
export const FOCUS_VIEW = { standOff: 1.6, lens: 40 } as const;

/**
 * The close view of bead `id` on a screen of this aspect: beside the journey, not a stretch of it, it is the view a
 * project page stands over and the end of the flight into the porthole (./focus.ts). The camera stands
 * `FOCUS_VIEW.standOff` in front of the porthole, the front of the shell, on the line from the bead's centre to the ring
 * camera at the bead's stop, looking at the centre: 2.55 from it. The field is the 40 mm's through `fieldFor`, so a
 * phone keeps the same width across and stands back along the same line. It lets the pointer's parallax in (`sway` 1),
 * as a page of text over the home has it.
 */
export function focusShotFor(id: ProjectId, aspect: number): CameraShot {
  const bead = BEADS.findIndex((b) => b.id === id);
  const { centre, radius } = BEADS[bead]!;
  const toward = unit(sub(ringShot(SPACING * bead, aspect).position, centre));
  const { fov, back } = fieldFor(lensField(FOCUS_VIEW.lens), aspect);
  return { position: add(centre, scale(toward, (radius + FOCUS_VIEW.standOff) * back)), target: centre, fov, up: [0, 1, 0], sway: 1 };
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
  const up = unit(mix3(a.up ?? [0, 1, 0], b.up ?? [0, 1, 0], e));
  return {
    position: mix3(a.position, b.position, e),
    target: mix3(a.target, b.target, e),
    fov: mix(a.fov, b.fov, e),
    up,
    sway: mix(a.sway ?? 1, b.sway ?? 1, e)
  };
}

const LIGHT_AT = lightStart(HOME_CHAPTERS);
const RING_AT = ringStart(HOME_CHAPTERS);
const SHEET_AT = sheetStart(HOME_CHAPTERS);
const RISE_TOP = riseTop(HOME_CHAPTERS);
const END_AT = scrollEnd(HOME_CHAPTERS);
/** The ring's last angle: the last project's, where the sheet and the end page hold it. */
const LAST_ANGLE = SPACING * (BEADS.length - 1);
/** Within this much of a stop, the progress is on it, as `riseAt` has it: a sum's float residue is the stop. */
const SNAP = 1e-6;
const STOPS = stops(HOME_CHAPTERS);

/** The progress held to the scroll's range, 0 to its end (NaN reads as 0), and on a stop within SNAP of it. */
function settled(progress: number): number {
  const p = progress > 0 ? (progress < END_AT ? progress : END_AT) : 0;
  for (const stop of STOPS) if (Math.abs(p - stop) < SNAP) return stop;
  return p;
}

/** The project in front at ring angle `angle`: the nearest, within PROJECT_NEAR, else null. */
function projectAt(angle: number): number | null {
  const k = Math.round(angle / SPACING);
  return Math.abs(angle - SPACING * k) <= PROJECT_NEAR ? k : null;
}

/**
 * Where the journey is at this progress (the module's doc lists the stretches). NaN reads as 0, the progress is held to
 * 0..7, and within 1e-6 of a stop it is the stop.
 */
export function journeyAt(progress: number): JourneyAt {
  const p = settled(progress);
  const chapter = chapterAt(HOME_CHAPTERS, p);
  switch (chapter.id) {
    case 'HOME':
      return { stretch: 'rise', local: chapter.local, frame: null, angle: null, project: null };
    case 'LIGHT':
      return { stretch: 'light', local: chapter.local, frame: 1 + ((p - LIGHT_AT) / LIGHT_UNITS) * 299, angle: null, project: null };
    case 'RING': {
      const angle = SPACING * (p - RING_AT);
      return { stretch: 'ring', local: chapter.local, frame: null, angle, project: projectAt(angle) };
    }
    case 'SHEET':
      return { stretch: 'sheet', local: chapter.local, frame: null, angle: LAST_ANGLE, project: BEADS.length - 1 };
    case 'END':
      return { stretch: 'end', local: 0, frame: null, angle: LAST_ANGLE, project: null };
  }
}

/**
 * The journey's pose at this progress on a screen of this aspect (width over height). The progress reads as `journeyAt`
 * reads it. On the rise it is M2a's; in the light dive the way's frame of the previs (./lightDive.ts); round the ring
 * the camera `angle` round, the beads in their places, the needle at the centre pointing at the bead the camera faces;
 * on the sheet and at the end Cookies Clicker held, the end page `sheet` of the way up.
 */
export function journeyPoseAt(progress: number, aspect: number): JourneyPose {
  const p = settled(progress);
  const at = journeyAt(p);
  const rise = scrollPoseAt(riseAt(p), aspect);
  if (at.stretch === 'rise' || p <= RISE_TOP) {
    return { at, rise, shot: rise.shot, ignite: 0, light: null, fact: null, needle: null, beads: null, void: null, sheet: 0 };
  }
  if (at.stretch === 'light') {
    const f = at.frame!;
    const light = lightAt(f, aspect);
    return {
      at,
      rise,
      shot: wayShot(f, aspect),
      ignite: smoothstep(Math.min(Math.max((f - 2) / 6, 0), 1)),
      light: { ...light, trail: trailAt(f, aspect), trailLevel: trailLevel(f), filaments: filamentsAt(f) },
      fact: factAt(f),
      needle: wayNeedle(f),
      beads: f >= BEADS_IN ? beadsAt(f, aspect) : null,
      void: { ...voidAt(f, aspect), stream: streamAt(f) },
      sheet: 0
    };
  }
  const angle = at.angle!;
  return {
    at,
    rise,
    shot: ringShot(angle, aspect),
    ignite: 1,
    light: null,
    fact: null,
    needle: ringNeedle(angle),
    beads: ringBeads(angle, aspect),
    void: { ...voidAt(300, aspect), stream: streamAt(300) },
    sheet: at.stretch === 'sheet' ? p - SHEET_AT : at.stretch === 'end' ? 1 : 0
  };
}
