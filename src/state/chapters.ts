import { type CategoryId, categories } from '~/data/categories';
import { type Project, type ProjectId, projects } from '~/data/projects';
import { RING_QUESTIONS } from '~/data/qa';

/** One board of the quantum stack (spec 2026-10-28-bob-quantum-stack-design.md): a category and its projects on the way. */
export interface AreaSpec {
  category: CategoryId;
  projects: ProjectId[];
}

/**
 * The projects on the way grouped by category, an area each, in the categories' number order (01, 02, 03); within an
 * area in the way's order. A category with no project on the way has no area.
 */
export function areasOnPath(list: readonly Project[] = projects.onPath()): AreaSpec[] {
  return categories
    .all()
    .map((category) => ({ category: category.id, projects: list.filter((p) => p.categoryId === category.id).map((p) => p.id) }))
    .filter((area) => area.projects.length > 0);
}

/**
 * The chapters of the home scroll, in order. A chapter is a stretch of scroll; the scene's phase follows it. They are the
 * light's path (spec 2026-10-27-bob-light-path-design.md), after the light dive (2026-10-25-bob-light-dive-design.md):
 * - HOME, the rise from the home to BOB seen from above;
 * - LIGHT, the light dive: the needle lighting up into a light that flows away through the void past Bob's facts (the
 *   way's frames 1 to `HAND_F` of the previs, tools/blender/light_dive.py), where the path takes the light over;
 * - LAND, the quantum stack (spec 2026-10-28-bob-quantum-stack-design.md): the light falling on into the CPU on the
 *   power board at the top of the stack, the closed stack exploding open, the power running down it board by board and
 *   the camera settling on the whole machine, its stop (`LAND_STOP`) the world's;
 * - for each category of the projects on the way, in the categories' order: AREA, the camera going round the stack's
 *   axis and down to the category's board, seen from just under the board above it, its stop (`AREA_STOP`) the board at
 *   rest;
 * - LOOK, the camera pulling back and up over the whole machine;
 * - QA, one for each mark on the Q&A's gold ring (spec 2026-10-29-bob-stack-2-design.md, goal 1): the first from the
 *   look back's stop into the first question, the stack closing under the ring, then one to each question after it, and
 *   the last to the end's mark;
 * - END, the end's mark at rest, the scroll's last stop.
 */
export type ChapterId = 'HOME' | 'LIGHT' | 'LAND' | 'AREA' | 'LOOK' | 'QA' | 'END';

export interface ChapterUnit {
  id: ChapterId;
  /** Where the unit starts on the scroll axis, in units (one unit is one viewport height of scroll). */
  start: number;
  length: number;
  /** The category of an AREA unit; null for every other chapter. */
  category: string | null;
  /** An AREA unit's place among the areas, 0 for the first; a QA unit's mark, 0 to `RING_QUESTIONS`; null for every other chapter. */
  project: number | null;
  /** An AREA unit's projects on the way, in the way's order; null for every other chapter. */
  projects: readonly ProjectId[] | null;
}

export interface Chapters {
  units: ChapterUnit[];
  total: number;
}

export interface ChapterSpec {
  /** The areas of the world, in order (`areasOnPath`): each has an AREA unit. */
  areas: readonly AreaSpec[];
  /** The questions on the ring (`RING_QUESTIONS` unless given): each has a QA unit, and the end's mark one more. */
  questions?: number;
}

/** How far outside a chapter, in units, the scroll may drift before the chapter changes: it stops a boundary from flickering. */
export const HYSTERESIS = 0.02;

/** The way's frames in the previs (1 to 300). */
const WAY_FRAMES = 300;

/**
 * The light dive's pace: its 299 frames over this many viewport heights. Six, twice the first mock-up's three, so each of
 * Bob's facts stays on the screen for twice the scroll (spec 2026-10-27-bob-engraved-way-design.md: "the facts just go by
 * too fast"). The frames, the light's places and the facts do not change, only the scroll each frame takes.
 */
export const FALL_PACE = 6;

/** The way frame at which the path takes the light over from the light dive (the light path mock-up's hand-over). */
export const HAND_F = 256;

/** The light dive's length in units: its frames 1 to `HAND_F` at its pace (`placeOfFrame(HAND_F)` is its end, exactly). */
export const LIGHT_UNITS = (FALL_PACE * (HAND_F - 1)) / (WAY_FRAMES - 1);

/** The way frames at which each of Bob's five facts is at full strength: the middle of its 40 frames (61 + 40 i + 20). */
export const FACT_PEAKS = [81, 121, 161, 201, 241] as const;

