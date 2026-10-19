import * as THREE from 'three';
import { DIAL } from './dialSpec';
import type { InstrumentMaterials } from './materials';

/**
 * The heaven pool at the dial's centre: a lacquer floor DIAL.poolDepth below
 * the face, the portrait disc just above the floor (hidden until a portrait
 * has arrived, then as opaque as the pose's `portrait`), a brass wall round
 * it, and a disc of glass above the face at y 0.03, under the needle.
 */

export const POOL = { glass: 0.03, portraitLift: 0.001, segments: 96 } as const;

export interface Pool {
  object: THREE.Group;
  portrait: THREE.Mesh;
}

/** A disc of radius r facing +Y at height y. */
function disc(r: number, y: number): THREE.BufferGeometry {
  return new THREE.CircleGeometry(r, POOL.segments).rotateX(-Math.PI / 2).translate(0, y, 0);
}

export function buildPool(m: InstrumentMaterials): Pool {
  const object = new THREE.Group();
  object.name = 'compass:pool';
  const floorY = -DIAL.poolDepth;

  const floor = new THREE.Mesh(disc(DIAL.pool, floorY), m.lacquer);
  floor.name = 'compass:pool-floor';

  // Circle UVs put the image's top at the circle's +Y, which the turn lays toward −Z: north, the top of the screen.
  const portrait = new THREE.Mesh(disc(DIAL.pool, floorY + POOL.portraitLift), m.portrait);
  portrait.name = 'compass:portrait';
  portrait.visible = false;

  // The wall's profile runs down, so the lathe faces it inward, toward the pool.
  const wall = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(DIAL.pool, 0), new THREE.Vector2(DIAL.pool, floorY)], POOL.segments),
    m.brass
  );
  wall.name = 'compass:pool-wall';

  const glass = new THREE.Mesh(disc(DIAL.pool, POOL.glass), m.glass);
  glass.name = 'compass:glass';

  object.add(floor, portrait, wall, glass);
  return { object, portrait };
}
