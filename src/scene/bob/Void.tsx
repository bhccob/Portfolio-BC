import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type ProjectId, projects } from '~/data/projects';
import { RING_MARKS } from '~/data/qa';
import { debugBridge } from '~/debug/needleDebug';
import { proofWorldGate } from '~/debug/worldGate';
import type { CompassModel } from '~/engine/bob/build/compass';
import { buildDecorStars } from '~/engine/bob/build/decorStars';
import { buildGyro, type GyroModel } from '~/engine/bob/build/gyro';
import { buildEngraved, type EngravedModel } from '~/engine/bob/build/engraved';
import type { LightModel } from '~/engine/bob/build/light';
import { buildNebula, type NebulaModel } from '~/engine/bob/build/nebula';
import { buildRing } from '~/engine/bob/build/ring';
import { buildStars, type StarsModel, starsRound } from '~/engine/bob/build/stars';
import { buildVoid, VOID_LOOK, type VoidModel } from '~/engine/bob/build/void';
import { buildVolume, type VolumeModel } from '~/engine/bob/build/volume';
import { buildWorld, type WorldModel } from '~/engine/bob/build/world';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { ringDragOn } from '~/input/ringDrag';
import { dragRing, releaseRing } from '~/input/useHomeScroll';
import { areasOnPath } from '~/state/chapters';
import { frame, type ObjectOnScreen } from '~/state/frame';
import { useScene, type VoidState } from '~/state/store';
import { showAreaCaption } from '~/ui/AreaCaption';
import { showAreaDots } from '~/ui/AreaDots';
import { showLightFacts } from '~/ui/LightFacts';
import { nameScale } from '~/ui/nameLine';
import { panelKeepOut, panelLevels, showProjectPanels } from '~/ui/ProjectPanel';
import { showsSkip, writeSkip } from '~/ui/SkipButton';
import { showTouchPoints } from '~/ui/TouchPoints';
import { captionHover, nameLevel, showWorldNames, type WorldNamesView } from '~/ui/WorldNames';
import { motion } from '../motion';
import { engravedLevels, shaftRings } from './engravedWay';
import type { Handover } from './Home';
import { type LightPose, WORLD_PROJECTS } from './journey';
import { LOOK } from './look';
import { setGasPass } from '../gasPass';
import { nebulaLevels } from './nebulaWay';
import { makeQaScene, type QaScene } from './qaScene';
import { insidePoints, OPEN_LOOK, openLevels, openOf, openWorld, worldClockRuns } from './inside';
import { type SpotPose, spotFor } from './spot';
import { easeHover, hoverEase, hoversAt, nearestSphere, needleFor, needleGlowFor, pointerMode, voidShownAt } from './voidPose';
import { loadVoid, type VoidLoadSteps } from './voidLoad';
import { uploadTextures, warm } from './warm';
import { boardCentre, boardTops, stackPlaces } from './worldLayout';
import { type WorldFrame, type WorldPath, worldPathFor } from './worldPath';

/** The longest step the void's clocks take in one frame, seconds: a wake from sleep jumps nothing. */
const MAX_STEP = 0.1;

/** The materials a mesh wears. */
function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** The textures a material holds (its maps and its shader's uniforms), each once. */
function texturesOf(material: THREE.Material): THREE.Texture[] {
  const found = Object.values(material).filter((value): value is THREE.Texture => (value as THREE.Texture | null)?.isTexture === true);
  const uniforms = (material as THREE.ShaderMaterial).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as THREE.Texture | null)?.isTexture === true) found.push(u.value as THREE.Texture);
  return [...new Set(found)];
}

/** Every texture the meshes under `root` wear. */
function texturesUnder(root: THREE.Object3D): Set<THREE.Texture> {
  const found = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) for (const material of materialsOf(mesh)) for (const texture of texturesOf(material)) found.add(texture);
  });
  return found;
}

/** The void once built: its model, the tier it stands at, and whether it is shown now (null before the first frame). */
interface SpaceParts {
  model: VoidModel;
  standing: QualityTier;
  shown: boolean | null;
}

/** The hologram world once built, and whether it is shown now (null before the first frame). */
interface WorldParts {
  model: WorldModel;
  /** The Q&A's ring and stars, built with the world (./qaScene.ts). */
  qa: QaScene;
  /** The gyroscope rings and the realistic stars round the stack (spec 2026-10-29-bob-stack-2-design.md, goal 3). */
  gyro: GyroModel;
  stars: StarsModel;
  shown: boolean | null;
}

