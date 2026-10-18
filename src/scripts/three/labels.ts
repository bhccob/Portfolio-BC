import * as THREE from 'three';
import { SCREEN_DISPLAY, SPEC_LABEL } from './Device';
import { palette } from './palette';

/**
 * The device's printed and lit surfaces, drawn on 2D canvases for
 * DeviceScene: the portrait on the display, the spec label on the back
 * plate, the silkscreen names on the chips and the soft shadow under it all.
 * Every texture is in sRGB. The type is Martian Mono in capitals with 0.12em
 * tracking, as on the site's HUD labels; until the font has loaded the
 * system monospace stands in, so the type textures can be drawn again.
 */

/** Martian Mono as the site loads it, then the system's monospace. */
const MONO = '"Martian Mono Variable", "Martian Mono", ui-monospace, monospace';
const WEIGHT = 500;

/** The labels' font at `size` pixels, as a CSS font shorthand. */
export function mono(size: number): string {
  return `${WEIGHT} ${size}px ${MONO}`;
}

/** Letter spacing, in em. */
const TRACKING = 0.12;

/** Line spacing, in em. */
const LEADING = 1.3;

/** A texture drawn on a canvas, and the function that draws it again. */
export interface Painted<T = THREE.CanvasTexture> {
  texture: T;
  draw(): void;
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function canvasTexture(width: number, height: number): { context: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { context: canvas.getContext('2d')!, texture };
}

function useFont(context: CanvasRenderingContext2D, size: number): void {
  context.font = mono(size);
}

/** The width of `text` set at `size` with the tracking, not counting space after the last letter. */
function trackedWidth(context: CanvasRenderingContext2D, text: string, size: number): number {
  const letters = [...text];
  const width = letters.reduce((sum, letter) => sum + context.measureText(letter).width, 0);
  return width + TRACKING * size * Math.max(0, letters.length - 1);
}

/** Sets `text` letter by letter from `x`, its middle on `y`. */
function fillTracked(context: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  for (const letter of text) {
    context.fillText(letter, x, y);
    x += context.measureText(letter).width + TRACKING * size;
  }
}

/** Screen pixels across; the height follows the display's aspect. */
const SCREEN_PIXELS = 1024;

/** The point of the portrait the crop keeps in the middle (0..1 across and down), so the face stays on screen. */
const PORTRAIT_FOCUS = { x: 0.5, y: 0.45 };

/**
 * The portrait at `src`, cover-cropped to the display. The image is loaded
 * here, once; the screen stays dark until it arrives.
 */
export function paintScreen(src: string): THREE.CanvasTexture {
  const { context, texture } = canvasTexture(SCREEN_PIXELS, (SCREEN_PIXELS * SCREEN_DISPLAY.depth) / SCREEN_DISPLAY.width);
  const { width, height } = context.canvas;
  context.fillStyle = css(palette.ink);
  context.fillRect(0, 0, width, height);

  const image = new Image();
  image.decoding = 'async';
  image.addEventListener(
    'load',
    () => {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      const x = THREE.MathUtils.clamp(width / 2 - PORTRAIT_FOCUS.x * w, width - w, 0);
      const y = THREE.MathUtils.clamp(height / 2 - PORTRAIT_FOCUS.y * h, height - h, 0);
      context.drawImage(image, x, y, w, h);
      texture.needsUpdate = true;
    },
    { once: true }
  );
  image.src = src;
  return texture;
}

/** Spec label pixels across; the height follows the label's aspect. */
const SPEC_PIXELS = 1024;

/** The label's margin and its yellow border, as shares of its height. */
const SPEC_MARGIN = 0.2;
const SPEC_BORDER = { inset: 0.07, width: 0.012, radius: 0.06 };

/** The spec label: its lines in yellow on board purple, inside a thin yellow border, as on the back of a real device. */
export function paintSpec(lines: readonly string[]): Painted {
  const { context, texture } = canvasTexture(SPEC_PIXELS, (SPEC_PIXELS * SPEC_LABEL.depth) / SPEC_LABEL.width);
  const { width, height } = context.canvas;
  const text = lines.map((line) => line.toUpperCase());

  const draw = (): void => {
    context.fillStyle = css(palette.board);
    context.fillRect(0, 0, width, height);

    const inset = SPEC_BORDER.inset * height;
    context.strokeStyle = css(palette.yellow);
    context.lineWidth = SPEC_BORDER.width * height;
    context.beginPath();
    context.roundRect(inset, inset, width - 2 * inset, height - 2 * inset, SPEC_BORDER.radius * height);
    context.stroke();
    texture.needsUpdate = true;

    if (!text.length) return;
    const margin = SPEC_MARGIN * height;
    useFont(context, 100);
    const widest = Math.max(...text.map((line) => trackedWidth(context, line, 100))) / 100;
    const size = Math.min((width - 2 * margin) / widest, (height - 2 * margin) / (text.length * LEADING));
    useFont(context, size);
    context.fillStyle = css(palette.yellow);
    text.forEach((line, i) => fillTracked(context, line, margin, height / 2 + (i - (text.length - 1) / 2) * size * LEADING, size));
  };
  draw();
  return { texture, draw };
}

/** A chip's printed name and the size of the top it is printed on (world units). */
export interface Plate {
  text: string;
  width: number;
  depth: number;
}

/** Silkscreen pixels per world unit. */
const SILKSCREEN_PIXELS = 1400;

/** Space kept clear round the names, in world units; it also keeps them off the pin-1 dot. */
const SILKSCREEN_MARGIN = 0.045;

/** The tallest the names are set, in world units. */
const SILKSCREEN_MAX = 0.07;

/**
 * The chips' names, one word to a line, in lilac on clear. They share one
 * size, the largest at which every name fits its chip, so the row reads as
 * one board.
 */
export function paintSilkscreen(plates: readonly Plate[]): Painted<THREE.CanvasTexture[]> {
  const painted = plates.map((plate) => ({
    lines: plate.text.toUpperCase().split(/\s+/).filter(Boolean),
    ...canvasTexture(plate.width * SILKSCREEN_PIXELS, plate.depth * SILKSCREEN_PIXELS),
    plate
  }));

  const draw = (): void => {
    let size = SILKSCREEN_MAX;
    for (const { context, lines, plate } of painted) {
      if (!lines.length) continue;
      useFont(context, 100);
      const widest = Math.max(...lines.map((line) => trackedWidth(context, line, 100))) / 100;
      size = Math.min(size, (plate.width - 2 * SILKSCREEN_MARGIN) / widest, (plate.depth - 2 * SILKSCREEN_MARGIN) / (lines.length * LEADING));
    }
    const pixels = size * SILKSCREEN_PIXELS;
    for (const { context, texture, lines } of painted) {
      const { width, height } = context.canvas;
      context.clearRect(0, 0, width, height);
      useFont(context, pixels);
      context.fillStyle = css(palette.lilac);
      lines.forEach((line, i) => {
        const x = (width - trackedWidth(context, line, pixels)) / 2;
        fillTracked(context, line, x, height / 2 + (i - (lines.length - 1) / 2) * pixels * LEADING, pixels);
      });
      texture.needsUpdate = true;
    }
  };
  draw();
  return { texture: painted.map(({ texture }) => texture), draw };
}

/** A soft round shadow in ink, darkest in the middle and gone at the edge. */
export function paintShadow(): THREE.CanvasTexture {
  const { context, texture } = canvasTexture(256, 256);
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  const ink = [palette.ink >> 16, (palette.ink >> 8) & 0xff, palette.ink & 0xff].join(' ');
  const rgba = (alpha: number): string => `rgb(${ink} / ${alpha})`;
  gradient.addColorStop(0, rgba(0.7));
  gradient.addColorStop(0.45, rgba(0.45));
  gradient.addColorStop(1, rgba(0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return texture;
}
