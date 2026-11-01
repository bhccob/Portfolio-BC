import { describe, expect, it } from 'vitest';
import { LED_TINTS, ledCell, ledLevel, makeLedSky } from '~/ui/ledSky';

/** A 2D context that records what is drawn: each fill with its style, the gradients asked for. */
function recorder() {
  const fills: { style: unknown; x: number; y: number; w: number; h: number }[] = [];
  const calls: string[] = [];
  const gradient = () => ({ addColorStop: () => undefined });
  const ctx = {
    fillStyle: '' as unknown,
    clearRect: () => calls.push('clear'),
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ style: this.fillStyle, x, y, w, h });
    },
    createLinearGradient: () => {
      calls.push('linear');
      return gradient();
    },
    createRadialGradient: () => {
      calls.push('radial');
      return gradient();
    }
  };
  return { ctx, fills, calls };
}

/** A canvas over a recording context, and the small one the frame is read through: every pixel at `grey` (0..255). */
function setup(grey = 128) {
  const screen = recorder();
  const canvas = { width: 0, height: 0, getContext: () => screen.ctx } as unknown as HTMLCanvasElement;
  const small = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: () => undefined,
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(grey) })
    })
  } as unknown as HTMLCanvasElement;
  const sky = makeLedSky(canvas, () => small);
  return { sky, canvas, ...screen };
}

const SIZE = { width: 1440, height: 900 };
const SOURCE = {} as CanvasImageSource;
const DARK = '#030108';

describe('the LED screen: the digitize, from the frame grab (round 15)', () => {
  it('has 6 px cells, 5 on a phone', () => {
    expect(ledCell(1440)).toBe(6);
    expect(ledCell(700)).toBe(5);
    expect(ledCell(390)).toBe(5);
  });

  it('reads a cell\'s level off its brightness: 1.1 √l of twelve', () => {
    expect(ledLevel(0)).toBe(0);
    expect(ledLevel(0.25)).toBe(6);
    expect(ledLevel(1)).toBe(11);
    expect(ledLevel(2)).toBe(11);
  });

  it('tints the levels from dark violet through violet and gold to warm white', () => {
    expect(LED_TINTS).toHaveLength(12);
    expect(LED_TINTS[0]).toBe('rgb(38,26,92)');
    expect(LED_TINTS[11]).toBe('rgb(255,238,205)');
  });

  it('draws nothing while the line has not come', () => {
    const { sky, fills, calls } = setup();
    sky.draw({ source: SOURCE, line: 0, end: 0, size: SIZE, core: null });
    expect(fills).toEqual([]);
    expect(calls).toEqual(['clear']);
  });

  it('turns the world over the line into dots on the dark, and leaves it as it is under it', () => {
    const { sky, canvas, fills, calls } = setup();
    sky.draw({ source: SOURCE, line: 0.5, end: 0, size: SIZE, core: null });
    expect([canvas.width, canvas.height]).toEqual([1440, 900]);
    expect(fills[0]).toEqual({ style: DARK, x: 0, y: 0, w: 1440, h: 450 });
    const dots = fills.filter((f) => typeof f.style === 'string' && f.style.startsWith('rgb('));
    expect(dots.length).toBeGreaterThan(1000);
    for (const d of dots) expect(d.y).toBeLessThan(450 + 6);
    // Grey 128 is level 9: a dot 0.28 + 0.6 · 9 / 11 of the cell.
    expect(dots[0]!.w).toBeCloseTo(6 * (0.28 + (0.6 * 9) / 11), 9);
    // The laser while it is on its way: its glow, then its line.
    expect(calls).toContain('linear');
    expect(calls).not.toContain('radial');
  });

  it('leaves out the faintest cells', () => {
    const { sky, fills } = setup(2);
    sky.draw({ source: SOURCE, line: 1, end: 0, size: SIZE, core: null });
    expect(fills.filter((f) => typeof f.style === 'string' && f.style.startsWith('rgb('))).toEqual([]);
  });

  it('darkens the middle behind the end\'s words as the end comes, and the line is gone once past', () => {
    const { sky, calls } = setup();
    sky.draw({ source: SOURCE, line: 1, end: 0.6, size: SIZE, core: { x: 720, y: 500 } });
    expect(calls).toContain('radial');
    expect(calls).not.toContain('linear');
  });

  it('clears when the grab gives nothing', () => {
    const { sky, fills, calls } = setup();
    sky.draw({ source: null, line: 0.8, end: 0, size: SIZE, core: null });
    expect(fills).toEqual([]);
    expect(calls).toEqual(['clear']);
    sky.clear();
    expect(calls).toEqual(['clear', 'clear']);
  });
});
