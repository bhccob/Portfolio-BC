/**
 * The loader's glass as three.js objects: the vast slab of near-black glass
 * with its round opening, the cap that closes the opening like an iris, the
 * short tunnel below that glows warm, and the gold lip round the edge. The
 * measurements are the wordmark's (`WORDMARK.hole`, ~/engine/bob/wordmark) and
 * the Blender preview's (tools/blender/bob_build.py: the floor, `bob_cap`, the
 * well and `bob_lip`). No React: the Opening (Task 10) mounts the group and
 * poses it from the loader's clock through the setters.
 *
 * Lengths are world units; the glass is the plane y = 0 and the tunnel lies
 * below it. On the high tier a mirror sits just under the glass and the glass
 * lets a little of it through, so the floor reflects the compass and the
 * smoke; the other tiers draw the glass alone.
 */
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { palette } from '~/engine/palette';
import type { QualityTier } from '~/engine/quality';
import { WORDMARK } from '~/engine/bob/wordmark';

/**
 * How the glass looks. The numbers are first values: a later task tunes them
 * under the luminance gate.
 *
 * - `segments`: the sides of every round edge (the hole, the cap, the well, the
 *   lip), the same for all so they meet without a gap.
 * - `floor`: the glass is the palette's night, rough to `roughness` where it
 *   is clean, under a clear coat of `clearcoatRoughness`; a ring from the hole
 *   out to `outer`, `thickness` deep under y = 0.
 * - `scratch`: fine streaks of rougher glass, all running one way, `angle`
 *   degrees from the floor's x. The map is `size` pixels square, tiled `repeat`
 *   times over the floor and read at `anisotropy` (as v3's glass does), and a
 *   streak is up to `contrast` times as rough as clean glass (see
 *   `scratchData`).
 * - `reflection`: on the high tier, a mirror of `resolution` of the drawing
 *   buffer (half), `depth` under the glass top so the two do not z-fight, with
 *   the floor on top of it at `opacity`, so the reflection shows through the
 *   rest. `tint` is the mirror's colour (the reflector's own blend), `size`
 *   the render target it has before a renderer tells it better, and
 *   `multisample` its MSAA samples: none, since the mirror shows only 15 % of
 *   itself at half resolution, and 4 samples on a half-float target would cost
 *   about 50 MB of video memory at a pixel ratio of 2.
 * - `well`: an open cylinder `depth` tall standing on `bottom`, so its top is
 *   just under the floor (-0.08), seen from inside. Its wall glows `emissive` at the foot, falling as (1 - v)^3 up the
 *   wall (v is 0 at the foot, 1 at the top). Its warm point `light` stands at
 *   `y`.
 * - `lip`: a gold ring of `tube` radius round the hole, a little outside it,
 *   at `y`.
 */
export const GLASS_LOOK = {
  segments: 256,
  floor: { colour: palette.night, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.025, outer: 60, thickness: 0.08 },
  scratch: { size: 512, angle: 28, contrast: 4, repeat: 20, seed: 2006, anisotropy: 4 },
  reflection: { resolution: 0.5, opacity: 0.85, depth: 0.003, tint: 0x7f7f7f, size: [960, 540], multisample: 0 },
  well: {
    bottom: -1.2,
    depth: 1.12,
    emissive: 1.1,
    colour: palette.amber,
    wall: palette.ink,
    light: { y: -0.9, colour: palette.amber, intensity: 4, distance: 0, decay: 2 }
  },
  lip: { radius: WORDMARK.hole + 0.012, tube: 0.02, y: -0.004, colour: palette.brass, emissive: palette.gold, emissiveIntensity: 0.5 }
} as const;

/**
 * The draw order of the floor, its edge and the cap. On the high tier they are
 * transparent (opacity 0.85), and three sorts transparent objects by the
 * distance of their origin, which for a ring 120 wide says nothing: the floor
 * could draw after the compass's glass or the smoke and paint 85 % over them.
 * -5 puts it after the sky (-10) and before the laser (1) and the mist (2),
 * following v3's `*_RENDER_ORDER` convention. It is set on every tier, where
 * it changes nothing because the glass is opaque.
 */
export const GLASS_RENDER_ORDER = -5;

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** A hash of a lattice point and a seed to [0, 1): whole-number arithmetic only, so the same everywhere. */
function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise on a lattice of `cols` by `rows` that wraps, so the map tiles. `u` and `v` run over [0, 1). */
function noise(cols: number, rows: number, seed: number, u: number, v: number): number {
  const x = u * cols;
  const y = v * rows;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (a: number, b: number): number => hash(((a % cols) + cols) % cols, ((b % rows) + rows) % rows, seed);
  const top = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
  const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
  return top + (bottom - top) * sy;
}

/** The scratch map's texels, made once: the map is seeded, so every build would make the same ones. */
let scratchTexels: Uint8Array | undefined;

