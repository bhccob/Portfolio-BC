/**
 * The quantum stack's path, as plain numbers (spec 2026-10-28-bob-quantum-stack-design.md; after the mock-up Bob
 * approved, .superpowers/holo-world-4-mockup/main.ts): from the place on the home's scroll past the path's start (`q`, in
 * units) to the camera, the light, the void, the stack's opening, each board's power and light, each project's light
 * and the words. Pure, as the journey is (./journey.ts): it imports nothing from React or three and remembers no frame,
 * so the same place is the same picture, and the tests read the very pose the scene applies.
 *
 * After the light dive hands the light over at way frame `HAND_F`:
 * - LAND: the light falls on, straight down into the CPU's lid on the power board by `LAND_HIT` (carrying the fall's
 *   speed in, quickening), a flash there; the closed stack explodes open, each board sliding down to its place; the
 *   power runs down the spine over `POWER`, each board a little after the one above it; the light stays on the lid, its
 *   trail standing above it as a still column; the camera comes down out of the fall to look at the light coming in,
 *   then settles on the whole machine by `LAND_STOP`;
 * - AREA, one per board of the stack: the camera goes round the stack's axis (./around.ts) and down to the board, seen
 *   from just under the board above it, by `AREA_STOP`; the board in view lit, the others stepped back, its caption in;
 * - LOOK: round and back and up, the whole machine framed in the nebula, the Q&A's gold ring coming in round it;
 * - QA, one for each mark on the ring (spec 2026-10-29-bob-stack-2-design.md, goal 1): over the first, from the look
 *   back's stop to the first question, the stack closes (`explode` back to 0), its projects sinking into their sockets,
 *   the ring draws in and up round it and the camera moves to the ring's own view (`ringShot`); over each after it the
 *   ring turns a question (./qaRing.ts), the camera still; at the end's mark the whole ring lights.
 *
 * The camera's places are the mock-up's (its `poseFor`), each framed by fit (./fit.ts) round what its view must hold;
 * where the mock-up moved the picture with a view offset, the shot looks a little aside instead (`aside`), as the site's
 * shots carry no offset.
 */
import type { CategoryId } from '~/data/categories';
import type { ProjectId } from '~/data/projects';
import { RING_MARKS } from '~/data/qa';
import { type CameraShot, shotToward } from '~/engine/bob/shots';
import { AREA_STOP, type Chapters, HAND_F, HOME_CHAPTERS, LAND_STOP, lookStop, pathStart, worldStop } from '~/state/chapters';
import { aroundShot } from './around';
import { fitDistance } from './fit';
import { filamentsAt, lightAt, sizeFor, sparksAt, streamAt, trailAt, trailLevel, voidAt, wayShot } from './lightDive';
import type { LightPose, VoidPose } from './poseTypes';
import { answerShown, RING, ringLit, ringTurnFor } from './qaRing';
import { type BoardPlace, boardCentre, boardTops, LID_TOP, STACK, stackPlaces } from './worldLayout';

export type Vec3 = [number, number, number];
type R3 = readonly [number, number, number];
type Box = readonly [number, number, number, number];

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
/** The power runs down the stack over this stretch of the land, board by board. */
export const POWER = [0.35, 0.75] as const;
/** The stack opens over this stretch of the land, after the hit and before the world's stop. */
const EXPLODE = [0.4, 0.7] as const;
/** How much later than the board above it each board's power starts, against the power's whole stretch (the mock-up's). */
const POWER_LAG = 0.32;
/** The flash on the lid is gone by here. */
const FLASH_GONE = 0.5;
/** Each project comes in over the power's last third. */
const PROJECTS_IN = POWER[0] + ((POWER[1] - POWER[0]) * 2) / 3;
/** The names may show from here to the world's stop. */
const NAMES_IN = 0.75;
/** A board's caption comes in from here to its stop; the last stop's words go over a unit's first `OUT`. */
const CAPTION_IN = 0.55;
const OUT = 0.2;
/**
 * The look back's camera is there by this share of the look: all of it, as the pull from a board's stop out to the whole
 * machine small in the nebula is long (66 m out on a phone), and a shorter share would hurry it into a seam.
 */
