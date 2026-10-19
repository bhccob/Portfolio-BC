import { describe, expect, it } from 'vitest';
import type { HubLayerId } from '../../src/scripts/three/HubChoreography';
import {
  CALLOUT_LAYOUT,
  chooseLayout,
  columnAt,
  columnFits,
  placeCallouts,
  placeRightList,
  rightBand,
  type CalloutAnchors
} from '../../src/scripts/ui/Callouts';

const IDS: readonly HubLayerId[] = ['screen', 'board', 'battery', 'back'];

/** Anchors as the hub shows them on a 1600 × 900 stage: down the device's right side, top to bottom. */
function anchors(overrides: Partial<CalloutAnchors> = {}): CalloutAnchors {
  return {
    screen: { x: 1000, y: 190, visible: true },
    frame: { x: 1060, y: 330, visible: true },
    board: { x: 1030, y: 470, visible: true },
    battery: { x: 960, y: 620, visible: true },
    back: { x: 1010, y: 790, visible: true },
    ...overrides
  };
}

/** The path's points: M x y, L x y, H x. */
function points(path: string): number[] {
  return path.match(/-?\d+(\.\d+)?/g)!.map(Number);
}

describe('placeCallouts', () => {
  it('leads each anchor up a short diagonal, then right to a column at 72% of the width, the label just past it', () => {
    const places = placeCallouts(anchors(), IDS, 1600, 900, 260);
    const column = 1600 * CALLOUT_LAYOUT.column;
    expect(Object.keys(places)).toEqual(IDS);
    for (const id of IDS) {
      const { path, dot, label } = places[id]!;
      const [x0, y0, x1, y1, x2] = points(path);
      const anchor = anchors()[id];
      expect([x0, y0]).toEqual([anchor.x, anchor.y]);
      expect(dot).toEqual([anchor.x, anchor.y]);
      // The diagonal rises to the label's line and reaches right, short of the column.
      expect(y1).toBeLessThan(anchor.y);
      expect(x1).toBeGreaterThan(anchor.x);
      expect(x1).toBeLessThanOrEqual(column);
      // The run is horizontal, along the label's middle, and ends at the column.
      expect(x2).toBe(column);
      expect(label).toEqual([column + CALLOUT_LAYOUT.gap, y1]);
      // On a pixel's middle, so the 1px run stays sharp.
      expect(y1 % 1).toBe(0.5);
    }
  });

  it('moves the column left so the widest label ends inside the right edge', () => {
    const places = placeCallouts(anchors({ screen: { x: 700, y: 190, visible: true } }), IDS, 1200, 900, 300);
    const end = 1200 - CALLOUT_LAYOUT.edge - 300;
    expect(places.screen!.label[0] + 300).toBeLessThanOrEqual(1200 - CALLOUT_LAYOUT.edge + 1);
    expect(points(places.screen!.path)[4]).toBe(Math.round(end - CALLOUT_LAYOUT.gap));
  });

  it('keeps labels apart, top to bottom, when their anchors crowd together', () => {
    const crowded = anchors({
      screen: { x: 900, y: 400, visible: true },
      board: { x: 900, y: 405, visible: true },
      battery: { x: 900, y: 410, visible: true },
      back: { x: 900, y: 415, visible: true }
    });
    const places = placeCallouts(crowded, IDS, 1600, 900, 260);
    const ys = IDS.map((id) => places[id]!.label[1]);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(CALLOUT_LAYOUT.spacing);
  });

  it('keeps every label inside the stage\'s top and bottom margins', () => {
    const places = placeCallouts(anchors({ screen: { x: 1000, y: 4, visible: true }, back: { x: 1000, y: 899, visible: true } }), IDS, 1600, 900, 260);
    for (const id of IDS) {
      expect(places[id]!.label[1]).toBeGreaterThanOrEqual(CALLOUT_LAYOUT.margin);
      expect(places[id]!.label[1]).toBeLessThanOrEqual(900 - CALLOUT_LAYOUT.margin + 0.5);
    }
  });

  it('leaves out a callout whose anchor is off the canvas or too far right to lead off', () => {
    const places = placeCallouts(
      anchors({ board: { x: 1030, y: 470, visible: false }, battery: { x: 1600 * CALLOUT_LAYOUT.column - 10, y: 620, visible: true } }),
      IDS,
      1600,
      900,
      260
    );
    expect(Object.keys(places)).toEqual(['screen', 'back']);
  });

  it('places nothing on a stage that has no size yet', () => {
    expect(placeCallouts(anchors(), IDS, 0, 0, 260)).toEqual({});
  });
});

