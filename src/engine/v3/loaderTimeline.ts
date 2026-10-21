/**
 * The v3 loader's timeline: which stage the opening is in, how far through it
 * it is, how much of the ON the laser has cut and how many pins are lit, from
 * the seconds the loader has been visible and how much has loaded. Pure, so
 * the loader's tests run it without a browser, and it imports nothing from
 * three, so the Stage's chunk and the small entry bundle can both read it.
 *
 * The loader has three paths, chosen by the caller:
 * - the full path (first visit): the laser engraves ON as the load fills the
 *   pins, then the chip powers up, the circuit traces bend into the compass's
 *   rings, and the camera lands on the home;
 * - the quick path (the loader was seen this session): nothing but the dark
 *   until the load is done, then a short landing;
 * - reduced motion: a static engraved ON with the pins filling, then a fade.
 *
 * Where a visitor has both (a seen loader under reduced motion) the quick
 * path wins: it plays no laser and no engraving, so it is already free of the
 * motion that reduced motion asks to avoid, and it is the shorter wait.
 */
import type { SafeStorage } from '~/engine/core/SafeStorage';
import { pinsLit } from '~/engine/v3/chipSpec';

/** The loader's stages, in the order the full path plays them. */
export type LoaderStage = 'dark' | 'engrave' | 'power' | 'circuit' | 'land' | 'home';

/**
 * The loader's timings, in seconds: the least the engraving takes (a fast load
 * never rushes the laser), the power-up, the circuit, the landing, the quick
 * path's landing, the reduced path's hold on the static ON and its fade, how
 * long a load may take before the loader gives up, and the most one frame
 * advances the clock (a hidden tab draws no frames, so a long first frame
 * after it must not skip the show).
 */
export const LOADER = {
  engraveMin: 2.2,
  power: 0.9,
  circuit: 1.6,
  land: 1.3,
  quick: 0.8,
  reducedHold: 1.0,
  reducedFade: 0.6,
  giveUp: 15,
  maxStep: 0.1
} as const;

/** The session's mark that the loader has played, so a second visit in the session takes the quick path. */
export const LOADER_SEEN_KEY = 'needle-loader-seen';

/** What the timeline needs to know, once a frame. */
export interface LoaderInput {
  /** Visible seconds since the loader began (see `advanceClock`). */
  elapsed: number;
  /** The smoothed load share, 0..1, as `readout` in ~/engine/loading gives it. */
  shown: number;
  /** The `elapsed` at which `shown` first reached 1, or null while the load is not done. */
  loadedAt: number | null;
  /** The loader was seen this session: play the quick path. */
  quick: boolean;
  /** The visitor asked for reduced motion: play the static path. */
  reduced: boolean;
}

