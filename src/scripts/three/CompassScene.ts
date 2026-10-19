import * as THREE from 'three';
import { AngleSpring, wrapAngle } from './AngleSpring';
import { dialLayout, lerpShot, placeCamera, type Shot } from './CameraRig';
import { compassPoseAt, locate, OFF_AXIS, tipLimit, type CompassPose } from './Choreography';
import { FreeTurn, type PointerKind } from './FreeTurn';
import { needleTarget, Pearl, PEARL, PearlTarget, pointerBearing } from './Pearl';
import { budgetLimit, PixelBudget, VSYNC } from './PixelBudget';
import { qualityFor, qualitySteps, type Quality } from './quality';
import { RenderLoop } from './RenderLoop';
import { asleep, STILL } from './stillness';
import { warmScene } from './TextureWarmup';
import { DIAL } from './instrument/dialSpec';
import { buildInstrument, type InstrumentModel } from './instrument/Instrument';
import { paintInstrument, type Painted } from './instrument/paint';
import { loadInstrumentTextures, type InstrumentTextures } from './instrument/textures';
import { buildCompassStudio, type CompassStudio } from './studio/CompassStudio';
import { glowTexture } from './studio/noise';

/**
 * The compass on its canvas: the luopan in its dark studio (CompassStudio),
 * the pearl the needle chases, and the camera. Scroll sets a target progress
 * the scene eases towards; every frame poses the camera, the ring pattern, the
 * needle, the portrait and the threads from the choreography at the eased
 * progress. The pearl follows the pointer (or drifts, on touch), the dial
 * leans toward it, and a drag spins it (FreeTurn).
 *
 * The load (onLoad, ready()) loads, paints, uploads and compiles before any
 * frame is drawn. Frames run only while it is switched on (setActive), and
 * none is drawn while nothing moves (stillness.ts). The loader hands over
 * through matchDial() and startIntro(). Construct it only where `supported()`
 * is true; even then the constructor throws if the browser refuses the
 * context, having let go of whatever it had built. Pointer positions are CSS
 * pixels relative to the canvas.
 */

export interface CompassSceneOptions {
  /** A mouse or trackpad: the sharper ladder, the finer paint, and a pearl that rests until the pointer moves. */
  finePointer: boolean;
  /** The portrait for the heaven pool (a URL); without one the pool stays lacquer. */
  portrait?: string;
}

export type LoadPart = 'textures' | 'warm';

const FOV = 30;
const NEAR = 0.1;
const FAR = 100;

/** Progress and the pearl's screen position ease at these rates (MathUtils.damp's λ), at most MAX_STEP s a frame, so a tab coming back does not jump. */
const PROGRESS_DAMP = 8;
const PEARL_DAMP = 10;
const MAX_STEP = 0.1;

/** Seconds from the matched shot to the pose's own. */
const INTRO = 1.2;

/** How the quality ladder's budget judges frames, as the hub's did (see PixelBudget, budgetLimit). */
const BUDGET_OPTIONS = { limit: 1 / 56, slowRun: 3 } as const;

/** Anisotropic filtering for the image maps and the painted canvases, seen at a slant. */
const ANISOTROPY = 8;

/** The most the dial leans toward the pearl, radians. */
const LEAN = (OFF_AXIS.lean * Math.PI) / 180;

/** The share of the warm-up the painting takes; the uploads and the compile take the rest. */
const PAINT_SHARE = 0.6;

function smootherstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (6 * x - 15) + 10);
}

/** A TextureLoader that calls `settled` as each file loads or fails. */
class SettlingLoader extends THREE.TextureLoader {
  constructor(private readonly settled: () => void) {
    super();
  }

  override loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<THREE.Texture<HTMLImageElement>> {
    return super.loadAsync(url, onProgress).finally(this.settled);
  }
}