/**
 * The world's lengths in units (my calls, after the mock-up's pace): the land, from the hand-over to the world at rest;
 * each area, from the stop before to the area at rest; and the look back. Each QA unit is one: a step of the scroll
 * there is a turn of the ring, whatever its size (src/input/target.ts). The land is `LAND_DROP` to the light's hit on
 * the lid (Bob, 2026-10-29: the drop "too fast", now twice its 0.63; spec 2026-10-29-bob-stack-3-design.md, goal 1) and
 * 2.2 after it, where it had 1.17, for the tower's slow power-on as the camera pulls back (Bob, 2026-10-30).
 */
export const LAND_DROP = 1.26;
export const WORLD_LAYOUT = { land: LAND_DROP + 2.2, area: 1.4, look: 1.6, qa: 1 } as const;

/**
 * HOME 1, LIGHT `LIGHT_UNITS`, LAND, then an AREA for each area of the world, then LOOK, a QA for each mark on the ring
 * (`questions` and the end's) and END 1. The scroll ends on the last stop, the end's mark (`scrollEnd`), and never goes
 * into the END unit; `total` is where the units end. Nothing here is a pixel: the scroll input turns pixels into units.
 */
export function buildChapters(spec: ChapterSpec): Chapters {
  const none = { category: null, project: null, projects: null };
  const lengths: Omit<ChapterUnit, 'start'>[] = [
    { id: 'HOME', length: 1, ...none },
    { id: 'LIGHT', length: LIGHT_UNITS, ...none },
    { id: 'LAND', length: WORLD_LAYOUT.land, ...none },
    ...spec.areas.map((area, project): Omit<ChapterUnit, 'start'> => ({
      id: 'AREA',
      length: WORLD_LAYOUT.area,
      category: area.category,
      project,
      projects: [...area.projects]
    })),
    { id: 'LOOK', length: WORLD_LAYOUT.look, ...none },
    ...Array.from({ length: (spec.questions ?? RING_QUESTIONS) + 1 }, (_, mark): Omit<ChapterUnit, 'start'> => ({ id: 'QA', length: WORLD_LAYOUT.qa, ...none, project: mark })),
    { id: 'END', length: 1, ...none }
  ];
  let start = 0;
  const units = lengths.map((unit) => {
    const placed = { ...unit, start };
    start += unit.length;
    return placed;
  });
  return { units, total: start };
}

/** The chapters of the home page: the rise, the light dive, the world and its areas, the look back and the ring's questions. */
export const HOME_CHAPTERS: Chapters = buildChapters({ areas: areasOnPath() });

export interface ChapterAt {
  index: number;
  id: ChapterId;
  /** How far through the unit, 0 to 1. */
  local: number;
  category: string | null;
  project: number | null;
}

/**
 * The chapter that position `p` is in (`p` is clamped to the scroll's range). With `previous`, the chapter
 * it was in last time is kept while `p` is within HYSTERESIS outside it, so a position resting on a boundary
 * does not change chapter back and forth.
 */
export function chapterAt(c: Chapters, p: number, previous?: { index: number }): ChapterAt {
  const position = Math.min(Math.max(p, 0), c.total);
  const last = c.units.length - 1;
  let index = c.units.findIndex((unit) => position >= unit.start && position < unit.start + unit.length);
  if (index === -1) index = last; // position === total

  const held = previous ? c.units[previous.index] : undefined; // undefined for an index that is not a unit
  if (previous && held && position >= held.start - HYSTERESIS && position <= held.start + held.length + HYSTERESIS) index = previous.index;

  const unit = c.units[index]!;
  const local = Math.min(Math.max((position - unit.start) / unit.length, 0), 1);
  return { index, id: unit.id, local, category: unit.category, project: unit.project };
}

/** Where scrolling comes to rest: the start of each chapter. The last is the end of the scroll (`scrollEnd`). */
export function stops(c: Chapters): number[] {
  return c.units.map((unit) => unit.start);
}

/**
 * Where the scroll ends: its last stop, the start of the last chapter, the end's mark on the ring. Past it there is
 * nothing to scroll to.
 */
export function scrollEnd(c: Chapters): number {
  return c.units.at(-1)?.start ?? 0;
}

/**
 * The top of the rise: the end of the first chapter (HOME, the home to BOB from above), itself a stop. Up to it the
 * scroll is continuous, as M2a's rise was; from it on the story follows the scroll.
 */
export function riseTop(c: Chapters): number {
  const first = c.units[0];
  return first ? first.start + first.length : 0;
}

/** The start of the unit `id` (the first of them), or NaN where there is none. */
function startOf(c: Chapters, id: ChapterId): number {
  return c.units.find((unit) => unit.id === id)?.start ?? Number.NaN;
}

