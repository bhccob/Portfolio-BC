// Types only: this module is in the entry bundle, which must not pull in three.js.
import type { ProjectId } from '~/data/projects';
import type { LoaderStage } from '~/engine/bob/loaderTimeline';
import type { CameraShot } from '~/engine/bob/shots';
import type { FocusMove } from '~/scene/bob/focus';
import type { Stretch } from '~/scene/bob/journey';
import type { VoidState } from './store';

/** The ring on the screen, CSS px: the needle's tips, and each bead's centre and radius (`[x, y, r]`, in `BEADS` order). */
export interface RingView {
  front: [number, number];
  back: [number, number];
  beads: [number, number, number][];
}

/**
 * The values that change every frame. This is a plain mutable object, never React state and never in
 * the zustand store: the scroll input writes it, the scene's frame loop reads it, and nothing re-renders.
 * Discrete changes (a chapter, a phase) go through `useScene.dispatch` instead.
 */
export const frame = {
  /** Where the scene is on the scroll axis, in chapter units, damped toward `target`. */
  progress: 0,
  /** Where the scroll input has asked it to be. */
  target: 0,
  /** How fast `progress` is moving, in units per second. */
  velocity: 0,
  /** The pointer in normalised device coordinates, -1 to 1. */
  pointer: { x: 0, y: 0 },
  /**
   * When a mouse or pen last moved over the page (`performance.now()` ms; the Rig writes it with `pointer`), or
   * -Infinity before the first move. The home's needle follows the pointer only once it has moved (a pointer still at
   * its starting {0, 0} has said nothing), and a move at home starts its idle while again.
   */
  pointerAt: Number.NEGATIVE_INFINITY,
  /**
   * The compass needle's angle as last posed, radians: 0 up the screen, positive clockwise as the camera sees it
   * (`CompassModel.setNeedle`'s). The Opening (src/scene/bob/Opening.tsx) writes it as the needle swings in, and the
   * Home (src/scene/bob/Home.tsx) as it follows the pointer or drifts; 0 before any compass is posed. The debug bridge
   * reports it.
   */
  needleAngle: 0,
  /**
   * The scroll's pose as the Home (src/scene/bob/Home.tsx) last posed it, on each frame it drives the home: the rise `u`
   * (0 at the home, 1 looking straight down on BOB; src/scene/bob/scrollPose.ts) and the shares of the letters' light,
   * the iris and the needle's dip, each 0..1 before the setters ease them. With reduced motion the rise is the stop the
   * step fade shows, not the damped progress. All 0 while no Home drives the home. The debug bridge reports it.
   */
  scroll: { u: 0, letters: 0, iris: 0, needleDip: 0 },
  /**
   * Where the home's journey stands (src/scene/bob/journey.ts `journeyAt`), as the scene last posed it: the stretch
   * (`rise`, `light`, `ring`, `sheet`, `end`), how far through it, the project in front of the ring (0, 1 or 2) or null,
   * the light dive's way frame (1-300, null elsewhere), the ring's angle (degrees, null before the ring) and how far the
   * end page's sheet is up (0..1). The Opening writes these on every frame it poses the journey, from the one pose it
   * publishes for that frame (`writeJourney`, src/scene/bob/voidPose.ts); a frame of the loader or of a held seek leaves
   * them as they were. `voidState` is the void's load (the store's `voidState`), which the Void writes as it changes, and
   * `light` the light's centre on the screen (NDC, null where there is no light), which the Void projects each frame it
   * poses it; and under `?proof` alone, `ring`, the ring on the screen as the Void last drew it (CSS px): the needle's
   * front and back tips, and each bead's centre and radius in `BEADS` order, null where the needle or the beads are not
   * in the ring. The debug bridge reports them all.
   */
  journey: {
    stretch: 'rise' as Stretch,
    local: 0,
    project: null as number | null,
    voidState: 'idle' as VoidState,
    frame: null as number | null,
    angle: null as number | null,
    sheet: 0,
    light: null as { x: number; y: number } | null,
    ring: null as RingView | null
  },
  /** The index of the chapter `progress` is in (`chapterAt(...).index`). */
  chapterIndex: 0,
  /** True while the WebGL context is lost. */
  contextLost: false,
  /**
   * Where the camera should be, which the Rig puts the camera on (adding the pointer's parallax at home). It has one
   * writer, the Opening (src/scene/bob/Opening.tsx), and writes it once on every frame it draws, in a frame callback at
   * `SHOT_PRIORITY` (src/scene/bob/shotSource.ts), below the Rig's, so R3F runs it strictly before the Rig in that same
   * frame and the camera is placed on the shot of the frame it is drawn in. `shotSourceFor(stage, held, live)` says
   * which shot: during the loader and on a held seek (`loaderHold`) the loader's own (`cameraShotAt`); at home the
   * journey's, `journeyPoseAt(progress, aspect).shot` (src/scene/bob/journey.ts), from the home up the rise to BOB from
   * above and on into the dive and the void, at `progress`, or with reduced motion the stop the step fade shows
   * (`shownProgressFor`). Home (src/scene/bob/Home.tsx) writes none. Null until an Opening has posed its first frame,
   * and again when it unmounts; the Rig then leaves the camera as it is.
   */
  shot: null as CameraShot | null,
  /**
   * Where the opening stands, as the Opening last posed it: its stage (null while no Opening is mounted), the loader's
   * visible seconds, and how much of each of the five marks is cut (`STROKE_ORDER`: the left B, its bar, the right B,
   * its bar, the circle; the loader cuts the circle alone, so the first four stay 0). The Rig reads the stage (the
   * parallax is the home's alone); the debug bridge reports all three.
   */
  loader: { stage: null as LoaderStage | null, elapsed: 0, strokes: [0, 0, 0, 0, 0] as readonly number[] },
  /**
   * The loader time the proof bridge holds the opening at (`seekLoader`, behind `?proof` only), seconds, or null for
   * the live clock. While it is set the Opening poses the whole scene at that moment on every frame and the home's
   * needle waits. Nothing but the bridge sets it.
   */
  loaderHold: null as number | null,
  /**
   * When the fast-forward of a skipped loader ended, in the clock of `performance.now()` (ms), or null while no skip has
   * landed. The Opening writes it on the frame a skipped loader reaches the home (the skip's own listener prevents the
   * input until then), and sets it back to null when it mounts; the home's scroll input (src/input/useHomeScroll.ts)
   * reads it and, for `SKIP_SWALLOW_MS` after it and on while the input keeps coming (`skipSwallower`),
   * drops the wheel, touch and keys it hears, still preventing them, so the tail of the gesture that skipped does not
   * scroll the home or the page.
   */
  loaderSkipEndsMs: null as number | null,
  /**
   * A bead seen close (src/scene/bob/focus.ts): the camera's move between the journey's shot and a bead's
   * close view, and the bead being opened.
   * - `move`: the last move begun, on the clock of `performance.now()`; at rest on the journey's shot until one is. The
   *   Opening begins one whenever the close view the page asks for (`focusGoalFor`) is not the one the move goes to: the
   *   page's own (a project page, a direct arrival included) by a fade, and back out to the journey on leaving it, by a
   *   flight from the bead's own stop or else a fade. It lives with the document, so a flight goes on across the route
   *   change, and the canvas finds it where it is on its next frame.
   * - `opening`: the bead whose label or shell was clicked (src/ui/BeadLabel.tsx `openBead`), from the click until the
   *   next navigation (src/state/routeSync.ts lets it go): its flight runs on the home page, and the router goes to its
   *   page once the flight is in; null otherwise.
   */
  focus: {
    move: { from: { id: null, amount: 0 }, to: null, at: Number.NEGATIVE_INFINITY, mode: 'fade' } as FocusMove,
    opening: null as ProjectId | null,
  },
};
