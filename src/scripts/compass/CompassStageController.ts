import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $, $$ } from '../core/dom';
import { compassPoseAt, type SectionId } from '../three/Choreography';
import { CompassScene } from '../three/CompassScene';
import type { PointerKind } from '../three/FreeTurn';

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
 * choreography (`--shown`). The pearl follows a mouse or pen anywhere on the
 * page, goes to a touch and to the focused control, and wakes on a scroll or
 * a key; a drag on the stage turns the dial. The scene draws only while the
 * stage is on screen and the tab is visible. With reduced motion, where
 * CompassScene.supported() is false, without the boot script's `js-motion`
 * flag (BenchLayout), or if the scene fails to start, the stage is marked
 * `data-fallback` and the sections read as a plain stacked page.
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
    // Set before the first frame, so a reload mid-page shows the compass where the scroll is, with no sweep replayed.
    this.progress(trigger.progress);

    // A batch can hold several changes for the stage; the last is where it is now.
    const observer = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.activate();
    });
    observer.observe(stage);
    this.onCleanup(() => observer.disconnect());
    this.listen(document, 'visibilitychange', () => this.activate());

    this.pearl(canvas, scene);
    this.drag(stage, canvas, scene);

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const resized = (): void => {
      // A phone's toolbar sliding away resizes the window but not the stage (100svh).
      if (canvas.clientWidth === width && canvas.clientHeight === height) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // The track is measured in viewport heights: inside it, hold the progress, not the pixel offset.
      // Above or below it (content before or after the stage), the scroll is left where it is.
      const progress = trigger.progress;
      const inside = trigger.isActive && progress > 0 && progress < 1;
      scene.resize();
      ScrollTrigger.refresh();
      lenis.resize();
      if (inside) lenis.scrollTo(trigger.start + progress * (trigger.end - trigger.start), { immediate: true });
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
   * control the keyboard focuses (as much of it as is on the canvas); a
   * scroll or a key only wakes it.
   */
  private pearl(canvas: HTMLCanvasElement, scene: CompassScene): void {
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
    // The focused control's wait for its transition's end: one at a time, and dropped on destroy(), so nothing runs after.
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
      waiting = () => {
        target.removeEventListener('transitionend', settle);
        window.clearTimeout(timer);
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

  /** Moves the scene to `progress` and fades each section's text as the choreography has it there. */
  private progress(progress: number): void {
    // The first call (a page opening partway down, as after a reload) puts the compass where the scroll is,
    // rather than easing it there from the top.
    this.scene?.setProgress(progress, { immediate: !this.started });
    this.started = true;
    const { text } = compassPoseAt(progress);
    for (const [section, id] of this.sections) section.style.setProperty('--shown', String(text[id] ?? 1));
  }
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
