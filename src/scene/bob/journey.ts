/**
 * The home's journey as plain numbers: from the scroll's progress (in the chapters' units) to where the camera stands,
 * where the light and its fact are, the void's state, the light's path through the projects, and how far the sheet over
 * the look back has come up. Pure, as the rise's pose is (./scrollPose): it imports nothing from React or three and
 * remembers no frame, so the tests read the very pose the scene applies, and a progress sought to a value poses the
 * scene as the scroll did there.
 *
 * The stretches are the home's chapters (~/state/chapters; spec 2026-10-27-bob-light-path-design.md):
 * - the rise, 0-1: M2a's pose itself (`scrollPoseAt(riseAt(progress))`), the home at 0 to BOB from above at 1;
 * - the light dive: the way's frames 1 to `HAND_F` of the previs (./lightDive.ts), linearly: the needle lights up into
 *   the light, which flows away through the void past Bob's five facts;
 * - the world's path (./worldPath.ts), from the hand-over: the light landing in the CPU and the whole world, each area,
 *   the look back, then the sheet, the look back fading to black as the credits rise over it;
 * - the end, the scroll's last stop: the credits at rest, HTML over the scene (the scene sleeps behind it).
 * Within 1e-6 of a stop the progress is the stop, as `riseAt` has it, so a sum's float residue never leaves it a hair off.
 */
import type { ProjectId } from '~/data/projects';
import { type CameraShot, shotFor } from '~/engine/bob/shots';
import { areasOnPath, chapterAt, frameOfPlace, HOME_CHAPTERS, pathStart, lookStop, riseTop, scrollEnd, stops } from '~/state/chapters';
import { type FactAt, factAt, filamentsAt, lightAt, sparksAt, streamAt, trailAt, trailLevel, voidAt, wayNeedle, wayShot } from './lightDive';
import { type WorldFrame, worldPathFor } from './worldPath';
import type { LightPose, VoidPose } from './poseTypes';
import { riseAt, type ScrollPose, scrollPoseAt, smoothstep } from './scrollPose';

export { shotToward } from '~/engine/bob/shots';
export type { LightPose, VoidPose } from './poseTypes';

type Vec3 = readonly [number, number, number];

/** A stretch of the journey: one of the home's chapters, seen as the camera's move. */
export type Stretch = 'rise' | 'light' | 'land' | 'area' | 'look' | 'sheet' | 'end';

/**
 * Where the journey is: the stretch and how far through it (`local`, 0 at its start); in the light dive the way's frame
 * (1 to `HAND_F`); and in an area its place among the areas (0 for the first), else null.
 */
export interface JourneyAt {
  stretch: Stretch;
  local: number;
  frame: number | null;
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
 * - `at`: where it is, as `journeyAt` reads it;
 * - `rise`: M2a's scroll pose for the compass, the letters and the iris (the top, `u` 1, from the light dive on);
 * - `shot`: the camera;
 * - `ignite`: how far the compass's needle has given itself to the light, 0..1 (0 on the rise, 1 from the way's frame 8);
 * - `light`: the light, null on the rise;
 * - `fact`: Bob's fact riding with it, null where there is none;
 * - `needle`: null while the compass holds it and from then on: the light stays the light to the end;
 * - `void`: the void's state, null on the rise;
 * - `path`: the world's path at this place (./worldPath.ts), null before the hand-over;
 * - `sheet`: how far the sheet over the look back has come, 0..1 (its first 0.55 the black, the rest the credits rising).
 */
export interface JourneyPose {
  at: JourneyAt;
  rise: ScrollPose;
  shot: CameraShot;
  ignite: number;
  light: LightPose | null;
  fact: FactAt | null;
  needle: NeedleOverride | null;
  void: VoidPose | null;
  path: WorldFrame | null;
  sheet: number;
}

/** The projects on the world, in its areas' order (01 Beveiligd element, 02 Frontpaneel, 03 Oscillator). */
export const WORLD_PROJECTS: readonly ProjectId[] = areasOnPath().flatMap((area) => area.projects);

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

/**
 * The view project `id` stands open in, on a screen of this aspect (spec 2026-10-28-bob-quantum-stack-design.md, goal
 * 5): its board's stop, where the camera turns back to when it closes, and where its project page reached directly
 * stands, the project in the spot (./focus.ts). A click opens it where the camera stands, which stays. A project not on
 * the stack has the look back's shot.
 */
