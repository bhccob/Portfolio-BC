/**
 * The hologram world's path, as plain numbers (spec 2026-10-27-bob-hologram-world-design.md; after the mock-up Bob
 * approved, .superpowers/holo-world-mockup/main.ts): from the place on the home's scroll past the path's start (`q`, in
 * units) to the camera, the light, the void, the board's power, each project's light and the words. Pure, as the journey
 * is (./journey.ts): it imports nothing from React or three and remembers no frame, so the same place is the same
 * picture, and the tests read the very pose the scene applies.
 *
 * After the light dive hands the light over at way frame `HAND_F`:
 * - LAND: the light falls on, straight down into the CPU's lid by `LAND_HIT` (carrying the fall's speed in, quickening),
 *   a flash there; the board powers from the middle out over `POWER`, each project coming in over its last third; the
 *   light stays on the lid, its trail standing above it as a still column; the camera comes down out of the fall to look
 *   at the light coming in, then settles on the whole world by `LAND_STOP`, where the names come in;
 * - AREA, one per area of the world: the camera goes round the board (./around.ts), never across it, to the area by
 *   `AREA_STOP`, its projects in focus and the others quieter, its caption in;
 * - LOOK: round and back and up, the whole world small in the nebula;
 * - SHEET: the look back fading to black over its first 0.55, the credits rising (the end page, src/ui/EndPage.tsx).
 *
 * The camera's places are the mock-up's (its `poseFor`), round the board's centre and by the screen's shape; where the
 * mock-up moved the picture with a view offset, the shot looks a little aside instead (`aside`), as the site's shots
 * carry no offset.
 */
import type { ProjectId } from '~/data/projects';
import { type CameraShot, shotToward } from '~/engine/bob/shots';
import { AREA_STOP, type Chapters, HAND_F, HOME_CHAPTERS, LAND_STOP, pathStart, sheetStart, worldStop } from '~/state/chapters';
import { aroundShot } from './around';
import { filamentsAt, lightAt, sizeFor, sparksAt, streamAt, trailAt, trailLevel, voidAt, wayShot } from './lightDive';
import type { LightPose, VoidPose } from './poseTypes';
import { type AreaPlace, BOARD, boardCentre, LID_TOP, OBJECT_MIDDLE, objectKind, worldPlaces } from './worldLayout';

export type Vec3 = [number, number, number];
type R3 = readonly [number, number, number];

