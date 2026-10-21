import { useFrame, useThree } from '@react-three/fiber';
import { damp3 } from 'maath/easing';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { applyCameraShot } from '~/engine/v3/shots';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
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
 * The camera. It stands where the Opening says (`frame.shot`, src/scene/v3/Opening.tsx: the loader's macro and high
 * shots, then the home, each framed for the screen's shape), put there with `applyCameraShot` for the canvas's size on
 * every frame drawn and on a resize. Before the Opening has posed a frame there is no shot, and the camera stays where
 * it is (the canvas is not shown yet).
 *
 * On top of the shot, at home only, a pointer parallax turns the camera about the shot's look-at point by at most
 * PARALLAX radians, damped (maath `damp3`), so the compass keeps its place on the page while the constellations shift
 * against each other and their depth reads (spec §2.2). During the opening the camera flies the Opening's path and
 * nothing else; with reduced motion there is no parallax at all.
 *
 * The pointer is read from `pointermove` on the window into `frame.pointer` (-1..1, up is +1): a mouse or a pen only,
 * a finger has no hover to follow. On a page without a scene (the store's `scene` is null) the pointer is still noted,
 * so the camera is right when the scene shows again, but wakes nothing.
 */
export function Rig(): null {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
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
      const { reducedMotion, scene } = useScene.getState();
      if (!reducedMotion && scene !== null) invalidate();
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [invalidate]);

  /** Puts the camera on the Opening's shot for the canvas's size, then turns it about the look-at point by the parallax. */
  const place = (): void => {
    const shot = frame.shot;
    if (!shot || !(width > 0 && height > 0)) return;
    applyCameraShot(camera, shot, width / height);
    const { x, y } = sway.current;
    if (x === 0 && y === 0) return;
    const target = centre.current.set(shot.target[0], shot.target[1], shot.target[2]);
    orbit.current.setFromVector3(offset.current.subVectors(camera.position, target));
    orbit.current.theta += x;
    orbit.current.phi = THREE.MathUtils.clamp(orbit.current.phi - y, 0.01, Math.PI - 0.01);
    camera.position.setFromSpherical(orbit.current).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };

  // A new size is framed before the frame it draws. Only a new size or camera (what `place` reads): a render for
  // anything else draws nothing.
  useLayoutEffect(() => {
    place();
    invalidate();
  }, [camera, width, height, invalidate]);

  useFrame((_, delta) => {
    const reduced = useScene.getState().reducedMotion;
    const home = frame.loader.stage === 'home';
    const goal: [number, number, number] = reduced || !home ? [0, 0, 0] : [frame.pointer.x * PARALLAX, frame.pointer.y * PARALLAX, 0];
    motion.parallax = damp3(sway.current, goal, PARALLAX_SMOOTH, Math.min(Math.max(delta, 0), MAX_STEP), Infinity, undefined, PARALLAX_SETTLED);
    place();
  });

  return null;
}
