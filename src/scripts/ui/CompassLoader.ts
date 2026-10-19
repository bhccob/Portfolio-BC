import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { SafeStorage } from '../core/SafeStorage';
import { $, format } from '../core/dom';
import { AngleSpring } from '../three/AngleSpring';
import { DEAD_ZONE, easePearl, restAt } from '../three/pearlSpec';
import { LOADING, SEEN_KEY, huntAt, huntRate, loadedShare, loaderVerdict, readout, screenBearing, type LoadShare } from '../compass/loading';

/**
 * What the loader asks of the live scene (CompassScene, which has all of
 * these), so this bundle, the page's first, never imports three.js for it.
 */
export interface HandOverScene {
  /** Answers the handler's unsubscribe. */
  onLoad(handler: (part: 'textures' | 'warm', share: number) => void): () => void;
  ready(): Promise<void>;
  resize(): void;
  matchDial(rim: { x: number; y: number; diameter: number }, needle: { bearing: number; velocity: number }): void;
  setActive(active: boolean): void;
  /** Answers the handler's unsubscribe. */
  onFrame(handler: () => void): () => void;
  /** Resolves when the intro has ended on the scene's drawn frames. */
  startIntro(): Promise<void>;
  pointerAt(x: number, y: number): void;
  touchAt(x: number, y: number): void;
}

/** The longest step a frame counts, seconds: the loader's clock stands still while the tab is hidden and runs no faster than this after. */
const MAX_FRAME = 0.25;

/** Seconds of the loader's clock the scene has to draw its first two frames once handed over, before the loader gives up on it. */
const HAND_OVER_WAIT = 3;

/**
 * Wall-clock milliseconds after the hand-over's end the page's text waits for the intro at most: a scene whose
 * intro never ends (one stuck compiling, say) must not keep the words away. The intro's own end is the normal way.
 */
const TEXT_BACKSTOP = 3000;

const DEGREES = 180 / Math.PI;

type Phase = 'off' | 'hunt' | 'settle' | 'handing' | 'fading' | 'done' | 'gone';

/**
 * The page's stacked layout, for a compass that will not start: the stage
 * hidden (CompassStage's `data-fallback`), and the root marked for the boot
 * script's failsafe (BenchLayout) as the controller would have marked it.
 */
export function stackPage(): void {
  $('[data-compass-stage]')?.setAttribute('data-fallback', '');
  document.documentElement.dataset.bench = 'fallback';
}

/**
 * The compass loader (CompassLoader.astro): a flat drawing of the dial whose
 * needle hunts for north while three.js and the scene load, the percentage
 * under it, and a small pearl on the pointer. Once the scene is ready, and
 * not before it has shown for 1.2 s, the needle settles on the pearl; then
 * the live scene takes over the drawing's exact size and place (matchDial),
 * the needle carrying on as it was, and once the scene has drawn twice the
 * drawing fades and the compass tilts into its pose (startIntro), the page's
 * text waiting until it is there (`compass-intro`, CompassStage; at most
 * three more seconds, whatever the intro does). The pearl
 * eases, rests and steers by the scene's own numbers (pearlSpec). It plays
 * once a session (SEEN_KEY), only where the boot script (BenchLayout) set
 * `compass-loading` (never with reduced motion), and the page cannot scroll
 * while it shows. Ten seconds without the scene ready, or a scene that does
 * not draw once handed over, and it gives up for the stacked page.
 *
 * The entry (compass-main) tells it how the load goes (`loaded`) and passes
 * `handOver` to the stage's controller, which calls it with the scene.
 */
