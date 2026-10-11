/**
 * Web Storage that never throws: private windows and blocked site data make
 * `localStorage` unavailable, and the site must keep working regardless.
 */
export class SafeStorage {
  constructor(private readonly resolve: () => Storage) {}

  static local(): SafeStorage {
    return new SafeStorage(() => window.localStorage);
  }

  static session(): SafeStorage {
    return new SafeStorage(() => window.sessionStorage);
  }

  get(key: string, fallback: string | null = null): string | null {
    try {
      return this.resolve().getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  set(key: string, value: string): void {
    try {
      this.resolve().setItem(key, value);
    } catch {
      /* storage unavailable: ignore */
    }
  }

  getNumber(key: string, fallback = 0): number {
    const value = Number(this.get(key));
    return Number.isFinite(value) && this.get(key) !== null ? value : fallback;
  }
}
