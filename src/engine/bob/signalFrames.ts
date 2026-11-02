/**
 * The signal's frames (round 17, spec 2026-11-01-bob-signal-loader-design.md; Bob: "B · Signal"): the loader's line is a
 * wire as a logic analyzer shows it, carrying the hero's name as UART does, and these are its bits. Idle is high; each
 * byte is a start bit (low), its eight bits lowest first, and a stop bit (high); `lead` idle bits come first and `gap`
 * after each byte. Pure: it imports nothing from three.
 *
 * - `half`: the line runs from −half to +half m along the glass's x, through the compass's centre (the wide shot fits
 *   ±4.0 m to the screen's edges, so it covers the middle nine tenths of every screen);
 * - `high`: how far a high level stands over the glass, m; a low one lies on it;
 * - `label`: the channel's name, as an analyzer names it.
 */
export const SIGNAL = { lead: 6, gap: 3, half: 3.6, high: 0.2, label: 'CH0 · UART' } as const;

/** A byte of the name on the line: its character and code, and its frame's bits, `from` its start bit to one past its stop bit. */
export interface SignalByte {
  char: string;
  code: number;
  from: number;
  to: number;
}

/** The bytes of `word` (one per character, its code below 256) and where each frame stands among the bits. */
export function signalBytes(word: string): SignalByte[] {
  return [...word].map((char, i) => {
    const from = SIGNAL.lead + i * (10 + SIGNAL.gap);
    return { char, code: char.charCodeAt(0) & 0xff, from, to: from + 10 };
  });
}

/** Each bit's level along the line for `word`, 1 high and 0 low. */
export function signalBits(word: string): number[] {
  const bytes = signalBytes(word);
  const bits = Array<number>(SIGNAL.lead + bytes.length * (10 + SIGNAL.gap)).fill(1);
  for (const { code, from } of bytes) {
    bits[from] = 0;
    for (let b = 0; b < 8; b++) bits[from + 1 + b] = (code >> b) & 1;
    bits[from + 9] = 1;
  }
  return bits;
}

/** The x on the glass of bit `bit`'s left edge, of `bits` along the line. */
export function bitX(bit: number, bits: number): number {
  return -SIGNAL.half + (2 * SIGNAL.half * bit) / bits;
}
