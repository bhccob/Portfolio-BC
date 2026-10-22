/**
 * The quality ladder: what the scene draws at each step, best first. The
 * scene starts at step 0 and the QualityGovernor (src/scene, drei's
 * PerformanceMonitor) moves it one step down each time its frames run slow; it
 * never climbs back within a page view. Each pointer
 * gives up the cheapest-to-lose cost first: half the dust while the canvas
 * stays sharp, then the glass floor's reflection (a second render of the whole
 * scene every frame; the rung was v3's clearcoat, Ruling 25), then the pixel
 * ratio with more dust. A coarse pointer (a phone or tablet) starts softer and
 * never draws the reflection (Ruling 31): its first rung is already medium, so
 * the costliest part never runs on a phone's first loader, and its steps give
 * up the pixel ratio, then the post chain. The BOB scene reads the pixel ratio
 * and the reflection (src/scene/bob/Opening.tsx); nothing draws dust.
 */

export interface Quality {
  /** The highest device pixel ratio the canvas draws at. */
  pixelRatio: number;
  /** The glass floor's reflection (GlassModel's reflector, high tier only): once off, it is gone for the page view. */
  reflector: boolean;
  /** How many dust motes drift in the air. */
  dust: number;
}

const FINE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.75, reflector: true, dust: 400 },
  { pixelRatio: 1.75, reflector: true, dust: 200 },
  { pixelRatio: 1.75, reflector: false, dust: 200 },
  { pixelRatio: 1.25, reflector: false, dust: 150 },
  { pixelRatio: 1, reflector: false, dust: 100 }
];

// Ruling 31: no rung of a coarse pointer has the reflection. Its first rung was v3's clearcoat rung, which Ruling 25 made
// the reflector's switch, so a phone started on the costliest rung: a second render of the scene every frame.
const COARSE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.25, reflector: false, dust: 150 },
  { pixelRatio: 1, reflector: false, dust: 100 },
  { pixelRatio: 1, reflector: false, dust: 80 }
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

/** The tiers best first, for `lowerTier`. */
const TIER_RANK: Readonly<Record<QualityTier, number>> = { high: 0, medium: 1, low: 2 };

/**
 * The lower of two tiers: what parts built at `a` drop to when the ladder now says `b`. The ladder only steps down
 * within a page view, and a part built for one tier can give up what a lower tier lacks but cannot grow back what it
 * shed, so a tier above `a` leaves `a` as it is.
 */
export function lowerTier(a: QualityTier, b: QualityTier): QualityTier {
  return TIER_RANK[b] > TIER_RANK[a] ? b : a;
}

/**
 * The tier each rung draws with (Effects): `high` and `medium` run the post chain (EffectComposer), `low` has
 * none and tone-maps in the materials. The cut points follow what each rung gives up:
 *   - fine pointer: steps 0-1 high (full pixel ratio, the reflection; only dust goes), 2-3 medium (the reflection
 *     off, then the ratio drops to 1.25), 4 low (ratio 1, the last rung);
 *   - coarse pointer: 0-1 medium (never the reflection, Ruling 31; then the ratio drops to 1), 2 low (the last rung).
 * Only the last rung is low, so the composer goes only when nothing cheaper is left, and only the reflection makes a
 * rung high, which only a fine pointer has.
 */
export function tierFor(step: number, finePointer: boolean): QualityTier {
  const ladder = finePointer ? FINE : COARSE;
  const index = rung(step, ladder);
  if (index === ladder.length - 1) return 'low';
  return ladder[index].reflector ? 'high' : 'medium';
}
