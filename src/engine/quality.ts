/**
 * The quality ladder: what the scene draws at each step, best first. The
 * scene starts at step 0 and the QualityGovernor (src/scene, drei's
 * PerformanceMonitor) moves it one step down each time its frames run slow; it
 * never climbs back within a page view. Each pointer
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

/** The ladder's index for `step`: past the end is the last, a fraction rounds down, a negative or NaN step is 0. */
function rung(step: number, ladder: readonly unknown[]): number {
  return Number.isNaN(step) ? 0 : Math.min(ladder.length - 1, Math.max(0, Math.floor(step)));
}

/**
 * The quality at `step` (0 = best). A step past the end is the last; a
 * fractional step rounds down, and a negative or NaN one reads as 0.
 */
export function qualityFor(step: number, finePointer: boolean): Quality {
  const ladder = finePointer ? FINE : COARSE;
  return { ...ladder[rung(step, ladder)] };
}

/** The scene's post-processing tier: the store's `Tier`, named here so this module stays free of the app's state. */
export type QualityTier = 'high' | 'medium' | 'low';

/**
 * The tier each rung draws with (Effects): `high` and `medium` run the post chain (EffectComposer), `low` has
 * none and tone-maps in the materials. The cut points follow what each rung gives up:
 *   - fine pointer: steps 0-1 high (full pixel ratio, clearcoat; only dust goes), 2-3 medium (clearcoat off,
 *     then the ratio drops to 1.25), 4 low (ratio 1, the last rung);
 *   - coarse pointer: 0 high, 1 medium (clearcoat off), 2 low (ratio 1, the last rung).
 * Only the last rung is low, so the composer goes only when nothing cheaper is left.
 */
export function tierFor(step: number, finePointer: boolean): QualityTier {
  const ladder = finePointer ? FINE : COARSE;
  const index = rung(step, ladder);
  if (index === ladder.length - 1) return 'low';
  return ladder[index].clearcoat ? 'high' : 'medium';
}
