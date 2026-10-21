/**
 * The eight trigrams, engraved on the compass's four glass bands in the order
 * of the Later Heaven (King Wen) arrangement. Data only; it imports nothing.
 * The band painter (src/engine/bob/paintBand.ts) draws them from these lines.
 */

/** One trigram: its Pinyin name, the Unicode character for it, and its three lines. */
export interface Trigram {
  name: string;
  /** The character U+2630..U+2637 that is drawn with these lines. */
  char: string;
  /** The three lines from the bottom to the top: 1 is whole (yang), 0 is broken (yin). */
  lines: readonly [0 | 1, 0 | 1, 0 | 1];
}

/**
 * The eight trigrams in the Later Heaven arrangement, starting at the south
 * and going clockwise round the compass: Li (fire), Kun (earth), Dui (lake),
 * Qian (heaven), Kan (water), Gen (mountain), Zhen (thunder), Xun (wind).
 * Each stands once.
 */
export const LATER_HEAVEN: readonly Trigram[] = Object.freeze([
  Object.freeze({ name: 'Li', char: '☲', lines: Object.freeze([1, 0, 1] as const) }),
  Object.freeze({ name: 'Kun', char: '☷', lines: Object.freeze([0, 0, 0] as const) }),
  Object.freeze({ name: 'Dui', char: '☱', lines: Object.freeze([1, 1, 0] as const) }),
  Object.freeze({ name: 'Qian', char: '☰', lines: Object.freeze([1, 1, 1] as const) }),
  Object.freeze({ name: 'Kan', char: '☵', lines: Object.freeze([0, 1, 0] as const) }),
  Object.freeze({ name: 'Gen', char: '☶', lines: Object.freeze([0, 0, 1] as const) }),
  Object.freeze({ name: 'Zhen', char: '☳', lines: Object.freeze([1, 0, 0] as const) }),
  Object.freeze({ name: 'Xun', char: '☴', lines: Object.freeze([0, 1, 1] as const) })
]);