const LOOK_AT = 1;
/** The light's trail at rest: a column this tall, m, in this many points. */
const COLUMN = { height: 26, points: 40 } as const;
/**
 * How dark a failed void's end page has come at `share` (0..1) of its way in (src/scene/bob/endView.ts): eased out,
 * 1 - (1 - x)². With the world there the end of the story is the ring's, and nothing darkens.
 */
export function sheetBlack(share: number): number {
  return 1 - (1 - clamp01(share)) ** 2;
}

/** The gyroscope rings round the stack step back to this at a board's stop and in the Q&A, so the thing in view leads. */
export const RINGS_FOCUS = 0.42;

/** How much of the screen the whole machine fills at the look back, each way from the middle, NDC, by the screen's shape. */
export const LOOK_BOX = { desk: 0.95, phone: 0.95 } as const;
/** The filaments' crawl: way frames of their shapes a unit of scroll. */
const FIL_RATE = 16;
/** The way's frames a unit of scroll in the fall (its 299 frames over 6 units). */
const FRAMES_PER_UNIT = 299 / 6;

/** A project's light at each stop: shown; on the board in view; on a board stepped back. */
const LEVEL = { shown: 1, focus: 1.1, aside: 0.45 } as const;
/** A board's light at a board's stop: the board in view; the power board; the other category boards. */
const BOARD_LIGHT = { view: 1, power: 0.7, aside: 0.45 } as const;

/**
 * The mock-up's framings, by the screen's shape: each view's field (deg); the whole machine's elevation (deg) and box;
 * a board's elevation, how far above its top and toward its projects the camera looks, and its box; the look back's
 * elevation, distance and azimuth (rad). A box is [left, right, bottom, top] of the screen, NDC.
 */
const FRAME = {
  desk: { fov: 38, world: { elevation: 30, box: [-0.66, 0.66, -0.86, 0.82] as Box }, board: { elevation: 17, lift: 0.2, box: [-0.64, 0.64, -0.56, 0.72] as Box } },
  phone: { fov: 58, world: { elevation: 26, box: [-0.9, 0.9, -0.62, 0.7] as Box }, board: { elevation: 14, lift: 0.6, box: [-1.25, 1.25, -0.14, 0.66] as Box } }
} as const;
const TOWARD = 0.6;
/** How far below the underside of the board above a board's camera stands at the most, m. */
const UNDER = 0.1;
const LOOK = { elevation: 16, azimuth: 0.5 } as const;
/** How far the spine's tip hangs below the last board, and how far the machine's middle stands below its top, m. */
const TIP = 3.8;
const BELOW = 3.4;

export type WorldPart = 'land' | 'area' | 'look' | 'qa';

/** Where the Q&A stands: on the ring, how far the stack has closed, the end's light round the ring and the answer's share. */
export interface QaFrame {
  /** The place on the ring: -1 at the look back's stop, `k` at mark `k` (./qaRing.ts). */
  place: number;
  /** How far the stack has closed under the ring, 0..1: the first QA unit's way, then 1. */
  close: number;
  /** How much the whole ring lights round, 0..1 (`ringLit`): at the end's mark. */
  lit: number;
  /** How much the answer beside the ring shows, 0..1 (`answerShown`). */
  answer: number;
}

/** The Q&A's gold ring, posed: its light, its middle, its size against `RING.radius` and its turn (./qaRing.ts). */
export interface RingFrame {
  level: number;
  centre: Vec3;
  scale: number;
  turn: number;
}

/** One moment of the stack's path. */
export interface WorldFrame {
  part: WorldPart;
  /** The board's place among the category boards in an AREA (0 the first below the power board); -1 elsewhere. */
  index: number;
  /** How far through the part, 0..1 (over the sheet, its share). */
  t: number;
  shot: CameraShot;
  light: LightPose;
  void: VoidPose;
  /** The power from the CPU, 0..1. */
  power: number;
  /** The light's hit on the CPU, 0..1. */
  flash: number;
  /** The stack: 0 closed, the boards a hand's width apart; 1 open, each at its place (`boardTops`). */
  explode: number;
  /** Each board's power, the power board first, 0..1: each a little after the one above it. */
  boardPower: number[];
  /** Each board's light, the power board first: 1 shown, less while another board is in view. */
  boardLight: number[];
  /** Each project's light: 0 not yet in, 1 shown, more on the board in view, less on a board stepped back. */
  levels: Record<ProjectId, number>;
  /** Whether the projects' names may show here, 0..1: at the world's stop and at each board's (src/ui/WorldNames.tsx). */
  names: number;
  /** A board's words at the bottom left: which board and how much. */
  caption: { index: number; opacity: number } | null;
  /** The dots of the boards, 0..1. */
  dots: number;
  /** Whether the skip button shows: from the world's stop through the look back's. */
  skip: boolean;
  /** The fade to black, 0..1. */
  black: number;
  /** The Q&A: where it stands, null off it (before the look back's stop). */
  qa: QaFrame | null;
  /** The Q&A's gold ring: dark before the look back, in over it, then round the closing stack. */
  ring: RingFrame;
  /** The gyroscope rings round the stack: their light (the power board's power) and how far they stand back (`RINGS_FOCUS`). */
  rings: { level: number; focus: number };
  fog: { near: number; far: number };
  /** Whether the glass sky above shows: not in the look back, which looks up toward it, nor in the black. */
  sky: boolean;
}

