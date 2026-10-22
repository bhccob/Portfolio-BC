import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import type { CompassModel } from '~/engine/bob/build/compass';
import type { EngravingModel } from '~/engine/bob/build/engraving';
import type { SmokeModel } from '~/engine/bob/build/smoke';
import { driftAngle, isAiming, NEEDLE_SPRING, needleAngleFor, nextDriftRest } from '~/engine/bob/needleAim';
import { AT_REST } from '~/engine/stillness';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { motion } from '../motion';
import { IDLE_SECONDS, needleGlowAt } from './look';

/** The longest step the needle and the idle clock take in one frame, seconds: a wake from sleep jumps neither. */
const MAX_STEP = 0.1;

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
 */
export interface Handover {
  live: boolean;
  time: number;
  needle: number;
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
 * **Aim.** At home at rest (`isAiming`: HOME_IDLE on the home page) a mouse or a pen that has moved aims the needle at
 * itself: `needleAngleFor(pointer, pivot)` in the canvas's pixels, the pivot where the camera (parallax and all) puts
 * the compass's pivot on the screen this frame. Until one has moved, and so always on a touch screen (the Rig reads no
 * finger), the needle follows `driftAngle`, a slow swing round its rest. A pointer on the pivot itself gives no angle
 * and keeps the last target; anywhere else than at rest the needle holds where it points. It follows its target
 * through `new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega)`, started at each hand-over from the angle the
 * opening left it at, still; with reduced motion the spring is set straight to the target, with no animation.
 *
 * **Idle.** For IDLE_SECONDS after the last stir (the hand-over, a phase change, a pointer move at home), and for a
 * drifting needle on to the drift's next rest (`nextDriftRest`), the bands turn (`setSpin`), the smoke drifts and the
 * needle breathes (`needleGlowAt`, its glow up to 1.4 times its rest and back over 4 s; the engraving holds still),
 * all on one clock that stops with them, so a sleeping scene is a still frame of them and a wake goes on from there.
 * The turn and the smoke go on from the world's time at the hand-over, so the hand-over moves neither; a seek that
 * takes the scene back gets the needle at its resting glow, which the opening never moves. None of it under reduced motion. Each frame it writes `motion.compass`
 * (`idle`, `needle`, `needleSpeed`), so the Heartbeat lets the canvas sleep once the idle while is over and the needle
 * has settled; and `frame.needleAngle`, for the debug bridge.
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
  }));
  const invalidate = useThree((three) => three.invalidate);
  /** The pivot the needle turns on (`CompassModel.pivot`): the needle's own centre, the armillary's origin. */
  const pivot = models.compass.pivot;

  // Gone: nothing of the home's keeps the canvas drawing.
  useEffect(
    () => () => {
      Object.assign(motion.compass, AT_REST);
    },
    [],
  );

  useFrame(({ camera, size }, delta) => {
    if (!handover.live) {
      if (state.live) models.compass.setNeedleGlow(1);
      state.live = false;
      return;
    }
    const now = performance.now();
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);
    const { reducedMotion: reduced, transitionId, phase, scene } = useScene.getState();
    const aiming = isAiming(phase.kind, scene);

    // What stirs the idle motion: the hand-over (the needle starts where the opening left it, still, and the idle clock
    // at its start, where the drift sets off from the rest), a phase change, and a pointer move at home.
    let stirred = false;
    if (!state.live) {
      state.live = true;
      stirred = true;
      state.idleTime = 0;
      state.base = handover.time;
      state.target = handover.needle;
      spring.set(handover.needle, 0);
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
    models.compass.setNeedle(needle);
    frame.needleAngle = needle;

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
