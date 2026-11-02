import { describe, expect, it } from 'vitest';
import { bitX, SIGNAL, signalBits, signalBytes } from '~/engine/bob/signalFrames';

// Round 17 (Bob: "B · Signal"): the line's pulses are the real UART frames of the name's bytes, idle high, each a start
// bit, its eight bits lowest first and a stop bit.

describe("the signal's frames", () => {
  it('lays the line out as the spec says', () => {
    expect(SIGNAL).toEqual({ lead: 6, gap: 3, half: 3.6, high: 0.2, label: 'CH0 · UART' });
  });

  it("frames a byte as UART does: idle high, a start bit, its code lowest bit first, a stop bit", () => {
    // 0x42 is 0100 0010: lowest first 0,1,0,0,0,0,1,0.
    expect(signalBits('B')).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1]);
  });

  it("frames the whole name: six idle bits, then thirteen bits a byte", () => {
    expect(signalBits('BOB CHUNG')).toHaveLength(6 + 9 * 13);
  });

  it('reads back the bytes it framed, each where its frame is', () => {
    const bits = signalBits('BOB CHUNG');
    const bytes = signalBytes('BOB CHUNG');
    expect(bytes.map((b) => b.code)).toEqual([0x42, 0x4f, 0x42, 0x20, 0x43, 0x48, 0x55, 0x4e, 0x47]);
    expect(bytes.map((b) => b.char).join('')).toBe('BOB CHUNG');
    expect([bytes[0]!.from, bytes[0]!.to, bytes[1]!.from]).toEqual([6, 16, 19]);
    for (const b of bytes) {
      expect(b.to - b.from).toBe(10);
      const frame = bits.slice(b.from, b.to);
      expect(frame[0]).toBe(0);
      expect(frame[9]).toBe(1);
      expect(frame.slice(1, 9).reduce((code, bit, k) => code | (bit << k), 0)).toBe(b.code);
    }
  });

  it('puts the bits along the line from one end to the other', () => {
    expect(bitX(0, 123)).toBe(-3.6);
    expect(bitX(123, 123)).toBe(3.6);
    expect(bitX(61.5, 123)).toBeCloseTo(0, 12);
  });
});
