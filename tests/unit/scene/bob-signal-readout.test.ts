import { describe, expect, it } from 'vitest';
import { bitX, signalBits, signalBytes } from '~/engine/bob/signalFrames';
import { readoutLayout, writeReadout } from '~/scene/bob/signalReadout';

// Round 17 (Bob: "B · Signal"): under the line, each letter and its code once the cursor has read its frame, the name
// building up as it is read; all of it gone as the line curls.

const WORD = 'BOB CHUNG';
const BITS = signalBits(WORD).length;
/** A laptop: the line's ±3.6 m over 80…1360 px, its low level at 480. */
const desk = (x: number) => ({ x: 720 + (x / 3.6) * 640, y: 480 });
/** A phone: the line over 20…370 px. */
const phone = (x: number) => ({ x: 195 + (x / 3.6) * 175, y: 300 });

describe("the signal's read-out", () => {
  it('shows nothing before the cursor has read a frame', () => {
    const layout = readoutLayout(WORD, 0, 0, 1, desk);
    expect(layout.boxes.every((b) => b.opacity === 0)).toBe(true);
    expect(layout.name.opacity).toBe(0);
    expect(layout.label.opacity).toBe(1);
  });

  it('shows each letter and its code under its frame once read', () => {
    const layout = readoutLayout(WORD, 1, 0, 1, desk);
    expect(layout.boxes.map((b) => b.char).join(' ')).toBe('B O B ␣ C H U N G');
    expect(layout.boxes.map((b) => b.code)).toEqual(['42', '4F', '42', '20', '43', '48', '55', '4E', '47']);
    signalBytes(WORD).forEach((byte, i) => {
      const box = layout.boxes[i]!;
      expect(box.opacity).toBe(1);
      expect(box.x).toBeCloseTo((desk(bitX(byte.from, BITS)).x + desk(bitX(byte.to, BITS)).x) / 2, 9);
      expect(box.y).toBeGreaterThan(480);
      expect(box.showCode).toBe(true);
    });
  });

  it('builds the name up as it is read, whole at the last letter', () => {
    expect(readoutLayout(WORD, 0.9, 0, 1, desk).name).toMatchObject({ text: 'BOB CHUN', opacity: 1 });
    expect(readoutLayout(WORD, 1, 0, 1, desk).name).toMatchObject({ text: 'BOB CHUNG', opacity: 1 });
    expect(readoutLayout(WORD, 1, 0, 1, desk).name.x).toBeCloseTo(720, 9);
  });

  it('reads half the frames at half the line', () => {
    const layout = readoutLayout(WORD, 0.5, 0, 1, desk);
    const read = layout.boxes.filter((b) => b.opacity > 0).map((b) => b.char);
    expect(read).toEqual(['B', 'O', 'B', '␣']);
  });

  it('goes as the line curls, and with no light', () => {
    for (const layout of [readoutLayout(WORD, 1, 0.5, 1, desk), readoutLayout(WORD, 1, 0, 0, desk)]) {
      expect(layout.label.opacity).toBe(0);
      expect(layout.name.opacity).toBe(0);
      expect(layout.boxes.every((b) => b.opacity === 0)).toBe(true);
    }
  });

  it('keeps a phone’s boxes inside the screen, the code left out where it does not fit', () => {
    const layout = readoutLayout(WORD, 1, 0, 1, phone);
    for (const box of layout.boxes) {
      expect(box.showCode).toBe(false);
      expect(box.x - box.width / 2).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width / 2).toBeLessThanOrEqual(390);
    }
  });

  it('hides its root when there is nothing to show', () => {
    const root = { hidden: false } as unknown as HTMLElement;
    const doc = { querySelector: () => root } as unknown as Document;
    writeReadout(null, doc);
    expect(root.hidden).toBe(true);
  });
});
