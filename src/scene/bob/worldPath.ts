/**
 * The quantum stack's path, as plain numbers (spec 2026-10-28-bob-quantum-stack-design.md; after the mock-up Bob
 * approved, .superpowers/holo-world-4-mockup/main.ts): from the place on the home's scroll past the path's start (`q`, in
 * units) to the camera, the light, the void, the stack's opening, each board's power and light, each project's light
 * and the words. Pure, as the journey is (./journey.ts): it imports nothing from React or three and remembers no frame,
 * so the same place is the same picture, and the tests read the very pose the scene applies.
 *
 * After the light dive hands the light over at way frame `HAND_F`:
 * - LAND: the light falls on, straight down into the CPU's lid on the power board by `LAND_HIT` (carrying the fall's
 *   speed in, quickening), a flash there; the tower dark until then, the power runs down it slowly over `POWER`, board
 *   by board from the top, each as the one above is half lit (Bob, 2026-10-30: "it slowly powers (light on) the
 *   tower"); the closed stack explodes open over the power's middle, each board sliding down to its place; the light
 *   stays on the lid, its trail standing above it as a still column; the camera comes down out of the fall to look at
 *   the light coming in, then pulls slowly back over the power-on to the whole machine by `LAND_STOP`;
 * - AREA, one per board of the stack: the camera goes down to the board, turning half round the stack's axis on the way
 *   (`FLOOR_TURN`, ./around.ts), so it stands at `AREA_STOP` on the side the half turns leave it (every other board seen
 *   from behind the stack); the board in view lit, the others stepped back, its caption in;
 * - from the last board's stop, the Q&A's door, the way out (round 15, ./wayOut.ts): the floors close while the tower
 *   dissolves (the stardust, ../../engine/bob/build/stardust.ts), its words gone at once and every board lit; the camera
 *   eases to the closed tower and moves off it, up, back and round, the tower slid aside of the words (`wayOutShot`), and
 *   goes on with the Q&A to the end, the tower back in the middle.
 *
 * The camera's places are the mock-up's (its `poseFor`), each framed by fit (./fit.ts) round what its view must hold;
 * where the mock-up moved the picture with a view offset, the shot looks a little aside instead (`aside`), as the site's
 * shots carry no offset.
 */
import type { CategoryId } from '~/data/categories';
import type { ProjectId } from '~/data/projects';
import { type CameraShot, shotToward } from '~/engine/bob/shots';
import { AREA_STOP, type Chapters, HAND_F, HOME_CHAPTERS, LAND_DROP, LAND_STOP, pathStart, qaDoor, qaPlaceAt, WORLD_LAYOUT, worldStop } from '~/state/chapters';
import { aroundShot, turnedRound } from './around';
import { fitDistance } from './fit';
import { lightAt, sizeFor, streamAt, trailAt, trailLevel, voidAt, wayShot } from './lightDive';
import type { LightPose, VoidPose } from './poseTypes';
import { type WayOutView, wayOutAt } from './wayOut';
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

/** Where in the land the light hits the CPU's lid: `LAND_DROP` units in (src/state/chapters.ts). */
export const LAND_HIT = LAND_DROP / WORLD_LAYOUT.land;
/** The share of the land `units` after the hit: the moments after it stand as far after it as they always did. */
const afterHit = (units: number): number => LAND_HIT + units / WORLD_LAYOUT.land;
/**
 * The power runs down the stack over this stretch of the land, board by board: slowly, 1.6 units of scroll where it had
 * 0.72, starting a breath after the hit (Bob, 2026-10-30; the mock-up he chose, .superpowers/power-on-review).
 */
export const POWER = [afterHit(0.05), afterHit(1.65)] as const;
/** The stack opens over this stretch of the land, after the power board has come on and before the world's stop. */
export const EXPLODE = [afterHit(0.45), afterHit(1.5)] as const;
/**
 * How much later than the board above it each board's power starts, against the power's whole stretch: each starts as
 * the one above it is half lit, so the light is seen going down the tower board by board.
 */
