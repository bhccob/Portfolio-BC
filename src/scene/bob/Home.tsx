import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import type { CompassModel } from '~/engine/bob/build/compass';
import type { EngravingModel } from '~/engine/bob/build/engraving';
import type { SmokeModel } from '~/engine/bob/build/smoke';
import { aimsAt, driftAngle, NEEDLE_SPRING, needleAngleAt, needleAngleFor, nextDriftRest } from '~/engine/bob/needleAim';
import { AT_REST } from '~/engine/stillness';
import { HOME_CHAPTERS, scrollEnd, stops } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { motion } from '../motion';
import { applyEndView, clearEndView, type EndWritten, endViewFor, endWritten } from './endView';
import type { JourneyPose } from './journey';
import { IDLE_SECONDS, needleGlowAt } from './look';
import { risingFor } from './scrollPose';
import { nearestStop, type StepFade, stepFadeAt, stepFadeFrom } from './stepFade';

/** The longest step the needle and the idle clock take in one frame, seconds: a wake from sleep jumps neither. */
const MAX_STEP = 0.1;

/** Where the home's scroll comes to rest (`stops`): the step fade's places under reduced motion. */
const STOPS = stops(HOME_CHAPTERS);

/** The attribute on <html> that fades the scene host down for a reduced-motion step (src/styles/base.css). */
const STEP_FADE_ATTRIBUTE = 'data-step-fade';

/** The attribute on <html> that takes the hero's SCROLL cue away while the camera is up the rise (src/styles/base.css). */
const RISING_ATTRIBUTE = 'data-rising';

/** The end page's stop, the scroll's end: the end view rests there (endView.ts). */
const END = scrollEnd(HOME_CHAPTERS);

/** The end page's section (src/ui/EndPage.tsx), or null while the home page is not up. */
const endPage = (): HTMLElement | null => document.getElementById('end');

/** The home's objects Home drives: built, posed through the opening and freed by the Opening, which owns them. */
export interface HomeModels {
  compass: CompassModel;
  engraving: EngravingModel;
  smoke: SmokeModel;
}

/**
 * What the Opening tells Home on each frame it draws, before Home's own frame: whether Home drives the home's objects
 * now, and where the Opening left them. `live` is true once the opening has landed and posed the home, and false
 * before, and while the proof bridge holds the loader's clock (`seekLoader`), when the Opening poses every object from
 * the held moment and Home keeps its hands off. `time` is the world's seconds as the Opening last posed them (the bands'
 * turn and the smoke's drift go on from there) and `needle` the angle it left the needle at (`settleAngle(1)`, 1.8
 * degrees short of the rest), where Home's spring starts at each hand-over, so nothing snaps.
 *
 * `shown` goes the other way: the progress Home posed the scene at on its last frame (the damped `frame.progress`, or
 * with reduced motion the stop the step fade shows). The Opening, which runs before Home in a frame and writes the
 * camera's shot (src/scene/bob/shotSource.ts), reads it for the reduced-motion stop, which only Home's step fade knows.
 *
 * `pose` is the one journey pose of the frame (src/scene/bob/journey.ts `journeyPoseAt`), which the Opening computes
 * once, at the progress it stands the camera at, before the Rig: its shot is the camera's, and Home (the rise) and the
 * Void (the void, the beads, the needle out of the compass) pose the scene from it, so all three agree in every frame.
 * Null while the Opening poses the scene itself (the loader, a held seek) and once it is gone. It is set on every frame
 * whose shot is the journey's: whenever `live` is, and also on the hand-over frame (and any frame at the home before the
 * compass exists), where the Opening sets it while `live` is still false; a pose alone does not say Home drives.
 *
 * `focus` is true while the camera is at a bead's close view or on its way to or from one (src/scene/bob/focus.ts
 * `FocusPose.engaged`): a project page, a flight into a porthole or out, a fade to or from a close view. The Void then
 * shows no label and reads no pointer. The Opening sets it on each frame it poses the home, before Home and the Void.
 */
export interface Handover {
  live: boolean;
  time: number;
  needle: number;
  shown: number;
  pose: JourneyPose | null;
  focus: boolean;
}

export interface HomeProps {
  models: HomeModels;
  handover: Handover;
}

