import * as THREE from 'three';

/**
 * The realistic device's three image textures and where, on the board
 * texture, each chip belongs.
 *
 * The images are AI-generated (Higgsfield GPT Image 2.5) and converted to
 * WebP with sharp:
 *   - pcb.webp       2048 px wide, from the 2688 x 1520 source; job 2bc26e00-3756-4a32-baa3-9f100f91fe37
 *   - battery.webp   1536 px wide; job f2c420c9-8f07-488c-9de3-43da60e6e0e9
 *   - aluminium.webp 1024 x 1024; job dd9ba35b-f6cf-4966-b0c9-bbe281e76f51
 *
 * The board is printed with empty chip footprints; the 3D chips are laid on
 * those footprints, so they have to agree with the picture to a few pixels.
 * That is what FOOTPRINTS is.
 */

export type FootprintId = 'funcial' | 'jontai-energy' | 'cookies-clicker' | 'bc-2006' | 'next' | 'connector';

/** A rectangle in the board texture's UV space (0..1, origin top-left as in the image). */
export interface UvRect { u0: number; v0: number; u1: number; v1: number }

export const TEXTURE_FILES = {
  pcb: '/textures/device/pcb.webp',
  battery: '/textures/device/battery.webp',
  aluminium: '/textures/device/aluminium.webp'
} as const;

/**
 * Each footprint to the outer edge of its gold pad ring, measured on the
 * full-size source (2688 x 1520 px, so u = x / 2688 and v = y / 1520), found
 * by scanning for the gold pads and checked by drawing the rectangles back
 * over the image. Good to about 2 px; the numbers are the source's pixels,
 * left, top, right, bottom:
 *   U2 funcial          376  206   642   473   (top of the left column)
 *   U3 jontai-energy    376  553   642   820
 *   U4 cookies-clicker  376  908   642  1174   (bottom of the left column)
 *   U1 bc-2006         1062  395  1624   958   (the large centre one)
 *   U5 next            1979  501  2319   837   (right)
 *   J1 connector        902 1321  1786  1470   (the flex connector at the bottom
 *                                              edge: its pads and the two
 *                                              retaining tabs, not the silkscreen outline)
 */
export const FOOTPRINTS: Readonly<Record<FootprintId, UvRect>> = {
  funcial: { u0: 0.1399, v0: 0.1355, u1: 0.2388, v1: 0.3112 },
  'jontai-energy': { u0: 0.1399, v0: 0.3638, u1: 0.2388, v1: 0.5395 },
  'cookies-clicker': { u0: 0.1399, v0: 0.5974, u1: 0.2388, v1: 0.7724 },
  'bc-2006': { u0: 0.3951, v0: 0.2599, u1: 0.6042, v1: 0.6303 },
  next: { u0: 0.7362, v0: 0.3296, u1: 0.8627, v1: 0.5507 },
  connector: { u0: 0.3356, v0: 0.8691, u1: 0.6644, v1: 0.9671 }
};

export interface DeviceTextures { pcb?: THREE.Texture; battery?: THREE.Texture; aluminium?: THREE.Texture }

/**
 * Loads the three textures, in sRGB. It never rejects: a file that fails to
 * load is simply absent from the result, and the device falls back to its
 * plain materials. Anisotropy is left to the caller, which has the renderer.
 */
export async function loadDeviceTextures(loader?: THREE.TextureLoader): Promise<DeviceTextures> {
  const textures: DeviceTextures = {};
  try {
    const textureLoader = loader ?? new THREE.TextureLoader();
    await Promise.all((Object.keys(TEXTURE_FILES) as (keyof typeof TEXTURE_FILES)[]).map(async (key) => {
      try {
        const texture = await textureLoader.loadAsync(TEXTURE_FILES[key]);
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
