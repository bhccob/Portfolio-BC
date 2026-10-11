/**
 * Base class for every interactive feature on the site. Subclasses implement
 * `mount()`; listeners registered through `listen()` are removed on `destroy()`.
 */
export abstract class Component {
  private readonly cleanups: Array<() => void> = [];

  abstract mount(): void | Promise<void>;

  destroy(): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
  }

  protected listen<E extends Event = Event>(
    target: EventTarget,
    type: string,
    handler: (event: E) => void,
    options?: AddEventListenerOptions
  ): void {
    const listener = handler as EventListener;
    target.addEventListener(type, listener, options);
    this.cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  protected onCleanup(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }
}
