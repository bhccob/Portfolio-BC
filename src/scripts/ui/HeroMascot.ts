import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $ } from '../core/dom';

/**
 * The ping-pong ball in the hero headline. Its pupils follow the pointer
 * (one CSS variable update per frame at most), it blinks now and then, and a
 * click gives it a little bounce.
 */
export class HeroMascot extends Component {
  private static readonly REACH = 4.5;

  private readonly ball = $('[data-ball]');
  private target = { x: 0, y: 0 };
  private frame = 0;
  private blinkTimer = 0;

  mount(): void {
    if (!this.ball || Motion.reduced) return;
    if (Motion.finePointer) {
      this.listen<PointerEvent>(window, 'pointermove', (event) => {
        this.target = { x: event.clientX, y: event.clientY };
        if (!this.frame) this.frame = requestAnimationFrame(this.look);
      }, { passive: true });
    }
    this.listen(this.ball.closest('.hero__line') ?? this.ball, 'click', () => this.bounce());
    this.scheduleBlink();
    this.onCleanup(() => window.clearTimeout(this.blinkTimer));
  }

  private look = (): void => {
    this.frame = 0;
    const rect = this.ball!.getBoundingClientRect();
    if (rect.bottom < 0) return;
    const dx = this.target.x - (rect.left + rect.width / 2);
    const dy = this.target.y - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, distance / 160) * HeroMascot.REACH;
    this.ball!.style.setProperty('--px', `${((dx / distance) * reach).toFixed(2)}px`);
    this.ball!.style.setProperty('--py', `${((dy / distance) * reach).toFixed(2)}px`);
  };

  private scheduleBlink(): void {
    this.blinkTimer = window.setTimeout(() => {
      this.ball!.classList.add('is-blink');
      window.setTimeout(() => this.ball!.classList.remove('is-blink'), 140);
      this.scheduleBlink();
    }, 2600 + Math.random() * 3200);
  }

  private bounce(): void {
    this.ball!.classList.remove('is-hit');
    void this.ball!.offsetWidth;
    this.ball!.classList.add('is-hit');
  }
}
