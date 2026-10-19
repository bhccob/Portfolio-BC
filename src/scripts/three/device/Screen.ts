import * as THREE from 'three';
import type { DeviceMaterials } from './materials';
import { panel, plate, type Outline } from './shapes';

/**
 * The screen: a 3.06 × 1.69 slab of dark-tinted glass 0.03 thick with
 * rounded corners and softened edges, and the lit display just under its top
 * face (the display's canvas carries the black ink border printed under the
 * glass).
 */

export const GLASS: Outline = { width: 3.06, depth: 1.69, radius: 0.15 };
export const GLASS_THICKNESS = 0.03;

/** The display sits this far above the glass's underside, inside the slab. */
const DISPLAY_Y = 0.0045;

/** The display's inset from the glass edge (it stops short of the softened edge). */
const DISPLAY_INSET = 0.006;

/** The display's outline. */
export const DISPLAY: Outline = {
  width: GLASS.width - 2 * DISPLAY_INSET,
  depth: GLASS.depth - 2 * DISPLAY_INSET,
  radius: GLASS.radius - DISPLAY_INSET
};

export interface ScreenParts {
  object: THREE.Group;
  display: THREE.Mesh;
}

export function buildScreen(m: DeviceMaterials): ScreenParts {
  const object = new THREE.Group();
  object.name = 'screen';

  const world = { kind: 'world', tile: 1 } as const;
  const glass = new THREE.Mesh(plate(GLASS, GLASS_THICKNESS, 0.008, 0.004, { top: { uv: world }, side: { uv: world }, bottom: { uv: world } }), m.glass);
  glass.name = 'screen:glass';
  glass.renderOrder = 1;

  const display = new THREE.Mesh(panel(DISPLAY), m.display);
  display.position.y = DISPLAY_Y;
  display.name = 'screen:display';

  object.add(display, glass);
  return { object, display };
}