/** Where the light dive starts: BOB from above, the top of the rise. */
export function lightStart(c: Chapters): number {
  return startOf(c, 'LIGHT');
}

/** Where the world's path starts: the hand-over, way frame `HAND_F`, the light still falling with the last fact beside it. */
export function pathStart(c: Chapters): number {
  return lightStart(c) + LIGHT_UNITS;
}

/** Where the look back starts: the last board at rest, the camera about to pull back over the whole machine. */
export function lookStart(c: Chapters): number {
  return startOf(c, 'LOOK');
}

/** The look back's own stop: the look back at rest, the whole machine in view, where the first QA unit starts. */
export function lookStop(c: Chapters): number {
  return startOf(c, 'QA');
}

/**
 * The stop of mark `k` on the ring (0 to the questions' count): the end of QA unit `k`. Mark `k` is question `k + 1`,
 * and the last is the end's, the scroll's end (`scrollEnd`). Throws for a mark the ring does not have.
 */
export function qaStop(c: Chapters, k: number): number {
  const unit = c.units.find((u) => u.id === 'QA' && u.project === k);
  if (!unit) throw new RangeError(`no mark ${k} on the ring`);
  return unit.start + unit.length;
}

/**
 * Where on the ring place `p` is: -1 at the look back's stop, `k` at mark `k`'s stop, linear between; null before
 * the look back's stop, off the ring.
 */
export function qaPlaceAt(c: Chapters, p: number): number | null {
  const start = lookStop(c);
  if (!(p >= start)) return null;
  const marks = c.units.filter((u) => u.id === 'QA');
  const last = marks.at(-1)!;
  const unit = marks.find((u) => p < u.start + u.length) ?? last;
  return unit.project! - 1 + Math.min(Math.max((p - unit.start) / unit.length, 0), 1);
}

/** The place of the way's frame `f` (1 to `HAND_F`, fractional allowed) on the home's scroll: the light dive, linearly. */
export function placeOfFrame(f: number): number {
  return placeIn(HOME_CHAPTERS, f);
}

/** The way's frame at place `p` of the home's scroll: `placeOfFrame` turned round (and its pace past the light dive too). */
export function frameOfPlace(p: number): number {
  return 1 + ((p - lightStart(HOME_CHAPTERS)) / FALL_PACE) * (WAY_FRAMES - 1);
}

/** The place of way frame `f` on the scroll of chapters `c`, as `frameOfPlace` reads it back: the very same frame. */
function placeIn(c: Chapters, f: number): number {
  return lightStart(c) + (FALL_PACE * (f - 1)) / (WAY_FRAMES - 1);
}

/**
 * Where in the LAND the world's stop stands: the light in the CPU, the stack open and powered, the camera at rest on the
 * whole machine; 1.9 units after the light's hit, the camera's slow pull back over the power-on (Bob, 2026-10-30).
 */
export const LAND_STOP = (LAND_DROP + 1.9) / WORLD_LAYOUT.land;

/** Where in its AREA a board's stop stands: the camera at rest on it, its words shown; the rest of the unit a pause. */
export const AREA_STOP = 0.7;

/** The world's stop: `LAND_STOP` into the land. */
export function worldStop(c: Chapters): number {
  const unit = c.units.find((u) => u.id === 'LAND')!;
  return unit.start + LAND_STOP * unit.length;
}

/** The AREA unit of `category`; throws for a category with no area on the way. */
function areaOf(c: Chapters, category: string): ChapterUnit {
  const unit = c.units.find((u) => u.id === 'AREA' && u.category === category);
  if (!unit) throw new TypeError(`no area on the home's scroll for the category "${category}"`);
  return unit;
}

/** The stop of `category`'s area: `AREA_STOP` into it, the area at rest, its words shown. */
export function areaStop(c: Chapters, category: string): number {
  const unit = areaOf(c, category);
  return unit.start + AREA_STOP * unit.length;
}

/**
 * Where a key steps (an arrow, Page Up or Down, Space, and every step with reduced motion): the home, BOB from above,
 * each fact at full strength (`FACT_PEAKS`), the world, each area, the look back and each mark on the ring, the last the
 * scroll's end.
 */
export function keyStops(c: Chapters): number[] {
  const facts = FACT_PEAKS.map((f) => placeIn(c, f));
  const areas = c.units.filter((u) => u.id === 'AREA').map((u) => u.start + AREA_STOP * u.length);
  const marks = c.units.filter((u) => u.id === 'QA').map((u) => u.start + u.length);
  return [0, riseTop(c), ...facts, worldStop(c), ...areas, lookStop(c), ...marks];
}
