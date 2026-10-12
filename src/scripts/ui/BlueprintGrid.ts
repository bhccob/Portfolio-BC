import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $ } from '../core/dom';

/**
 * The faint drawing-paper grid behind the whole site. The grid itself is
 * plain CSS; this class only moves it at half the scroll speed and lights up
 * the lines around the pointer. Both are pure transforms, so the compositor
 * does the work and nothing is repainted per frame: the glow is a small
 * masked window that follows the pointer, and the yellow grid inside it is
 * shifted back so its lines stay aligned with the sheet underneath.
 */
export class BlueprintGrid extends Component {
  /** One major grid cell: the sheet loops by this distance. */
  private static readonly CYCLE = 224;
  /** Half the glow window's size (see `.blueprint__glow` in BaseLayout). */
  private static readonly REACH = 220;

  private readonly root = $('[data-blueprint]');
  private readonly sheet = $('[data-blueprint-sheet]');
  private readonly glow = $('[data-blueprint-glow]');
  private readonly glowGrid = $('[data-blueprint-glow-grid]');
  private offset = 0;
  private pointer = { x: -999, y: -999 };
  private frame = 0;

  mount(): void {
    if (!this.root || !this.sheet) return;
    this.listen(window, 'scroll', () => this.request(), { passive: true });
    if (this.glow && this.glowGrid && Motion.finePointer && !Motion.reduced) {
      this.listen<PointerEvent>(window, 'pointermove', (event) => {
        this.pointer = { x: event.clientX, y: event.clientY };
        this.root!.classList.add('is-lit');
        this.request();
      }, { passive: true });
      this.listen(document.documentElement, 'mouseleave', () => this.root!.classList.remove('is-lit'));
    }
    this.request();
  }

  private request(): void {
    if (!this.frame) this.frame = requestAnimationFrame(this.update);
  }

  private update = (): void => {
    this.frame = 0;
    const cycle = BlueprintGrid.CYCLE;
    this.offset = Motion.reduced ? 0 : -((window.scrollY * 0.5) % cycle);
    this.sheet!.style.transform = `translate3d(0, ${this.offset.toFixed(1)}px, 0)`;
    if (!this.glow || !this.glowGrid || this.pointer.x < -900) return;

    // The window's top-left corner, then the grid inside it snapped back onto the sheet's lines.
    const gx = this.pointer.x - BlueprintGrid.REACH;
    const gy = this.pointer.y - BlueprintGrid.REACH;
    const sheetTop = this.offset - cycle;
    const ix = Math.floor(gx / cycle) * cycle - gx;
    const iy = sheetTop + Math.floor((gy - sheetTop) / cycle) * cycle - gy;
    this.glow.style.transform = `translate3d(${gx.toFixed(1)}px, ${gy.toFixed(1)}px, 0)`;
    this.glowGrid.style.transform = `translate3d(${ix.toFixed(1)}px, ${iy.toFixed(1)}px, 0)`;
  };
}
