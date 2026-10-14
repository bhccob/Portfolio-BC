import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $, $$ } from '../core/dom';

type Deal = 'right' | 'left' | 'up' | 'flip';

/**
 * Scenes tied to the scroll position, so every section answers the visitor's
 * scrolling in both directions: crossing tapes that slide and lean with the
 * scroll speed, prints and rows dealt onto the board, the portrait settling
 * into its frame, quotes blown in word by word, sections receding as they
 * leave and the closing HELLO growing into place. Transforms and opacity
 * only. ScrollEffects owns Lenis and the plugins; this runs after it and is
 * skipped entirely when the visitor prefers reduced motion.
 */
export class ScrollScenes extends Component {
  mount(): void {
    if (Motion.reduced) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    this.tapes();
    this.deals();
    this.drift();
    this.portrait();
    this.recede();
    this.hello();
    this.caseShot();

    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      this.blowWords();
      ScrollTrigger.refresh();
    });
  }

  /**
   * Two tapes cross the board under the hero. They slide with the scroll,
   * one each way, and lean into the direction of travel the faster the
   * visitor scrolls, settling back when the scrolling stops.
   */
  private tapes(): void {
    const tapes = $$('[data-tape]');
    if (!tapes.length) return;
    const host = tapes[0].closest('[data-tapes]') ?? tapes[0];

    tapes.forEach((tape, index) => {
      const track = $('[data-tape-track]', tape);
      if (!track) return;
      const direction = index % 2 ? 1 : -1;
      gsap.fromTo(
        track,
        { xPercent: direction < 0 ? 0 : -25 },
        {
          xPercent: direction < 0 ? -25 : 0,
          ease: 'none',
          scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom top', scrub: 0.4 }
        }
      );
    });

    const lean = gsap.quickTo(tapes, 'skewX', { duration: 0.5, ease: 'power3.out' });
    ScrollTrigger.create({
      trigger: host,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => lean(gsap.utils.clamp(-10, 10, self.getVelocity() / -260)),
      onLeave: () => lean(0),
      onLeaveBack: () => lean(0)
    });
  }

  /**
   * Prints and board rows are dealt onto the board as they scroll in: from
   * the side or from below, tilted and slightly small, settling flat. Rows
   * marked `flip` fall open from their top edge like a departure-board flap.
   * Items that sit side by side start one after another.
   */
  private deals(): void {
    const items = $$('[data-deal]');
    items.forEach((item) => {
      const kind = (item.dataset.deal as Deal) || 'up';
      const siblings = item.parentElement ? $$(':scope > [data-deal]', item.parentElement) : [item];
      const sameRow = siblings.filter((other) => Math.abs(other.offsetTop - item.offsetTop) < 8);
      const order = Math.max(0, sameRow.indexOf(item));
      const narrow = window.innerWidth < 760;

      const from: gsap.TweenVars = { opacity: 0 };
      if (kind === 'right' || kind === 'left') {
        const side = kind === 'right' ? 1 : -1;
        Object.assign(from, {
          x: () => side * Math.min(window.innerWidth * (narrow ? 0.5 : 0.36), 520),
          y: 40,
          rotation: side * (narrow ? 6 : 10 + order * 3),
          scale: 0.86
        });
      } else if (kind === 'flip') {
        Object.assign(from, { rotationX: -88, transformPerspective: 900, transformOrigin: '50% 0%', y: -10 });
      } else {
        Object.assign(from, { y: 100, rotation: order % 2 ? -4 : 4, scale: 0.85 });
      }

      const start = 100 - order * 7;
      gsap.fromTo(item, from, {
        x: 0,
        y: 0,
        rotation: 0,
        rotationX: 0,
        scale: 1,
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: item,
          start: `top ${start}%`,
          end: `top ${start - (kind === 'flip' ? 24 : 38)}%`,
          scrub: 0.5,
          invalidateOnRefresh: true
        }
      });
    });
  }

  /**
   * The project prints form a gallery while motion runs: one row of wide prints, longer than the
   * board (see the styles). Once they have been dealt, the row slides left with the scroll, pixel
   * for pixel, until the last print reaches the board's right edge, and comes back the same way.
   * Where there is room, the projects section holds still while the row travels and the page
   * moves on only once the last print has arrived; on very short screens the row travels while
   * the page scrolls instead.
   */
  private drift(): void {
    const row = $('[data-drift]');
    const frame = row?.parentElement;
    const deck = row?.closest<HTMLElement>('.work__deck');
    const board = row?.closest<HTMLElement>('.container');
    if (!row || !frame || !deck || !board) return;

    // How far the row reaches past the board; layout widths ignore pins and transforms.
    const travel = () => Math.max(0, row.offsetWidth - frame.clientWidth);
    // Where the section's top is held: centred when it fits; otherwise the prints stay fully in
    // view with as much of the heading above them as fits, and the note below gives way first.
    const holdAt = () => {
      const screen = window.innerHeight;
      if (board.offsetHeight <= screen) return (screen - board.offsetHeight) / 2;
      const deckBottom = deck.getBoundingClientRect().bottom - board.getBoundingClientRect().top;
      return Math.min(0, screen - deckBottom - 16);
    };
    let active: ScrollTrigger | undefined;
    const slide = (trigger: ScrollTrigger.Vars) => {
      active = gsap.fromTo(
        row,
        { x: 0 },
        { x: () => -travel(), ease: 'none', scrollTrigger: { scrub: true, invalidateOnRefresh: true, ...trigger } }
      ).scrollTrigger;
      return () => (active = undefined);
    };

    const media = gsap.matchMedia();
    media.add('(min-height: 500px)', () =>
      slide({
        trigger: board,
        start: () => `top ${Math.round(holdAt())}px`,
        // One pixel of scrolling moves the row one pixel; the hold is never shorter than 60% of the screen.
        end: () => `+=${Math.round(Math.max(travel(), window.innerHeight * 0.6))}`,
        pin: true,
        anticipatePin: 1,
        // The pin adds scroll length below it; measure it before the triggers that come after it.
        refreshPriority: 1
      })
    );
    media.add('(max-height: 499px)', () => slide({ trigger: row, start: 'top 80%', end: 'bottom 20%' }));

    // A print reached with the keyboard may still be off the board: scroll to where it is in full view.
    this.listen<FocusEvent>(row, 'focusin', (event) => {
      const item = (event.target as Element).closest<HTMLElement>('.cards__item');
      const max = travel();
      if (!item || !active || !max) return;
      const now = -Number(gsap.getProperty(row, 'x'));
      // The row's transform usually makes it the print's offset parent; otherwise both share one.
      const left = item.offsetLeft - (item.offsetParent === row ? 0 : row.offsetLeft);
      const right = left + item.offsetWidth - frame.clientWidth;
      if (left >= now && right <= now) return;
      const shift = gsap.utils.clamp(0, max, left < now ? left : right);
      const target = active.start + (shift / max) * (active.end - active.start);
      requestAnimationFrame(() => window.scrollTo(0, target));
    });

    // Crossing the breakpoint rebuilds every trigger, and creating the new drift trigger wipes the
    // scroll position ScrollTrigger keeps for that rebuild, which would send the page to the top.
    let kept = window.scrollY;
    this.listen(window, 'scroll', () => {
      kept = window.scrollY;
    }, { passive: true });
    const restore = () => {
      window.scrollTo(0, kept);
      ScrollTrigger.update();
    };
    ScrollTrigger.addEventListener('matchMedia', restore);
    this.onCleanup(() => ScrollTrigger.removeEventListener('matchMedia', restore));
  }

  /**
   * The About photo is pinned beside the text; it swings into its frame as
   * the section arrives (frame tilted and small, photo zoomed and turned),
   * then keeps drifting slowly inside the frame while the visitor reads.
   */
  private portrait(): void {
    const figure = $('.portrait');
    const frame = $('.portrait__frame', figure ?? document);
    const image = $('[data-parallax-img]', figure ?? document);
    const section = figure?.closest('section');
    if (!figure || !frame || !image || !section) return;
    figure.removeAttribute('data-reveal');

    gsap.fromTo(
      frame,
      { rotation: -9, scale: 0.82, y: 80, transformOrigin: '50% 100%' },
      { rotation: 0, scale: 1, y: 0, ease: 'power2.out', scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 15%', scrub: 0.6 } }
    );
    gsap.fromTo(
      image,
      { scale: 1.45, rotation: 10 },
      { scale: 1, rotation: 0, ease: 'power2.out', scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 15%', scrub: 0.6 } }
    );
    // while pinned: a slow push-in, so the photo keeps answering the scroll
    gsap.fromTo(
      frame,
      { '--zoom': 1 },
      { '--zoom': 1.12, ease: 'none', scrollTrigger: { trigger: section, start: 'top 15%', end: 'bottom 60%', scrub: true } }
    );
  }

  /** Quotes blow in word by word, each tilting up from the side, tied to the scroll. */
  private blowWords(): void {
    $$('[data-blow]').forEach((quote) => {
      const split = SplitText.create(quote, { type: 'words' });
      gsap.fromTo(
        split.words,
        { xPercent: 90, rotation: 12, opacity: 0, transformOrigin: '0% 100%' },
        {
          xPercent: 0,
          rotation: 0,
          opacity: 1,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: { trigger: quote, start: 'top 92%', end: 'top 55%', scrub: 0.5 }
        }
      );
    });
  }

  /**
   * A section tips back a little and dims as it leaves the top of the
   * screen, so the eye moves on to the one arriving. The last section stays.
   */
  private recede(): void {
    const sections = $$('main .section, main > [data-recede]').filter((section) => !section.matches('[data-hero]'));
    sections.slice(0, -1).forEach((section) => {
      // A pinned container sits inside its pin spacer; transforming the section instead would unpin it.
      const inner = $(':scope > .container, :scope > .pin-spacer > .container', section) ?? section;
      gsap.to(inner, {
        scale: 0.95,
        opacity: 0.55,
        y: () => window.innerHeight * 0.06,
        transformOrigin: '50% 100%',
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'bottom 55%', end: 'bottom 5%', scrub: true, invalidateOnRefresh: true }
      });
    });
  }

  /** The closing HELLO board grows into place and its arrow slides home. */
  private hello(): void {
    const board = $('[data-hello]');
    if (!board) return;
    const arrow = $('.final__arrow', board);
    const trigger = { trigger: board, start: 'top bottom', end: 'center 55%', scrub: 0.6 };
    gsap.fromTo(board, { scale: 0.62, rotation: -4, transformOrigin: '0% 100%' }, { scale: 1, rotation: 0, ease: 'power2.out', scrollTrigger: trigger });
    if (arrow) gsap.fromTo(arrow, { x: () => -window.innerWidth * 0.25, rotation: -45 }, { x: 0, rotation: 0, ease: 'power2.out', scrollTrigger: { ...trigger } });
  }

  /** On a project page the screenshot settles from a slight zoom as it unfolds. */
  private caseShot(): void {
    const image = $('[data-shot] .case__frame img');
    if (!image) return;
    gsap.fromTo(
      image,
      { scale: 1.18 },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: image.closest('[data-shot]'), start: 'top 95%', end: 'bottom 30%', scrub: true } }
    );
  }
}
