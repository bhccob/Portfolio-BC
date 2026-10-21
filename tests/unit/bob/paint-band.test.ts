import { describe, expect, it } from 'vitest';
import { BAND_STRIP, paintBandStrip, type StripContext } from '~/engine/bob/paintBand';
import { LATER_HEAVEN } from '~/engine/bob/trigrams';

const { width: W, height: H } = BAND_STRIP;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The fill style in force when the rectangle was filled. */
  style: string;
}

interface Recording {
  rects: Rect[];
  cleared: [number, number, number, number][];
}

/** Paints into a context that only writes down what it is asked to do. */
function recording(paint: (ctx: StripContext) => void): Recording {
  const rects: Rect[] = [];
  const cleared: [number, number, number, number][] = [];
  const ctx: StripContext = {
    fillStyle: '',
    clearRect: (x, y, w, h) => void cleared.push([x, y, w, h]),
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, style: String(this.fillStyle) });
    }
  };
  paint(ctx);
  return { rects, cleared };
}

const record = (paint: (ctx: StripContext) => void): Rect[] => recording(paint).rects;

/** The degrees round the band that a strip x stands at. */
const degrees = (x: number): number => (x / W) * 360;
/** The v of a canvas y (0 at the bottom edge, 1 at the top). */
const vOf = (y: number): number => 1 - y / H;

// Ticks hang from the top edge: they start at y = 0. Everything else is a trigram's bar.
const isTick = (r: Rect): boolean => r.y === 0;
const isFineTick = (r: Rect): boolean => isTick(r) && Math.abs(vOf(r.h) - 0.8) < 1e-9;
const isLongTick = (r: Rect): boolean => isTick(r) && Math.abs(vOf(r.h) - 0.62) < 1e-9;

/** The v of the middle of each of a trigram's bars, bottom to top. */
const BAR_CENTRES = [0.18, 0.36, 0.54];

interface Bar {
  /** The number of fills it took: 1 for a whole bar, 2 for a broken one. */
  pieces: number;
  /** Where the bar's outer ends stand, in degrees. */
  from: number;
  to: number;
  /** The v of its middle and its height in v. */
  centre: number;
  thick: number;
}

/** The trigrams' bars, grouped by the 45-degree sector (0..7) they stand in, each sector's bars bottom to top. Empty sectors are left out. */
function trigramBars(calls: Rect[]): Bar[][] {
  const sectors: Rect[][][] = Array.from({ length: 8 }, () => BAR_CENTRES.map(() => []));
  for (const r of calls.filter((c) => !isTick(c))) {
    const sector = Math.floor(degrees(r.x) / 45);
    const centre = vOf(r.y + r.h / 2);
    const tier = BAR_CENTRES.findIndex((c) => Math.abs(c - centre) < 1e-9);
    expect(tier, `a bar centred at v ${centre}`).toBeGreaterThanOrEqual(0);
    sectors[sector][tier].push(r);
  }
  return sectors
    .filter((tiers) => tiers.some((pieces) => pieces.length > 0))
    .map((tiers) =>
      tiers.map((pieces) => ({
        pieces: pieces.length,
        from: Math.min(...pieces.map((p) => degrees(p.x))),
        to: Math.max(...pieces.map((p) => degrees(p.x + p.w))),
        centre: vOf(pieces[0].y + pieces[0].h / 2),
        thick: pieces[0].h / H
      }))
    );
}

/** The bars of the trigram in sector `k` (0 at 22.5 degrees, going round). */
const barsAt = (calls: Rect[], k: number): Bar[] => trigramBars(calls)[k];

/** The name of the trigram in sector `k`, read back from the bars that were painted: a whole bar is yang. */
function trigramAt(calls: Rect[], k: number): string {
  const lines = barsAt(calls, k).map((bar) => (bar.pieces === 1 ? 1 : 0));
  return LATER_HEAVEN.find((t) => t.lines.join('') === lines.join(''))!.name;
}

const firstTrigram = (calls: Rect[]): string => trigramAt(calls, 0);