export function focusShotFor(id: ProjectId, aspect: number): CameraShot {
  const path = worldPathFor(aspect);
  const board = path.places.slice(1).findIndex((b) => b.sockets.some((s) => s.id === id));
  return board < 0 ? path.lookShot : path.areaShot(board);
}

const PATH_AT = pathStart(HOME_CHAPTERS);
const SHEET_AT = lookStop(HOME_CHAPTERS);
const RISE_TOP = riseTop(HOME_CHAPTERS);
const END_AT = scrollEnd(HOME_CHAPTERS);
/** Within this much of a stop, the progress is on it, as `riseAt` has it: a sum's float residue is the stop. */
const SNAP = 1e-6;
const STOPS = stops(HOME_CHAPTERS);
/** The last way frame of the fall's last fact (fact 05's 221-260): past the hand-over it runs out at the fall's own pace. */
const LAST_FACT_F = 260;

/** The progress held to the scroll's range, 0 to its end (NaN reads as 0), and on a stop within SNAP of it. */
function settled(progress: number): number {
  const p = progress > 0 ? (progress < END_AT ? progress : END_AT) : 0;
  for (const stop of STOPS) if (Math.abs(p - stop) < SNAP) return stop;
  return p;
}

const STRETCHES = { LAND: 'land', AREA: 'area', LOOK: 'look', QA: 'sheet', END: 'end' } as const;

/**
 * Where the journey is at this progress (the module's doc lists the stretches). NaN reads as 0, the progress is held to
 * the scroll's range, and within 1e-6 of a stop it is the stop.
 */
export function journeyAt(progress: number): JourneyAt {
  const p = settled(progress);
  const chapter = chapterAt(HOME_CHAPTERS, p);
  switch (chapter.id) {
    case 'HOME':
      return { stretch: 'rise', local: chapter.local, frame: null, project: null };
    case 'LIGHT':
      return { stretch: 'light', local: chapter.local, frame: frameOfPlace(p), project: null };
    case 'END':
      return { stretch: 'end', local: 0, frame: null, project: null };
    default:
      return { stretch: STRETCHES[chapter.id], local: chapter.local, frame: null, project: chapter.project };
  }
}

/**
 * The journey's pose at this progress on a screen of this aspect (width over height). The progress reads as `journeyAt`
 * reads it. On the rise it is M2a's; in the light dive the way's frame of the previs (./lightDive.ts); from the hand-over
 * the light's path (./worldPath.ts), with the fall's last fact running out across the hand-over at the fall's own pace.
 */
export function journeyPoseAt(progress: number, aspect: number): JourneyPose {
  const p = settled(progress);
  const at = journeyAt(p);
  const rise = scrollPoseAt(riseAt(p), aspect);
  if (at.stretch === 'rise' || p <= RISE_TOP) {
    return { at, rise, shot: rise.shot, ignite: 0, light: null, fact: null, needle: null, void: null, path: null, sheet: 0 };
  }
  if (at.stretch === 'light') {
    const f = at.frame!;
    const light = lightAt(f, aspect);
    return {
      at,
      rise,
      shot: wayShot(f, aspect),
      ignite: smoothstep(Math.min(Math.max((f - 2) / 6, 0), 1)),
      light: { ...light, trail: trailAt(f, aspect), trailLevel: trailLevel(f), filaments: filamentsAt(f), sparks: sparksAt(f) },
      fact: factAt(f),
      needle: wayNeedle(f),
      void: { ...voidAt(f, aspect), stream: streamAt(f) },
      path: null,
      sheet: 0
    };
  }
  const path = worldPathFor(aspect).frameAt(p - PATH_AT);
  // Fact 05 is still up at the hand-over: it runs out at the fall's own pace rather than being cut.
  const f = frameOfPlace(p);
  const fact = at.stretch === 'land' && f <= LAST_FACT_F ? factAt(f) : null;
  return {
    at,
    rise,
    shot: path.shot,
    ignite: 1,
    light: path.light,
    fact,
    needle: null,
    void: path.void,
    path,
    sheet: at.stretch === 'sheet' ? p - SHEET_AT : at.stretch === 'end' ? 1 : 0
  };
}

