import * as THREE from 'three';
import type { DeviceMaterials } from './materials';
import { ALUMINIUM_TILE } from './materials';
import { bead, fillet, panel, ringsAt, sweep, type Outline, type ProfilePoint, type UvLayout } from './shapes';
import {
  DEVICE,
  FRAME_INSET,
  SCREW_SPOTS,
  SCREW_TURNS,
  STANDOFF_LENGTH,
  instanced,
  screwHeadGeometry,
  screwSlotGeometry,
  standoffGeometry
} from './hardware';

/**
 * The frame: a machined ring of anodised aluminium 3.2 × 1.83 and 0.24 high,
 * its opening inset 0.11. The outer top edge is a polished chamfer between
 * two small rounds, the other edges soft fillets. Brass pan-head screws sit
 * in the four corners, threaded standoffs hang below them, the yellow power
 * button is on the +X end and the USB-C port, a card slot and four speaker
 * holes are on the +Z side near −X.
 */

export const FRAME_HEIGHT = 0.24;

/** The polished chamfer on the outer top edge: its size, and the rounds either side. */
const CHAMFER = 0.024;
const CHAMFER_ROUND = 0.006;

/** Fillets on the outer bottom edge and the opening's top and bottom edges. */
const OUTER_BOTTOM = 0.01;
const INNER_TOP = 0.012;
const INNER_BOTTOM = 0.004;

/** The side features stand at the wall's mid-height. */
const FEATURE_Y = 0.112;

/** The power button: its bezel, the button and how far the button stands proud. */
const BEZEL_RADIUS = 0.09;
const BUTTON_RADIUS = 0.072;
const BUTTON_PROUD = 0.012;

/** Ports on the +Z side, x positions from the −X end. */
const USB_X = -0.98;
const SLOT_X = -0.6;
const HOLES_X = [-1.385, -1.335, -1.285, -1.235];

export interface FrameParts {
  object: THREE.Group;
  powerButton: THREE.Mesh;
  /** Hangs the standoffs out by `gap` (clamped to their length): the room between the frame and the back plate. */
  setStandoffs(gap: number): void;
}

function ringGeometry(): THREE.BufferGeometry {
  const quarter = Math.PI / 2;
  const H = FRAME_HEIGHT;
  const outerBottom = fillet(0, 0, -quarter, 0, OUTER_BOTTOM, 3);
  const chamferLow = fillet(0, H - CHAMFER, 0, quarter / 2, CHAMFER_ROUND, 3);
  const chamferHigh = fillet(-CHAMFER, H, quarter / 2, quarter, CHAMFER_ROUND, 3);
  const innerTop = fillet(-FRAME_INSET, H, quarter, Math.PI, INNER_TOP, 4);
  const innerBottom = fillet(-FRAME_INSET, 0, Math.PI, 3 * quarter, INNER_BOTTOM, 2);
  const last = (points: ProfilePoint[]): ProfilePoint => points[points.length - 1];
  const wrap: UvLayout = { kind: 'wrap', tile: ALUMINIUM_TILE };
  const flat: UvLayout = { kind: 'world', tile: ALUMINIUM_TILE };
  return sweep([
    { rings: ringsAt(DEVICE, [...outerBottom, chamferLow[0]]), uv: wrap },
    { rings: ringsAt(DEVICE, [...chamferLow, ...chamferHigh]), uv: wrap, group: 1 },
    { rings: ringsAt(DEVICE, [last(chamferHigh), innerTop[0]]), uv: flat },
    { rings: ringsAt(DEVICE, [...innerTop, ...innerBottom]), uv: wrap },
    { rings: ringsAt(DEVICE, [last(innerBottom), outerBottom[0]]), uv: flat }
  ]);
}

/** A port seen face-on: a dark recess with a polished lip, built facing +y. */
function port(outline: Outline, lip: number): { recess: THREE.BufferGeometry; lip: THREE.BufferGeometry } {
  return { recess: panel(outline), lip: bead(outline, lip, lip) };
}

/** Turns a part built facing +y to face +z (its depth becomes height). */
const FACE_Z = new THREE.Matrix4().makeRotationX(Math.PI / 2);
/** Turns a part built facing +y to face +x. */
const FACE_X = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);

