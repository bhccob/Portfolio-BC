import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $, $$, readJson } from '../core/dom';
import { carryProgress } from '../three/applyPose';
import { compassPoseAt, locate, nominalSpans, spansFromOffsets, type SectionId, type Span } from '../three/Choreography';
import { CompassScene } from '../three/CompassScene';
import type { PointerKind } from '../three/FreeTurn';
import type { TrackId } from '../three/instrument/drive';
import { readingProgress } from './reading';

/** How far right of its point each label stands, px (CompassStage.astro's `.compass__label--head` and `--hover`). */
const HEAD_OFFSET = 18;
const HOVER_OFFSET = 14;

/**
 * On a narrow screen, the share of the viewport's height a focused question
 * is kept below: under the small drive's band, where the Q&A's words fade
 * (CompassStage.astro's 34%), with a little room.
 */
const QA_BAND = 0.38;

declare global {
  interface Window {
    /** The scene's debugState(), set only on a page opened with `?proof`, for the proof scripts. */
    __compassDebug?: () => ReturnType<CompassScene['debugState']>;
  }
}

export interface CompassStageOptions {
  /**
   * The loader's hand-over (Task 7): given the scene, it matches the dial to
   * the loader's drawing and switches the scene on itself, and resolves once
   * the scene has taken over. Until then the controller leaves the scene off
   * and Lenis stopped; a hand-over that rejects leaves the stacked page.
   */
  handOver?: (scene: CompassScene) => Promise<void>;
}

/**
 * The compass stage (CompassStage.astro): Lenis smooth scrolling and one
 * ScrollTrigger over the track scrub the compass through the sections
 * (CompassScene.setProgress), and fade each section's text by the
 * choreography (`--shown`), each section's share of the scroll measured off
 * the page (the Q&A is as tall as its content) and handed to the scene
 * (setSpans): on start, after every ScrollTrigger refresh (a resize among
 * them, which holds the visitor's place among the spans), on a `toggle`
 * inside the track and whenever the track's size changes (fonts, images).
 * The pearl follows a mouse or pen anywhere on the page, goes to a touch and
 * to the focused control, and wakes on a scroll or a key; a control the
 * keyboard reaches where its section's words are faded out brings them in
 * (reading.ts), as a link to a section (`#cookies-clicker`) does on arrival;
 * a section's links and questions take the pointer only while its words show.
 * A drag on the stage turns the dial. After every frame the
 * stage's overlays follow the scene (CompassScene.overlay): the test point's
 * label at the read head, the hovered track's name at the pointer, the Off
 * duty orbit round the spindle. A click on a track opens its project, as its
 * link does; an opened question lights its sector of the platter. The scene
 * draws only while the stage is on screen and the tab is visible. With
 * reduced motion, where CompassScene.supported() is false, without the boot
 * script's `js-motion` flag (BenchLayout), or if the scene fails to start,
 * the stage is marked `data-fallback` and the sections read as a plain
 * stacked page.
 *
 * Either way the root is marked `data-bench` ("live" or "fallback"), which
 * tells the boot script's failsafe that this module ran. With `?proof` in the
 * address, `window.__compassDebug()` answers the scene's debugState().
 */
export class CompassStageController extends Component {
  private scene: CompassScene | null = null;
  private stage: HTMLElement | null = null;
  private onScreen = false;
  private active = false;
  private started = false;
  /** False while a hand-over is under way: the scene is the loader's to switch on until then. */
  private handedOver: boolean;
  private sections: [HTMLElement, SectionId][] = [];
  /** Each section's place in the scroll, as last measured (measuredSpans); the scene locates its pose among the same. */
  private spans: readonly Span[] = nominalSpans();
  /** The Off duty orbit over the canvas, whose opacity follows Off duty's words. */
  private orbit: HTMLElement | null = null;
  /** The canvas's size in CSS px, as last measured on start or a resize (the overlays read it every frame). */
  private canvasSize = { width: 0, height: 0 };

  constructor(private readonly options: CompassStageOptions = {}) {
    super();
    this.handedOver = !options.handOver;
  }

