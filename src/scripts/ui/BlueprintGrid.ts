import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $ } from '../core/dom';

/**
 * The faint drawing-paper grid behind the whole site. The grid itself is
 * plain CSS; this class only moves it at half the scroll speed (a transform,
 * so the compositor does the work) and lights up the lines around the
 * pointer through a CSS mask. Nothing is redrawn per frame.
 */
export class BlueprintGrid extends Component {
  /** One major grid cell: the sheet loops by this distance. */
  private static readonly CYCLE = 224;

  private readonly root = $('[data-blueprint]');
  private offset = 0;
  private pointer = { x: -999, y: -999 };
  private frame = 0;

  mount(): void {
    if (!this.root) return;
    this.listen(window, 'scroll', () => this.request(), { passive: true });
    if (Motion.finePointer && !Motion.reduced) {
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
    const style = this.root!.style;
    style.setProperty('--gy', `${this.offset.toFixed(1)}px`);
    // The sheets start one cycle above the viewport, so convert to sheet coordinates.
    style.setProperty('--mx', `${this.pointer.x}px`);
    style.setProperty('--my', `${(this.pointer.y + cycle - this.offset).toFixed(1)}px`);
  };
}
