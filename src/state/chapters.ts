import { projects } from '~/data/projects';

/**
 * The chapters of the home scroll, in order. A chapter is a stretch of scroll; the scene's phase follows it. They are the
 * light's path (spec 2026-10-27-bob-light-path-design.md), after the light dive (2026-10-25-bob-light-dive-design.md):
 * - HOME, the rise from the home to BOB seen from above;
 * - LIGHT, the light dive: the needle lighting up into a light that flows away through the void past Bob's facts (the
 *   way's frames 1 to `HAND_F` of the previs, tools/blender/light_dive.py), where the path takes the light over;
 * - for each project on the way, in order: TRAVEL, the light leading on to its bead; ORBIT, the light circling it and
 *   coming to rest on its right; INSIDE, the camera through its glass, its object building with the scroll;
 * - LOOK, the camera pulling back over the whole way;
 * - SHEET, the look back fading to black and the credits rising from below;
 * - END, the credits at rest, the scroll's last stop.
 */
export type ChapterId = 'HOME' | 'LIGHT' | 'TRAVEL' | 'ORBIT' | 'INSIDE' | 'LOOK' | 'SHEET' | 'END';

export interface ChapterUnit {
  id: ChapterId;
  /** Where the unit starts on the scroll axis, in units (one unit is one viewport height of scroll). */
  start: number;
  length: number;
  /** The category of the project of a TRAVEL, ORBIT or INSIDE unit; null for every other chapter. */
  category: string | null;
  /** That project's place on the way, 0 for the first; null for every other chapter. */
  project: number | null;
}

export interface Chapters {
  units: ChapterUnit[];
  total: number;
}

export interface ChapterSpec {
  /** The categories of the projects on the way, in order: each has a TRAVEL, an ORBIT and an INSIDE. */
  path: readonly string[];
}

/** How far outside a chapter, in units, the scroll may drift before the chapter changes: it stops a boundary from flickering. */
export const HYSTERESIS = 0.02;

/**
 * The way's frames in the previs (1 to 300): the light dive's pace is its 299 frames over three viewport heights, as the
 * mock-up Bob approved scrolled them.
 */
const WAY_FRAMES = 300;

/** The way frame at which the path takes the light over from the light dive (the light path mock-up's hand-over). */
export const HAND_F = 256;

/** The light dive's length in units: its frames 1 to `HAND_F` at its pace (`placeOfFrame(HAND_F)` is its end, exactly). */
export const LIGHT_UNITS = (3 * (HAND_F - 1)) / (WAY_FRAMES - 1);

/** The way frames at which each of Bob's five facts is at full strength: the middle of its 40 frames (61 + 40 i + 20). */
export const FACT_PEAKS = [81, 121, 161, 201, 241] as const;

/**
 * The path's lengths in units, from the light path mock-up Bob approved (.superpowers/light-path-mockup/path.ts,
 * `LAYOUT`): each project's travel (the first three; a later one is the third's), its orbit and its inside, and the look
 * back. The sheet is one unit: its first 0.55 the fade to black, the rest the credits rising.
 */
export const PATH_LAYOUT = { travel: [1.25, 1.45, 1.55], orbit: 1.45, inside: 1.35, look: 1.9 } as const;

/** The travel to the project at place `i` on the way. */
function travelLength(i: number): number {
  return PATH_LAYOUT.travel[Math.min(i, PATH_LAYOUT.travel.length - 1)]!;
}

/**
 * HOME 1, LIGHT `LIGHT_UNITS`, then TRAVEL, ORBIT and INSIDE for each project on the way, then LOOK, SHEET 1 and END 1.
 * The scroll ends on the last stop, the credits' (`scrollEnd`), and never goes into the END unit; `total` is where the
 * units end. Nothing here is a pixel: the scroll input turns pixels into units.
 */
