/**
 * Fits the compass to the screen. The page asks for a layout, where the dial's
 * centre sits in the canvas and how wide the rim draws in CSS pixels, and the
 * rig answers with a perspective camera that puts the face centre and the rim
 * exactly there. It uses three's camera maths only (no renderer), so it runs
 * under node in the unit tests.
 *
 * The camera always looks at the world origin, the face centre. The dial is
 * not moved to its layout position: the projection is shifted with a view
 * offset instead, so the dial stays at the origin for every consumer.
 */

import type * as THREE from 'three';
import { DIAL } from './instrument/dialSpec';

/** The camera's vertical field of view, in degrees. */
const FOV = 30;

/** Where the dial sits in the canvas, in CSS pixels. */
export interface DialLayout {
  /** The face centre, from the canvas's left edge. */
  x: number;
  /** The face centre, from the canvas's top edge. */
  y: number;
  /** The rim's diameter at zoom 1. */
  diameter: number;
}

/**
 * Where the dial sits on a `width` by `height` canvas. A wide canvas puts it
 * right of centre, beside the text; a narrow one puts it above the text.
 */
export function dialLayout(width: number, height: number): DialLayout {
  if (width >= 1.2 * height) {
    return { x: width * 0.62, y: height * 0.5, diameter: Math.min(height * 0.64, width * 0.52) };
  }
  return { x: width * 0.5, y: height * 0.3, diameter: Math.min(width * 0.8, height * 0.46) };
}

/**
 * How far a camera `fovDeg` degrees tall must stand from the face so that a
 * disc of `radius` draws `diameterPx` wide on a canvas `heightPx` tall,
 * looking straight at it.
 */
export function fitDistance(diameterPx: number, heightPx: number, fovDeg: number, radius: number = DIAL.rim): number {
  return (radius * heightPx) / (diameterPx * Math.tan((fovDeg * Math.PI) / 360));
}

/** One camera shot: a layout and how the camera sees the dial in it. */
export interface Shot {
  layout: DialLayout;
  /** Degrees the camera sits off the dial's axis (a Framing's tilt). */
  tilt: number;
  /** 1 fits the dial to its layout; larger comes closer. */
  zoom: number;
  /** The near plane, in world units. */
  near: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** The shot `t` of the way from `a` to `b` (0 is `a`, 1 is `b`; not clamped). */
export function lerpShot(a: Shot, b: Shot, t: number): Shot {
  return {
    layout: {
      x: lerp(a.layout.x, b.layout.x, t),
      y: lerp(a.layout.y, b.layout.y, t),
      diameter: lerp(a.layout.diameter, b.layout.diameter, t)
    },
    tilt: lerp(a.tilt, b.tilt, t),
    zoom: lerp(a.zoom, b.zoom, t),
    near: lerp(a.near, b.near, t)
  };
}

/**
 * Puts `camera` where `shot` asks on a canvas `width` by `height` CSS pixels
 * and looks at the world origin, the face centre. The camera stands
 * `fitDistance(diameter * zoom)` away, tilted `shot.tilt` degrees up from the
 * dial's axis; the view offset then slides the picture so the face centre lands
 * on the layout's (x, y).
 */
export function placeCamera(camera: THREE.PerspectiveCamera, shot: Shot, width: number, height: number): void {
  const tilt = (shot.tilt * Math.PI) / 180;
  const distance = fitDistance(shot.layout.diameter * shot.zoom, height, FOV);

  camera.fov = FOV;
  camera.aspect = width / height;
  camera.near = shot.near;
  camera.up.set(0, 1, 0);
  camera.position.set(0, distance * Math.sin(tilt), distance * Math.cos(tilt));
  camera.lookAt(0, 0, 0);
  // The optical axis passes through the face centre; the offset moves where that lands on the canvas.
  camera.setViewOffset(width, height, width / 2 - shot.layout.x, height / 2 - shot.layout.y, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