  mount(): void {
    const track = $('[data-compass-track]');
    const stage = track && $('[data-compass-stage]', track);
    const canvas = stage && $<HTMLCanvasElement>('[data-compass-canvas]', stage);
    if (!track || !stage || !canvas) return;
    this.stage = stage;

    // The pinned layout is keyed to js-motion; once the failsafe has taken it off, the page stays stacked.
    const root = document.documentElement;
    if (root.classList.contains('js-motion') && !Motion.reduced && CompassScene.supported()) {
      try {
        this.start(track, stage, canvas);
        root.dataset.bench = 'live';
        return;
      } catch (error) {
        console.warn('[portfolio] the compass could not start; showing the stacked page', error);
        this.destroy();
      }
    }
    this.fallBack();
  }

  /** The stacked page: the stage hidden, the sections in plain flow. */
  private fallBack(): void {
    this.stage?.setAttribute('data-fallback', '');
    document.documentElement.dataset.bench = 'fallback';
  }

  private start(track: HTMLElement, stage: HTMLElement, canvas: HTMLCanvasElement): void {
    // Building the scene is a good part of a second of main-thread work: it is done here, before the first scroll.
    const scene = new CompassScene(canvas, { finePointer: Motion.finePointer, portrait: stage.dataset.portrait || undefined });
    this.scene = scene;
    this.onCleanup(() => {
      scene.dispose();
      this.scene = null;
    });

    if (location.search.includes('proof')) {
      window.__compassDebug = () => scene.debugState();
      this.onCleanup(() => delete window.__compassDebug);
    }

    this.sections = $$('[data-section]', track).map((section) => [section, section.dataset.section as SectionId]);
    this.orbit = $('[data-compass-orbit]', stage);
    this.canvasSize = { width: canvas.clientWidth, height: canvas.clientHeight };

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
    const raf = (time: number): void => lenis.raf(time * 1000);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    this.onCleanup(() => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    });
    // The page holds still while the loader shows; the hand-over's end lets it scroll.
    if (this.options.handOver) lenis.stop();