const POWER_LAG = 0.5;
/** The flash on the lid is gone by here. */
export const FLASH_GONE = afterHit(0.4);
/** Each project comes in over the power's last third. */
const PROJECTS_IN = POWER[0] + ((POWER[1] - POWER[0]) * 2) / 3;
/** The names may show from here to the world's stop: once the last board is lit. */
export const NAMES_IN = afterHit(1.65);
/** A board's caption comes in from here to its stop; the last stop's words go over a unit's first `OUT`. */
const CAPTION_IN = 0.55;
const OUT = 0.2;
/** The light's trail at rest: a column this tall, m, in this many points. */
const COLUMN = { height: 26, points: 40 } as const;
/**
 * How dark a failed void's end page has come at `share` (0..1) of its way in (src/scene/bob/endView.ts): eased out,
 * 1 - (1 - x)². With the world there the end of the story is the way out's, and the path itself never darkens.
 */
export function sheetBlack(share: number): number {
  return 1 - (1 - clamp01(share)) ** 2;
}

/**
 * How much nearer than its fit every view of the tower stands: the world's stop, each board's and the look back's, on
 * every screen (Bob, 2026-10-30: "can the tower be a bit zoomed in in general?", then, shown 12% and 25%
 * nearer, "25% closer"). The camera comes in along its own line, the field unchanged.
 */
export const TOWER_ZOOM = 1.25;

/**
 * The camera's turn round the tower on the way down to each board, radians, as `turnedRound` (./around.ts) measures it
 * (Bob, 2026-10-31, round 12: a whole turn, "sort of like dramatic"; 2026-11-01, round 15: "can you make the scroll to
 * rotate around the tower less agressive", then "Yes, half per floor"): half a turn, the same way each time, with the
 * scroll. The boards stay as they are (the half-turn flipbook Bob approved: only the camera goes round), so every other
 * board is seen from the other side of the stack; the whole machine's view stays as it was.
 */
export const FLOOR_TURN = -Math.PI;

/** The turn the camera and board `i` (0-based among the category boards) stand at; the world's stop (−1) 0. */
export function floorTurn(i: number): number {
  return i < 0 ? 0 : FLOOR_TURN * (i + 1);
}

/** How long into the dissolve the floor's words take to go, s. */
const WORDS_GO = 0.6;

/**
 * The way out's camera off the closed tower (the mock-up's `dustWorld` shot, spec 2026-11-01-bob-dissolve-digitize-design.md):
 * how far back it pulls (times the closed shot's distance), how much higher and how far round it goes (deg), by the way
 * out's `away`, `q` and `end`; how far it slides the tower aside of the words, a share of the screen (right on a laptop,
 * up on a phone); and the fog it draws back to (m, times the pull).
 */
export const WAY_OUT_CAMERA = {
  pull: { away: 0.6, q: 0.8, end: 0.15 },
  rise: { away: 14, q: -8, end: 6 },
  turn: { away: 15, q: 40 },
  slide: 0.17,
  fog: { near: 30, far: 170 }
} as const;

/**
 * `base` turned round `about`: its distance from it times `pull`, `rise` rad higher, `turn` rad further round (as
 * atan2(x, z) measures it), its target `toward` of the way to `about`. Pure.
 */
export function orbitShot(base: CameraShot, about: R3, o: { pull: number; rise: number; turn: number; toward: number }): CameraShot {
  const v = sub(base.position, about);
  const d = len(v) || 1;
  const el = Math.max(-1.5, Math.min(1.5, Math.asin(Math.max(-1, Math.min(1, v[1] / d))) + o.rise));
  const az = Math.atan2(v[0], v[2]) + o.turn;
  const r = d * o.pull;
  const position = add(about, [Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r]);
  const target: Vec3 = [lerp(base.target[0], about[0], o.toward), lerp(base.target[1], about[1], o.toward), lerp(base.target[2], about[2], o.toward)];
  return { ...base, position, target };
}

/** The gyroscope rings round the stack step back to this at a board's stop (and the way out holds it), so the thing in view leads. */
export const RINGS_FOCUS = 0.42;