export function buildFrame(m: DeviceMaterials): FrameParts {
  const object = new THREE.Group();
  object.name = 'frame';

  const ring = new THREE.Mesh(ringGeometry(), [m.anodised, m.chamfer]);
  ring.name = 'frame:ring';
  object.add(ring);

  // Screws in the corners, their heads on the frame's top.
  const top = FRAME_HEIGHT;
  const spots = SCREW_SPOTS.map(([x, z]) => [x, top - 0.0005, z] as const);
  object.add(instanced(screwHeadGeometry(), m.brass, spots, 'frame:screws', SCREW_TURNS));
  object.add(instanced(screwSlotGeometry(), m.recess, spots, 'frame:slots', SCREW_TURNS));

  // Threaded standoffs below them, sliding up into the wall as the frame meets the back plate.
  const standoffs = instanced(
    standoffGeometry(),
    m.brass,
    SCREW_SPOTS.map(([x, z]) => [x, 0, z] as const),
    'frame:standoffs'
  );
  object.add(standoffs);
  const setStandoffs = (gap: number): void => {
    const shown = Math.min(STANDOFF_LENGTH, Math.max(0, gap));
    standoffs.position.y = STANDOFF_LENGTH - shown;
    standoffs.visible = shown > 1e-4;
  };

  // The power button on the +X end: a dark bezel, a polished lip and the lit button.
  const endX = DEVICE.width / 2;
  const bezelOutline: Outline = { width: 2 * BEZEL_RADIUS, depth: 2 * BEZEL_RADIUS, radius: BEZEL_RADIUS };
  const bezel = new THREE.Mesh(panel(bezelOutline).applyMatrix4(FACE_X), m.recess);
  bezel.position.set(endX + 0.0006, FEATURE_Y, 0);
  bezel.name = 'frame:bezel';
  const bezelLip = new THREE.Mesh(bead(bezelOutline, 0.0035, 0.0035).applyMatrix4(FACE_X), m.chamfer);
  bezelLip.position.copy(bezel.position);
  bezelLip.name = 'frame:bezel-lip';
  const depth = BUTTON_PROUD + 0.004;
  const buttonGeometry = new THREE.CylinderGeometry(BUTTON_RADIUS, BUTTON_RADIUS, depth, 48, 1).applyMatrix4(FACE_X);
  const powerButton = new THREE.Mesh(buttonGeometry, [m.gold, m.power, m.recess]);
  powerButton.position.set(endX + BUTTON_PROUD - depth / 2, FEATURE_Y, 0);
  powerButton.name = 'frame:power';
  powerButton.userData.part = 'power';
  object.add(bezel, bezelLip, powerButton);

  // USB-C, the card slot and the speaker holes on the +Z side.
  const sideZ = DEVICE.depth / 2;
  const usb = port({ width: 0.17, depth: 0.06, radius: 0.03 }, 0.0042);
  const usbRecess = new THREE.Mesh(usb.recess.applyMatrix4(FACE_Z), m.recess);
  usbRecess.position.set(USB_X, FEATURE_Y, sideZ + 0.0006);
  const usbShell = new THREE.Mesh(usb.lip.applyMatrix4(FACE_Z), m.steel);
  usbShell.position.copy(usbRecess.position);
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.017, 0.003), m.plastic);
  tongue.position.set(USB_X, FEATURE_Y, sideZ + 0.0016);
  usbRecess.name = 'frame:usb';
  usbShell.name = 'frame:usb-shell';
  tongue.name = 'frame:usb-tongue';

  const slot = port({ width: 0.26, depth: 0.026, radius: 0.013 }, 0.003);
  const slotRecess = new THREE.Mesh(slot.recess.applyMatrix4(FACE_Z), m.recess);
  slotRecess.position.set(SLOT_X, FEATURE_Y, sideZ + 0.0006);
  const slotLip = new THREE.Mesh(slot.lip.applyMatrix4(FACE_Z), m.chamfer);
  slotLip.position.copy(slotRecess.position);
  slotRecess.name = 'frame:slot';
  slotLip.name = 'frame:slot-lip';

  const hole = port({ width: 0.026, depth: 0.026, radius: 0.013 }, 0.003);
  const holeSpots = HOLES_X.map((x) => [x, FEATURE_Y, sideZ + 0.0006] as const);
  const holes = instanced(hole.recess.applyMatrix4(FACE_Z), m.recess, holeSpots, 'frame:holes');
  const holeLips = instanced(hole.lip.applyMatrix4(FACE_Z), m.chamfer, holeSpots, 'frame:hole-lips');
  object.add(usbRecess, usbShell, tongue, slotRecess, slotLip, holes, holeLips);

  return { object, powerButton, setStandoffs };
}
