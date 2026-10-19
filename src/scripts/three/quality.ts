/**
 * The hub's quality ladder: what the studio draws at each step, best first.
 * The scene starts at step 0 and PixelBudget moves it one step down each time
 * its frames run slow; it never climbs back within a page view. A fine
 * pointer (a laptop or desktop) starts sharp with the floor's reflection and
 * gives up pixels and dust first, then the reflection; a coarse pointer (a
 * phone or tablet) never draws the reflection at all.
 */

export interface Quality {
  /** The highest device pixel ratio the canvas draws at. */
  pixelRatio: number;
  /** Whether the floor mirrors the scene (a second, half-size render). */
  reflection: boolean;
  /** How many dust motes drift in the beam. */
  dust: number;
}

const FINE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.75, reflection: true, dust: 600 },
  { pixelRatio: 1.25, reflection: true, dust: 400 },
  { pixelRatio: 1.25, reflection: false, dust: 400 },
  { pixelRatio: 1, reflection: false, dust: 200 }
];

const COARSE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.25, reflection: false, dust: 300 },
  { pixelRatio: 1, reflection: false, dust: 200 },
  { pixelRatio: 1, reflection: false, dust: 120 }
];

/** How many steps the ladder has for this pointer. */
export function qualitySteps(finePointer: boolean): number {
  return (finePointer ? FINE : COARSE).length;
}

/**
 * The quality at `step` (0 = best). A step past the end is the last; a
 * fractional step rounds down, and a negative or NaN one reads as 0.
 */
export function qualityFor(step: number, finePointer: boolean): Quality {
  const ladder = finePointer ? FINE : COARSE;
  const index = Number.isNaN(step) ? 0 : Math.min(ladder.length - 1, Math.max(0, Math.floor(step)));
  return { ...ladder[index] };
}