/**
 * The scratch roughness map's texels, made on the CPU so no canvas is needed
 * and kept for every later build (generating them takes tens of milliseconds
 * here and more on a phone, in the loader). It is square, and its green channel
 * (the one three reads) holds the glass's roughness as a share of the peak, the
 * roughest it gets (`floor.roughness` times `scratch.contrast`). Clean glass
 * is `floor.roughness` with a slow swell to a little more; a scratch is a thin
 * band of the noise stretched along the x axis (a lattice of a few long cells
 * across many thin ones), thresholded to the rare high values and added on top.
 * The streaks' angle is the texture's own rotation, so the lattice still
 * tiles. The same seed makes the same map. Callers must not write to it.
 */
function scratchData(): Uint8Array {
  if (scratchTexels) return scratchTexels;
  const { size, seed, contrast } = GLASS_LOOK.scratch;
  const clean = GLASS_LOOK.floor.roughness;
  const peak = clean * contrast;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const swell = noise(8, 8, seed + 1, u, v);
      const band = noise(6, 100, seed, u, v);
      const streak = Math.min(1, Math.max(0, (band - 0.7) / 0.08));
      const roughness = clean + 0.05 * swell + (peak - clean - 0.05) * streak;
      const texel = Math.round(255 * Math.min(1, roughness / peak));
      const at = (y * size + x) * 4;
      data[at] = texel;
      data[at + 1] = texel;
      data[at + 2] = texel;
      data[at + 3] = 255;
    }
  }
  scratchTexels = data;
  return data;
}

/**
 * A texture over the shared scratch texels. Each build gets its own, so
 * freeing one build's glass frees its upload and leaves another build's alone;
 * the texels are not copied and not freed.
 */
function scratchTexture(): THREE.DataTexture {
  const { size, angle, repeat, anisotropy } = GLASS_LOOK.scratch;
  const texture = new THREE.DataTexture(scratchData(), size, size, THREE.RGBAFormat);
  texture.name = 'glass:scratch';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.repeat.set(repeat, repeat);
  texture.rotation = (angle * Math.PI) / 180;
  texture.needsUpdate = true;
  return texture;
}