export class CompassScene {
  /**
   * Whether a WebGL2 context can be created here on a GPU. A browser drawing
   * WebGL in software (SwiftShader standing in for a missing or blocklisted
   * GPU) reports a major performance caveat and gets the stacked page.
   */
  static supported(): boolean {
    try {
      const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return gl !== null;
    } catch {
      return false;
    }
  }

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
  private readonly instrument: InstrumentModel;
  private readonly finePointer: boolean;
  /** Null until the display's refresh is measured, and for good if it could not be (no budget then). */
  private budget: PixelBudget | null = null;
  /** Idle frame intervals (seconds) while nothing is drawn, until there are enough to tell the refresh. */
  private readonly idle: number[] = [];
  private measured = false;
  private quality: Quality;
  private readonly loop = new RenderLoop((dt) => this.tick(dt));
  private readonly turn = new FreeTurn();
  /** The needle, in the mount's frame (needleTarget). */
  private readonly spring = new AngleSpring();
  private readonly target: PearlTarget;
  private studio: CompassStudio | null = null;
  private pearl: Pearl | null = null;
  private glow: THREE.DataTexture | null = null;
  private readonly frameHandlers: (() => void)[] = [];
  private readonly loadHandlers: ((part: LoadPart, share: number) => void)[] = [];
  /** Run once after the next frame drawn (letting go of the clearcoat stand-ins once the lacquer has switched). */
  private readonly afterFrame: (() => void)[] = [];
  private readonly listeners: [string, EventListener][] = [];
  private readonly shares: Record<LoadPart, number> = { textures: 0, warm: 0 };
  /** The image maps and painted canvases, the scene's to free (the model never frees what it is handed). */
  private textures: InstrumentTextures = {};
  private painted: Painted | null = null;
  /** Lets go of the stand-ins holding the clearcoat-off programs; null once let go, or when none are held. */
  private releaseCoat: (() => void) | null = null;
  private readonly whenReady: Promise<void>;
  private resolveReady: () => void = () => {};
  /** The textures have settled, the canvases are painted and the programs compiled: frames may be drawn. */
  private loaded = false;
  /** A restored context's programs are compiling again: nothing is drawn meanwhile. */
  private compiling = false;
  /** Something changed that the canvas does not show yet: the next frame draws, still or not. */
  private dirty = true;
  private readonly start = performance.now();
  private goal = 0;
  private progress = 0;
  /** The loader's face-on shot (matchDial), until the intro has moved off it. */
  private matched: Shot | null = null;
  /** Seconds into the intro, or null before startIntro(). */
  private intro: number | null = null;
  /** The pearl drawn, in CSS px, and whether it has a place yet (it starts where it wants to be). */
  private readonly pearlAt: [number, number] = [0, 0];
  private pearlPlaced = false;
  /** The pearl's last bearing in the mount's frame, held while it is over the pivot. */
  private lastPearl = 0;
  /** The needle as drawn: radians on the dial. */
  private needle = 0;
  private lastSpin = 0;
  /** The next update puts the needle straight onto its target (an immediate progress). */
  private snapNeedle = false;
  private time = 0;
  private width = 0;
  private height = 0;
  private disposed = false;
  private readonly point = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: CompassSceneOptions
  ) {
    this.finePointer = options.finePointer;
    this.target = new PearlTarget(this.finePointer);
    this.quality = qualityFor(0, this.finePointer);
    this.whenReady = new Promise((resolve) => (this.resolveReady = resolve));
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    try {
      this.studio = buildCompassStudio(this.renderer, this.scene, Math.max(...this.ladder().map((step) => step.dust)));
      this.instrument = buildInstrument();
      this.glow = glowTexture();
      this.pearl = new Pearl(this.glow);
      this.scene.add(this.instrument.root, this.pearl.object);

      // A restored context has lost the environment map and every program and upload, which live only on the GPU.
      this.listeners.push(['webglcontextrestored', () => this.restore()]);
      for (const [type, listener] of this.listeners) canvas.addEventListener(type, listener);

      this.setQuality(this.quality);
      void this.load(options.portrait);
    } catch (error) {
      // Whatever was built goes, and the context with it, rather than stay with the canvas for the life of the page.
      this.dispose();
      throw error;
    }
  }

  /** Calls `handler` as each part of the load moves on (0..1), starting with where each part stands now. */
  onLoad(handler: (part: LoadPart, share: number) => void): void {
    this.loadHandlers.push(handler);
    for (const part of ['textures', 'warm'] as const) if (this.shares[part] > 0) handler(part, this.shares[part]);
  }

  /**
   * Resolves once the textures have settled (loaded or failed), the canvases
   * are painted and the programs compiled; no frame is drawn before. A scene
   * disposed before then never resolves.
   */
  ready(): Promise<void> {
    return this.whenReady;
  }

  /**
   * Sets the progress (0..1) the scene eases towards; out of range is clamped
   * and NaN reads as 0. `immediate` puts the scene there at once, needle
   * included (unless the loader's hand-over holds it), for a page that opens
   * partway down: its pose, its pattern, no sweep replayed.
   */
  setProgress(progress: number, { immediate = false }: { immediate?: boolean } = {}): void {
    this.goal = Number.isNaN(progress) ? 0 : THREE.MathUtils.clamp(progress, 0, 1);
    if (!immediate || this.disposed) return;
    this.progress = this.goal;
    this.snapNeedle = this.matched === null;
    this.dirty = true;
    this.update(0);
  }

  /** Starts or stops drawing frames, as the canvas comes on screen or leaves it. */
  setActive(active: boolean): void {
    if (this.disposed || active === this.loop.running) return;
    if (active) {
      // The first frames back compile, upload and resize; the budget leaves them out.
      this.budget?.restart();
      this.dirty = true;
    }
    this.loop.setActive(active);
  }

  /** Matches the drawing buffer, the dust and the camera to the canvas's size on the page. */
  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.disposed || width === 0 || height === 0) return;
    this.width = width;
    this.height = height;
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.studio?.dust.setScale((height * ratio) / 2);
    // A resized buffer is blank until drawn again.
    this.dirty = true;
    this.update(0);
  }

  /** Calls `handler` after every frame drawn. */
  onFrame(handler: () => void): void {
    this.frameHandlers.push(handler);
  }

  /**
   * The loader's hand-over: the dial face-on with its rim at `rim` (centre
   * and diameter, CSS px relative to the canvas), no lean, and the needle
   * carrying on at the loader's `bearing` (radians, clockwise from screen
   * north) and `velocity` (rad/s). Held until startIntro().
   */
  matchDial(rim: { x: number; y: number; diameter: number }, needle: { bearing: number; velocity: number }): void {
    if (this.disposed || !(rim.diameter > 0) || !Number.isFinite(rim.x) || !Number.isFinite(rim.y)) return;
    this.matched = { layout: { x: rim.x, y: rim.y, diameter: rim.diameter }, tilt: 0, zoom: 1, near: NEAR };
    this.intro = null;
    this.spring.set(needle.bearing, needle.velocity);
    this.lastPearl = this.spring.value;
    this.snapNeedle = false;
    // The pearl starts where it wants to be, and the frames of the hand-over are drawn whatever else is still.
    this.pearlPlaced = false;
    this.target.wake(this.clock());
    this.dirty = true;
    this.update(0);
  }

  /** Moves from the matched shot to the pose's own over 1.2 s (smootherstep), the lean easing in with it. */
  startIntro(): void {
    if (this.disposed || !this.matched || this.intro !== null) return;
    this.intro = 0;
    this.target.wake(this.clock());
  }

  /** A mouse or pen at (x, y): the pearl follows it. */
  pointerAt(x: number, y: number): void {
    if (!this.disposed) this.target.pointer(x, y, this.clock());
  }

  /** A finger down at (x, y): the pearl goes there for a moment. */
  touchAt(x: number, y: number): void {
    if (!this.disposed) this.target.touch(x, y, this.clock());
  }

  /** The focused control's centre at (x, y): the pearl holds there until the next pointer, touch or focus. */
  focusAt(x: number, y: number): void {
    if (!this.disposed) this.target.focus(x, y, this.clock());
  }

  /** A scroll or a key: the pearl is no longer idle, so the scene draws again. */
  wake(): void {
    if (!this.disposed) this.target.wake(this.clock());
  }

  /** A press at (x, y) of `kind`, in CSS px (client or canvas, as long as the moves match), for the free turn. */
  dragStart(x: number, y: number, kind: PointerKind): void {
    if (this.disposed) return;
    this.turn.down(x, y, kind);
    this.target.wake(this.clock());
  }

  /** The press moves to (x, y). */
  dragMove(x: number, y: number): void {
    if (this.disposed) return;
    this.turn.move(x, y, this.width, this.height, this.clock());
    this.target.wake(this.clock());
  }

  /** The press ends: the dial coasts and settles on a whole turn, the tip springs back. */
  dragEnd(): void {
    if (!this.disposed) this.turn.up(this.clock());
  }

  /** The press was taken away (pointercancel, lostpointercapture): released with no speed. */
  dragCancel(): void {
    if (!this.disposed) this.turn.cancel();
  }

  /**
   * For the proof (`?proof`): the section and how far through it, the quality
   * step, the spin and the needle (radians, on the dial), the pearl (CSS px),
   * and the dial as drawn: its projected centre and rim diameter in CSS px.
   */
  debugState(): { section: string; local: number; step: number; spin: number; bearing: number; pearl: [number, number]; rim: { x: number; y: number; diameter: number } } {
    const { id, local } = locate(this.progress);
    return {
      section: id,
      local,
      step: this.budget?.step ?? 0,
      spin: this.instrument.spin.rotation.y,
      bearing: this.needle,
      pearl: [this.pearlAt[0], this.pearlAt[1]],
      rim: this.rim()
    };
  }

  /**
   * Stops the frames and frees the model, its maps, the studio, the pearl and
   * the renderer, then lets the canvas's context go. Safe to call twice.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.setActive(false);
    for (const [type, listener] of this.listeners) this.canvas.removeEventListener(type, listener);
    this.frameHandlers.length = 0;
    this.loadHandlers.length = 0;
    this.instrument?.dispose();
    for (const map of this.maps()) map.dispose();
    this.releaseCoat?.();
    this.releaseCoat = null;
    for (const release of this.afterFrame.splice(0)) release();
    this.studio?.dispose();
    this.pearl?.dispose();
    this.glow?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private clock(): number {
    return (performance.now() - this.start) / 1000;
  }

  private tick(dtSeconds: number): void {
    // The display's refresh is measured on idle frames after the load, whose painting and uploads would lengthen them.
    if (!this.measured && this.loaded && !this.compiling) this.measure(dtSeconds);
    const still = this.update(Math.min(dtSeconds, MAX_STEP));
    // Nothing is drawn (the canvas keeps the studio's clear colour) until the load is done and the display's refresh is
    // measured; nor while everything is still and the canvas already shows it.
    if (!this.loaded || this.compiling || !this.measured || (still && !this.dirty)) return;
    // Frames running slow step down the quality ladder; the buffer is resized before this frame draws.
    if (this.budget && this.budget.sample(dtSeconds) !== null) this.setQuality(qualityFor(this.budget.step, this.finePointer));
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    for (const release of this.afterFrame.splice(0)) release();
    for (const handler of this.frameHandlers) handler();
  }

  /**
   * Counts one idle frame's interval towards the display's refresh. Once there
   * are enough, the budget judges by the limit they give (budgetLimit), or
   * there is none if they gave none. The first frame after the load waits for
   * them (8 refreshes), once per page.
   */
  private measure(dtSeconds: number): void {
    if (dtSeconds > 0) this.idle.push(dtSeconds);
    if (this.idle.length < VSYNC.samples) return;
    this.measured = true;
    const limit = budgetLimit(this.idle, BUDGET_OPTIONS.limit);
    if (limit === null) return;
    this.budget = new PixelBudget(this.ladder().map((step) => step.pixelRatio), { ...BUDGET_OPTIONS, limit });
    this.budget.restart();
  }

  /**
   * One step of `dt` seconds: eases the progress, places the camera, the
   * pearl and the lean, turns the dial, steers the needle and poses the
   * model. Answers whether everything is still (asleep()); the dust and the
   * haze move on only when it is not.
   */
  private update(dt: number): boolean {
    const { width, height } = this;
    const sized = width > 0 && height > 0;
    this.progress = THREE.MathUtils.damp(this.progress, this.goal, PROGRESS_DAMP, dt);
    if (Math.abs(this.goal - this.progress) < 1e-5) this.progress = this.goal;
    const pose = compassPoseAt(this.progress);

    // The camera, and how much of the pose's own shot (and of the lean) the hand-over lets in.
    const own = this.intro === null ? (this.matched ? 0 : 1) : this.introStep(dt);
    const shot = this.shotFor(pose, own);
    placeCamera(this.camera, shot, width, height);

    // The pearl, eased toward where it wants to be (and put straight there the first time).
    const [wantX, wantY] = this.target.at(this.clock(), width, height, dialLayout(width, height));
    const ease = (from: number, to: number): number => {
      const next = this.pearlPlaced ? THREE.MathUtils.damp(from, to, PEARL_DAMP, dt) : to;
      return Math.abs(to - next) < STILL.pearl ? to : next;
    };
    if (sized) {
      this.pearlAt[0] = ease(this.pearlAt[0], wantX);
      this.pearlAt[1] = ease(this.pearlAt[1], wantY);
      this.pearlPlaced = true;
    }
    const ndcX = sized ? (this.pearlAt[0] / width) * 2 - 1 : 0;
    const ndcY = sized ? 1 - (this.pearlAt[1] / height) * 2 : 0;

    // The free turn, and the lean toward the pearl on top of the tip.
    const turn = this.turn.step(dt, tipLimit(shot.tilt));
    const spin = wrapAngle(turn.spin);
    const lean = LEAN * own;
    const { root, mount, dial } = this.instrument;
    this.instrument.spin.rotation.y = spin;
    root.rotation.set(-lean * THREE.MathUtils.clamp(ndcY, -1, 1) + turn.tip, lean * THREE.MathUtils.clamp(ndcX, -1, 1), 0);
    root.updateMatrixWorld(true);

    // The pearl on its plane, 0.6 rim in front of the face centre along the face's normal.
    this.anchor.set(0, 1, 0).transformDirection(dial.matrixWorld).multiplyScalar(PEARL.plane * DIAL.rim);
    this.anchor.add(this.point.setFromMatrixPosition(dial.matrixWorld));
    this.pearl?.place(this.pearlAt[0], this.pearlAt[1], this.camera, width, height, this.anchor);

    // The needle: toward the pearl on the face, in the mount's frame so it holds still while the dial turns under it,
    // blended with the scripted bearing, through the spring.
    const bearing = sized ? pointerBearing(ndcX, ndcY, this.camera, mount) : null;
    if (bearing !== null) this.lastPearl = bearing;
    const heading = needleTarget(this.lastPearl, (pose.needle.bearing * Math.PI) / 180, pose.needle.weight, spin);
    if (this.snapNeedle) this.spring.set(heading, 0);
    this.snapNeedle = false;
    this.needle = wrapAngle(this.spring.step(heading, dt) + spin);
    this.instrument.applyPose({ bearing: this.needle, lift: pose.needle.lift, portrait: pose.portrait, threads: pose.threads });
    this.instrument.setPattern(pose.pattern.from, pose.pattern.to, pose.pattern.sweep, pose.pattern.origin);

    const still = asleep({
      idle: this.target.idle(this.clock()),
      pearl: Math.hypot(wantX - this.pearlAt[0], wantY - this.pearlAt[1]),
      needle: wrapAngle(heading - this.spring.value),
      needleSpeed: this.spring.velocity,
      dragging: this.turn.engaged,
      spin,
      spinSpeed: dt > 0 ? (turn.spin - this.lastSpin) / dt : turn.spin === this.lastSpin ? 0 : Infinity,
      tip: turn.tip,
      progressed: this.progress === this.goal,
      intro: this.matched !== null
    });
    this.lastSpin = turn.spin;
    if (!still) {
      this.time += dt;
      this.studio?.setTime(this.time);
    }
    return still;
  }

  /** Moves the intro on by `dt` and answers how far it is (smootherstep, 0..1); at 1 the matched shot is let go. */
  private introStep(dt: number): number {
    this.intro = (this.intro ?? 0) + dt;
    if (this.intro < INTRO) return smootherstep(this.intro / INTRO);
    this.matched = null;
    this.intro = null;
    return 1;
  }

  /** The pose's own shot for the canvas, or `own` of the way there from the matched shot. */
  private shotFor(pose: CompassPose, own: number): Shot {
    const current: Shot = { layout: dialLayout(this.width, this.height), ...pose.framing };
    if (!this.matched) return current;
    return own <= 0 ? this.matched : lerpShot(this.matched, current, own);
  }

  /** The dial as drawn: the face centre and a rim point along the camera's right, projected to CSS px. */
  private rim(): { x: number; y: number; diameter: number } {
    if (!(this.width > 0 && this.height > 0)) return { x: 0, y: 0, diameter: 0 };
    const toPixels = (p: THREE.Vector3): [number, number] => [((p.x + 1) / 2) * this.width, ((1 - p.y) / 2) * this.height];
    const centre = new THREE.Vector3().setFromMatrixPosition(this.instrument.dial.matrixWorld);
    const edge = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize().multiplyScalar(DIAL.rim).add(centre);
    const [x, y] = toPixels(centre.project(this.camera));
    const [ex, ey] = toPixels(edge.project(this.camera));
    return { x, y, diameter: 2 * Math.hypot(ex - x, ey - y) };
  }

  /** The quality ladder for this pointer, best first. */
  private ladder(): Quality[] {
    return Array.from({ length: qualitySteps(this.finePointer) }, (_, step) => qualityFor(step, this.finePointer));
  }

  /** Applies a step of the quality ladder: the dust, the clearcoat and the pixel ratio (through resize). */
  private setQuality(quality: Quality): void {
    const coatOff = this.quality.clearcoat && !quality.clearcoat;
    this.quality = quality;
    this.studio?.dust.setCount(quality.dust);
    this.instrument.setClearcoat(quality.clearcoat);
    if (coatOff && this.releaseCoat) {
      // The stand-ins hold the clearcoat-off programs until the lacquer has drawn with them.
      this.afterFrame.push(this.releaseCoat);
      this.releaseCoat = null;
    }
    this.dirty = true;
    this.resize();
  }

  /** Every map the scene holds: the image textures and the painted canvases. */
  private maps(): THREE.Texture[] {
    const painted = this.painted ? [this.painted.face, this.painted.mr, ...Object.values(this.painted.strips)] : [];
    return [...Object.values(this.textures), ...painted].filter((map): map is THREE.Texture => !!map);
  }

  /** Tells the load handlers that `part` has reached `share`, never going back. */
  private report(part: LoadPart, share: number): void {
    const value = Math.min(1, Math.max(0, share));
    if (this.disposed || !(value > this.shares[part])) return;
    this.shares[part] = value;
    for (const handler of this.loadHandlers) handler(part, value);
  }

  /**
   * The load: the image files (textures 0 → 1 as each settles), the canvases
   * painted one a frame (warm 0 → 0.6), then every map uploaded and every
   * program compiled (0.6 → 1). Whatever fails is left plain; the scene is
   * ready either way, unless it was disposed.
   */
  private async load(portrait?: string): Promise<void> {
    try {
      const files = portrait ? 3 : 2;
      let settled = 0;
      this.textures = await loadInstrumentTextures(portrait, new SettlingLoader(() => this.report('textures', ++settled / files)));
      if (this.disposed) {
        for (const map of this.maps()) map.dispose();
        return;
      }
      this.report('textures', 1);
      const anisotropy = Math.min(ANISOTROPY, this.renderer.capabilities.getMaxAnisotropy());
      this.instrument.setTextures(this.textures);
      try {
        const lacquer = this.textures.lacquer?.image as CanvasImageSource | undefined;
        this.painted = await paintInstrument(this.finePointer, lacquer, (share) => this.report('warm', PAINT_SHARE * share));
      } catch {
        // No canvas to paint on: the face and the ring keep their plain placeholders.
      }
      // Disposed meanwhile: dispose() has freed what there was, but not maps painted since.
      if (this.disposed) {
        for (const map of this.maps()) map.dispose();
        return;
      }
      for (const map of this.maps()) map.anisotropy = anisotropy;
      if (this.painted) {
        this.instrument.setFace(this.painted.face, this.painted.mr);
        this.instrument.setStrips(this.painted.strips);
      }
      this.report('warm', PAINT_SHARE);
      await this.warm((share) => this.report('warm', PAINT_SHARE + (1 - PAINT_SHARE) * share));
    } catch {
      // Something unforeseen: the scene shows what it has rather than strand the page.
    }
    if (this.disposed) return;
    this.report('textures', 1);
    this.report('warm', 1);
    this.loaded = true;
    this.dirty = true;
    this.resolveReady();
  }

  /**
   * Uploads every map and compiles every program (warmScene), holding the
   * clearcoat-off ones while the lacquer still has its clearcoat, until the
   * ladder turns it off.
   */
  private async warm(progress?: (share: number) => void): Promise<void> {
    const coated = this.quality.clearcoat;
    const release = await warmScene(this.renderer, this.scene, this.camera, this.maps(), coated, () => this.disposed, progress);
    if (this.disposed || !coated || !this.quality.clearcoat) {
      release();
      return;
    }
    this.releaseCoat?.();
    this.releaseCoat = release;
  }

  /** After a lost context comes back: the environment again, then every upload and program before the next frame. */
  private restore(): void {
    if (this.disposed) return;
    this.studio?.relight();
    this.dirty = true;
    // A context lost mid-load is warmed by the load itself.
    if (!this.loaded) return;
    this.compiling = true;
    void this.warm().finally(() => {
      this.compiling = false;
      this.dirty = true;
      this.budget?.restart();
    });
  }
}
