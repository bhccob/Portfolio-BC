/**
 * The scroll's step under reduced motion: "each step becomes a short fade" (spec §2.3). Pure, so the tests read the
 * very decisions Home (src/scene/bob/Home.tsx) makes on each frame it poses; it imports nothing from React or three.
 *
 * With reduced motion a wheel gesture, a swipe or a key moves the scroll's target a whole stop (src/input/target.ts
 * `moveTarget`: the start of a chapter, or the end). The scene does not travel there. Home keeps the pose at the stop it
 * shows and sets `<html data-step-fade>`, so the stylesheet fades `.scene-host` down over STEP_FADE_MS; once it is dark
 * the pose jumps to the new stop and the attribute goes, so the host fades back over STEP_FADE_MS (src/styles/base.css).
 * There is no running front and no camera travel to see. Without reduced motion Home never sets the attribute, and the
 * scene follows the damped progress.
 *
 * With the void failed, a move between the end page and the stops short of it is the same fade whether or not reduced
 * motion is on, never a camera move through a void that is not there: the scroll input holds the progress itself while
 * the host goes dark, jumps it, and sets the attribute without reduced motion (src/input/scrollLoop.ts `ScrollLoop`,
 * `fades`); with reduced motion Home's own fade, as for every step, is the one on screen.
 */

/** How long the scene host takes to fade down, and again to fade back, ms. */
export const STEP_FADE_MS = 150;

/** The attribute on <html> that fades the scene host down for a step (src/styles/base.css). */
export const STEP_FADE_ATTRIBUTE = 'data-step-fade';

/** True when a reduced-motion visitor has moved to another stop than the one shown: the step that fades. */
export function stepFadeFor(prevStop: number, stop: number, reduced: boolean): boolean {
  return reduced && prevStop !== stop;
}

/**
 * The stop nearest `at`, of `places` (in order, as `stops()` gives them); the earlier of two as near. A place outside
 * the story is held to its ends, NaN reads as the first stop, and no stops at all answer 0.
 */
export function nearestStop(places: readonly number[], at: number): number {
  if (places.length === 0) return 0;
  if (!(at > places[0]!)) return places[0]!;
  let best = places[0]!;
  for (const place of places) if (Math.abs(place - at) < Math.abs(best - at)) best = place;
  return best;
}

/** Where a step fade stands: the stop the scene is posed at, the one it goes to, and when the host is dark. */
export interface StepFade {
  /** The stop the scene shows (Home poses the rise of this one). */
  shown: number;
  /** The stop asked for: the one the scene jumps to once the host is dark; `shown` while no fade runs. */
  next: number;
  /** When the host is dark (`performance.now()` ms): STEP_FADE_MS after the fade began; null while none runs. */
  darkAt: number | null;
}

/** A fade at rest at `stop`: the scene shows it, and nothing fades. */
export function stepFadeFrom(stop: number): StepFade {
  return { shown: stop, next: stop, darkAt: null };
}

/**
 * Moves `fade` (in place, and answers it) to `now` for a target whose nearest stop is `stop`. The host is to be faded
 * down while `darkAt` is not null (`<html data-step-fade>`), and the scene posed at `shown`.
 * - Without reduced motion nothing fades: `shown` is `stop` at once, and a fade under way is let go.
 * - At rest, a step to another stop (`stepFadeFor`) starts a fade: dark STEP_FADE_MS from now, `shown` held meanwhile.
 * - While it fades down, `next` follows the latest stop asked for. Back on the stop it shows, the fade is let go at once
 *   (nothing has jumped, so the host fades back from where it is); otherwise, once dark (a clock that is not a number
 *   counts as dark), `shown` jumps to the stop and the fade is over, so the host fades back.
 * - A step while the host fades back in starts a fade of its own.
 */
export function stepFadeAt(fade: StepFade, stop: number, reduced: boolean, now: number): StepFade {
  if (!reduced) {
    fade.shown = fade.next = stop;
    fade.darkAt = null;
    return fade;
  }
  if (fade.darkAt === null) {
    if (stepFadeFor(fade.shown, stop, reduced)) {
      fade.next = stop;
      fade.darkAt = now + STEP_FADE_MS;
    }
    return fade;
  }
  fade.next = stop;
  if (!stepFadeFor(fade.shown, stop, reduced)) {
    fade.darkAt = null;
  } else if (!(now < fade.darkAt)) {
    fade.shown = stop;
    fade.darkAt = null;
  }
  return fade;
}
