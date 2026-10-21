import type { CountryId } from '~/data/directions';

/** What the Stage tells the debug bridge (`window.__needleDebug`); the Stage's `StageProbe` registers it, under `?proof` only. */
export interface StageSnapshot {
  dpr: number;
  fps: number;
  camera: { position: [number, number, number]; fov: number };
  /** Each constellation's anchor on the screen, CSS pixels from the viewport's top left (src/debug/constellationAnchors.ts). */
  constellations: Record<CountryId, [x: number, y: number]>;
}

const NONE: StageSnapshot = {
  dpr: 0,
  fps: 0,
  camera: { position: [0, 0, 0], fov: 0 },
  constellations: { china: [0, 0], netherlands: [0, 0], aruba: [0, 0] },
};

let probe: (() => StageSnapshot) | null = null;

/** Registers the mounted Stage's probe; answers the unregister, which does nothing once another Stage has replaced it. */
export function registerStageProbe(read: () => StageSnapshot): () => void {
  probe = read;
  return () => {
    if (probe === read) probe = null;
  };
}

/** What the Stage reports now; zeros while none is mounted (or while it is mounted without `?proof`). */
export function readStageProbe(): StageSnapshot {
  return probe ? probe() : NONE;
}

let mounts = 0;

/** The Stage mounted. A counter and nothing more, so it runs for every visitor: once a mount, never per frame. */
export function countCanvasMount(): void {
  mounts++;
}

/** How many Stages have mounted in this page view. */
export function canvasMounts(): number {
  return mounts;
}

/** The frames the rolling mean covers. */
export const ROLLING_FRAMES = 60;

/**
 * A gap between two drawn frames longer than this is a sleep and a wake (the canvas draws on demand), not a slow frame,
 * and is left out of the mean, ms. Anything slower than 2 fps would be taken for a sleep, which the scene never is.
 */
export const MAX_GAP_MS = 500;

/**
 * The frames per second over the last ROLLING_FRAMES intervals between frames drawn: the mean of the intervals, so a
 * slow frame weighs by its length. Fed a time per frame drawn (`push`); it keeps a ring of intervals, no allocation.
 */
export class RollingFps {
  private readonly intervals = new Float64Array(ROLLING_FRAMES);
  private count = 0;
  private next = 0;
  private sum = 0;
  private last = Number.NaN;

  push(nowMs: number): void {
    const previous = this.last;
    this.last = nowMs;
    const interval = nowMs - previous;
    if (!(interval > 0) || interval > MAX_GAP_MS) return; // the first frame, a clock that did not advance, or a sleep
    if (this.count === ROLLING_FRAMES) this.sum -= this.intervals[this.next]!;
    else this.count++;
    this.intervals[this.next] = interval;
    this.sum += interval;
    this.next = (this.next + 1) % ROLLING_FRAMES;
  }

  /** Frames per second, or 0 with no interval yet. */
  mean(): number {
    return this.count === 0 ? 0 : (this.count * 1000) / this.sum;
  }
}