/** What Home keeps from frame to frame. Plain values, written per frame. */
interface HomeState {
  /** Home drove the objects last frame; false until the hand-over, and again while a seek holds the clock. */
  live: boolean;
  /** The angle the needle's spring is pulled toward, radians: the pointer's, the drift's, or the last one held. */
  target: number;
  /** When the idle motion's while ends (performance.now() ms): IDLE_SECONDS after the last stir. */
  idleUntil: number;
  /** Seconds of idle motion since the hand-over: the clock of the drift and the breath, and of the turn and the smoke. */
  idleTime: number;
  /** Where a drifting needle's run ends on that clock: the drift's first rest at or after the idle while's end. */
  driftUntil: number;
  /** The world's seconds at the hand-over (`Handover.time`), which the bands' turn and the smoke's drift go on from. */
  base: number;
  /** The pointer move and the transition Home last saw, to tell a new one. */
  pointerAt: number;
  transition: number;
  /** The scroll's rise Home last posed (NaN before the first frame after a hand-over), to tell a change: a stir. */
  u: number;
  /** The reduced-motion step fade (stepFade.ts): the stop the scene shows, and whether the host is faded down. */
  fade: StepFade;
  /** `<html data-step-fade>` is set: the DOM as Home last wrote it, so a frame writes it only when it changes. */
  faded: boolean;
  /** `<html data-rising>` is set: likewise, the DOM as Home last wrote it. */
  rising: boolean;
  /** The end view (`--end`, `<html data-end>`, `#end`'s inert) as Home last wrote it (endView.ts). */
  end: EndWritten;
}

/** Sets or takes away `<html data-step-fade>`, and notes it, writing the DOM only when it changes. */
function showStepFade(state: HomeState, on: boolean): void {
  if (state.faded === on) return;
  state.faded = on;
  document.documentElement.toggleAttribute(STEP_FADE_ATTRIBUTE, on);
}

/** Sets or takes away `<html data-rising>`, and notes it, writing the DOM only when it changes. */
function showRising(state: HomeState, on: boolean): void {
  if (state.rising === on) return;
  state.rising = on;
  document.documentElement.toggleAttribute(RISING_ATTRIBUTE, on);
}

/** `frame.scroll` with nothing driving the home: every share 0. */
function clearScroll(): void {
  frame.scroll.u = frame.scroll.letters = frame.scroll.iris = frame.scroll.needleDip = 0;
}

/** Scratch for the pivot's place on the screen: no vector is made per frame. */
const pivotWorld = new THREE.Vector3();
const pointerPx = { x: 0, y: 0 };
const pivotPx = { x: 0, y: 0 };

/**
 * The home (spec §2.2), once the opening has landed: the needle follows the cursor with a slight, heavy delay, and the
 * world idles for a while, then sleeps. The Opening builds the objects, poses them through the opening and frees them;
 * it mounts Home as soon as the compass exists and hands the home over (`handover.live`) once it has posed it, and takes
 * it back while a seek holds its clock.
 *
 * **Scroll.** The first stretch of scroll, the HOME chapter's one unit, raises the camera from the home to straight
 * above the name BOB (scrollPose.ts): each frame it poses the rise of the frame's one journey pose (`handover.pose`, the
 * Opening's `journeyPoseAt(progress, aspect)`; journey.ts: M2a's scroll pose itself up to the unit's end), the compass
 * opening like an iris (`setIris`), the needle turning down into
 * it (`setNeedleDip`) and the light running out of the O into the two B letters (`setLetters`, the one place they are
 * drawn). It writes no shot: the camera is the same journey's, written by the Opening in the same frame, before the Rig
 * (src/scene/bob/shotSource.ts). Scrolling back plays it backwards to the home; past the unit the compass holds at BOB
 * from above (the camera goes on, into the dive). It reports the pose in `frame.scroll`. With reduced motion the scroll steps a
 * whole stop at a time (src/input/target.ts) and each step is a short fade (stepFade.ts): the pose stays at the stop it
 * shows while `<html data-step-fade>` fades the scene host down over STEP_FADE_MS, jumps to the stop the target is
 * nearest once it is dark, and the attribute goes, so it fades back; without reduced motion the attribute is never set.
 * The hero's SCROLL cue leaves with the rise: `<html data-rising>` is set while the rise is above 0.01 (`risingFor`) and
 * the stylesheet fades the cue out over 0.4 s (at once with reduced motion), and it is taken away again at the home, on
 * a let-go and on unmount, written to the DOM only when it changes.
 *
 * **The end.** The move from Cookies Clicker into the night and the end page (way A) is the stylesheet's, from what Home
 * writes each frame (endView.ts): `--end`, the pose's `night`, and `<html data-end>`, `moving` on the way and `rest`
 * once the progress it poses and the target are both on the end, with `#end` inert until then. Written only where it
 * changes; leaving the rest scrolls the page back to its top first; cleared on a let-go and on unmount, as the cue is.
 *
 * **Aim.** At the home itself at rest (`aimsAt`: HOME_IDLE on the home page, the rise at 0) a mouse or a pen that has
 * moved aims the needle at itself: `needleAngleFor(pointer, pivot)` in the canvas's pixels, the pivot where the camera
 * (parallax and all) puts the compass's pivot on the screen this frame. Until one has moved, and so always on a touch
 * screen (the Rig reads no finger), the needle follows `driftAngle`, a slow swing round its rest. A pointer on the pivot
 * itself gives no angle and keeps the last target; anywhere else, up the rise included, the needle's target holds
 * where it was and the dip carries the needle down from there. It follows its target through
 * `new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega)`, started at each hand-over from the angle the opening left
 * it at, still, and never set again until the next one, so the aim back at the home takes up from where the spring is;
 * with reduced motion the spring is set straight to the target, with no animation.
 *
 * **Idle.** For IDLE_SECONDS after the last stir (the hand-over, a phase change, a pointer move at home, a move of the
 * rise), and for a drifting needle on to the drift's next rest (`nextDriftRest`), the bands turn (`setSpin`), the smoke
 * drifts and the needle breathes (`needleGlowAt`, its glow up to 1.4 times its rest and back over 4 s; the engraving holds still),
 * all on one clock that stops with them, so a sleeping scene is a still frame of them and a wake goes on from there.
 * The turn and the smoke go on from the world's time at the hand-over, so the hand-over moves neither; a seek that
 * takes the scene back gets the needle at its resting glow, which the opening never moves, and the compass closed, the
 * needle out of its dip and the letters dark, as the opening has them. None of it under reduced motion. Each frame it writes
 * `motion.compass` (`idle`, `needle`, `needleSpeed`), so the Heartbeat lets the canvas sleep once the idle while is over
 * and the needle has settled; and `frame.needleAngle`, for the debug bridge. While the story moves the scroll loop
 * wakes the canvas on each of its frames (the Heartbeat's `scrolling`), so a rise draws and sleeps again at rest.
 */