export class CompassLoader extends Component {
  private readonly root = document.documentElement;
  private overlay: HTMLElement | null = null;
  private canvas: HTMLElement | null = null;
  private rim: SVGGraphicsElement | null = null;
  private needle: SVGGElement | null = null;
  private count: HTMLElement | null = null;
  private dot: HTMLElement | null = null;
  private template = '{n}%';
  private phase: Phase = 'off';
  private readonly parts: Partial<Record<LoadShare, number>> = {};
  private shown = 0;
  private percent = -1;
  /** The loader's clock: seconds of frames shown (hidden time does not count). */
  private elapsed = 0;
  private last: number | null = null;
  private raf = 0;
  /** When the needle began to settle, the hand-over began, and the drawing began to fade, on the loader's clock. */
  private mark = 0;
  private readonly spring = new AngleSpring();
  /** The needle as drawn, radians clockwise from north. */
  private bearing = 0;
  private heading: number | null = null;
  /** The mouse or pen, client px; null until one moves over the page. */
  private pointer: [number, number] | null = null;
  /** The pearl as drawn, px relative to the canvas, once placed. */
  private pearl: [number, number] | null = null;
  private scene: HandOverScene | null = null;
  private ready = false;
  private frames = 0;
  /** The first step after the match is skipped: the scene's first frame after switching on steps by 0, and the two needles keep in step. */
  private skipStep = false;
  private settleHandOver: { resolve: () => void; reject: (error: Error) => void } | null = null;

  /** Whether the loader is showing, or about to: the controller then waits for its hand-over. */
  get showing(): boolean {
    return this.phase !== 'off' && this.phase !== 'gone';
  }

  /** Whether it has given up: the compass is not to start. */
  get gaveUp(): boolean {
    return this.phase === 'gone';
  }

  /** Whether the scene has been handed to it. */
  get handed(): boolean {
    return this.scene !== null;
  }

  mount(): void {
    const overlay = $('[data-compass-loader]');
    const canvas = $('[data-compass-canvas]');
    const rim = overlay && $<SVGGraphicsElement>('[data-dial-rim]', overlay);
    const needle = overlay && $<SVGGElement>('[data-loader-needle]', overlay);
    const count = overlay && $('[data-loader-readout]', overlay);
    const wanted = this.root.classList.contains('js-motion') && this.root.classList.contains('compass-loading') && !Motion.reduced;
    if (!wanted || !overlay || !canvas || !rim || !needle || !count) {
      // Nothing to show: the drawing goes, and the page is not to stay locked for a loader that never runs.
      overlay?.remove();
      this.leave();
      return;
    }
    this.overlay = overlay;
    this.canvas = canvas;
    this.rim = rim;
    this.needle = needle;
    this.count = count;
    this.dot = $('[data-loader-pearl]', overlay);
    this.template = count.dataset.template || this.template;
    this.setPhase('hunt');

    this.listen<PointerEvent>(
      window,
      'pointermove',
      (event) => {
        if (event.pointerType !== 'touch') this.pointer = [event.clientX, event.clientY];
      },
      { passive: true }
    );
    this.raf = requestAnimationFrame(this.frame);
    this.onCleanup(() => cancelAnimationFrame(this.raf));
  }

  /** Part of the load has reached `share` (0..1); it never goes back. */
  loaded(part: LoadShare, share: number): void {
    if (Number.isFinite(share)) this.parts[part] = Math.max(this.parts[part] ?? 0, share);
  }

  /**
   * The stage controller's `handOver` (CompassStageController): the loader
   * follows the scene's load, matches it to the drawing, switches it on and
   * fades away; it resolves once the scene has taken over, and rejects if
   * the loader gives up (the controller then destroys the stage).
   */
  readonly handOver = (scene: HandOverScene): Promise<void> => {
    if (!this.showing || this.scene) return Promise.reject(new Error('the compass loader is not waiting for a scene'));
    this.scene = scene;
    // Let go of when the loader leaves, as the frame handler is (handTo).
    this.onCleanup(scene.onLoad((part, share) => this.loaded(part, share)));
    scene.ready().then(() => {
      if (this.scene === scene) this.ready = true;
    });
    return new Promise((resolve, reject) => (this.settleHandOver = { resolve, reject }));
  };