    const trigger = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => this.progress(self.progress)
    });
    this.onCleanup(() => trigger.kill());
    const measure = (): void => {
      this.spans = measuredSpans(track, this.sections) ?? nominalSpans();
      scene.setSpans(this.spans);
    };
    // Measured before the first frame and set there, so a reload mid-page shows the compass where the scroll is, with no
    // sweep replayed.
    measure();
    // A link to one of the sections (/#cookies-clicker) lands where its words show and its pose is whole (on a track,
    // the head on it and the track lit), not at the section's very top, where the browser's jump to the anchor puts it
    // and the head is still on its way there; moved on before the first frame. A scroll the browser restored elsewhere
    // (a reload after scrolling on) is left where it is.
    const anchored = anchorTarget(this.sections, location.hash);
    const range = trigger.end - trigger.start;
    let landed: number | null = null;
    if (anchored && range > 0) {
      const now = Math.min(1, Math.max(0, (window.scrollY - trigger.start) / range));
      const to = locate(now, this.spans).id === anchored ? readingProgress(anchored, now, this.spans) : null;
      if (to !== null && to !== now) {
        lenis.scrollTo(trigger.start + to * range, { immediate: true, force: true });
        landed = to;
      }
    }
    // ScrollTrigger reads the scroll it cached until the browser's scroll event comes: a place just landed on is set as
    // it is, at once, so the scene does not start from the old one and ease over.
    this.progress(landed ?? trigger.progress, true);
    // Every refresh (a resize, the page's load) may have moved the sections: measured again, the text faded again.
    const refreshed = (): void => {
      measure();
      this.progress(trigger.progress);
    };
    ScrollTrigger.addEventListener('refresh', refreshed);
    this.onCleanup(() => ScrollTrigger.removeEventListener('refresh', refreshed));
    // A question opened or closed (the Q&A's <details>; `toggle` does not bubble, so it is caught on the way down): its
    // sector lights, the last opened of those still open, or none; and the track's height has changed, so the trigger is
    // refreshed, and the spans with it.
    const opened: number[] = [];
    this.listen(
      track,
      'toggle',
      (event) => {
        const item = event.target;
        if (item instanceof HTMLDetailsElement && item.dataset.question !== undefined) {
          const index = Number(item.dataset.question);
          if (opened.includes(index)) opened.splice(opened.indexOf(index), 1);
          if (item.open) opened.push(index);
          scene.setSector(opened.length > 0 ? opened[opened.length - 1] : null);
        }
        ScrollTrigger.refresh();
        lenis.resize();
      },
      { capture: true }
    );
    // The track's size changing for any other reason (fonts arriving, a late reflow): measured again, once a frame at most.
    let reflow = 0;
    const sized = new ResizeObserver(() => {
      if (reflow) return;
      reflow = requestAnimationFrame(() => {
        reflow = 0;
        ScrollTrigger.refresh();
        lenis.resize();
      });
    });
    sized.observe(track);
    this.onCleanup(() => {
      sized.disconnect();
      cancelAnimationFrame(reflow);
    });

    // A batch can hold several changes for the stage; the last is where it is now.
    const observer = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.activate();
    });
    observer.observe(stage);
    this.onCleanup(() => observer.disconnect());
    this.listen(document, 'visibilitychange', () => this.activate());

    /**
     * Where the keyboard's focus lands in a section whose words are faded out there (a link the browser scrolled to
     * the edge of its section), the scroll moves to the nearest place they show; on a narrow screen, a question under
     * the small drive's band, where the Q&A's words fade, comes down below it. Answers whether it moved.
     */
    const reveal = (target: Element): boolean => {
      const id = target.closest<HTMLElement>('[data-section]')?.dataset.section as SectionId | undefined;
      const range = trigger.end - trigger.start;
      if (!id || !(range > 0)) return false;
      const now = Math.min(1, Math.max(0, (window.scrollY - trigger.start) / range));
      const to = readingProgress(id, now, this.spans);
      if (to !== null && to !== now) {
        lenis.scrollTo(trigger.start + to * range, { immediate: true });
        return true;
      }
      // Narrow as the dial's layout has it (CameraRig: under 6 : 5).
      const { width, height } = this.canvasSize;
      if (id !== 'qa' || !(width < 1.2 * height)) return false;
      const band = QA_BAND * window.innerHeight;
      const top = target.getBoundingClientRect().top;
      if (!(top < band)) return false;
      lenis.scrollTo(window.scrollY + top - band, { immediate: true });
      return true;
    };

    this.pearl(canvas, scene, reveal);
    this.drag(stage, canvas, scene);
    this.overlays(stage, canvas, scene);

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const resized = (): void => {
      // A phone's toolbar sliding away resizes the window but not the stage (100svh).
      if (canvas.clientWidth === width && canvas.clientHeight === height) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      this.canvasSize = { width, height };
      // The track is measured in viewport heights: inside it, hold the visitor's place (the section and how far through
      // it, among the spans before and after the change: the Q&A's height reflows with the width), not the pixel
      // offset. Above or below it (content before or after the stage), the scroll is left where it is.
      const progress = trigger.progress;
      const inside = trigger.isActive && progress > 0 && progress < 1;
      const before = this.spans;
      scene.resize();
      // Its refresh event measures the spans again (refreshed).
      ScrollTrigger.refresh();
      lenis.resize();
      if (inside) lenis.scrollTo(trigger.start + carryProgress(progress, before, this.spans) * (trigger.end - trigger.start), { immediate: true });
    };
    // One run per frame. The first resize event of a frame is handled at once, while the progress is
    // still the visitor's: a turn between portrait and landscape makes ScrollTrigger refresh itself (its
    // own orientation query) before the next frame, which would move it. Any later event in the same
    // frame is handled once, in the next.
    let gate = 0;
    let again = false;
    const onResize = (): void => {
      if (gate) {
        again = true;
        return;
      }
      resized();
      gate = requestAnimationFrame(() => {
        gate = 0;
        if (again) {
          again = false;
          onResize();
        }
      });
    };
    this.listen(window, 'resize', onResize);
    this.onCleanup(() => cancelAnimationFrame(gate));

    // The canvas may not have its size until layout has run.
    const frame = requestAnimationFrame(() => scene.resize());
    this.onCleanup(() => cancelAnimationFrame(frame));

    const { handOver } = this.options;
    if (handOver) {
      handOver(scene).then(
        () => {
          // The hand-over switched the scene on; from here it follows the screen and the tab, and the page scrolls.
          if (this.scene !== scene) return;
          this.handedOver = true;
          this.activate(true);
          lenis.start();
          // The page's lock lifted, its scrollbar may take (or give back) width without a resize event.
          onResize();
        },
        (error: unknown) => {
          if (this.scene !== scene) return;
          console.warn('[portfolio] the compass hand-over failed; showing the stacked page', error);
          this.destroy();
          this.fallBack();
        }
      );
    }
  }

  /**
   * The pearl's inputs, in CSS pixels relative to the canvas: a mouse or pen
   * moving anywhere on the page, a finger coming down, the centre of the
   * control the keyboard focuses (as much of it as is on the canvas; met
   * again where `reveal` scrolls it into its words' place, once the browser
   * has scrolled it into view); a scroll or a key only wakes it.
   */
  private pearl(canvas: HTMLCanvasElement, scene: CompassScene, reveal: (target: Element) => boolean): void {
    const passive = { passive: true };
    this.listen<PointerEvent>(
      window,
      'pointermove',
      (event) => {
        if (event.pointerType === 'touch') return;
        const box = canvas.getBoundingClientRect();
        scene.pointerAt(event.clientX - box.left, event.clientY - box.top);
      },
      passive
    );
    this.listen<PointerEvent>(
      window,
      'pointerdown',
      (event) => {
        if (event.pointerType !== 'touch') return;
        const box = canvas.getBoundingClientRect();
        scene.touchAt(event.clientX - box.left, event.clientY - box.top);
      },
      passive
    );
    const focusOn = (target: Element): void => {
      const box = canvas.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      // A container as large as the canvas (the main element, focused by the skip link) is no place to point at.
      if (rect.width >= box.width && rect.height >= box.height) return;
      // The part of the control on the canvas; one wholly off it is met at the nearest edge.
      const left = Math.max(rect.left, box.left);
      const right = Math.min(rect.right, box.right);
      const top = Math.max(rect.top, box.top);
      const bottom = Math.min(rect.bottom, box.bottom);
      const x = left <= right ? (left + right) / 2 : Math.min(Math.max(rect.left, box.left), box.right);
      const y = top <= bottom ? (top + bottom) / 2 : Math.min(Math.max(rect.top, box.top), box.bottom);
      scene.focusAt(x - box.left, y - box.top);
    };
    // The focused control's waits, for its transition's end and for the frame after the browser's scroll to it: one
    // control at a time, and dropped on destroy(), so nothing runs after.
    let waiting: (() => void) | null = null;
    const stopWaiting = (): void => {
      waiting?.();
      waiting = null;
    };
    this.onCleanup(stopWaiting);
    this.listen<FocusEvent>(document, 'focusin', (event) => {
      const target = event.target;
      // The keyboard's focus only: a click focuses too (the main element takes it), and the pointer already has the pearl.
      if (!(target instanceof Element) || !focusVisible(target)) return;
      focusOn(target);
      // A control that moves as it takes the focus (the skip link slides into view) is met where it comes to rest.
      stopWaiting();
      const settle = (): void => {
        if (document.activeElement === target) focusOn(target);
      };
      target.addEventListener('transitionend', settle, { once: true });
      const timer = window.setTimeout(stopWaiting, 1000);
      // The browser scrolls a control into view after its focus event: a frame later the words around it are brought
      // in where they are faded out there, and the pearl meets the control where that leaves it.
      const frame = requestAnimationFrame(() => {
        if (document.activeElement === target && reveal(target)) focusOn(target);
      });
      waiting = () => {
        target.removeEventListener('transitionend', settle);
        window.clearTimeout(timer);
        cancelAnimationFrame(frame);
      };
    });
    this.listen(window, 'scroll', () => scene.wake(), passive);
    this.listen(window, 'keydown', () => scene.wake());
  }

  /**
   * The drag that turns the dial: one pointer at a time, pressed anywhere on
   * the stage but a link or a button, forwarded to the scene with its kind
   * (a touch spins only, and only when mostly horizontal; FreeTurn). The
   * stage's `touch-action: pan-y pinch-zoom` leaves a vertical swipe to the
   * page's scroll and two fingers to its zoom (the browser then cancels the
   * pointer). The canvas holds the capture, so the press keeps turning the
   * dial wherever it goes.
   */
  private drag(stage: HTMLElement, canvas: HTMLCanvasElement, scene: CompassScene): void {
    let pointer: number | null = null;
    const end = (event: PointerEvent, cancel: boolean): void => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      if (cancel) scene.dragCancel();
      else scene.dragEnd();
    };
    this.listen<PointerEvent>(stage, 'pointerdown', (event) => {
      if (pointer !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if ((event.target as Element | null)?.closest('button, a')) return;
      pointer = event.pointerId;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that is already gone: its pointerup or pointercancel ends the press.
      }
      scene.dragStart(event.clientX, event.clientY, kindOf(event));
    });
    this.listen<PointerEvent>(stage, 'pointermove', (event) => {
      if (event.pointerId === pointer) scene.dragMove(event.clientX, event.clientY);
    });
    this.listen<PointerEvent>(stage, 'pointerup', (event) => end(event, false));
    this.listen<PointerEvent>(stage, 'pointercancel', (event) => end(event, true));
    this.listen<PointerEvent>(stage, 'lostpointercapture', (event) => end(event, true));
  }

  /**
   * The stage's decorative overlays and the tracks' clicks. After every frame
   * drawn, from the scene's overlay(): the head's label ("TP1 · LOG", written
   * at build time per track and test point) at the read head while a test
   * point is under it, and the orbit on the spindle in Off duty (its centre,
   * reach and turn). The hovered track's name follows the pointer while the
   * scene reports one. A click on a track goes where its section's link goes:
   * a new tab for one that leaves the site; the unwritten track has none.
   * Positions are CSS custom properties (unitless canvas px and degrees); the
   * elements show by `data-shown`.
   */
  private overlays(stage: HTMLElement, canvas: HTMLCanvasElement, scene: CompassScene): void {
    const head = $('[data-compass-head]', stage);
    const hover = $('[data-compass-hover]', stage);
    const orbit = this.orbit;
    const labels = head ? readJson<Partial<Record<TrackId, string[]>>>(head, 'data-labels', {}) : {};
    const names = hover ? readJson<Partial<Record<TrackId, string>>>(hover, 'data-names', {}) : {};
    const place = (element: HTMLElement, x: number, y: number): void => {
      element.style.setProperty('--x', x.toFixed(1));
      element.style.setProperty('--y', y.toFixed(1));
    };
    const show = (element: HTMLElement, shown: boolean): void => {
      if (element.hasAttribute('data-shown') !== shown) element.toggleAttribute('data-shown', shown);
    };
    // A label's width, read when its words change; one that would run off the canvas's right edge from `x` (its
    // offset and a margin of 8px) stands left of its point instead. The canvas's width is the one the resize path
    // measured, so a frame reads no layout after its style writes.
    const widths = new Map<HTMLElement, number>();
    const write = (element: HTMLElement, text: string): void => {
      if (element.textContent === text) return;
      element.textContent = text;
      widths.set(element, element.offsetWidth);
    };
    const flip = (element: HTMLElement, x: number, offset: number): void => {
      const flipped = x + offset + (widths.get(element) ?? 0) > this.canvasSize.width - 8;
      if (element.hasAttribute('data-flip') !== flipped) element.toggleAttribute('data-flip', flipped);
    };

    this.onCleanup(
      scene.onFrame(() => {
        const overlay = scene.overlay();
        if (head) {
          const { x, y, visible, track: under, tp } = overlay.head;
          const text = visible && under !== null && tp !== null ? (labels[under]?.[tp] ?? '') : '';
          // Fading out, the label keeps its last words and stays with the head.
          if (text) write(head, text);
          if (visible) {
            flip(head, x, HEAD_OFFSET);
            place(head, x, y);
          }
          show(head, text !== '');
        }
        if (orbit) {
          const { x, y, radius, angle, visible } = overlay.spindle;
          if (visible) {
            place(orbit, x, y);
            orbit.style.setProperty('--r', radius.toFixed(1));
            orbit.style.setProperty('--a', angle.toFixed(2));
          }
          show(orbit, visible);
        }
      })
    );

    // The pointer, as the pearl has it (a mouse or pen, CSS px on the canvas): the hover label stands beside it.
    const pointer = { x: 0, y: 0 };
    this.listen<PointerEvent>(
      window,
      'pointermove',
      (event) => {
        if (event.pointerType === 'touch') return;
        const box = canvas.getBoundingClientRect();
        pointer.x = event.clientX - box.left;
        pointer.y = event.clientY - box.top;
        if (!hover?.hasAttribute('data-shown')) return;
        flip(hover, pointer.x, HOVER_OFFSET);
        place(hover, pointer.x, pointer.y);
      },
      { passive: true }
    );

    const links = new Map<TrackId, HTMLAnchorElement>();
    for (const [section, id] of this.sections) {
      const link = $<HTMLAnchorElement>('a[data-track-link]', section);
      if (link) links.set(id as TrackId, link);
    }
    this.onCleanup(
      scene.onTrack((under, kind) => {
        if (kind === 'hover') {
          if (!hover) return;
          const name = under === null ? '' : (names[under] ?? '');
          if (name) {
            write(hover, name);
            flip(hover, pointer.x, HOVER_OFFSET);
            place(hover, pointer.x, pointer.y);
          }
          show(hover, name !== '');
          return;
        }
        const link = under === null ? undefined : links.get(under);
        if (!link) return;
        if (link.target === '_blank') window.open(link.href, '_blank', 'noopener,noreferrer');
        else location.assign(link.href);
      })
    );
  }

  /**
   * Draws frames only while the stage is on screen in a visible tab (and,
   * with a hand-over, once it is done), sized afresh each time it starts.
   * `force` applies the state even where it seems unchanged: the hand-over
   * switched the scene on behind the controller's back.
   */
  private activate(force = false): void {
    const active = this.handedOver && this.onScreen && document.visibilityState === 'visible';
    if (active === this.active && !force) return;
    this.active = active;
    if (active) this.scene?.resize();
    this.scene?.setActive(active);
  }

  /**
   * Moves the scene to `progress` (at once when `immediate`: the first call, and the start's) and fades each section's
   * text as the choreography has it there, among the measured spans; a section whose words show at all is marked
   * `data-on`, and only there do its links and questions take the pointer (a faded one is neither clicked nor hovered
   * through the words on screen).
   */
  private progress(progress: number, immediate = !this.started): void {
    // The first call (a page opening partway down, as after a reload) puts the compass where the scroll is,
    // rather than easing it there from the top.
    this.scene?.setProgress(progress, { immediate });
    this.started = true;
    const { text } = compassPoseAt(progress, this.spans);
    for (const [section, id] of this.sections) {
      const shown = text[id] ?? 1;
      section.style.setProperty('--shown', String(shown));
      if (section.hasAttribute('data-on') !== shown > 0) section.toggleAttribute('data-on', shown > 0);
    }
    this.orbit?.style.setProperty('--shown', String(text.offduty));
  }
}

