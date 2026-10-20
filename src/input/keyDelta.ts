/** The part of a keyboard event's target that decides whether the scroll takes the key. */
export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

/** The elements that type: they keep every key, so a space is a space and Home goes to the start of the line. */
const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
/** The elements Space presses: Space on them is a click, not a scroll. */
const PRESSED_BY_SPACE = new Set(['BUTTON', 'SUMMARY']);

/**
 * What a key does to the scroll, as pixels (a number: positive goes down the story) or as a jump to the
 * start or the end; null when the scroll does not take the key.
 *
 * It does not take a key aimed at a text field, a menu or editable text (the page's own typing), and it does
 * not take Space aimed at a button or a summary (a press). Arrow keys: 0.15 of the viewport; Page Down and
 * Space: 0.9; Page Up and Shift+Space: -0.9; Home and End: `'home'` and `'end'`.
 */
export function keyDelta(e: { key: string; shiftKey: boolean; target: KeyTarget | null }, viewportH: number): number | 'home' | 'end' | null {
  const tag = e.target?.tagName?.toUpperCase();
  if (e.target?.isContentEditable || (tag !== undefined && TYPING.has(tag))) return null;

  switch (e.key) {
    case 'ArrowDown':
      return 0.15 * viewportH;
    case 'ArrowUp':
      return -0.15 * viewportH;
    case 'PageDown':
      return 0.9 * viewportH;
    case 'PageUp':
      return -0.9 * viewportH;
    case ' ':
    case 'Spacebar': // old Edge and Firefox name Space this way
      if (tag !== undefined && PRESSED_BY_SPACE.has(tag)) return null;
      return (e.shiftKey ? -0.9 : 0.9) * viewportH;
    case 'Home':
      return 'home';
    case 'End':
      return 'end';
    default:
      return null;
  }
}
