import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { signals } from '../core/Signal';
import { $, $$ } from '../core/dom';

interface Word {
  element: HTMLElement;
  /** Box of the word inside the name (layout only, cached on resize). */
  left: number;
  top: number;
  width: number;
  height: number;
  last: string;
}

/**
 * The hero name is printed as an outline; its yellow fill shows through a
 * circle that follows the pointer, like ink under a lens. When the pointer is
 * elsewhere (and always on touch screens) the circle drifts slowly over the
 * name so it is never dark, and a click or tap floods the whole name for a
 * moment. Per frame the only thing that changes is a `clip-path` on two
 * word-sized layers; layout is measured on resize, and the loop sleeps while
 * the hero is off-screen.
 */
export class NameReveal extends Component {
  /** How long after the last pointer move the circle starts drifting on its own. */
  private static readonly IDLE_MS = 2400;
  private static readonly FLOOD_MS = 950;
  private static readonly INTRO_MS = 1700;
  /** Idle drift speed along the letters, in font sizes per second. */
  private static readonly DRIFT_SPEED = 0.55;

  private readonly hero = $('[data-hero]');
  private readonly name = $('[data-name-reveal]');
  private readonly words: Word[] = $$('[data-name-word]').map((element) => ({ element, left: 0, top: 0, width: 0, height: 0, last: '' }));

  private width = 0;
  private height = 0;
  private baseRadius = 60;
  private fontSize = 100;
  /** Idle route over the letters: along the first name, down, back along the last name. */
  private route: { x: number; y: number }[] = [];
  private routeLength = 1;
  private pointer = { x: 0, y: 0, at: -Infinity };
  private pos = { x: -200, y: 0 };
  private radius = 0;
  private floodUntil = 0;
  private introAt = Infinity;
  private visible = true;
  private frame = 0;
  private lastTime = 0;

  mount(): void {
    if (!this.hero || !this.name || !this.words.length) return;

    const hint = $('[data-name-hint]', this.hero);
    if (hint && !Motion.finePointer) {
      const label = $('span', hint);
      if (label) label.textContent = hint.dataset.touch ?? label.textContent;
    }

    if (Motion.reduced) {
      this.name.classList.add('is-static');
      return;
    }

    this.measure();
    const observer = new ResizeObserver(() => this.measure());
    observer.observe(this.name);
    this.onCleanup(() => observer.disconnect());
    document.fonts?.ready.then(() => this.measure());

    if (Motion.finePointer) {
      this.listen<PointerEvent>(window, 'pointermove', (event) => {
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
        this.pointer = { x: event.clientX, y: event.clientY, at: performance.now() };
      }, { passive: true });
    }
    this.listen<PointerEvent>(this.name, 'pointerdown', (event) => this.floodFrom(event));

    const visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
    });
    visibility.observe(this.hero);
    this.onCleanup(() => visibility.disconnect());

    // One sweep across the name as the hero lines rise in.
    signals.loaderDone.then(() => (this.introAt = performance.now() + 450));
    this.start();
  }

  private measure(): void {
    this.width = this.name!.offsetWidth;
    this.height = this.name!.offsetHeight;
    this.fontSize = parseFloat(getComputedStyle(this.name!).fontSize);
    this.baseRadius = this.fontSize * 0.56;
    for (const word of this.words) {
      word.left = word.element.offsetLeft;
      word.top = word.element.offsetTop;
      word.width = word.element.offsetWidth;
      word.height = word.element.offsetHeight;
    }
    this.route = this.words.flatMap((word, index) => {
      const y = word.top + word.height * 0.5;
      const from = { x: word.left + word.width * 0.08, y };
      const to = { x: word.left + word.width * 0.92, y };
      return index % 2 ? [to, from] : [from, to];
    });
    this.routeLength = this.route.reduce((sum, point, index) => {
      const next = this.route[(index + 1) % this.route.length];
      return sum + Math.hypot(next.x - point.x, next.y - point.y);
    }, 0) || 1;
  }

  private floodFrom(event: PointerEvent): void {
    const rect = this.name!.getBoundingClientRect();
    this.pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.pointer = { x: event.clientX, y: event.clientY, at: event.pointerType === 'mouse' ? performance.now() : -Infinity };
    this.floodUntil = performance.now() + NameReveal.FLOOD_MS;
    this.start();
  }

  private start(): void {
    if (this.frame) return;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    if (!this.visible) return;
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 20);
    this.lastTime = now;

    const { x, y, radius, follow } = this.target(now);
    // Exponential easing: the circle catches up fast with the pointer, lazily when drifting.
    const k = 1 - Math.exp(-dt * (follow ? 16 : 2.6));
    this.pos.x += (x - this.pos.x) * k;
    this.pos.y += (y - this.pos.y) * k;
    this.radius += (radius - this.radius) * (1 - Math.exp(-dt * (radius > this.radius ? 7 : 4)));
    this.paint();

    this.frame = requestAnimationFrame(this.tick);
  };

  /** Where the circle wants to be this frame, in the name's own coordinates. */
  private target(now: number): { x: number; y: number; radius: number; follow: boolean } {
    const r = this.baseRadius;
    if (now < this.floodUntil) {
      return { x: this.pos.x, y: this.pos.y, radius: Math.hypot(this.width, this.height) * 1.05, follow: true };
    }

    const intro = (now - this.introAt) / NameReveal.INTRO_MS;
    if (intro >= 0 && intro < 1) {
      const eased = 1 - Math.pow(1 - intro, 3);
      return { x: -r + (this.width + 2 * r) * eased, y: this.height * (0.3 + 0.4 * eased), radius: r * 1.15, follow: true };
    }

    if (now - this.pointer.at < NameReveal.IDLE_MS) {
      const rect = this.name!.getBoundingClientRect();
      const px = this.pointer.x - rect.left;
      const py = this.pointer.y - rect.top;
      // Near the name the lens follows the pointer; further away it shrinks and lets go.
      const outside = Math.max(0, -px, px - this.width, -py, py - this.height);
      if (outside < r * 2.2) return { x: px, y: py, radius: r * (1 - outside / (r * 3.2)), follow: true };
    }

    const { x, y } = this.drift(now);
    return { x, y, radius: r * 0.82, follow: false };
  }

  /** A slow lap along the letters, with a gentle wobble; the lazy easing rounds its corners. */
  private drift(now: number): { x: number; y: number } {
    const t = now / 1000;
    let distance = (t * this.fontSize * NameReveal.DRIFT_SPEED) % this.routeLength;
    for (let index = 0; index < this.route.length; index++) {
      const a = this.route[index];
      const b = this.route[(index + 1) % this.route.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (distance <= length || index === this.route.length - 1) {
        const f = length ? Math.min(distance / length, 1) : 0;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f + Math.sin(t * 1.3) * this.fontSize * 0.12 };
      }
      distance -= length;
    }
    return { x: this.width / 2, y: this.height / 2 };
  }

  private paint(): void {
    const r = `${Math.max(this.radius, 0).toFixed(1)}px`;
    for (const word of this.words) {
      const x = `${(this.pos.x - word.left).toFixed(1)}px`;
      const y = `${(this.pos.y - word.top).toFixed(1)}px`;
      const key = `${x} ${y} ${r}`;
      if (key === word.last) continue;
      word.last = key;
      const style = word.element.style;
      style.setProperty('--x', x);
      style.setProperty('--y', y);
      style.setProperty('--r', r);
    }
  }
}
