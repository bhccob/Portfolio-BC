/**
 * A one-shot event that remembers it has fired: listeners added after the
 * fact run immediately. Used to sequence the loader, hero intro and physics.
 */
export class Signal<T = void> {
  private value: T | undefined;
  private fired = false;
  private readonly listeners: Array<(value: T) => void> = [];

  get hasFired(): boolean {
    return this.fired;
  }

  fire(value: T): void {
    if (this.fired) return;
    this.fired = true;
    this.value = value;
    this.listeners.splice(0).forEach((listener) => listener(value));
  }

  then(listener: (value: T) => void): void {
    if (this.fired) listener(this.value as T);
    else this.listeners.push(listener);
  }

  /** Resolves when fired, or after `timeout` ms with `undefined`. */
  wait(timeout = Infinity): Promise<T | undefined> {
    return new Promise((resolve) => {
      this.then(resolve);
      if (Number.isFinite(timeout)) window.setTimeout(() => resolve(undefined), timeout);
    });
  }
}

export const signals = {
  /** The boot screen has started leaving (or never showed). */
  loaderDone: new Signal(),
  /** Hero letters have finished their intro and are in their final place. */
  heroSettled: new Signal(),
  /** physics.wasm loaded (true) or failed (false). */
  physicsReady: new Signal<boolean>()
};