export function buildChapters(spec: ChapterSpec): Chapters {
  const lengths: Omit<ChapterUnit, 'start'>[] = [
    { id: 'HOME', length: 1, category: null, project: null },
    { id: 'LIGHT', length: LIGHT_UNITS, category: null, project: null },
    ...spec.path.flatMap((category, project): Omit<ChapterUnit, 'start'>[] => [
      { id: 'TRAVEL', length: travelLength(project), category, project },
      { id: 'ORBIT', length: PATH_LAYOUT.orbit, category, project },
      { id: 'INSIDE', length: PATH_LAYOUT.inside, category, project }
    ]),
    { id: 'LOOK', length: PATH_LAYOUT.look, category: null, project: null },
    { id: 'SHEET', length: 1, category: null, project: null },
    { id: 'END', length: 1, category: null, project: null }
  ];
  let start = 0;
  const units = lengths.map((unit) => {
    const placed = { ...unit, start };
    start += unit.length;
    return placed;
  });
  return { units, total: start };
}

/** The chapters of the home page: the rise, the light dive, the path through the projects on the way, the look back, the sheet and the credits. */
export const HOME_CHAPTERS: Chapters = buildChapters({ path: projects.onPath().map((project) => project.categoryId) });

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
 * Where the scroll ends: its last stop, the start of the last chapter, the credits'. Past it there is nothing to
 * scroll to: the credits are an ordinary page that scrolls natively, so scrolling into its unit would be a unit of
 * scroll that changes nothing.
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

/** Where the path starts: the hand-over, way frame `HAND_F`, the light still falling with the last fact beside it. */
export function pathStart(c: Chapters): number {
  return lightStart(c) + LIGHT_UNITS;
}

/** Where the look back starts: the camera inside the last bead, about to pull back over the whole way. */
export function lookStart(c: Chapters): number {
  return startOf(c, 'LOOK');
}

/** Where the sheet starts: the look back at rest, the whole way in view; also the look back's own stop. */
export function sheetStart(c: Chapters): number {
  return startOf(c, 'SHEET');
}

/** The place of the way's frame `f` (1 to `HAND_F`, fractional allowed) on the home's scroll: the light dive, linearly. */
export function placeOfFrame(f: number): number {
  return placeIn(HOME_CHAPTERS, f);
}

/** The way's frame at place `p` of the home's scroll: `placeOfFrame` turned round (and its pace past the light dive too). */
export function frameOfPlace(p: number): number {
  return 1 + ((p - lightStart(HOME_CHAPTERS)) / 3) * (WAY_FRAMES - 1);
}

/** The place of way frame `f` on the scroll of chapters `c`, as `frameOfPlace` reads it back: the very same frame. */
function placeIn(c: Chapters, f: number): number {
  return lightStart(c) + (3 * (f - 1)) / (WAY_FRAMES - 1);
}

/** The end of the unit `id` of the project of `category`; throws for a category that is not on the way. */
function endOf(c: Chapters, id: ChapterId, category: string): number {
  const unit = c.units.find((u) => u.id === id && u.category === category);
  if (!unit) throw new TypeError(`no ${id.toLowerCase()} on the home's scroll for the category "${category}"`);
  return unit.start + unit.length;
}

/** The arrival stop of the project of `category`: the end of its orbit, the light at rest on the bead's right, its label shown. */
export function arrivalStop(c: Chapters, category: string): number {
  return endOf(c, 'ORBIT', category);
}

/** The inside stop of the project of `category`: the end of its inside, its object built. */
export function insideStop(c: Chapters, category: string): number {
  return endOf(c, 'INSIDE', category);
}

/**
 * Where a key steps (an arrow, Page Up or Down, Space, and every step with reduced motion): the home, BOB from above,
 * each fact at full strength (`FACT_PEAKS`), each project's arrival and inside, the look back and the credits.
 */
export function keyStops(c: Chapters): number[] {
  const facts = FACT_PEAKS.map((f) => placeIn(c, f));
  const path = c.units.filter((u) => u.id === 'ORBIT' || u.id === 'INSIDE').map((u) => u.start + u.length);
  return [0, riseTop(c), ...facts, ...path, sheetStart(c), scrollEnd(c)];
}
