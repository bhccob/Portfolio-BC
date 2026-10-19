import * as THREE from 'three';
import type { HomeId } from './dialSpec';
import { paintFace } from './face';
import { paintHome, STRIP } from './patterns';

/**
 * Paints the compass's canvases in the browser: the face and its
 * roughness/metalness map (face.ts) and the pattern ring's four strips
 * (patterns.ts), one canvas per animation frame, so the loader's needle keeps
 * turning while they paint. Browser only: it needs `document` and
 * `requestAnimationFrame`.
 *
 * The answers are CanvasTextures: the colour canvases sRGB, the mr canvas
 * linear data. The strips repeat round the ring (their motifs tile at u = 0/1).
 * Anisotropy is the scene's to set, from the renderer's limit.
 */

export interface Painted {
  face: THREE.CanvasTexture;
  mr: THREE.CanvasTexture;
  strips: Record<HomeId, THREE.CanvasTexture>;
}

/** The face's canvas size, for a fine and a coarse pointer. */
export const FACE_SIZE = { fine: 2048, coarse: 1024 } as const;

const HOMES: readonly HomeId[] = ['plain', 'china', 'aruba', 'rotterdam'];

/** How many canvases are painted, one a frame. */
const CANVASES = 2 + HOMES.length;

function context(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas to paint the compass on');
  return ctx;
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function texture(ctx: CanvasRenderingContext2D, name: string, colour: boolean): THREE.CanvasTexture {
  const map = new THREE.CanvasTexture(ctx.canvas);
  // A colour canvas is sRGB; the mr canvas is data, read as it stands.
  map.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.name = name;
  return map;
}

/**
 * Paints the face (2048² on a fine pointer, 1024² on a coarse one, with the
 * lacquer image tiled over it when given) and the strips (STRIP.fine or
 * STRIP.coarse), one canvas per animation frame. `onProgress` hears the share
 * painted (0..1) after each. Throws, having painted nothing more, if the
 * browser gives no 2D canvas.
 */
export async function paintInstrument(fine: boolean, lacquer?: CanvasImageSource, onProgress?: (share: number) => void): Promise<Painted> {
  const size = fine ? FACE_SIZE.fine : FACE_SIZE.coarse;
  const strip = fine ? STRIP.fine : STRIP.coarse;
  // A decoded image draws without a stall of its own.
  await (lacquer as HTMLImageElement | undefined)?.decode?.().catch(() => undefined);

  let painted = 0;
  const done = async (): Promise<void> => {
    painted++;
    onProgress?.(painted / CANVASES);
    if (painted < CANVASES) await frame();
  };

  // paintFace paints the colour and the mr map in one call: each frame hands it one real canvas and a
  // 1 × 1 scratch canvas for the other half, which clips its drawing to nothing (and the mr pass, no image).
  const scratch = context(1, 1);
  const colour = context(size, size);
  paintFace(colour, scratch, size, lacquer);
  await done();
  const mr = context(size, size);
  paintFace(scratch, mr, size);
  await done();

  const strips = {} as Record<HomeId, THREE.CanvasTexture>;
  for (const home of HOMES) {
    const ctx = context(strip.width, strip.height);
    paintHome(ctx, home, strip.width, strip.height);
    const map = texture(ctx, `compass:strip-${home}`, true);
    map.wrapS = THREE.RepeatWrapping;
    strips[home] = map;
    await done();
  }
  return { face: texture(colour, 'compass:face', true), mr: texture(mr, 'compass:face-mr', false), strips };
}
