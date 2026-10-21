/**
 * The case the chip city stands in, under the v3 compass's glass (Task 14b):
 * a dark wall at the rim from just under the board up to the glass, capped by
 * the compass's brass rim, and a dark floor under the board. Without it the
 * home's low camera saw the city's blocks from the side, under the glass's
 * edge, as a floating island hanging below the disc (frame 04 has the city
 * under the glass, never below it). Every block of Task 8's layout stands
 * inside the wall and under the glass, so a block is only ever seen through
 * the glass. No React: the Opening mounts it with the city and raises it as
 * the city rises.
 */
import * as THREE from 'three';
import { DIAL } from '~/engine/instrument/dialSpec';
import { palette } from '~/engine/palette';
import { CITY } from '~/engine/v3/chipCity';
import { CHIP } from '~/engine/v3/chipSpec';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';

/** The outermost glass ring, the one whose edge meets the wall. */
const OUTER = GLASS_RINGS[GLASS_RINGS.length - 1];

/** The outer ring's top face. */
const OUTER_TOP = OUTER.y + OUTER.thickness / 2;

/**
 * How the case looks and where it stands, world units in the dial's frame.
 *
 * - `floor`: the board under the city, `drop` under the board plane (so the
 *   traces and the blocks' feet never fight it for a pixel), out to the wall:
 *   the deepest board purple, matte.
 * - `wall`: from `inner` (a hair outside the glass's outer edge, which would
 *   otherwise share the wall's face and flicker against it) out to the rim,
 *   and from under the floor up to the lip: dark lacquer that the room's
 *   cards give a faint sheen, so its curve reads against the night. It faces
 *   both ways: seen from inside, through the glass, it is a wall and not a
 *   hole.
 * - `lip`: the compass's brass rim on the wall's top, `lift` over the outer
 *   ring's glass, from just inside the glass's edge (it closes the seam) out to
 *   the rim; metal brass with a little light of its own, as the gold
 *   engraving has, so the compass's outline reads in the dark.
 * - `segments`: steps round, as the glass rings have.
 */
export const CASE_LOOK = {
  floor: { colour: palette.ink, roughness: 1, metalness: 0, drop: 0.002 },
  wall: { colour: palette.boardDeep, inner: OUTER.outer + 0.002, roughness: 0.38, metalness: 0.2 },
  lip: { colour: palette.brass, from: OUTER.outer - 0.004, lift: 0.0015, metalness: 1, roughness: 0.45, emissive: 0.06 },
  segments: 256
} as const;

/** The case as the scene holds it. */
export interface CaseModel {
  /** `case`: the floor (`case:floor`), and the wall (`case:wall`) with its lip (`case:lip`), in the dial's frame. */
  group: THREE.Group;
  /**
   * How far the case has risen with the city, 0..1 (NaN reads as 0): 0 draws
   * nothing; between, the wall and its lip stand that share of their height
   * up from the floor, as the city's blocks do; 1 is the case as built.
   */
  setRise(t: number): void;
  /**
   * The brass rim's light, 0..1 (NaN reads as 0), with the glass's forming:
   * 0 is the rim as dark as the wall (the city has risen in its case, but the
   * compass has not formed yet), 1 its brass as built. Colours only, so a
   * frame of the fade compiles nothing.
   */
  setRim(t: number): void;
  /** Frees every geometry and material the case made. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * Builds the case risen (`setRise(1)`). The floor's top is at the board less
 * `drop`; the wall stands from there up to the outer ring's top, and the lip
 * lies on it, `lift` higher. The wall and the lip hang from a pivot on the
 * floor, so a rise scales them up from it.
 */
export function buildCase(): CaseModel {
  const look = CASE_LOOK;
  const group = new THREE.Group();
  group.name = 'case';

  const floorY = CHIP.board - look.floor.drop;
  const top = OUTER_TOP + look.lip.lift;

  const floorGeometry = new THREE.CircleGeometry(look.wall.inner, look.segments);
  // CircleGeometry faces +Z; laid flat it faces up.
  floorGeometry.rotateX(-Math.PI / 2);
  floorGeometry.translate(0, floorY, 0);
  const floorMaterial = new THREE.MeshStandardMaterial({
    name: 'case:floor',
    color: look.floor.colour,
    roughness: look.floor.roughness,
    metalness: look.floor.metalness
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.name = 'case:floor';

  // The wall and its lip in the pivot's frame, y = 0 on the floor.
  const pivot = new THREE.Group();
  pivot.name = 'case:pivot';
  pivot.position.y = floorY;
  const height = top - floorY;
  // Down the inner face, across the foot, up the outer face; each corner twice, so the faces keep their own normals.
  const profile = [
    new THREE.Vector2(look.wall.inner, height),
    new THREE.Vector2(look.wall.inner, 0),
    new THREE.Vector2(look.wall.inner, 0),
    new THREE.Vector2(DIAL.rim, 0),
    new THREE.Vector2(DIAL.rim, 0),
    new THREE.Vector2(DIAL.rim, height)
  ];
  const wallGeometry = new THREE.LatheGeometry(profile, look.segments);
  wallGeometry.normalizeNormals();
  const wallMaterial = new THREE.MeshStandardMaterial({
    name: 'case:wall',
    color: look.wall.colour,
    roughness: look.wall.roughness,
    metalness: look.wall.metalness,
    side: THREE.DoubleSide
  });
  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.name = 'case:wall';

  const lipGeometry = new THREE.RingGeometry(look.lip.from, DIAL.rim, look.segments, 1);
  lipGeometry.rotateX(-Math.PI / 2);
  lipGeometry.translate(0, height, 0);
  const lipMaterial = new THREE.MeshStandardMaterial({
    name: 'case:lip',
    color: look.lip.colour,
    metalness: look.lip.metalness,
    roughness: look.lip.roughness,
    emissive: look.lip.colour,
    emissiveIntensity: look.lip.emissive
  });
  const lip = new THREE.Mesh(lipGeometry, lipMaterial);
  lip.name = 'case:lip';

  pivot.add(wall, lip);
  group.add(floor, pivot);

  // The rim's two ends, unformed (the wall's own dark) and formed (brass), for setRim to mix between.
  const dark = new THREE.Color(look.wall.colour);
  const brass = new THREE.Color(look.lip.colour);

  return {
    group,
    setRise(t) {
      const rise = clamp01(t);
      group.visible = rise > 0;
      // Never quite flat: a zero scale would leave the wall's normal matrix singular.
      pivot.scale.y = Math.max(rise, 1e-4);
    },
    setRim(t) {
      const formed = clamp01(t);
      lipMaterial.color.lerpColors(dark, brass, formed);
      lipMaterial.emissiveIntensity = look.lip.emissive * formed;
    },
    dispose() {
      floorGeometry.dispose();
      floorMaterial.dispose();
      wallGeometry.dispose();
      wallMaterial.dispose();
      lipGeometry.dispose();
      lipMaterial.dispose();
    }
  };
}