describe('columnFits', () => {
  // The hub at rest on a 1600 × 900 stage: the device ends at x = 960, the column at 1152.
  const bounds = { left: 430, top: 60, right: 960, bottom: 790 };

  it('fits when every anchor reaches the column and its labels start clear of the device', () => {
    expect(columnFits({ anchors: anchors(), bounds }, IDS, 1600, 260)).toBe(true);
  });

  it('does not fit when a label would start on the device, though every anchor reaches the column', () => {
    // At 1024 wide the column is at 701: its labels start at 715, clear of a device ending at 701, not at 710.
    const tight = anchors({
      screen: { x: 583, y: 190, visible: true },
      board: { x: 602, y: 470, visible: true },
      battery: { x: 555, y: 620, visible: true },
      back: { x: 595, y: 700, visible: true }
    });
    expect(columnAt(1024, 285)).toBe(701);
    expect(columnFits({ anchors: tight, bounds: { ...bounds, right: 701 } }, IDS, 1024, 285)).toBe(true);
    expect(columnFits({ anchors: tight, bounds: { ...bounds, right: 710 } }, IDS, 1024, 285)).toBe(false);
  });

  it('does not fit when a visible anchor lies too far right to lead off; an anchor off the canvas does not count', () => {
    const column = columnAt(1600, 260);
    const far = { x: column - CALLOUT_LAYOUT.run + 1, y: 470, visible: true };
    expect(columnFits({ anchors: anchors({ board: far }), bounds }, IDS, 1600, 260)).toBe(false);
    expect(columnFits({ anchors: anchors({ board: { ...far, visible: false } }), bounds }, IDS, 1600, 260)).toBe(true);
  });

  it('never fits a stage that has no size yet', () => {
    expect(columnFits({ anchors: anchors(), bounds }, IDS, 0, 260)).toBe(false);
  });
});

describe('the list on the right of the device', () => {
  it('takes the band between the device and the right edge, never narrower than the minimum', () => {
    const device = { left: 180, top: 30, right: 400, bottom: 330 };
    expect(rightBand(device, 667)).toBe(667 - CALLOUT_LAYOUT.edge - (400 + CALLOUT_LAYOUT.list.gap));
    expect(rightBand({ ...device, right: 600 }, 667)).toBe(CALLOUT_LAYOUT.list.min);
  });

  it('starts just right of the device and is centred top to bottom, inside the margins', () => {
    const device = { left: 180, top: 30, right: 400, bottom: 330 };
    const width = rightBand(device, 667);
    const [x, y] = placeRightList(device, 667, 375, width, 160);
    expect(x).toBe(400 + CALLOUT_LAYOUT.list.gap);
    expect(x + width).toBeLessThanOrEqual(667 - CALLOUT_LAYOUT.edge);
    expect(y).toBe(Math.round(375 / 2 - 80));
    expect(placeRightList(device, 667, 375, width, 400)[1]).toBe(CALLOUT_LAYOUT.margin);
  });

  it('keeps inside the right edge when the device has swung further right than the band it was sized for', () => {
    const device = { left: 180, top: 30, right: 400, bottom: 330 };
    const width = rightBand(device, 667);
    const [x] = placeRightList({ ...device, right: 440 }, 667, 375, width, 160);
    expect(x + width).toBe(667 - CALLOUT_LAYOUT.edge);
  });
});

describe('chooseLayout', () => {
  it('takes the column on a wide stage where it fits the device at rest, and the list beside the device where not', () => {
    expect(chooseLayout(1600, 900, true)).toBe('column');
    expect(chooseLayout(1600, 900, false)).toBe('right');
  });

  it('lists on a narrow stage whatever the column does: beside a short one, under a tall one', () => {
    for (const fits of [true, false]) {
      expect(chooseLayout(667, 375, fits)).toBe('right');
      expect(chooseLayout(390, 844, fits)).toBe('bottom');
      expect(chooseLayout(768, 1024, fits)).toBe('bottom');
    }
  });

  it("goes by the stage's own size: a stage a scrollbar narrower than 6:5 lists under the device", () => {
    // A 920 × 760 window is 1.21 wide; its stage, 15px of scrollbar narrower, is 1.19.
    expect(chooseLayout(920 - 15, 760, true)).toBe('bottom');
    expect(chooseLayout(920 - 15, 760, false)).toBe('bottom');
    expect(chooseLayout(920, 760, true)).toBe('column');
  });

  it('never lets the column fit, all a reserved band could change, decide whether the list goes under the device', () => {
    // The band is reserved only under 'bottom'; whether a stage gets 'bottom' must not hang on the fit.
    for (let width = 300; width <= 2600; width += 7) {
      for (let height = 300; height <= 1500; height += 11) {
        const under = chooseLayout(width, height, true) === 'bottom';
        expect(chooseLayout(width, height, false) === 'bottom').toBe(under);
        expect(under).toBe(width < height * CALLOUT_LAYOUT.landscape);
      }
    }
  });
});
