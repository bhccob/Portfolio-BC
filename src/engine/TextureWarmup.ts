import * as THREE from 'three';
import { createMaterials, createPlaceholders } from './instrument/materials';

/**
 * Readies textures and programs before a frame needs them, so an integrated
 * GPU never stalls a visible frame (or the loader's needle) on them:
 *   - each texture is decoded off the main thread where it is an image, then
 *     uploaded (`initTexture`) in a task of its own;
 *   - each stand-in material is put on a tiny mesh and the lot compiled
 *     against `scene` (its lights, fog and environment) with `compileAsync`,
 *     which resolves once the programs are linked (in parallel where the
 *     browser has KHR_parallel_shader_compile).
 *
 * A material the scene later switches to the stand-ins' exact settings (the
 * lacquer with its clearcoat off, say) then finds its program in the cache,
 * provided a stand-in still holds it: the answer is the stand-ins' release,
 * to be called once the scene's own materials have drawn with them. The
 * release frees the stand-ins (the materials handed in) and the mesh they sat
 * on; the textures stay the caller's. A warm-up that fails or is cancelled lets
 * its stand-ins go itself (the release then does nothing): it costs only the
 * stall it was meant to save, is logged, and never rejects.
 */
export async function warmUp(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  textures: THREE.Texture[],
  materials: THREE.Material[],
  /** Asked between steps; true stops the warm-up early (the scene was disposed). */
  cancelled: () => boolean = () => false
): Promise<() => void> {
  const geometry = new THREE.PlaneGeometry(0.01, 0.01);
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    geometry.dispose();
    for (const material of materials) material.dispose();
  };
  let held = false;
  try {
    for (const texture of textures) {
      await (texture.image as HTMLImageElement | undefined)?.decode?.().catch(() => undefined);
      if (cancelled()) return release;
      renderer.initTexture(texture);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (cancelled() || materials.length === 0) return release;
    const group = new THREE.Group();
    for (const material of materials) group.add(new THREE.Mesh(geometry, material));
    await renderer.compileAsync(group, camera, scene);
    held = true;
  } catch (error) {
    // Nothing is lost but the head start.
    console.warn('[portfolio] the compass warm-up failed; the first frames may stall', error);
  } finally {
    // Stand-ins that compiled nothing, or that nobody will take over, go now.
    if (!held) release();
  }
  return release;
}

/**
 * The lacquers and the pattern ring as the compass makes them, with their
 * clearcoat off: the programs the quality ladder's step to no clearcoat
 * needs. Only their programs matter, so they sit on the model's placeholders.
 */
export function coatlessStandIns(): THREE.Material[] {
  const placeholders = createPlaceholders();
  const { materials } = createMaterials(placeholders);
  const coated = [materials.lacquer, materials.plate, materials.pattern];
  for (const material of coated) material.clearcoat = 0;
  // The rest are never compiled, and a texture never uploaded holds nothing on the GPU: both go now.
  const kept = new Set<THREE.Material>(coated);
  for (const material of Object.values(materials)) if (!kept.has(material)) material.dispose();
  Object.values(placeholders).forEach((texture) => texture.dispose());
  return coated;
}

/**
 * The compass's warm-up: every map uploaded with, while `coated` (the lacquer
 * still has its clearcoat), the clearcoat-off stand-ins compiled (warmUp), side
 * by side with the scene's own programs (`compileAsync`). `progress` hears 0.5
 * and then 1 as the two finish. Resolves with the stand-ins' release; a
 * failed compile is logged, and only making the stand-ins can reject.
 */
export async function warmScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  maps: THREE.Texture[],
  coated: boolean,
  cancelled: () => boolean,
  progress: (share: number) => void = () => {}
): Promise<() => void> {
  let parts = 0;
  const done = (): void => {
    try {
      progress(++parts / 2);
    } catch (error) {
      console.error('[portfolio] a compass warm-up listener failed', error);
    }
  };
  const standIns = coated ? coatlessStandIns() : [];
  // In an async function of its own, so a compile that throws at once is caught like one that rejects.
  const compiled = (async (): Promise<void> => {
    try {
      await renderer.compileAsync(scene, camera);
    } catch (error) {
      console.warn('[portfolio] the compass programs could not be compiled ahead; the first frame may stall', error);
    }
    done();
  })();
  const release = await warmUp(renderer, scene, camera, maps, standIns, cancelled);
  done();
  await compiled;
  return release;
}