/**
 * The sections' spans as laid out now: each one's top from the track's top (as
 * an offsetTop from the track would read, sub-pixel), over the track's scroll
 * range, its height less the viewport's (the ScrollTrigger runs `top top` to
 * `bottom bottom`). Null where there is no range to scroll or no section.
 */
function measuredSpans(track: HTMLElement, sections: readonly [HTMLElement, SectionId][]): Span[] | null {
  const range = track.offsetHeight - window.innerHeight;
  if (!(range > 0) || sections.length === 0) return null;
  const top = track.getBoundingClientRect().top;
  return spansFromOffsets(
    sections.map(([section, id]) => ({ id, top: section.getBoundingClientRect().top - top })),
    range
  );
}

/** The section the address's fragment names (`#cookies-clicker`), by its element's id, or null. */
function anchorTarget(sections: readonly [HTMLElement, SectionId][], hash: string): SectionId | null {
  if (hash.length < 2) return null;
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
  return sections.find(([section]) => section.id === id)?.[1] ?? null;
}

/** Whether `element` has the keyboard's focus ring (`:focus-visible`); true where a browser cannot tell. */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** A pointer event's kind as the free turn reads it: a pen, a finger, or else a mouse. */
function kindOf(event: PointerEvent): PointerKind {
  return event.pointerType === 'pen' || event.pointerType === 'touch' ? event.pointerType : 'mouse';
}
