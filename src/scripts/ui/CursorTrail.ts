import { Component } from '../core/Component';
import { Motion } from '../core/Motion';

interface TrailPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type CursorState = 'default' | 'hover' | 'grab' | 'grabbing' | 'hidden';

/**
 * Custom cursor. The head, a small yellow flap tile, sits exactly on the real
 * pointer (it is moved inside the event handler, so it never lags and clicks
 * stay precise) and replaces the system cursor. Behind it runs a trail of
 * smaller tiles: a chain of springs where the first link chases the pointer
 * and every next link chases the one before it, which gives the smooth,
 * delayed follow. The trail canvas renders at 1x (the tiles are a few pixels
 * wide, so retina detail is wasted) and only the box it drew last frame is
 * cleared, which keeps the per-frame cost tiny on large screens.
 */
export class CursorTrail extends Component {
  private static readonly POINTS = 10;
  private static readonly STIFFNESS = 0.3;
  private static readonly DAMPING = 0.56;

  private readonly root = document.documentElement;
  private head!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private points: TrailPoint[] = [];
  private pointer = { x: -100, y: -100 };
  private visible = false;
  private frame = 0;
  private idleFrames = 0;
  /** Area painted on the previous frame, cleared before the next one. */
  private dirty = { minX: 0, minY: 0, maxX: 0, maxY: 0, empty: true };

  static isSupported(): boolean {
    return Motion.finePointer && !Motion.reduced;
  }

  mount(): void {
    if (!CursorTrail.isSupported()) return;

    this.head = document.createElement('div');
    this.head.className = 'cursor-head';
    this.head.setAttribute('aria-hidden', 'true');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cursor-trail';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.context = this.canvas.getContext('2d')!;

    document.body.append(this.canvas, this.head);
    this.root.classList.add('has-custom-cursor');
    this.resize();

    this.listen<PointerEvent>(window, 'pointermove', (event) => this.move(event), { passive: true });
    this.listen<PointerEvent>(window, 'pointerdown', () => this.head.classList.add('is-pressed'));
    this.listen<PointerEvent>(window, 'pointerup', () => this.head.classList.remove('is-pressed'));
    this.listen<PointerEvent>(document, 'pointerover', (event) => this.inspect(event.target));
    this.listen<MouseEvent>(document.documentElement, 'mouseleave', () => this.setVisible(false));
    this.listen<CustomEvent<CursorState>>(document, 'cursor:state', (event) => this.setState(event.detail));
    this.listen(window, 'resize', () => this.resize());
  }

  private move(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.head.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;

    if (!this.visible) {
      this.setVisible(true);
      this.points = Array.from({ length: CursorTrail.POINTS }, () => ({ x: event.clientX, y: event.clientY, vx: 0, vy: 0 }));
    }
    this.idleFrames = 0;
    if (!this.frame) this.frame = requestAnimationFrame(this.step);
  }

  private inspect(target: EventTarget | null): void {
    if (!(target instanceof Element)) return;
    if (target.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea, [contenteditable="true"]')) {
      this.head.dataset.state = 'text';
      return;
    }
    if (this.head.dataset.state === 'grab' || this.head.dataset.state === 'grabbing') return;
    const interactive = target.closest('a, button, summary, select, label, [role="button"], [data-cursor="hover"]');
    this.head.dataset.state = interactive ? 'hover' : 'default';
  }

  private setState(state: CursorState): void {
    this.head.dataset.state = state;
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.head.classList.toggle('is-visible', visible);
    if (!visible) this.clearDirty();
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.dirty.empty = true;
  }

  private clearDirty(): void {
    const box = this.dirty;
    if (box.empty) return;
    this.context.clearRect(box.minX - 12, box.minY - 12, box.maxX - box.minX + 24, box.maxY - box.minY + 24);
    box.empty = true;
  }

  private step = (): void => {
    let spread = 0;
    let previous = this.pointer as { x: number; y: number };
    for (const point of this.points) {
      point.vx = (point.vx + (previous.x - point.x) * CursorTrail.STIFFNESS) * CursorTrail.DAMPING;
      point.vy = (point.vy + (previous.y - point.y) * CursorTrail.STIFFNESS) * CursorTrail.DAMPING;
      point.x += point.vx;
      point.y += point.vy;
      spread += Math.abs(point.x - this.pointer.x) + Math.abs(point.y - this.pointer.y);
      previous = point;
    }

    this.draw();

    // Once the whole chain has caught up with the pointer, stop until the next move.
    if (spread < 1) this.idleFrames += 1;
    if (this.idleFrames > 8 || !this.visible) {
      this.frame = 0;
      this.clearDirty();
      return;
    }
    this.frame = requestAnimationFrame(this.step);
  };

  /** Draws the trail as small flap tiles that shrink and fade toward the tail, each leaning into the motion. */
  private draw(): void {
    const ctx = this.context;
    this.clearDirty();
    const box = this.dirty;
    box.minX = box.minY = Infinity;
    box.maxX = box.maxY = -Infinity;
    const count = this.points.length;
    for (let index = count - 1; index >= 0; index -= 1) {
      const point = this.points[index];
      const before = index === 0 ? this.pointer : this.points[index - 1];
      const distance = Math.hypot(before.x - point.x, before.y - point.y);
      if (index > 0 && distance < 0.4) continue;
      const life = 1 - index / count;
      const width = 2 + 6 * life;
      const height = width * 1.4;
      const lean = Math.max(-0.5, Math.min(0.5, (before.x - point.x) * 0.04));
      box.minX = Math.min(box.minX, point.x);
      box.maxX = Math.max(box.maxX, point.x);
      box.minY = Math.min(box.minY, point.y);
      box.maxY = Math.max(box.maxY, point.y);
      box.empty = false;

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(lean);
      ctx.globalAlpha = 0.12 + 0.6 * life * life;
      ctx.fillStyle = index % 3 === 0 ? '#ffcf33' : '#b8aad8';
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.fillStyle = 'rgba(7, 3, 16, 0.85)';
      ctx.fillRect(-width / 2, -0.5, width, 1);
      ctx.restore();
    }
  }
}
