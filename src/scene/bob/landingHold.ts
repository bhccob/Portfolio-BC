/**
 * How far the home's scroll may go while the beads under the glass are not there (spec 2026-10-25-bob-light-dive-design.md:
 * a visitor who reaches the landing before the beads' file has loaded sees the light and the facts play, and the story
 * holds just above the ring until the file is ready). Pure; the home's scroll input (src/input/useHomeScroll.ts) clamps
 * its target to it, from the store's `voidState`, which the Void (src/scene/bob/Void.tsx) writes. It imports no code from
 * React or three, and only a type from the store.
 */
import { HOME_CHAPTERS, placeOfFrame, riseTop, scrollEnd } from '~/state/chapters';
import type { VoidState } from '~/state/store';

/** The top of the rise, BOB from above: where the light dive starts (1). */
export const RISE_TOP = riseTop(HOME_CHAPTERS);

/** The landing hold: the light dive's frame 258, the light just short of the ring, the beads not yet in sight (262). */
export const LANDING_HOLD = placeOfFrame(258);

/**
 * The most the scroll's target may reach for the void's state:
 * - `ready`: the end of the scroll, the end page's stop (7): nothing holds;
 * - every other state, `failed` included: `LANDING_HOLD`, where the ring would be; with the void failed the end page
 *   still stands past it, reached by the step fade (src/input/scrollLoop.ts).
 */
export function landingHoldFor(state: VoidState): number {
  return state === 'ready' ? scrollEnd(HOME_CHAPTERS) : LANDING_HOLD;
}
