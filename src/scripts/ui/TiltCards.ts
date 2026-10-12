import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $$ } from '../core/dom';

/**
 * Prints marked `data-tilt` lean a few degrees toward the pointer, as if
 * pressed where the visitor is looking. Only two CSS variables change (one
 * update per frame at most), and the effect is off for touch input and
 * reduced motion.
 */
export class TiltCards extends Component {
  private static readonly MAX_DEG = 5;

  mount(): void {
    if (!Motion.finePointer || Motion.reduced) return;
    $$('[data-tilt]').forEach((card) => this.bind(card));
  }

  private bind(card: HTMLElement): void {
    let frame = 0;
    let point = { x: 0.5, y: 0.5 };

    const apply = () => {
      frame = 0;
      card.style.setProperty('--rx', `${((0.5 - point.y) * TiltCards.MAX_DEG * 2).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${((point.x - 0.5) * TiltCards.MAX_DEG * 2).toFixed(2)}deg`);
    };

    this.listen<PointerEvent>(card, 'pointerenter', () => card.classList.add('is-tilting'));
    this.listen<PointerEvent>(card, 'pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = card.getBoundingClientRect();
      point = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
      if (!frame) frame = requestAnimationFrame(apply);
    }, { passive: true });
    this.listen(card, 'pointerleave', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }
}
