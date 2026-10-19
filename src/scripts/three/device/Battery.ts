import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DeviceMaterials } from './materials';
import { plate, type Outline, type UvLayout } from './shapes';

/**
 * The battery: a lithium pouch about 2.46 × 1.38 × 0.1 with soft rounded
 * edges and battery.webp on its top (the image keeps its aspect), amber
 * Kapton tape wrapped round its ±X ends, red and black leads from its −X end
 * to a small white connector, and a low connector near its +Z edge where the
 * board's flex lands.
 */

export const POUCH: Outline = { width: 2.46, depth: 1.38, radius: 0.03 };

/** The pouch's top face, in the battery's frame (the tape stands a hair above it). */
export const POUCH_TOP = 0.103;

/** The pouch stands a little off the layer's floor, so the tape under it does too (and clears the back plate's screw heads). */
const POUCH_BOTTOM = 0.008;
const POUCH_HEIGHT = POUCH_TOP - POUCH_BOTTOM;
const POUCH_EDGE = 0.03;

/** Kapton: its thickness, how far it wraps onto the top and bottom, and the hairline it stands off the pouch. */
const TAPE = 0.0025;
const TAPE_WRAP = 0.14;
const TAPE_GAP = 0.0004;

/** The flex connector on the pouch's top. */
const CONNECTOR = { width: 0.42, depth: 0.06, height: 0.014, z: 0.6 };

/** Where the flex lands, in the battery's frame: on the connector's top. */
export const FLEX_LANDING = { y: POUCH_BOTTOM + POUCH_HEIGHT + CONNECTOR.height + 0.0015, z: CONNECTOR.z };

/** Fitted to the pouch from above, so the top shows battery.webp whole. */
const FIT = { kind: 'fit', hx: POUCH.width / 2, hz: POUCH.depth / 2 } as const satisfies UvLayout;

/**
 * The pouch's rounded sides: a smooth strip of foil from above the printing,
 * drawn out round the outline (the image's own edge is crimped, and stretched
 * down the walls it would streak).
 */
const SIDE: UvLayout = { kind: 'wrap', tile: 28, u0: 0.38, v0: 0.86 };

/** The tape round the +X end, as a thin U-shaped section extruded along z. */
function tapeEnd(): THREE.BufferGeometry {
  const right = POUCH.width / 2;
  const low = POUCH_BOTTOM;
  const high = POUCH_BOTTOM + POUCH_HEIGHT;
  const r = POUCH_EDGE;
  const start = right - TAPE_WRAP;
  const shape = new THREE.Shape();
  const outer = TAPE_GAP + TAPE;
  const inner = TAPE_GAP;
  // Outside, over the top, round the end and back under the bottom...
  shape.moveTo(start, high + outer);
  shape.lineTo(right - r, high + outer);
  shape.absarc(right - r, high - r, r + outer, Math.PI / 2, 0, true);
  shape.lineTo(right + outer, low + r);
  shape.absarc(right - r, low + r, r + outer, 0, -Math.PI / 2, true);
  shape.lineTo(start, low - outer);
  // ...then back along the inside.
  shape.lineTo(start, low - inner);
  shape.lineTo(right - r, low - inner);
  shape.absarc(right - r, low + r, r + inner, -Math.PI / 2, 0, false);
  shape.lineTo(right + inner, high - r);
  shape.absarc(right - r, high - r, r + inner, 0, Math.PI / 2, false);
  shape.lineTo(start, high + inner);
  shape.closePath();
  const depth = POUCH.depth - 2 * POUCH.radius;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Both tape ends in one geometry, with UVs fitted from above like the pouch's top. */
function tapeGeometry(): THREE.BufferGeometry {
  const plus = tapeEnd();
  const minus = tapeEnd().rotateY(Math.PI);
  const both = mergeGeometries([plus, minus])!;
  plus.dispose();
  minus.dispose();
  const position = both.getAttribute('position');
  const uv = both.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + FIT.hx) / (2 * FIT.hx), (FIT.hz - position.getZ(i)) / (2 * FIT.hz));
  }
  uv.needsUpdate = true;
  return both;
}

export interface BatteryParts {
  object: THREE.Group;
}

export function buildBattery(m: DeviceMaterials): BatteryParts {
  const object = new THREE.Group();
  object.name = 'battery';

  const pouch = new THREE.Mesh(
    plate(POUCH, POUCH_HEIGHT, POUCH_EDGE, POUCH_EDGE, { top: { uv: FIT }, side: { uv: SIDE }, bottom: { uv: FIT } }).translate(0, POUCH_BOTTOM, 0),
    m.pouch
  );
  pouch.name = 'battery:pouch';

  const tape = new THREE.Mesh(tapeGeometry(), m.tape);
  tape.name = 'battery:tape';

  const top = POUCH_BOTTOM + POUCH_HEIGHT;
  const connector = new THREE.Mesh(
    plate({ width: CONNECTOR.width, depth: CONNECTOR.depth, radius: 0.006 }, CONNECTOR.height, 0.003, 0.001, {
      top: { uv: { kind: 'world', tile: 0.5 } },
      side: { uv: { kind: 'world', tile: 0.5 } },
      bottom: { uv: { kind: 'world', tile: 0.5 } }
    }),
    m.epoxy
  );
  connector.position.set(0, top, CONNECTOR.z);
  connector.name = 'battery:connector';

  // The white connector off the −X end, and the red and black leads to it.
  const plugX = -1.385;
  const plugZ = 0.5;
  const plug = new THREE.Mesh(
    plate({ width: 0.075, depth: 0.1, radius: 0.008 }, 0.045, 0.004, 0.002, {
      top: { uv: { kind: 'world', tile: 0.5 } },
      side: { uv: { kind: 'world', tile: 0.5 } },
      bottom: { uv: { kind: 'world', tile: 0.5 } }
    }),
    m.nylon
  );
  plug.position.set(plugX, 0.025, plugZ);
  plug.name = 'battery:plug';

  const endX = -POUCH.width / 2 - TAPE_GAP - TAPE;
  const lead = (offset: number, z0: number): THREE.BufferGeometry => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(endX + 0.004, 0.052, z0),
      new THREE.Vector3(endX - 0.05, 0.054, z0 + 0.025),
      new THREE.Vector3(plugX + offset + 0.012, 0.05, z0 + 0.12),
      new THREE.Vector3(plugX + offset, 0.048, plugZ - 0.11),
      new THREE.Vector3(plugX + offset, 0.048, plugZ - 0.048)
    ]);
    return new THREE.TubeGeometry(curve, 28, 0.0085, 8, false);
  };
  const red = new THREE.Mesh(lead(-0.017, 0.22), m.wireRed);
  red.name = 'battery:lead-red';
  const black = new THREE.Mesh(lead(0.017, 0.27), m.wireBlack);
  black.name = 'battery:lead-black';

  object.add(pouch, tape, connector, plug, red, black);
  return { object };
}
