import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChipPointer } from './ChipPointer';
import { DragTurn } from './DragTurn';
import { HUB_LAYERS, hubPoseAt, type HubLayerId } from './HubChoreography';
import { PixelBudget } from './PixelBudget';
import { qualityFor, qualitySteps, type Quality } from './quality';
import { RenderLoop } from './RenderLoop';
import { BACK_THICKNESS } from './device/BackPlate';
import { POUCH, POUCH_TOP } from './device/Battery';
import { BOARD, BOARD_THICKNESS } from './device/Board';
import { FRAME_HEIGHT } from './device/Frame';
import { buildHandheld, type HandheldModel } from './device/Handheld';
import { DEVICE } from './device/hardware';
import { applyTextures, createMaterials } from './device/materials';
import { GLASS, GLASS_THICKNESS } from './device/Screen';
import { loadDeviceTextures, type DeviceTextures } from './device/textures';
import { buildBackdrop, type Backdrop } from './studio/Backdrop';
import { BEAM, buildBeam, type Beam } from './studio/Beam';
import { buildDust, type Dust } from './studio/Dust';
import { buildFloor, type Floor } from './studio/Floor';
import { buildHaze, type Haze } from './studio/Haze';
import { glowTexture, noiseTexture } from './studio/noise';

/**
 * The hub on its canvas: the realistic handheld in a dark product-launch
 * studio (a wet, glossy floor, one gold beam from above with dust in it,
 * purple haze), the camera that follows the scroll from the closed device to
 * the exploded hub, the drag that turns it, and the layers answering the
 * pointer. Scroll sets a target progress, which the scene eases towards on
 * every frame; frames run only while it is switched on (setActive), and the
 * layers answer the pointer only while it is interactive (setInteractive).
 * A weak GPU walks down the quality ladder (quality.ts). Construct it only
 * where `supported()` is true; even then the constructor throws if the
 * browser refuses the context, having let go of whatever it had built.
 *
 * Dragging is the caller's: it listens for the pointer (on one pointerId)
 * and forwards pointerDown/Move/Up/Cancel here. Hover and click picking
 * listen on the canvas itself.
 */

export interface HubSceneOptions {
  /** A mouse or trackpad: the sharper end of the quality ladder. */
  finePointer: boolean;
  /** Names printed on the chips, keyed by slug; a chip without one keeps its default. */
  labels?: Readonly<Record<string, string>>;
}

/** The layer under the pointer (null: none), on hover changes and on clicks. */
export type LayerHandler = (id: HubLayerId | null, kind: 'hover' | 'click') => void;

/** Where a layer's callout attaches, in CSS pixels on the canvas. */
export interface Anchor {
  x: number;
  y: number;
  /** In front of the camera and on the canvas. */
  visible: boolean;
}

/** The device's extent on the canvas, in CSS pixels: the projected corners of its layers' boxes. */
export interface DeviceBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where the callouts can go at the hub: the device's extent and anchors there, at rest. */
export interface HubFrame {
  bounds: DeviceBounds | null;
  anchors: Record<HubLayerId, Anchor>;
}

/** No drag. */
const AT_REST = { yaw: 0, pitch: 0 } as const;

const FOV = 30;

/** Kept at 0.05 or more: the device's decals sit 0.0004 above their surfaces. */
const NEAR = 0.1;
const FAR = 100;

/**
 * Narrower than this, the device is centred; wider, it moves left of centre
 * at the hub so the callouts fit on its right.
 */
const FRAME_ASPECT = 1.2;

/**
 * Narrower than these aspects the camera backs off so the device keeps its
 * width in frame: the closed slab is wide, the hub's stack tall and narrow,
 * so the hub can stay closer on a phone. Lerped by the explode.
 */
const FIT_ASPECT = { closed: 1.45, hub: 0.85 } as const;

/** How far left of centre the target sits at the hub on a wide canvas, as a share of the width. */
const SHIFT = 0.045;

/** The shift comes in between these two aspects, so a canvas resized across them does not jump. */
const SHIFT_FROM = FRAME_ASPECT;
const SHIFT_TO = 1.5;

/** The most of the canvas's height a reserved bottom band may take (setBottomReserve). */
const MAX_RESERVE = 0.45;

/** The polar angle the drag's tip may reach, from the zenith, so it never looks from under the floor or straight down. */
const PHI_LIMITS = [0.35, 1.45] as const;

/** Progress eases towards its target at this rate (MathUtils.damp's λ). */
const PROGRESS_DAMP = 8;

/** The longest step the easing takes in one frame, so a tab coming back does not jump. */
const MAX_STEP = 0.1;