describe('paintBandStrip', () => {
  it('paints 180 fine ticks, 36 long ticks and 8 trigrams of 3 bars', () => {
    const calls = record((ctx) => paintBandStrip(ctx, 0));
    expect(calls.filter(isFineTick)).toHaveLength(180 - 36);
    expect(calls.filter(isLongTick)).toHaveLength(36);
    const trigrams = trigramBars(calls);
    expect(trigrams).toHaveLength(8);
    for (const bars of trigrams) expect(bars).toHaveLength(3);
  });

  it('breaks a yin bar in two and leaves a yang bar whole', () => {
    const kun = barsAt(record((ctx) => paintBandStrip(ctx, 0)), 1); // index 1 = Kun, all yin
    expect(kun.every((bar) => bar.pieces === 2)).toBe(true);
    const qian = barsAt(record((ctx) => paintBandStrip(ctx, 3)), 0); // index 3 = Qian, all yang
    expect(qian.every((bar) => bar.pieces === 1)).toBe(true);
  });

  it('starts band k at trigram k', () => {
    expect(firstTrigram(record((ctx) => paintBandStrip(ctx, 3)))).toBe('Qian');
    expect(firstTrigram(record((ctx) => paintBandStrip(ctx, 0)))).toBe('Li');
  });

  it('keeps the four bands out of step and runs the sequence on round the band', () => {
    const names = (band: number) => {
      const calls = record((ctx) => paintBandStrip(ctx, band));
      return Array.from({ length: 8 }, (_, k) => trigramAt(calls, k));
    };
    expect(names(0)).toEqual(LATER_HEAVEN.map((t) => t.name));
    expect(names(1)).toEqual([...LATER_HEAVEN.slice(1), LATER_HEAVEN[0]].map((t) => t.name));
    expect(new Set([0, 1, 2, 3].map((band) => names(band)[0])).size).toBe(4);
    // Past the eighth band the sequence wraps, and a negative band counts back from the end.
    expect(names(8)).toEqual(names(0));
    expect(names(-1)).toEqual(names(7));
  });

  it('refuses a band that is not a whole number', () => {
    expect(() => recording((ctx) => paintBandStrip(ctx, 1.5))).toThrow(RangeError);
    expect(() => recording((ctx) => paintBandStrip(ctx, Number.NaN))).toThrow(RangeError);
  });

  it('clears the strip to transparent first and fills every mark white', () => {
    const { rects, cleared } = recording((ctx) => paintBandStrip(ctx, 2));
    expect(cleared).toEqual([[0, 0, W, H]]);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) expect(r.style).toBe('#ffffff');
  });

  it('puts a tick every 2 degrees from the seam, the long ones every 10, with the long ones reaching down to v 0.62', () => {
    const ticks = record((ctx) => paintBandStrip(ctx, 0))
      .filter(isTick)
      .sort((a, b) => a.x - b.x);
    expect(ticks).toHaveLength(180);
    ticks.forEach((t, i) => {
      expect(degrees(t.x)).toBeCloseTo(2 * i, 9);
      expect(isLongTick(t)).toBe(i % 5 === 0);
      expect(vOf(t.y)).toBe(1); // every tick hangs from the top edge
    });
    expect(vOf(ticks[0].h)).toBeCloseTo(0.62, 9);
    expect(vOf(ticks[1].h)).toBeCloseTo(0.8, 9);
  });

  it('centres each trigram at 22.5 + 45k degrees, 3 wide, bars 0.12 tall at v 0.18, 0.36 and 0.54, and breaks with a 0.8 degree gap', () => {
    const calls = record((ctx) => paintBandStrip(ctx, 0));
    trigramBars(calls).forEach((bars, k) => {
      bars.forEach((bar, tier) => {
        expect(bar.centre).toBeCloseTo(BAR_CENTRES[tier], 9);
        expect(bar.thick).toBeCloseTo(0.12, 9);
        expect(bar.from).toBeCloseTo(22.5 + 45 * k - 1.5, 9);
        expect(bar.to).toBeCloseTo(22.5 + 45 * k + 1.5, 9);
      });
    });
    // Kun is index 1 and all broken: each bar is two pieces with 0.8 degrees between them.
    const pieces = calls
      .filter((r) => !isTick(r) && Math.floor(degrees(r.x) / 45) === 1 && Math.abs(vOf(r.y + r.h / 2) - 0.18) < 1e-9)
      .sort((a, b) => a.x - b.x);
    expect(pieces).toHaveLength(2);
    expect(degrees(pieces[1].x) - degrees(pieces[0].x + pieces[0].w)).toBeCloseTo(0.8, 9);
  });

  it('keeps every mark on the strip, so the seam needs no copy, and the bars below the long ticks', () => {
    const calls = record((ctx) => paintBandStrip(ctx, 1));
    for (const r of calls) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(W);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 1e-9);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
    for (const r of calls.filter((c) => !isTick(c))) expect(vOf(r.y)).toBeLessThanOrEqual(0.62);
  });

  it('is the same every time it is painted', () => {
    expect(record((ctx) => paintBandStrip(ctx, 2))).toEqual(record((ctx) => paintBandStrip(ctx, 2)));
  });
});

describe('StripContext', () => {
  it('accepts a real 2D canvas context, which the typecheck guards', () => {
    // Never called: a canvas needs a browser. It compiles only while a CanvasRenderingContext2D is assignable to StripContext.
    const asStrip = (ctx: CanvasRenderingContext2D): StripContext => ctx;
    const paintOnCanvas = (ctx: CanvasRenderingContext2D): void => paintBandStrip(ctx, 0);
    expect(asStrip).toBeTypeOf('function');
    expect(paintOnCanvas).toBeTypeOf('function');
  });
});

describe('BAND_STRIP', () => {
  it('is 4096 by 96', () => {
    expect(BAND_STRIP).toEqual({ width: 4096, height: 96 });
  });
});
