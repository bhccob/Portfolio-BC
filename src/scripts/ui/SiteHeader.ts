import { Component } from '../core/Component';
import { $, $$ } from '../core/dom';

/**
 * Header behaviour: glass background once scrolled, hides while scrolling
 * down and returns when scrolling up, a reading-progress bar, active-section
 * highlighting and the full-screen mobile menu.
 */
export class SiteHeader extends Component {
  private readonly header = $('[data-site-header]');
  private readonly progress = $('.scroll-progress');
  private readonly toggle = $<HTMLButtonElement>('[data-menu-toggle]');
  private readonly menu = $('[data-mobile-menu]');
  private lastY = 0;
  private ticking = false;
  private menuOpen = false;

  mount(): void {
    if (!this.header) return;
    this.listen(window, 'scroll', () => this.requestUpdate(), { passive: true });
    this.update();
    this.bindMenu();
    this.watchSections();
  }

  private requestUpdate(): void {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.update();
      this.ticking = false;
    });
  }

  private update(): void {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.header!.classList.toggle('is-scrolled', y > 24);
    const goingDown = y > this.lastY + 4;
    const goingUp = y < this.lastY - 4;
    if (goingDown && y > window.innerHeight * 0.6 && !this.menuOpen) this.header!.classList.add('is-hidden');
    if (goingUp || y < 120) this.header!.classList.remove('is-hidden');
    this.progress?.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : '0');
    this.lastY = y;
  }

  private bindMenu(): void {
    if (!this.toggle || !this.menu) return;
    this.listen(this.toggle, 'click', () => this.setMenu(!this.menuOpen));
    $$('[data-menu-link]', this.menu).forEach((link) => this.listen(link, 'click', () => this.setMenu(false)));
    this.listen<KeyboardEvent>(document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.menuOpen) {
        this.setMenu(false);
        this.toggle!.focus();
      }
    });
    this.listen(window, 'resize', () => {
      if (this.menuOpen && window.innerWidth > 900) this.setMenu(false);
    });
  }

  private setMenu(open: boolean): void {
    const menu = this.menu!;
    const toggle = this.toggle!;
    this.menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    const label = $('[data-menu-label]', toggle);
    if (label) label.textContent = open ? label.dataset.closeLabel! : label.dataset.openLabel!;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    document.dispatchEvent(new CustomEvent('scroll:lock', { detail: open }));

    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      $('a', menu)?.focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      window.setTimeout(() => {
        if (!this.menuOpen) menu.hidden = true;
      }, 700);
    }
  }

  /** Underlines the nav link of the section currently in view. */
  private watchSections(): void {
    const links = $$<HTMLAnchorElement>('.site-nav__link');
    const sections = links
      .map((link) => ({ link, section: document.getElementById(new URL(link.href).hash.slice(1)) }))
      .filter((entry): entry is { link: HTMLAnchorElement; section: HTMLElement } => entry.section !== null);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const match = sections.find((item) => item.section === entry.target);
          match?.link.classList.toggle('is-active', entry.isIntersecting);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach(({ section }) => observer.observe(section));
    this.onCleanup(() => observer.disconnect());
  }
}
