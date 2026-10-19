import { describe, expect, it } from 'vitest';
import type { HubLayerId } from '../../src/scripts/three/HubChoreography';
import { CALLOUT_LAYOUT, placeCallouts, type CalloutAnchors } from '../../src/scripts/ui/Callouts';

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
