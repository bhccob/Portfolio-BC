/**
 * Who writes the camera's shot (`frame.shot`), as plain rules: the Opening's frame callback, which is the only writer
 * (src/scene/bob/Opening.tsx), asks `shotSourceFor` where this frame's shot comes from and `shownProgressFor` at what
 * progress the journey is posed (a bead's close view poses it at that bead's stop). Pure, and apart from types it
 * imports only the chapters and the step fade's nearest stop, so the tests run it without R3F, three or a browser; the
 * Opening applies exactly these.
 */
import type { LoaderStage } from '~/engine/bob/loaderTimeline';
import { HOME_CHAPTERS, stops } from '~/state/chapters';
import { nearestStop } from './stepFade';

/**
 * The `useFrame` priority of the frame callback that writes the shot. R3F runs a root's callbacks from the lowest
 * priority up, those of one priority in the order they mounted, and only a priority above 0 takes the render from R3F
 * (`internal.priority` counts those alone). The Rig, which puts the camera on the shot, has the default 0; this is
 * below it, so the shot is written strictly before the Rig reads it in the same frame, whatever order the two mounted
 * in, and a negative priority leaves the rendering where it was. Home, which mounts after the Rig, no longer writes the
 * shot and keeps 0.
 */
export const SHOT_PRIORITY = -1;

/**
 * Where a frame's shot comes from:
 * - `loader`: the Opening's own shots while the loader plays (`cameraShotAt` at the live clock);
 * - `held`: the same shots at the moment the proof bridge's seek holds the clock (`frame.loaderHold`), at the home too:
 *   the held home is the home shot, whatever the scroll;
 * - `flight`: a bead's close view is in the shot (./focus.ts): a project page stands over it, or the camera
 *   flies into the porthole or back out, or a fade has jumped to it: the journey at that bead's stop, moved toward its
 *   close view (`shotToward(..., focusShotFor(id, aspect), amount)`);
 * - `home`: the clock is at the home but Home has not taken the scene over yet, the one frame in which the Opening
 *   poses the home and hands it over: the journey at the progress the hand-over poses, with no step fade begun;
 * - `journey`: Home drives the scene, so the camera is the journey's at the progress Home poses it at.
 */
export type ShotSource = 'loader' | 'held' | 'flight' | 'home' | 'journey';

/**
 * The writer of this frame's shot, in this order: the loader while the clock is before the home (`stage`), then a
 * held seek (`held`, the held loader seconds or null for the live clock), then a bead's close view (`focus`: the
 * frame's focus pose has an amount above 0), then the home while Home has not taken over, and the journey once it has
 * (`live`: `Handover.live`, as the frame before left it, as the Opening reads it before it poses). A held seek at a
 * loader stage is the loader's: its shot is the loader's at the held moment either way; and the loader and a held seek
 * keep their own shots with a close view asked for, so a direct arrival at a project page plays its loader and comes to
 * the close view once it has landed. Without `focus` there is none.
 */
export function shotSourceFor(stage: LoaderStage, held: number | null, live: boolean, focus = false): ShotSource {
  if (stage !== 'home') return 'loader';
  if (held !== null) return 'held';
  if (focus) return 'flight';
  return live ? 'journey' : 'home';
}

/** Where the home's scroll comes to rest (`stops`): the step fade's places under reduced motion. */
const STOPS = stops(HOME_CHAPTERS);

/**
 * The progress the home and the journey pose the shot at, so the camera stands where the compass and the beads are
 * posed in the same frame (Home poses `journeyPoseAt` of the same number).
 * - Without reduced motion it is the damped `progress`, for both.
 * - With reduced motion the scene stands at a stop and does not travel (src/scene/bob/stepFade.ts). Once Home drives
 *   it, that is the stop the step fade shows (`stepShown`, which Home last posed): it jumps only when the host is dark.
 *   At the hand-over, before any step fade began, it is the stop the scroll's `target` is nearest, as Home poses it with
 *   no fade.
 */
export function shownProgressFor(source: 'home' | 'journey', reducedMotion: boolean, progress: number, target: number, stepShown: number): number {
  if (!reducedMotion) return progress;
  return source === 'journey' ? stepShown : nearestStop(STOPS, target);
}
