import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $ } from '../core/dom';

/**
 * The faint drawing-paper grid behind the whole site. It scrolls at half
 * speed (so it reads as a layer behind the content), and lines near the
 * pointer bend gently toward it, as if the sheet were being pulled. It only
 * redraws while something is changing.
 */
export class BlueprintGrid extends Component {
  private static readonly STEP = 56;
  private static readonly SEGMENT = 18;
  private static readonly RADIUS = 240;
  private static readonly PULL = 0.2;

  private readonly canvas = $<HTMLCanvasElement>('[data-blueprint]');
  private ctx!: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private target = { x: -9999, y: -9999 };
  private pointer = { x: -9999, y: -9999 };
  private strength = 0;
  private targetStrength = 0;
  private frame = 0;

  mount(): void {
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    this.listen(window, 'resize', () => {
      this.resize();
      this.request();
    });
    this.listen(window, 'scroll', () => this.request(), { passive: true });

    if (Motion.finePointer && !Motion.reduced) {
      this.listen<PointerEvent>(window, 'pointermove', (event) => {
        this.target = { x: event.clientX, y: event.clientY };
        if (this.pointer.x < -1000) this.pointer = { ...this.target };
        this.targetStrength = 1;
        this.request();
      }, { passive: true });
      this.listen(document.documentElement, 'mouseleave', () => {
        this.targetStrength = 0;
        this.request();
      });
    }
    this.request();
  }

  private resize(): void {
    this.ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas!.width = Math.round(this.width * this.ratio);
    this.canvas!.height = Math.round(this.height * this.ratio);
    this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
  }

  private request(): void {
    if (!this.frame) this.frame = requestAnimationFrame(this.draw);
  }

  /** Where a grid point is drawn once the pointer's pull is applied. */
  private bend(x: number, y: number): [number, number] {
    if (this.strength < 0.001) return [x, y];
    const dx = this.pointer.x - x;
    const dy = this.pointer.y - y;
    const falloff = Math.exp(-(dx * dx + dy * dy) / (2 * BlueprintGrid.RADIUS * BlueprintGrid.RADIUS));
    const k = falloff * BlueprintGrid.PULL * this.strength;
    return [x + dx * k, y + dy * k];
  }

  private draw = (): void => {
    this.frame = 0;
    const { STEP, SEGMENT } = BlueprintGrid;
    const ctx = this.ctx;
    this.pointer.x += (this.target.x - this.pointer.x) * 0.1;
    this.pointer.y += (this.target.y - this.pointer.y) * 0.1;
    this.strength += (this.targetStrength - this.strength) * 0.08;

    ctx.clearRect(0, 0, this.width, this.height);
    const offset = -((window.scrollY * 0.5) % (STEP * 4));
    const near = (x: number, y: number) => Math.abs(this.pointer.x - x) < BlueprintGrid.RADIUS * 2.2 && Math.abs(this.pointer.y - y) < BlueprintGrid.RADIUS * 2.2;

    for (let pass = 0; pass < 2; pass++) {
      // pass 0: minor lines, pass 1: every fourth line, slightly stronger
      ctx.strokeStyle = pass ? 'rgba(179, 165, 212, 0.085)' : 'rgba(179, 165, 212, 0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0, x = 0; x <= this.width + STEP; i++, x += STEP) {
        if ((i % 4 === 0) !== (pass === 1)) continue;
        for (let y = 0; y <= this.height; y += SEGMENT) {
          const [px, py] = near(x, y) ? this.bend(x, y) : [x, y];
          if (y === 0) ctx.moveTo(px + 0.5, py);
          else ctx.lineTo(px + 0.5, py);
        }
      }
      for (let j = 0, y = offset; y <= this.height + STEP; j++, y += STEP) {
        if ((j % 4 === 0) !== (pass === 1)) continue;
        for (let x = 0; x <= this.width; x += SEGMENT) {
          const [px, py] = near(x, y) ? this.bend(x, y) : [x, y];
          if (x === 0) ctx.moveTo(px, py + 0.5);
          else ctx.lineTo(px, py + 0.5);
        }
      }
      ctx.stroke();
    }

    const moving =
      Math.abs(this.target.x - this.pointer.x) > 0.3 ||
      Math.abs(this.target.y - this.pointer.y) > 0.3 ||
      Math.abs(this.targetStrength - this.strength) > 0.005;
    if (moving) this.request();
  };
}