const DEG = Math.PI / 180;
const add = (a: R3, b: R3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: R3, b: R3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: R3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
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
const hermite = (p0: number, m0: number, p1: number, m1: number, t: number): number =>
  (2 * t ** 3 - 3 * t ** 2 + 1) * p0 + (t ** 3 - 2 * t ** 2 + t) * m0 + (3 * t ** 2 - 2 * t ** 3) * p1 + (t ** 3 - t ** 2) * m1;

/** Where in the land the light hits the CPU's lid. */
export const LAND_HIT = 0.35;
/** The board's power comes on over this stretch of the land, from the middle out. */
export const POWER = [0.35, 0.75] as const;
/** The flash on the lid is gone by here. */
const FLASH_GONE = 0.5;
/** Each project comes in over the power's last third. */
const PROJECTS_IN = POWER[0] + ((POWER[1] - POWER[0]) * 2) / 3;
/** The names come in from here to the world's stop. */
const NAMES_IN = 0.75;
/** An area's caption comes in from here to its stop; the last stop's words go over a unit's first `OUT`. */
const CAPTION_IN = 0.55;
const OUT = 0.2;
/** The look back's camera is there by this share of the look. */
const LOOK_AT = 0.9;
/** The light's trail at rest: a column this tall, m, in this many points. */
const COLUMN = { height: 26, points: 40 } as const;
/** The sheet's fade to black takes its first this much. */
const BLACK = 0.55;
/** The filaments' crawl: way frames of their shapes a unit of scroll. */
const FIL_RATE = 16;
/** The way's frames a unit of scroll in the fall (its 299 frames over 6 units). */
const FRAMES_PER_UNIT = 299 / 6;

/** A project's light at each stop: shown; in its area's focus; the others while an area is in focus. */
const LEVEL = { shown: 1, focus: 1.1, aside: 0.5 } as const;

export type WorldPart = 'land' | 'area' | 'look' | 'sheet';

/** One moment of the world's path. */
export interface WorldFrame {
  part: WorldPart;
  /** The area's place in an AREA; -1 elsewhere. */
  index: number;
  /** How far through the part, 0..1 (over the sheet, its share). */
  t: number;
  shot: CameraShot;
  light: LightPose;
  void: VoidPose;
  /** The board's power, 0..1. */
  power: number;
  /** The light's hit on the CPU, 0..1. */
  flash: number;
  /** Each project's light: 0 not yet in, 1 shown, more in its area's focus, less while another area is. */
  levels: Record<ProjectId, number>;
  /** The projects' names on the whole world, 0..1. */
  names: number;
  /** An area's words at the bottom left: which area and how much. */
  caption: { index: number; opacity: number } | null;
  /** The dots of the areas, 0..1. */
  dots: number;
  /** Whether the skip button shows: from the world's stop through the look back's. */
  skip: boolean;
  /** The fade to black, 0..1. */
  black: number;
  fog: { near: number; far: number };
  /** Whether the glass sky above shows: not in the look back, which looks up toward it, nor in the black. */
  sky: boolean;
}

export interface WorldPath {
  places: AreaPlace[];
  /** The projects on the world, in the areas' order. */
  projects: ProjectId[];
  centre: Vec3;
  /** The camera at the world's stop, at each area's, at the look back's, and over each project opened. */
  worldShot: CameraShot;
  areaShot(index: number): CameraShot;
  lookShot: CameraShot;
  openShot(id: ProjectId): CameraShot;
  /** Every view's camera and what it looks at (the land's, the stops', the open views'): the clouds stay out of them. */
  sights: [Vec3, Vec3][];
  /** The world's path at `q` units past its start. */
  frameAt(q: number): WorldFrame;
}

/** A stretch of the path on its own axis: a chapter unit's part, its area's place, and where it starts and ends. */
interface Segment {
  kind: WorldPart;
  i: number;
  a: number;
  b: number;
  length: number;
}

const PARTS: Readonly<Record<string, WorldPart>> = { LAND: 'land', AREA: 'area', LOOK: 'look', SHEET: 'sheet' };

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
 * A shot from `position` at `target`, its picture moved right and up by the shares `shift` of its width and height (the
 * mock-up's view offset): the camera looks that much the other way instead.
 */
function aside(position: Vec3, target: Vec3, fov: number, shift: readonly [number, number], aspect: number): CameraShot {
  const forward = norm(sub(target, position));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = len(sub(target, position));
  const tanV = Math.tan((fov * DEG) / 2);
  const moved = add(target, add(mul(right, -2 * shift[0] * d * tanV * aspect), mul(up, -2 * shift[1] * d * tanV)));
  return { position, target: moved, fov, up: [0, 1, 0], sway: 0 };
}

/** The world's path on a screen of this aspect, over the chapters `c`. */
export function makeWorldPath(aspect: number, c: Chapters = HOME_CHAPTERS): WorldPath {
  const phone = sizeFor(aspect) === 'phone';
  const SEGMENTS = segmentsOf(c);
  const segmentAt = (q: number): { s: Segment; t: number } => {
    for (const s of SEGMENTS) if (q < s.b) return { s, t: clamp01((q - s.a) / s.length) };
    return { s: SEGMENTS[SEGMENTS.length - 1]!, t: 1 };
  };
  const START = pathStart(c);
  const areaUnits = c.units.filter((u) => u.id === 'AREA');
  const places = worldPlaces(areaUnits.map((u) => ({ category: u.category as AreaPlace['category'], projects: [...(u.projects ?? [])] })));
  const projectIds = places.flatMap((a) => a.projects.map((p) => p.id));
  const count = places.length;
  const C = boardCentre();
  const UP: Vec3 = [0, 1, 0];
  const lid: Vec3 = add(C, [0, LID_TOP, 0]);

  // The cameras. The mock-up's fields: 40° tall on a laptop, 60° on a phone, and its places by the screen's width.
  const vfov = phone ? 60 : 40;
  const half = Math.atan(Math.tan((vfov * DEG) / 2) * aspect);
  const around = (target: Vec3, elevation: number, d: number): Vec3 => add(target, [0, Math.sin(elevation * DEG) * d, Math.cos(elevation * DEG) * d]);
  const worldTarget = add(C, phone ? [0, -0.3, 0.2] : [0, -0.2, 0.15]);
  const worldShot: CameraShot = { position: around(worldTarget, phone ? 50 : 34, (phone ? 3.75 : 6.6) / Math.tan(half)), target: worldTarget, fov: vfov, up: UP, sway: 0 };
  const landShot: CameraShot = phone
    ? { position: add(C, [0, 3.2, 14]), target: add(C, [0, 4.6, 0]), fov: 64, up: UP, sway: 0 }
    : { position: add(C, [0, 2.6, 11.5]), target: add(C, [0, 3.4, 0]), fov: 46, up: UP, sway: 0 };
  const lookTarget = add(C, [0, 0.6, 0]);
  const lookShot: CameraShot = { position: around(lookTarget, 30, phone ? 36 : 25), target: lookTarget, fov: vfov, up: UP, sway: 0 };
  const objectMiddle = (id: ProjectId, pad: R3): Vec3 => add(pad, [0, BOARD.hover + OBJECT_MIDDLE[objectKind(id)], 0]);
  const areaShots = places.map((area): CameraShot => {
    const n = area.projects.length;
    const target = mul(
      area.projects.reduce<Vec3>((sum, p) => add(sum, objectMiddle(p.id, p.pad)), [0, 0, 0]),
      1 / Math.max(1, n)
    );
    const out = norm(sub([area.centre[0], C[1], area.centre[2]], C));
    const right: Vec3 = [out[2], 0, -out[0]];
    const extra = (n - 1) * 0.9;
    const position = add(target, add(mul(out, (phone ? 4.2 : 3.5) + extra), add(mul(right, phone ? 1.3 : 1.9), mul(UP, phone ? 2.5 : 1.05))));
    return aside(position, target, phone ? 56 : 38, phone ? [0, 0.1] : [-0.16, 0.06], aspect);
  });
  const openShot = (id: ProjectId): CameraShot => {
    const pad = places.flatMap((a) => a.projects).find((p) => p.id === id);
    if (!pad) return { ...lookShot, sway: 1 };
    const centre = objectMiddle(id, pad.pad);
    const right: Vec3 = [pad.out[2], 0, -pad.out[0]];
    const position = add(centre, add(mul(pad.out, phone ? 2.1 : 1.5), add(mul(right, phone ? 1.3 : 1.5), mul(UP, phone ? 3.75 : 1.8))));
    // The pointer's parallax in, as the home under a page has it.
    return { ...aside(position, centre, phone ? 50 : 36, phone ? [0, 0.23] : [0.16, 0], aspect), sway: 1 };
  };
  const stopShot = (i: number): CameraShot => (i < 0 ? worldShot : areaShots[i]!);

  // The light: from the hand-over straight down onto the lid, carrying the fall's speed in and quickening to the hit.
  const hand = lightAt(HAND_F, aspect);
  const handBefore = lightAt(HAND_F - 1, aspect).position;
  const landUnit = SEGMENTS.find((s) => s.kind === 'land')!;
  const fallSpeed = (hand.position[1] - handBefore[1]) * FRAMES_PER_UNIT * LAND_HIT * landUnit.length;
  const handShot = wayShot(HAND_F, aspect);
  /** How far the fall's own trail reaches above the light at the hand-over: the column grows from it. */
  const fallHeight = Math.max(0, (trailAt(HAND_F, aspect).at(-1)?.point[1] ?? hand.position[1]) - hand.position[1]);
  const lightPos = (part: WorldPart, t: number): Vec3 => {
    if (part !== 'land' || t >= LAND_HIT) return lid;
    const k = t / LAND_HIT;
    const y = hermite(hand.position[1], fallSpeed, lid[1], (lid[1] - hand.position[1]) * 2, k);
    const side = 1 - ease(k);
    return [lerp(lid[0], hand.position[0], side), y, lerp(lid[2], hand.position[2], side)];
  };

  /** Each project's light at rest at a stop: all shown at the world and the look back; an area's in focus, the rest aside. */
  const levelsAt = (stop: number): Record<ProjectId, number> => {
    const area = stop >= 0 ? places[stop] : undefined;
    const inArea = new Set(area?.projects.map((p) => p.id) ?? []);
    return Object.fromEntries(projectIds.map((id) => [id, area ? (inArea.has(id) ? LEVEL.focus : LEVEL.aside) : LEVEL.shown])) as Record<ProjectId, number>;
  };
  const mixLevels = (a: Record<ProjectId, number>, b: Record<ProjectId, number>, e: number): Record<ProjectId, number> =>
    Object.fromEntries(projectIds.map((id) => [id, lerp(a[id]!, b[id]!, e)])) as Record<ProjectId, number>;

  const fogFor = (shot: CameraShot, look: number): { near: number; far: number } => {
    const d = len(sub(shot.position, shot.target));
    const near = Math.max(14, d + 5) + 26 * look;
    return { near, far: near + 36 + 20 * look };
  };

  // The rest of the fall's state, held from the hand-over on.
  const handVoid = voidAt(HAND_F, aspect);
  const handStream = streamAt(HAND_F);
  const handTrail = trailLevel(HAND_F);
  const WORLD_Q = worldStop(c) - START;
  const SHEET_Q = sheetStart(c) - START;

  function shotAt(s: Segment, t: number): CameraShot {
    if (s.kind === 'land') return t < LAND_HIT ? shotToward(handShot, landShot, ease(t / LAND_HIT)) : shotToward(landShot, worldShot, ease(seg(t, LAND_HIT, LAND_STOP)));
    if (s.kind === 'area') return aroundShot(stopShot(s.i - 1), stopShot(s.i), C, ease(seg(t, 0, AREA_STOP)));
    if (s.kind === 'look') return aroundShot(stopShot(count - 1), lookShot, C, ease(seg(t, 0, LOOK_AT)));
    return lookShot;
  }

  function frameAt(q: number): WorldFrame {
    const qq = Math.max(q, 0);
    const { s, t } = segmentAt(qq);
    const shot = shotAt(s, t);
    const forward = norm(sub(shot.target, shot.position));
    const black = s.kind === 'sheet' ? ease(seg(t * s.length, 0, BLACK)) : 0;
    const landing = s.kind === 'land' && t < LAND_HIT;
    const position = lightPos(s.kind, t);
    // The trail: straight up from the light, growing from the fall's own length to the column as it comes down.
    const height = landing ? lerp(fallHeight, COLUMN.height, ease(t / LAND_HIT)) : COLUMN.height;
    const trail = Array.from({ length: COLUMN.points }, (_, k) => {
      const u = k / (COLUMN.points - 1);
      return { point: [position[0], position[1] + u * height, position[2]] as Vec3, u };
    });
    const fil = 70 + Math.abs(((qq * FIL_RATE) % 360) - 180);
    const light: LightPose = {
      position,
      radius: hand.radius,
      glow: hand.glow * (1 - black),
      stretch: 0,
      yaw: Math.atan2(-forward[0], -forward[2]),
      trail,
      trailLevel: handTrail,
      filaments: filamentsAt(fil),
      sparks: landing ? sparksAt(fil) : []
    };
    const look = s.kind === 'look' ? ease(seg(t, 0.2, 0.9)) : s.kind === 'sheet' ? 1 : 0;

    let power = 1;
    let flash = 0;
    let levels = levelsAt(-1);
    let names = 0;
    let caption: WorldFrame['caption'] = null;
    let dots = 0;
    if (s.kind === 'land') {
      power = t < POWER[0] ? 0 : ease(seg(t, POWER[0], POWER[1]));
      const gone = seg(t, LAND_HIT, FLASH_GONE);
      flash = t < LAND_HIT ? 0 : (1 - gone) ** 2;
      const coming = ease(seg(t, PROJECTS_IN, POWER[1]));
      levels = Object.fromEntries(projectIds.map((id) => [id, coming])) as Record<ProjectId, number>;
      names = ease(seg(t, NAMES_IN, LAND_STOP));
    } else if (s.kind === 'area') {
      levels = mixLevels(levelsAt(s.i - 1), levelsAt(s.i), ease(seg(t, 0, AREA_STOP)));
      if (s.i === 0) names = 1 - ease(seg(t, 0, OUT));
      if (t >= CAPTION_IN) caption = { index: s.i, opacity: ease(seg(t, CAPTION_IN, AREA_STOP)) };
      else if (s.i > 0 && t < OUT) caption = { index: s.i - 1, opacity: 1 - ease(seg(t, 0, OUT)) };
      dots = s.i === 0 ? ease(seg(t, 0, 0.3)) : 1;
    } else if (s.kind === 'look') {
      levels = mixLevels(levelsAt(count - 1), levelsAt(-1), ease(seg(t, 0, LOOK_AT)));
      if (count === 0) names = 1 - ease(seg(t, 0, OUT));
      else if (t < OUT) caption = { index: count - 1, opacity: 1 - ease(seg(t, 0, OUT)) };
      dots = count > 0 ? 1 - ease(seg(t, 0, OUT)) : 0;
    }
    if (caption !== null && caption.opacity <= 0) caption = null;

    return {
      part: s.kind,
      index: s.kind === 'area' ? s.i : -1,
      t,
      shot,
      light,
      void: { ...handVoid, band: handVoid.band * (1 - 0.35 * look), ringMist: 0, stream: handStream },
      power,
      flash,
      levels,
      names,
      caption,
      dots,
      skip: qq >= WORLD_Q - 1e-9 && qq <= SHEET_Q + 1e-9,
      black,
      fog: fogFor(shot, look),
      sky: !(s.kind === 'look' && t > 0.3) && s.kind !== 'sheet'
    };
  }

  const sights: [Vec3, Vec3][] = [landShot, worldShot, ...areaShots, lookShot, ...projectIds.map(openShot)].map((shot) => [[...shot.position] as Vec3, [...shot.target] as Vec3]);

  return { places, projects: projectIds, centre: C, worldShot, areaShot: (i) => stopShot(i), lookShot, openShot, sights, frameAt };
}

/** The last path made by `worldPathFor`, and the aspect it was made for. */
let kept: { aspect: number; path: WorldPath } | null = null;

/** The home's world path on a screen of this aspect, kept for the last aspect asked: every frame asks, and a resize makes it anew. */
export function worldPathFor(aspect: number): WorldPath {
  if (kept === null || kept.aspect !== aspect) kept = { aspect, path: makeWorldPath(aspect) };
  return kept.path;
}
