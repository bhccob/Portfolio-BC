/**
 * How the pixel budget judges frames, in frames and seconds: the mean of the
 * last `frames` frame times must stay at or under `limit`; a frame longer than
 * `gap` (a tab switch, a stall) is not a measure of drawing and is left out;
 * after a restart or a step the first `warmup` frames (shaders compiling,
 * textures uploading, the buffer resized) are left out too.
 */
export const BUDGET = { frames: 30, limit: 0.02, gap: 0.1, warmup: 10 };

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

  /** `steps` runs from the ratio to start at down to the lowest to fall back to. */
  constructor(private readonly steps: readonly number[]) {}

  /** The highest pixel ratio to draw at now. */
  get ratio(): number {
    return this.steps[this.index];
  }

  /** Starts the count over, leaving out the first frames: for the loop coming back on. */
  restart(): void {
    this.times.length = 0;
    this.sum = 0;
    this.skip = BUDGET.warmup;
  }

  /** Counts one frame's time; answers the new, lower ratio when this frame steps it down, else null. */
  sample(dtSeconds: number): number | null {
    if (this.index === this.steps.length - 1) return null;
    if (!(dtSeconds > 0) || dtSeconds > BUDGET.gap) return null;
    if (this.skip > 0) {
      this.skip--;
      return null;
    }
    this.times.push(dtSeconds);
    this.sum += dtSeconds;
    if (this.times.length > BUDGET.frames) this.sum -= this.times.shift()!;
    if (this.times.length < BUDGET.frames || this.sum / BUDGET.frames <= BUDGET.limit) return null;
    this.index++;
    this.restart();
    return this.ratio;
  }
}
