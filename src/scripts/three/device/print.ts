import * as THREE from 'three';
import { palette } from '../palette';

/**
 * The handheld's printed and lit surfaces, drawn on 2D canvases: the chips'
 * silkscreen names, the display and the power icon. Nothing here runs without
 * a document (the unit tests build the model in node), so every painter is
 * only called when `canPaint()` says so, and the model keeps its plain
 * materials otherwise. The type is Martian Mono in capitals with 0.12em
 * tracking, as on the site's labels; until the font has loaded the system
 * monospace stands in, and `draw()` paints again once it has.
 */

/** Martian Mono as the site loads it, then the system's monospace. */
const MONO = '"Martian Mono Variable", "Martian Mono", ui-monospace, monospace';
const WEIGHT = 500;
const TRACKING = 0.12;
const LEADING = 1.3;

/** The labels' font at `size` pixels, as a CSS font shorthand. */
export function mono(size: number, weight = WEIGHT): string {
  return `${weight} ${size}px ${MONO}`;
}

/** True where canvases can be drawn (a browser), false in node. */
export function canPaint(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/** A texture drawn on a canvas, and the function that draws it again. */
export interface Painted {
  texture: THREE.CanvasTexture;
  draw(): void;
}

function css(color: number, alpha = 1): string {
  const r = color >> 16;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

function canvasTexture(width: number, height: number): { context: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { context: canvas.getContext('2d')!, texture };
}

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

/** A small deterministic noise, so every load paints the same grain. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A chip's top: its size in world units and the name printed on it. */
export interface ChipTop {
  text: string;
  width: number;
  depth: number;
  /** Draw the small mountain mark above the name (the processor). */
  mark?: boolean;
}

/** Silkscreen pixels per world unit on the chip tops. */
const TOP_PIXELS = 2200;

/** Space kept clear round the names, as a share of the top's shorter side. */
const TOP_MARGIN = 0.14;

/** Epoxy black, as the chips' sides. */
export const EPOXY = 0x0e0d11;

/**
 * The chips' tops: matte black epoxy with a faint grain, a pin-1 dimple and
 * the name in white, one word to a line. Chips in one call share one type
 * size, the largest at which every name fits its top, so the row reads as one.
 */
export function paintChipTops(tops: readonly ChipTop[]): { textures: THREE.CanvasTexture[]; draw(): void } {
  const painted = tops.map((top, index) => ({
    top,
    index,
    lines: top.text.toUpperCase().split(/\s+/).filter(Boolean),
    ...canvasTexture(Math.min(1024, top.width * TOP_PIXELS), Math.min(1024, top.depth * TOP_PIXELS))
  }));

  const draw = (): void => {
    let size = Infinity;
    for (const { context, lines, top } of painted) {
      if (!lines.length) continue;
      const { width, height } = context.canvas;
      context.font = mono(100);
      const widest = Math.max(...lines.map((line) => trackedWidth(context, line, 100))) / 100;
      const margin = TOP_MARGIN * Math.min(width, height);
      const rows = lines.length + (top.mark ? 1.4 : 0);
      size = Math.min(size, (width - 2 * margin) / widest, (height - 2 * margin) / (rows * LEADING), height * 0.13);
    }
    for (const { context, texture, lines, top, index } of painted) {
      const { width, height } = context.canvas;
      // Epoxy with a fine mottled grain.
      context.fillStyle = css(EPOXY);
      context.fillRect(0, 0, width, height);
      const rand = random(1000 + index);
      for (let i = 0; i < (width * height) / 40; i++) {
        context.fillStyle = css(rand() < 0.5 ? 0x000000 : 0x2a2730, 0.18);
        context.fillRect(rand() * width, rand() * height, 2, 2);
      }
      // Pin-1 dimple: a slightly glossier, darker disc with a soft lit rim.
      const dot = Math.min(width, height) * 0.055;
      const dx = Math.min(width, height) * 0.12;
      context.beginPath();
      context.arc(dx, dx, dot, 0, Math.PI * 2);
      context.fillStyle = css(0x050407);
      context.fill();
      context.strokeStyle = css(0x3a3640, 0.8);
      context.lineWidth = Math.max(1, dot * 0.18);
      context.stroke();

      if (!lines.length || !Number.isFinite(size)) {
        texture.needsUpdate = true;
        continue;
      }
      const ink = css(0xf3efe6, 0.94);
      const rows = lines.length + (top.mark ? 1.4 : 0);
      let y = height / 2 - ((rows - 1) * size * LEADING) / 2;
      if (top.mark) {
        // The mountain mark: two peaks in a thin outline, as on the device's label.
        const w = size * 2.2;
        const h = size * 1.1;
        const x0 = width / 2 - w / 2;
        const y0 = y + h * 0.35;
        context.strokeStyle = ink;
        context.lineWidth = Math.max(1.5, size * 0.09);
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(x0, y0);
        context.lineTo(x0 + w * 0.38, y0 - h);
        context.lineTo(x0 + w * 0.58, y0 - h * 0.55);
        context.lineTo(x0 + w * 0.72, y0 - h * 0.78);
        context.lineTo(x0 + w, y0);
        context.closePath();
        context.stroke();
        y += size * LEADING * 1.4;
      }
      context.font = mono(size);
      context.fillStyle = ink;
      lines.forEach((line, i) => {
        fillTracked(context, line, (width - trackedWidth(context, line, size)) / 2, y + i * size * LEADING, size);
      });
      texture.needsUpdate = true;
    }
  };
  draw();
  return { textures: painted.map(({ texture }) => texture), draw };
}

/** Display pixels across; the height follows the display's aspect. */
const DISPLAY_PIXELS = 1600;

/**
 * The display, lit: a black ink border as printed under the glass, then a
 * near-black purple gradient with a few thin gold contour lines rising like a
 * range of hills, and a small "BC-2006" bottom-left. No clock and no fake UI.
 * `border` is the ink border's width as a share of the display's depth.
 */
export function paintDisplay(aspect: number, border: number, radius: number): Painted {
  const { context, texture } = canvasTexture(DISPLAY_PIXELS, DISPLAY_PIXELS / aspect);
  const { width, height } = context.canvas;

  const draw = (): void => {
    context.fillStyle = '#030205';
    context.fillRect(0, 0, width, height);

    const inset = border * height;
    const w = width - 2 * inset;
    const h = height - 2 * inset;
    context.save();
    context.beginPath();
    context.roundRect(inset, inset, w, h, Math.max(0, radius * height - inset));
    context.clip();

    const glow = context.createRadialGradient(inset + w * 0.66, inset + h * 0.55, 0, inset + w * 0.6, inset + h * 0.5, w * 0.7);
    glow.addColorStop(0, css(0x1c0e2e));
    glow.addColorStop(0.5, css(0x0e0619));
    glow.addColorStop(1, css(0x050309));
    context.fillStyle = glow;
    context.fillRect(inset, inset, w, h);

    // Contour lines: ridgelines of a small range of hills seen from the front,
    // drawn back to front, each hiding what lies behind it.
    const terrain = (x: number, t: number): number => {
      const drift = 0.04 * Math.sin(t * 4.1);
      return (
        0.95 * Math.exp(-(((x - 0.7 - drift) / 0.11) ** 2)) +
        0.55 * Math.exp(-(((x - 0.86 + drift) / 0.075) ** 2)) +
        0.4 * Math.exp(-(((x - 0.55) / 0.09) ** 2)) * (0.6 + 0.4 * Math.sin(t * 6)) +
        0.05 * Math.sin(x * 41 + t * 9) +
        0.035 * Math.sin(x * 97 + t * 17)
      );
    };
    const lines = 26;
    for (let k = 0; k < lines; k++) {
      const t = k / (lines - 1);
      const base = 0.42 + t * 0.5;
      const amplitude = 0.16 + 0.24 * t;
      const points: [number, number][] = [];
      for (let i = 0; i <= 320; i++) {
        const x = i / 320;
        const rise = Math.max(0, terrain(x, t)) * Math.min(1, Math.max(0, (x - 0.3) / 0.2));
        points.push([inset + x * w, inset + (base - rise * amplitude) * h]);
      }
      context.beginPath();
      points.forEach(([px, py], i) => (i === 0 ? context.moveTo(px, py) : context.lineTo(px, py)));
      context.lineTo(inset + w, inset + h);
      context.lineTo(inset, inset + h);
      context.closePath();
      context.fillStyle = glow;
      context.fill();
      context.beginPath();
      points.forEach(([px, py], i) => (i === 0 ? context.moveTo(px, py) : context.lineTo(px, py)));
      const fade = context.createLinearGradient(inset + w * 0.3, 0, inset + w, 0);
      const strength = 0.18 + 0.72 * t * t;
      fade.addColorStop(0, css(palette.gold, 0));
      fade.addColorStop(0.3, css(palette.gold, strength));
      fade.addColorStop(1, css(palette.gold, strength * 0.7));
      context.strokeStyle = fade;
      context.lineWidth = 0.9 + 1.4 * t;
      context.stroke();
    }

    const size = h * 0.045;
    context.font = mono(size);
    context.fillStyle = css(palette.gold, 0.85);
    fillTracked(context, 'BC-2006', inset + h * 0.08, inset + h - h * 0.09, size);
    context.restore();
    texture.needsUpdate = true;
  };
  draw();
  return { texture, draw };
}

/**
 * The mark laser-etched into the back plate, as an alpha map (white where
 * the metal is etched): the two-peak mountain over "BC-2006".
 */
export function paintEtching(aspect: number): Painted {
  const { context, texture } = canvasTexture(1024, 1024 / aspect);
  texture.colorSpace = THREE.NoColorSpace;
  const { width, height } = context.canvas;
  const draw = (): void => {
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#fff';
    context.fillStyle = '#fff';
    const w = height * 0.62;
    const h = height * 0.3;
    const x0 = width / 2 - w / 2;
    const y0 = height * 0.46;
    context.lineWidth = height * 0.035;
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x0 + w * 0.38, y0 - h);
    context.lineTo(x0 + w * 0.58, y0 - h * 0.55);
    context.lineTo(x0 + w * 0.72, y0 - h * 0.78);
    context.lineTo(x0 + w, y0);
    context.closePath();
    context.stroke();
    const size = height * 0.16;
    context.font = mono(size);
    fillTracked(context, 'BC-2006', (width - trackedWidth(context, 'BC-2006', size)) / 2, height * 0.74, size);
    texture.needsUpdate = true;
  };
  draw();
  return { texture, draw };
}

/**
 * The power button's face, as an emissive map: a warm yellow disc, brighter
 * at its rim, with the power symbol glowing near white in the middle.
 */
export function paintPowerIcon(): THREE.CanvasTexture {
  const { context, texture } = canvasTexture(256, 256);
  const c = 128;
  const face = context.createRadialGradient(c, c, 0, c, c, 128);
  face.addColorStop(0, '#5a3d06');
  face.addColorStop(0.62, '#7a5208');
  face.addColorStop(0.8, '#ffcf33');
  face.addColorStop(0.9, '#ffe17a');
  face.addColorStop(1, '#b8860b');
  context.fillStyle = face;
  context.fillRect(0, 0, 256, 256);

  context.strokeStyle = '#fff1b8';
  context.lineCap = 'round';
  context.lineWidth = 16;
  context.shadowColor = '#ffcf33';
  context.shadowBlur = 18;
  context.beginPath();
  context.arc(c, c + 6, 46, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(c, c - 58);
  context.lineTo(c, c - 4);
  context.stroke();
  texture.needsUpdate = true;
  return texture;
}
