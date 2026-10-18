import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChipPointer } from './ChipPointer';
import { buildDevice, type DeviceModel } from './Device';
import { mono, paintScreen, paintShadow, paintSilkscreen, paintSpec, type Plate } from './labels';
import { palette } from './palette';
import { PixelBudget } from './PixelBudget';
import { RenderLoop } from './RenderLoop';
import { poseAt, type Pose } from './Teardown';

/**
 * The home device on its canvas: the renderer, the light, the camera that
 * follows the teardown, and the chips answering the pointer. Scroll sets a
 * target progress, which the scene eases towards on every frame; frames run
 * only while it is switched on (setActive), and the chips answer the pointer
 * only while it is interactive (setInteractive). The canvas is transparent,
 * so the page shows round the device. Construct it only where `supported()`
 * is true; even then the constructor throws if the browser refuses the
 * context, having let go of whatever it had built.
 */

export interface DeviceSceneOptions {
  /** A mouse or trackpad, which earns a sharper canvas. */
  finePointer: boolean;
  /** The portrait's address; loaded here and cover-cropped onto the display once it arrives. */
  screen?: string;
  /** The spec label's lines (two). */
  specLines: readonly string[];
  /** Names printed on the chips, keyed by slug; a chip without one stays plain. */
  chipLabels?: Readonly<Record<string, string>>;
}

/** A chip under the pointer (null: none), on hover changes and on clicks. */
export type ChipHandler = (slug: string | null, kind: 'hover' | 'click') => void;

/**
 * The highest pixel ratio drawn, for a fine and a coarse pointer, and the
 * steps it comes down by while frames run slow (PixelBudget).
 */
const PIXEL_RATIO = { fine: [1.75, 1.25, 1], coarse: [1.25, 1] };

const FOV = 35;

/** Narrower than this, the camera backs off so the device keeps its width in frame. */
const FRAME_ASPECT = 1.2;

/** Progress eases towards its target at this rate (MathUtils.damp's λ). */
const PROGRESS_DAMP = 8;

/** The longest step the easing takes in one frame, so a tab coming back does not jump. */
const MAX_STEP = 0.1;

/** The room's share of the light; at full strength it greys the dark purples. */
const ENVIRONMENT_INTENSITY = 0.6;

/** The room's walls take the site's lilac, so what the dark parts reflect is purple, not grey. */
const ROOM_WALLS = palette.lilac;

/** The one key light, above and to the front right, strong enough to show the yellow at its own colour. */
const KEY = { intensity: 2.4, position: [2.5, 6, 3.5] as const };

/** Idle sway in hello: ±3° about y over `period` seconds, fading in and out at `damp`. */
const SWAY = { amplitude: THREE.MathUtils.degToRad(3), period: 7, damp: 3 };

/** A hovered chip lifts this far and glows yellow at this intensity, easing at `damp`. */
const HOVER = { lift: 0.06, glow: 0.25, damp: 14 };

/** The contact shadow: a plane just under the back plate, wider than the body. */
const SHADOW = { width: 4.6, depth: 2.9, y: -0.002 };

/** The chip names sit this far above the chip's top, over the pin-1 dot. */
const SILKSCREEN_LIFT = 0.003;

/** Anisotropic filtering for the printed textures, seen at a slant. */
const ANISOTROPY = 8;

const ignoreRays: THREE.Object3D['raycast'] = () => {};

/** RoomEnvironment with its walls (the one inward-facing box) in ROOM_WALLS. */
function room(): RoomEnvironment {
  const scene = new RoomEnvironment();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    if (material.side === THREE.BackSide) material.color.set(ROOM_WALLS);
  });
  return scene;
}

/**
 * The chip under `pointer` (normalised device coordinates) as `camera` sees
 * it, judged with every chip at rest on the board: a lifted chip answers
 * where it stands, so hover and click agree, and a chip rising out from under
 * the pointer does not flicker. Null when something else, or nothing, is in
 * front. The chips are back at their heights when it returns.
 */
export function chipAt(
  device: DeviceModel,
  rest: readonly number[],
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  raycaster = new THREE.Raycaster()
): THREE.Mesh | null {
  const heights = device.chips.map((chip) => chip.position.y);
  device.chips.forEach((chip, i) => (chip.position.y = rest[i]));
  device.group.updateWorldMatrix(true, true);
  raycaster.setFromCamera(pointer, camera);
  const [hit] = raycaster.intersectObject(device.group, true);
  device.chips.forEach((chip, i) => (chip.position.y = heights[i]));
  device.group.updateWorldMatrix(false, true);
  return hit && device.chips.includes(hit.object as THREE.Mesh) ? (hit.object as THREE.Mesh) : null;
}

