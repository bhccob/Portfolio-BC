import { describe, expect, it } from 'vitest';
import { LATER_HEAVEN } from '~/engine/bob/trigrams';

describe('LATER_HEAVEN', () => {
  it('lists the eight trigrams once each, Later Heaven order from the south', () => {
    expect(LATER_HEAVEN.map((t) => t.name)).toEqual(['Li', 'Kun', 'Dui', 'Qian', 'Kan', 'Gen', 'Zhen', 'Xun']);
    expect(new Set(LATER_HEAVEN.map((t) => t.lines.join(''))).size).toBe(8);
    expect(LATER_HEAVEN.find((t) => t.name === 'Qian')!.char).toBe('☰');
  });

  it('gives each trigram the Unicode character that is drawn with its lines', () => {
    // U+2630..U+2637 run from three whole lines (Qian) to three broken ones (Kun):
    // the offset reads the lines from the bottom, a broken line counting 1 and the bottom line 4.
    for (const { char, lines } of LATER_HEAVEN) {
      const offset = (1 - lines[0]) * 4 + (1 - lines[1]) * 2 + (1 - lines[2]);
      expect(char.codePointAt(0)).toBe(0x2630 + offset);
    }
  });

  it('has the right lines for each name, and the list runs clockwise from the south at 45 degrees a step', () => {
    // [name, lines from the bottom, bearing in degrees clockwise from north]: Li stands south (180), Kan north (0).
    const expected = [
      ['Li', [1, 0, 1], 180],
      ['Kun', [0, 0, 0], 225],
      ['Dui', [1, 1, 0], 270],
      ['Qian', [1, 1, 1], 315],
      ['Kan', [0, 1, 0], 0],
      ['Gen', [0, 0, 1], 45],
      ['Zhen', [1, 0, 0], 90],
      ['Xun', [0, 1, 1], 135]
    ] as const;
    LATER_HEAVEN.forEach((t, i) => {
      const [name, lines, bearing] = expected[i];
      expect(t.name).toBe(name);
      expect([...t.lines]).toEqual(lines);
      expect((180 + 45 * i) % 360).toBe(bearing);
    });
  });
});
