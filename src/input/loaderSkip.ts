import { useEffect, useRef } from 'react';
import { type KeyTarget, keyDelta } from './keyDelta';

/**
 * How long after the loader's fast-forward ends the home's scroll input goes on dropping what it hears at least, in
 * ms; after it the swallowing rolls on while the input keeps coming (SKIP_QUIET_MS, SKIP_SWALLOW_CAP_MS). A trackpad
 * that skipped the loader keeps sending wheel events (its momentum) for one to three seconds; without this the tail of
 * them would land on the home and carry the story part-way into the next chapter.
 */
export const SKIP_SWALLOW_MS = 400;

/**
 * The events that skip the loader: a click or tap of any kind (`pointerdown` covers mouse, pen and touch), a turn of
 * the wheel, a key and a touch. A scroll by touch is a `touchstart` first, then its `touchmove`s; a pinch's moves
 * (two fingers or more) are no skip (`attachLoaderSkip`).
 */
export const SKIP_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart', 'touchmove'] as const;

/**
 * How long the input must have been quiet before a skip's swallowing ends, once its first SKIP_SWALLOW_MS are over,
 * in ms. A trackpad's momentum sends its wheel events a frame or a few apart, slower as it dies away, but
 * never this far apart; a visitor who scrolls again on purpose has let go of the pad first.
 */
export const SKIP_QUIET_MS = 200;

/**
 * The longest a skip's swallowing lasts after the skip landed, in ms, however long the input keeps coming:
 * a momentum tail runs 1.5 to 3 s, and a visitor scrolling without a pause after that means it.
 */
export const SKIP_SWALLOW_CAP_MS = 3_000;

/**
 * Whether the home's scroll input must drop the input it hears now. `skipEndsMs` is `frame.loaderSkipEndsMs`, in the
 * clock of `performance.now()`: when the skipped loader landed, or null while no skip has. It swallows:
 * - from the moment the skip is asked for, through the fast-forward, until SKIP_SWALLOW_MS after the landing;
 * - and after that, rolling: while the input has not been quiet for SKIP_QUIET_MS since the last input it
 *   swallowed (`lastSwallowedMs`, null for none), so a momentum tail that keeps coming is swallowed whole;
 * - but never from SKIP_SWALLOW_CAP_MS after the landing on.
 *
 * Pure: the caller keeps `lastSwallowedMs` (`skipSwallower`). A time that is not a number does not swallow.
 */
export function skipSwallows(nowMs: number, skipEndsMs: number | null, lastSwallowedMs: number | null = null): boolean {
  if (skipEndsMs === null) return false;
  if (nowMs < skipEndsMs + SKIP_SWALLOW_MS) return true;
  if (!(nowMs < skipEndsMs + SKIP_SWALLOW_CAP_MS)) return false;
  return lastSwallowedMs !== null && nowMs - lastSwallowedMs < SKIP_QUIET_MS;
}

/**
 * The home scroll's swallow predicate (`VirtualScrollOptions.swallow`): `skipSwallows` at `now()` for the landing
 * `skipEndsMs()` says, remembering the last time it swallowed, so each input it swallows holds the swallowing open
 * for SKIP_QUIET_MS more. A new landing starts with nothing remembered. The scroll asks it at every input
 * it takes (and once more as it ends a glide, which a swallow stops); each answer of true counts as an input
 * swallowed.
 */
export function skipSwallower(now: () => number, skipEndsMs: () => number | null): () => boolean {
  let landing: number | null = null;
  let last: number | null = null;
  return () => {
    const ends = skipEndsMs();
    if (ends !== landing) {
      landing = ends;
      last = null;
    }
    const at = now();
    const swallows = skipSwallows(at, ends, last);
    if (swallows) last = at;
    return swallows;
  };
}

/** The keys that are only a modifier: pressing one is the start of a shortcut, not a key press of the visitor's. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta']);

/** How many fingers a touch event has on the screen; one where the event does not say. */
function fingers(e: Event): number {
  return (e as Partial<TouchEvent>).touches?.length ?? 1;
}

/**
 * Whether the event is not the visitor asking to skip, and is left alone, neither skipping nor prevented: a wheel
 * with ctrl held (the browser's zoom), a key that is only a modifier, a key with ctrl, meta or alt held (a shortcut:
 * Alt+Tab, Cmd+T, Ctrl+R), and a move of two fingers or more (a pinch, the browser's zoom). Shift alone is no shortcut.
 */
function ignored(e: Event): boolean {
  const k = e as Partial<KeyboardEvent>;
  if (e.type === 'wheel') return k.ctrlKey === true;
  if (e.type === 'keydown') return MODIFIER_KEYS.has(k.key ?? '') || k.ctrlKey === true || k.metaKey === true || k.altKey === true;
  if (e.type === 'touchmove') return fingers(e) > 1;
  return false;
}

/** Whether a key press would scroll the page: a scrolling key, not typed into a field. */
function scrollsPage(e: Event): boolean {
  const k = e as Partial<KeyboardEvent>;
  return keyDelta({ key: k.key ?? '', shiftKey: k.shiftKey ?? false, target: (k.target as KeyTarget | null | undefined) ?? null }, 1) !== null;
}

/**
 * Whether the skip prevents the event, as it would scroll the page: the wheel, a scrolling key and a one-finger move
 * (a pinch is `ignored` before it gets here). A `touchstart` is never prevented: preventing it would also take the tap's
 * click (a link in the header, the 3D switch) and the start of a pinch; the moves that follow it are what scroll.
 */
function prevents(e: Event): boolean {
  if (e.type === 'wheel' || e.type === 'touchmove') return true;
  return e.type === 'keydown' && scrollsPage(e);
}

/**
 * Listens on `target` for the events that skip the loader and calls `onSkip` on the first of them, once however many
 * follow. Returns the function that stops listening.
 *
 * The input that skips must not scroll the page: it prevents the wheel and a one-finger move of a touch (listened to
 * with `passive: false` for that) and the keys that scroll, from the first event on and for as long as it listens, as a
 * trackpad's wheel goes on for a second after the first event. It leaves a click, the touch's start (so a tap still
 * clicks and a pinch still starts), a key typed into a field, and every other key as they are: Tab still moves the
 * focus. It ignores, neither skipping nor preventing, a wheel with ctrl held (the browser's zoom), a move of two fingers
 * or more (a pinch), a key that is only a modifier and a key pressed with ctrl, meta or alt (a shortcut): Alt+Tab or
 * Cmd+T must not skip the show. It listens in the capture phase, so nothing in the page can stop a skip.
 */
export function attachLoaderSkip(target: EventTarget, onSkip: () => void): () => void {
  let skipped = false;
  const onEvent = (e: Event): void => {
    if (ignored(e)) return;
    if (prevents(e) && e.cancelable) e.preventDefault();
    if (skipped) return;
    skipped = true;
    onSkip();
  };
  // passive: false on the two that may prevent the browser's scroll; the touch's start is passive, as it is never prevented.
  const options = (type: (typeof SKIP_EVENTS)[number]): AddEventListenerOptions =>
    type === 'wheel' || type === 'touchmove' ? { capture: true, passive: false } : type === 'touchstart' ? { capture: true, passive: true } : { capture: true };
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