/** A number as a GLSL float literal: always with a decimal point. */
function glsl(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/**
 * The well's wall glows at the foot and fades up it. A wall point's `v` is its
 * height over the foot as a share of the well's depth, read off the position,
 * and the emissive light is scaled by (1 - v)^3 after three has set it. Both
 * stages declare the varying once.
 */
function patchWell(shader: { vertexShader: string; fragmentShader: string }): void {
  const { bottom, depth } = GLASS_LOOK.well;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vWellV;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n\tvWellV = clamp((position.y - ${glsl(bottom)}) / ${glsl(depth)}, 0.0, 1.0);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vWellV;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= pow(1.0 - vWellV, 3.0);');
}

/** The glass as the scene holds it. */
export interface GlassModel {
  /** `glass-floor`: the floor (`floor`, `floor:edge`, and `floor:reflector` on the high tier), the `cap`, the `well` with its `well:light`, and the `lip`. */
  group: THREE.Group;
  /** Opens the iris: the cap is scaled to 1 - `open` (held to 0..1; NaN reads as 0) and hidden at 1. */
  setIris(open: number): void;
  /** Lights the tunnel, 0..1: the wall's glow and the warm light below it. It starts at 0, dark. */
  setGlow(level: number): void;
  /**
   * Sizes the reflection to `GLASS_LOOK.reflection.resolution` of the
   * renderer's drawing buffer (call it again after a resize). Nothing happens
   * on a tier without a reflector. The reflector itself is built with the
   * glass, so nothing needs a renderer at build time.
   */
  setRenderer(renderer: Pick<THREE.WebGLRenderer, 'getDrawingBufferSize'>): void;
  /** Frees every geometry, material, texture and render target the glass made. */
  dispose(): void;
}

/**
 * Builds the glass for `tier`, the opening shut (the cap whole) and the tunnel
 * dark. Only the `high` tier gets a reflector.
 */
export function buildGlass(tier: QualityTier): GlassModel {
  const look = GLASS_LOOK;
  const hole = WORDMARK.hole;
  const group = new THREE.Group();
  group.name = 'glass-floor';

  // The floor's ring and the cap, flat on y = 0 and facing up. Both are mapped
  // by their place on the floor, so the cap's streaks carry on the floor's.
  const ring = new THREE.RingGeometry(hole, look.floor.outer, look.segments, 1);
  ring.rotateX(-Math.PI / 2);
  const cap = new THREE.CircleGeometry(hole, look.segments);
  const capUv = cap.getAttribute('uv');
  const capPosition = cap.getAttribute('position');
  for (let i = 0; i < capUv.count; i++) {
    capUv.setXY(i, (capPosition.getX(i) / look.floor.outer + 1) / 2, (capPosition.getY(i) / look.floor.outer + 1) / 2);
  }
  cap.rotateX(-Math.PI / 2);

  const reflected = tier === 'high';
  const peak = look.floor.roughness * look.scratch.contrast;
  const scratch = scratchTexture();
  // The map is the roughness as a share of its peak, so the material holds the peak and the map brings it down to the clean glass.
  const glass = new THREE.MeshPhysicalMaterial({
    name: 'glass:floor',
    color: look.floor.colour,
    metalness: 0,
    roughness: peak,
    roughnessMap: scratch,
    clearcoat: look.floor.clearcoat,
    clearcoatRoughness: look.floor.clearcoatRoughness * look.scratch.contrast,
    clearcoatRoughnessMap: scratch,
    transparent: reflected,
    opacity: reflected ? look.reflection.opacity : 1
  });

  const floor = new THREE.Mesh(ring, glass);
  floor.name = 'floor';
  floor.renderOrder = GLASS_RENDER_ORDER;

  // The thickness: a wall round the hole, 0.08 deep, seen from inside the opening.
  const wallGeometry = new THREE.CylinderGeometry(hole, hole, look.floor.thickness, look.segments, 1, true);
  wallGeometry.translate(0, -look.floor.thickness / 2, 0);
  const wallMaterial = glass.clone();
  wallMaterial.name = 'glass:edge';
  wallMaterial.side = THREE.BackSide;
  const edge = new THREE.Mesh(wallGeometry, wallMaterial);
  edge.name = 'floor:edge';
  edge.renderOrder = GLASS_RENDER_ORDER;

  const capMesh = new THREE.Mesh(cap, glass);
  capMesh.name = 'cap';
  capMesh.renderOrder = GLASS_RENDER_ORDER;

  const wellGeometry = new THREE.CylinderGeometry(hole, hole, look.well.depth, look.segments, 1, true);
  wellGeometry.translate(0, look.well.bottom + look.well.depth / 2, 0);
  const wellMaterial = new THREE.MeshStandardMaterial({
    name: 'glass:well',
    color: look.well.wall,
    roughness: 0.5,
    metalness: 0,
    emissive: look.well.colour,
    emissiveIntensity: 0,
    side: THREE.BackSide
  });
  wellMaterial.onBeforeCompile = patchWell;
  wellMaterial.customProgramCacheKey = () => 'bob-well';
  const well = new THREE.Mesh(wellGeometry, wellMaterial);
  well.name = 'well';

  // Lying flat: the torus is born in the xy plane.
  const lipGeometry = new THREE.TorusGeometry(look.lip.radius, look.lip.tube, 12, look.segments);
  lipGeometry.rotateX(Math.PI / 2);
  const lipMaterial = new THREE.MeshStandardMaterial({
    name: 'glass:lip',
    color: look.lip.colour,
    metalness: 0.9,
    roughness: 0.25,
    emissive: look.lip.emissive,
    emissiveIntensity: look.lip.emissiveIntensity
  });
  const lip = new THREE.Mesh(lipGeometry, lipMaterial);
  lip.name = 'lip';
  lip.position.y = look.lip.y;

  // Kept in the scene at every glow, at intensity 0: a light that came and went would change the lit materials' programs.
  const light = new THREE.PointLight(look.well.light.colour, 0, look.well.light.distance, look.well.light.decay);
  light.name = 'well:light';
  light.position.y = look.well.light.y;

  group.add(floor, edge);
  let reflector: Reflector | undefined;
  let mirror: THREE.RingGeometry | undefined;
  if (reflected) {
    // The floor's ring again, with the opening in it, but turned by the mesh and not baked flat: a reflector's normal is its own +z.
    mirror = new THREE.RingGeometry(hole, look.floor.outer, look.segments, 1);
    reflector = new Reflector(mirror, {
      textureWidth: look.reflection.size[0],
      textureHeight: look.reflection.size[1],
      color: look.reflection.tint,
      multisample: look.reflection.multisample
    });
    reflector.name = 'floor:reflector';
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -look.reflection.depth;
    group.add(reflector);
  }
  group.add(capMesh, well, lip, light);

  return {
    group,
    setIris(open) {
      const o = clamp01(open);
      capMesh.scale.setScalar(1 - o);
      capMesh.visible = o < 1;
    },
    setGlow(level) {
      const g = clamp01(level);
      wellMaterial.emissiveIntensity = look.well.emissive * g;
      light.intensity = look.well.light.intensity * g;
    },
    setRenderer(renderer) {
      if (!reflector) return;
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      reflector.getRenderTarget().setSize(Math.max(1, Math.round(size.x * look.reflection.resolution)), Math.max(1, Math.round(size.y * look.reflection.resolution)));
    },
    dispose() {
      // The reflector frees its own render target and material, not the ring it was given.
      for (const geometry of [ring, mirror, wallGeometry, cap, wellGeometry, lipGeometry]) geometry?.dispose();
      for (const material of [glass, wallMaterial, wellMaterial, lipMaterial]) material.dispose();
      scratch.dispose();
      reflector?.dispose();
      light.dispose();
    }
  };
}
