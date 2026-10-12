import { Component } from '../core/Component';
import { $ } from '../core/dom';

/**
 * On a category page, the arrow keys and a horizontal swipe move to the
 * previous or next project on the shelf. Both simply follow the shelf's own
 * Previous / Next links, so the browser's cross-document view transition
 * (see `@view-transition` in base.css) carries the change, and everything
 * still works as plain links without this script.
 */
export class ProjectSwitcher extends Component {
  /** A swipe must travel this far sideways, and mostly sideways, to count. */
  private static readonly SWIPE_PX = 70;

  private readonly shelf = $('[data-shelf]');
  private readonly previous = $<HTMLAnchorElement>('[data-switch-prev]');
  private readonly next = $<HTMLAnchorElement>('[data-switch-next]');

  mount(): void {
    if (!this.shelf || !this.previous || !this.next) return;

    this.listen<KeyboardEvent>(document, 'keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      if (event.key === 'ArrowLeft') this.go(this.previous!);
      else if (event.key === 'ArrowRight') this.go(this.next!);
    });

    let start: { x: number; y: number } | null = null;
    this.listen<TouchEvent>(document, 'touchstart', (event) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && !(event.target as Element).closest('a, button, input, textarea') ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });
    this.listen<TouchEvent>(document, 'touchend', (event) => {
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      if (Math.abs(dx) < ProjectSwitcher.SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 2) return;
      this.go(dx > 0 ? this.previous! : this.next!);
    }, { passive: true });
  }

  private go(link: HTMLAnchorElement): void {
    link.focus({ preventScroll: true });
    link.click();
  }
}
