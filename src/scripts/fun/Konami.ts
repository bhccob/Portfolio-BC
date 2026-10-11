import { Component } from '../core/Component';
import { $, readJson } from '../core/dom';
import { Toast } from '../ui/Toast';

/** ↑ ↑ ↓ ↓ ← → ← → B A. Fires a `hero:konami` event the playground listens for. */
export class Konami extends Component {
  private static readonly SEQUENCE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  private position = 0;

  mount(): void {
    this.listen<KeyboardEvent>(document, 'keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      this.position = key === Konami.SEQUENCE[this.position] ? this.position + 1 : key === Konami.SEQUENCE[0] ? 1 : 0;
      if (this.position === Konami.SEQUENCE.length) {
        this.position = 0;
        if ($('[data-play]')) {
          document.dispatchEvent(new CustomEvent('hero:konami'));
        } else {
          const strings = readJson<{ konamiElsewhere: string }>($('[data-toast-region]') ?? document.body, 'data-strings', { konamiElsewhere: '' });
          if (strings.konamiElsewhere) Toast.show(strings.konamiElsewhere);
        }
      }
    });
  }
}
