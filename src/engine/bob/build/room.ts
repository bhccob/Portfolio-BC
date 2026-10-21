/**
 * What the BOB compass's gold and glass, and the glass floor, reflect:
 * milestone 1's dark room of light cards (the `room` of its CompassStudio,
 * since removed), prefiltered through PMREM into the scene's environment, at
 * half its radiance. Metal gold shows nothing but its reflections, so these
 * few cards are what makes it gold, and the dark between them keeps the glass
 * smoked. Ported unchanged from v3's room (Ruling 23), so v3's engine can go.
 * No React: the Studio (src/scene/Studio.tsx) builds it again when the context
 * comes back, as milestone 1's did (the prefiltered copy lives only on the
 * GPU).
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';

/**
 * The room: dark `walls`, and light cards. A card faces the middle from its
 * bearing (`azimuth` degrees from +Z toward +X, the right) and `elevation`
 * (degrees up), `width` x `height` degrees across, glowing `radiance` times
 * its colour, times `radiance` for the whole room. The cards' places and
 * radiances are milestone 1's; their colours are the palette's nearest (the
 * warm soft-box's and the front card's cream, the cool rim's lilac, the back
 * card's violet). `blur` is PMREM's sigma.
 *
 * The camera stands on the +z side looking toward -z, as v3's did, so the
 * back card (behind the compass, 20 degrees up) lays a violet sheen on the
 * glass, and the turned gold catches the soft-box.
 */
export const ROOM_LOOK = {
  walls: palette.ink,
  blur: 0.02,
  radiance: 0.5,
  cards: [
    // A warm soft-box high and to the left: the key's own reflection in the curved gold.
    { azimuth: -40, elevation: 42, width: 34, height: 22, colour: palette.cream, radiance: 2.4 },
    // A soft card a little low in front and to the left.
    { azimuth: -20, elevation: -14, width: 40, height: 10, colour: palette.cream, radiance: 0.8 },
    // A cool card to the right and a violet one behind: the edges' rim light.
    { azimuth: 78, elevation: 12, width: 14, height: 36, colour: palette.lilac, radiance: 1.2 },
    { azimuth: 180, elevation: 20, width: 50, height: 24, colour: palette.violet, radiance: 0.6 }
  ]
} as const;

/** The room's distance to its cards; the walls stand twice as far. */
const RADIUS = 10;

/** The reflections as the scene holds them. */
export interface RoomModel {
  /** The prefiltered room, for `scene.environment`. */
  environment: THREE.Texture;
  /** Frees the prefiltered room. */
  dispose(): void;
}

/** What makes the prefiltered room: three's PMREMGenerator, or a stand-in where there is no WebGL (the tests). */
export type PmremMaker = (renderer: THREE.WebGLRenderer) => Pick<THREE.PMREMGenerator, 'fromScene' | 'dispose'>;

/** The direction a card faces the middle from, unit length. */
function bearing(azimuth: number, elevation: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(azimuth);
  const e = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/**
 * The room as a scene for PMREM: its walls (`room:walls`, a sphere seen from
 * inside) and its cards (`room:card:<k>`), each facing the middle. `dispose`
 * frees it; the prefiltered copy does not need it once made.
 */
export function roomScene(): { scene: THREE.Scene; dispose(): void } {
  const scene = new THREE.Scene();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 2, 32, 16), new THREE.MeshBasicMaterial({ color: ROOM_LOOK.walls, side: THREE.BackSide }));
  shell.name = 'room:walls';
  scene.add(shell);
  const plane = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.Material[] = [shell.material];
  ROOM_LOOK.cards.forEach((card, k) => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(card.colour).multiplyScalar(card.radiance * ROOM_LOOK.radiance),
      side: THREE.DoubleSide
    });
    materials.push(material);
    const mesh = new THREE.Mesh(plane, material);
    mesh.name = `room:card:${k}`;
    mesh.position.copy(bearing(card.azimuth, card.elevation).multiplyScalar(RADIUS));
    mesh.scale.set(2 * RADIUS * Math.tan(THREE.MathUtils.degToRad(card.width / 2)), 2 * RADIUS * Math.tan(THREE.MathUtils.degToRad(card.height / 2)), 1);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  });
  return {
    scene,
    dispose() {
      shell.geometry.dispose();
      plane.dispose();
      for (const material of materials) material.dispose();
    }
  };
}

/**
 * Prefilters the room for `renderer` and frees the room and the generator
 * straight away, as milestone 1 did: only the prefiltered texture is kept.
 * `pmrem` makes the generator; leave it out (the tests hand in a stand-in,
 * having no WebGL).
 */
export function buildRoom(renderer: THREE.WebGLRenderer, pmrem: PmremMaker = (r) => new THREE.PMREMGenerator(r)): RoomModel {
  const generator = pmrem(renderer);
  const room = roomScene();
  const target = generator.fromScene(room.scene, ROOM_LOOK.blur);
  room.dispose();
  generator.dispose();
  return {
    environment: target.texture,
    dispose() {
      target.dispose();
    }
  };
}