/** The Void's running state: plain values, written per frame and by the load. */
interface VoidRun {
  state: VoidState;
  /** The void, from the hand-over on; null before it is built. */
  space: SpaceParts | null;
  /** The hologram world, once built; null before (and for good if it failed). */
  world: WorldParts | null;
  /** The engraved way (the compass's shaft), for the tier it was built at; null before. */
  engraved: { tier: QualityTier; model: EngravedModel } | null;
  /**
   * The nebula (./nebulaWay.ts, ../../engine/bob/build/nebula.ts) for the world's path and the tier it was built for, null
   * before; and the build asked for and not yet made (`asked`), which a later ask for another path or tier, or the
   * unmount, replaces.
   */
  nebula: { world: WorldPath; tier: QualityTier; model: NebulaModel; gas: VolumeModel | null } | null;
  nebulaAsked: { world: WorldPath; tier: QualityTier } | null;
  /** The void's drift clock (its mist and dust), seconds of frames drawn while it showed. */
  time: number;
  /**
   * The world's clock (./inside.ts `worldClockRuns`): its seconds, kept between runs so nothing snaps back; when it was
   * last stirred (an input, the story's move, a project opening), ms; and the story's place and the open project on the
   * last frame, to see them change.
   */
  clock: { time: number; stirred: number; place: number; open: ProjectId | null };
  /** The Q&A's ring may be turned by hand now: it shows, past the look back's stop (src/input/ringDrag.ts). */
  qaDrag: boolean;
  /** The hover, eased one project at a time (its place in `WORLD_PROJECTS`), and the project under the pointer now. */
  hover: ReturnType<typeof hoverEase>;
  pointed: number | null;
  /** The world is shown over the home's scene and no project is close: the pointer is read (`hoversAt` too). */
  reading: boolean;
  hovering: boolean;
  /** `<html data-skip>` as last written: the skip button shows (src/ui/SkipButton.tsx). */
  skip: { shown: boolean };
}

/** No screen: the words are taken away. */
const NO_SIZE = { width: 0, height: 0 };

/** The light out: no glow, so its body and its trail are hidden and its lamp is at 0. */
const DARK: LightPose = { position: [0, 0, 0], radius: 0, glow: 0, stretch: 0, yaw: 0, trail: [], trailLevel: 0, filaments: [], sparks: [] };

/** Below this the camera is under the void's glass sky (the previs's SKY_Z, a hair under the ceiling), which shows from there. */
const UNDER_SKY = VOID_LOOK.ceiling.y - 0.1;

const DEG = Math.PI / 180;

/** No project open. */
const NONE_OPEN: Readonly<Record<ProjectId, number>> = {} as Record<ProjectId, number>;
/** No project risen off its socket (the open lifts it from the next round on). */
const NONE_LIFTED: Readonly<Record<ProjectId, number>> = {} as Record<ProjectId, number>;
/** The stack's boards as the path has them: where each stands open, and its sockets. */
const STACK_PLACES = stackPlaces(areasOnPath());
const STACK_CENTRE = boardCentre();
/** The font the boards' print is drawn in: loaded before they are drawn, or they print in the fallback. */
const PRINT_FONT = '500 40px "Martian Mono Variable"';

/** How much brighter the project under the pointer is, at the hover's full amount (the mock-up's 1.3). */
const HOVER_LIFT = 0.3;

// The pointer's ray against the world's projects.
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const sphereAt = new THREE.Vector3();
const sphereScale = new THREE.Vector3();

/**
 * The project (its place in `WORLD_PROJECTS`) whose click sphere the pointer (`pointer`, NDC) is on, or none: of the
 * spheres its ray goes through, the one whose middle it passes nearest (`nearestSphere`), so a project seen behind
 * another's edge is still the one under the pointer on its own middle.
 */
function pick(model: WorldModel, pointer: { x: number; y: number }, camera: THREE.Camera): number | null {
  ndc.set(pointer.x, pointer.y);
  raycaster.setFromCamera(ndc, camera);
  const { origin, direction } = raycaster.ray;
  const spheres = model.hits.map((hit) => {
    hit.getWorldPosition(sphereAt);
    hit.getWorldScale(sphereScale);
    return { centre: sphereAt.toArray() as [number, number, number], radius: (hit as THREE.Mesh<THREE.SphereGeometry>).geometry.parameters.radius * sphereScale.x };
  });
  const k = nearestSphere(origin.toArray() as [number, number, number], direction.toArray() as [number, number, number], spheres);
  const id = k === null ? undefined : (model.hits[k]!.userData.id as ProjectId | undefined);
  const index = id === undefined ? -1 : WORLD_PROJECTS.indexOf(id);
  return index === -1 ? null : index;
}

/** Shows or hides the void. */
function showSpace(space: SpaceParts, shown: boolean): void {
  if (space.shown === shown) return;
  space.shown = shown;
  space.model.group.visible = shown;
}

/** Shows or hides the world. */
function showWorld(world: WorldParts, shown: boolean): void {
  if (world.shown === shown) return;
  world.shown = shown;
  world.model.group.visible = shown;
  if (!shown) {
    world.qa.hide();
    world.gyro.group.visible = false;
    world.stars.group.visible = false;
  }
}

// Scratch for the frame: nothing is made per frame.
const lightAt = new THREE.Vector3();
const centre = new THREE.Vector3();
/** The camera's place, for the nebula's bands (scratch, written each frame). */
const eyeAt: [number, number, number] = [0, 0, 0];
/** The machine's middle, top to the spine's tip: the height the gas's clear space stands round on the stack. */
const MACHINE_MIDDLE = STACK_CENTRE[1] + (STACK_PLACES[STACK_PLACES.length - 1]!.top - STACK_CENTRE[1] - 3.4) / 2;
/** Where the CPU's light is, over its lid: what lights the gas's near edges gold on the stack. */
const CPU_LIGHT: [number, number, number] = [STACK_CENTRE[0], STACK_CENTRE[1] + 1.5, STACK_CENTRE[2]];
/** The light's centre on the screen, NDC: `frame.journey.light` while there is a light. */
const lightPoint = { x: 0, y: 0 };

