/**
 * The digitize's LED screen (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; the mock-up's `scanWorld`, Bob's
 * mix: "digitize for stuur een bericht"): past question 6 a laser line sweeps down the screen and over it the world is
 * drawn as small square LEDs, a cell a pixel of the frame on the screen (grabbed after the render, ../scene/frameGrab.ts),
 * each dot as big and as bright as its cell, dark violet through violet and gold to warm white; behind the end's words
 * the LEDs go dark, and a ripple of light runs out from the core as the end comes. One 2D canvas over the scene, under
 * the Q&A's words (src/ui/QaRing.tsx `.qa-leds`), drawn by the Q&A's scene (src/scene/bob/qaScene.ts).
 */

/** The LEDs' numbers (the mock-up's): levels, the faintest left out, the brightness's gain, a dot's size by its level, the line's glow, the hush behind the end's words, the ripple. */
export const LED = {
  levels: 12,
  skip: 2,
  gain: 1.1,
  dot: [0.28, 0.6],
  line: { glow: 40 },
  hush: { radius: 420, alpha: 0.82, at: 0.4 },
  ripple: { gain: 0.5, width: 60, reach: 1.4 }
} as const;

/** The dark the LEDs stand on. */
const DARK = '#030108';
/** The tints' stops: dark violet, violet at 60% of the levels, gold at 82%, warm white at the top. */
const STOPS = { dim: [38, 26, 92], violet: [118, 88, 226], gold: [255, 186, 88], white: [255, 238, 205] } as const;

/** A cell's size, CSS px: 6, 5 on a phone. */
export function ledCell(width: number): number {
  return width <= 700 ? 5 : 6;
}

/** A cell's level, 0..11, from its brightness 0..1: 1.1 √l of twelve, the top held. */
export function ledLevel(luminance: number): number {
  return Math.floor(Math.min(LED.gain * Math.sqrt(Math.max(luminance, 0)), 0.999) * LED.levels);
}

const mix = (a: readonly number[], b: readonly number[], t: number): string => `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(',')})`;

/** Each level's colour. */
export const LED_TINTS: readonly string[] = Array.from({ length: LED.levels }, (_, k) => {
  const t = k / (LED.levels - 1);
  if (t < 0.6) return mix(STOPS.dim, STOPS.violet, t / 0.6);
  if (t < 0.82) return mix(STOPS.violet, STOPS.gold, (t - 0.6) / 0.22);
  return mix(STOPS.gold, STOPS.white, (t - 0.82) / 0.18);
});

/** What a frame of the LEDs is drawn from. */
export interface LedDraw {
  /** The frame on the screen, grabbed after the render; null when there is none (a lost context). */
  source: CanvasImageSource | null;
  /** The laser line's place down the screen, 0 (none) .. 1 (past its foot). */
  line: number;
  /** The end's part, 0..1: the hush behind its words, the ripple. */
  end: number;
  /** The screen, CSS px. */
  size: { width: number; height: number };
  /** The core's light on the screen, CSS px: where the ripple runs out from; null unseen. */
  core: { x: number; y: number } | null;
}

export interface LedSky {
  draw(d: LedDraw): void;
  clear(): void;
}

/** The LED screen on `canvas`, the frame read through a small canvas (`small`'s, a document's by default). */
export function makeLedSky(canvas: HTMLCanvasElement, small: () => HTMLCanvasElement = () => canvas.ownerDocument.createElement('canvas')): LedSky {
  const ctx = canvas.getContext('2d');
  let reader: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  const buckets: number[][] = Array.from({ length: LED.levels }, () => []);
  const clear = (): void => {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };
  return {
    clear,
    draw({ source, line, end, size, core }) {
      if (!ctx) return;
      const W = Math.round(size.width);
      const H = Math.round(size.height);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      clear();
      if (source === null || !(line > 0)) return;
      if (reader === null) {
        const c = small();
        const r = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
        if (!r) return;
        reader = { canvas: c, ctx: r };
      }
      const cell = ledCell(W);
      const cols = Math.ceil(W / cell);
      const rows = Math.ceil(H / cell);
      if (reader.canvas.width !== cols || reader.canvas.height !== rows) {
        reader.canvas.width = cols;
        reader.canvas.height = rows;
      }
      reader.ctx.drawImage(source, 0, 0, cols, rows);
      const data = reader.ctx.getImageData(0, 0, cols, rows).data;
      const over = Math.min(H, line * H);
      ctx.fillStyle = DARK;
      ctx.fillRect(0, 0, W, over);
      for (const b of buckets) b.length = 0;
      const up = Math.min(rows, Math.ceil(over / cell));
      const wave = end * LED.ripple.reach * Math.hypot(W, H);
      for (let r = 0; r < up; r++) {
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 4;
          let bright = LED.gain * Math.sqrt((0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255);
          if (end > 0 && core) bright += LED.ripple.gain * Math.exp(-(((Math.hypot(c * cell - core.x, r * cell - core.y) - wave) / LED.ripple.width) ** 2));
          const level = Math.floor(Math.min(bright, 0.999) * LED.levels);
          if (level >= LED.skip) buckets[level]!.push(c, r);
        }
      }
      buckets.forEach((cells, level) => {
        if (cells.length === 0) return;
        ctx.fillStyle = LED_TINTS[level]!;
        const s = cell * (LED.dot[0] + (LED.dot[1] * level) / (LED.levels - 1));
        const o = (cell - s) / 2;
        for (let k = 0; k < cells.length; k += 2) ctx.fillRect(cells[k]! * cell + o, cells[k + 1]! * cell + o, s, s);
      });
      // Behind the end's words, the LEDs go dark: over the line only, never the scene still under it.
      if (end > 0) {
        const y = LED.hush.at * H;
        const hush = ctx.createRadialGradient(W / 2, y, 0, W / 2, y, LED.hush.radius);
        hush.addColorStop(0, `rgba(3, 1, 8, ${LED.hush.alpha * end})`);
        hush.addColorStop(1, 'rgba(3, 1, 8, 0)');
        ctx.fillStyle = hush;
        ctx.fillRect(0, 0, W, over);
      }
      // The laser while it is on its way: its glow above it, then the line.
      if (line < 1) {
        const glow = ctx.createLinearGradient(0, over - LED.line.glow, 0, over);
        glow.addColorStop(0, 'rgba(255, 196, 110, 0)');
        glow.addColorStop(1, 'rgba(255, 196, 110, 0.35)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, over - LED.line.glow, W, LED.line.glow);
        ctx.fillStyle = 'rgba(255, 236, 196, 0.95)';
        ctx.fillRect(0, over - 1, W, 2);
      }
    }
  };
}
