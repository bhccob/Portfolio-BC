import * as THREE from 'three';
import type { CompassPose } from './Choreography';
import { DIAL } from './instrument/dialSpec';
import type { TrackId } from './instrument/drive';
import { HUB_TOP } from './instrument/DriveParts';
import type { InstrumentModel } from './instrument/Instrument';

/**
 * Where the compass's parts land on the canvas, in CSS pixels from its top
 * left, for the page's words and labels over it (CompassScene.overlay): the
 * read head, the spindle and the rim, projected through the camera as it was
 * last placed. A point counts as visible only in front of the camera and on
 * the canvas; nothing on a canvas with no size is.
 */

/** A point on the canvas, CSS px. */
export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface Overlay {
  /** The read head, while the needle is the arm; with the track and the test point (0..3) under it, or null. */
  head: { x: number; y: number; visible: boolean; track: TrackId | null; tp: number | null };
  /**
   * The hub in Off duty: its centre, the length of SPINDLE_REACH world units
   * there (CSS px), and the platter's turn as drawn, degrees counter-clockwise
   * as seen: the pose's platter (never wrapped) plus the free turn (wrapped to
   * a half turn either way, so it can jump by 360: set it every frame, with
   * no transition). CSS turns clockwise, so `rotate(calc(-1deg * angle))`.
   */
  spindle: { x: number; y: number; radius: number; angle: number; visible: boolean };
  /** The track under the pointer, while the tracks answer it. */
  hover: TrackId | null;
}

/** World units round the hub that the Off duty orbit circles at. */
export const SPINDLE_REACH = 0.42;

const view = new THREE.Vector3();
const ndc = new THREE.Vector3();
const right = new THREE.Vector3();
const headAt = new THREE.Vector3();
const hubAt = new THREE.Vector3();
const centreAt = new THREE.Vector3();

/** `world` on a `width` × `height` canvas through `camera`; a point that is not a number lands at the origin, unseen. */
export function toScreen(world: THREE.Vector3, camera: THREE.Camera, width: number, height: number): ScreenPoint {
  if (!(width > 0 && height > 0)) return { x: 0, y: 0, visible: false };
  const inFront = view.copy(world).applyMatrix4(camera.matrixWorldInverse).z < 0;
  ndc.copy(world).project(camera);
  const x = ((ndc.x + 1) / 2) * width;
  const y = ((1 - ndc.y) / 2) * height;
  if (!(Number.isFinite(x) && Number.isFinite(y))) return { x: 0, y: 0, visible: false };
  return { x, y, visible: inFront && x >= 0 && x <= width && y >= 0 && y <= height };
}

/** How long `length` world units at `world`, along the camera's right, draw on the canvas, CSS px. */
function across(world: THREE.Vector3, length: number, camera: THREE.Camera, width: number, height: number): number {
  const { x, y } = toScreen(world, camera, width, height);
  const edge = toScreen(right.setFromMatrixColumn(camera.matrixWorld, 0).normalize().multiplyScalar(length).add(world), camera, width, height);
  return Math.hypot(edge.x - x, edge.y - y);
}

/** The dial as drawn: the face centre and the rim's diameter along the camera's right. */
export function rimOf(dial: THREE.Object3D, camera: THREE.Camera, width: number, height: number): { x: number; y: number; diameter: number } {
  if (!(width > 0 && height > 0)) return { x: 0, y: 0, diameter: 0 };
  const centre = centreAt.setFromMatrixPosition(dial.matrixWorld);
  const { x, y } = toScreen(centre, camera, width, height);
  return { x, y, diameter: 2 * across(centre, DIAL.rim, camera, width, height) };
}

/**
 * The overlay for `pose` with the model as posed and `camera` as placed: the
 * head shows once the arm has formed (drive.arm 1), the spindle in Off duty
 * alone, each only where it is on the canvas in front of the camera.
 */
export function overlayOf(model: InstrumentModel, pose: CompassPose, camera: THREE.Camera, width: number, height: number, hover: TrackId | null): Overlay {
  const head = toScreen(model.headWorld(headAt), camera, width, height);
  model.dial.updateWorldMatrix(true, false);
  const hub = model.dial.localToWorld(hubAt.set(0, HUB_TOP, 0));
  const spindle = toScreen(hub, camera, width, height);
  return {
    head: { x: head.x, y: head.y, visible: head.visible && pose.drive.arm >= 1, track: pose.tracks.current, tp: pose.tracks.tp },
    spindle: {
      x: spindle.x,
      y: spindle.y,
      radius: across(hub, SPINDLE_REACH, camera, width, height),
      angle: pose.platter + THREE.MathUtils.radToDeg(model.spin.rotation.y),
      visible: spindle.visible && pose.section === 'offduty'
    },
    hover
  };
}
