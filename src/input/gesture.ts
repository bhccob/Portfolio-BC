/** The quiet, in ms, that ends a gesture: a wheel that has not turned for this long starts a new one when it does. */
export const GESTURE_GAP_MS = 250;

/**
 * Groups the events of a wheel into gestures. One trackpad swipe is dozens of events, and the momentum the
 * trackpad adds after the fingers lift is dozens more; the scroll with reduced motion moves one stop per
 * gesture, so it asks for each event whether it starts one. Every event extends the gesture: the gap is
 * counted from the event before, not from the start.
 */
export class GestureGroup {
  private last = Number.NEGATIVE_INFINITY;

  constructor(private readonly gapMs: number = GESTURE_GAP_MS) {}

  /** True when the event at `timeMs` begins a gesture: it is the first, or `gapMs` or more of quiet came before it. */
  begins(timeMs: number): boolean {
    // A clock that went backwards (a time origin reset) is not the same gesture either.
    const begins = timeMs - this.last >= this.gapMs || timeMs < this.last;
    this.last = timeMs;
    return begins;
  }

  /** Forgets the gesture in progress. */
  reset(): void {
    this.last = Number.NEGATIVE_INFINITY;
  }
}