/**
 * How the quality ladder's budget judges this scene (PixelBudget): a window
 * must average 56 fps or better, so a GPU holding the mid-50s gives up dust
 * and then pixels; and three or more frames over 100 ms in a row count as
 * slow drawing, not a stall, so a GPU under 10 fps steps down too.
 */
const BUDGET_OPTIONS = { limit: 1 / 56, slowRun: 3 } as const;

/** Anisotropic filtering for the device's image maps, seen at a slant. */
const ANISOTROPY = 8;

/** The studio. */
const STUDIO = {
  floor: -0.55,
  /** The beam's source, straight above the stand and a little behind it. */
  apex: [0, 9, -0.25] as const,
  /** The beam's radius at the floor. */
  beamRadius: 2.2,
  background: 0x07040d,
  fog: { color: 0x160c26, density: 0.035 },
  environment: 0.35,
  exposure: 1
} as const;

/**
 * The warm key: a spot from the beam's source, wide enough to light every
 * layer. Its shadow is PCF, softened by `shadowRadius` texels: one depth
 * pass, redrawn only while the device moves, with no blur passes.
 */
const KEY = { color: 0xffd9a0, intensity: 70, angle: 0.5, penumbra: 0.85, target: [0, 1.6, 0] as const, shadowRadius: 6 };

/** Parts smaller than this (bounding radius) cast no shadow: screws, leads and decals vanish in a soft shadow. */
const SHADOW_CASTER = 0.2;

/** The purple rim, from behind and to the left. */
const RIM = { color: 0x8a5cff, intensity: 2.2, position: [-6, 3.5, -5] as const };

/** A soft fill from the front left, so the faces the key misses (the frame's front, the ports) are not lost. */
const FILL = { color: 0xffe2c8, intensity: 0.8, position: [-5, 4, 8] as const };

/**
 * Each layer's callout anchor in its own frame: on its top face, near the
 * corner at +X/+Z (the front right, where the callouts lead off).
 */
const ANCHORS: Record<HubLayerId, readonly [number, number, number]> = {
  screen: [GLASS.width / 2 - 0.42, GLASS_THICKNESS, GLASS.depth / 2 - 0.32],
  frame: [DEVICE.width / 2 - 0.06, FRAME_HEIGHT, DEVICE.depth / 2 - 0.06],
  board: [BOARD.width / 2 - 0.08, BOARD_THICKNESS, BOARD.depth / 2 - 0.1],
  battery: [POUCH.width / 2 - 0.3, POUCH_TOP, POUCH.depth / 2 - 0.3],
  back: [DEVICE.width / 2 - 0.12, BACK_THICKNESS, DEVICE.depth / 2 - 0.08]
};

/**
 * RoomEnvironment made a dark studio: its walls near-black and glowing
 * evenly (lit, the corners between them drew hard lines across flat metal),
 * its furniture taken out (it showed as sharp dark shapes in the polished
 * faces) and its soft-boxes kept, turned so the brightest lies where the top
 * faces mirror it from the hub's camera. The metal then stays purple-black
 * between soft highlights instead of greying in a white room. `blur` is the
 * PMREM's sigma.
 */
const ROOM = { walls: 0x08060a, glow: 0x0c090f, blur: 0.06, turn: Math.PI / 2 } as const;

function studioRoom(): RoomEnvironment {
  const room = new RoomEnvironment();
  room.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh) object.visible = false;
    const material = (object as THREE.Mesh).material;
    if (material instanceof THREE.MeshStandardMaterial && material.side === THREE.BackSide) {
      material.color.set(ROOM.walls);
      material.emissive.set(ROOM.glow);
    }
  });
  return room;
}

/**
 * The power button's glow: a soft additive halo just off its face, there
 * being no bloom. It fades as the button turns away from the camera, so the
 * frame never cuts it with a hard edge.
 */
const GLOW = { color: 0xffcf33, size: 0.4, opacity: 0.6, offset: 0.03 } as const;

/**
 * The screen's glass, and the display under it, mirror the room at their own,
 * lower strength: at the hub's grazing view the room's full strength greys
 * them into a pale slab (a material's own envMapIntensity counts only with
 * its own envMap).
 */
const SCREEN_ENVIRONMENT: Readonly<Record<string, number>> = { glass: 0.25, display: 0.04 };

/** The materials whose programs change when the image maps arrive (see warm()). */
const TEXTURED = ['anodised', 'chamfer', 'pcb', 'pouch', 'tape'] as const;

