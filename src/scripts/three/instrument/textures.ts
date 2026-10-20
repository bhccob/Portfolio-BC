import * as THREE from 'three';

/**
 * The compass's three image textures, and the portrait in its pool.
 *
 * The images are AI-generated (Higgsfield GPT Image 2.5) and converted to
 * 1024 x 1024 WebP with sharp:
 *   - brass.webp      brushed brass, its grain running across; a 64 px band at
 *                     its left and right edges is cross-faded with the opposite
 *                     edge so it tiles horizontally; from a 2048 x 2048 source
 *                     (quality 80); job fa06677a-74c0-4173-b50a-6c25b76ff3f4
 *   - lacquer.webp    deep purple lacquer; from a 2048 x 2048 source (quality
 *                     80); job 3d2c9ed3-50f4-4a40-8600-12b9cf45bfca
 *   - aluminium.webp  brushed aluminium, anodised purple, its brushing running
 *                     across (milestone 2's device's, kept for the drive's
 *                     chassis); job dd9ba35b-f6cf-4966-b0c9-bbe281e76f51
 *
 * Their mean colours, linear, measured on the WebP files: the materials
 * divide their own colour by these, so a tiled map keeps its grain while its
 * average lands on the material's colour (the aluminium's purple becomes the
 * chassis's neutral metal).
 */
export const TEXTURE_FILES = {
  brass: '/textures/instrument/brass.webp',
  lacquer: '/textures/instrument/lacquer.webp',
  aluminium: '/textures/instrument/aluminium.webp'
} as const;

export const TEXTURE_MEANS = {
  brass: [0.4141, 0.2327, 0.0375],
  lacquer: [0.0147, 0.0051, 0.0305],
  aluminium: [0.0784, 0.0179, 0.152]
} as const;

export interface InstrumentTextures { brass?: THREE.Texture; lacquer?: THREE.Texture; aluminium?: THREE.Texture; portrait?: THREE.Texture }

/**
 * Loads the brass, the lacquer, the aluminium and (when a URL is given) the
 * portrait, all in sRGB. It never rejects: a file that fails to load is simply
 * absent from the result, and its parts keep their plain colours (the pool
 * stays lacquer).
 * `arrived`, when given, is handed each map the moment it loads, for a caller
 * that will not wait for them all (CompassScene). Anisotropy is left to the
 * caller, which has the renderer.
 */
export async function loadInstrumentTextures(
  portraitUrl?: string,
  loader?: THREE.TextureLoader,
  arrived?: (key: keyof InstrumentTextures, texture: THREE.Texture) => void
): Promise<InstrumentTextures> {
  const textures: InstrumentTextures = {};
  const files = Object.entries(TEXTURE_FILES) as [keyof InstrumentTextures, string][];
  if (portraitUrl) files.push(['portrait', portraitUrl]);
  try {
    const textureLoader = loader ?? new THREE.TextureLoader();
    await Promise.all(files.map(async ([key, url]) => {
      try {
        const texture = await textureLoader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures[key] = texture;
        arrived?.(key, texture);
      } catch {
        // a missing or broken file leaves this one texture out
      }
    }));
  } catch {
    // no loader to be had: nothing loads, and nothing throws
  }
  return textures;
}
