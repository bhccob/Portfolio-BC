/**
 * An open project's touch points in two neat columns beside it (spec 2026-10-27-bob-hologram-world-design.md, goal 5; the
 * mock-up's `column1`): each a thin line from its point on the object out to its column's line, then level under its
 * words. The points split by their side of the object, the left half to a column left of it and the rest right (all to
 * one side where the other has no room), each column in its points' order down the screen, a line apart, every label of
 * a column turning at one line so no line runs into another's words, all of it inside the screen and clear of the open
 * project's panel and controls. Pure: the scene puts the points on the screen, src/ui/TouchPoints.tsx stands the lines
 * and the words there.
 */

/** A touch point on the screen, CSS px, and its words' width. */
export interface TouchMark {
  x: number;
  y: number;
  w: number;
}

/** Where a touch point's words stand: its line's three points, its words' left and top (on the level run), its side. */
export interface TouchPlaced {
  points: [number, number][];
  left: number;
  top: number;
  side: -1 | 1;
}

/** How far the words keep from the screen's sides, px; and from its foot. */
const EDGE = 12;
const FOOT = 24;
/** How far a column stands out past the object's reach, px at 1440 wide: less on a phone. */
const OUT = { desk: 46, phone: 20 } as const;
/** Below this width a screen is a phone's. */
const PHONE = 700;
/** How far above its point a label's rule runs, and the least room between two labels of a column, px at 1440 wide. */
const RISE = 14;
const LINE = 40;
const LINE_MIN = 26;
/** The room between the rule's elbow and the words, and the words' own gap on it, px. */
const PAD = 8;
const INSET = 4;

/**
 * Each of `marks` placed (in their order): the object's middle at `centreX` and its half width on the screen `reach`, on
 * `screen`, the mock-up's px scaled by `scale` (src/ui/nameLine.ts `nameScale`), the labels kept right of `keep.left`
 * (the panel beside the object) and their rules above `keep.bottom` (the panel below it, the controls).
 */
export function touchColumns(
  marks: readonly TouchMark[],
  centreX: number,
  reach: number,
  screen: { width: number; height: number },
  scale: number,
  keep: { left: number; bottom: number } = { left: 0, bottom: screen.height }
): TouchPlaced[] {
  const placed: TouchPlaced[] = new Array(marks.length);
  const byX = marks.map((_, k) => k).sort((a, b) => marks[a]!.x - marks[b]!.x);
  const out = (screen.width < PHONE ? OUT.phone : OUT.desk) * scale;
  const edgeOf = (side: -1 | 1): number => centreX + side * (reach + out);
  const widest = (ks: readonly number[]): number => ks.reduce((most, k) => Math.max(most, marks[k]!.w + PAD), 0);
  const minLeft = Math.max(EDGE, keep.left + EDGE);
  const maxRight = screen.width - EDGE;
  // Half each side; all to one side where the other has no room for its labels and this one has room for them all.
  let half = Math.floor(byX.length / 2);
  const leftRoom = edgeOf(-1) - minLeft;
  const rightRoom = maxRight - edgeOf(1);
  if (leftRoom < widest(byX.slice(0, half)) && rightRoom >= widest(byX)) half = 0;
  else if (rightRoom < widest(byX.slice(half)) && leftRoom >= widest(byX)) half = byX.length;
  const columns: [-1 | 1, number[]][] = [
    [-1, byX.slice(0, half)],
    [1, byX.slice(half)]
  ];
  const gap = Math.max(LINE_MIN, LINE * scale);
  const foot = Math.min(screen.height - FOOT, keep.bottom - EDGE);
  for (const [side, column] of columns) {
    column.sort((a, b) => marks[a]!.y - marks[b]!.y);
    const ys = column.map((k) => marks[k]!.y - RISE * scale);
    for (let n = 1; n < ys.length; n++) ys[n] = Math.max(ys[n]!, ys[n - 1]! + gap);
    // A column that runs past its foot moves up whole.
    const over = ys.length > 0 ? ys[ys.length - 1]! - foot : 0;
    if (over > 0) for (let n = 0; n < ys.length; n++) ys[n] = ys[n]! - over;
    // The column's one line: out past the object, pulled in where its widest label would not fit.
    const x = side < 0 ? Math.max(edgeOf(-1), minLeft + widest(column)) : Math.min(edgeOf(1), maxRight - widest(column));
    column.forEach((k, n) => {
      const mark = marks[k]!;
      const width = mark.w + PAD;
      const end = x + side * width;
      const top = ys[n]!;
      placed[k] = {
        points: [
          [mark.x, mark.y],
          [x, top],
          [end, top]
        ],
        left: side < 0 ? end : x + INSET,
        top,
        side
      };
    });
  }
  return placed;
}