export interface WorldPath {
  /** The stack's boards, the power board first, each open at its place. */
  places: BoardPlace[];
  /** The projects on the stack, in the boards' order. */
  projects: ProjectId[];
  centre: Vec3;
  /** The camera at the world's stop, at each board's (`areaShot(i)` board `i + 1`'s), at the look back's. */
  worldShot: CameraShot;
  areaShot(index: number): CameraShot;
  lookShot: CameraShot;
  /** The camera through the Q&A's questions: round the closed stack and its ring (the mock-up's `ringPose`, "mix"). */
  ringShot: CameraShot;
  /** Every point the whole machine's view must hold: each board's rim, what floats over it, the CPU and the spine's tip. */
  machine: Vec3[];
  /** Every view's camera and what it looks at (the land's and the stops'): the clouds stay out of them. */
  sights: [Vec3, Vec3][];
  /** The stack's path at `q` units past its start. */
  frameAt(q: number): WorldFrame;
}

/** A stretch of the path on its own axis: a chapter unit's part, its board's place, and where it starts and ends. */
interface Segment {
  kind: WorldPart;
  i: number;
  a: number;
  b: number;
  length: number;
}

const PARTS: Readonly<Record<string, WorldPart>> = { LAND: 'land', AREA: 'area', LOOK: 'look', QA: 'qa' };

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

/** The level way out from the stack's axis at `azimuth` (rad, 0 toward +z), raised by `elevation` (rad). */
const outward = (azimuth: number, elevation: number): Vec3 => [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)];

/** A board's rim, top and bottom, and the tops of what floats over its sockets: what its view must hold. */
function rimOf(board: BoardPlace, centre: R3): Vec3[] {
  const points: Vec3[] = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = centre[0] + Math.sin(a) * board.radius;
    const z = centre[2] + Math.cos(a) * board.radius;
    points.push([x, board.top, z], [x, board.top - STACK.thick, z]);
  }
  for (const s of board.sockets) points.push([centre[0] + s.at[0], board.top + STACK.hover + 0.9, centre[2] + s.at[1]]);
  return points;
}

