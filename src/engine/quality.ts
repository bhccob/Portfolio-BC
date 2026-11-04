/**
 * The quality ladder: what the scene draws at each step, best first. The scene starts at the first step this GPU can
 * hold (`startStep`, timed before anything is built, src/scene/gpuBench.ts), and the QualityGovernor (src/scene) moves it
 * down if its frames still run slow (`FrameJudge`); it never climbs back within a page view. Each step gives up what costs
 * most for what shows least: the gas's rays (by far the dearest thing the scene draws: on a weak GPU three quarters of
 * the frame), the MSAA, the glass floor's reflection (a second render of the whole scene every frame), then the pixel
 * ratio. A coarse pointer (a phone or tablet) never draws the reflection: its first step is already medium.
 *
 * Nothing on a step down is built again or compiled again (a rebuild in the middle of the story froze a laptop for three
 * seconds): the gas, the MSAA and the bloom change in place, and the post chain stays on the last step of a page view that
 * began above it. The last step goes without one only when the page view starts there.
 */

export interface Quality {
  /** The highest device pixel ratio the canvas draws at. */
  pixelRatio: number;
  /** The glass floor's reflection (GlassModel's reflector, high tier only): once off, it is gone for the page view. */
  reflector: boolean;
  /** The post chain's MSAA samples. */
  samples: number;
  /** The bloom's resolution, a share of the screen's. */
  bloom: number;
  /** The gas (src/engine/bob/build/volume.ts): how much smaller than the screen it is marched and in how many steps; none on the last step. */
  gas: { scale: number; steps: number } | null;
  /** What this step costs a frame, ms per million pixels drawn, on the GPU `BENCH_REFERENCE_MS` was timed on (measured there, at the tower). */
  cost: number;
}

const FINE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.75, reflector: true, samples: 4, bloom: 1, gas: { scale: 1.5, steps: 84 }, cost: 64 },
  { pixelRatio: 1.5, reflector: true, samples: 2, bloom: 0.5, gas: { scale: 2, steps: 56 }, cost: 44 },
  { pixelRatio: 1.25, reflector: false, samples: 2, bloom: 0.5, gas: { scale: 2.5, steps: 40 }, cost: 18 },
  { pixelRatio: 1, reflector: false, samples: 0, bloom: 0.5, gas: { scale: 3, steps: 28 }, cost: 13 },
  { pixelRatio: 1, reflector: false, samples: 0, bloom: 0.25, gas: null, cost: 10.5 }
];

// No rung of a coarse pointer has the reflection, which a phone would start on otherwise: a second render of the scene every frame.
const COARSE: readonly Readonly<Quality>[] = [
  { pixelRatio: 1.25, reflector: false, samples: 2, bloom: 0.5, gas: { scale: 2.5, steps: 40 }, cost: 18 },
  { pixelRatio: 1, reflector: false, samples: 0, bloom: 0.5, gas: { scale: 3, steps: 28 }, cost: 13 },
  { pixelRatio: 1, reflector: false, samples: 0, bloom: 0.25, gas: null, cost: 10.5 }
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
 *   - coarse pointer: 0-1 medium (never the reflection; then the ratio drops to 1), 2 low (the last rung).
 * Only the last rung is low, so the composer goes only when nothing cheaper is left, and only the reflection makes a
 * rung high, which only a fine pointer has.
 */
export function tierFor(step: number, finePointer: boolean): QualityTier {
  const ladder = finePointer ? FINE : COARSE;
  const index = rung(step, ladder);
  if (index === ladder.length - 1) return 'low';
  return ladder[index].reflector ? 'high' : 'medium';
}

/** What ./gpuBench.ts timed the GPU the steps' `cost` were measured on (an AMD Radeon of two compute units, a weak one), ms. */
export const BENCH_REFERENCE_MS = 13;

/** The frame a step must fit to be started on, ms: 60 Hz. */
export const START_BUDGET_MS = 17;

/**
 * A GPU that times this quick or quicker starts at the best whatever the screen, ms: a strong card does much better than the
 * weak one the costs were measured on would say (an RTX 4080 Super draws 4K at the best step in about 9 ms).
 */
export const STRONG_MS = 1;

/**
 * The first step this GPU can hold on a screen of `screen` CSS px at `devicePixelRatio`: each step's cost at the pixels it
 * would draw, scaled by how the GPU timed (`benchMs`) against the one the costs were measured on. With no timing it is the
 * best step, and the governor judges it by its frames.
 */
export function startStep(benchMs: number | null, finePointer: boolean, screen: { width: number; height: number }, devicePixelRatio: number): number {
  const ladder = finePointer ? FINE : COARSE;
  if (benchMs === null || !Number.isFinite(benchMs) || benchMs < 0 || benchMs <= STRONG_MS) return 0;
  const speed = benchMs / BENCH_REFERENCE_MS;
  const steps = ladder.findIndex((q) => {
    const ratio = Math.min(Math.max(devicePixelRatio, 1), q.pixelRatio);
    const millions = (screen.width * screen.height * ratio * ratio) / 1e6;
    return q.cost * millions * speed <= START_BUDGET_MS;
  });
  return steps === -1 ? ladder.length - 1 : steps;
}

/** A frame longer than this is a sleep or a one-off stall, not the frame rate, ms. */
const NOT_A_FRAME_MS = 250;
/** How much drawing a verdict is drawn from, ms and frames. */
const WINDOW_MS = 700;
const WINDOW_FRAMES = 12;
/** The drawing a step is given to settle before it is judged, ms. */
const SETTLE_MS = 300;
/** A frame rate under these (in ms a frame, the worst tenth left out) takes one step down, or two. */
export const SLOW_MS = 24;
export const VERY_SLOW_MS = 45;
/** A step that did not take this much off the frame did not help. */
const HELPED = 0.92;

/**
 * Judges the frames the canvas draws back to back (the governor tells it each one's length, and `rest`s it when the scene
 * sleeps) and says how many steps down they ask for, 0 mostly. It waits for enough drawing to be sure; leaves out the worst
 * tenth, so a stall is not the frame rate; and it gives up after two steps that did not help: then it is not the GPU
 * holding the frames back (a slow CPU, a browser or a battery saver holding them to 30 a second), and lower quality would
 * cost the look for nothing.
 */
export class FrameJudge {
  private frames: number[] = [];
  private spent = 0;
  private settling = 0;
  private lastSlow: number | null = null;
  private useless = 0;

  /** A frame of `ms`: the steps down it now asks for. */
  frame(ms: number): number {
    if (!(ms > 0) || ms > NOT_A_FRAME_MS || this.useless >= 2) return 0;
    if (this.settling > 0) {
      this.settling -= ms;
      return 0;
    }
    this.frames.push(ms);
    this.spent += ms;
    if (this.spent < WINDOW_MS || this.frames.length < WINDOW_FRAMES) return 0;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const kept = sorted.slice(0, Math.ceil(sorted.length * 0.9));
    const mean = kept.reduce((sum, f) => sum + f, 0) / kept.length;
    this.frames = [];
    this.spent = 0;
    if (this.lastSlow !== null) {
      this.useless = mean < this.lastSlow * HELPED ? 0 : this.useless + 1;
      this.lastSlow = null;
      if (this.useless >= 2) return 0;
    }
    if (mean <= SLOW_MS) return 0;
    this.lastSlow = mean;
    this.settling = SETTLE_MS;
    return mean > VERY_SLOW_MS ? 2 : 1;
  }

  /** The scene went to sleep: what comes next is a new run of frames. */
  rest(): void {
    this.frames = [];
    this.spent = 0;
  }
}
