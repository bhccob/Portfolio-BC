import * as THREE from 'three';
import { palette } from '../palette';
import { gold, outline, panelGeometry, satin, slab, sweep, type Ring } from './slab';

/**
 * The board's chips: a dark rounded body on two rows of gold pins, and the
 * empty socket waiting for the next one. Each has its origin at the centre
 * of its footprint on the board's top, so lifting it is a change of
 * `position.y`. The body (or the socket) carries `userData.slug` and has a
 * material of its own, so one chip can light up alone; its small parts
 * ignore rays, so a ray that meets a chip always lands on the body.
 */

/** Height of a chip's body, and the gap under it where the pins show. */
const BODY_HEIGHT = 0.055;
const BODY_LIFT = 0.01;
const BODY_RADIUS = 0.022;

/** Pin columns along the chip's width: their spacing, the space kept clear at each end, and each pin's size. */
const PIN_PITCH = 0.075;
const PIN_MARGIN = 0.07;
const PIN_WIDTH = 0.032;
const PIN_HEIGHT = 0.014;

/** How far the pins reach out past the body, front and back. */
export const PIN_REACH = 0.045;

/** The pin-1 dot on the body's top, in from its front-left corner. */
const DOT_SIZE = 0.045;
const DOT_INSET = 0.07;

/** The empty socket: a soft rim of this width and height round a dark floor. */
const SOCKET_RADIUS = 0.04;
const RIM_WIDTH = 0.03;
const RIM_HEIGHT = 0.022;
const FLOOR = 0.005;

const ignoreRays: THREE.Object3D['raycast'] = () => {};

/** The x offsets of a chip's pin columns, centred on the chip. */
export function pinOffsets(width: number): number[] {
  const count = Math.max(1, Math.floor((width - 2 * PIN_MARGIN) / PIN_PITCH) + 1);
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * PIN_PITCH);
}

/** A chip `width` × `depth` with gold pins along its front and back. */
export function chip(slug: string, width: number, depth: number): THREE.Mesh {
  const body = slab(width, BODY_HEIGHT, depth, BODY_RADIUS, palette.ink, { clearcoat: 0.3 });
  body.geometry.translate(0, BODY_LIFT + BODY_HEIGHT / 2, 0);
  body.name = `chip:${slug}`;
  body.userData.slug = slug;

  // One box per pin column, running under the body and out on both sides.
  const offsets = pinOffsets(width);
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(PIN_WIDTH, PIN_HEIGHT, depth + 2 * PIN_REACH), gold(), offsets.length);
  const place = new THREE.Matrix4();
  offsets.forEach((x, i) => pins.setMatrixAt(i, place.makeTranslation(x, PIN_HEIGHT / 2, 0)));
  pins.name = `chip:${slug}:pins`;
  pins.raycast = ignoreRays;
  body.add(pins);

  const dot = new THREE.Mesh(panelGeometry(DOT_SIZE, DOT_SIZE, DOT_SIZE / 2), satin(palette.cream));
  dot.position.set(-width / 2 + DOT_INSET, BODY_LIFT + BODY_HEIGHT + 0.0015, depth / 2 - DOT_INSET);
  dot.name = `chip:${slug}:dot`;
  dot.raycast = ignoreRays;
  body.add(dot);

  return body;
}

/**
 * An empty socket `width` × `depth`: a dim lilac outline, rounded over the
 * top, round a dark floor. One mesh with vertex colours, so the whole
 * footprint answers a ray and lights as one.
 */
export function socket(slug: string, width: number, depth: number): THREE.Mesh {
  const ring = (grow: number, y: number, out: number, up: number): Ring => outline(width, depth, SOCKET_RADIUS, grow, y, out, up);
  const half = RIM_WIDTH / 2;
  const rim: Ring[] = [ring(0, 0, 1, 0)];
  for (let step = 0; step <= 6; step++) {
    const angle = (step / 6) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    rim.push(ring(-half + half * cos, RIM_HEIGHT - half + half * sin, cos, sin));
  }
  rim.push(ring(-RIM_WIDTH, FLOOR, -1, 0));
  const floor: Ring[] = [ring(-RIM_WIDTH, FLOOR, 0, 1), { hx: 0, hz: 0, r: 0, y: FLOOR, out: 0, up: 1 }];

  const material = satin(0xffffff);
  material.vertexColors = true;
  const mesh = new THREE.Mesh(
    sweep([
      { rings: rim, color: palette.dim },
      { rings: floor, color: palette.boardDeep }
    ]),
    material
  );
  mesh.name = `chip:${slug}`;
  mesh.userData.slug = slug;
  return mesh;
}
