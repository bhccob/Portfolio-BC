/**
 * Where Bob's fact stands beside the light in the light dive (src/ui/LightFacts.tsx), as the mock-up places it
 * (.superpowers/light-dive-mockup/mockup.js `placeFacts`): pure, in CSS px, so the tests read the very numbers the
 * labels take on each frame.
 */

/** A box on the screen, CSS px: its top-left corner and its size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the label's words stand: the point their alignment hangs on (their left, right or middle, and their top line). */
export interface WordsPlace {
  x: number;
  y: number;
  align: 'left' | 'right' | 'center';
}

/** The label's place: its fine gold line, and its words. */
export interface FactPlace {
  line: Rect;
  words: WordsPlace;
}

/**
 * The label's measures, in px of the mock-up's frames: `off` from the light to the line's start, the line's length,
 * the gap to the words, and on a phone `aside`, the line's step to the side, off the tail that streams down under the
 * light. A desk's frame is 1440 wide, a phone's 585; each is scaled by the screen's width.
 */
const DESK = { w: 1440, off: 65, len: 72, gap: 14 } as const;
const PHONE = { w: 585, off: 100, len: 88, gap: 14, aside: 24 } as const;

/** How far the words keep from the screen's edges on a phone, CSS px. */
const MARGIN = 16;

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/**
 * The fact's label beside the light at `light` (CSS px) on a screen of `viewport` (CSS px), where the light's move
 * takes it to `side` (-1 left, 1 right): the label rides on the other side.
 * - **Desk** (`w / h` ≥ 1): level with the light, the line from its side and the words past it, left-aligned on the right
 *   of the light, right-aligned on its left.
 * - **Phone** (`w / h` < 1): the line hangs below the light, stepped `aside` away from the move, and the words stand
 *   centred under it, past the tail's end; held inside the screen's 16 px margins by their width, `wordsWidth` (CSS px,
 *   measured; 0, the default, holds only their middle).
 */
export function placeFact(light: { x: number; y: number }, side: -1 | 1, viewport: { w: number; h: number }, wordsWidth = 0): FactPlace {
  const away = -side;
  if (viewport.w >= viewport.h) {
    const s = viewport.w / DESK.w;
    const off = DESK.off * s;
    const len = DESK.len * s;
    const gap = DESK.gap * s;
    const line = { x: away > 0 ? light.x + off : light.x - off - len, y: light.y - 0.5, w: len, h: 1 };
    const words: WordsPlace = away > 0 ? { x: light.x + off + len + gap, y: light.y, align: 'left' } : { x: light.x - off - len - gap, y: light.y, align: 'right' };
    return { line, words };
  }
  const s = viewport.w / PHONE.w;
  const x = light.x + away * PHONE.aside * s;
  const top = light.y + PHONE.off * s;
  const len = PHONE.len * s;
  const half = Math.max(0, wordsWidth) / 2;
  const centre = clamp(x, MARGIN + half, Math.max(MARGIN + half, viewport.w - MARGIN - half));
  return { line: { x: x - 0.5, y: top, w: 1, h: len }, words: { x: centre, y: top + len + PHONE.gap * s, align: 'center' } };
}