/** Where the opening stands. */
export interface LoaderClock {
  stage: LoaderStage;
  /**
   * How far through the stage, 0..1. For `power`, `circuit` and `land` it is
   * the time through the stage over its length. For `engrave` it is how much
   * the stage has done: on the full path the share of ON that is cut (the same
   * number as `engraving`), on the reduced path the load share held back by
   * the hold on the static ON. Either way it reaches 1 only as the stage ends,
   * and while the load is still coming it stays short of 1 however long that
   * takes. It is 0 for `dark` and `home`, which have no progress to report.
   */
  local: number;
  /** How much of ON is cut, 0..1. */
  engraving: number;
  /** How many of the 64 pins are lit, 0..64. */
  pins: number;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** How far `elapsed` is through a stage that starts at `start` and runs `length` seconds, 0..1. */
function through(elapsed: number, start: number, length: number): number {
  return clamp01((elapsed - start) / length);
}

/**
 * Where the opening stands `input.elapsed` seconds in. The full path is
 * `engrave` until the engraving ends at `E = max(engraveMin, loadedAt)`, so the
 * laser neither cuts ahead of the load nor faster than the minimum, then
 * `power`, `circuit` and `land` back to back, then `home`; from `power` on the
 * ON is whole and all 64 pins are lit. The quick path is `dark` until loaded,
 * then `land` for `LOADER.quick`, then `home`, with no engraving and no pins.
 * The reduced path is a whole ON with the pins filling, until the load is done
 * and `reducedHold` has passed, then `land` for `reducedFade`, then `home`;
 * it never plays `power` or `circuit`.
 *
 * A share outside 0..1 reads as held to it, and a NaN or negative time reads
 * as 0, so a bad frame cannot send a stage backwards or past its end.
 */
export function loaderAt(input: LoaderInput): LoaderClock {
  const elapsed = input.elapsed > 0 ? input.elapsed : 0;
  const shown = clamp01(input.shown);
  const loadedAt = input.loadedAt !== null && Number.isFinite(input.loadedAt) ? Math.max(0, input.loadedAt) : null;

  if (input.quick) {
    if (loadedAt === null || elapsed < loadedAt) return { stage: 'dark', local: 0, engraving: 0, pins: 0 };
    if (elapsed < loadedAt + LOADER.quick) return { stage: 'land', local: through(elapsed, loadedAt, LOADER.quick), engraving: 0, pins: 0 };
    return { stage: 'home', local: 0, engraving: 0, pins: 0 };
  }

  if (input.reduced) {
    const fadeAt = loadedAt === null ? Infinity : Math.max(LOADER.reducedHold, loadedAt);
    if (elapsed < fadeAt) {
      return { stage: 'engrave', local: Math.min(shown, clamp01(elapsed / LOADER.reducedHold)), engraving: 1, pins: pinsLit(shown) };
    }
    if (elapsed < fadeAt + LOADER.reducedFade) {
      return { stage: 'land', local: through(elapsed, fadeAt, LOADER.reducedFade), engraving: 1, pins: pinsLit(1) };
    }
    return { stage: 'home', local: 0, engraving: 1, pins: pinsLit(1) };
  }

  const engraveEnd = loadedAt === null ? Infinity : Math.max(LOADER.engraveMin, loadedAt);
  if (elapsed < engraveEnd) {
    const engraving = Math.min(shown, clamp01(elapsed / LOADER.engraveMin));
    return { stage: 'engrave', local: engraving, engraving, pins: pinsLit(shown) };
  }
  const circuitAt = engraveEnd + LOADER.power;
  const landAt = circuitAt + LOADER.circuit;
  const homeAt = landAt + LOADER.land;
  const lit = pinsLit(1);
  if (elapsed < circuitAt) return { stage: 'power', local: through(elapsed, engraveEnd, LOADER.power), engraving: 1, pins: lit };
  if (elapsed < landAt) return { stage: 'circuit', local: through(elapsed, circuitAt, LOADER.circuit), engraving: 1, pins: lit };
  if (elapsed < homeAt) return { stage: 'land', local: through(elapsed, landAt, LOADER.land), engraving: 1, pins: lit };
  return { stage: 'home', local: 0, engraving: 1, pins: lit };
}

/**
 * The loader's clock `dt` seconds on: `elapsed` plus `dt` held to 0..`maxStep`.
 * A hidden tab draws no frames, so the long frame after it counts for
 * `maxStep` at most and the show picks up where it stopped; a negative or NaN
 * `dt` counts as nothing, so the clock never runs backwards.
 */
export function advanceClock(elapsed: number, dt: number): number {
  return elapsed + (dt > 0 ? Math.min(dt, LOADER.maxStep) : 0);
}

/**
 * Whether the loader should give up and let the page through: the load has
 * not finished after `LOADER.giveUp` visible seconds. A load that finished
 * (`loadedAt` set) never gives up, however long the show then runs.
 */
export function loaderGaveUp(elapsed: number, loadedAt: number | null): boolean {
  return loadedAt === null && elapsed >= LOADER.giveUp;
}

/**
 * Whether the loader has played this session. Pass `SafeStorage.session()` at
 * runtime. A storage that throws, or any stored value but '1', reads as not
 * seen, so the visitor gets the whole show rather than none.
 */
export function loaderSeen(storage: SafeStorage): boolean {
  return storage.get(LOADER_SEEN_KEY) === '1';
}

/**
 * Marks the loader as played this session. Pass `SafeStorage.session()` at
 * runtime. A storage that throws is ignored, as `SafeStorage` does for every
 * write.
 */
export function markLoaderSeen(storage: SafeStorage): void {
  storage.set(LOADER_SEEN_KEY, '1');
}
