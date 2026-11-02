/**
 * The signal's read-out (round 17, spec 2026-11-01-bob-signal-loader-design.md; Bob: "B · Signal"): what an analyzer
 * shows under a wire, in the page over the canvas (src/ui/SignalReadout.tsx, `aria-hidden`). The channel's label over
 * the line's left end; under each frame, once the cursor has read it, a box with its letter and its code (the space as
 * `␣`); and under the middle the name as far as it has been read, whole at its last letter. It all goes over the first
 * half of the curl, and with the line's light.
 *
 * `readoutLayout` is pure: where each part stands (CSS px) and how much it shows, from the read, the curl, the light and
 * where the line's low level falls on the screen. `writeReadout` writes a layout into the page, only by transform,
 * opacity and text.
 */
import { bitX, SIGNAL, signalBits, signalBytes } from '~/engine/bob/signalFrames';

/** A frame's box under the line: its letter and code, its middle and width on the screen, how far below the line, how much it shows, and whether its code fits. */
export interface ReadoutBox {
  char: string;
  code: string;
  x: number;
  width: number;
  y: number;
  opacity: number;
  showCode: boolean;
}

export interface ReadoutLayout {
  label: { x: number; y: number; opacity: number };
  boxes: ReadoutBox[];
  name: { text: string; x: number; y: number; opacity: number };
}

/** Where the parts stand off the line's low level, px: the label above, the boxes and the name below; how far the cursor runs past a frame while its box comes in; the narrowest frame its code fits. */
const READOUT = { labelAbove: 64, boxBelow: 26, nameBelow: 70, fadeIn: 40, codeFits: 64 } as const;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/**
 * The read-out for `word` read to `decode` and curled to `curl` (each 0..1) at the line's `level` of light, `toScreen`
 * mapping a world x on the line's low level to the screen (CSS px).
 */
export function readoutLayout(word: string, decode: number, curl: number, level: number, toScreen: (x: number) => { x: number; y: number }): ReadoutLayout {
  const bits = signalBits(word).length;
  const shown = clamp01(level) * (1 - smooth(curl * 2));
  const sweep = toScreen(bitX(clamp01(decode) * bits, bits)).x;
  let text = '';
  const boxes = signalBytes(word).map(({ char, code, from, to }) => {
    const a = toScreen(bitX(from, bits));
    const b = toScreen(bitX(to, bits));
    const read = sweep >= b.x;
    if (read) text += char;
    return {
      char: char === ' ' ? '␣' : char,
      code: code.toString(16).toUpperCase().padStart(2, '0'),
      x: (a.x + b.x) / 2,
      width: b.x - a.x,
      y: (a.y + b.y) / 2 + READOUT.boxBelow,
      opacity: read ? shown * clamp01((sweep - b.x) / READOUT.fadeIn + (decode >= 1 ? 1 : 0)) : 0,
      showCode: b.x - a.x >= READOUT.codeFits
    };
  });
  const left = toScreen(-SIGNAL.half);
  const middle = toScreen(0);
  return {
    label: { x: left.x, y: left.y - READOUT.labelAbove, opacity: shown },
    boxes,
    name: { text, x: middle.x, y: middle.y + READOUT.nameBelow, opacity: text ? shown : 0 }
  };
}

/** Writes `layout` into the page's read-out (src/ui/SignalReadout.tsx), or hides it for null or a layout that shows nothing. */
export function writeReadout(layout: ReadoutLayout | null, doc: Document): void {
  const root = doc.querySelector<HTMLElement>('.signal-readout');
  if (!root) return;
  const any = layout !== null && (layout.label.opacity > 0 || layout.name.opacity > 0 || layout.boxes.some((b) => b.opacity > 0));
  if (!any) {
    if (!root.hidden) root.hidden = true;
    return;
  }
  root.hidden = false;
  const label = root.querySelector<HTMLElement>('.signal-label');
  if (label) {
    label.style.transform = `translate(${layout.label.x}px, ${layout.label.y}px)`;
    label.style.opacity = String(layout.label.opacity);
  }
  root.querySelectorAll<HTMLElement>('.signal-byte').forEach((el, i) => {
    const box = layout.boxes[i];
    if (!box) return;
    el.style.transform = `translate(${box.x - box.width / 2 + 2}px, ${box.y}px)`;
    el.style.width = `${Math.max(0, box.width - 4)}px`;
    el.style.opacity = String(box.opacity);
    el.dataset.code = box.showCode ? 'shown' : 'hidden';
  });
  const name = root.querySelector<HTMLElement>('.signal-name');
  if (name) {
    if (name.textContent !== layout.name.text) name.textContent = layout.name.text;
    name.style.transform = `translate(${layout.name.x}px, ${layout.name.y}px) translateX(-50%)`;
    name.style.opacity = String(layout.name.opacity);
  }
}
