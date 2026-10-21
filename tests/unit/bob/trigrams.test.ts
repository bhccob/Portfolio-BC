import { describe, expect, it } from 'vitest';
import { LATER_HEAVEN } from '~/engine/bob/trigrams';
import { TRIGRAMS } from '~/engine/instrument/dialSpec';

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

  it('agrees with the dial: the same lines for each name, and clockwise from the south at 45 degrees a step', () => {
    LATER_HEAVEN.forEach((t, i) => {
      const onDial = TRIGRAMS.find((d) => d.name === t.name)!;
      expect(onDial.lines).toEqual(t.lines);
      expect(onDial.bearing).toBe((180 + 45 * i) % 360);
    });
  });
});
