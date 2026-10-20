/**
 * A list of handlers that can be added to and taken from at any time, even
 * while it is being called: `add` answers the handler's own unsubscribe, and
 * a call goes to the handlers there were when it began (the list is copied on
 * write, so the call itself allocates nothing). The same function added twice
 * is two entries, each unsubscribed on its own.
 */
export class Handlers<H extends (...args: never[]) => unknown> {
  private entries: readonly { handler: H }[] = [];

  /** How many handlers are listed. */
  get size(): number {
    return this.entries.length;
  }

  /** Adds `handler`; the answer takes it off again (a second call does nothing). */
  add(handler: H): () => void {
    const entry = { handler };
    this.entries = [...this.entries, entry];
    return () => {
      this.entries = this.entries.filter((listed) => listed !== entry);
    };
  }

  /** Calls `call` with each handler listed now, in the order they were added. */
  each(call: (handler: H) => void): void {
    for (const { handler } of this.entries) call(handler);
  }

  /** Takes every handler off. */
  clear(): void {
    this.entries = [];
  }
}
