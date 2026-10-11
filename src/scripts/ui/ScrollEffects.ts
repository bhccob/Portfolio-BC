import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { signals } from '../core/Signal';
import { $, $$ } from '../core/dom';

/**
 * Everything that moves with the scroll: Lenis smooth scrolling, headings
 * that drop in line by line like flaps, text reveals, drifting line objects,
 * project screenshots that unfold, the hero board receding, and the route
 * from Aruba to Rotterdam drawing itself. Skipped entirely when the visitor
 * prefers reduced motion.
 */
export class ScrollEffects extends Component {
  /** Shared so other components (e.g. the playground) can scroll the page. */
  static lenis: Lenis | null = null;

  private lenis: Lenis | null = null;

  mount(): void {
    if (Motion.reduced) return;

    gsap.registerPlugin(ScrollTrigger, SplitText);
    this.startLenis();
    document.documentElement.classList.add('motion-ready');

    this.heroIntro();
    this.reveals();
    this.parallax();
    this.heroRecede();
    this.mixedWords();
    this.shots();
    this.portrait();
    this.route();

    // Text splitting needs final font metrics.
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      this.splitHeadings();
      ScrollTrigger.refresh();
    });
  }

  private startLenis(): void {
    const lenis = new Lenis({ autoRaf: false, lerp: 0.11, wheelMultiplier: 1 });
    this.lenis = lenis;
    ScrollEffects.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    this.listen<CustomEvent<boolean>>(document, 'scroll:lock', (event) => (event.detail ? lenis.stop() : lenis.start()));
    this.listen<MouseEvent>(document, 'click', (event) => this.handleAnchor(event));

    // Hold the page still while the boot screen is up.
    if (!signals.loaderDone.hasFired) {
      lenis.stop();
      signals.loaderDone.then(() => lenis.start());
    }

    // Landing on /#work from another page: scroll there once layout has settled.
    if (location.hash.length > 1) {
      signals.loaderDone.then(() => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) window.setTimeout(() => lenis.scrollTo(target, { offset: -this.headerOffset(), immediate: true }), 50);
      });
    }
  }

  private headerOffset(): number {
    return ($('[data-site-header]')?.offsetHeight ?? 76) + 8;
  }

  /** Same-page anchor links scroll smoothly through Lenis instead of jumping. */
  private handleAnchor(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="#"]');
    if (!link || !this.lenis) return;
    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || url.origin !== location.origin) return;

    event.preventDefault();
    const id = decodeURIComponent(url.hash.slice(1));
    const target = id && id !== 'top' ? document.getElementById(id) : null;
    this.lenis.scrollTo(target ?? 0, { offset: target ? -this.headerOffset() : 0, duration: 1.3 });
    history.replaceState(null, '', url.hash || location.pathname);
  }

  private reveals(): void {
    const targets = $$('[data-reveal]');
    if (!targets.length) return;
    ScrollTrigger.batch(targets, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, overwrite: true })
    });
  }

  /** Display headings drop in line by line, hinged at the top like a flap. */
  private splitHeadings(): void {
    $$('[data-split]').forEach((heading) => {
      SplitText.create(heading, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: -105,
            rotateX: -70,
            transformOrigin: '50% 0%',
            transformPerspective: 600,
            duration: 1.05,
            ease: 'expo.out',
            stagger: 0.09,
            scrollTrigger: { trigger: heading, start: 'top 88%', once: true }
          })
      });
    });
  }

  private parallax(): void {
    $$('[data-speed]').forEach((element) => {
      const speed = Number(element.dataset.speed) || 0;
      const spin = Number(element.dataset.spin) || 0;
      const trigger = element.closest('section, article') ?? element;
      gsap.fromTo(
        element,
        { y: () => speed * window.innerHeight * 0.18, rotate: spin },
        {
          y: () => -speed * window.innerHeight * 0.18,
          rotate: spin + speed * 50,
          ease: 'none',
          scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
        }
      );
    });
  }

  /** Hero lines rise out of a blur, one after another, once the loader is gone. */
  private heroIntro(): void {
    const lines = $$('[data-hero-line]');
    if (!lines.length) return;
    gsap.set(lines, { yPercent: 40, opacity: 0, filter: 'blur(14px)' });
    document.documentElement.classList.remove('flap-intro');
    signals.loaderDone.then(() => {
      gsap.to(lines, {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.09,
        delay: 0.1,
        clearProps: 'filter'
      });
    });
  }

  /** The hero text drifts up and fades as the visitor scrolls past it (transform and opacity only). */
  private heroRecede(): void {
    const hero = $('[data-hero]');
    const inner = $('.hero__inner', hero ?? document);
    if (!hero || !inner) return;
    gsap.to(inner, {
      yPercent: -14,
      opacity: 0.15,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  /** Words of the mixed-type paragraph come into focus as it scrolls into view. */
  private mixedWords(): void {
    $$('[data-mixed]').forEach((paragraph) => {
      const words = $$('[data-mixed-word]', paragraph);
      gsap.fromTo(
        words,
        { opacity: 0.12, filter: 'blur(6px)' },
        {
          opacity: 1,
          filter: 'blur(0px)',
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: paragraph, start: 'top 85%', end: 'bottom 55%', scrub: true }
        }
      );
    });
  }

  /** Project screenshots unfold from their top edge as they scroll in. */
  private shots(): void {
    $$('[data-shot]').forEach((shot) => {
      const frame = $('.shot__frame, .case__frame', shot) ?? shot;
      gsap.fromTo(
        frame,
        { clipPath: 'inset(0% 0% 62% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: shot, start: 'top 92%', end: 'top 40%', scrub: true } }
      );
    });
  }

  private portrait(): void {
    const image = $('[data-parallax-img]');
    if (!image) return;
    gsap.fromTo(
      image,
      { yPercent: -6 },
      { yPercent: 0, ease: 'none', scrollTrigger: { trigger: image.closest('section') ?? image, start: 'top bottom', end: 'bottom top', scrub: true } }
    );
  }

  /** The route line draws from China through Aruba to Rotterdam; each stop lights up as it is reached. */
  private route(): void {
    const route = $('[data-route]');
    const line = $('[data-route-line]', route ?? document);
    if (!route || !line) return;
    const stops = $$('[data-route-stop]', route);
    gsap.fromTo(
      line,
      { strokeDashoffset: 1 },
      {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: route,
          start: 'top 85%',
          end: 'bottom 50%',
          scrub: true,
          onUpdate: (self) => stops.forEach((stop, index) => stop.classList.toggle('is-lit', self.progress >= index / Math.max(stops.length - 1, 1) - 0.02))
        }
      }
    );
  }
}
