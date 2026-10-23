/**
 * How far the home's scroll may go while the void under the glass is not there (spec §2.1, §2.4: "If someone scrolls
 * before they are ready, the dive holds in the glowing tunnel and goes on once they are"). Pure; the home's scroll input
 * (src/input/useHomeScroll.ts) clamps its target to it, from the store's `voidState`, which the Void
 * (src/scene/bob/Void.tsx) writes. It imports no code from React or three, and only a type from the store.
 */
import { HOME_CHAPTERS } from '~/state/chapters';
import type { VoidState } from '~/state/store';
import { TUNNEL_HOLD } from './journey';

/** The top of the rise, BOB from above: where the DIVE chapter starts (1). */
export const RISE_TOP = HOME_CHAPTERS.units.find((unit) => unit.id === 'DIVE')!.start;

/**
 * The most the scroll's target may reach for the void's state:
 * - `idle` or `loading`: `TUNNEL_HOLD`, the dive at Bob's frame d01 (Ruling 27): the camera 3.1 over the opening, looking
 *   straight down the tunnel, whose lit wall rings the frame, the void below it dark and hidden; there it waits;
 * - `ready`: the end of the story (6): nothing holds;
 * - `failed`: `RISE_TOP` (1), BOB from above, where the home's project links (`.home-nav`) show as they do with 3D off
 *   (src/styles/base.css), so the home stays usable without the void.
 */
export function diveHoldFor(state: VoidState): number {
  switch (state) {
    case 'ready':
      return HOME_CHAPTERS.total;
    case 'failed':
      return RISE_TOP;
    default:
      return TUNNEL_HOLD;
  }
}
