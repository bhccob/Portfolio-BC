import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

// Round 8 (spec 2026-10-30-bob-moonlit-3d-design.md): Bob picked the moonlit storm from Blender renders of real volume
// clouds; the storm's plates are rendered so (tools/blender/storm_plates.py, tools/storm_webp.mjs).

const file = (name: string): string => fileURLToPath(new URL(`../../../src/assets/storm/${name}.webp`, import.meta.url));
const PLATES = { 'storm-wall': [2688, 1152], 'storm-sea': [2688, 1152], 'storm-bank': [2688, 1152], 'storm-wall-flash': [1344, 576], 'storm-bank-flash': [1344, 576] } as const;
const BUDGET = 1_200_000;

/** The plate's pixels as RGBA bytes. */
async function pixels(name: string): Promise<{ data: Buffer; count: number }> {
  const { data, info } = await sharp(file(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, count: info.width * info.height };
}
const luma = (d: Buffer, i: number): number => (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;

describe('the storm plates rendered from real clouds', () => {
  it('has all five plates, wall, sea and bank at 2688 x 1152, the flashes at 1344 x 576', async () => {
    for (const [name, [w, h]] of Object.entries(PLATES)) {
      expect(existsSync(file(name)), name).toBe(true);
      const meta = await sharp(file(name)).metadata();
      expect([meta.width, meta.height], name).toEqual([w, h]);
    }
  });

  it('keeps the five within 1.2 MB together', () => {
    const total = Object.keys(PLATES).reduce((sum, name) => sum + statSync(file(name)).size, 0);
    expect(total).toBeLessThanOrEqual(BUDGET);
  });

  it('gives the bank its own alpha, with the sky let through: at least 30% of its pixels below alpha 0.1 and 15% above 0.9', async () => {
    expect((await sharp(file('storm-bank')).metadata()).hasAlpha).toBe(true);
    const { data, count } = await pixels('storm-bank');
    let clear = 0;
    let solid = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! < 0.1 * 255) clear++;
      if (data[i]! > 0.9 * 255) solid++;
    }
    expect(clear / count).toBeGreaterThanOrEqual(0.3);
    expect(solid / count).toBeGreaterThanOrEqual(0.15);
  });

  it('keeps the wall and the sea opaque, and the flash plates black but for their glow (median luma under 0.02, peak over 0.5)', async () => {
    for (const name of ['storm-wall', 'storm-sea']) {
      const { data } = await pixels(name);
      let min = 255;
      for (let i = 3; i < data.length; i += 4) min = Math.min(min, data[i]!);
      expect(min, name).toBe(255);
    }
    for (const name of ['storm-wall-flash', 'storm-bank-flash']) {
      const { data, count } = await pixels(name);
      const values: number[] = [];
      for (let i = 0; i < data.length; i += 4) values.push(luma(data, i));
      values.sort((a, b) => a - b);
      expect(values[Math.floor(count / 2)]!, name).toBeLessThan(0.02);
      expect(values[count - 1]!, name).toBeGreaterThan(0.5);
    }
  });
});