  /**
   * Gives up for the stacked page: the drawing goes, the stage is hidden, and
   * a scene handed over is let go. `why` (and `error`), when given, is
   * logged as a warning.
   */
  giveUp(why?: string, error?: unknown): void {
    if (this.phase === 'gone' || this.phase === 'done') return;
    this.setPhase('gone');
    if (why) console.warn(`[portfolio] ${why}; showing the stacked page`, ...(error === undefined ? [] : [error]));
    this.settleHandOver?.reject(new Error('the compass loader gave up'));
    this.settleHandOver = null;
    stackPage();
    this.root.classList.remove('compass-intro');
    this.leave();
  }

  /**
   * The loader's frame: the readout, the pearl, the needle, and the step the
   * hand-over is at. Whatever throws in it (a scene call refusing the
   * hand-over, say) gives up for the stacked page rather than leave the page
   * locked under a loader that retries every frame.
   */
  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    try {
      this.step(now);
    } catch (error) {
      this.giveUp('the compass loader failed', error);
    }
  };

  private step(now: number): void {
    const dt = this.last === null ? 0 : Math.min(Math.max(0, (now - this.last) / 1000), MAX_FRAME);
    this.last = now;
    this.elapsed += dt;

    // Read the layout first, then write: the canvas and the drawn rim, both in client px.
    const box = this.canvas!.getBoundingClientRect();
    const rimBox = this.rim!.getBoundingClientRect();
    const rim = { x: rimBox.left + rimBox.width / 2 - box.left, y: rimBox.top + rimBox.height / 2 - box.top, diameter: rimBox.width };

    this.showCount(dt);
    this.movePearl(dt, box, rim);

    switch (this.phase) {
      case 'hunt': {
        const verdict = loaderVerdict(this.elapsed, this.ready);
        if (verdict === 'give-up') return this.giveUp(`the compass did not load within ${LOADING.giveUp} s`);
        if (verdict === 'settle') {
          // The spring takes the needle on as the hunt had it, turning at the hunt's speed.
          this.spring.set(huntAt(this.elapsed) / DEGREES, huntRate(this.elapsed) / DEGREES);
          this.setPhase('settle');
          this.mark = this.elapsed;
          this.steer(rim, 0);
        } else {
          this.bearing = huntAt(this.elapsed) / DEGREES;
        }
        break;
      }
      case 'settle':
        this.steer(rim, dt);
        if (this.elapsed - this.mark >= LOADING.settle) this.handTo(box, rim);
        break;
      case 'handing':
        this.steer(rim, dt);
        if (this.elapsed - this.mark >= HAND_OVER_WAIT) return this.giveUp('the compass did not draw once handed over');
        break;
      case 'fading': {
        this.steer(rim, dt);
        const left = 1 - (this.elapsed - this.mark) / LOADING.fade;
        this.overlay!.style.setProperty('--fade', Math.max(0, left).toFixed(3));
        if (left <= 0) return this.finish();
        break;
      }
    }
    this.needle!.setAttribute('transform', `rotate(${(this.bearing * DEGREES).toFixed(2)})`);
  }

  /** Moves the readout on toward what has loaded; the text changes only with the whole percent. */
  private showCount(dt: number): void {
    this.shown = readout(this.shown, loadedShare(this.parts), dt);
    const percent = Math.floor(this.shown * 100);
    if (percent === this.percent) return;
    this.percent = percent;
    this.count!.textContent = format(this.template, { n: percent });
  }

  /** The pearl, eased toward the pointer, or resting below-right of the rim (a touch screen, a mouse not yet moved). */
  private movePearl(dt: number, box: DOMRect, rim: { x: number; y: number; diameter: number }): void {
    const want: [number, number] = this.pointer
      ? [this.pointer[0] - box.left, this.pointer[1] - box.top]
      : restAt(rim.x, rim.y, rim.diameter, box.width, box.height);
    this.pearl = this.pearl ? [easePearl(this.pearl[0], want[0], dt), easePearl(this.pearl[1], want[1], dt)] : want;
    if (!this.dot) return;
    this.dot.style.transform = `translate3d(${(this.pearl[0] + box.left).toFixed(1)}px, ${(this.pearl[1] + box.top).toFixed(1)}px, 0)`;
    if (!('placed' in this.dot.dataset)) this.dot.dataset.placed = '';
  }

  /** The needle's spring, `dt` on toward the pearl's bearing about the rim's centre (held while the pearl is over the pivot). */
  private steer(rim: { x: number; y: number; diameter: number }, dt: number): void {
    const [x, y] = this.pearl!;
    const dx = x - rim.x;
    const dy = y - rim.y;
    if (Math.hypot(dx, dy) >= (DEAD_ZONE * rim.diameter) / 2 || this.heading === null) this.heading = screenBearing(dx, dy);
    this.bearing = this.spring.step(this.heading, this.skipStep ? 0 : dt);
    this.skipStep = false;
  }

  /**
   * The hand-over: the scene's pearl where the drawing's is, the dial matched
   * to the drawn rim with the needle carrying on, and the scene switched on.
   * The drawing fades once the scene has drawn its second frame.
   */
  private handTo(box: DOMRect, rim: { x: number; y: number; diameter: number }): void {
    const scene = this.scene!;
    // The scene's pearl starts where it wants to be: on the pointer; or, with none, held for a moment where this one
    // rests, from where the scene eases it on to its own rest spot.
    if (this.pointer) scene.pointerAt(this.pointer[0] - box.left, this.pointer[1] - box.top);
    else scene.touchAt(this.pearl![0], this.pearl![1]);
    // The page's text stays out of the way until the compass has moved into its pose.
    this.root.classList.add('compass-intro');
    scene.resize();
    scene.matchDial(rim, { bearing: this.spring.value, velocity: this.spring.velocity });
    scene.setActive(true);
    this.setPhase('handing');
    this.mark = this.elapsed;
    this.skipStep = true;
    this.onCleanup(
      scene.onFrame(() => {
        if (this.phase !== 'handing' || ++this.frames < 2) return;
        this.setPhase('fading');
        this.mark = this.elapsed;
      })
    );
  }

  /**
   * The drawing has faded: the page is unlocked and the drawing gone first,
   * whatever the scene does next; then the compass tilts into its pose, the
   * page's text showing once the intro has ended on the scene's frames, and
   * the session remembers. An intro that cannot start gives up instead.
   */
  private finish(): void {
    const scene = this.scene!;
    this.leave();
    let ended: Promise<void>;
    try {
      // Whatever it answers is waited on as a promise, so nothing below can throw on it.
      ended = Promise.resolve(scene.startIntro());
    } catch (error) {
      this.giveUp('the compass intro could not start', error);
      return;
    }
    this.setPhase('done');
    SafeStorage.session().set(SEEN_KEY, '1');
    this.settleHandOver?.resolve();
    this.settleHandOver = null;
    const showText = (): void => this.root.classList.remove('compass-intro');
    ended.then(showText, showText);
    // The loader is gone by now (leave() above), so nothing cancels this; showing the text twice is harmless.
    window.setTimeout(showText, TEXT_BACKSTOP);
  }

  /** Moves to `phase`, shown on the drawing as `data-phase` (for the proof scripts and a look in the inspector). */
  private setPhase(phase: Phase): void {
    this.phase = phase;
    if (this.overlay) this.overlay.dataset.phase = phase;
  }

  /** Takes the drawing away and unlocks the page; the frames, the listeners and the scene's handlers go with it. */
  private leave(): void {
    this.root.classList.remove('compass-loading');
    this.overlay?.remove();
    this.destroy();
  }
}
