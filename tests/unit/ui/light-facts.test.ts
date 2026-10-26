import { afterEach, describe, expect, it } from 'vitest';
import { placeFact } from '~/ui/factPlace';
import { registerLightFact, showLightFacts } from '~/ui/LightFacts';

describe('placeFact on a desk: level with the light, on the side away from its move', () => {
  const viewport = { w: 1440, h: 900 };

  it("puts the words on the side away from the move (0.40 / 0.60 at 1440x900, as the mock-up's 81 and 121)", () => {
    // Way frame 81: fact 01, the light moved left to 0.40 of the width; the label rides on its right.
    const right = placeFact({ x: 0.4 * 1440, y: 450 }, -1, viewport);
    expect(right.line).toEqual({ x: 576 + 65, y: 449.5, w: 72, h: 1 });
    expect(right.words).toEqual({ x: 576 + 65 + 72 + 14, y: 450, align: 'left' });
    // Way frame 121: fact 02, moved right to 0.60; on its left.
    const left = placeFact({ x: 0.6 * 1440, y: 450 }, 1, viewport);
    expect(left.line).toEqual({ x: 864 - 65 - 72, y: 449.5, w: 72, h: 1 });
    expect(left.words).toEqual({ x: 864 - 65 - 72 - 14, y: 450, align: 'right' });
  });

  it('keeps the label on the light at a changed aspect: 1366x657, then 844x390, the frame px scaled by the width', () => {
    for (const [w, h] of [
      [1366, 657],
      [844, 390]
    ] as const) {
      const s = w / 1440;
      const light = { x: 0.6 * w, y: 0.45 * h };
      const { line, words } = placeFact(light, -1, { w, h });
      expect(line.x).toBeCloseTo(light.x + 65 * s, 9);
      expect(line.w).toBeCloseTo(72 * s, 9);
      expect(line.y + line.h / 2).toBeCloseTo(light.y, 9);
      expect(words.x).toBeCloseTo(light.x + (65 + 72 + 14) * s, 9);
      expect(words.y).toBe(light.y);
    }
  });
});

describe('placeFact on a phone: below the light, the line stepped aside off the tail', () => {
  const viewport = { w: 390, h: 844 };
  const s = 390 / 585;

  it("steps the line aside and centres the words below the tail's end at 390x844", () => {
    const light = { x: 0.42 * 390, y: 0.3 * 844 };
    // The light moved left: the line steps right of it, away from the move.
    const { line, words } = placeFact(light, -1, viewport);
    expect(line.x + line.w / 2).toBeCloseTo(light.x + 24 * s, 9);
    expect(line.w).toBe(1);
    expect(line.y).toBeCloseTo(light.y + 100 * s, 9);
    expect(line.h).toBeCloseTo(88 * s, 9);
    expect(words.align).toBe('center');
    expect(words.x).toBeCloseTo(light.x + 24 * s, 9);
    expect(words.y).toBeCloseTo(light.y + (100 + 88 + 14) * s, 9);
    // Moved right: the line steps left.
    expect(placeFact(light, 1, viewport).words.x).toBeCloseTo(light.x - 24 * s, 9);
  });

  it("holds the words inside the 16 px margins, by their measured width: a wide label's middle moves in from the edge", () => {
    const light = { x: 0.42 * 390, y: 0.3 * 844 };
    const narrow = placeFact(light, -1, viewport, 200);
    expect(narrow.words.x).toBeCloseTo(light.x + 24 * s, 9);
    const wide = placeFact(light, -1, viewport, 340);
    expect(wide.words.x - 170).toBeCloseTo(16, 9);
    const edge = placeFact({ x: 380, y: 300 }, -1, viewport, 200);
    expect(edge.words.x + 100).toBeCloseTo(390 - 16, 9);
  });
});

/** A stand-in for an element: its style (properties and the CSSOM's custom properties) and attributes. */
function fakeEl() {
  const props = new Map<string, string>();
  const attributes = new Map<string, string>();
  return {
    props,
    attributes,
    offsetWidth: 0,
    style: {
      opacity: '',
      transform: '',
      width: '',
      height: '',
      setProperty: (k: string, v: string) => props.set(k, v)
    },
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    removeAttribute: (k: string) => attributes.delete(k)
  };
}

describe('showLightFacts: one fact at a time, beside the light', () => {
  const size = { width: 1440, height: 900 };
  let releases: (() => void)[] = [];
  afterEach(() => {
    showLightFacts(null, size);
    for (const r of releases) r();
    releases = [];
  });

  function facts() {
    return [0, 1, 2, 3, 4].map((i) => {
      const parts = { root: fakeEl(), line: fakeEl(), words: fakeEl() };
      releases.push(registerLightFact(i, parts as unknown as Parameters<typeof registerLightFact>[1]));
      return parts;
    });
  }

  it("shows the fact at its opacity and the light's glow, the others at 0, its line and words where placeFact says", () => {
    const els = facts();
    // The light at 0.60 of the width, the middle of the height (NDC 0.2, 0), moved right: the label on its left.
    showLightFacts({ index: 1, side: 1, opacity: 0.5, glow: 0.8, light: { x: 0.2, y: 0 } }, size);
    expect(els[1]!.root.style.opacity).toBe('0.5');
    expect(els[1]!.root.props.get('--glow')).toBe('0.800');
    for (const i of [0, 2, 3, 4]) expect(els[i]!.root.style.opacity).toBe('0');
    const at = placeFact({ x: 864, y: 450 }, 1, { w: 1440, h: 900 });
    expect(els[1]!.line.style.transform).toBe(`translate3d(${at.line.x.toFixed(1)}px, ${at.line.y.toFixed(1)}px, 0)`);
    expect(els[1]!.words.style.transform).toBe(`translate3d(${at.words.x.toFixed(1)}px, ${at.words.y.toFixed(1)}px, 0)`);
    expect(els[1]!.words.attributes.get('data-align')).toBe('right');
  });

  it('hides them all for null, and for a frame with no fact', () => {
    const els = facts();
    showLightFacts({ index: 3, side: 1, opacity: 1, glow: 1, light: { x: 0, y: 0 } }, size);
    expect(els[3]!.root.style.opacity).toBe('1');
    showLightFacts({ index: null, side: 1, opacity: 0, glow: 1, light: { x: 0, y: 0 } }, size);
    expect(els[3]!.root.style.opacity).toBe('0');
    showLightFacts({ index: 3, side: 1, opacity: 1, glow: 1, light: { x: 0, y: 0 } }, size);
    showLightFacts(null, size);
    for (const el of els) expect(el.root.style.opacity).toBe('0');
  });
});