/**
 * How much of the screen the whole machine fills at the look back (the view a project off the stack stands open in,
 * ./journey.ts `focusShotFor`), each way from the middle, NDC, by the screen's shape.
 */
export const LOOK_BOX = { desk: 0.95, phone: 0.95 } as const;
/** The way's frames a unit of scroll in the fall (its 299 frames over 6 units). */
const FRAMES_PER_UNIT = 299 / 6;

/** A project's light at each stop: shown; on the board in view; on a board stepped back. */
const LEVEL = { shown: 1, focus: 1.1, aside: 0.45 } as const;
/** A board's light at a board's stop: the board in view; the power board; the other category boards. */
const BOARD_LIGHT = { view: 1, power: 0.7, aside: 0.45 } as const;

/**
 * The mock-up's framings, by the screen's shape: each view's field (deg); the whole machine's elevation (deg) and box;
 * a board's elevation, how far above its top the camera looks, and its box (round 11, Bob picked "A · a little nearer":
 * from the front as at the whole machine, the board in the middle, its rim in the middle 60% of a laptop's screen; round
 * 15, a phone's a little wider than its screen no more, so a project seen from behind the stack, nearer, keeps its whole
 * object on it); the look back's elevation, distance and azimuth (rad). A box is [left, right, bottom, top] of the
 * screen, NDC.
 */
const FRAME = {
  desk: { fov: 38, world: { elevation: 30, box: [-0.66, 0.66, -0.86, 0.82] as Box }, board: { elevation: 30, lift: 0.2, box: [-0.6, 0.6, -0.6, 0.6] as Box } },
  phone: { fov: 58, world: { elevation: 26, box: [-0.9, 0.9, -0.62, 0.7] as Box }, board: { elevation: 26, lift: 0.6, box: [-0.94, 0.94, -0.6, 0.6] as Box } }
} as const;
const LOOK = { elevation: 16, azimuth: 0.5 } as const;
/** How far the spine's tip hangs below the last board, and how far the machine's middle stands below its top, m. */
const TIP = 3.8;
const BELOW = 3.4;

export type WorldPart = 'land' | 'area' | 'qa';

/** Where the Q&A stands: its place, and the way out's stage there (./wayOut.ts). */
export interface QaFrame {
  /** The place in the Q&A (src/state/chapters.ts `qaPlaceAt`): -1 at the door, `k` at mark `k`. */
  place: number;
  out: WayOutView;
}

/**
 * Whether the solid tower, its projects and the gold rings stand in the scene (round 15): off the way out, at its door
 * and through the dissolve until its points have taken the tower's place (`WayOutView.solid`).
 */
export function towerStands(qa: QaFrame | null): boolean {
  return qa === null || qa.place <= -1 || qa.out.solid;
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
  /** Whether the skip button shows: from the world's stop through the Q&A's door, the last board's stop. */
  skip: boolean;
  /** The fade to black, 0..1. */
  black: number;
  /** The Q&A: where it stands, null off it (before its door). */
  qa: QaFrame | null;
  /** The gyroscope rings round the stack: their light (the power board's power) and how far they stand back (`RINGS_FOCUS`). */
  rings: { level: number; focus: number };
  fog: { near: number; far: number };
}

