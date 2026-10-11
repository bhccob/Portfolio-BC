import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { signals } from '../core/Signal';
import { $, $$ } from '../core/dom';

/** Characters a tile can show while it spins toward its target. */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#:-.&?';

function randomChar(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

/**
 * One split-flap tile. The static halves are CSS pseudo-elements fed by
 * `data-c` (top) and `data-b` (bottom); two leaves animate each change:
 * the old top half falls away, then the new bottom half lands.
 */
export class FlapTile {
  /** Duration of one half-flip, in ms. */
  static halfFlip = 62;

  private readonly topLeaf: HTMLSpanElement;
  private readonly bottomLeaf: HTMLSpanElement;
  private queue: string[] = [];
  private running = false;
  char: string;

  constructor(readonly element: HTMLElement) {
    this.char = element.dataset.c ?? ' ';
    this.topLeaf = FlapTile.leaf('leaf leaf--t');
    this.bottomLeaf = FlapTile.leaf('leaf leaf--b');
    element.append(this.topLeaf, this.bottomLeaf);
  }

  private static leaf(className: string): HTMLSpanElement {
    const leaf = document.createElement('span');
    leaf.className = className;
    return leaf;
  }

  get busy(): boolean {
    return this.running;
  }

  /** Shows `char` immediately, with no animation. */
  set(char: string): void {
    this.queue = [];
    this.char = char;
    this.element.dataset.c = char;
    this.element.dataset.b = char;
  }

  /** Flips through `spins` random characters, then lands on `target`. */
  flipTo(target: string, spins = 0): void {
    if (Motion.reduced) {
      this.set(target);
      return;
    }
    if (target === this.char && spins === 0 && !this.running) return;
    this.queue = [...Array.from({ length: spins }, randomChar), target];
    if (!this.running) this.next();
  }

  private next(): void {
    const char = this.queue.shift();
    if (char === undefined) {
      this.running = false;
      return;
    }
    this.running = true;
    const previous = this.char;
    const half = FlapTile.halfFlip;

    this.element.dataset.c = char;
    this.topLeaf.dataset.c = previous;
    this.bottomLeaf.dataset.c = char;
    this.topLeaf.style.visibility = 'visible';
    this.bottomLeaf.style.visibility = 'visible';

    this.topLeaf.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], {
      duration: half,
      easing: 'cubic-bezier(.55,0,1,.45)',
      fill: 'forwards'
    });
    const landing = this.bottomLeaf.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], {
      duration: half,
      delay: half,
      easing: 'cubic-bezier(0,.55,.45,1)',
      fill: 'backwards'
    });
    landing.onfinish = () => {
      this.char = char;
      this.element.dataset.b = char;
      this.topLeaf.style.visibility = 'hidden';
      this.bottomLeaf.style.visibility = 'hidden';
      this.topLeaf.getAnimations().forEach((animation) => animation.cancel());
      this.next();
    };
  }
}

export interface FlipOptions {
  /** Random characters each tile passes through before landing. */
  spins?: number;
  /** Extra random spins per tile, so the row does not move in lockstep. */
  jitter?: number;
  /** Delay between neighbouring tiles, in ms. */
  stagger?: number;
  /** Skip the narrow word-gap tiles, so text is laid over the letter tiles only. */
  skipGaps?: boolean;
}

/** A row of tiles rendered by FlapText.astro. */
export class FlapRow {
  readonly tiles: FlapTile[];
  readonly text: string;
  private timers: number[] = [];

  constructor(readonly element: HTMLElement) {
    this.tiles = $$('.f', element).map((tile) => new FlapTile(tile));
    this.text = this.tiles.map((tile) => tile.char).join('');
  }

  get length(): number {
    return this.tiles.length;
  }

  get current(): string {
    return this.tiles.map((tile) => tile.char).join('');
  }

  get busy(): boolean {
    return this.tiles.some((tile) => tile.busy);
  }

  /** Tiles that hold letters (not the narrow gap between words). */
  get letterTiles(): FlapTile[] {
    return this.tiles.filter((tile) => !tile.element.classList.contains('sp'));
  }

  /** Flips the row to `text` (padded or cut to the row's length). */
  show(text: string, { spins = 3, jitter = 3, stagger = 24, skipGaps = false }: FlipOptions = {}): Promise<void> {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];
    const tiles = skipGaps ? this.letterTiles : this.tiles;
    const target = text.toUpperCase().padEnd(tiles.length, ' ').slice(0, tiles.length);
    let last = 0;
    [...target].forEach((char, index) => {
      const tile = tiles[index];
      const turns = char === ' ' && tile.char === ' ' ? 0 : spins + Math.floor(Math.random() * (jitter + 1));
      const delay = index * stagger;
      last = Math.max(last, delay + (turns + 1) * FlapTile.halfFlip * 2);
      this.timers.push(window.setTimeout(() => tile.flipTo(char, turns), delay));
    });
    return new Promise((resolve) => window.setTimeout(resolve, Motion.reduced ? 0 : last + 40));
  }

  /** Spins every tile and lands back on the original text. */
  shuffle(options?: FlipOptions): Promise<void> {
    return this.show(this.text, options);
  }

  /** Blanks the row instantly (used before an intro). */
  blank(): void {
    this.tiles.forEach((tile) => tile.set(' '));
  }
}

