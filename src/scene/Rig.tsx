import { useFrame, useThree } from '@react-three/fiber';
import { damp3 } from 'maath/easing';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { layoutFor, placeCamera, type Shot } from '~/engine/CameraRig';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { HERO_POSE } from './Compass';
import { motion } from './motion';

/** The most the pointer turns the camera about the dial, radians, either way on each axis. */
export const PARALLAX = 0.04;

/** How long the parallax takes to catch up with the pointer (maath's smoothTime), seconds. */
const PARALLAX_SMOOTH = 0.45;

/** Within this many radians of the pointer's angle the parallax is there, and stops asking for frames. */
const PARALLAX_SETTLED = 1e-4;

/** The longest step the parallax takes in one frame, seconds. */
const MAX_STEP = 0.1;

const clamp = (value: number): number => Math.min(1, Math.max(-1, value));

/**
 * The camera. It frames the dial with revision 4's rig (engine/CameraRig): the hero pose's shot, laid out for the
 * canvas's size, the dial's centre and rim put exactly where `layoutFor` says. On top of that a pointer parallax
 * turns the camera about the dial's centre by at most PARALLAX radians, damped (maath `damp3`), so the dial keeps its
 * place on the page while the studio behind it shifts.
 *
 * The pointer is read from `pointermove` on the window into `frame.pointer` (-1..1, up is +1): a mouse or a pen only,
 * a finger has no hover to follow. With reduced motion the camera stays put. M1 has no hit targets in the scene; the
 * page above the canvas keeps its pointer events (M3 adds the raycast hover). On a page without a scene (the store's
 * `scene` is null) the pointer is still noted, so the camera is right when the scene shows again, but wakes nothing.
 */
export function Rig(): null {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  /** The parallax as drawn: x is the turn about the vertical (pointer x), y the tilt (pointer y), radians. */
  const sway = useRef(new THREE.Vector3());
  const orbit = useRef(new THREE.Spherical());

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

  /** Frames the dial for the canvas's size, then turns the camera about the dial's centre by the parallax. */
  const place = (): void => {
    const { tilt, zoom, near, side } = HERO_POSE.framing;
    const shot: Shot = { layout: layoutFor(width, height, side), tilt, zoom, near };
    placeCamera(camera, shot, width, height);
    const { x, y } = sway.current;
    if (x === 0 && y === 0) return;
    orbit.current.setFromVector3(camera.position);
    orbit.current.theta += x;
    orbit.current.phi = THREE.MathUtils.clamp(orbit.current.phi - y, 0.01, Math.PI - 0.01);
    camera.position.setFromSpherical(orbit.current);
    camera.lookAt(0, 0, 0);
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
    const goal: [number, number, number] = reduced ? [0, 0, 0] : [frame.pointer.x * PARALLAX, frame.pointer.y * PARALLAX, 0];
    motion.parallax = damp3(sway.current, goal, PARALLAX_SMOOTH, Math.min(Math.max(delta, 0), MAX_STEP), Infinity, undefined, PARALLAX_SETTLED);
    place();
  });

  return null;
}
