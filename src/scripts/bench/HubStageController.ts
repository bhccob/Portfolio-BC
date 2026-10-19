import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $ } from '../core/dom';
import { hubPoseAt, type HubLayerId } from '../three/HubChoreography';
import { HubScene } from '../three/HubScene';
import { Callouts } from '../ui/Callouts';

/**
 * Narrower than 760px, or narrower than 6:5 (where the scene centres the
 * device and leaves no room on its right), the callouts are a list under the
 * device instead of leaders to a column.
 */
const NARROW = '(width < 760px), (aspect-ratio < 6/5)';

/** The layers answer the pointer once the callouts are this far faded in. */
const INTERACTIVE_FROM = 0.9;

/**
 * The hub stage (HubStage.astro): Lenis smooth scrolling and one
 * ScrollTrigger over the track scrub the handheld from closed to the
 * exploded hub (the first half of the track), where the callouts fade in and
 * the hub holds. A drag on the stage turns the device; once the callouts
 * show, hovering a label or a layer highlights both, and a click pins the
 * highlight. The scene draws only while the stage is on screen and the tab
 * is visible. With reduced motion, without WebGL on a GPU, without the boot
 * script's `js-motion` flag (BenchLayout), or if the scene fails to start,
 * the stage is marked `data-fallback` and reads as a plain stacked page.
 *
 * Either way the root is marked `data-bench` ("live" or "fallback"), which
 * tells the boot script's failsafe that this module ran.
 */
export class HubStageController extends Component {
  private scene: HubScene | null = null;
  private callouts: Callouts | null = null;
  private onScreen = false;
  private active = false;
  private started = false;
  /** How far the callouts are faded in at the scroll's progress (0..1). */
  private shown = 0;
  private interactive: boolean | null = null;
  private narrow = false;
  private labelHover: HubLayerId | null = null;
  private layerHover: HubLayerId | null = null;
  private pinned: HubLayerId | null = null;
  private highlighted: HubLayerId | null | undefined = undefined;

  mount(): void {
    const track = $('[data-hub-track]');
    const stage = $('[data-hub-stage]');
    const canvas = stage && $<HTMLCanvasElement>('[data-hub-canvas]', stage);
    if (!track || !stage || !canvas) return;

    // The pinned layout is keyed to js-motion; once the failsafe has taken it off, the page stays stacked.
    const root = document.documentElement;
    if (root.classList.contains('js-motion') && !Motion.reduced && HubScene.supported()) {
      try {
        this.start(track, stage, canvas);
        root.dataset.bench = 'live';
        return;
      } catch (error) {
        console.warn('[portfolio] the hub scene could not start; showing the stacked page', error);
        this.destroy();
      }
    }
    stage.setAttribute('data-fallback', '');
    root.dataset.bench = 'fallback';
  }

  private start(track: HTMLElement, stage: HTMLElement, canvas: HTMLCanvasElement): void {
    // Building the scene is about half a second of main-thread work: it is done here, before the first scroll.
    const scene = new HubScene(canvas, { finePointer: Motion.finePointer });
    this.scene = scene;
    this.onCleanup(() => {
      scene.dispose();
      this.scene = null;
    });

    const calloutsRoot = $('[data-callouts]', stage);
    const callouts = calloutsRoot ? new Callouts(calloutsRoot) : null;
    this.callouts = callouts;
    if (callouts) {
      this.onCleanup(() => {
        callouts.dispose();
        this.callouts = null;
      });
      callouts.onHover((id) => {
        this.labelHover = id;
        this.highlight();
      });
      callouts.onClick((id) => this.pin(this.pinned === id ? null : id));
    }
    scene.onLayer((id, kind) => {
      if (kind === 'click') return this.pin(id);
      this.layerHover = id;
      this.highlight();
    });

    const narrow = window.matchMedia(NARROW);
    this.narrow = narrow.matches;
    this.listen<MediaQueryListEvent>(narrow, 'change', (event) => (this.narrow = event.matches));
    // The callouts follow the frame just drawn; none is placed before the first (the scene draws nothing
    // while its programs compile, so stale anchors are never shown).
    scene.onFrame(() => this.callouts?.update(scene.anchors(), this.shown, this.narrow));

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

    const trigger = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => this.progress(self.progress)
    });
    this.onCleanup(() => trigger.kill());
    // Set before the first frame, so a reload mid-page shows the device where the scroll is, already open.
    this.progress(trigger.progress);

    // A batch can hold several changes for the stage; the last is where it is now.
    const observer = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.activate();
    });
    observer.observe(stage);
    this.onCleanup(() => observer.disconnect());
    this.listen(document, 'visibilitychange', () => this.activate());

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
  }

  /**
   * The drag that turns the device: one pointer at a time, pressed anywhere
   * on the stage but a label, forwarded to the scene. The stage's
   * `touch-action: pan-y` leaves a vertical swipe to the page's scroll (the
   * browser then cancels the pointer); only a mostly horizontal drag turns
   * the device. The canvas holds the capture, so the click that ends a press
   * still reaches its picking (which ignores a click that turned).
   */
  private drag(stage: HTMLElement, canvas: HTMLCanvasElement, scene: HubScene): void {
    let pointer: number | null = null;
    const end = (event: PointerEvent, cancel: boolean): void => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      if (cancel) scene.pointerCancel();
      else scene.pointerUp();
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
      scene.pointerDown(event.clientX, event.clientY);
    });
    this.listen<PointerEvent>(stage, 'pointermove', (event) => {
      if (event.pointerId === pointer) scene.pointerMove(event.clientX, event.clientY);
    });
    this.listen<PointerEvent>(stage, 'pointerup', (event) => end(event, false));
    this.listen<PointerEvent>(stage, 'pointercancel', (event) => end(event, true));
    this.listen<PointerEvent>(stage, 'lostpointercapture', (event) => end(event, true));
  }

  /** Draws frames only while the stage is on screen in a visible tab, sized afresh each time it starts. */
  private activate(): void {
    const active = this.onScreen && document.visibilityState === 'visible';
    if (active === this.active) return;
    this.active = active;
    if (active) this.scene?.resize();
    this.scene?.setActive(active);
  }

  private progress(progress: number): void {
    // The first call (a page opening partway down, as after a reload) puts the device where the scroll is,
    // rather than easing it open from closed.
    this.scene?.setProgress(progress, { immediate: !this.started });
    this.started = true;
    this.shown = hubPoseAt(progress).callouts;
    // The layers answer the pointer only once the callouts show; leaving the hub lets go of every highlight.
    const interactive = this.shown > INTERACTIVE_FROM;
    if (interactive === this.interactive) return;
    this.interactive = interactive;
    this.scene?.setInteractive(interactive);
    if (!interactive) {
      this.labelHover = null;
      this.layerHover = null;
      this.pin(null);
    }
  }

  /** Pins a layer's highlight (null: unpins), as a click on its label or on the layer does. */
  private pin(id: HubLayerId | null): void {
    this.pinned = id;
    this.callouts?.pin(id);
    this.highlight();
  }

  /** One layer is highlighted, with its callout: the label under the pointer or focus, else the layer, else the pinned one. */
  private highlight(): void {
    const id = this.labelHover ?? this.layerHover ?? this.pinned;
    if (id === this.highlighted) return;
    this.highlighted = id;
    this.scene?.highlightLayer(id);
    this.callouts?.highlight(id);
  }
}
