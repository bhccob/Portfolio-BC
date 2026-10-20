import * as THREE from 'three';
import { DIAL } from './dialSpec';
import type { InstrumentMaterials } from './materials';

/**
 * The square base plate the dial sits in: an extruded rounded square
 * DIAL.plate wide and DIAL.plateDepth deep, its top flush with the face at
 * y = 0, with a round hole for the dial and a small bevel on every edge. Its
 * top and bottom are the plate's lacquer; its sides and bevels are a brass
 * band, which face-on reads as the thin brass edge of the loader's drawing.
 * A lacquer disc closes the hole underneath. In the change to the hard drive
 * the plate becomes the drive's aluminium chassis.
 */

/** The bevel on every edge, its size and depth alike. */
const BEVEL = 0.01;

/** The hole is a polygon of this many sides; its walls stand clear of the rim's circle. */
const HOLE_SEGMENTS = 192;

/**
 * The hole's radius at the plate's top. ExtrudeGeometry pushes the walls a
 * bevel's width into the hole, and a polygon's sides fall short of its
 * corners by cos(π/n), so the walls' sides end up exactly at DIAL.rim.
 */
export const HOLE_RADIUS = (DIAL.rim + BEVEL) / Math.cos(Math.PI / HOLE_SEGMENTS);

function holePoints(): THREE.Vector2[] {
  return Array.from({ length: HOLE_SEGMENTS }, (_, i) => {
    const a = (i / HOLE_SEGMENTS) * 2 * Math.PI;
    return new THREE.Vector2(HOLE_RADIUS * Math.cos(a), HOLE_RADIUS * Math.sin(a));
  });
}

function plateGeometry(): THREE.BufferGeometry {
  // The caps keep the shape's outline and the walls stand a bevel outside it, so the shape is a bevel smaller all round.
  const half = DIAL.plate / 2 - BEVEL;
  const corner = DIAL.plateCorner - BEVEL;
  const q = Math.PI / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half + corner, -half);
  shape.lineTo(half - corner, -half);
  shape.absarc(half - corner, -half + corner, corner, -q, 0, false);
  shape.lineTo(half, half - corner);
  shape.absarc(half - corner, half - corner, corner, 0, q, false);
  shape.lineTo(-half + corner, half);
  shape.absarc(-half + corner, half - corner, corner, q, 2 * q, false);
  shape.lineTo(-half, -half + corner);
  shape.absarc(-half + corner, -half + corner, corner, 2 * q, 3 * q, false);
  shape.holes.push(new THREE.Path(holePoints()));

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: DIAL.plateDepth - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 8
  });
  // Extruded along +Z from −BEVEL to depth + BEVEL; turned so +Z runs down −Y and the front cap faces up, then lowered so it is at y 0.
  return geometry.rotateX(Math.PI / 2).translate(0, -BEVEL, 0);
}

export interface BasePlate {
  object: THREE.Group;
  /** The lacquer plate with its brass edge. */
  plate: THREE.Mesh;
  /**
   * The drive's chassis: the same plate all in aluminium, drawn over the
   * lacquer one as it fades in (so the plate never shows through to the
   * room), hidden until then.
   */
  chassis: THREE.Mesh;
}

export function buildBasePlate(m: InstrumentMaterials): BasePlate {
  const object = new THREE.Group();
  object.name = 'compass:base';

  // ExtrudeGeometry's groups: 0 the caps, 1 the sides and bevels.
  const geometry = plateGeometry();
  const plate = new THREE.Mesh(geometry, [m.plate, m.brass]);
  plate.name = 'compass:plate';
  const chassis = new THREE.Mesh(geometry, m.aluminium);
  chassis.name = 'compass:chassis';
  chassis.visible = false;

  // The underside of the hole, the same polygon, facing down.
  const back = new THREE.Mesh(
    new THREE.CircleGeometry(HOLE_RADIUS, HOLE_SEGMENTS).rotateX(Math.PI / 2).translate(0, -DIAL.plateDepth, 0),
    m.plate
  );
  back.name = 'compass:plate-back';

  object.add(plate, chassis, back);
  return { object, plate, chassis };
}