function smoothstep(a: number, b: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Whether a projected point (x, y in CSS pixels, z in normalised depth) is
 * in front of the camera and on a canvas that has a size: before the canvas
 * is laid out, every point projects to {0, 0} on a 0 × 0 canvas, and counts
 * as off it.
 */
export function onCanvas(x: number, y: number, z: number, width: number, height: number): boolean {
  return width > 0 && height > 0 && z > -1 && z < 1 && x >= 0 && x <= width && y >= 0 && y <= height;
}

/**
 * The layer `object` belongs to: up through its parents to one of the
 * model's layers (chip leads and decals carry no slug of their own).
 */
export function layerOf(model: HandheldModel, object: THREE.Object3D | null): HubLayerId | null {
  for (let node = object; node; node = node.parent) {
    const id = HUB_LAYERS.find((layer) => model.layers[layer] === node);
    if (id) return id;
  }
  return null;
}

export class HubScene {
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
  /** The camera as it stands at the hub, at rest (hubFrame()). */
  private readonly hubCamera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
  private hubFrameCache: { key: string; frame: HubFrame } | null = null;
  private readonly position = new THREE.Vector3();
  private readonly model: HandheldModel;
  private readonly finePointer: boolean;
  private readonly budget: PixelBudget;
  private quality: Quality;
  private readonly loop = new RenderLoop((dt) => this.tick(dt));
  private readonly drag = new DragTurn();
  private readonly raycaster = new THREE.Raycaster();
  private readonly layers = new ChipPointer<HubLayerId>(
    (pointer) => this.layerAt(pointer),
    (id, kind) => this.answer(id, kind)
  );
  private readonly handlers: LayerHandler[] = [];
  private readonly frameHandlers: (() => void)[] = [];
  /** Run once after the next frame drawn (letting go of the warm-up's stand-ins). */
  private readonly afterFrame: (() => void)[] = [];
  private readonly listeners: [string, EventListener][] = [];
  private noise: THREE.DataTexture | null = null;
  private backdrop: Backdrop | null = null;
  private floor: Floor | null = null;
  private beam: Beam | null = null;
  private dust: Dust | null = null;
  private haze: Haze | null = null;
  private glow: THREE.Sprite | null = null;
  private environment: THREE.WebGLRenderTarget | null = null;
  /** Image maps that arrived but are not yet handed to the model (their programs compiling). */
  private pending: DeviceTextures | null = null;
  /** The scene's programs are compiling (compileAsync); no frame is drawn until they are linked. */
  private compiling = true;
  private readonly target3 = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly spherical = new THREE.Spherical();
  private readonly point = new THREE.Vector3();
  /** Each layer's box in its own frame, for bounds(). */
  private readonly boxes = {} as Record<HubLayerId, THREE.Box3>;
  /** CSS pixels at the canvas's bottom kept clear of the device at the hub. */
  private reserve = 0;
  private target = 0;
  private progress = 0;
  /** The progress the model was last posed at (NaN: not yet). */
  private posed = Number.NaN;
  private explode = 0;
  private turn = { yaw: 0, pitch: 0 };
  /** Something moved under the pointer (or the pointer moved) since the last pick. */
  private pickDirty = true;
  /** The press that ended last turned the device; the click that follows it is not a click. */
  private turned = false;
  private time = 0;
  private width = 0;
  private height = 0;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: HubSceneOptions
  ) {
    this.finePointer = options.finePointer;
    this.quality = qualityFor(0, this.finePointer);
    const ratios = Array.from({ length: qualitySteps(this.finePointer) }, (_, step) => qualityFor(step, this.finePointer).pixelRatio);
    this.budget = new PixelBudget(ratios, BUDGET_OPTIONS);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    try {
      this.renderer.setClearColor(STUDIO.background, 1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      this.renderer.toneMappingExposure = STUDIO.exposure;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      // The device only moves with the scroll; the shadow is drawn again only then (see update()).
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;

      this.scene.background = new THREE.Color(STUDIO.background);
      this.scene.fog = new THREE.FogExp2(STUDIO.fog.color, STUDIO.fog.density);
      this.scene.environmentIntensity = STUDIO.environment;
      this.scene.environmentRotation.set(0, ROOM.turn, 0);
      this.light();
      this.lights();

      this.model = buildHandheld(undefined, options.labels);
      this.model.group.traverse((object) => {
        // The larger parts cast onto the floor; none takes another's shadow, as in a lit product shot.
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingSphere();
        const radius = mesh.geometry.boundingSphere?.radius ?? 0;
        mesh.castShadow = !(mesh as THREE.InstancedMesh).isInstancedMesh && radius > SHADOW_CASTER;
        mesh.receiveShadow = false;
      });
      this.scene.add(this.model.group);
      this.measureLayers();
      this.dimGlass();
      this.studio();

      this.listeners.push(
        ['pointermove', (event) => this.hover(event as PointerEvent)],
        ['pointerleave', () => this.layers.leave()],
        ['click', (event) => this.click(event as MouseEvent)],
        // A restored context has lost the environment map and the shadow, which live only on the GPU.
        ['webglcontextrestored', () => this.restore()]
      );
      for (const [type, listener] of this.listeners) canvas.addEventListener(type, listener);

      this.resize();
      this.update(0);
      this.precompile();
      void this.texture();
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
   * a page that opens partway down; the anchors answer for it at once.
   */
  setProgress(progress: number, { immediate = false }: { immediate?: boolean } = {}): void {
    this.target = Number.isNaN(progress) ? 0 : THREE.MathUtils.clamp(progress, 0, 1);
    if (immediate && !this.disposed) {
      this.progress = this.target;
      this.update(0);
    }
  }

  /** Starts or stops drawing frames, as the canvas comes on screen or leaves it. */
  setActive(active: boolean): void {
    if (this.disposed || active === this.loop.running) return;
    // The first frames back compile, upload and resize; the budget leaves them out.
    if (active) this.budget.restart();
    this.loop.setActive(active);
  }

  /**
   * Lets the layers answer the pointer, or not. While off, nothing is picked:
   * no hover or pointer cursor, clicks are ignored, and a layer that was
   * hovered is let go (its handlers hear null).
   */
  setInteractive(on: boolean): void {
    if (this.disposed) return;
    this.layers.setInteractive(on);
    if (!on) this.canvas.style.cursor = '';
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
    this.dust?.setScale((height * ratio) / 2);
    this.camera.aspect = width / height;
    this.aim();
  }

  /** A gold rim round that layer (null: none). */
  highlightLayer(id: HubLayerId | null): void {
    if (this.disposed) return;
    this.model.setHighlight(id);
  }

  /** Calls `handler` when the layer under the pointer changes, and on every click (null: not on a layer). */
  onLayer(handler: LayerHandler): void {
    this.handlers.push(handler);
  }

  /** Calls `handler` after every frame drawn, when the anchors have moved with it. */
  onFrame(handler: () => void): void {
    this.frameHandlers.push(handler);
  }

  /**
   * Where each layer's callout attaches (its top face, at the front-right
   * corner), in CSS pixels on the canvas. None is visible before the canvas
   * has a size (onCanvas).
   */
  anchors(): Record<HubLayerId, Anchor> {
    return this.anchorsFor(this.camera, (id) => this.worldOf(id));
  }

  /**
   * The device's extent on the canvas as last posed, in CSS pixels (view
   * offset included): the projected corners of each layer's box, so it holds
   * every pixel of the device, a little generously. Null before the canvas
   * has a size.
   */
  bounds(): DeviceBounds | null {
    return this.boundsFor(this.camera, (id) => this.worldOf(id));
  }

  /**
   * The device's extent and the anchors at the hub (fully apart, at rest, as
   * at any progress from 0.5 on), for the canvas's size now: where the
   * callouts can go once the device arrives, whatever pose it is passing
   * through. Worked out without moving the model, once per size, and without
   * the reserved bottom band, which the callouts' choice of layout sets: so
   * that choice never depends on its own outcome.
   */
  hubFrame(): HubFrame | null {
    if (this.disposed || this.width === 0 || this.height === 0) return null;
    const key = `${this.width}x${this.height}`;
    if (this.hubFrameCache?.key === key) return this.hubFrameCache.frame;
    this.hubCamera.aspect = this.camera.aspect;
    this.place(this.hubCamera, 1, 1, AT_REST, 0);
    const { offsets } = hubPoseAt(1);
    const matrices = {} as Record<HubLayerId, THREE.Matrix4>;
    for (const id of HUB_LAYERS) {
      const layer = this.model.layers[id];
      layer.updateWorldMatrix(true, false);
      // The layers only rise: each at its hub height, under its parent as it stands.
      const local = new THREE.Matrix4().compose(this.position.copy(layer.position).setY(offsets[id]), layer.quaternion, layer.scale);
      matrices[id] = layer.parent ? local.premultiply(layer.parent.matrixWorld) : local;
    }
    const world = (id: HubLayerId): THREE.Matrix4 => matrices[id];
    const frame = { bounds: this.boundsFor(this.hubCamera, world), anchors: this.anchorsFor(this.hubCamera, world) };
    this.hubFrameCache = { key, frame };
    return frame;
  }

  /** The progress the scene shows now, eased towards the one last set (0..1). */
  currentProgress(): number {
    return this.progress;
  }

  /**
   * Keeps a band of `pixels` (CSS) at the canvas's bottom clear of the
   * device at the hub, for the callouts' list under it on a tall canvas: the
   * camera backs off as far as the device needs to fit above the band and
   * aims so it centres there. Eased in with the explode, so the closed device
   * keeps its framing; at most MAX_RESERVE of the height. 0 lets it go.
   */
  setBottomReserve(pixels: number): void {
    const reserve = Number.isFinite(pixels) ? Math.max(0, pixels) : 0;
    if (reserve === this.reserve) return;
    this.reserve = reserve;
    // The device moves under the pointer.
    this.pickDirty = true;
  }

  /** A press at (x, y), in any consistent pixel space (client or canvas), for the drag to turn. */
  pointerDown(x: number, y: number): void {
    if (this.disposed) return;
    this.turned = false;
    this.drag.down(x, y);
  }

  pointerMove(x: number, y: number): void {
    if (this.disposed) return;
    this.drag.move(x, y, this.width);
  }

  /** The press ends: the device springs back, and a click that follows a turn is ignored. */
  pointerUp(): void {
    if (this.disposed) return;
    this.turned = this.drag.engaged;
    this.drag.up();
  }

  /** The press was taken away (pointercancel, lostpointercapture): springs back, as on release. */
  pointerCancel(): void {
    this.pointerUp();
  }

  /**
   * Stops the frames and frees the model, the studio, the environment and
   * the renderer, then lets the canvas's context go. Safe to call twice.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.setActive(false);
    for (const [type, listener] of this.listeners) this.canvas.removeEventListener(type, listener);
    this.handlers.length = 0;
    this.frameHandlers.length = 0;
    this.canvas.style.cursor = '';
    // The model frees the image maps it was handed; maps still compiling are freed here.
    this.model?.dispose();
    if (this.pending) for (const texture of Object.values(this.pending)) texture?.dispose();
    this.pending = null;
    for (const release of this.afterFrame.splice(0)) release();
    for (const part of [this.backdrop, this.floor, this.beam, this.dust, this.haze]) part?.dispose();
    this.glow?.material.map?.dispose();
    this.glow?.material.dispose();
    this.noise?.dispose();
    this.environment?.dispose();
    // The key's shadow maps.
    this.scene.traverse((object) => (object as THREE.Light).isLight && (object as THREE.Light).dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private tick(dtSeconds: number): void {
    if (this.compiling) {
      // Nothing is drawn (the canvas keeps the studio's clear colour) until the programs are linked.
      this.update(Math.min(dtSeconds, MAX_STEP));
      return;
    }
    // Frames running slow step down the quality ladder; the buffer is resized before this frame draws.
    if (this.budget.sample(dtSeconds) !== null) this.setQuality(qualityFor(this.budget.step, this.finePointer));
    this.update(Math.min(dtSeconds, MAX_STEP));
    this.renderer.render(this.scene, this.camera);
    for (const release of this.afterFrame.splice(0)) release();
    for (const handler of this.frameHandlers) handler();
  }

  /** Eases the progress, poses the device, turns and aims the camera, moves the studio, and picks. */
  private update(dt: number): void {
    this.progress = THREE.MathUtils.damp(this.progress, this.target, PROGRESS_DAMP, dt);
    if (Math.abs(this.target - this.progress) < 1e-5) this.progress = this.target;

    if (this.progress !== this.posed) {
      const pose = hubPoseAt(this.progress);
      this.model.applyPose(pose);
      this.explode = pose.explode;
      this.posed = this.progress;
      // The beam ends on the device's top.
      this.beam?.setStop(Math.max(...HUB_LAYERS.map((id) => pose.offsets[id] + this.boxes[id].max.y)));
      this.renderer.shadowMap.needsUpdate = true;
      this.pickDirty = true;
    }

    const turn = this.drag.step(dt);
    if (turn.yaw !== this.turn.yaw || turn.pitch !== this.turn.pitch) this.pickDirty = true;
    this.turn = turn;
    this.aim();
    this.placeGlow();

    this.time += dt;
    this.beam?.setTime(this.time);
    this.dust?.setTime(this.time);
    this.haze?.setTime(this.time);

    if (this.pickDirty) {
      this.pickDirty = false;
      this.layers.frame();
    }
  }

  /**
   * Puts the camera on the pose's shot, orbited about its target by the
   * drag; backed off on a narrow canvas, with the target moved left of
   * centre on a wide one, and lifted clear of a reserved bottom band.
   */
  private aim(): void {
    this.place(this.camera, this.progress, this.explode, this.turn, this.reserve);
  }

  /** Puts `camera` where aim() puts the scene's, for that progress, explode, turn and reserved bottom band (CSS px). */
  private place(camera: THREE.PerspectiveCamera, progress: number, explode: number, turn: { yaw: number; pitch: number }, band: number): void {
    const { position, target } = hubPoseAt(progress).camera;
    this.target3.set(...target);
    this.offset.set(...position).sub(this.target3);
    this.spherical.setFromVector3(this.offset);
    this.spherical.theta -= turn.yaw;
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi - turn.pitch, PHI_LIMITS[0], PHI_LIMITS[1]);
    const fit = FIT_ASPECT.closed + (FIT_ASPECT.hub - FIT_ASPECT.closed) * explode;
    // The device fills about the canvas's height unbacked: to fit above a reserved band, it backs off by
    // the height over what is left, unless the width already backs it off further.
    const reserve = this.height > 0 ? Math.min(band, this.height * MAX_RESERVE) * explode : 0;
    const above = reserve > 0 ? this.height / (this.height - reserve) : 1;
    this.spherical.radius *= Math.max(1, fit / camera.aspect, above);
    camera.position.setFromSpherical(this.spherical).add(this.target3);
    camera.lookAt(this.target3);

    const shift = SHIFT * explode * smoothstep(SHIFT_FROM, SHIFT_TO, camera.aspect);
    // Over a reserved band, the view moves down by half of it, which lifts the device to the middle of the rest.
    if ((shift > 0 || reserve > 0) && this.width > 0) camera.setViewOffset(this.width, this.height, shift * this.width, reserve / 2, this.width, this.height);
    else if (camera.view?.enabled) camera.clearViewOffset();
    else camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /** A layer's world matrix as last posed. */
  private worldOf(id: HubLayerId): THREE.Matrix4 {
    const layer = this.model.layers[id];
    layer.updateWorldMatrix(true, false);
    return layer.matrixWorld;
  }

  /** Each layer's anchor through `camera`, the layers placed by `world`. */
  private anchorsFor(camera: THREE.Camera, world: (id: HubLayerId) => THREE.Matrix4): Record<HubLayerId, Anchor> {
    const anchors = {} as Record<HubLayerId, Anchor>;
    for (const id of HUB_LAYERS) {
      const p = this.point.set(...ANCHORS[id]).applyMatrix4(world(id)).project(camera);
      const x = ((p.x + 1) / 2) * this.width;
      const y = ((1 - p.y) / 2) * this.height;
      const visible = this.model.layers[id].visible && onCanvas(x, y, p.z, this.width, this.height);
      anchors[id] = { x, y, visible };
    }
    return anchors;
  }

  /** The device's extent through `camera`, the layers placed by `world`: the projected corners of their boxes. */
  private boundsFor(camera: THREE.Camera, world: (id: HubLayerId) => THREE.Matrix4): DeviceBounds | null {
    if (this.disposed || this.width === 0 || this.height === 0) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const id of HUB_LAYERS) {
      if (!this.model.layers[id].visible) continue;
      const matrix = world(id);
      const { min, max } = this.boxes[id];
      for (let corner = 0; corner < 8; corner++) {
        const p = this.point
          .set(corner & 1 ? max.x : min.x, corner & 2 ? max.y : min.y, corner & 4 ? max.z : min.z)
          .applyMatrix4(matrix)
          .project(camera);
        const x = ((p.x + 1) / 2) * this.width;
        const y = ((1 - p.y) / 2) * this.height;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    return left <= right ? { left, top, right, bottom } : null;
  }

  /** Each layer's box in its own frame (bounds() projects its corners), measured once: the layers only move. */
  private measureLayers(): void {
    this.model.group.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4();
    for (const id of HUB_LAYERS) {
      const layer = this.model.layers[id];
      this.boxes[id] = new THREE.Box3().setFromObject(layer).applyMatrix4(inverse.copy(layer.matrixWorld).invert());
    }
  }

  /** The studio's room light, prefiltered for the PBR materials. */
  private light(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = studioRoom();
    this.environment?.dispose();
    this.environment = pmrem.fromScene(room, ROOM.blur);
    this.scene.environment = this.environment.texture;
    room.dispose();
    pmrem.dispose();
  }

  /** The key from the beam's source, the purple rim and the fill. */
  private lights(): void {
    const key = new THREE.SpotLight(KEY.color, KEY.intensity, 0, KEY.angle, KEY.penumbra, 2);
    key.name = 'key';
    key.position.set(...STUDIO.apex);
    key.target.position.set(...KEY.target);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = KEY.shadowRadius;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 3;
    key.shadow.camera.far = 12;
    this.scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(RIM.color, RIM.intensity);
    rim.name = 'rim';
    rim.position.set(...RIM.position);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight(FILL.color, FILL.intensity);
    fill.name = 'fill';
    fill.position.set(...FILL.position);
    this.scene.add(fill);
  }

  /** The backdrop, the floor, the beam, the dust and the haze. */
  private studio(): void {
    this.noise = noiseTexture();
    this.backdrop = buildBackdrop();
    this.backdrop.mesh.position.set(0, 1.5, 0);
    this.floor = buildFloor({
      y: STUDIO.floor,
      pool: [STUDIO.apex[0], STUDIO.apex[2]],
      footprint: [DEVICE.width / 2, DEVICE.depth / 2],
      noise: this.noise
    });
    this.beam = buildBeam({ apex: STUDIO.apex, floor: STUDIO.floor, radius: STUDIO.beamRadius, noise: this.noise });
    const most = Math.max(...Array.from({ length: qualitySteps(this.finePointer) }, (_, step) => qualityFor(step, this.finePointer).dust));
    this.dust = buildDust({ apex: STUDIO.apex, top: BEAM.top, radius: STUDIO.beamRadius, floor: STUDIO.floor, max: most });
    this.haze = buildHaze();
    this.scene.add(this.backdrop.mesh, this.floor.group, this.beam.mesh, this.dust.points, this.haze.group);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        name: 'power:glow',
        map: glowTexture(),
        color: GLOW.color,
        opacity: GLOW.opacity,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      })
    );
    glow.name = 'power:glow';
    glow.scale.setScalar(GLOW.size);
    glow.renderOrder = 3;
    glow.raycast = () => {};
    this.glow = glow;
    this.scene.add(glow);
    this.setQuality(this.quality);
  }

  /** Puts the power button's glow just off the button's face, as bright as the face is turned to the camera. */
  private placeGlow(): void {
    if (!this.glow) return;
    const button = this.model.powerButton;
    button.updateWorldMatrix(true, false);
    this.glow.position.setFromMatrixPosition(button.matrixWorld);
    this.glow.position.x += GLOW.offset;
    // The button faces +X: its glow follows how squarely the camera sees that face.
    const facing = this.point.copy(this.camera.position).sub(this.glow.position).normalize().x;
    this.glow.material.opacity = GLOW.opacity * smoothstep(0.05, 0.45, facing);
  }

  /** Applies a step of the quality ladder: the dust and the pixel ratio (through resize). */
  private setQuality(quality: Quality): void {
    this.quality = quality;
    this.dust?.setCount(quality.dust);
    this.resize();
  }

  /**
   * Loads the image maps in the background and hands them to the model once
   * they are decoded, uploaded and their shaders compiled (warm()). A map
   * that fails is simply absent, and the model keeps its plain finish there.
   */
  private async texture(): Promise<void> {
    const textures = await loadDeviceTextures();
    const maps = Object.values(textures).filter(Boolean) as THREE.Texture[];
    if (this.disposed) {
      maps.forEach((map) => map.dispose());
      return;
    }
    if (maps.length === 0) return;
    const anisotropy = Math.min(ANISOTROPY, this.renderer.capabilities.getMaxAnisotropy());
    maps.forEach((map) => (map.anisotropy = anisotropy));
    this.pending = textures;
    const release = await this.warm(textures, maps);
    if (this.disposed || this.pending !== textures) {
      release();
      return;
    }
    this.pending = null;
    this.model.setTextures(textures);
    // The stand-ins hold the compiled programs until the model's materials have taken them up. The
    // swap's frame uploads and binds afresh: the budget's count starts over after it.
    this.afterFrame.push(() => {
      release();
      this.budget.restart();
    });
  }

  /**
   * Readies the image maps before the model takes them, so an integrated GPU
   * does not stall a visible frame on them: each map is decoded off the main
   * thread and uploaded in its own task, then stand-in materials made and
   * textured exactly as the model's are compiled against this scene (its
   * lights, fog and environment). The model's materials find
   * those programs in the cache, provided the stand-ins still hold them: the
   * answer lets them go, to be called once the model has drawn a frame.
   */
  private async warm(textures: DeviceTextures, maps: THREE.Texture[]): Promise<() => void> {
    const geometry = new THREE.PlaneGeometry(0.01, 0.01);
    const sets: { materials: THREE.Material[]; flex: THREE.Texture | null }[] = [];
    const instances: THREE.InstancedMesh[] = [];
    const release = (): void => {
      geometry.dispose();
      instances.forEach((mesh) => mesh.dispose());
      for (const set of sets) {
        set.materials.forEach((material) => material.dispose());
        set.flex?.dispose();
      }
    };
    try {
      for (const map of maps) {
        await (map.image as HTMLImageElement | undefined)?.decode?.().catch(() => undefined);
        if (this.disposed) return release;
        this.renderer.initTexture(map);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (this.disposed) return release;
      // Each textured material as the model draws it: on a plain mesh, an instanced one (the chamfer's
      // hole lips), or both; an instanced draw is a program of its own.
      const uses = new Set<string>();
      this.model.group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of [mesh.material].flat()) {
          if ((TEXTURED as readonly string[]).includes(material.name)) uses.add(`${material.name}|${(mesh as THREE.InstancedMesh).isInstancedMesh === true}`);
        }
      });
      const stand = createMaterials();
      applyTextures(stand, textures);
      const group = new THREE.Group();
      for (const use of uses) {
        const [name, instanced] = use.split('|') as [(typeof TEXTURED)[number], string];
        const mesh = instanced === 'true' ? new THREE.InstancedMesh(geometry, stand[name], 1) : new THREE.Mesh(geometry, stand[name]);
        if (mesh instanceof THREE.InstancedMesh) instances.push(mesh);
        group.add(mesh);
      }
      sets.push({ materials: Object.values(stand), flex: stand.flex.map });
      // compileAsync resolves once the programs are linked (KHR_parallel_shader_compile where there is one).
      await this.renderer.compileAsync(group, this.camera, this.scene);
    } catch {
      // A failed warm-up costs only the stall it was meant to save.
    }
    return release;
  }

  /** After a lost context comes back: the environment again, and the shadow. */
  private restore(): void {
    if (this.disposed) return;
    this.light();
    this.dimGlass();
    this.renderer.shadowMap.needsUpdate = true;
    // Every program is compiled again before the next frame; the budget's count starts over once it is.
    this.precompile();
  }

  /**
   * Compiles every program the scene needs in parallel (compileAsync) and
   * draws nothing until they are linked, so the first frame does not stall on
   * them; then starts the budget's count over.
   */
  private precompile(): void {
    this.compiling = true;
    this.renderer
      .compileAsync(this.scene, this.camera)
      .catch(() => undefined)
      .then(() => {
        if (this.disposed) return;
        this.compiling = false;
        this.budget.restart();
      });
  }

  /** Hands the glass and the display the room at their own strength (SCREEN_ENVIRONMENT). */
  private dimGlass(): void {
    this.model.group.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const surface of [material ?? []].flat()) {
        const strength = SCREEN_ENVIRONMENT[surface.name];
        if (strength === undefined || !(surface instanceof THREE.MeshStandardMaterial) || !this.environment) continue;
        surface.envMap = this.environment.texture;
        surface.envMapIntensity = strength;
        surface.envMapRotation.copy(this.scene.environmentRotation);
      }
    });
  }

  /** The layer under `pointer` (normalised device coordinates), or null. */
  private layerAt(pointer: THREE.Vector2): HubLayerId | null {
    this.raycaster.setFromCamera(pointer, this.camera);
    const [hit] = this.raycaster.intersectObject(this.model.group, true);
    return hit ? layerOf(this.model, hit.object) : null;
  }

  private hover(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    this.layers.move(this.toDevice(event));
    this.pickDirty = true;
  }

  private click(event: MouseEvent): void {
    // The press that just ended turned the device: its click is not a pick.
    if (this.turned) {
      this.turned = false;
      return;
    }
    this.layers.click(this.toDevice(event));
  }

  /** The event's position on the canvas in normalised device coordinates. */
  private toDevice(event: MouseEvent): THREE.Vector2 {
    return new THREE.Vector2((event.offsetX / this.width) * 2 - 1, 1 - (event.offsetY / this.height) * 2);
  }

  /** What the layer pointer answers: a hovered layer shows the pointer cursor, and the handlers hear both kinds. */
  private answer(id: HubLayerId | null, kind: 'hover' | 'click'): void {
    if (kind === 'hover') this.canvas.style.cursor = id ? 'pointer' : '';
    for (const handler of this.handlers) handler(id, kind);
  }
}
