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

/** What the painting takes beyond the pointer and the image. */
export interface PaintOptions {
  /** Hears the share painted (0..1) after each canvas. */
  progress?: (share: number) => void;
  /** Asked before each canvas: true stops the painting (the scene was disposed). */
  cancelled?: () => boolean;
}

/** What paintInstrument rejects with once `cancelled()` has stopped it; the canvases it had made are emptied. */
export class PaintCancelled extends Error {
  constructor() {
    super('The compass painting was cancelled');
    this.name = 'PaintCancelled';
  }
}

/**
 * Paints the face (2048² on a fine pointer, 1024² on a coarse one, with the
 * lacquer image tiled over it when given) and the strips (STRIP.fine or
 * STRIP.coarse), one canvas per animation frame. Throws if the browser gives
 * no 2D canvas, and stops between canvases once `cancelled()` (PaintCancelled).
 */
export async function paintInstrument(fine: boolean, lacquer?: CanvasImageSource, options: PaintOptions = {}): Promise<Painted> {
  const size = fine ? FACE_SIZE.fine : FACE_SIZE.coarse;
  const strip = fine ? STRIP.fine : STRIP.coarse;
  const made: HTMLCanvasElement[] = [];
  const make = (width: number, height: number): CanvasRenderingContext2D => {
    const ctx = context(width, height);
    made.push(ctx.canvas);
    return ctx;
  };
  const stopIfCancelled = (): void => {
    if (!options.cancelled?.()) return;
    // A 2048² canvas holds 16 MB until it is collected; an empty one holds nothing.
    for (const canvas of made) canvas.width = canvas.height = 0;
    throw new PaintCancelled();
  };
  // A decoded image draws without a stall of its own.
  await (lacquer as HTMLImageElement | undefined)?.decode?.().catch(() => undefined);
  stopIfCancelled();

  let painted = 0;
  const done = async (): Promise<void> => {
    painted++;
    options.progress?.(painted / CANVASES);
    if (painted < CANVASES) await frame();
    stopIfCancelled();
  };

  // paintFace paints the colour and the mr map in one call: each frame hands it one real canvas and a
  // 1 × 1 scratch canvas for the other half, which clips its drawing to nothing (and the mr pass, no image).
  const scratch = make(1, 1);
  const colour = make(size, size);
  paintFace(colour, scratch, size, lacquer);
  await done();
  const mr = make(size, size);
  paintFace(scratch, mr, size);
  await done();

  const strips = {} as Record<HomeId, THREE.CanvasTexture>;
  for (const home of HOMES) {
    const ctx = make(strip.width, strip.height);
    paintHome(ctx, home, strip.width, strip.height);
    const map = texture(ctx, `compass:strip-${home}`, true);
    map.wrapS = THREE.RepeatWrapping;
    strips[home] = map;
    await done();
  }
  return { face: texture(colour, 'compass:face', true), mr: texture(mr, 'compass:face-mr', false), strips };
}
