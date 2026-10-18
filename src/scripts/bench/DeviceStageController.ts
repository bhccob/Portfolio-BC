import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import portrait from '../../assets/portrait.jpg';
import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { $, $$, readJson } from '../core/dom';
import { DeviceScene } from '../three/DeviceScene';
import { sectionAt, type SectionId } from '../three/Teardown';

/**
 * The device stage (DeviceStage.astro): Lenis smooth scrolling and one
 * ScrollTrigger over the track scrub the teardown, the section the scroll is
 * in shows its text, and the chip under the pointer is named on the HUD
 * while the board is in view (the chips answer nowhere else). The scene
 * draws only while the stage is on screen and the tab is visible. With
 * reduced motion, without WebGL on a GPU, without the boot script's
 * `js-motion` flag (BenchLayout), or if the scene fails to start, the stage
 * is marked `data-fallback` and reads as a plain stacked page instead.
 *
 * Either way the root is marked `data-bench` ("live" or "fallback"), which
 * tells the boot script's failsafe that this module ran.
 *
 * The scene loads the portrait itself: the device shows at once and its
 * display lights up when the image arrives.
 */
export class DeviceStageController extends Component {
  private scene: DeviceScene | null = null;
  private stage: HTMLElement | null = null;
  private sections: HTMLElement[] = [];
  private readout: HTMLElement | null = null;
  private names: Record<string, string> = {};
  private section: SectionId | null = null;
  private onScreen = false;
  private active = false;

  mount(): void {
    const track = $('[data-device-track]');
    const stage = $('[data-device-stage]');
    const canvas = stage && $<HTMLCanvasElement>('[data-device-canvas]', stage);
    if (!track || !stage || !canvas) return;

    // The pinned layout is keyed to js-motion; once the failsafe has taken it off, the page stays stacked.
    const root = document.documentElement;
    if (root.classList.contains('js-motion') && !Motion.reduced && DeviceScene.supported()) {
      try {
        this.start(track, stage, canvas);
        root.dataset.bench = 'live';
        return;
      } catch (error) {
        console.warn('[portfolio] the device scene could not start; showing the stacked page', error);
        this.destroy();
      }
    }
    stage.setAttribute('data-fallback', '');
    root.dataset.bench = 'fallback';
  }

  private start(track: HTMLElement, stage: HTMLElement, canvas: HTMLCanvasElement): void {
    this.names = readJson<Record<string, string>>(stage, 'data-chip-names', {});
    const scene = new DeviceScene(canvas, {
      finePointer: Motion.finePointer,
      screen: portrait.src,
      specLines: readJson<string[]>(stage, 'data-spec-lines', []),
      chipLabels: this.names
    });
    this.scene = scene;
    this.onCleanup(() => {
      scene.dispose();
      this.scene = null;
    });

    this.stage = stage;
    this.sections = $$('[data-section]', stage);
    this.readout = $('[data-chip-readout]', stage);
    scene.onChip((slug) => this.chip(slug));

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
    // Section, target and chips are set before the first frame, so a reload mid-page shows its own section,
    // the device already open.
    this.progress(trigger.progress);

    // A batch can hold several changes for the stage; the last is where it is now.
    const observer = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.activate();
    });
    observer.observe(stage);
    this.onCleanup(() => observer.disconnect());
    this.listen(document, 'visibilitychange', () => this.activate());

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
    this.scene?.setProgress(progress, { immediate: this.section === null });
    const section = sectionAt(progress);
    if (section === this.section) return;
    // The page arrives showing hello; a reload further down swaps to its section at once, not as a crossfade.
    const settle = this.section === null ? this.stage : null;
    this.section = section;
    if (settle) settle.setAttribute('data-settling', '');
    for (const element of this.sections) element.toggleAttribute('data-active', element.dataset.section === section);
    if (settle) {
      void settle.offsetWidth;
      settle.removeAttribute('data-settling');
    }
    // The chips answer on the board alone. The readout starts empty; on the board, the next frame names
    // the chip under the pointer.
    this.scene?.setInteractive(section === 'projects');
    this.show(null);
  }

  /** The chip under the pointer, or clicked (project pages come later), named on the HUD while the board is in view. */
  private chip(slug: string | null): void {
    if (this.section === 'projects') this.show(slug);
  }

  private show(slug: string | null): void {
    if (this.readout) this.readout.textContent = slug ? (this.names[slug] ?? '') : '';
  }
}
