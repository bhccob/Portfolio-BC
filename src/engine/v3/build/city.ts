/**
 * The chip city under the v3 compass as one three.js object: a box for every
 * block of Task 8's layout (cityLayout), standing on the board round the chip
 * and glowing amber or violet through the glass, "like a city at night seen
 * through water" (spec §2.2). It is a hint of light below, not a light show:
 * every block is dim, and `setGlow` only ever takes the whole city down from
 * there. One instanced mesh, so the city is a single draw call. No React:
 * Task 12a mounts it and Task 14's luminance gate sets its level.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import type { Block } from '~/engine/v3/chipCity';
import { CHIP } from '~/engine/v3/chipSpec';

/**
 * How the city looks.
 *
 * - `body`: a block's own surface, the palette's near-black, matte; the
 *   scene's lights barely find it, so its glow is what shows.
 * - `hues`: the colour of a block's light, by its `hue`: the chip's gold, or
 *   the nebula's violet.
 * - `emissive`: what a block at glow 1 emits, as a multiple of its hue,
 *   before the city's level; gold at 0.6 has a luminance of about 0.25, well
 *   under the bloom's threshold of 1, and the glass over it dims it further.
 * - `side`: a block's walls glow at this share of its roof, so the roofs read
 *   as the lit tops of a city and the walls as its streets' dark. The home's
 *   low camera sees mostly walls: brighter, they read as a field of grey
 *   crates under the rim.
 */
export const CITY_LOOK = {
  body: { colour: palette.ink, roughness: 0.7, metalness: 0.1 },
  hues: { amber: palette.gold, violet: palette.violet },
  emissive: 0.6,
  side: 0.15
} as const;

/** The city as the scene holds it. */
export interface CityModel {
  /** `city`: one box per block, in the dial's frame, on the board plane (y = CHIP.board). */
  mesh: THREE.InstancedMesh;
  /**
   * The whole city's light, 0..1 (NaN reads as 0), over each block's own:
   * 1 is the blocks as laid out, lower dims them all. A uniform, so a frame
   * that changes it uploads nothing else.
   */
  setGlow(level: number): void;
  /** Frees the box, its material and the instance buffers. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * A block's light goes in its instance colour, which this patch moves from
 * the diffuse colour (where three puts it) to the emitted light, scaled by the
 * city's level and, on the walls, by `uCitySide` (`vCityRoof` is 1 on a roof
 * and 0 on a wall, from the box's own normal, which an instance's scale and
 * move leave pointing the same way). The body stays near-black. A city of no
 * blocks has no instance colours, and the patch then adds nothing.
 */
function cityGlow(uniforms: { uCityGlow: THREE.IUniform<number>; uCitySide: THREE.IUniform<number> }) {
  return (shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): void => {
    shader.uniforms.uCityGlow = uniforms.uCityGlow;
    shader.uniforms.uCitySide = uniforms.uCitySide;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCityRoof;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvCityRoof = max( normal.y, 0.0 );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCityGlow;\nuniform float uCitySide;\nvarying float vCityRoof;')
      .replace('#include <color_fragment>', '')
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          '#ifdef USE_INSTANCING_COLOR',
          '\ttotalEmissiveRadiance += vColor.rgb * uCityGlow * mix( uCitySide, 1.0, vCityRoof );',
          '#endif'
        ].join('\n')
      );
  };
}

/**
 * Builds the city at its full level (`setGlow(1)`): block `i` is instance
 * `i`, a unit box scaled to the block's footprint and height and moved onto
 * the board at its place, its colour its hue times its glow times
 * `CITY_LOOK.emissive`.
 */
export function buildCity(blocks: readonly Block[]): CityModel {
  // A unit box with its base at y = 0, so an instance's scale is its block's size and its move puts the base on the board.
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const uniforms = { uCityGlow: { value: 1 }, uCitySide: { value: CITY_LOOK.side } };
  const material = new THREE.MeshStandardMaterial({
    name: 'city',
    color: CITY_LOOK.body.colour,
    roughness: CITY_LOOK.body.roughness,
    metalness: CITY_LOOK.body.metalness
  });
  material.onBeforeCompile = cityGlow(uniforms);
  material.customProgramCacheKey = () => 'city';

  const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
  mesh.name = 'city';
  const matrix = new THREE.Matrix4();
  const place = new THREE.Vector3();
  const size = new THREE.Vector3();
  const upright = new THREE.Quaternion();
  const hues = { amber: new THREE.Color(CITY_LOOK.hues.amber), violet: new THREE.Color(CITY_LOOK.hues.violet) };
  const light = new THREE.Color();
  blocks.forEach((block, i) => {
    matrix.compose(place.set(block.x, CHIP.board, block.z), upright, size.set(block.w, block.h, block.d));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, light.copy(hues[block.hue]).multiplyScalar(block.glow * CITY_LOOK.emissive));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return {
    mesh,
    setGlow(level) {
      uniforms.uCityGlow.value = clamp01(level);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    }
  };
}
