import { categories } from '~/data/categories';

/**
 * The chapters of the home scroll, in order. A chapter is a stretch of scroll; the scene's phase follows it. They are the
 * light dive's (spec 2026-10-25-bob-light-dive-design.md): HOME is the rise from the home to BOB seen from above; LIGHT
 * the light dive, the needle lighting up into a light that flows away through the void past Bob's facts and lands as the
 * needle at the ring's centre (the way's frames 1 to 300 of the previs, tools/blender/light_dive.py); RING the camera
 * turning round the ring of projects, one unit from each project to the next, exactly with the scroll; SHEET the end
 * page sliding up from below over the last project; and END the end page, the scroll's last stop.
 */
export type ChapterId = 'HOME' | 'LIGHT' | 'RING' | 'SHEET' | 'END';

export interface ChapterUnit {
  id: ChapterId;
  /** Where the unit starts on the scroll axis, in units (one unit is one viewport height of scroll). */
  start: number;
  length: number;
  /** The project at the start of a RING unit, or the last project for SHEET; null for every other chapter. */
  category: string | null;
}

export interface Chapters {
  units: ChapterUnit[];
  total: number;
}

export interface ChapterSpec {
  /** The project categories in ring order: each but the last starts a RING unit, and the last is SHEET's. */
  categories: readonly string[];
}

/** How far outside a chapter, in units, the scroll may drift before the chapter changes: it stops a boundary from flickering. */
export const HYSTERESIS = 0.02;

/**
 * The light dive's length in units: the mock-up Bob approved scrolled the way's 300 frames over three viewport heights
 * (the first page's four tall, three of scroll).
 */
export const LIGHT_UNITS = 3;

/** The way's frames in the light dive (the previs's 1 to 300; frame 300 is the ring at its first project). */
const WAY_FRAMES = 300;

/** The way frames at which each of Bob's five facts is at full strength: the middle of its 40 frames (61 + 40 i + 20). */
export const FACT_PEAKS = [81, 121, 161, 201, 241] as const;

/**
 * HOME 1, LIGHT `LIGHT_UNITS`, then a RING unit from each project to the next (its category the project at its start),
 * SHEET 1 (the last project's: the end page slides up over it), then END 1: with the three projects HOME 0-1, LIGHT 1-4,
 * RING 4-5 and 5-6, SHEET 6-7 and END from 7. The scroll ends on the last stop, the end page's, and never goes into the
 * END unit (`scrollEnd`); `total` is where the units end. Nothing here is a pixel: the scroll input turns pixels into
 * units.
 */
export function buildChapters(spec: ChapterSpec): Chapters {
  const last = spec.categories.at(-1);
  const lengths: Omit<ChapterUnit, 'start'>[] = [
    { id: 'HOME', length: 1, category: null },
    { id: 'LIGHT', length: LIGHT_UNITS, category: null },
    ...spec.categories.slice(0, -1).map((category) => ({ id: 'RING' as const, length: 1, category })),
    ...(last === undefined ? [] : [{ id: 'SHEET' as const, length: 1, category: last }]),
    { id: 'END', length: 1, category: null },
  ];
  let start = 0;
  const units = lengths.map((unit) => {
    const placed = { ...unit, start };
    start += unit.length;
    return placed;
  });
  return { units, total: start };
}

/** The chapters of the home page: the rise, the light dive, the ring of the project categories as the data lists them, the sheet and the end page. */
export const HOME_CHAPTERS: Chapters = buildChapters({ categories: categories.all().map((category) => category.id) });

export interface ChapterAt {
  index: number;
  id: ChapterId;
  /** How far through the unit, 0 to 1. */
  local: number;
  category: string | null;
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
  return { index, id: unit.id, local, category: unit.category };
}

/** Where scrolling comes to rest: the start of each chapter. The last is the end of the scroll (`scrollEnd`). */
export function stops(c: Chapters): number[] {
  return c.units.map((unit) => unit.start);
}

/**
 * Where the scroll ends: its last stop, the start of the last chapter, the end page's. Past it there is nothing to
 * scroll to: the end page is an ordinary page that scrolls natively, so scrolling into its unit would be a unit of
 * scroll that changes nothing.
 */
export function scrollEnd(c: Chapters): number {
  return c.units.at(-1)?.start ?? 0;
}

/**
 * The top of the rise: the end of the first chapter (HOME, the home to BOB from above), itself a stop. Up to it the
 * scroll is continuous, as M2a's rise was; from it on every input comes to rest on a stop (src/input/target.ts).
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

/** Where the ring starts: its first project in front, the light landed as the needle (the way's frame 300). */
export function ringStart(c: Chapters): number {
  return lightStart(c) + LIGHT_UNITS;
}

/** Where the sheet starts: the last project in front, the end page about to slide up. */
export function sheetStart(c: Chapters): number {
  return startOf(c, 'SHEET');
}

/** The place of the way's frame `f` (1 to 300, fractional allowed) on the home's scroll: the light dive, linearly. */
export function placeOfFrame(f: number): number {
  return lightStart(HOME_CHAPTERS) + (LIGHT_UNITS * (f - 1)) / (WAY_FRAMES - 1);
}

/**
 * The ring stop of the project of `category`: the start of the RING unit it starts, or of SHEET for the last project.
 * Throws for a category that has none.
 */
export function projectStop(c: Chapters, category: string): number {
  const unit = c.units.find((u) => (u.id === 'RING' || u.id === 'SHEET') && u.category === category);
  if (!unit) throw new TypeError(`no ring stop on the home's scroll for the category "${category}"`);
  return unit.start;
}

/**
 * Where a key steps (an arrow, Page Up or Down, Space, and every step with reduced motion): the home, BOB from above,
 * each fact at full strength (`FACT_PEAKS`), each project in front, and the end page.
 */
export function keyStops(c: Chapters): number[] {
  const facts = FACT_PEAKS.map((f) => lightStart(c) + (LIGHT_UNITS * (f - 1)) / (WAY_FRAMES - 1));
  const projects = c.units.filter((u) => u.id === 'RING' || u.id === 'SHEET').map((u) => u.start);
  return [0, riseTop(c), ...facts, ...projects, scrollEnd(c)];
}