export class DeviceScene {
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
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  /** Holds the device and its shadow, and sways them together. */
  private readonly rig = new THREE.Group();
  private readonly device: DeviceModel;
  private environment: THREE.WebGLRenderTarget | null = null;
  private readonly textures: THREE.Texture[] = [];
  private readonly loop = new RenderLoop((dt) => this.tick(dt));
  private readonly raycaster = new THREE.Raycaster();
  private readonly chips = new ChipPointer(
    (pointer) => chipAt(this.device, this.rest, this.camera, pointer, this.raycaster),
    (chip, kind) => this.answer(chip, kind)
  );
  private readonly handlers: ChipHandler[] = [];
  private readonly budget: PixelBudget;
  /** Each chip's height on the board, and how far (0..1) it is lifted now. */
  private readonly rest: number[] = [];
  private readonly lift: number[] = [];
  private readonly listeners: [string, EventListener][] = [];
  private target = 0;
  private progress = 0;
  private sway = 1;
  private time = 0;
  private width = 0;
  private height = 0;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: DeviceSceneOptions
  ) {
    this.budget = new PixelBudget(options.finePointer ? PIXEL_RATIO.fine : PIXEL_RATIO.coarse);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    try {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      this.renderer.toneMappingExposure = 1;

      this.light();
      this.scene.environmentIntensity = ENVIRONMENT_INTENSITY;

      const key = new THREE.DirectionalLight(0xffffff, KEY.intensity);
      key.position.set(...KEY.position);
      this.scene.add(key);

      const spec = paintSpec(options.specLines);
      const screen = options.screen ? paintScreen(options.screen) : undefined;
      this.device = buildDevice({ screen, spec: spec.texture });
      this.rig.add(this.device.group, this.shadow());
      this.scene.add(this.rig);
      const silkscreen = this.printChipNames(options.chipLabels ?? {});
      this.keep(spec.texture, screen, ...silkscreen.texture);

      // Martian Mono may arrive after the first draw; the type is set again once it has.
      if (document.fonts) {
        document.fonts
          .load(mono(32))
          .catch(() => undefined)
          .then(() => document.fonts.ready)
          .then(() => {
            if (this.disposed) return;
            spec.draw();
            silkscreen.draw();
          });
      }

      for (const chip of this.device.chips) {
        this.rest.push(chip.position.y);
        this.lift.push(0);
        const material = chip.material as THREE.MeshStandardMaterial;
        material.emissive.set(palette.yellow);
        material.emissiveIntensity = 0;
      }

      this.listeners.push(
        ['pointermove', (event) => this.point(event as PointerEvent)],
        ['pointerleave', () => this.chips.leave()],
        ['click', (event) => this.chips.click(this.toDevice(event as MouseEvent))],
        // A restored context has lost the environment map, which lives only on the GPU.
        ['webglcontextrestored', () => this.light()]
      );
      for (const [type, listener] of this.listeners) canvas.addEventListener(type, listener);

      this.resize();
    } catch (error) {
      // Whatever was built goes, and the context with it, rather than stay with the canvas for the
      // life of the page.
      this.dispose();
      throw error;
    }
  }

  /**
   * Sets the progress (0..1) the scene eases towards; out of range is clamped
   * and NaN reads as 0. `immediate` puts the scene there without easing, for
   * a page that opens partway down.
   */
  setProgress(progress: number, { immediate = false }: { immediate?: boolean } = {}): void {
    this.target = Number.isNaN(progress) ? 0 : THREE.MathUtils.clamp(progress, 0, 1);
    if (immediate) this.progress = this.target;
  }

  /** Starts or stops drawing frames, as the canvas comes on screen or leaves it. */
  setActive(active: boolean): void {
    if (this.disposed || active === this.loop.running) return;
    // The first frames back compile, upload and resize; the pixel budget leaves them out.
    if (active) this.budget.restart();
    this.loop.setActive(active);
  }

  /**
   * Lets the chips answer the pointer, or not. While off, nothing is picked:
   * no hover, lift, glow or pointer cursor, clicks are ignored, and a chip
   * that was hovered settles back onto the board.
   */
  setInteractive(on: boolean): void {
    if (this.disposed) return;
    this.chips.setInteractive(on);
  }

  /** Matches the drawing buffer and the camera to the canvas's size on the page. */
  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.disposed || width === 0 || height === 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.budget.ratio));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Calls `handler` when the chip under the pointer changes, and on every click (null: not on a chip). */
  onChip(handler: ChipHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Stops the frames and frees the renderer, the environment and every
   * geometry, material and texture, then lets the canvas's context go.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.setActive(false);
    for (const [type, listener] of this.listeners) this.canvas.removeEventListener(type, listener);
    this.handlers.length = 0;
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of [object.material].flat()) material.dispose();
    });
    for (const texture of this.textures) texture.dispose();
    this.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private tick(dtSeconds: number): void {
    // Frames running slow step the pixel ratio down; the buffer is resized before this frame draws.
    if (this.budget.sample(dtSeconds) !== null) this.resize();
    const dt = Math.min(dtSeconds, MAX_STEP);
    this.progress = THREE.MathUtils.damp(this.progress, this.target, PROGRESS_DAMP, dt);
    if (Math.abs(this.target - this.progress) < 1e-5) this.progress = this.target;

    const pose = poseAt(this.progress);
    this.device.applyPose(pose);
    this.aim(pose.camera);

    this.time += dt;
    this.sway = THREE.MathUtils.damp(this.sway, pose.section === 'hello' ? 1 : 0, SWAY.damp, dt);
    this.rig.rotation.y = this.sway * SWAY.amplitude * Math.sin((2 * Math.PI * this.time) / SWAY.period);

    this.chips.frame();
    this.device.chips.forEach((chip, i) => {
      this.lift[i] = THREE.MathUtils.damp(this.lift[i], chip === this.chips.hovered ? 1 : 0, HOVER.damp, dt);
      chip.position.y = this.rest[i] + HOVER.lift * this.lift[i];
      (chip.material as THREE.MeshStandardMaterial).emissiveIntensity = HOVER.glow * this.lift[i];
    });

    this.renderer.render(this.scene, this.camera);
  }

  /** Puts the camera on the pose's shot, backed off along its line of sight on a narrow canvas. */
  private aim({ position, target }: Pose['camera']): void {
    const back = Math.max(1, FRAME_ASPECT / this.camera.aspect);
    this.camera.position.set(
      target[0] + (position[0] - target[0]) * back,
      target[1] + (position[1] - target[1]) * back,
      target[2] + (position[2] - target[2]) * back
    );
    this.camera.lookAt(...target);
    this.camera.updateMatrixWorld();
  }

  /** Lights the scene from the lilac room, prefiltered for the PBR materials. */
  private light(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const walls = room();
    this.environment?.dispose();
    this.environment = pmrem.fromScene(walls, 0.04);
    this.scene.environment = this.environment.texture;
    walls.dispose();
    pmrem.dispose();
  }

  /** The soft contact shadow under the back plate. */
  private shadow(): THREE.Mesh {
    const texture = paintShadow();
    this.keep(texture);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SHADOW.width, SHADOW.depth).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })
    );
    mesh.position.y = SHADOW.y;
    mesh.name = 'shadow';
    mesh.raycast = ignoreRays;
    return mesh;
  }

  /** Prints each labelled chip's name on a clear plane over its top, sized from the chip's bounds. */
  private printChipNames(labels: Readonly<Record<string, string>>): ReturnType<typeof paintSilkscreen> {
    const chips = this.device.chips.filter((chip) => labels[chip.userData.slug]);
    const boxes = chips.map((chip) => {
      chip.geometry.computeBoundingBox();
      return chip.geometry.boundingBox!;
    });
    const plates: Plate[] = chips.map((chip, i) => ({
      text: labels[chip.userData.slug],
      width: boxes[i].max.x - boxes[i].min.x,
      depth: boxes[i].max.z - boxes[i].min.z
    }));
    const silkscreen = paintSilkscreen(plates);
    chips.forEach((chip, i) => {
      const name = new THREE.Mesh(
        new THREE.PlaneGeometry(plates[i].width, plates[i].depth).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: silkscreen.texture[i], transparent: true, depthWrite: false, toneMapped: false })
      );
      const centre = boxes[i].getCenter(new THREE.Vector3());
      name.position.set(centre.x, boxes[i].max.y + SILKSCREEN_LIFT, centre.z);
      name.name = `${chip.name}:silkscreen`;
      name.raycast = ignoreRays;
      chip.add(name);
    });
    return silkscreen;
  }

  /** Tracks textures for dispose(), filtered for the slant they are seen at. */
  private keep(...textures: (THREE.Texture | undefined)[]): void {
    const anisotropy = Math.min(ANISOTROPY, this.renderer.capabilities.getMaxAnisotropy());
    for (const texture of textures) {
      if (!texture) continue;
      texture.anisotropy = anisotropy;
      this.textures.push(texture);
    }
  }

  private point(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    this.chips.move(this.toDevice(event));
  }

  /** The event's position on the canvas in normalised device coordinates. */
  private toDevice(event: MouseEvent): THREE.Vector2 {
    return new THREE.Vector2((event.offsetX / this.width) * 2 - 1, 1 - (event.offsetY / this.height) * 2);
  }

  /** What the chip pointer answers: a hovered chip shows the pointer cursor, and the handlers hear both kinds. */
  private answer(chip: THREE.Mesh | null, kind: 'hover' | 'click'): void {
    if (kind === 'hover') this.canvas.style.cursor = chip ? 'pointer' : '';
    const slug = chip ? (chip.userData.slug as string) : null;
    for (const handler of this.handlers) handler(slug, kind);
  }
}
