/**
 * The hub's quality ladder: what the studio draws at each step, best first.
 * The scene starts at step 0 and PixelBudget moves it one step down each time
 * its frames run slow; it never climbs back within a page view. Each pointer
 * gives up the cheapest-to-lose cost first: half the dust while the canvas
 * stays sharp, then the pixel ratio with the dust. (The floor once mirrored
 * the scene and gave that up first; from the hub's camera the mirror showed
 * only the back plate's dark underside, so it was removed and its rung with
 * it.) A coarse pointer (a phone or tablet) starts softer.
 */

export interface Quality {
  /** The highest device pixel ratio the canvas draws at. */
  pixelRatio: number;
  /** How many dust motes drift in the beam. */
  dust: number;
}

const FINE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.75, dust: 600 },
  { pixelRatio: 1.75, dust: 300 },
  { pixelRatio: 1.25, dust: 200 },
  { pixelRatio: 1, dust: 150 }
];

const COARSE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.25, dust: 300 },
  { pixelRatio: 1.25, dust: 150 },
  { pixelRatio: 1, dust: 120 }
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
