import { Component } from '../core/Component';
import { SafeStorage } from '../core/SafeStorage';
import { signals } from '../core/Signal';
import { $ } from '../core/dom';
import { FlapBoard, type FlapRow } from './FlapBoard';

/**
 * The boot screen: the site's name flips onto a single row of tiles while a
 * percentage counts up, then the board folds shut onto its split line.
 * Progress follows real work (fonts, page assets and the physics module), but
 * it never shows for less than MIN_MS (so the sequence reads) or longer than
 * MAX_MS (so nobody waits on a slow asset). It plays once per browser
 * session; any click or key skips it.
 */
export class LoadingScreen extends Component {
  private static readonly MIN_MS = 1700;
  private static readonly MAX_MS = 3200;
  private static readonly STORAGE_KEY = 'bob-booted';

  private readonly root = document.documentElement;
  private readonly element = $('[data-loader]');
  private readonly session = SafeStorage.session();
  private pct: FlapRow | null = null;
  private started = 0;
  private target = 0;
  private shown = 0;
  private lastPct = -1;
  private lastFlip = 0;
  private finished = false;
  private frame = 0;

  mount(): void {
    if (!this.element || !this.root.classList.contains('is-booting')) {
      signals.loaderDone.fire();
      return;
    }

    const name = $('[data-loader-name]', this.element);
    const pct = $('[data-loader-pct]', this.element);
    if (name) {
      const row = FlapBoard.row(name);
      row.blank();
      window.setTimeout(() => row.show(row.text, { spins: 5, jitter: 4, stagger: 60 }), 120);
    }
    if (pct) this.pct = FlapBoard.row(pct);

    this.started = performance.now();
    const tasks = [this.fontsReady(), this.pageLoaded(), this.physicsReady()];
    let done = 0;
    tasks.forEach((task) =>
      task.then(() => {
        done += 1;
        this.target = done / tasks.length;
      })
    );

    Promise.all(tasks).then(() => this.finishAfterMinimum());
    window.setTimeout(() => this.finish(), LoadingScreen.MAX_MS);
    this.listen(window, 'pointerdown', () => this.finish(), { once: true });
    this.listen(window, 'keydown', () => this.finish(), { once: true });
    this.tick();
  }

  private fontsReady(): Promise<unknown> {
    return document.fonts?.ready ?? Promise.resolve();
  }

  private pageLoaded(): Promise<void> {
    if (document.readyState === 'complete') return Promise.resolve();
    return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
  }

  private physicsReady(): Promise<unknown> {
    // Only the home page has the playground; elsewhere there is nothing to wait for.
    if (!$('[data-play]')) return Promise.resolve();
    return signals.physicsReady.wait(LoadingScreen.MAX_MS);
  }

  /** Eases the displayed percentage toward the real progress, with a time floor so it keeps moving. */
  private tick = (): void => {
    const elapsed = performance.now() - this.started;
    const timeFloor = Math.min(elapsed / LoadingScreen.MIN_MS, 1) * 0.9;
    const goal = this.finished ? 1 : Math.min(Math.max(this.target, timeFloor) * 0.98, 0.98);
    this.shown += (goal - this.shown) * 0.1;
    this.render(this.shown);
    if (this.shown < 0.999) this.frame = requestAnimationFrame(this.tick);
  };

  private render(progress: number, force = false): void {
    if (!this.element) return;
    this.element.style.setProperty('--p', progress.toFixed(3));
    const value = Math.round(progress * 100);
    const now = performance.now();
    // Tiles need time to flip, so the counter updates in steps rather than every frame.
    if (this.pct && value !== this.lastPct && (force || now - this.lastFlip > 140)) {
      this.lastPct = value;
      this.lastFlip = now;
      this.pct.show(`${String(value).padStart(3, ' ')}%`, { spins: 0, jitter: 0, stagger: 0 });
    }
  }

  private finishAfterMinimum(): void {
    const remaining = LoadingScreen.MIN_MS - (performance.now() - this.started);
    window.setTimeout(() => this.finish(), Math.max(remaining, 0));
  }

  private finish(): void {
    if (this.finished || !this.element) return;
    this.finished = true;
    cancelAnimationFrame(this.frame);
    this.shown = 1;
    this.render(1, true);
    this.session.set(LoadingScreen.STORAGE_KEY, '1');

    window.setTimeout(() => {
      this.element!.classList.add('is-leaving');
      window.setTimeout(() => signals.loaderDone.fire(), 380);
      window.setTimeout(() => {
        this.root.classList.remove('is-booting');
        this.element!.remove();
      }, 950);
    }, 320);
  }
}
