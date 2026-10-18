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
 * while the board is in view. The scene draws only while the stage is on
 * screen and the tab is visible. With reduced motion, without WebGL, or if
 * the scene fails to start, the stage is marked `data-fallback` and reads as
 * a plain stacked page instead.
 *
 * The portrait goes to the scene still loading: the device shows at once and
 * its display lights up when the image arrives.
 */
export class DeviceStageController extends Component {
  private scene: DeviceScene | null = null;
  private stage: HTMLElement | null = null;
  private sections: HTMLElement[] = [];
  private readout: HTMLElement | null = null;
  private names: Record<string, string> = {};
  private section: SectionId | null = null;
  /** The chip under the pointer, wherever the scroll is; shown only on the board. */
  private hovered: string | null = null;
  private onScreen = false;
  private active = false;

  mount(): void {
    const track = $('[data-device-track]');
    const stage = $('[data-device-stage]');
    const canvas = stage && $<HTMLCanvasElement>('[data-device-canvas]', stage);
    if (!track || !stage || !canvas) return;

    if (!Motion.reduced && DeviceScene.supported()) {
      try {
        this.start(track, stage, canvas);
        return;
      } catch (error) {
        console.warn('[portfolio] the device scene could not start; showing the stacked page', error);
        this.destroy();
      }
    }
    stage.setAttribute('data-fallback', '');
  }

  private start(track: HTMLElement, stage: HTMLElement, canvas: HTMLCanvasElement): void {
    const screen = new Image();
    screen.decoding = 'async';
    screen.src = portrait.src;

    this.names = readJson<Record<string, string>>(stage, 'data-chip-names', {});
    const scene = new DeviceScene(canvas, {
      finePointer: Motion.finePointer,
      screen,
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
    scene.onChip((slug, kind) => this.chip(slug, kind));

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
    // Section and target are set before the first frame, so a reload mid-page shows its own section.
    this.progress(trigger.progress);

    const observer = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      this.activate();
    });
    observer.observe(stage);
    this.onCleanup(() => observer.disconnect());
    this.listen(document, 'visibilitychange', () => this.activate());

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    // A phone's toolbar sliding away resizes the window but not the stage (100svh).
    this.listen(window, 'resize', () => {
      if (canvas.clientWidth === width && canvas.clientHeight === height) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // The track is measured in viewport heights: hold the progress, not the pixel offset.
      const progress = trigger.progress;
      scene.resize();
      ScrollTrigger.refresh();
      lenis.resize();
      lenis.scrollTo(trigger.start + progress * (trigger.end - trigger.start), { immediate: true });
    });

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
    this.scene?.setProgress(progress);
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
    this.show(section === 'projects' ? this.hovered : null);
  }

  /** Chips answer only on the board; a click names its chip as hover does (project pages come later). */
  private chip(slug: string | null, kind: 'hover' | 'click'): void {
    if (kind === 'hover') this.hovered = slug;
    if (this.section === 'projects') this.show(slug);
  }

  private show(slug: string | null): void {
    if (this.readout) this.readout.textContent = slug ? (this.names[slug] ?? '') : '';
  }
}
