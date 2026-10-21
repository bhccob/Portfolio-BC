import { LATER_HEAVEN } from '~/engine/bob/trigrams';

/**
 * The engraving of one of the compass's glass bands, painted as a strip:
 * white marks on a transparent canvas, which the builder uses as the alpha
 * mask of the gold (as src/engine/v3/paintRings.ts does for the old dial).
 * A strip's x runs round the band, u = angle / 360 from 0 to 1, and its y runs
 * across it, with v = 0 at the bottom edge and v = 1 at the top edge. A canvas
 * y is (1 - v) * height, because three.js flips a CanvasTexture and puts the
 * canvas top at v = 1.
 *
 * Fine ticks line the top edge every 2 degrees, long ones every 10, and the
 * eight trigrams stand between the long ticks. Every mark is a plain filled
 * rectangle, sized in degrees and in shares of the band's height, so it keeps
 * its proportions on the band. A tick starts at its angle and runs on to the
 * right, so the tick at 0 degrees does not straddle the strip's edge, and no
 * mark crosses the seam where u = 1 meets u = 0.
 */

/** The strip's size in pixels: its width is a full turn of the band, its height the band's width. */
export const BAND_STRIP = { width: 4096, height: 96 } as const;

/** The part of a 2D canvas context that the painter uses, so a test can hand it a stub. */
export interface StripContext {
  fillStyle: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/**
 * How the marks are laid out. Angles and widths are in degrees; heights and
 * positions across the band are in v.
 */
const ART = {
  /** Fine ticks: one every `every` degrees, `width` wide, from v `from` up to the top edge. */
  fine: { every: 2, width: 0.2, from: 0.8 },
  /** Long ticks: one every `every` degrees, from v `from` up to the top edge. At their angle they replace the fine tick. */
  long: { every: 10, width: 0.4, from: 0.62 },
  /**
   * A trigram stands centred at `first` degrees and then every `step`, `width`
   * wide. Its three bars are centred at the v values in `bars` (the bottom line
   * first) and are `thick` tall, so the top bar ends at v 0.60, below the long
   * ticks. A broken bar is cut by a gap of `gap` degrees in its middle.
   */
  trigram: { first: 22.5, step: 45, width: 3, gap: 0.8, bars: [0.18, 0.36, 0.54], thick: 0.12 }
} as const;

/** The marks are white: the gold takes their shape, not their colour. */
const WHITE = '#ffffff';

/**
 * A mark that starts at `degrees` round the band and is `width` degrees wide,
 * from v `bottom` to v `top`, filled once.
 */
function mark(ctx: StripContext, degrees: number, width: number, bottom: number, top: number): void {
  const { width: w, height: h } = BAND_STRIP;
  ctx.fillRect((degrees / 360) * w, (1 - top) * h, (width / 360) * w, (top - bottom) * h);
}

/** The ticks: a long one every 10 degrees and a fine one every 2 in between. */
function ticks(ctx: StripContext): void {
  const { fine, long } = ART;
  for (let degrees = 0; degrees < 360; degrees += fine.every) {
    if (degrees % long.every === 0) mark(ctx, degrees, long.width, long.from, 1);
    else mark(ctx, degrees, fine.width, fine.from, 1);
  }
}

/**
 * One trigram centred on `centre` degrees. A whole bar is one fill the trigram's
 * width. A broken bar is two fills with the gap between, the two halves
 * together as wide as the whole bar would be.
 */
function trigram(ctx: StripContext, centre: number, lines: readonly (0 | 1)[]): void {
  const { width, gap, bars, thick } = ART.trigram;
  lines.forEach((whole, i) => {
    const bottom = bars[i] - thick / 2;
    const top = bars[i] + thick / 2;
    if (whole === 1) {
      mark(ctx, centre - width / 2, width, bottom, top);
    } else {
      const half = (width - gap) / 2;
      mark(ctx, centre - width / 2, half, bottom, top);
      mark(ctx, centre + gap / 2, half, bottom, top);
    }
  });
}

/**
 * Paints band `band` (0..3 for the four bands; any whole number is taken
 * modulo 8) on the strip, after clearing it to transparent. The eight
 * trigrams stand at 22.5 + 45k degrees for k = 0..7, in the Later Heaven
 * order, and band `b` starts the sequence at trigram `b`, so the four bands
 * do not line up when they turn.
 *
 * @throws RangeError when `band` is not an integer.
 */
export function paintBandStrip(ctx: StripContext, band: number): void {
  if (!Number.isInteger(band)) throw new RangeError(`band must be an integer, got ${band}`);
  const { first, step } = ART.trigram;
  const start = ((band % LATER_HEAVEN.length) + LATER_HEAVEN.length) % LATER_HEAVEN.length;
  ctx.clearRect(0, 0, BAND_STRIP.width, BAND_STRIP.height);
  ctx.fillStyle = WHITE;
  ticks(ctx);
  for (let k = 0; k < LATER_HEAVEN.length; k++) {
    trigram(ctx, first + step * k, LATER_HEAVEN[(start + k) % LATER_HEAVEN.length].lines);
  }
}