/** The names' view, written each frame they show: each project's object's top on the screen, its category, its light. */
/** No project under the pointer. */
const NO_HOVER: Readonly<{ id: ProjectId | null; amount: number }> = Object.freeze({ id: null, amount: 0 });
/** The project under the pointer and how far its hover has eased in, this frame (reused). */
const hovered: { id: ProjectId | null; amount: number } = { id: null, amount: 0 };

/** Whether the screen has no hover (a touch screen): a board's names then show at its stop. */
function touchScreen(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
}

const namesView: WorldNamesView = {
  opacity: 0,
  names: WORLD_PROJECTS.map((id) => ({ id, anchor: { x: 0, y: 0 }, category: projects.byId(id)!.categoryId, hot: false, level: 0 }))
};

/**
 * The world's words on a frame (src/ui/WorldNames.tsx, AreaCaption.tsx, AreaDots.tsx): its names by their objects' tops
 * with the hint, a board's words and the dots, as the path has them, all going as a project opens (`opened`, 0..1). A
 * name shows only under the mouse, as far as the hover on its project has eased in (`hover`) or while the mouse is on it
 * in a board's words; a touch screen shows the board in view's names at its stop (`nameLevel`). The name of the project
 * under the pointer (`hot`) lit. None without a world in view (`model` or `path` null).
 */
function showWorldWords(
  model: WorldModel | null,
  path: WorldFrame | null,
  camera: THREE.Camera,
  size: { width: number; height: number },
  hot: ProjectId | null,
  opened: number,
  hover: { id: ProjectId | null; amount: number } = NO_HOVER
): void {
  if (model === null || path === null) {
    showWorldNames(null, size);
    showAreaCaption(null);
    showAreaDots({ opacity: 0, lit: null });
    return;
  }
  const away = 1 - opened;
  namesView.opacity = path.names * away;
  // The hint says how to go on at the whole machine's stop alone; a board's own words say how to open its projects.
  namesView.hint = path.index < 0 ? namesView.opacity : 0;
  if (namesView.opacity > 0) {
    const touch = touchScreen();
    const board = path.index >= 0 ? (STACK_PLACES[path.index + 1]?.sockets.map((s) => s.id) ?? null) : null;
    const caption = captionHover();
    for (const name of namesView.names) {
      model.top(name.id).getWorldPosition(centre).project(camera);
      name.anchor.x = ((centre.x + 1) / 2) * size.width;
      name.anchor.y = ((1 - centre.y) / 2) * size.height;
      name.hot = name.id === hot;
      name.level = nameLevel(name.id, { touch, hover, caption, board });
    }
  }
  showWorldNames(namesView.opacity > 0 ? namesView : null, size);
  showAreaCaption(path.caption && { index: path.caption.index, opacity: path.caption.opacity * away });
  showAreaDots({ opacity: path.dots * away, lit: path.index >= 0 ? path.index : null });
}

/**
 * A project's click's sphere on the screen: its middle (CSS px) and its radius there, or the size of `across` m there
 * instead.
 */
function hitOnScreen(hit: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }, across?: number): { x: number; y: number; r: number } {
  hit.getWorldPosition(centre);
  const distance = centre.distanceTo(camera.position);
  centre.project(camera);
  const fov = (camera as THREE.PerspectiveCamera).fov;
  const radius = across ?? (hit as THREE.Mesh<THREE.SphereGeometry>).geometry.parameters.radius;
  return {
    x: ((centre.x + 1) / 2) * size.width,
    y: ((1 - centre.y) / 2) * size.height,
    r: (radius / (distance * Math.tan((fov * DEG) / 2))) * (size.height / 2)
  };
}

/** The half width an open object's touch point columns stand out past, m (the mock-up's). */
const TOUCH_REACH = 0.5;

/** No panel shown. */
const NO_PANELS: Readonly<Partial<Record<ProjectId, number>>> = {};

/**
 * The open project's words on a frame (src/ui/TouchPoints.tsx, src/ui/ProjectPanel.tsx): its touch points in two columns
 * beside its object once it is open, and its panel (on the way to the next, the panel of the one left going first). None
 * without a world in view or with no project open.
 */
function showOpenWords(model: WorldModel | null, close: Handover['close'], camera: THREE.Camera, size: { width: number; height: number }): void {
  const id = close.id;
  const hit = id === null || model === null ? undefined : model.hits.find((h) => h.userData.id === id);
  if (model === null || id === null || hit === undefined) {
    showTouchPoints(null, size, 1);
    showProjectPanels(NO_PANELS);
    return;
  }
  const object = hitOnScreen(hit, camera, size, TOUCH_REACH);
  const at = model.anchors(id).map((anchor) => {
    anchor.getWorldPosition(centre).project(camera);
    return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height };
  });
  const opacity = insidePoints(close.open);
  const keep = opacity > 0 ? panelKeepOut(id, size) : undefined;
  showTouchPoints({ id, opacity, at, centreX: object.x, reach: object.r, keep }, size, nameScale(size.width));
  showProjectPanels(panelLevels(id, close));
}

/** Each project's object on the screen for the proof harness: its click's sphere's middle (CSS px) and radius there. */
function objectsOnScreen(model: WorldModel, camera: THREE.Camera, size: { width: number; height: number }, visible: boolean): ObjectOnScreen[] {
  return model.hits.map((hit) => {
    const { x, y, r } = hitOnScreen(hit, camera, size);
    return { id: hit.userData.id as string, x, y, r, visible };
  });
}

