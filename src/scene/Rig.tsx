import { useFrame, useThree } from '@react-three/fiber';
import { damp3 } from 'maath/easing';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { isAiming } from '~/engine/bob/needleAim';
import { applyCameraShot } from '~/engine/bob/shots';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { fogFor } from './bob/look';
import { motion } from './motion';

/** The most the pointer turns the camera about the shot's look-at point, radians, either way on each axis. */
export const PARALLAX = 0.04;

/** How long the parallax takes to catch up with the pointer (maath's smoothTime), seconds. */
const PARALLAX_SMOOTH = 0.45;

/** Within this many radians of the pointer's angle the parallax is there, and stops asking for frames. */
const PARALLAX_SETTLED = 1e-4;

/** The longest step the parallax takes in one frame, seconds. */
const MAX_STEP = 0.1;

const clamp = (value: number): number => Math.min(1, Math.max(-1, value));

/**
 * The camera. It stands where the Opening says (`frame.shot`, src/scene/bob/Opening.tsx: the loader's wide shot of the
 * whole name, the push-in, then the home, each framed for the screen's shape), put there with `applyCameraShot` for
 * the canvas's size on every frame drawn and on a resize. Before the Opening has posed a frame there is no shot, and
 * the camera stays where it is (the canvas is not shown yet).
 *
 * On top of the shot, at home only, a pointer parallax turns the camera about the shot's look-at point by at most
 * PARALLAX radians, damped (maath `damp3`), so the compass keeps its place on the page while the bands and the
 * engraved letters shift against each other and their depth reads (spec §2.2). The shot says how much of it:
 * `shot.sway` (0..1, absent is 1) scales the turn, so the top shot, which looks straight down, has sway 0 and keeps
 * its camera exactly where the shot puts it. The camera's `up` is the shot's (applyCameraShot sets it), and the
 * parallax's `lookAt` keeps it. During the opening the camera flies the Opening's path and nothing else; with reduced
 * motion there is no parallax at all.
 *
 * The pointer is read from `pointermove` on the window into `frame.pointer` (-1..1, up is +1) and the time of the move
 * into `frame.pointerAt`, for the home's needle (src/scene/bob/Home.tsx): a mouse or a pen only, a finger has no hover
 * to follow. A move wakes the canvas while the needle aims (`isAiming`: the home page at rest, src/engine/bob/needleAim.ts)
 * or, without reduced motion, for the parallax. On a page without a scene (the store's `scene` is null) the pointer is
 * still noted, so the camera is right when the scene shows again, but wakes nothing.
 */
export function Rig(): null {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const scene = useThree((state) => state.scene);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  /** The parallax as drawn: x is the turn about the vertical (pointer x), y the tilt (pointer y), radians. */
  const sway = useRef(new THREE.Vector3());
  const orbit = useRef(new THREE.Spherical());
  const offset = useRef(new THREE.Vector3());
  const centre = useRef(new THREE.Vector3());

  useEffect(() => {
    const move = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!(w > 0 && h > 0)) return;
      frame.pointer.x = clamp((event.clientX / w) * 2 - 1);
      frame.pointer.y = clamp(1 - (event.clientY / h) * 2);
      frame.pointerAt = performance.now();
      // A frame for the parallax, and for the home's needle, which follows the pointer with reduced motion too (it is
      // set straight to its target then).
      const { reducedMotion, scene, phase } = useScene.getState();
      if (scene !== null && (!reducedMotion || isAiming(phase.kind, scene))) invalidate();
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [invalidate]);

  /**
   * Puts the camera on the Opening's shot for the canvas's size, then turns it about the look-at point by the parallax.
   * The fog follows the shot (`fogFor`): it starts beyond what the camera looks at, however far back the screen's
   * shape stands it, so a phone's compass is as clear as a laptop's. Its two numbers are uniforms: no program changes.
   */
  const place = (): void => {
    const shot = frame.shot;
    if (!shot || !(width > 0 && height > 0)) return;
    applyCameraShot(camera, shot, width / height);
    if (scene.fog instanceof THREE.Fog) {
      const [px, py, pz] = shot.position;
      const [tx, ty, tz] = shot.target;
      const fog = fogFor(Math.hypot(px - tx, py - ty, pz - tz));
      scene.fog.near = fog.near;
      scene.fog.far = fog.far;
    }
    // The parallax a shot allows: its `sway` (absent is 1) times the pointer's turn. The top shot's 0 adds nothing, so
    // the camera stays exactly where the shot put it, looking straight down with its `up`, and the orbit is skipped.
    const allowed = shot.sway ?? 1;
    const x = sway.current.x * allowed;
    const y = sway.current.y * allowed;
    if (x === 0 && y === 0) return;
    const target = centre.current.set(shot.target[0], shot.target[1], shot.target[2]);
    orbit.current.setFromVector3(offset.current.subVectors(camera.position, target));
    orbit.current.theta += x;
    orbit.current.phi = THREE.MathUtils.clamp(orbit.current.phi - y, 0.01, Math.PI - 0.01);
    camera.position.setFromSpherical(orbit.current).add(target);
    camera.lookAt(target); // with the camera's `up`, as applyCameraShot set it from the shot: not reset here
    camera.updateMatrixWorld();
  };

  // A new size is framed before the frame it draws. Only a new size or camera (what `place` reads): a render for
  // anything else draws nothing.
  useLayoutEffect(() => {
    place();
    invalidate();
  }, [camera, scene, width, height, invalidate]);

  useFrame((_, delta) => {
    const reduced = useScene.getState().reducedMotion;
    const home = frame.loader.stage === 'home';
    const goal: [number, number, number] = reduced || !home ? [0, 0, 0] : [frame.pointer.x * PARALLAX, frame.pointer.y * PARALLAX, 0];
    motion.parallax = damp3(sway.current, goal, PARALLAX_SMOOTH, Math.min(Math.max(delta, 0), MAX_STEP), Infinity, undefined, PARALLAX_SETTLED);
    place();
  });

  return null;
}
