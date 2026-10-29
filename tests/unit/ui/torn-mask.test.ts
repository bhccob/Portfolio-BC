import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MASKS, raggedAlpha } from '~/ui/tornMask';

/** The alpha at (x, y) of a mask `w` across. */
const at = (alpha: Uint8ClampedArray, w: number, x: number, y: number): number => alpha[(y * w + x) * 4 + 3]!;

// The project page's torn hole (spec 2026-10-29-bob-stack-2-design.md, goal 2: "a torn, ragged hole ... edges
// dry-brushed"; the mock-up's raggedMask), drawn once ahead of time by tools/masks.ts.
describe('the torn mask', () => {
  it("tears the hole's edges, the same for a seed", () => {
    const w = 180;
    const h = 120;
    const a = raggedAlpha(w, h, 90, 50, 65, 40, false, 3.1);
    const b = raggedAlpha(w, h, 90, 50, 65, 40, false, 3.1);
    expect(a).toEqual(b);
    expect(raggedAlpha(w, h, 90, 50, 65, 40, false, 5.7)).not.toEqual(a);
    // A hole: clear in its middle, the dark at the corners.
    expect(at(a, w, 90, 50)).toBe(0);
    expect(at(a, w, 2, 2)).toBe(255);
    // Torn: along its edge the dark comes and goes, never one smooth line.
    const edge = Array.from({ length: 40 }, (_, k) => at(a, w, 90 + Math.round(Math.cos(k / 6.4) * 62), 50 + Math.round(Math.sin(k / 6.4) * 38)));
    expect(new Set(edge).size).toBeGreaterThan(5);
  });

  it('turns inside out for a blot', () => {
    const w = 100;
    const blot = raggedAlpha(w, 100, 50, 50, 40, 40, true, 8.3);
    expect(at(blot, w, 50, 50)).toBe(255);
    expect(at(blot, w, 1, 1)).toBe(0);
  });
});

describe('the masks drawn ahead of time', () => {
  it('are in src/assets/masks, each the size the page masks with', () => {
    for (const [name, [w, h]] of Object.entries(MASKS)) {
      const png = readFileSync(`src/assets/masks/${name}.png`);
      // A PNG's width and height, in its header.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([w, h]);
    }
  });
});