export interface VoidProps {
  /** The compass, whose needle the Void gives to the light (`setNeedleWorld`). */
  compass: CompassModel;
  /** The light the needle becomes in the light dive, the Opening's (built with the loader's parts); the Void poses it. */
  light: LightModel;
  /** The Opening's hand-over: whether the journey is live, and the one pose of this frame (`pose`). */
  handover: Handover;
  /** The ladder's tier now: the void and the world are built at it, the void stepping down with it after, never up. */
  tier: QualityTier;
  /**
   * A click (or tap) on a project on the world: the Opening hands it `clickOnWorld` (src/ui/projectOpen.tsx), which opens
   * the project there at rest and does nothing while the camera glides. Without it, a click does nothing.
   */
  onOpen?(id: ProjectId): void;
}

/**
 * The void under the glass and the hologram world below it, on the home's scroll: the light dive's void, then the
 * world's path (spec 2026-10-27-bob-hologram-world-design.md).
 *
 * **Loading.** It mounts with Home, once the compass is there, and does nothing until the home has landed (the first
 * frame `handover.live` is true). Then it runs `loadVoid` (./voidLoad.ts): it builds the void (`buildVoid`) at the
 * ladder's tier at once, warms it and puts it in, so the light dive has its band and its dust from its first frame; then
 * it builds the world (`buildWorld`, its canvases drawn there) and warms it: its textures uploaded and its programs
 * compiled lit and shown, as the scene will draw them, then puts it in, hidden. `voidState` (the store, `frame.journey`,
 * `<html data-void>`) says `loading`, then `ready` with the world in; any throw says `failed` instead, logged as a
 * warning, and the void stays. The home's scroll holds by it (src/scene/bob/landingHold.ts): at the hand-over until the
 * world is ready, and there for good if it failed, where the home's project links show (src/styles/base.css).
 *
 * **Each frame** (after Home's) it applies the Opening's one pose of the frame (`handover.pose`):
 * - the needle (`setNeedleWorld(needleFor(pose))`, ./voidPose.ts) and the light (`LightModel.setPose`), Bob's fact riding
 *   beside it (src/ui/LightFacts.tsx), the skip button (src/ui/SkipButton.tsx), as before;
 * - the void shows from the light dive's frame 20 (`voidShownAt`); its glass sky only from under it and not in the look
 *   back; the fog the path's; its band, mist, dust and stream from the journey's \`void\`, the band and mist giving way to the
 *   nebula's clouds;
 * - the engraved shaft round the fall (./engravedWay.ts) and the nebula round the world (./nebulaWay.ts), built off the
 *   frame for the world's path at this aspect;
 * - the world, with the path: shown from the hand-over on, posed by the path's power, flash and each project's light;
 *   the project under the pointer (a ray against the world's click spheres, where `pointerMode` lets the pointer take
 *   one) eased a little brighter and named in the store (`hover`, for its name); with a project open (`handover.close`)
 *   the object opens, it is the one bright thing, and the board, the CPU, the light and the clouds step back
 *   (./inside.ts `openLevels`, `openWorld`, `OPEN_LOOK`).
 * A click on a project opens it (`onOpen`): wherever the pointer may take it, not on a control of the page, and not once
 * the sheet has begun.
 *
 * **Sleeping.** The world's clock (its float, its pads' rings, the pulse along the buses and the gears) runs for the idle
 * while after an input, the story's move or a project opening or closing (`worldClockRuns`), never with reduced motion;
 * the canvas draws on only while it runs or the hover eases, and sleeps after.
 *
 * Unmounting frees the void, the world, the shaft and the nebula, gives the needle back and says `idle`.
 */
