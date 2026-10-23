import * as THREE from 'three';
import { useScene } from '~/state/store';

/**
 * The renderer as the warm-up sees it (v3's pattern). While the post chain is on, the composer's render pass draws the
 * scene into a half-float target, and three builds a different program for that (linear output, no tone mapping) than
 * for the screen; the warm-up compiles against such a target then, so the programs it readies are the ones the first
 * frame uses. `dispose` frees the target.
 */
function warmingRenderer(gl: THREE.WebGLRenderer, composer: boolean): { renderer: THREE.WebGLRenderer; dispose(): void } {
  if (!composer) return { renderer: gl, dispose: () => {} };
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const renderer = Object.create(gl) as THREE.WebGLRenderer;
  renderer.compileAsync = (scene, camera, targetScene) => {
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    try {
      // compile() reads the render target synchronously, before the returned promise settles.
      return gl.compileAsync(scene, camera, targetScene);
    } finally {
      gl.setRenderTarget(previous);
    }
  };
  return { renderer, dispose: () => target.dispose() };
}

/**
 * Uploads textures to the GPU now (`initTexture`), not on the frame that first draws them: the Opening's band strips
 * once the compass is built, the Void's screens and vein maps before the beads come in. The scene's one call of
 * `initTexture`: the proof harness's `load-throw` step makes it throw in the built Stage chunk, where it must be there
 * exactly once, and the Opening's load is the first to call it.
 */
export function uploadTextures(gl: THREE.WebGLRenderer, textures: Iterable<THREE.Texture>): void {
  for (const texture of textures) gl.initTexture(texture);
}

/**
 * Compiles every program of `objects` for the frames to come; a failure only costs the first frame a stall, so it is
 * logged. Three compiles the materials of hidden objects too (the compass, hidden under the shut cap), and takes the
 * lights the visible ones are lit by. With `into`, the scene `objects` are about to join (src/scene/bob/Void.tsx: the
 * void and the beads, built beside the scene), they are compiled as `into` would draw them: with its fog, its
 * environment and its lights, and their own visible ones beside.
 */
export async function warm(gl: THREE.WebGLRenderer, objects: THREE.Object3D, camera: THREE.Camera, what: string, into: THREE.Scene | null = null): Promise<void> {
  const warming = warmingRenderer(gl, useScene.getState().tier !== 'low');
  try {
    await warming.renderer.compileAsync(objects, camera, into);
  } catch (error) {
    console.warn(`[needle] ${what} could not be warmed up; the first frame may stall`, error);
  } finally {
    warming.dispose();
  }
}