export interface WorldPath {
  /** The stack's boards, the power board first, each open at its place. */
  places: BoardPlace[];
  /** The projects on the stack, in the boards' order. */
  projects: ProjectId[];
  centre: Vec3;
  /**
   * The camera at the world's stop, at each board's (`areaShot(i)` board `i + 1`'s), and looking back up at the whole
   * machine (where a project off the stack stands open).
   */
  worldShot: CameraShot;
  areaShot(index: number): CameraShot;
  lookShot: CameraShot;
  /** The closed tower framed whole, from the last floor's side: where the dissolve takes the camera. */
  closedShot: CameraShot;
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

const PARTS: Readonly<Record<string, WorldPart>> = { LAND: 'land', AREA: 'area', QA: 'qa' };

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

/**
 * The stack's path on a screen of this aspect, over the chapters `c`; `zoom` how much nearer than its fit each view of
 * the tower stands (`TOWER_ZOOM`; 1 the fit itself).
 */
export function makeWorldPath(aspect: number, c: Chapters = HOME_CHAPTERS, { zoom = TOWER_ZOOM }: { zoom?: number } = {}): WorldPath {
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

  // The cameras, each framed by fit round what its view must hold and brought `zoom` nearer, the box's middle reached by
  // looking aside.
  const F = phone ? FRAME.phone : FRAME.desk;
  const framed = (points: readonly R3[], target: Vec3, azimuth: number, elevation: number, box: Box): CameraShot => {
    const hx = (box[1] - box[0]) / 2;
    const hy = (box[3] - box[2]) / 2;
    const d = fitDistance(points, target, azimuth, elevation, F.fov, aspect, [-hx, hx, -hy, hy]) / zoom;
    return aside(add(target, mul(outward(azimuth, elevation), d)), target, F.fov, [(box[0] + box[1]) / 4, (box[2] + box[3]) / 4], aspect);
  };
  const worldShot = framed(machine, middle, 0, F.world.elevation * DEG, F.world.box);
  const landShot: CameraShot = phone
    ? { position: add(C, [0, 3.2, 14]), target: add(C, [0, 4.6, 0]), fov: 64, up: UP, sway: 0 }
    : { position: add(C, [0, 2.6, 11.5]), target: add(C, [0, 3.4, 0]), fov: 46, up: UP, sway: 0 };
  // The look back: back and up, the whole machine framed by fit (Bob, 2026-10-29: "it zooms out too much").
  const lookBox = phone ? LOOK_BOX.phone : LOOK_BOX.desk;
  const lookDistance = fitDistance(machine, middle, LOOK.azimuth, LOOK.elevation * DEG, F.fov, aspect, [-lookBox, lookBox, -lookBox, lookBox]) / zoom;
  const lookShot: CameraShot = { position: add(middle, mul(outward(LOOK.azimuth, LOOK.elevation * DEG), lookDistance)), target: middle, fov: F.fov, up: UP, sway: 0 };
  // A board a little nearer than the whole machine, from the same side and height of view (Bob, 2026-10-30: "the camera
  // still go into specific project when scroll and i dont want that just make it slightly zoom in each foor but not too
  // close"): never turned to its projects, the board's middle in the middle of the screen.
  const boardShots = boards.map((b): CameraShot => framed(rimOf(b, C), [C[0], b.top + F.board.lift, C[2]], 0, F.board.elevation * DEG, F.board.box));
  /** A board's stop as framed from the front (the moves turn round from these), and as the camera stands there, turned. */
  const frontShot = (i: number): CameraShot => (i < 0 ? worldShot : boardShots[i]!);
  const stopShot = (i: number): CameraShot => (i < 0 ? worldShot : turnedRound(boardShots[i]!, C, floorTurn(i)));
  // The closed tower, whole in the middle of the screen, from the side the last floor's stop sees it (the mock-up's).
  const shut = boardTops(places, 0);
  const closedMiddle: Vec3 = [C[0], (shut[0]! + shut[shut.length - 1]!) / 2 - 0.6, C[2]];
  const closedRims = boards.flatMap((b, i) => rimOf({ ...b, top: shut[i + 1]! }, C));
  const closedShot = turnedRound(framed(closedRims, closedMiddle, 0, 24 * DEG, [-0.5, 0.5, -0.38, 0.38]), C, floorTurn(count - 1));
  /** The shot slid by `share` of the screen, the tower aside of the words: the camera left on a laptop, down on a phone. */
  const slid = (shot: CameraShot, share: number): CameraShot => {
    if (!(share > 0)) return shot;
    const forward = norm(sub(shot.target, shot.position));
    const right = norm(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const d = len(sub(closedMiddle, shot.position));
    const tanV = Math.tan((shot.fov * DEG) / 2);
    const move = phone ? mul(up, -2 * share * d * tanV) : mul(right, -2 * share * d * tanV * aspect);
    return { ...shot, position: add(shot.position, move), target: add(shot.target, move) };
  };
  const W = WAY_OUT_CAMERA;
  const pullOf = (out: WayOutView): number => 1 + W.pull.away * out.away + W.pull.q * out.q + W.pull.end * out.end;
  /** The camera on the way out: to the closed tower as the floors close, then off it with the Q&A, slid aside of the words. */
  const wayOutShot = (out: WayOutView): CameraShot => {
    const base = shotToward(stopShot(count - 1), closedShot, out.close);
    const turned = orbitShot(base, closedMiddle, {
      pull: pullOf(out),
      rise: (W.rise.away * out.away + W.rise.q * out.q + W.rise.end * out.end) * DEG,
      turn: (W.turn.away * out.away + W.turn.q * out.q) * DEG,
      toward: out.away
    });
    return slid(turned, W.slide * out.slide);
  };
  /** The fog on the way out: the closing shot's, drawn back to the stardust's as the camera moves off. */
  const wayOutFog = (out: WayOutView): { near: number; far: number } => {
    const from = fogFor(shotToward(stopShot(count - 1), closedShot, out.close));
    const pull = pullOf(out);
    return { near: lerp(from.near, W.fog.near * pull, out.away), far: lerp(from.far, W.fog.far * pull, out.away) };
  };

  // The light: from the hand-over straight down onto the lid, carrying the fall's speed in and easing into the hit (Bob:
  // the drop was too fast; it quickened into the lid at twice the mean, now it settles at half).
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
    const y = hermite(hand.position[1], fallSpeed, lid[1], (lid[1] - hand.position[1]) * 0.5, k);
    const side = 1 - ease(k);
    return [lerp(lid[0], hand.position[0], side), y, lerp(lid[2], hand.position[2], side)];
  };

  /** Each project's light at rest at a stop: all shown at the world; the board in view's lit, the rest aside. */
  const boardOf = new Map(boards.flatMap((b, i) => b.sockets.map((s) => [s.id, i] as const)).reverse());
  const levelsAt = (stop: number): Record<ProjectId, number> =>
    Object.fromEntries(projectIds.map((id) => [id, stop < 0 ? LEVEL.shown : boardOf.get(id) === stop ? LEVEL.focus : LEVEL.aside])) as Record<ProjectId, number>;
  // Mixed from one stop's to the next; the next's own at the stop, exactly (the way out holds it, a float's hair is a seam).
  const mixLevels = (a: Record<ProjectId, number>, b: Record<ProjectId, number>, e: number): Record<ProjectId, number> =>
    e >= 1 ? b : (Object.fromEntries(projectIds.map((id) => [id, lerp(a[id]!, b[id]!, e)])) as Record<ProjectId, number>);
  /** Each board's light at rest at a stop: all shown at the world; at a board's, the others stepped back. */
  const boardLightAt = (stop: number): number[] =>
    places.map((_, k) => (stop < 0 ? 1 : k === stop + 1 ? BOARD_LIGHT.view : k === 0 ? BOARD_LIGHT.power : BOARD_LIGHT.aside));
  const mixLight = (a: number[], b: number[], e: number): number[] => (e >= 1 ? b : a.map((v, k) => lerp(v, b[k]!, e)));
  /** The power reaches each board a little after the one above it; the last one whole when the power is. */
  const reach = 1 + (places.length - 1) * POWER_LAG;
  const boardPowerAt = (power: number): number[] => places.map((_, k) => clamp01(power * reach - k * POWER_LAG));

  const fogFor = (shot: CameraShot): { near: number; far: number } => {
    const d = len(sub(shot.position, shot.target));
    const near = Math.max(14, d + 5);
    return { near, far: near + 36 };
  };

  // The rest of the fall's state, held from the hand-over on.
  const handVoid = voidAt(HAND_F, aspect);
  const handStream = streamAt(HAND_F);
  const handTrail = trailLevel(HAND_F);
  const WORLD_Q = worldStop(c) - START;
  const DOOR_Q = qaDoor(c) - START;

  function shotAt(s: Segment, t: number): CameraShot {
    if (s.kind === 'land') return t < LAND_HIT ? shotToward(handShot, landShot, ease(t / LAND_HIT)) : shotToward(landShot, worldShot, ease(seg(t, LAND_HIT, LAND_STOP)));
    if (s.kind === 'area') {
      const e = ease(seg(t, 0, AREA_STOP));
      // At its stop and after, the board's own shot, exactly: the way out holds it.
      return e >= 1 ? stopShot(s.i) : turnedRound(aroundShot(frontShot(s.i - 1), frontShot(s.i), C, e), C, floorTurn(s.i - 1) + FLOOR_TURN * e);
    }
    // The way out: the last board's stop, held.
    return stopShot(count - 1);
  }

  function frameAt(q: number): WorldFrame {
    const qq = Math.max(q, 0);
    const { s, t } = segmentAt(qq);
    // The Q&A: its place, from its door on, and the way out's stage there.
    const place = qaPlaceAt(c, qq + START);
    const qa: QaFrame | null = place === null ? null : { place, out: wayOutAt(place) };
    const out = qa !== null && qa.place > -1 ? qa.out : null;
    const shot = out !== null ? wayOutShot(out) : shotAt(s, t);
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
    const light: LightPose = {
      position,
      radius: hand.radius,
      glow: hand.glow * (1 - black),
      stretch: 0,
      yaw: Math.atan2(-forward[0], -forward[2]),
      trail,
      trailLevel: handTrail
    };

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
    } else if (s.kind === 'qa') {
      // The way out holds the last board's stop as it stood (the world's, with no board).
      const stop = count - 1;
      levels = levelsAt(stop);
      boardLight = boardLightAt(stop);
      names = 1;
      caption = stop >= 0 ? { index: stop, opacity: 1 } : null;
      dots = stop >= 0 ? 1 : 0;
    }
    // The gyroscope rings: lit with the power board's power, stepped back at a board's stop (and in the way out).
    let focus = 1;
    if (s.kind === 'area') focus = lerp(s.i === 0 ? 1 : RINGS_FOCUS, RINGS_FOCUS, ease(seg(t, 0, AREA_STOP)));
    else if (s.kind === 'qa') focus = count > 0 ? RINGS_FOCUS : 1;
    // The way out: the floors close, every board lit as one, and the floor's words go as the close starts.
    if (out !== null) {
      explode = 1 - out.close;
      boardLight = mixLight(boardLight, boardLightAt(-1), out.close);
      const keep = 1 - seg(out.g, 0, WORDS_GO);
      names *= keep;
      dots *= keep;
      if (caption !== null) caption = { index: caption.index, opacity: caption.opacity * keep };
    }
    if (caption !== null && caption.opacity <= 0) caption = null;

    return {
      part: s.kind,
      index: s.kind === 'area' ? s.i : -1,
      t,
      shot,
      light,
      void: { ...handVoid, ringMist: 0, stream: handStream },
      power,
      flash,
      explode,
      boardPower: boardPowerAt(power),
      boardLight,
      levels,
      names,
      caption,
      dots,
      skip: qq >= WORLD_Q - 1e-9 && qq <= DOOR_Q + 1e-9,
      black,
      qa,
      rings: { level: (boardPowerAt(power)[0] ?? power) * (out === null || out.solid ? 1 : 0), focus },
      fog: out !== null ? wayOutFog(out) : fogFor(shot)
    };
  }

  const sights: [Vec3, Vec3][] = [landShot, worldShot, ...boardShots, lookShot].map((shot) => [[...shot.position] as Vec3, [...shot.target] as Vec3]);

  return { places, projects: projectIds, centre: C, worldShot, areaShot: (i) => stopShot(i), lookShot, closedShot, machine, sights, frameAt };
}

/** The last path made by `worldPathFor`, and the aspect it was made for. */
let kept: { aspect: number; path: WorldPath } | null = null;

/** The home's stack path on a screen of this aspect, kept for the last aspect asked: every frame asks, and a resize makes it anew. */
export function worldPathFor(aspect: number): WorldPath {
  if (kept === null || kept.aspect !== aspect) kept = { aspect, path: makeWorldPath(aspect) };
  return kept.path;
}
