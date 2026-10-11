import type { Component } from './Component';

/** Registers components and mounts them, isolating failures so one broken feature never takes down the rest. */
export class App {
  private readonly components: Component[] = [];

  use(component: Component | null | undefined): this {
    if (component) this.components.push(component);
    return this;
  }

  async start(): Promise<void> {
    await Promise.all(
      this.components.map(async (component) => {
        try {
          await component.mount();
        } catch (error) {
          console.error(`[portfolio] ${component.constructor.name} failed to mount`, error);
        }
      })
    );
  }
}
