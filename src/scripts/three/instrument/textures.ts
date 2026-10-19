import * as THREE from 'three';

/**
 * The compass's two image textures, and the portrait in its pool.
 *
 * The images are AI-generated (Higgsfield GPT Image 2.5) from 2048 x 2048
 * sources and converted to 1024 x 1024 WebP (quality 80) with sharp:
 *   - brass.webp    brushed brass, its grain running across; a 64 px band at
 *                   its left and right edges is cross-faded with the opposite
 *                   edge so it tiles horizontally; job fa06677a-74c0-4173-b50a-6c25b76ff3f4
 *   - lacquer.webp  deep purple lacquer; job 3d2c9ed3-50f4-4a40-8600-12b9cf45bfca
 *
 * Their mean colours, linear, measured on the WebP files: the materials
 * divide their own colour by these, so a tiled map keeps its grain while its
 * average lands on the palette colour.
 */
export const TEXTURE_FILES = {
  brass: '/textures/instrument/brass.webp',
  lacquer: '/textures/instrument/lacquer.webp'
} as const;

export const TEXTURE_MEANS = {
  brass: [0.4141, 0.2327, 0.0375],
  lacquer: [0.0147, 0.0051, 0.0305]
} as const;

export interface InstrumentTextures { brass?: THREE.Texture; lacquer?: THREE.Texture; portrait?: THREE.Texture }

/**
 * Loads the brass, the lacquer and (when a URL is given) the portrait, all in
 * sRGB. It never rejects: a file that fails to load is simply absent from the
 * result, and its parts keep their plain colours (the pool stays lacquer).
 * Anisotropy is left to the caller, which has the renderer.
 */
export async function loadInstrumentTextures(portraitUrl?: string, loader?: THREE.TextureLoader): Promise<InstrumentTextures> {
  const textures: InstrumentTextures = {};
  const files: [keyof InstrumentTextures, string][] = [
    ['brass', TEXTURE_FILES.brass],
    ['lacquer', TEXTURE_FILES.lacquer]
  ];
  if (portraitUrl) files.push(['portrait', portraitUrl]);
  try {
    const textureLoader = loader ?? new THREE.TextureLoader();
    await Promise.all(files.map(async ([key, url]) => {
      try {
        const texture = await textureLoader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures[key] = texture;
      } catch {
        // a missing or broken file leaves this one texture out
      }
    }));
  } catch {
    // no loader to be had: nothing loads, and nothing throws
  }
  return textures;
}