export function Void({ compass, light, handover, tier, onOpen }: VoidProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  // Behind `?proof` the world on the screen is reported to the debug bridge. Asked once, at mount.
  const [proof] = useState(() => debugBridge() !== null);
  const [run] = useState<VoidRun>(() => ({
    state: 'idle',
    space: null,
    world: null,
    engraved: null,
    nebula: null,
    nebulaAsked: null,
    time: 0,
    clock: { time: 0, stirred: Number.NEGATIVE_INFINITY, place: Number.NaN, open: null },
    qaDrag: false,
    hover: hoverEase(),
    pointed: null,
    reading: false,
    hovering: false,
    skip: { shown: false }
  }));
  /** Starts the load, once: set by the mount below, called by the first frame the home has landed. */
  const start = useRef<() => void>(() => {});
  /** The latest props, for the load, which outlives the render that started it. */
  const latest = useRef({ tier, onOpen });
  useLayoutEffect(() => {
    latest.current = { tier, onOpen };
  });

  useEffect(() => {
    let disposed = false;

    /** Says where the void stands: the store (the scroll's hold reads it), the debug bridge's journey and <html data-void>. */
    const say = (state: VoidState): void => {
      run.state = state;
      frame.journey.voidState = state;
      document.documentElement.setAttribute('data-void', state);
      useScene.getState().setVoidState(state);
    };

    const steps: VoidLoadSteps<SpaceParts, WorldParts> = {
      // The void, at the hand-over: built, and warmed shown and lit as the scene will draw it, beside the scene.
      buildVoid: async () => {
        const built = latest.current.tier;
        const model = buildVoid(built);
        const holder = new THREE.Group();
        holder.add(model.group);
        model.group.visible = true;
        model.setBand({ shown: true, y: 0.4, sigma: 0.075, strength: 1 }, camera);
        model.setRingMist(0.5);
        model.setDust(1);
        try {
          uploadTextures(gl, texturesUnder(holder));
          await warm(gl, holder, camera, 'the void', scene);
        } catch (error) {
          model.dispose();
          throw error;
        }
        holder.remove(model.group);
        model.setBand({ shown: false, y: 0.4, sigma: 0.075, strength: 0 }, camera);
        model.setRingMist(0);
        model.setDust(0);
        return { model, standing: built, shown: null };
      },
      freeVoid: (space) => space.model.dispose(),
      onVoid: (space) => {
        showSpace(space, false);
        scene.add(space.model.group);
        run.space = space;
        const now = lowerTier(space.standing, latest.current.tier);
        if (now !== space.standing) {
          space.standing = now;
          space.model.setTier(now);
        }
        // A camera already under the glass sees the void now; nothing draws on a page without a scene.
        if (useScene.getState().scene !== null) invalidate();
      },
      // The world: built, and warmed powered and shown as the scene will draw it, beside the scene. Under `?proof` the
      // harness may hold it back or fail it first (src/debug/worldGate.ts), as a slow or a broken world would.
      buildWorld: async () => {
        if (proof) await proofWorldGate();
        await document.fonts?.load(PRINT_FONT).catch(() => undefined);
        const model = buildWorld(STACK_PLACES, latest.current.tier, scene.environment);
        // The Q&A's gold ring and its stars (spec 2026-10-29-bob-stack-2-design.md, goal 1), built and warmed with it.
        const qa = makeQaScene(buildRing(RING_MARKS, scene.environment), buildDecorStars(latest.current.tier, STACK_CENTRE, MACHINE_MIDDLE));
        qa.ring.group.visible = qa.decor.group.visible = true;
        // The gyroscope rings and the stars round the stack, with it too.
        const gyro = buildGyro([STACK_CENTRE[0], MACHINE_MIDDLE, STACK_CENTRE[2]]);
        const stars = buildStars(starsRound(STACK_CENTRE, MACHINE_MIDDLE), latest.current.tier);
        gyro.group.visible = stars.group.visible = true;
        const holder = new THREE.Group();
        holder.add(model.group, qa.ring.group, qa.decor.group, gyro.group, stars.group);
        model.pose({
          power: 1,
          flash: 0,
          clock: 0,
          levels: Object.fromEntries(WORLD_PROJECTS.map((id) => [id, 1])) as Record<ProjectId, number>,
          open: NONE_OPEN,
          float: 0,
          world: 1,
          tops: boardTops(STACK_PLACES, 1),
          boardPower: STACK_PLACES.map(() => 1),
          boardLight: STACK_PLACES.map(() => 1),
          lift: NONE_LIFTED,
          spot: null,
          sink: 0
        });
        try {
          uploadTextures(gl, texturesUnder(holder));
          await warm(gl, holder, camera, 'the world', scene);
        } catch (error) {
          model.dispose();
          qa.dispose();
          gyro.dispose();
          stars.dispose();
          throw error;
        }
        holder.remove(model.group, qa.ring.group, qa.decor.group, gyro.group, stars.group);
        qa.ring.group.visible = qa.decor.group.visible = gyro.group.visible = stars.group.visible = false;
        if (disposed) {
          model.dispose();
          qa.dispose();
          gyro.dispose();
          stars.dispose();
          return null;
        }
        return { model, qa, gyro, stars, shown: null };
      },
      onWorld: (world) => {
        showWorld(world, false);
        scene.add(world.model.group, world.qa.ring.group, world.qa.decor.group, world.gyro.group, world.stars.group);
        run.world = world;
        if (useScene.getState().scene !== null) invalidate();
      },
      say,
      gone: () => disposed
    };

    start.current = () => {
      if (run.state !== 'idle' || disposed) return;
      void loadVoid(steps);
    };

    return () => {
      disposed = true;
      start.current = () => {};
      const space = run.space;
      const world = run.world;
      run.space = null;
      run.world = null;
      run.reading = run.hovering = false;
      useScene.getState().setHover(null);
      motion.beads = false;
      showTouchPoints(null, NO_SIZE, 1);
      showProjectPanels(NO_PANELS);
      showLightFacts(null, NO_SIZE);
      frame.journey.light = null;
      frame.journey.objects = null;
      frame.journey.world = null;
      writeSkip(document.documentElement, false, run.skip);
      compass.setNeedleWorld(null);
      if (space) {
        scene.remove(space.model.group);
        space.model.dispose();
      }
      if (world) {
        scene.remove(world.model.group, world.qa.ring.group, world.qa.decor.group, world.gyro.group, world.stars.group);
        world.model.dispose();
        world.qa.dispose();
        world.gyro.dispose();
        world.stars.dispose();
      }
      run.qaDrag = false;
      frame.journey.qa = null;
      const engraved = run.engraved;
      run.engraved = null;
      if (engraved) {
        scene.remove(engraved.model.group);
        engraved.model.dispose();
      }
      const nebula = run.nebula;
      run.nebula = null;
      run.nebulaAsked = null;
      if (nebula) {
        scene.remove(nebula.model.group);
        nebula.model.dispose();
        if (nebula.gas) freeGas(nebula.gas);
      }
      frame.journey.engraved = null;
      frame.journey.nebula = null;
      say('idle');
      document.documentElement.removeAttribute('data-void');
    };
  }, [gl, scene, camera, invalidate, compass, run]);

  // An input stirs the world's clock (its float, its rings, the pulse and the gears) for the idle while; a pointer move
  // over the page draws, as the hover may move onto a project or off one. The Rig's listener, added first, has put the
  // pointer in `frame.pointer`.
  useEffect(() => {
    const stir = (): void => {
      if (!run.world || useScene.getState().scene !== 'home') return;
      run.clock.stirred = performance.now();
      invalidate();
    };
    window.addEventListener('pointermove', stir, { passive: true });
    window.addEventListener('touchstart', stir, { passive: true });
    window.addEventListener('wheel', stir, { passive: true });
    window.addEventListener('keydown', stir);
    return () => {
      window.removeEventListener('pointermove', stir);
      window.removeEventListener('touchstart', stir);
      window.removeEventListener('wheel', stir);
      window.removeEventListener('keydown', stir);
    };
  }, [invalidate, run]);

  // The Q&A's ring turned by hand: a mouse's drag past the look back's stop, not one begun on a control or the answer.
  useEffect(
    () =>
      ringDragOn(window, { drag: dragRing, release: releaseRing }, (event) => {
        if (!run.qaDrag || useScene.getState().scene !== 'home') return false;
        return !(event.target as Element | null)?.closest?.('a, button, input, select, textarea, .qa-frame');
      }),
    [run]
  );

  // A click opens the project under the pointer (`onOpen`, src/ui/projectOpen.tsx `clickOnWorld`), wherever the pointer may
  // take one (`pointerMode`) and is read (`hovering`: not once the sheet has begun, where the click went through the
  // rising page). A click on a control of the page (a link, a button, a field) is the control's.
  useEffect(() => {
    const click = (event: MouseEvent): void => {
      const world = run.world;
      if (!world || !run.hovering || useScene.getState().scene !== 'home') return;
      if ((event.target as Element | null)?.closest?.('a, button, input, select, textarea, summary, label')) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!(w > 0 && h > 0)) return;
      const hit = pick(world.model, { x: (event.clientX / w) * 2 - 1, y: 1 - (event.clientY / h) * 2 }, camera);
      if (hit !== null) latest.current.onOpen?.(WORLD_PROJECTS[hit]!);
    };
    window.addEventListener('click', click);
    return () => window.removeEventListener('click', click);
  }, [camera, run]);

  // The ladder steps down while the scene is up: the void sheds its ring of mist and dust, in place; never back up.
  useEffect(() => {
    const space = run.space;
    if (!space) return;
    const to = lowerTier(space.standing, tier);
    if (to === space.standing) return;
    space.standing = to;
    space.model.setTier(to);
    invalidate();
  }, [tier, invalidate, run]);

  useFrame(({ size }, delta) => {
    const pose = handover.pose;
    const space = run.space;
    const world = run.world;
    if (!handover.live || pose === null) {
      // The Opening poses the scene itself (the loader, a held seek): the needle is the armillary's, the void is not there.
      compass.setNeedleWorld(null);
      light.setPose(DARK, camera);
      frame.journey.light = null;
      showLightFacts(null, size);
      writeSkip(document.documentElement, false, run.skip);
      if (space) showSpace(space, false);
      if (world) showWorld(world, false);
      if (run.engraved) run.engraved.model.group.visible = false;
      if (run.nebula) run.nebula.model.group.visible = false;
      if (run.nebula?.gas) run.nebula.gas.pass.enabled = false;
      frame.journey.engraved = null;
      frame.journey.nebula = null;
      frame.journey.objects = null;
      frame.journey.world = null;
      run.reading = run.hovering = false;
      motion.beads = false;
      showOpenWords(null, handover.close, camera, size);
      showWorldWords(null, null, camera, size, null, 0);
      return;
    }
    // The home has landed: the void loads now, once.
    start.current();
    // The needle gives itself to the light as it ignites (way frames 2-8); the compass holds it on the rise.
    compass.setNeedleWorld(needleFor(pose));
    const glow = needleGlowFor(pose.at);
    if (glow !== null) compass.setNeedleGlow(glow);
    camera.updateMatrixWorld();
    // A project open (or its page over it): the light steps back with the rest of the world, the project the bright thing.
    const close = handover.close;
    const opened = close.id !== null ? Math.min(1, Math.max(0, close.amount)) : 0;
    const dim = 1 + (OPEN_LOOK.light - 1) * opened;
    light.setPose(pose.light === null ? DARK : opened > 0 ? { ...pose.light, glow: pose.light.glow * dim, trailLevel: pose.light.trailLevel * dim } : pose.light, camera);
    // The light's centre on the screen (for the debug bridge too), and the fact riding with it.
    if (pose.light !== null) {
      lightAt.set(...pose.light.position).project(camera);
      lightPoint.x = lightAt.x;
      lightPoint.y = lightAt.y;
      frame.journey.light = lightPoint;
    } else {
      frame.journey.light = null;
    }
    const fact = pose.fact;
    if (pose.light !== null && fact !== null && fact.index !== null && fact.side !== null) {
      showLightFacts({ index: fact.index, side: fact.side, opacity: fact.opacity, glow: pose.light.glow, light: lightPoint }, size);
    } else {
      showLightFacts(null, size);
    }
    // The skip button, from the world's stop through the look back on the home page, and not while a project is close or
    // the camera flies to one.
    writeSkip(document.documentElement, useScene.getState().scene === 'home' && !handover.focus && showsSkip(pose), run.skip);
    if (!space) {
      motion.beads = false;
      showOpenWords(null, handover.close, camera, size);
      showWorldWords(null, null, camera, size, null, 0);
      return;
    }

    const shown = voidShownAt(pose);
    showSpace(space, shown);
    const path = pose.path;
    // The glass sky only from under it, and not in the look back, which looks up toward it.
    space.model.setSky((path?.sky ?? true) && camera.position.y < UNDER_SKY);
    // The fog the path's (it draws back as the camera pulls back), the studio's own before it.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = path?.fog.near ?? LOOK.fog.near;
      scene.fog.far = path?.fog.far ?? LOOK.fog.far;
    }
    // The engraved shaft round the fall, as the pose has it, glowing near the light.
    const engraved = engravedFor();
    const levels = engravedLevels(pose.at);
    engraved.model.update(levels, pose.light?.position ?? null, scene.fog instanceof THREE.Fog ? scene.fog : LOOK.fog);
    if (proof) frame.journey.engraved = levels;
    // The nebula round the world at this aspect, as the pose has it (./nebulaWay.ts); the void's own violet band and ring
    // of mist give way to it.
    const clouds = nebulaLevels(pose.at, path, opened);
    camera.position.toArray(eyeAt);
    nebulaFor(worldPathFor(size.width / Math.max(size.height, 1)))?.update(clouds, handover.shown, eyeAt);
    if (proof) frame.journey.nebula = clouds;
    // The gas (../../engine/bob/build/volume.ts), a pass in the post chain that marches it after the scene is drawn and
    // stops each ray at the scene's depth: its clear space round the stack's spine once the world is in, along the fall's
    // line before; its drift on the world's clock, so it stands still while the canvas sleeps; its near edges lit by the
    // CPU, or by the falling light.
    const kept = run.nebula;
    if (kept?.gas) {
      const onStack = path !== null;
      const light = pose.light?.position ?? CPU_LIGHT;
      kept.gas.update(camera as THREE.PerspectiveCamera, {
        clock: run.clock.time,
        level: clouds.clouds,
        power: path?.power ?? 0,
        aim: frame.shot?.target ?? [STACK_CENTRE[0], MACHINE_MIDDLE, STACK_CENTRE[2]],
        middle: onStack ? MACHINE_MIDDLE : light[1],
        clear: onStack ? 'stack' : 'fall',
        core: onStack ? CPU_LIGHT : light
      });
    }

    // The world, with the path: its power, its flash and each project's light; the project under the pointer a little
    // brighter, an open one the bright thing and the rest stepped back; its clock running a while after each stir.
    const { reducedMotion, scene: page, inside } = useScene.getState();
    const home = shown && page === 'home';
    run.reading = home && !handover.focus;
    run.hovering = run.reading && hoversAt(pose);
    const dt0 = Math.min(Math.max(delta, 0), MAX_STEP);
    let moving = false;
    if (world) {
      const on = shown && path !== null;
      showWorld(world, on);
      world.model.group.updateMatrixWorld();
      // The hover: the project under the pointer that the path lets it take, eased one at a time.
      const mode = run.hovering ? pointerMode(pose) : null;
      const hit = on && mode !== null && Number.isFinite(frame.pointerAt) ? pick(world.model, frame.pointer, camera) : null;
      run.pointed = hit;
      const easing = easeHover(run.hover, hit, dt0, reducedMotion || !home);
      useScene.getState().setHover(hit === null ? null : WORLD_PROJECTS[hit]!);
      // The clock: stirred by an input (the listeners above), by the story's move and by a project opening or closing.
      const now = performance.now();
      const clock = run.clock;
      if (frame.progress !== clock.place) {
        clock.place = frame.progress;
        clock.stirred = now;
      }
      if (inside !== clock.open) {
        clock.open = inside;
        clock.stirred = now;
      }
      const ticking = on && worldClockRuns(clock.stirred, now, reducedMotion);
      if (ticking) clock.time += dt0;
      if (on && path) {
        const levels = { ...path.levels };
        const hovered = run.hover.id === null ? null : WORLD_PROJECTS[run.hover.id];
        if (hovered && levels[hovered] !== undefined) levels[hovered] *= 1 + HOVER_LIFT * run.hover.amount;
        // Each project as far up to the spot as the move has it (the shown one, and those on their way down), lit as it
        // rises and opening as it nears the spot; the spot in front of the camera, which stays, while any is up.
        const lift = close.id !== null ? close.lifts : NONE_LIFTED;
        let open = NONE_OPEN;
        let spot: SpotPose | null = null;
        if (close.id !== null) {
          open = Object.fromEntries(Object.entries(lift).map(([id, up]) => [id, openOf(up ?? 0)])) as Record<ProjectId, number>;
          if (frame.shot) spot = spotFor(frame.shot, size.width / Math.max(size.height, 1), 1, clock.time);
        }
        world.model.pose({
          power: path.power,
          flash: path.flash,
          clock: clock.time,
          levels: openLevels(levels, lift, opened),
          open,
          float: reducedMotion ? 0 : 1,
          world: openWorld(opened),
          tops: boardTops(STACK_PLACES, path.explode),
          boardPower: path.boardPower,
          boardLight: path.boardLight,
          lift,
          spot,
          sink: path.qa?.close ?? 0
        });
        // What the boards, the spine and the CPU reflect turns with the camera round the stack, so they look the same from every side.
        world.model.turn(Math.atan2(camera.position.x - STACK_CENTRE[0], camera.position.z - STACK_CENTRE[2]));
        // The gyroscope rings, lit with the power and stepped back at a board and in the Q&A, quieter with a project open;
        // the stars round the stack in with them.
        world.gyro.pose({ level: path.rings.level * openWorld(opened), focus: path.rings.focus, clock: clock.time });
        world.stars.pose({ level: path.rings.level, clock: clock.time });
      }
      // The Q&A: the gold ring and its stars, the answer at its mark and the marks' buttons (./qaScene.ts); on the home
      // page alone, and not while a project is close.
      const qaSeen = world.qa.pose({
        path: on ? path : null,
        on: home && close.id === null && !handover.focus,
        clock: clock.time,
        dt: dt0,
        reduced: reducedMotion,
        camera,
        size,
        doc: typeof document === 'undefined' ? null : document
      });
      run.qaDrag = qaSeen !== null && qaSeen.place >= -1e-3;
      if (proof) frame.journey.qa = qaSeen;
      moving = (easing && home) || ticking;
      if (proof) frame.journey.objects = on ? objectsOnScreen(world.model, camera, size, true) : null;
    }
    // The world's words, and an open project's, on the home page only (a project's page over it has its own).
    const inView = home && world?.shown ? world.model : null;
    hovered.id = run.hover.id === null ? null : WORLD_PROJECTS[run.hover.id]!;
    hovered.amount = run.hover.amount;
    showWorldWords(inView, path, camera, size, run.pointed === null ? null : WORLD_PROJECTS[run.pointed]!, opened, hovered);
    showOpenWords(inView, close, camera, size);
    // The canvas draws on only while the hover eases or the world's clock runs; the first frame of it asks for the next.
    if (moving && !motion.beads) invalidate();
    motion.beads = moving;
    if (proof) {
      frame.journey.world = path
        ? { power: path.power, names: path.names, caption: path.caption ? { ...path.caption } : null, dots: path.dots, explode: path.explode, tops: boardTops(STACK_PLACES, path.explode), lift: { ...(close.id !== null ? close.lifts : NONE_LIFTED) } }
        : null;
    }
    if (!shown) return;
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);

    // The void from the journey: the band held to the camera, the ring of mist, the dust's glow and the stream; and its
    // slow drift.
    const v = pose.void;
    const giving = 1 - clouds.clouds;
    space.model.setBand({ shown: v !== null, y: v?.bandY ?? 0, sigma: v?.bandSigma ?? 0, strength: (v?.band ?? 0) * giving, distance: v?.bandDistance }, camera);
    space.model.setRingMist((v?.ringMist ?? 0) * giving);
    space.model.setDust(v?.dust ?? 0);
    space.model.setStream(v?.stream ?? 0);
    if (!reducedMotion) run.time += dt;
    space.model.setTime(run.time);
  });

  /**
   * The nebula for the world's path `world` at the ladder's tier, or the last one built while it is being made (null
   * before the first): its build is asked for on the first frame that needs it and made apart from the frame (a timeout),
   * so its textures and its points never stall a frame of the scroll; it is needed only from the fall's frame 50, seconds
   * of scrolling after the landing. A new path (a new aspect) or a lower tier asks for it afresh, and the new one takes the
   * old one's place, which is freed.
   */
  function nebulaFor(world: WorldPath): NebulaModel | null {
    const kept = run.nebula;
    if (kept && kept.world === world && kept.tier === tier) return kept.model;
    const asked = run.nebulaAsked;
    if (!asked || asked.world !== world || asked.tier !== tier) {
      const ask = { world, tier };
      run.nebulaAsked = ask;
      setTimeout(() => {
        if (run.nebulaAsked !== ask) return;
        run.nebulaAsked = null;
        const made = { world, tier: ask.tier, model: buildNebula(world.centre, ask.tier), gas: buildVolume(ask.tier) };
        const old = run.nebula;
        if (old) {
          scene.remove(old.model.group);
          old.model.dispose();
          if (old.gas) freeGas(old.gas);
        }
        scene.add(made.model.group);
        // The post chain (../Effects.tsx) lays the gas's pass in after the scene, before the bloom.
        if (made.gas) setGasPass(made.gas.pass);
        void warm(gl, made.model.group, camera, 'the nebula', scene);
        run.nebula = made;
        invalidate();
      }, 0);
    }
    return kept?.model ?? null;
  }

  /** Takes the gas's pass back from the post chain, off at once so no frame runs it while the chain lets it go, and frees it. */
  function freeGas(gas: VolumeModel): void {
    gas.pass.enabled = false;
    setGasPass(null, gas.pass);
    gas.dispose();
  }

  /** The engraved shaft at the ladder's tier, built afresh for a lower tier. */
  function engravedFor(): NonNullable<VoidRun['engraved']> {
    const kept = run.engraved;
    if (kept && kept.tier === tier) return kept;
    if (kept) {
      scene.remove(kept.model.group);
      kept.model.dispose();
    }
    const made = { tier, model: buildEngraved(shaftRings(), [], tier) };
    scene.add(made.model.group);
    // Built at the home, hidden until the light ignites: its shaders compiled now, so that frame does not stall.
    void warm(gl, made.model.group, camera, 'the engraved way', scene);
    run.engraved = made;
    return made;
  }
  return null;
}