export function Home({ models, handover }: HomeProps): null {
  const [spring] = useState(() => new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega));
  const [state] = useState<HomeState>(() => ({
    live: false,
    target: handover.needle,
    idleUntil: 0,
    idleTime: 0,
    driftUntil: 0,
    base: handover.time,
    pointerAt: frame.pointerAt,
    transition: useScene.getState().transitionId,
    u: Number.NaN,
    fade: stepFadeFrom(0),
    faded: false,
    rising: false,
    end: endWritten(),
  }));
  const invalidate = useThree((three) => three.invalidate);
  /** The pivot the needle turns on (`CompassModel.pivot`): the needle's own centre, the armillary's origin. */
  const pivot = models.compass.pivot;

  // Gone: nothing of the home's keeps the canvas drawing, the host is not left faded down, the cue is not left hidden,
  // the end page is not left out of the flow or inert, and no scroll pose is reported.
  useEffect(
    () => () => {
      Object.assign(motion.compass, AT_REST);
      showStepFade(state, false);
      showRising(state, false);
      clearEndView(document.documentElement, endPage(), state.end);
      clearScroll();
    },
    [state],
  );

  useFrame(({ camera, size }, delta) => {
    // The frame's one journey pose, the Opening's: there whenever the home is handed over.
    const journey = handover.pose;
    if (!handover.live || journey === null) {
      // Let go (a seek holds the loader's clock): the Opening poses the scene from the held moment, which knows nothing
      // of the scroll, so the compass is closed, its needle out of the dip and the letters dark again, and the host is
      // not left faded down nor the cue hidden, nor the night over the scene.
      if (state.live) {
        models.compass.setNeedleGlow(1);
        models.compass.setIris(0);
        models.compass.setNeedleDip(0);
        models.engraving.setLetters(0);
        showStepFade(state, false);
        showRising(state, false);
        clearEndView(document.documentElement, endPage(), state.end);
        clearScroll();
      }
      state.live = false;
      return;
    }
    const now = performance.now();
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);
    const { reducedMotion: reduced, transitionId, phase, scene } = useScene.getState();

    // The stop the scroll's target is nearest: what the step fade shows once it has faded there (reduced motion only).
    const stop = nearestStop(STOPS, frame.target);

    // What stirs the idle motion: the hand-over (the needle starts where the opening left it, still, and the idle clock
    // at its start, where the drift sets off from the rest), a phase change, a pointer move at home, and the scroll.
    let stirred = false;
    if (!state.live) {
      state.live = true;
      stirred = true;
      state.idleTime = 0;
      state.base = handover.time;
      state.target = handover.needle;
      spring.set(handover.needle, 0);
      state.u = Number.NaN;
      // A hand-over poses the stop the target is at, with no fade: the canvas is not showing a step.
      state.fade = stepFadeFrom(stop);
    }

    // The scroll's rise (scrollPose.ts): the damped progress, or with reduced motion the stop the step fade shows, which
    // jumps only once the host has faded down. The fade asks for frames until it is dark and the jump is drawn.
    stepFadeAt(state.fade, stop, reduced, now);
    showStepFade(state, state.fade.darkAt !== null);
    if (state.fade.darkAt !== null) invalidate();
    const shown = reduced ? state.fade.shown : frame.progress;
    // The Opening placed this frame's camera, from the progress it read before this frame (the damped one is the same;
    // the step fade's stop is the one Home last posed). A step that has just jumped asks for the frame that stands the
    // camera on the new stop; the host is dark now, so the frame it was a stop behind is never seen.
    if (reduced && !Object.is(handover.shown, shown)) invalidate();
    handover.shown = shown;
    // The compass's pose is the journey's rise (journey.ts: M2a's scroll pose itself up to progress 1, then held at the
    // top), from the one pose of the frame, whose shot is the camera's (the Opening's, at `shown` as Home left it).
    const pose = journey.rise;
    // The needle aims only at the home itself; up the rise its spring holds the target it had (aimsAt).
    const aiming = aimsAt(phase.kind, scene, pose.u);
    if (state.u !== pose.u) {
      state.u = pose.u;
      stirred = true;
    }
    if (state.transition !== transitionId) {
      state.transition = transitionId;
      stirred = true;
    }
    if (state.pointerAt !== frame.pointerAt) {
      state.pointerAt = frame.pointerAt;
      if (aiming) stirred = true;
    }
    if (stirred) {
      state.idleUntil = now + IDLE_SECONDS * 1000;
      state.driftUntil = nextDriftRest(state.idleTime + IDLE_SECONDS);
      // The next frame, for the idle motion this starts: the Heartbeat has already run this frame, on the stillness
      // Home wrote the frame before (at rest), and a skipped mount has no phase change to wake it.
      invalidate();
    }

    const pointing = aiming && Number.isFinite(frame.pointerAt);
    const drifting = aiming && !pointing;
    const runs = !reduced && (now < state.idleUntil || (drifting && state.idleTime < state.driftUntil));
    if (runs) {
      state.idleTime += dt;
      // Past the idle while, a drifting needle runs on to its rest and no further, so it falls asleep there.
      if (drifting && now >= state.idleUntil) state.idleTime = Math.min(state.idleTime, state.driftUntil);
    }

    if (pointing && size.width > 0 && size.height > 0) {
      pointerPx.x = ((frame.pointer.x + 1) / 2) * size.width;
      pointerPx.y = ((1 - frame.pointer.y) / 2) * size.height;
      pivot.getWorldPosition(pivotWorld).project(camera);
      pivotPx.x = ((pivotWorld.x + 1) / 2) * size.width;
      pivotPx.y = ((1 - pivotWorld.y) / 2) * size.height;
      const angle = needleAngleFor(pointerPx, pivotPx);
      if (Number.isFinite(angle)) state.target = angle;
    } else if (drifting) {
      state.target = driftAngle(state.idleTime);
    }
    if (reduced) spring.set(state.target, 0);
    const needle = spring.step(state.target, dt);
    // Up the rise unwrapped about the held target (needleAngleAt), so a spring still settling across
    // straight down does not flip the needle's roll halfway down the dip.
    models.compass.setNeedle(needleAngleAt(needle, state.target, pose.u));
    frame.needleAngle = needle;

    // The scroll's pose: the needle turns down from where it points, the compass opens, the light runs into the B
    // letters (the only place they are drawn: the Opening poses the home once, before Home's first frame).
    models.compass.setNeedleDip(pose.needleDip);
    models.compass.setIris(pose.iris);
    models.engraving.setLetters(pose.letters);
    const scroll = frame.scroll;
    scroll.u = pose.u;
    scroll.letters = pose.letters;
    scroll.iris = pose.iris;
    scroll.needleDip = pose.needleDip;
    // The hero's SCROLL cue goes with the rise and comes back at the home (the spec shows no text during the scroll).
    showRising(state, risingFor(pose.u));
    // The end page (way A, endView.ts): the night's share of this frame's pose, and where the story stands, the progress
    // Home poses (with reduced motion the stop the step fade shows) and the target; written only where it changes.
    applyEndView(endViewFor(journey.night, shown, frame.target, END), document.documentElement, endPage(), state.end);

    const time = state.base + state.idleTime;
    models.compass.setSpin(time);
    models.smoke.setTime(time);
    models.compass.setNeedleGlow(reduced ? 1 : needleGlowAt(state.idleTime));

    const still = motion.compass;
    still.idle = !runs;
    still.needle = wrapAngle(state.target - spring.value);
    still.needleSpeed = spring.velocity;
  });

  return null;
}
