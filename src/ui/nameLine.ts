/**
 * Where a project's name stands on the hologram world (spec 2026-10-27-bob-hologram-world-design.md, goal 2; the mock-up's
 * `place`): a thin line from the object, up and out to an elbow, then level to the words, which stand over the level run.
 * Pure: the scene gives the object's point on the screen, this gives the line and the words' place.
 */
import type { CategoryId } from '~/data/categories';

type Point = [number, number];

/**
 * How far out and up each category's names stand from their objects, CSS px on a screen 1440 wide (the mock-up's): the
 * apps' out to the left, the websites' to the right, game development's, behind the CPU, to the right.
 */
export const NAME_OFFSET: Readonly<Record<CategoryId, Point>> = {
  app: [-190, -78],
  website: [190, -78],
  game: [170, -70]
};

/** The share of the reach out to the elbow; the rest is the level run under the words. */
const ELBOW = 0.22;
/** How far the words keep from the screen's sides, px; and the gap between the words and the elbow when pulled in. */
const EDGE = 12;
const GAP = 6;
/** Below this width a screen is a phone's: the names reach a little further for its size. */
const PHONE = 700;
const PHONE_REACH = 1.45;

/** How the mock-up's px (at 1440 wide) scale on a screen `width` px wide: down with it, never up, more on a phone. */
export function nameScale(width: number): number {
  return Math.min(1, width / 1440) * (width < PHONE ? PHONE_REACH : 1);
}

/** A category's reach on a screen `width` px wide (`nameScale`). */
export function nameOffset(category: CategoryId, width: number): Point {
  const s = nameScale(width);
  const [x, y] = NAME_OFFSET[category];
  return [x * s, y * s];
}

/**
 * The line from `anchor` (the object's top on the screen) out by `offset` to the words of width `textWidth`: its three
 * points, and the words' place (\`left\` for a name out to the left, \`right\` from the screen's right edge for one out to
 * the right, \`top\` at the level run, the words standing on it). Its end is held EDGE px inside the screen, and so are
 * the words, should the object stand near the edge they run back from; the elbow pulled in so the words fit over the
 * level run.
 */
export function nameLine(
  anchor: { x: number; y: number },
  offset: Point,
  textWidth: number,
  screen: { width: number; height: number }
): { points: Point[]; text: { left?: number; right?: number; top: number } } {
  const left = offset[0] < 0;
  const top = anchor.y + offset[1];
  let end = anchor.x + offset[0];
  let elbow = anchor.x + offset[0] * ELBOW;
  end = left ? Math.max(EDGE, end) : Math.min(screen.width - EDGE, end);
  end = left ? Math.min(end, screen.width - EDGE - textWidth) : Math.max(end, EDGE + textWidth);
  elbow = left ? Math.max(end + textWidth + GAP, elbow) : Math.min(end - textWidth - GAP, elbow);
  return {
    points: [
      [anchor.x, anchor.y],
      [elbow, top],
      [end, top]
    ],
    text: left ? { left: end, top } : { right: screen.width - end, top }
  };
}
