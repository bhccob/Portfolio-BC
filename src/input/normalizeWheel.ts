/** What one line of a wheel that scrolls by lines (deltaMode 1) is worth, in pixels. */
export const LINE_PX = 16;

/** The most one wheel event may move the scroll, in pixels: a page-sized event from a driver or a script must not fling the story. */
export const MAX_EVENT_PX = 240;

export type WheelDevice = 'mouse' | 'trackpad';

/**
 * A wheel event as pixels, whatever the device and the browser report. Lines (deltaMode 1) are `LINE_PX`
 * each and pages (deltaMode 2) are a viewport high; the result is clamped to `MAX_EVENT_PX` either way.
 *
 * `device` is a guess from the event alone: a wheel that reports lines or pages, or a whole 50 px or more
 * in pixel mode (a notch is 100 or 120), is a mouse; the small, often fractional steps of a trackpad are not.
 * A trackpad gesture is thirty events of a few pixels and a mouse notch is one of about a hundred, which
 * come to the same distance, so the scroll needs no other tuning for the two.
 */
export function normalizeWheel(e: { deltaY: number; deltaMode: number }, viewportH: number): { px: number; device: WheelDevice } {
  const raw = Number.isFinite(e.deltaY) ? e.deltaY : 0;
  let px = raw;
  if (e.deltaMode === 1) px = raw * LINE_PX;
  else if (e.deltaMode === 2) px = raw * viewportH;

  const device: WheelDevice = e.deltaMode !== 0 || (Math.abs(raw) >= 50 && Number.isInteger(raw)) ? 'mouse' : 'trackpad';
  // `+ 0` turns a negative zero into a zero.
  return { px: Math.max(-MAX_EVENT_PX, Math.min(MAX_EVENT_PX, px)) + 0, device };
}
