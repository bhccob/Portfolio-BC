/**
 * The touch points inside a bead (spec 2026-10-27-bob-light-path-design.md, "Into the bead"): each project's own test
 * points (src/data/projects.ts), shown on the parts they name as the camera goes in, as the light path mock-up Bob
 * approved pins them (.superpowers/light-path-mockup/Mock.tsx, `insideOf`). Pure: the scene (src/scene/bob/Void.tsx)
 * puts each anchor on the screen, and src/ui/TouchPoints.tsx stands the words there.
 */
import type { ProjectId } from '~/data/projects';

/** Where a touch point is pinned: a part of the bead's object (a node of the beads' file), or a corner of its screen. */
export type TouchAnchor = { node: string } | { corner: 'tl' | 'tr' | 'bl' | 'br' };

/** Where a touch point's words stand from its anchor. */
export type TouchSide = 'left' | 'right' | 'above' | 'below' | 'below2';

/** A touch point: its anchor and its side, in the order of the project's test points. */
export interface TouchPlace {
  anchor: TouchAnchor;
  place: TouchSide;
}

/**
 * Each project's touch points, in the order of its test points: Funcial's on the four pins of its track and the
 * abacus's fifth bead (the verdict); Jontai Energy's round its tablet; Cookies Clicker's loop on the balance, its
 * producers and boosts on the train, its save and stats on the screen.
 */
export const TOUCH_POINTS: Readonly<Record<ProjectId, readonly TouchPlace[]>> = {
  funcial: [
    { anchor: { node: 'funcial_pin_1' }, place: 'below' },
    { anchor: { node: 'funcial_pin_2' }, place: 'below2' },
    { anchor: { node: 'funcial_pin_3' }, place: 'below' },
    { anchor: { node: 'funcial_pin_4' }, place: 'below2' },
    { anchor: { node: 'funcial_bead_5' }, place: 'above' }
  ],
  'jontai-energy': [
    { anchor: { corner: 'tl' }, place: 'left' },
    { anchor: { corner: 'bl' }, place: 'left' },
    { anchor: { corner: 'tr' }, place: 'right' },
    { anchor: { corner: 'br' }, place: 'right' }
  ],
  'cookies-clicker': [
    { anchor: { node: 'cookies_balance' }, place: 'above' },
    { anchor: { node: 'cookies_wheel_4' }, place: 'below' },
    { anchor: { node: 'cookies_wheel_8' }, place: 'below2' },
    { anchor: { corner: 'bl' }, place: 'below' },
    { anchor: { corner: 'tr' }, place: 'right' }
  ]
};

/** How far the words stand from their anchor, px: beside it, above it, below it, and further below for a second row. */
const GAP = { side: 12, above: 16, below: 16, below2: 40 } as const;

/** How near the screen's sides the words may come, px. */
const EDGE = 10;

/**
 * Where a touch point's words (`el`, their box) stand from its anchor `at` (CSS px) by its side, on a screen `width`
 * wide: their top-left corner, held inside the screen's sides.
 */
export function touchBox(at: { x: number; y: number }, place: TouchSide, el: { w: number; h: number }, width: number): { x: number; y: number } {
  const [x, y] =
    place === 'left'
      ? [at.x - el.w - GAP.side, at.y - el.h / 2]
      : place === 'right'
        ? [at.x + GAP.side, at.y - el.h / 2]
        : place === 'above'
          ? [at.x - el.w / 2, at.y - el.h - GAP.above]
          : [at.x - el.w / 2, at.y + (place === 'below' ? GAP.below : GAP.below2)];
  return { x: Math.min(Math.max(x, EDGE), Math.max(EDGE, width - el.w - EDGE)), y };
}
