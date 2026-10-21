import { useEffect, useRef } from 'react';
import { type KeyTarget, keyDelta } from './keyDelta';

/**
 * How long after the loader's fast-forward ends the home's scroll input goes on dropping what it hears, in ms. A
 * trackpad that skipped the loader keeps sending wheel events (its momentum) for about a second; without this the tail
 * of them would land on the home and carry the story part-way into the next chapter.
 */
export const SKIP_SWALLOW_MS = 400;

/**
 * The events that skip the loader: a click or tap of any kind (`pointerdown` covers mouse, pen and touch), a turn of
 * the wheel, a key and a touch. A scroll by touch is a `touchstart` first.
 */
export const SKIP_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;

/**
 * Whether the home's scroll input must drop the input it hears now: from the moment the visitor skips the loader
 * through its fast-forward and `SKIP_SWALLOW_MS` after it. `skipEndsMs` is `frame.loaderSkipEndsMs`, in the clock of
 * `performance.now()`: when the fast-forward ends, or null while no skip was asked for. A time that is not a number
 * does not swallow.
 */
export function skipSwallows(nowMs: number, skipEndsMs: number | null): boolean {
  return skipEndsMs !== null && nowMs < skipEndsMs + SKIP_SWALLOW_MS;
}

/** The keys that are only a modifier: pressing one is the start of a shortcut, not a key press of the visitor's. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta']);

/**
 * Whether the event is not the visitor asking to skip, and is left alone, neither skipping nor prevented: a wheel
 * with ctrl held (the browser's zoom), a key that is only a modifier, and a key with ctrl, meta or alt held (a shortcut:
 * Alt+Tab, Cmd+T, Ctrl+R). Shift alone is no shortcut.
 */
function ignored(e: Event): boolean {
  const k = e as Partial<KeyboardEvent>;
  if (e.type === 'wheel') return k.ctrlKey === true;
  if (e.type === 'keydown') return MODIFIER_KEYS.has(k.key ?? '') || k.ctrlKey === true || k.metaKey === true || k.altKey === true;
  return false;
}

/** Whether a key press would scroll the page: a scrolling key, not typed into a field. */
function scrollsPage(e: Event): boolean {
  const k = e as Partial<KeyboardEvent>;
  return keyDelta({ key: k.key ?? '', shiftKey: k.shiftKey ?? false, target: (k.target as KeyTarget | null | undefined) ?? null }, 1) !== null;
}

/**
 * Listens on `target` for the events that skip the loader and calls `onSkip` on the first of them, once however many
 * follow. Returns the function that stops listening.
 *
 * The input that skips must not scroll the page: it prevents the wheel and the touch (listened to with
 * `passive: false` for that) and the keys that scroll, from the first event on and for as long as it listens, as a
 * trackpad's wheel goes on for a second after the first event. It leaves a click, a key typed into a field, and every
 * other key as they are: Tab still moves the focus. It ignores, neither skipping nor preventing, a wheel with ctrl held
 * (the browser's zoom), a key that is only a modifier and a key pressed with ctrl, meta or alt (a shortcut): Alt+Tab or
 * Cmd+T must not skip the show. It listens in the capture phase, so nothing in the page can stop a skip.
 */
export function attachLoaderSkip(target: EventTarget, onSkip: () => void): () => void {
  let skipped = false;
  const onEvent = (e: Event): void => {
    if (ignored(e)) return;
    const prevents = e.type === 'wheel' || e.type === 'touchstart' || (e.type === 'keydown' && scrollsPage(e));
    if (prevents && e.cancelable) e.preventDefault();
    if (skipped) return;
    skipped = true;
    onSkip();
  };
  // passive: false on the two that may prevent the browser's scroll; the others never prevent it with a touch or a wheel.
  const options = (type: (typeof SKIP_EVENTS)[number]): AddEventListenerOptions => (type === 'wheel' || type === 'touchstart' ? { capture: true, passive: false } : { capture: true });
  for (const type of SKIP_EVENTS) target.addEventListener(type, onEvent, options(type));
  return () => {
    for (const type of SKIP_EVENTS) target.removeEventListener(type, onEvent, { capture: true });
  };
}

/**
 * While `active`, any click, tap, wheel turn or key press on the page calls `onSkip` once (`attachLoaderSkip` on
 * `window`). Becoming inactive takes the listeners off, and becoming active again starts a fresh skip. `onSkip` may
 * change from render to render without the listeners being touched.
 */
export function useLoaderSkip(active: boolean, onSkip: () => void): void {
  const latest = useRef(onSkip);
  useEffect(() => {
    latest.current = onSkip;
  });
  useEffect(() => {
    if (!active) return;
    return attachLoaderSkip(window, () => latest.current());
  }, [active]);
}
