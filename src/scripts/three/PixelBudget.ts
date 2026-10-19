/**
 * How the pixel budget judges frames, in frames and seconds: the mean of the
 * last `frames` frame times must stay at or under `limit`; a frame longer than
 * `gap` (a tab switch, a stall) is not a measure of drawing and is left out;
 * after a restart or a step the first `warmup` frames (shaders compiling,
 * textures uploading, the buffer resized) are left out too. A canvas may set
 * its own limit and count runs of long frames (BudgetOptions).
 */
export const BUDGET = { frames: 30, limit: 0.02, gap: 0.1, warmup: 10 };

/**
 * The display's refresh, measured on idle frames (nothing drawn), which come
 * once a refresh or, on a busy main thread, late: the median of their
 * intervals is its period (the lower median of an even count, since a late
 * frame only ever lengthens an interval).
 *   - samples: the fewest intervals that tell it;
 *   - headroom: how far over the refresh a window may average before it is slow;
 *   - longest: the longest period taken for a display's (30 Hz); a longer
 *     median is a busy main thread, read as 30 Hz.
 */
export const VSYNC = { samples: 8, headroom: 1.1, longest: 1 / 30 } as const;

/**
 * The limit a canvas's budget judges by on this display, from its idle frame
 * intervals in seconds: `floor`, or 10% over the refresh where that is longer,
 * so a 50 Hz display's healthy 20 ms frames (which fail 1/56 s in every
 * window) hold. Null when there are too few intervals to tell (fewer than
 * VSYNC.samples): the budget is then skipped. Intervals that are not positive
 * and finite (the first frame after switching on is 0) are left out. Pure.
 */
export function budgetLimit(intervals: readonly number[], floor: number): number | null {
  const valid = intervals.filter((dt) => Number.isFinite(dt) && dt > 0).sort((a, b) => a - b);
  if (valid.length < VSYNC.samples) return null;
  const median = valid[(valid.length - 1) >> 1];
  return Math.max(floor, VSYNC.headroom * Math.min(median, VSYNC.longest));
}

/** What a canvas may judge more strictly than the defaults. */
export interface BudgetOptions {
  /** The mean frame time, in seconds, a window must stay at or under (default BUDGET.limit). */
  limit?: number;
  /**
   * How many frames over `gap` in a row stop being a stall and count as slow
   * drawing, all of them (default: never, so every such frame is left out).
   * One long frame (a tab switch) or two are still left out.
   */
  slowRun?: number;
}

/**
 * The highest pixel ratio a canvas draws at, stepped down when its frames run
 * slow, so an ordinary laptop's integrated GPU trades sharpness for a steady
 * frame rate. It judges a rolling mean of frame times (see BUDGET) and starts
 * the count over after each step, so each ratio is judged on its own frames.
 * It never steps back up within a page view: a ratio that went down and up
 * again would keep the canvas swapping between sharp and soft.
 */
export class PixelBudget {
  private index = 0;
  /** The frame times in the window, oldest first, and their sum. */
  private readonly times: number[] = [];
  private sum = 0;
  /** Frames still to leave out before counting starts. */
  private skip = 0;
  /** Long frames in a row, and the ones held back until the run is long enough to count. */
  private longs = 0;
  private readonly held: number[] = [];
  private readonly limit: number;
  private readonly slowRun: number;

  /** `steps` runs from the ratio to start at down to the lowest to fall back to. */
  constructor(
    private readonly steps: readonly number[],
    options: BudgetOptions = {}
  ) {
    this.limit = options.limit ?? BUDGET.limit;
    this.slowRun = options.slowRun ?? Infinity;
  }

  /** The highest pixel ratio to draw at now. */
  get ratio(): number {
    return this.steps[this.index];
  }

  /** How many times it has stepped down: the index into `steps` (0 = the first). */
  get step(): number {
    return this.index;
  }

  /** Starts the count over, leaving out the first frames: for the loop coming back on. */
  restart(): void {
    this.times.length = 0;
    this.sum = 0;
    this.skip = BUDGET.warmup;
    this.longs = 0;
    this.held.length = 0;
  }

  /**
   * Counts one frame's time; answers the new ratio when this frame steps it
   * down, else null. Two steps may share a ratio (the hub's quality ladder
   * gives up something else there), so a step is told by a non-null answer,
   * not by the ratio changing.
   */
  sample(dtSeconds: number): number | null {
    if (this.index === this.steps.length - 1) return null;
    if (!(dtSeconds > 0)) return null;
    if (dtSeconds > BUDGET.gap) {
      // A stall is left out; a run of them (slowRun or more) is the drawing itself, counted whole.
      if (this.slowRun === Infinity) return null;
      if (this.skip > 0) {
        this.skip--;
        return null;
      }
      this.longs++;
      if (this.longs < this.slowRun) {
        this.held.push(dtSeconds);
        return null;
      }
      for (const held of this.held.splice(0)) this.count(held);
    } else {
      this.longs = 0;
      this.held.length = 0;
      if (this.skip > 0) {
        this.skip--;
        return null;
      }
    }
    this.count(dtSeconds);
    if (this.times.length < BUDGET.frames || this.sum / BUDGET.frames <= this.limit) return null;
    this.index++;
    this.restart();
    return this.ratio;
  }

  /** Puts one frame's time in the window, dropping the oldest past `frames`. */
  private count(dtSeconds: number): void {
    this.times.push(dtSeconds);
    this.sum += dtSeconds;
    if (this.times.length > BUDGET.frames) this.sum -= this.times.shift()!;
  }
}