/** The stack's path on a screen of this aspect, over the chapters `c`. */
export function makeWorldPath(aspect: number, c: Chapters = HOME_CHAPTERS): WorldPath {
  const phone = sizeFor(aspect) === 'phone';
  const SEGMENTS = segmentsOf(c);
  const segmentAt = (q: number): { s: Segment; t: number } => {
    for (const s of SEGMENTS) if (q < s.b) return { s, t: clamp01((q - s.a) / s.length) };
    return { s: SEGMENTS[SEGMENTS.length - 1]!, t: 1 };
  };
  const START = pathStart(c);
  const areaUnits = c.units.filter((u) => u.id === 'AREA');
  const places = stackPlaces(areaUnits.map((u) => ({ category: u.category as CategoryId, projects: [...(u.projects ?? [])] })));
  const boards = places.slice(1);
  const projectIds = boards.flatMap((b) => b.sockets.map((s) => s.id));
  const count = boards.length;
  const C = boardCentre();
  const UP: Vec3 = [0, 1, 0];
  const lid: Vec3 = add(C, [0, LID_TOP, 0]);
  const lastTop = places[places.length - 1]!.top;
  /** The middle of the machine, top to tip. */
  const middle: Vec3 = [C[0], C[1] + (lastTop - C[1] - BELOW) / 2, C[2]];
  const machine: Vec3[] = [
    ...boards.flatMap((b) => rimOf(b, C)),
    add(C, [STACK.core, 0, 0]),
    add(C, [-STACK.core, 0, 0]),
    add(C, [0, 1.2, 0]),
    [C[0], lastTop - STACK.thick - TIP, C[2]]
  ];

  // The cameras, each framed by fit round what its view must hold, the box's middle reached by looking aside.
  const F = phone ? FRAME.phone : FRAME.desk;
  const framed = (points: readonly R3[], target: Vec3, azimuth: number, elevation: number, box: Box): CameraShot => {
    const hx = (box[1] - box[0]) / 2;
    const hy = (box[3] - box[2]) / 2;
    const d = fitDistance(points, target, azimuth, elevation, F.fov, aspect, [-hx, hx, -hy, hy]);
    return aside(add(target, mul(outward(azimuth, elevation), d)), target, F.fov, [(box[0] + box[1]) / 4, (box[2] + box[3]) / 4], aspect);
  };
  const worldShot = framed(machine, middle, 0, F.world.elevation * DEG, F.world.box);
  const landShot: CameraShot = phone
    ? { position: add(C, [0, 3.2, 14]), target: add(C, [0, 4.6, 0]), fov: 64, up: UP, sway: 0 }
    : { position: add(C, [0, 2.6, 11.5]), target: add(C, [0, 3.4, 0]), fov: 46, up: UP, sway: 0 };
  // The look back: back and up, the whole machine framed by fit (Bob, 2026-10-29: "it zooms out too much").
  const lookBox = phone ? LOOK_BOX.phone : LOOK_BOX.desk;
  const lookDistance = fitDistance(machine, middle, LOOK.azimuth, LOOK.elevation * DEG, F.fov, aspect, [-lookBox, lookBox, -lookBox, lookBox]);
  const lookShot: CameraShot = { position: add(middle, mul(outward(LOOK.azimuth, LOOK.elevation * DEG), lookDistance)), target: middle, fov: F.fov, up: UP, sway: 0 };
  // The Q&A's ring: open round the machine's middle, then closed round the closed stack's, drawn in to `closedRadius`.
  const shut = boardTops(places, 0);
  const ringOpen: Vec3 = [C[0], middle[1] + RING.lift, C[2]];
  const ringShut: Vec3 = [C[0], (shut[0]! + shut[shut.length - 1]!) / 2 - RING.below, C[2]];
  // The ring's own view, the mock-up's: from in front of the closed stack, a little up, nearer than the look back, the
  // ring a little aside so the answer has its room (on a phone, the ring high and the answer under it).
  const ringAim: Vec3 = [C[0], ringShut[1] - (phone ? 0.6 : 1.6), C[2]];
  // The mock-up's view offset is NDC; `aside` takes shares of the screen, half of it.
  const ringView = phone ? { elevation: 20, distance: 31, shift: [0, 0.17] as const } : { elevation: 15, distance: 23, shift: [-0.13, 0.01] as const };
  const ringShot = aside(add(ringAim, mul(outward(RING.azimuth, ringView.elevation * DEG), ringView.distance)), ringAim, F.fov, ringView.shift, aspect);
  // A board from the side its projects face, from just under the board above it: at the mock-up's elevation, unless the
  // fit would stand the camera higher than `UNDER` below that board's underside (a squarer screen stands it further
  // out); then at the highest elevation that keeps it there, so the board above never covers the one in view.
  const boardShots = boards.map((b, i): CameraShot => {
    const target = add(C, [Math.sin(b.facing) * TOWARD, b.top - C[1] + F.board.lift, Math.cos(b.facing) * TOWARD]);
    const rim = rimOf(b, C);
    const [left, right, bottom, top] = F.board.box;
    const half: Box = [-(right - left) / 2, (right - left) / 2, -(top - bottom) / 2, (top - bottom) / 2];
    const ceiling = places[i]!.top - STACK.thick - UNDER;
    const height = (elevation: number): number => target[1] + Math.sin(elevation) * fitDistance(rim, target, b.facing, elevation, F.fov, aspect, half);
    let elevation = F.board.elevation * DEG;
    if (height(elevation) > ceiling) {
      let lo = 0;
      let hi = elevation;
      for (let n = 0; n < 24; n++) {
        const mid = (lo + hi) / 2;
        if (height(mid) > ceiling) hi = mid;
        else lo = mid;
      }
      elevation = lo;
    }
    return framed(rim, target, b.facing, elevation, F.board.box);
  });
  const stopShot = (i: number): CameraShot => (i < 0 ? worldShot : boardShots[i]!);

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

  /** Each project's light at rest at a stop: all shown at the world and the look back; the board in view's lit, the rest aside. */
  const boardOf = new Map(boards.flatMap((b, i) => b.sockets.map((s) => [s.id, i] as const)).reverse());
  const levelsAt = (stop: number): Record<ProjectId, number> =>
    Object.fromEntries(projectIds.map((id) => [id, stop < 0 ? LEVEL.shown : boardOf.get(id) === stop ? LEVEL.focus : LEVEL.aside])) as Record<ProjectId, number>;
  const mixLevels = (a: Record<ProjectId, number>, b: Record<ProjectId, number>, e: number): Record<ProjectId, number> =>
    Object.fromEntries(projectIds.map((id) => [id, lerp(a[id]!, b[id]!, e)])) as Record<ProjectId, number>;
  /** Each board's light at rest at a stop: all shown at the world and the look back; at a board's, the others stepped back. */
  const boardLightAt = (stop: number): number[] =>
    places.map((_, k) => (stop < 0 ? 1 : k === stop + 1 ? BOARD_LIGHT.view : k === 0 ? BOARD_LIGHT.power : BOARD_LIGHT.aside));
  const mixLight = (a: number[], b: number[], e: number): number[] => a.map((v, k) => lerp(v, b[k]!, e));
  /** The power reaches each board a little after the one above it; the last one whole when the power is. */
  const reach = 1 + (places.length - 1) * POWER_LAG;
  const boardPowerAt = (power: number): number[] => places.map((_, k) => clamp01(power * reach - k * POWER_LAG));

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
  const LOOK_Q = lookStop(c) - START;

  function shotAt(s: Segment, t: number): CameraShot {
    if (s.kind === 'land') return t < LAND_HIT ? shotToward(handShot, landShot, ease(t / LAND_HIT)) : shotToward(landShot, worldShot, ease(seg(t, LAND_HIT, LAND_STOP)));
    if (s.kind === 'area') return aroundShot(stopShot(s.i - 1), stopShot(s.i), C, ease(seg(t, 0, AREA_STOP)));
    if (s.kind === 'look') return aroundShot(stopShot(count - 1), lookShot, C, ease(seg(t, 0, LOOK_AT)));
    // The Q&A: from the look back to the ring's view over the way in, then still while the ring turns.
    return s.i === 0 ? shotToward(lookShot, ringShot, ease(t)) : ringShot;
  }

  function frameAt(q: number): WorldFrame {
    const qq = Math.max(q, 0);
    const { s, t } = segmentAt(qq);
    const shot = shotAt(s, t);
    const forward = norm(sub(shot.target, shot.position));
    const black = 0;
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
    const look = s.kind === 'look' ? ease(seg(t, 0.2, 0.9)) : s.kind === 'qa' ? 1 : 0;
    // The Q&A: its place on the ring, and the stack closing over the way in.
    const qa: QaFrame | null =
      s.kind === 'qa' ? { place: s.i - 1 + t, close: s.i === 0 ? ease(t) : 1, lit: ringLit(s.i - 1 + t, RING_MARKS), answer: answerShown(s.i - 1 + t) } : null;
    const close = qa?.close ?? 0;

    let power = 1;
    let flash = 0;
    let explode = 1;
    let levels = levelsAt(-1);
    let boardLight = boardLightAt(-1);
    let names = 0;
    let caption: WorldFrame['caption'] = null;
    let dots = 0;
    if (s.kind === 'land') {
      power = t < POWER[0] ? 0 : ease(seg(t, POWER[0], POWER[1]));
      explode = ease(seg(t, EXPLODE[0], EXPLODE[1]));
      const gone = seg(t, LAND_HIT, FLASH_GONE);
      flash = t < LAND_HIT ? 0 : (1 - gone) ** 2;
      const coming = ease(seg(t, PROJECTS_IN, POWER[1]));
      levels = Object.fromEntries(projectIds.map((id) => [id, coming])) as Record<ProjectId, number>;
      names = ease(seg(t, NAMES_IN, LAND_STOP));
    } else if (s.kind === 'area') {
      const e = ease(seg(t, 0, AREA_STOP));
      levels = mixLevels(levelsAt(s.i - 1), levelsAt(s.i), e);
      boardLight = mixLight(boardLightAt(s.i - 1), boardLightAt(s.i), e);
      const leaving = t < OUT ? 1 - ease(seg(t, 0, OUT)) : 0;
      names = Math.max(leaving, ease(seg(t, CAPTION_IN, AREA_STOP)));
      if (t >= CAPTION_IN) caption = { index: s.i, opacity: ease(seg(t, CAPTION_IN, AREA_STOP)) };
      else if (s.i > 0 && t < OUT) caption = { index: s.i - 1, opacity: 1 - ease(seg(t, 0, OUT)) };
      dots = s.i === 0 ? ease(seg(t, 0, 0.3)) : 1;
    } else if (s.kind === 'look') {
      const e = ease(seg(t, 0, LOOK_AT));
      levels = mixLevels(levelsAt(count - 1), levelsAt(-1), e);
      boardLight = mixLight(boardLightAt(count - 1), boardLightAt(-1), e);
      names = t < OUT ? 1 - ease(seg(t, 0, OUT)) : 0;
      if (count > 0 && t < OUT) caption = { index: count - 1, opacity: 1 - ease(seg(t, 0, OUT)) };
      dots = count > 0 ? 1 - ease(seg(t, 0, OUT)) : 0;
    } else if (s.kind === 'qa') {
      // The stack closes under the ring, its projects sinking into their sockets and going out with it.
      explode = 1 - close;
      levels = Object.fromEntries(projectIds.map((id) => [id, LEVEL.shown * (1 - close)])) as Record<ProjectId, number>;
    }
    // The gyroscope rings: lit with the power board's power, stepped back at a board's stop and in the Q&A.
    let focus = 1;
    if (s.kind === 'area') focus = lerp(s.i === 0 ? 1 : RINGS_FOCUS, RINGS_FOCUS, ease(seg(t, 0, AREA_STOP)));
    else if (s.kind === 'look') focus = lerp(count > 0 ? RINGS_FOCUS : 1, 1, ease(seg(t, 0, LOOK_AT)));
    else if (s.kind === 'qa') focus = lerp(1, RINGS_FOCUS, close);
    // The Q&A's ring: in over the look back, open round the machine; then drawn in and up round the closing stack.
    const ringLevel = s.kind === 'look' ? ease(seg(t, 0.3, 0.9)) : s.kind === 'qa' ? 1 : 0;
    const ring: RingFrame = {
      level: ringLevel,
      centre: [ringOpen[0], lerp(ringOpen[1], ringShut[1], close), ringOpen[2]],
      scale: lerp(1, RING.closedRadius / RING.radius, close),
      turn: ringTurnFor(qa?.place ?? -1, RING_MARKS)
    };
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
      explode,
      boardPower: boardPowerAt(power),
      boardLight,
      levels,
      names,
      caption,
      dots,
      skip: qq >= WORLD_Q - 1e-9 && qq <= LOOK_Q + 1e-9,
      black,
      qa,
      ring,
      rings: { level: boardPowerAt(power)[0] ?? power, focus },
      fog: fogFor(shot, look),
      sky: !(s.kind === 'look' && t > 0.3) && s.kind !== 'qa'
    };
  }

  const sights: [Vec3, Vec3][] = [landShot, worldShot, ...boardShots, lookShot, ringShot].map((shot) => [[...shot.position] as Vec3, [...shot.target] as Vec3]);

  return { places, projects: projectIds, centre: C, worldShot, areaShot: (i) => stopShot(i), lookShot, ringShot, machine, sights, frameAt };
}

/** The last path made by `worldPathFor`, and the aspect it was made for. */
let kept: { aspect: number; path: WorldPath } | null = null;

/** The home's stack path on a screen of this aspect, kept for the last aspect asked: every frame asks, and a resize makes it anew. */
export function worldPathFor(aspect: number): WorldPath {
  if (kept === null || kept.aspect !== aspect) kept = { aspect, path: makeWorldPath(aspect) };
  return kept.path;
}
