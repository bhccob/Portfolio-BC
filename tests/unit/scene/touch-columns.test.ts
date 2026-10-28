import { describe, expect, it } from 'vitest';
import { touchColumns } from '~/scene/bob/touchColumns';

const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

describe("touchColumns: an open project's touch points in two neat columns beside it", () => {
  it('splits the points into two columns by their side', () => {
    const marks = [
      { x: 700, y: 400, w: 80 },
      { x: 760, y: 420, w: 90 },
      { x: 690, y: 470, w: 60 },
      { x: 770, y: 380, w: 70 },
      { x: 735, y: 500, w: 100 }
    ];
    const placed = touchColumns(marks, 730, 120, DESK, 1);
    // The two furthest left go left, the rest right; each label's line runs from its own point.
    expect(placed.map((p) => p.side)).toEqual([-1, 1, -1, 1, 1]);
    placed.forEach((p, k) => expect(p.points[0]).toEqual([marks[k]!.x, marks[k]!.y]));
    // A left label ends left of the object's reach, a right one starts right of it, each by the column's gap.
    for (const p of placed) {
      if (p.side < 0) expect(p.left + marks[placed.indexOf(p)]!.w).toBeLessThanOrEqual(730 - 120);
      else expect(p.left).toBeGreaterThanOrEqual(730 + 120);
      // The rule runs level under the words, out from the elbow.
      expect(p.points[1]![1]).toBe(p.top);
      expect(p.points[2]![1]).toBe(p.top);
    }
  });

  it('keeps a line between two labels', () => {
    const marks = [0, 1, 2, 3, 4, 5].map((k) => ({ x: k % 2 === 0 ? 600 : 900, y: 450 + (k % 3), w: 90 }));
    for (const [screen, scale] of [
      [DESK, 1],
      [PHONE, 0.39]
    ] as const) {
      const placed = touchColumns(marks, 750, 80, screen, scale);
      for (const side of [-1, 1]) {
        const tops = placed
          .filter((p) => p.side === side)
          .map((p) => p.top)
          .sort((a, b) => a - b);
        for (let n = 1; n < tops.length; n++) expect(tops[n]! - tops[n - 1]!).toBeGreaterThanOrEqual(Math.max(26, 40 * scale) - 1e-9);
      }
    }
  });

  it("turns every label of a column at one line, so no line runs into another's words", () => {
    const marks = [
      { x: 520, y: 500, w: 60 },
      { x: 470, y: 520, w: 150 },
      { x: 300, y: 300, w: 120 },
      { x: 280, y: 480, w: 80 },
      { x: 500, y: 470, w: 110 }
    ];
    for (const [screen, scale] of [
      [DESK, 1],
      [PHONE, 0.39]
    ] as const) {
      const placed = touchColumns(marks, 380, 70, screen, scale);
      for (const side of [-1, 1] as const) {
        const elbows = placed.filter((p) => p.side === side).map((p) => p.points[1]![0]);
        expect(new Set(elbows).size, `side ${side}`).toBeLessThanOrEqual(1);
        // Each label's words stand wholly beyond that line, away from the object.
        placed.forEach((p, k) => {
          if (p.side !== side) return;
          if (side > 0) expect(p.left).toBeGreaterThan(p.points[1]![0]);
          else expect(p.left + marks[k]!.w).toBeLessThan(p.points[1]![0]);
        });
      }
    }
  });

  it('keeps clear of the panel beside the object and of the controls below it', () => {
    const marks = [
      { x: 700, y: 330, w: 110 },
      { x: 760, y: 470, w: 140 },
      { x: 1100, y: 600, w: 100 },
      { x: 1150, y: 690, w: 90 }
    ];
    // The panel ends at 510 px: no room left of the object, so every label goes right of it.
    const beside = touchColumns(marks, 930, 280, DESK, 1, { left: 510, bottom: 800 });
    expect(beside.map((p) => p.side)).toEqual([1, 1, 1, 1]);
    for (const p of beside) expect(p.top).toBeLessThanOrEqual(800 - 12);
    // With room left of it, the two columns stay, the left one clear of the panel.
    const roomy = touchColumns(marks, 930, 120, DESK, 1, { left: 400, bottom: 900 });
    expect(roomy.map((p) => p.side)).toEqual([-1, -1, 1, 1]);
    roomy.forEach((p) => {
      if (p.side < 0) expect(p.left).toBeGreaterThanOrEqual(400 + 12);
    });
    // On a phone the panel is below the object: the labels stay above it.
    const above = touchColumns(marks.map((m) => ({ ...m, x: m.x / 4, y: m.y / 2 + 200 })), 230, 60, PHONE, 0.39, { left: 0, bottom: 480 });
    for (const p of above) expect(p.top).toBeLessThanOrEqual(480 - 12);
  });

  it('keeps every label on the screen', () => {
    const marks = [
      { x: 30, y: 300, w: 140 },
      { x: 360, y: 320, w: 160 },
      { x: 40, y: 800, w: 120 },
      { x: 350, y: 830, w: 150 },
      { x: 200, y: 835, w: 130 }
    ];
    for (const screen of [PHONE, DESK]) {
      const placed = touchColumns(marks, 200, 90, screen, screen === PHONE ? 0.39 : 1);
      placed.forEach((p, k) => {
        expect(p.left, `${k} left`).toBeGreaterThanOrEqual(12);
        expect(p.left + marks[k]!.w, `${k} right`).toBeLessThanOrEqual(screen.width - 12);
        expect(p.top, `${k} top`).toBeGreaterThanOrEqual(0);
        expect(p.top, `${k} bottom`).toBeLessThanOrEqual(screen.height - 24);
      });
    }
  });
});
