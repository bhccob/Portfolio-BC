import { categories } from '~/data/categories';

/**
 * The chapters of the home scroll, in order. A chapter is a stretch of scroll; the scene's phase follows it.
 * They are BOB's: HOME is the rise from the home to BOB seen from above, DIVE the camera dropping through the O
 * and out under the glass, VOID_ENTRY the overview of all the beads, PROJECTS one unit per project (the
 * needle points at that bead) and END the end page, the scroll's last stop (spec 2026-10-24-bob-end-page-design.md).
 */
export type ChapterId = 'HOME' | 'DIVE' | 'VOID_ENTRY' | 'PROJECTS' | 'END';

export interface ChapterUnit {
  id: ChapterId;
  /** Where the unit starts on the scroll axis, in units (one unit is one viewport height of scroll). */
  start: number;
  length: number;
  /** The project category of a PROJECTS unit; null for every other chapter. */
  category: string | null;
}

export interface Chapters {
  units: ChapterUnit[];
  total: number;
}

export interface ChapterSpec {
  /** The project categories in order: PROJECTS is one unit for each. */
  categories: readonly string[];
}

/** How far outside a chapter, in units, the scroll may drift before the chapter changes: it stops a boundary from flickering. */
export const HYSTERESIS = 0.02;

/**
 * HOME 1, DIVE 1, VOID_ENTRY 1, then one unit for each project category, then END 1: with the three projects, seven
 * units in all, and the scroll rests at seven stops, the starts of the seven units. Each unit is one stop of the scroll
 * (spec §2.3, "The scroll's stretches", which counted six, to the last bead; 2026-10-24: a seventh, the end page,
 * follows Cookies Clicker). The last project's unit (5 to 6) is the move from its bead into the night, and the scroll
 * ends on the last stop, the end page's, and never goes into the END unit (`scrollEnd`); `total` is where the units
 * end. Nothing here is a pixel: the scroll input turns pixels into units.
 */
export function buildChapters(spec: ChapterSpec): Chapters {
  const lengths: Omit<ChapterUnit, 'start'>[] = [
    { id: 'HOME', length: 1, category: null },
    { id: 'DIVE', length: 1, category: null },
    { id: 'VOID_ENTRY', length: 1, category: null },
    ...spec.categories.map((category) => ({ id: 'PROJECTS' as const, length: 1, category })),
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

/** The chapters of the home page: BOB's stretches, the project categories as the data lists them, then the end page. */
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
