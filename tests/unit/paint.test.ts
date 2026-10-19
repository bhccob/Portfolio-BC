import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaintCancelled, paintInstrument } from '../../src/scripts/three/instrument/paint';
import { STRIP } from '../../src/scripts/three/instrument/patterns';

/** A canvas whose 2D context takes any drawing call and does nothing, as the patterns tests' mock does. */
interface FakeCanvas {
  width: number;
  height: number;
  getContext(kind: string): unknown;
}

let canvases: FakeCanvas[];
let frames: number;

function fakeCanvas(): FakeCanvas {
  const canvas: FakeCanvas = {
    width: 300,
    height: 150,
    getContext: () =>
      new Proxy({ canvas } as Record<string, unknown>, {
        get: (t, k) => (k in t ? t[k as string] : () => ({ addColorStop: () => {} })),
        set: (t, k, v) => {
          t[k as string] = v;
          return true;
        }
      })
  };
  canvases.push(canvas);
  return canvas;
}

beforeEach(() => {
  canvases = [];
  frames = 0;
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    frames++;
    setTimeout(callback, 0);
    return frames;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('paintInstrument', () => {
  it('paints the face, its mr map and the four strips, one canvas a frame, reporting each', async () => {
    const shares: number[] = [];
    const painted = await paintInstrument(true, undefined, { progress: (share) => shares.push(share) });
    expect(shares).toEqual([1, 2, 3, 4, 5, 6].map((n) => n / 6));
    // A frame between each of the six canvases, none after the last.
    expect(frames).toBe(5);
    expect([painted.face.image, painted.mr.image].map((c) => [c.width, c.height])).toEqual([
      [2048, 2048],
      [2048, 2048]
    ]);
    for (const strip of Object.values(painted.strips)) {
      expect([strip.image.width, strip.image.height]).toEqual([STRIP.fine.width, STRIP.fine.height]);
      expect(strip.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(strip.wrapS).toBe(THREE.RepeatWrapping);
    }
    expect(Object.keys(painted.strips).sort()).toEqual(['aruba', 'china', 'plain', 'rotterdam']);
    expect(painted.face.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(painted.mr.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('paints the coarse sizes on a coarse pointer', async () => {
    const painted = await paintInstrument(false);
    expect(painted.face.image.width).toBe(1024);
    expect(painted.strips.china.image.width).toBe(STRIP.coarse.width);
  });

  it('stops between canvases once cancelled, emptying the canvases it made', async () => {
    let shares = 0;
    const run = paintInstrument(true, undefined, { progress: () => shares++, cancelled: () => shares >= 2 });
    await expect(run).rejects.toBeInstanceOf(PaintCancelled);
    // The scratch canvas, the face and the mr map were made; no strip was.
    expect(canvases.length).toBe(3);
    for (const canvas of canvases) expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it('paints nothing when cancelled before it starts', async () => {
    await expect(paintInstrument(true, undefined, { cancelled: () => true })).rejects.toBeInstanceOf(PaintCancelled);
    expect(canvases.length).toBe(0);
  });
});