/**
 * Brings every `[data-flap]` row to life:
 * - `intro` rows start blank and flip in once the loading screen is gone,
 * - `view` rows flip the first time they scroll into view,
 * - `[data-flap-hover]` rows re-flip when their link or row is hovered,
 * - the hero name accepts typing and spells whatever the visitor types.
 */
export class FlapBoard extends Component {
  private static readonly rows = new WeakMap<HTMLElement, FlapRow>();

  /** The row for an element, created on first use (so other components need no mount order). */
  static row(element: HTMLElement): FlapRow {
    let row = FlapBoard.rows.get(element);
    if (!row) {
      row = new FlapRow(element);
      FlapBoard.rows.set(element, row);
    }
    return row;
  }

  private typed = '';
  private typingTimer = 0;
  private heroVisible = true;

  mount(): void {
    const elements = $$('[data-flap]');
    elements.forEach((element) => FlapBoard.row(element));
    this.intro(elements.filter((element) => element.dataset.flap === 'intro'));
    this.onView(elements.filter((element) => element.dataset.flap === 'view'));
    this.onHover();
    this.spelling();
  }

  private intro(elements: HTMLElement[]): void {
    const root = document.documentElement;
    if (!elements.length || Motion.reduced) {
      root.classList.remove('flap-intro');
      signals.heroSettled.fire();
      return;
    }
    elements.forEach((element) => FlapBoard.row(element).blank());
    root.classList.remove('flap-intro');

    signals.loaderDone.then(async () => {
      const flips = elements.map((element, index) => {
        const row = FlapBoard.row(element);
        const big = row.length <= 12;
        return new Promise<void>((resolve) =>
          window.setTimeout(() => row.show(row.text, { spins: big ? 6 : 4, jitter: 4, stagger: big ? 55 : 14 }).then(resolve), 80 + index * 90)
        );
      });
      await Promise.all(flips);
      signals.heroSettled.fire();
    });
  }

  private onView(elements: HTMLElement[]): void {
    if (Motion.reduced || !elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          FlapBoard.row(entry.target as HTMLElement).shuffle({ spins: 3, jitter: 4, stagger: 20 });
        });
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    elements.forEach((element) => observer.observe(element));
    this.onCleanup(() => observer.disconnect());
  }

  private onHover(): void {
    if (Motion.reduced || !Motion.finePointer) return;
    $$('[data-flap-hover]').forEach((element) => {
      const host = element.closest<HTMLElement>('a, [data-flap-host]') ?? element;
      this.listen(host, 'pointerenter', () => {
        $$('[data-flap-hover]', host).forEach((row) => {
          const flap = FlapBoard.row(row);
          if (!flap.busy) flap.shuffle({ spins: 2, jitter: 3, stagger: 12 });
        });
      });
    });

    // Single tiles of the big name flip under the pointer.
    $$('[data-flap-tiles] .f').forEach((tile) => {
      const row = FlapBoard.row(tile.closest<HTMLElement>('[data-flap]')!);
      const flapTile = row.tiles.find((item) => item.element === tile);
      if (!flapTile) return;
      this.listen(tile, 'pointerenter', () => {
        if (!flapTile.busy && flapTile.char !== ' ') flapTile.flipTo(flapTile.char, 4);
      });
    });
  }

  /** Typing on the home page spells the visitor's words across the name. */
  private spelling(): void {
    const name = $('[data-flap-spell]');
    const echo = $('[data-flap-echo]');
    if (!name || Motion.reduced) return;
    const nameRow = FlapBoard.row(name);
    const echoRow = echo ? FlapBoard.row(echo) : null;
    const template = echo?.dataset.flapEcho ?? 'HELLO, {name}';

    const observer = new IntersectionObserver(([entry]) => (this.heroVisible = entry.isIntersecting));
    observer.observe(name);
    this.onCleanup(() => observer.disconnect());

    this.listen<KeyboardEvent>(window, 'keydown', (event) => {
      if (!this.heroVisible || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      const key = event.key;
      if (key.length === 1 && /[a-z0-9 ]/i.test(key)) {
        this.typed = (this.typed + key).slice(-nameRow.letterTiles.length);
      } else if (key === 'Backspace' && this.typed) {
        this.typed = this.typed.slice(0, -1);
      } else {
        return;
      }
      if (key === ' ') event.preventDefault();
      const word = this.typed.toUpperCase();
      const slots = nameRow.letterTiles.length;
      const offset = Math.max(0, Math.floor((slots - word.length) / 2));
      nameRow.show(' '.repeat(offset) + word, { spins: 1, jitter: 1, stagger: 8, skipGaps: true });
      echoRow?.show(template.replace(/\{name\}/i, word.trim() || '?'), { spins: 1, jitter: 1, stagger: 6 });

      window.clearTimeout(this.typingTimer);
      this.typingTimer = window.setTimeout(() => {
        this.typed = '';
        nameRow.show(nameRow.text, { spins: 3, jitter: 3, stagger: 40 });
        echoRow?.show(echoRow.text, { spins: 2, jitter: 2, stagger: 10 });
      }, 2600);
    });
  }
}
