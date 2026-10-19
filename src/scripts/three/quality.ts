/**
 * The quality ladder: what the scene draws at each step, best first. The
 * scene starts at step 0 and PixelBudget moves it one step down each time its
 * frames run slow; it never climbs back within a page view. Each pointer
 * gives up the cheapest-to-lose cost first: half the dust while the canvas
 * stays sharp, then the lacquer's clearcoat (a second specular lobe on the
 * largest surfaces), then the pixel ratio with more dust. A coarse pointer (a
 * phone or tablet) starts softer and gives up the clearcoat with its first
 * step. The compass reads all three; milestone 2's hub ignores `clearcoat`.
 */

export interface Quality {
  /** The highest device pixel ratio the canvas draws at. */
  pixelRatio: number;
  /** Clearcoat on the lacquer and the pattern ring (the compass only). */
  clearcoat: boolean;
  /** How many dust motes drift in the air. */
  dust: number;
}

const FINE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.75, clearcoat: true, dust: 400 },
  { pixelRatio: 1.75, clearcoat: true, dust: 200 },
  { pixelRatio: 1.75, clearcoat: false, dust: 200 },
  { pixelRatio: 1.25, clearcoat: false, dust: 150 },
  { pixelRatio: 1, clearcoat: false, dust: 100 }
];

const COARSE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.25, clearcoat: true, dust: 150 },
  { pixelRatio: 1.25, clearcoat: false, dust: 100 },
  { pixelRatio: 1, clearcoat: false, dust: 80 }
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
