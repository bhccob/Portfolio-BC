import { useFrame, useThree } from '@react-three/fiber';
import { damp } from 'maath/easing';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import cookiesScreen from '~/assets/beads/cookies-clicker.webp';
import funcialScreen from '~/assets/beads/funcial.webp';
import jontaiScreen from '~/assets/beads/jontai-energy.webp';
import { type ProjectId, projects } from '~/data/projects';
import { type BeadsModel, loadBeads } from '~/engine/bob/build/beads';
import type { CompassModel } from '~/engine/bob/build/compass';
import { debugBridge } from '~/debug/needleDebug';
import { buildEngraved, type EngravedModel } from '~/engine/bob/build/engraved';
import { buildNebula, type NebulaModel } from '~/engine/bob/build/nebula';
import type { LightModel } from '~/engine/bob/build/light';
import { buildVoid, VOID_LOOK, type VoidModel } from '~/engine/bob/build/void';
import { buildOffPathLights, buildWayLine, type OffPathLightsModel, type WayLineModel } from '~/engine/bob/build/wayLine';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { frame } from '~/state/frame';
import { useScene, type VoidState } from '~/state/store';
import { type PathLabelView, showBeadLabels } from '~/ui/BeadLabel';
import { showLightFacts } from '~/ui/LightFacts';
import { showTouchPoints } from '~/ui/TouchPoints';
import { showsSkip, writeSkip } from '~/ui/SkipButton';
import { motion } from '../motion';
import { engravedLevels, shaftRings, tripPoints } from './engravedWay';
import { FLOAT, floatAt, floatRuns, turnToward } from './beadFloat';
import type { Handover } from './Home';
import { insideBuild, insideClockRuns, insidePoints } from './inside';
import { BEAD_RADIUS, BEADS, type LightPose } from './journey';
import { lookingBack, type Path, type PathFrame, pathFor } from './lightPath';
import { LOOK } from './look';
import { cloudLayout, nebulaLevels } from './nebulaWay';
import { offPathPlaces } from './offPath';
import { TOUCH_POINTS } from './touchPoints';
import { easeHover, hoverEase, hoversAt, needleFor, needleGlowFor, pointerMode, selectedBead, voidShownAt, wakeFor } from './voidPose';
import { loadVoid, type VoidLoadSteps } from './voidLoad';
import { uploadTextures, warm } from './warm';

/** Where the beads' file is served from: public/models/bob-beads.glb, under the site's base. */
const BEADS_URL = `${import.meta.env.BASE_URL}models/bob-beads.glb`;

/** Each bead's real screenshot (src/assets/beads, from docs/discovery), shown on its display. */
const SCREEN_URLS: Readonly<Record<ProjectId, string>> = {
  funcial: funcialScreen,
  'jontai-energy': jontaiScreen,
  'cookies-clicker': cookiesScreen,
};

/** The longest step the void's clocks take in one frame, seconds: a wake from sleep jumps nothing. */
const MAX_STEP = 0.1;

/**
 * Whether the beads' three inner lights (`bead_<id>_inner`, the warm lamp in each hollow) are in the scene, by the tier
 * the Stage's parts are built at. Each joins every lit material's light loop, the home's compass and floor included,
 * so it costs every lit pixel of every frame, even at intensity 0. Measured on the medium tier (Task 11: Edge on the
 * GPU, 1440x900 at a pixel ratio of 1.25, the frame rate uncapped, six runs of 240 frames each way): at the home 1,897
 * frames a second with them against 2,080 without, about 0.05 ms a frame (9 %); at Funcial's and Jontai Energy's stops
 * no difference (1,372 against 1,355, 1,449 against 1,446). So they are kept on high and medium; on low, the last rung
 * of a device that is already struggling, they are dropped and the hollow is lit by the room and its baked occlusion.
 */
export const BEAD_LIGHTS: Readonly<Record<QualityTier, boolean>> = { high: true, medium: true, low: false };

/**
 * The lights that keep the beads' place in the scene's light count from the opening's first frame (the Opening adds
 * them with the loader's parts): one point light per bead, at intensity 0, where `BEAD_LIGHTS` keeps the beads' own,
 * none where it does not. three compiles a lit material's program for the number of lights the scene has, and builds
 * every one again when that number changes; the beads' own lights arrive with their file, after the home has landed,
 * so without these the compass, the floor and every other lit material would be compiled again, on the frame the beads
 * came in. The Void takes these out on the very frame it puts the beads' own in, so the count never changes.
 */
export function beadLightStandIns(tier: QualityTier): THREE.PointLight[] {
  if (!BEAD_LIGHTS[tier]) return [];
  return BEADS.map(({ id, centre }) => {
    const light = new THREE.PointLight(undefined, 0);
    light.name = `bead_${id}_inner:stand-in`;
    light.position.set(centre[0], centre[1], centre[2]);
    return light;
  });
}

/**
 * The beads' glTF, fetched and parsed at most once a page view (as the compass's is, src/scene/bob/Opening.tsx): a Void
 * mounted again builds its beads from the same file. A load that fails is forgotten, so the next mount tries again.
 * `loadBeads` copies the file's scene and shares its geometries and its vein maps; the Void that built the beads frees
 * their GPU side on unmount (`freeFileGpu`), and a later one uploads them again.
 */
let beadsFile: Promise<GLTF> | null = null;

function loadBeadsFile(): Promise<GLTF> {
  beadsFile ??= new GLTFLoader().loadAsync(BEADS_URL).catch((error: unknown) => {
    beadsFile = null;
    throw error;
  });
  return beadsFile;
}

/** The three screenshots as textures, once a page view; their GPU side is the mounted Void's to free. */
let screenFiles: Promise<Record<ProjectId, THREE.Texture>> | null = null;

/** One screenshot, decoded before it is handed on, so the upload does not decode it on the main thread. */
async function loadScreen(url: string): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  const image = texture.image as HTMLImageElement;
  await image.decode?.().catch(() => {});
  return texture;
}

function loadScreens(): Promise<Record<ProjectId, THREE.Texture>> {
  screenFiles ??= Promise.all(BEADS.map(({ id }) => loadScreen(SCREEN_URLS[id]).then((texture) => [id, texture] as const)))
    .then((pairs) => Object.fromEntries(pairs) as Record<ProjectId, THREE.Texture>)
    .catch((error: unknown) => {
      screenFiles = null;
      throw error;
    });
  return screenFiles;
}

/** The materials a mesh wears. */
function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** The textures a material holds (its maps), each once. */
function texturesOf(material: THREE.Material): THREE.Texture[] {
  return [...new Set(Object.values(material).filter((value): value is THREE.Texture => (value as THREE.Texture | null)?.isTexture === true))];
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

/** Frees the GPU side of the file's geometries and textures; the cached file keeps its arrays and images. */
function freeFileGpu(file: GLTF): void {
  file.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
  for (const texture of texturesUnder(file.scene)) texture.dispose();
}

/** True if `object` is a light or holds one. */
function holdsLight(object: THREE.Object3D): boolean {
  let found = false;
  object.traverse((o) => {
    found ||= (o as THREE.Light).isLight === true;
  });
  return found;
}

/**
 * What of a bead is drawn, as the nodes to show and hide: every child of its root but the inner light, going into a
 * child that holds a light (none does in the file: the light is the root's own child). Hiding these and not the root
 * keeps the light in the scene, so hiding a bead never changes the light count.
 */
export function drawnParts(root: THREE.Object3D): THREE.Object3D[] {
  return root.children.flatMap((child) => ((child as THREE.Light).isLight ? [] : holdsLight(child) ? drawnParts(child) : [child]));
}

/** The void once built: its model, the tier it stands at, and whether it is shown now (null before the first frame). */
interface SpaceParts {
  model: VoidModel;
  standing: QualityTier;
  shown: boolean | null;
}

/** The beads once built, and what the frame poses of them. */
interface VoidParts {
  beads: BeadsModel;
  file: GLTF;
  screens: Record<ProjectId, THREE.Texture>;
  /** The beads' drawn parts (`drawnParts`), in no order; and each bead's, in `BEADS` order. */
  drawn: THREE.Object3D[];
  drawnBy: THREE.Object3D[][];
  /** Each bead's inner light and its own intensity (the file's), in `BEADS` order. */
  inner: THREE.PointLight[];
  innerIntensity: number[];
  /** The beads' lacquer shells, for the pointer's ray, in `BEADS` order. */
  bodies: THREE.Mesh[];
  /** The tier the parts stand at: built at the ladder's, stepped down since, never up. */
  standing: QualityTier;
  /** Whether the beads are shown now (`show`); null before the first frame poses them. */
  shown: boolean | null;
}

/** The Void's running state: plain values, written per frame and by the load. */
interface VoidRun {
  state: VoidState;
  /** The void, from the hand-over on; null before it is built. */
  space: SpaceParts | null;
  /** The beads, once their file is in; null before (and for good if it failed). */
  parts: VoidParts | null;
  /** The look back's line of the way and the lights off it, for the path they were built for (an aspect's); null before. */
  way: { path: Path; line: WayLineModel; lights: OffPathLightsModel; places: [number, number, number][] } | null;
  /** The engraved way (the compass's shaft and the trips' lines), for the path and the tier it was built for; null before. */
  engraved: { path: Path; tier: QualityTier; model: EngravedModel } | null;
  /**
   * The nebula (./nebulaWay.ts, ../../engine/bob/build/nebula.ts) for the path and the tier it was built for, null before;
   * and the build asked for and not yet made (`asked`), which a later ask for another path or tier, or the unmount,
   * replaces.
   */
  nebula: { path: Path; tier: QualityTier; model: NebulaModel } | null;
  nebulaAsked: { path: Path; tier: QualityTier } | null;
  /** Each bead's build as last written (`setBuild`), in `BEADS` order: written again only when it changes. */
  built: number[];
  hover: ReturnType<typeof hoverEase>;
  /** The bead under the pointer on the last frame, or null. */
  pointed: number | null;
  /** Which beads the pointer may take on the last frame (`pointerMode`). */
  mode: 'selected' | 'any' | null;
  /** The light off the way under the pointer on the last frame (in `projects.offPath()` order), or null. */
  pointedLight: number | null;
  /** Each bead's touch point anchors: its object's nodes by name, and its screen; found once the beads are in. */
  anchors: Partial<Record<ProjectId, { nodes: Map<string, THREE.Object3D>; screen: THREE.Mesh | null }>>;
  /** The selected bead on the last frame, or null. */
  selected: number | null;
  /** The void's drift clock (its mist and dust), seconds of frames drawn while it showed. */
  time: number;
  /**
   * The objects' clock inside a bead (./inside.ts): the bead it last ran for, its seconds (kept between insides, so an
   * object never snaps back to rest), and when the inside last stirred it (it opened, or the pointer moved), ms.
   */
  inside: { id: ProjectId | null; time: number; stirred: number };
  /**
   * The float of the bead at its arrival (./beadFloat.ts): the bead (its place on the way), its clock (s), when it was
   * last stirred (an input, ms), its turn as eased (radians), where it stood on the screen on the last frame (CSS px),
   * and a finger dragged across it on a touch screen (where it came down, and how far it has gone as a share of the
   * bead's radius, -1 to 1).
   */
  float: {
    index: number | null;
    time: number;
    stirred: number;
    yaw: number;
    pitch: number;
    screen: { x: number; y: number; r: number } | null;
    finger: { id: number; x: number } | null;
    drag: number;
  };
  /** The void is shown over the home's scene and no bead is close (`handover.focus`): the selected bead's label shows. */
  reading: boolean;
  /**
   * The pointer is read: it may hover a bead, and a click may open the selected one. The void is read (`reading`) and the
   * end page has not begun to slide up (`hoversAt`): from there on the page covers the scene and lets the pointer through
   * while it moves, and a pointer there neither turns a bead, nor wakes the canvas, nor opens one.
   */
  hovering: boolean;
  /** `<html data-skip>` as last written: the skip button shows (src/ui/SkipButton.tsx). */
  skip: { shown: boolean };
}

/** No screen: the label is taken away. */
const NO_SIZE = { width: 0, height: 0 };

/** The light out: no glow, so its body and its trail are hidden and its lamp is at 0. */
const DARK: LightPose = { position: [0, 0, 0], radius: 0, glow: 0, stretch: 0, yaw: 0, trail: [], trailLevel: 0, filaments: [], sparks: [] };

/** Below this the camera is under the void's glass sky (the previs's SKY_Z, a hair under the ceiling), which shows from there. */
const UNDER_SKY = VOID_LOOK.ceiling.y - 0.1;

const DEG = Math.PI / 180;

/** Shows or hides the void. */
function showSpace(space: SpaceParts, shown: boolean): void {
  if (space.shown === shown) return;
  space.shown = shown;
  space.model.group.visible = shown;
}

/**
 * Shows bead `i` as the path has it, once the beads are shown: its drawn parts while any of it shows (`fade` above 0),
 * its inner light at its own intensity times the fade.
 */
function showBead(parts: VoidParts, i: number, fade: number): void {
  const visible = fade > 0;
  for (const part of parts.drawnBy[i]!) part.visible = visible;
  parts.inner[i]!.intensity = parts.innerIntensity[i]! * fade;
}

/** Shows or hides the beads' drawn parts, and lights or darkens the beads' inner lights with them. */
function show(parts: VoidParts, shown: boolean): void {
  if (parts.shown === shown) return;
  parts.shown = shown;
  for (const part of parts.drawn) part.visible = shown;
  for (let i = 0; i < parts.inner.length; i++) parts.inner[i]!.intensity = shown ? parts.innerIntensity[i]! : 0;
  if (!shown) parts.beads.setHover(null);
}

// Scratch for the frame and the pointer: nothing is made per frame but the ray's hits.
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hits: THREE.Intersection[] = [];
const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();
const sphere = new THREE.Sphere();
const centre = new THREE.Vector3();
const lightAt = new THREE.Vector3();
const inView = new THREE.Vector3();
/** A point a bead's porthole turns to, handed to `BeadsModel.setFacing`. */
const facingAt = new THREE.Vector3();
/** The camera's place, for the nebula's bands (scratch, written each frame). */
const eyeAt: [number, number, number] = [0, 0, 0];
/** How near the pointer a light off the way takes it, CSS px. */
const LIGHT_PICK_PX = 18;

/** A bead with no float and no turn: its place and facing exactly. */
const NO_POSE = { y: 0, roll: 0, pitch: 0, yaw: 0 } as const;

/** How long the turn toward the pointer takes to ease in or back out, s (maath's damp). */
const TURN_SMOOTH = 0.25;

/** Hides the beads' labels and the touch points. */
function hideWords(size: { width: number; height: number }): void {
  showBeadLabels([], size);
  showTouchPoints(null, size.width);
}

/** A world point on a screen of `size` through `camera`, CSS px, with its radius there for a bead (BEAD_RADIUS). */
function onScreen(at: readonly [number, number, number], camera: THREE.Camera, size: { width: number; height: number }): { x: number; y: number; r: number } {
  centre.set(at[0], at[1], at[2]);
  const distance = centre.distanceTo(camera.position);
  centre.project(camera);
  const fov = (camera as THREE.PerspectiveCamera).fov;
  return {
    x: ((centre.x + 1) / 2) * size.width,
    y: ((1 - centre.y) / 2) * size.height,
    r: (BEAD_RADIUS / (distance * Math.tan((fov * DEG) / 2))) * (size.height / 2)
  };
}

/** How far under a bead's edge its label hangs, px; and how far a corner's touch point sits in from the screen's edge. */
const UNDER_BEAD = 18;
const CORNER_INSET = 14;

/** The screen's box on the screen (its geometry's eight corners projected), CSS px. */
function screenBox(mesh: THREE.Mesh, camera: THREE.Camera, size: { width: number; height: number }): { x0: number; y0: number; x1: number; y1: number } {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.boundingBox ?? mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (let c = 0; c < 8; c++) {
    centre.set(c & 1 ? box.max.x : box.min.x, c & 2 ? box.max.y : box.min.y, c & 4 ? box.max.z : box.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
    const x = ((centre.x + 1) / 2) * size.width;
    const y = ((1 - centre.y) / 2) * size.height;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

/** A bead on the screen for the proof harness: its centre (CSS px) and its radius at its distance and the field. */
function beadOnScreen(at: readonly [number, number, number], visible: boolean, camera: THREE.Camera, size: { width: number; height: number }) {
  centre.set(at[0], at[1], at[2]);
  const distance = centre.distanceTo(camera.position);
  centre.project(camera);
  const fov = (camera as THREE.PerspectiveCamera).fov;
  const r = (BEADS[0]!.radius / (distance * Math.tan((fov * DEG) / 2))) * (size.height / 2);
  return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height, r, visible };
}

/** The light's centre on the screen, NDC: `frame.journey.light` while there is a light. */
const lightPoint = { x: 0, y: 0 };
/** Each bead's place on the frame, by id, handed to `BeadsModel.place`: filled in place, never made per frame. */
const places = Object.fromEntries(BEADS.map(({ id }) => [id, [0, 0, 0]])) as Record<ProjectId, [number, number, number]>;

/** The light off the way nearest the pointer (`pointer`, NDC) within LIGHT_PICK_PX, on a screen of `size`; or none. */
function pickLight(places: readonly (readonly [number, number, number])[], pointer: { x: number; y: number }, camera: THREE.Camera, size: { width: number; height: number }): number | null {
  let best: number | null = null;
  let nearest = LIGHT_PICK_PX;
  for (let i = 0; i < places.length; i++) {
    const p = places[i]!;
    centre.set(p[0], p[1], p[2]).project(camera);
    if (centre.z >= 1) continue;
    const d = Math.hypot(((centre.x - pointer.x) / 2) * size.width, ((centre.y - pointer.y) / 2) * size.height);
    if (d <= nearest) {
      nearest = d;
      best = i;
    }
  }
  return best;
}

/** The bead whose shell the pointer (`pointer`, NDC) is over, nearest first, for a camera; or none. */
function pick(parts: VoidParts, pointer: { x: number; y: number }, camera: THREE.Camera): number | null {
  ndc.set(pointer.x, pointer.y);
  raycaster.setFromCamera(ndc, camera);
  let best: number | null = null;
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < parts.bodies.length; i++) {
    hits.length = 0;
    raycaster.intersectObject(parts.bodies[i]!, false, hits);
    const hit = hits[0];
    if (hit && hit.distance < nearest) {
      nearest = hit.distance;
      best = i;
    }
  }
  hits.length = 0;
  return best;
}

export interface VoidProps {
  /** The compass, whose needle the Void gives to the light (`setNeedleWorld`). */
  compass: CompassModel;
  /** The light the needle becomes in the light dive, the Opening's (built with the loader's parts); the Void poses it. */
  light: LightModel;
  /** The Opening's hand-over: whether the journey is live, and the one pose of this frame (`pose`). */
  handover: Handover;
  /** The ladder's tier now: the void and the beads are built at it and step down with it after, never up. */
  tier: QualityTier;
  /** The Opening's stand-ins for the beads' inner lights (`beadLightStandIns`), in the scene until the beads are. */
  standIns: readonly THREE.PointLight[];
  /**
   * A click (or tap) on the selected bead, the bead of the current project stop, with the void shown over the home:
   * the Opening hands it `openAt` (src/ui/BeadLabel.tsx), the label's own way in, which takes the visitor inside the
   * bead (a light off the way opens its page). Without it, a click does nothing.
   */
  onOpen?(id: ProjectId): void;
}

/**
 * The void under the glass and the project beads in it, on the home's scroll: the light dive's void, then the light's
 * path through the projects (spec 2026-10-27-bob-light-path-design.md).
 *
 * **Loading.** It mounts with Home, once the compass is there, and does nothing until the home has landed (the first
 * frame `handover.live` is true: the Opening has posed the home and handed it over; never during the loader). Then it
 * runs `loadVoid` (./voidLoad.ts): it builds the void (`buildVoid`) at the ladder's tier at once, warms it and puts it
 * in, so the light dive has its band and its dust from its first frame; then it loads `bob-beads.glb` (three's
 * GLTFLoader, once a page view) and the three screenshots, builds the beads (`loadBeads`) and warms them: their textures
 * uploaded, and their programs compiled lit and shown, as the scene will draw them (`warm` into the scene, which still
 * holds the beads' light stand-ins, the beads' own lights hidden meanwhile, so the count compiled for is the count drawn
 * with). Then, in one step between two frames, the stand-ins go out and the beads go in: no lit material is compiled
 * again. `voidState` (the store, `frame.journey`, `<html data-void>`) says `loading`, then `ready` with the beads in;
 * any throw of the beads' load or build (a file that does not load, a GLB that lacks a part, a screen that does not
 * decode) says `failed` instead, logged as a warning (the browser's own report of a failed file is the one console
 * error), what was built of the beads is freed, and the void stays. The home's scroll holds by it
 * (src/scene/bob/landingHold.ts): at the hand-over until the beads are ready, and there for good if they failed, where
 * the home's project links show (src/styles/base.css). A failed warm-up only costs a stall.
 *
 * **Each frame** (after Home's, so after the Rig has placed the camera and Home has posed the compass) it applies the
 * Opening's one pose of the frame (`handover.pose`, the journey at the progress the camera stands at):
 * - the needle: `setNeedleWorld(needleFor(pose))` (./voidPose.ts): null on the rise (a no-op while not held); held at
 *   the pivot and shrunk to nothing as the light ignites (way frames 2-8), and nothing from then on: the light stays the
 *   light to the end; null again while the Opening poses the scene itself (the loader, a held seek) and on unmount;
 * - the light (the Opening's, `LightModel.setPose`): the journey's `light`, dark where there is none; and Bob's fact
 *   riding beside it (src/ui/LightFacts.tsx `showLightFacts`): the journey's `fact`, at its opacity and the light's glow,
 *   placed by the light's centre on the screen; none anywhere else, nor while the Opening poses the scene itself;
 * - the void shows from the light dive's frame 20 (`voidShownAt`), as its band comes in, while the glass dissolves round
 *   the light (Home, `GlassModel.setDissolve`); its glass sky only once the camera is under it, and not in the look back
 *   (`setSky`); the fog the path's, drawing back as the camera pulls back, the studio's own before it; the beads with the
 *   path, their inner lights going dark with them, by intensity;
 * - the void, from the journey's `void`: the mist band held to the camera at its place on the frame (`setBand`), the
 *   dust's glow (`setDust`) and the stream that carries the dust toward the camera (`setStream`); and its drift
 *   (`setTime`, on a clock that runs only on frames drawn while it shows, and not with reduced motion);
 * - each bead from the path (./lightPath.ts): its place, its porthole turned to the camera's side (`setFacing`), its
 *   light (`setLit`), its fade into the dark or out of it (`setFade`, its parts hidden and its inner light out at none),
 *   its veins as the light's sweep has woken them, in the camera's view (`setWake`, `wakeFor`), and its object as the
 *   scroll has built it (`setBuild`), written only while it shows and when it changes;
 * - the look back's line of the whole way and the small lights of the projects off it (../../engine/bob/build/wayLine.ts),
 *   at the path's level, built for the path of the screen's aspect;
 * - the hover: on a pointer device (a mouse or pen that has moved, `frame.pointerAt`), the bead whose shell the pointer
 *   is over (a ray against `beads[id].body`) where the path lets the pointer take it (`pointerMode`: the bead in view in
 *   an orbit or an inside, any bead in the look back), eased in and out one bead at a time (`easeHover`) and turned
 *   toward the camera; with reduced motion it brightens at once and does not turn; never once the sheet over the look
 *   back has begun (`hoversAt`), where a pointer over the rising page or behind it turns no bead and wakes nothing;
 * - the words over the path (`showWords`): the label beside the light as it comes to rest at a bead (src/ui/BeadLabel.tsx
 *   `showBeadLabels`: right of the light, or under the bead on a phone), the look back's labels under each bead and light
 *   off the way, quiet until the pointer or the keyboard is on one, and the touch points of the bead seen inside, on the
 *   parts they name (src/ui/TouchPoints.tsx);
 * - the skip button (src/ui/SkipButton.tsx): `<html data-skip>` from the first project's arrival through the look back
 *   (`showsSkip`) on the home page and no bead close or flown to, and never while the Opening poses the scene itself or
 *   after unmount.
 * A pointer move over the page wakes the canvas only when it moves the hover onto another bead or off one; the hover and
 * a click read nothing on a page without the home's scene, nor while a bead is seen close or the camera flies to or from
 * one (`handover.focus`); a click opens what the pointer may take (`onOpen`): the bead in view, any bead of the look
 * back, or a light off the way within LIGHT_PICK_PX, placed by the window's size, which is the canvas's (it fills the
 * window).
 *
 * **Sleeping.** Nothing on the path moves by itself: the beads build with the scroll. So it keeps the canvas drawing
 * (`motion.beads`, and a frame asked for as it starts) only while the hover eases, and the canvas sleeps whenever the
 * scroll rests.
 *
 * Unmounting frees the void, the beads, the way's line and lights, the screens' and the file's GPU side, gives the needle
 * back and says `idle`.
 */
export function Void({ compass, light, handover, tier, standIns, onOpen }: VoidProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  // Behind `?proof` the path on the screen is reported to the debug bridge. Asked once, at mount.
  const [proof] = useState(() => debugBridge() !== null);
  const [run] = useState<VoidRun>(() => ({
    state: 'idle',
    space: null,
    parts: null,
    way: null,
    engraved: null,
    nebula: null,
    nebulaAsked: null,
    built: BEADS.map(() => Number.NaN),
    inside: { id: null, time: 0, stirred: Number.NEGATIVE_INFINITY },
    float: { index: null, time: 0, stirred: Number.NEGATIVE_INFINITY, yaw: 0, pitch: 0, screen: null, finger: null, drag: 0 },
    hover: hoverEase(),
    pointed: null,
    mode: null,
    pointedLight: null,
    anchors: {},
    selected: null,
    time: 0,
    reading: false,
    hovering: false,
    skip: { shown: false },
  }));
  /** Starts the load, once: set by the mount below, called by the first frame the home has landed. */
  const start = useRef<() => void>(() => {});
  /** The latest props, for the load, which outlives the render that started it. */
  const latest = useRef({ tier, standIns, onOpen });
  useLayoutEffect(() => {
    latest.current = { tier, standIns, onOpen };
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

    /** Frees what the beads' load built, and the GPU side of the files it built from. */
    const free = (parts: VoidParts): void => {
      parts.beads.dispose();
      freeFileGpu(parts.file);
      for (const texture of Object.values(parts.screens)) texture.dispose();
    };

    /** The ladder may have stepped down while a part loaded: it stands at the ladder's now, never above what it was built at. */
    const catchUp = (built: QualityTier, step: (to: QualityTier) => void): QualityTier => {
      const now = lowerTier(built, latest.current.tier);
      if (now !== built) step(now);
      return now;
    };

    const steps: VoidLoadSteps<SpaceParts, VoidParts> = {
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
        space.standing = catchUp(space.standing, (to) => space.model.setTier(to));
        // A camera already under the glass sees the void now; nothing draws on a page without a scene.
        if (useScene.getState().scene !== null) invalidate();
      },
      // The beads, once their file and the screens are in: built, and warmed shown and lit, their own lights hidden for
      // it (the scene's stand-ins count for them, or, where BEAD_LIGHTS drops them, nothing does).
      buildBeads: async () => {
        const [file, screens] = await Promise.all([loadBeadsFile(), loadScreens()]);
        if (disposed) return null;
        const built = latest.current.tier;
        const beads = loadBeads(file, built, screens);
        const roots = BEADS.map(({ id }) => beads.beads[id].root);
        const inner = BEADS.map(({ id }, i) => roots[i]!.getObjectByName(`bead_${id}_inner`) as THREE.PointLight);
        const parts: VoidParts = {
          beads,
          file,
          screens,
          drawn: roots.flatMap(drawnParts),
          drawnBy: roots.map(drawnParts),
          inner,
          innerIntensity: inner.map((light) => light.intensity),
          bodies: BEADS.map(({ id }) => beads.beads[id].body),
          standing: built,
          shown: null,
        };
        const holder = new THREE.Group();
        holder.add(beads.group);
        for (const light of inner) light.visible = false;
        try {
          uploadTextures(gl, texturesUnder(holder));
          await warm(gl, holder, camera, 'the beads', scene);
        } catch (error) {
          free(parts);
          throw error;
        }
        holder.remove(beads.group);
        if (disposed) {
          free(parts);
          return null;
        }
        return parts;
      },
      // In, between two frames: the stand-ins out and the beads' own lights in, so the light count stays.
      onBeads: (parts) => {
        const lights = latest.current.standIns.length > 0;
        scene.remove(...latest.current.standIns);
        for (const light of parts.inner) light.visible = lights;
        show(parts, false);
        scene.add(parts.beads.group);
        run.parts = parts;
        parts.standing = catchUp(parts.standing, (to) => parts.beads.setTier(to));
        if (useScene.getState().scene !== null) invalidate();
      },
      say,
      gone: () => disposed,
    };

    start.current = () => {
      if (run.state !== 'idle' || disposed) return;
      void loadVoid(steps);
    };

    return () => {
      disposed = true;
      start.current = () => {};
      const space = run.space;
      const parts = run.parts;
      run.space = null;
      run.parts = null;
      run.reading = run.hovering = false;
      motion.beads = false;
      showBeadLabels([], NO_SIZE);
      showTouchPoints(null, 0);
      showLightFacts(null, NO_SIZE);
      frame.journey.light = null;
      writeSkip(document.documentElement, false, run.skip);
      compass.setNeedleWorld(null);
      if (space) {
        scene.remove(space.model.group);
        space.model.dispose();
      }
      if (parts) {
        scene.remove(parts.beads.group);
        free(parts);
      }
      const way = run.way;
      run.way = null;
      if (way) {
        scene.remove(way.line.mesh, way.lights.points);
        way.line.dispose();
        way.lights.dispose();
      }
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
      }
      frame.journey.engraved = null;
      frame.journey.nebula = null;
      say('idle');
      document.documentElement.removeAttribute('data-void');
    };
  }, [gl, scene, camera, invalidate, compass, run]);

  // The ladder steps down while the scene is up: the void sheds its ring of mist and dust, the beads' glass drops to the
  // tier's, in place; never back up.
  useEffect(() => {
    let stepped = false;
    const space = run.space;
    if (space) {
      const to = lowerTier(space.standing, tier);
      if (to !== space.standing) {
        space.standing = to;
        space.model.setTier(to);
        stepped = true;
      }
    }
    const parts = run.parts;
    if (parts) {
      const to = lowerTier(parts.standing, tier);
      if (to !== parts.standing) {
        parts.standing = to;
        parts.beads.setTier(to);
        stepped = true;
      }
    }
    if (stepped) invalidate();
  }, [tier, invalidate, run]);

  // A pointer move wakes the canvas only when it moves the hover onto a bead, off one or to another: the frame eases it.
  // The Rig's listener, added first, has put the pointer in `frame.pointer`.
  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const parts = run.parts;
      if (event.pointerType === 'touch' || !parts || useScene.getState().scene !== 'home') return;
      // At an arrival the bead floats and turns toward the pointer: every move draws (and stirs its float).
      if (run.float.index !== null) {
        invalidate();
        return;
      }
      if (!run.hovering) return;
      if (pick(parts, frame.pointer, camera) !== run.pointed) invalidate();
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [camera, invalidate, run]);

  // At an arrival a touch, a wheel or a key stirs the bead's float again, and a finger dragged across the bead turns it
  // by its sideways move (its up and down move is the scroll's), easing back when it lifts.
  useEffect(() => {
    const float = run.float;
    const stir = (): void => {
      if (float.index === null) return;
      float.stirred = performance.now();
      invalidate();
    };
    const down = (event: TouchEvent): void => {
      stir();
      const touch = event.touches.length === 1 ? event.touches[0]! : null;
      const at = float.screen;
      float.finger = touch !== null && at !== null && float.index !== null && Math.hypot(touch.clientX - at.x, touch.clientY - at.y) <= at.r ? { id: touch.identifier, x: touch.clientX } : null;
      float.drag = 0;
    };
    const drag = (event: TouchEvent): void => {
      const finger = float.finger;
      const at = float.screen;
      if (finger === null || at === null) return;
      const touch = [...event.touches].find((t) => t.identifier === finger.id);
      if (!touch || event.touches.length !== 1) {
        float.finger = null;
        float.drag = 0;
      } else {
        float.drag = Math.max(-1, Math.min(1, (touch.clientX - finger.x) / at.r));
      }
      stir();
    };
    const lift = (): void => {
      if (float.finger === null) return;
      float.finger = null;
      float.drag = 0;
      stir();
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', drag, { passive: true });
    window.addEventListener('touchend', lift, { passive: true });
    window.addEventListener('touchcancel', lift, { passive: true });
    window.addEventListener('wheel', stir, { passive: true });
    window.addEventListener('keydown', stir);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', drag);
      window.removeEventListener('touchend', lift);
      window.removeEventListener('touchcancel', lift);
      window.removeEventListener('wheel', stir);
      window.removeEventListener('keydown', stir);
    };
  }, [invalidate, run]);

  // A click opens what the pointer may take (`pointerMode`), where a hook is given: in an orbit or an inside the bead in
  // view, in the look back any bead, or a light off the way; wherever the pointer is read (`hovering`: not once the sheet
  // has begun, where the click went through the rising page). A click on a control of the page (a link, a button, a
  // field) is the control's.
  useEffect(() => {
    if (!onOpen) return;
    const click = (event: MouseEvent): void => {
      const parts = run.parts;
      if (!parts || !run.hovering || run.mode === null || useScene.getState().scene !== 'home') return;
      if ((event.target as Element | null)?.closest?.('a, button, input, select, textarea, summary, label')) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!(w > 0 && h > 0)) return;
      const at = { x: (event.clientX / w) * 2 - 1, y: 1 - (event.clientY / h) * 2 };
      const hit = pick(parts, at, camera);
      if (run.mode === 'selected') {
        if (hit !== null && hit === run.selected) latest.current.onOpen?.(BEADS[hit]!.id);
        return;
      }
      if (hit !== null) {
        latest.current.onOpen?.(BEADS[hit]!.id);
        return;
      }
      const way = run.way;
      const light = way ? pickLight(way.places, at, camera, { width: w, height: h }) : null;
      if (light !== null) latest.current.onOpen?.(projects.offPath()[light]!.id);
    };
    window.addEventListener('click', click);
    return () => window.removeEventListener('click', click);
  }, [onOpen, camera, run]);

  useFrame(({ size }, delta) => {
    const pose = handover.pose;
    const space = run.space;
    const parts = run.parts;
    if (!handover.live || pose === null) {
      // The Opening poses the scene itself (the loader, a held seek): the needle is the armillary's, the void is not there.
      compass.setNeedleWorld(null);
      light.setPose(DARK, camera);
      frame.journey.light = null;
      showLightFacts(null, size);
      writeSkip(document.documentElement, false, run.skip);
      if (space) showSpace(space, false);
      if (parts) show(parts, false);
      if (run.engraved) run.engraved.model.group.visible = false;
      if (run.nebula) run.nebula.model.group.visible = false;
      frame.journey.engraved = null;
      frame.journey.nebula = null;
      run.reading = run.hovering = false;
      motion.beads = false;
      hideWords(size);
      return;
    }
    // The home has landed: the void loads now, once.
    start.current();
    // The needle gives itself to the light as it ignites (way frames 2-8), and comes back out of it at the ring; the
    // compass holds it on the rise. After Home has posed it.
    compass.setNeedleWorld(needleFor(pose));
    const glow = needleGlowFor(pose.at);
    if (glow !== null) compass.setNeedleGlow(glow);
    camera.updateMatrixWorld();
    light.setPose(pose.light ?? DARK, camera);
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
    // The skip button, from the first project through the look back on the home page, and not while a bead is close or
    // the camera flies to one.
    writeSkip(document.documentElement, useScene.getState().scene === 'home' && !handover.focus && showsSkip(pose), run.skip);
    if (!space) {
      motion.beads = false;
      hideWords(size);
      return;
    }

    const shown = voidShownAt(pose);
    showSpace(space, shown);
    const path = pose.path;
    // The beads come in with the path.
    if (parts) show(parts, shown && path !== null);
    // The glass sky only from under it, and not in the look back, which looks up toward it: from above it would stand
    // round the hole as a second rim.
    space.model.setSky((path?.sky ?? true) && camera.position.y < UNDER_SKY);
    // The fog the path's (it draws back as the camera pulls back), the studio's own before it.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = path?.fog.near ?? LOOK.fog.near;
      scene.fog.far = path?.fog.far ?? LOOK.fog.far;
    }
    const { reducedMotion: reduced, scene: page } = useScene.getState();
    const home = shown && page === 'home';
    // A bead seen close, or the camera on its way to or from one: no label, and the pointer opens and hovers nothing.
    run.reading = home && !handover.focus;
    // Nor once the sheet has begun: a pointer over the rising page, or behind it, turns no bead and opens none.
    run.hovering = run.reading && hoversAt(pose);
    // The look back's line and the lights off the way, built for the path at this aspect.
    const way = wayFor(pathFor(size.width / Math.max(size.height, 1)));
    const level = shown && path !== null ? path.way * (1 - path.black) : 0;
    way.line.setLevel(level);
    way.lights.setLevel(level);
    // The engraved way at this aspect: the shaft round the fall, a line on every trip, each as the pose has it, glowing
    // near the light; the shaft's throat in its own fog, the rest in the scene's.
    const engraved = engravedFor(pathFor(size.width / Math.max(size.height, 1)));
    const levels = engravedLevels(pose.at, pose.path, engraved.path.count);
    engraved.model.update(levels, pose.light?.position ?? null, scene.fog instanceof THREE.Fog ? scene.fog : LOOK.fog);
    if (proof) frame.journey.engraved = levels;
    // The nebula at this aspect: its clouds the light falls through and the camera flies through, its far bands turning
    // with the place, as the pose has them (./nebulaWay.ts); the void's own violet band and ring of mist give way to it.
    const clouds = nebulaLevels(pose.at, pose.path);
    camera.position.toArray(eyeAt);
    nebulaFor(pathFor(size.width / Math.max(size.height, 1)))?.update(clouds, handover.shown, eyeAt);
    if (proof) frame.journey.nebula = clouds;
    if (!shown) {
      Object.assign(run.hover, hoverEase());
      run.pointed = run.selected = null;
      run.mode = null;
      motion.beads = false;
      hideWords(size);
      return;
    }
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);

    // The void from the journey: the band held to the camera, the ring of mist, the dust's glow and the stream; and its
    // slow drift.
    const v = pose.void;
    const giving = 1 - clouds.clouds;
    space.model.setBand({ shown: v !== null, y: v?.bandY ?? 0, sigma: v?.bandSigma ?? 0, strength: (v?.band ?? 0) * giving, distance: v?.bandDistance }, camera);
    space.model.setRingMist((v?.ringMist ?? 0) * giving);
    space.model.setDust(v?.dust ?? 0);
    space.model.setStream(v?.stream ?? 0);
    if (!reduced) run.time += dt;
    space.model.setTime(run.time);
    if (!parts) {
      motion.beads = false;
      hideWords(size);
      return;
    }
    const { beads } = parts;

    // Each bead on the path: its place, its porthole turned to the camera's side, its light, its fade into the dark or out
    // of it, its veins as the light has woken them (in the camera's view), and its object as the scroll has built it,
    // written only while it shows and only when it changes.
    if (path !== null) {
      for (const bead of path.beads) {
        const at = places[BEADS[bead.index]!.id];
        at[0] = bead.centre[0];
        at[1] = bead.centre[1];
        at[2] = bead.centre[2];
      }
      beads.place(places);
      const view = camera.matrixWorldInverse;
      const toView = (p: readonly [number, number, number]): readonly [number, number] => {
        inView.set(p[0], p[1], p[2]).applyMatrix4(view);
        return [inView.x, inView.y];
      };
      const wakes: number[] | null = proof ? [] : null;
      if (wakes) frame.journey.wake = wakes;
      // The bead seen close (a click's inside, or the page over it) builds its objects as the camera goes in.
      const close = handover.close;
      for (const bead of path.beads) {
        const id = BEADS[bead.index]!.id;
        const fade = bead.visible ? bead.fade : 0;
        beads.setFacing(id, facingAt.set(bead.facing[0], bead.facing[1], bead.facing[2]));
        beads.setLit(id, bead.lit);
        beads.setFade(id, fade);
        showBead(parts, bead.index, fade);
        const wake = wakeFor(bead, way.path, toView);
        beads.setWake(id, wake);
        wakes?.push(wake.span);
        const build = close.id === id ? Math.max(bead.build, insideBuild(close.amount)) : bead.build;
        if (fade > 0 && build !== run.built[bead.index]) {
          beads.setBuild(id, build);
          run.built[bead.index] = build;
        }
      }
    }

    // Inside a bead the objects' clock runs (`insideClockRuns`): from the inside's opening and each pointer move over it,
    // for the home's idle while, never with reduced motion; then they rest where they are and the canvas sleeps.
    const now = performance.now();
    const inside = run.inside;
    const closeId = handover.close.amount > 0 ? handover.close.id : null;
    if (closeId !== null && closeId !== inside.id) {
      inside.id = closeId;
      inside.stirred = now;
    }
    if (closeId !== null && Number.isFinite(frame.pointerAt) && frame.pointerAt > inside.stirred) inside.stirred = frame.pointerAt;
    if (closeId === null) inside.id = null;
    const ticking = closeId !== null && insideClockRuns(inside.stirred, now, reduced);
    if (ticking) {
      inside.time += dt;
      beads.setMotion(closeId, inside.time);
    }

    // The path on the screen, for the proof harness: each bead's centre and radius, and the label's opacity.
    if (proof) {
      frame.journey.beads = path === null ? null : path.beads.map((bead) => beadOnScreen(bead.centre, bead.visible && bead.fade > 0, camera, size));
      frame.journey.label = path?.label ? { ...path.label } : null;
    }

    // The hover, on a pointer device: the bead under the pointer that the path lets it take (`pointerMode`), eased one at
    // a time, turned toward the camera.
    beads.group.updateMatrixWorld();
    const mode = run.hovering ? pointerMode(pose) : null;
    run.mode = mode;
    run.selected = home ? selectedBead(pose.at) : null;
    const hit = mode !== null && Number.isFinite(frame.pointerAt) ? pick(parts, frame.pointer, camera) : null;
    const pointed = mode === 'any' ? hit : mode === 'selected' && hit === run.selected ? hit : null;
    run.pointed = pointed;
    run.pointedLight = mode === 'any' && hit === null && Number.isFinite(frame.pointerAt) ? pickLight(way.places, frame.pointer, camera, size) : null;
    const easing = easeHover(run.hover, pointed, dt, reduced || !home);

    // The bead at its arrival floats and turns toward the pointer over it, or a finger's drag across it (./beadFloat.ts):
    // its clock runs while `floatRuns` (an input, or the pointer's move, stirs it), its turn eases in and back out over a
    // quarter second; with reduced motion it neither floats nor turns. Another bead, or none, lets the last one go.
    const float = run.float;
    const floating = home && run.reading && run.selected !== null && path !== null ? run.selected : null;
    if (floating !== float.index) {
      if (float.index !== null) beads.setPose(BEADS[float.index]!.id, NO_POSE);
      Object.assign(float, { index: floating, time: 0, stirred: now, yaw: 0, pitch: 0, screen: null, finger: null, drag: 0 });
    }
    let floatMoving = false;
    if (floating !== null && path !== null) {
      const id = BEADS[floating]!.id;
      const at = onScreen(path.beads[floating]!.centre, camera, size);
      float.screen = at;
      if (Number.isFinite(frame.pointerAt) && frame.pointerAt > float.stirred) float.stirred = frame.pointerAt;
      const runs = floatRuns((now - float.stirred) / 1000, reduced);
      if (runs) float.time += dt;
      const drift = reduced ? NO_POSE : floatAt(float.time, floating);
      const pointer = { x: ((frame.pointer.x + 1) / 2) * size.width, y: ((1 - frame.pointer.y) / 2) * size.height };
      const goal = reduced
        ? { yaw: 0, pitch: 0 }
        : float.finger !== null
          ? { yaw: FLOAT.turnMax * float.drag, pitch: 0 }
          : Number.isFinite(frame.pointerAt)
            ? turnToward(pointer, at)
            : { yaw: 0, pitch: 0 };
      const yawing = damp(float, 'yaw', goal.yaw, TURN_SMOOTH, dt);
      const pitching = damp(float, 'pitch', goal.pitch, TURN_SMOOTH, dt);
      beads.setPose(id, { y: drift.y, roll: drift.roll, pitch: drift.pitch + float.pitch, yaw: float.yaw });
      floatMoving = runs || yawing || pitching;
    }

    const hovered = run.hover.id;
    if (hovered === null || run.hover.amount <= 0) {
      beads.setHover(null);
    } else {
      // With reduced motion no point: it brightens and does not turn. Nor does the floating bead turn to the camera:
      // it turns toward the pointer instead.
      beads.setHover(BEADS[hovered]!.id, run.hover.amount, reduced || hovered === float.index ? undefined : camera.position);
    }
    // The touch points of the bead the visitor is inside (the store's `inside`), once the camera is all but in.
    const within = home && closeId !== null && useScene.getState().inside === closeId;
    const points = within ? { index: BEADS.findIndex((bead) => bead.id === closeId), opacity: insidePoints(handover.close.amount) } : path?.points ?? null;
    showWords(path, size, points);

    // Nothing moves by itself on the path for long: the canvas draws on only while the hover eases, the inside's clock
    // runs, or the bead at its arrival floats or its turn eases.
    const moving = (easing && home) || ticking || floatMoving;
    // The first frame of a motion asks for the next itself: the Heartbeat has run this frame already.
    if (moving && !motion.beads) invalidate();
    motion.beads = moving;
  });

  /**
   * The words over the path on a screen of `size`: the label beside the light as it comes to rest at a bead (right of the
   * light, or under the bead on a phone), the look back's labels under each bead and light off the way, quiet until the
   * pointer or the keyboard is on one, none while the void is not read (a bead close, or a page without the home's
   * scene); and the touch points of the bead the visitor is inside (`points`), on the parts they name.
   */
  function showWords(path: PathFrame | null, size: { width: number; height: number }, points: PathFrame['points']): void {
    const parts = run.parts;
    if (parts === null) {
      hideWords(size);
      return;
    }
    if (path === null || !run.reading) showBeadLabels([], size);
    else showLabels(path, size);
    showPoints(parts, points, size);
  }

  /** The labels the path shows (`showWords`). */
  function showLabels(path: PathFrame, size: { width: number; height: number }): void {
    const phone = size.width < size.height;
    const views: PathLabelView[] = [];
    if (path.label !== null && path.label.opacity > 0.001) {
      const id = BEADS[path.label.index]!.id;
      const bead = onScreen(path.beads[path.label.index]!.centre, camera, size);
      const light = { x: ((lightPoint.x + 1) / 2) * size.width, y: ((1 - lightPoint.y) / 2) * size.height };
      views.push(
        phone
          ? { id, anchor: { x: bead.x, y: bead.y + bead.r * 1.25 + UNDER_BEAD }, side: 'below', opacity: path.label.opacity, quiet: false, hover: false }
          : { id, anchor: light, side: 'right', opacity: path.label.opacity, quiet: false, hover: false }
      );
    } else if (lookingBack(path)) {
      for (const bead of path.beads) {
        const at = onScreen(bead.centre, camera, size);
        views.push({ id: BEADS[bead.index]!.id, anchor: { x: at.x, y: at.y + at.r + UNDER_BEAD }, side: 'below', opacity: 0, quiet: true, hover: run.pointed === bead.index });
      }
      const way = run.way;
      projects.offPath().forEach((project, k) => {
        const place = way?.places[k];
        if (!place) return;
        const at = onScreen(place, camera, size);
        views.push({ id: project.id, anchor: { x: at.x, y: at.y + UNDER_BEAD }, side: 'below', opacity: 0, quiet: true, hover: run.pointedLight === k });
      });
    }
    showBeadLabels(views, size);
  }

  /** The touch points of the bead seen inside, at `points`' opacity, or none (`showWords`). */
  function showPoints(parts: NonNullable<VoidRun['parts']>, points: PathFrame['points'], size: { width: number; height: number }): void {
    if (points === null || points.opacity <= 0.001) {
      showTouchPoints(null, size.width);
      return;
    }
    const id = BEADS[points.index]!.id;
    const root = parts.beads.beads[id].root;
    let anchors = run.anchors[id];
    if (!anchors) {
      const nodes = new Map<string, THREE.Object3D>();
      for (const place of TOUCH_POINTS[id]) if ('node' in place.anchor) nodes.set(place.anchor.node, root.getObjectByName(place.anchor.node)!);
      let screen: THREE.Mesh | null = null;
      root.getObjectByName(`bead_${id}_display`)?.traverse((o) => {
        if (!screen && (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveMap) screen = o as THREE.Mesh;
      });
      anchors = { nodes, screen };
      run.anchors[id] = anchors;
    }
    const box = anchors.screen ? screenBox(anchors.screen, camera, size) : null;
    const at = TOUCH_POINTS[id].map((place) => {
      if ('node' in place.anchor) {
        anchors.nodes.get(place.anchor.node)?.getWorldPosition(centre);
        centre.project(camera);
        return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height };
      }
      if (box === null) return { x: Number.NaN, y: Number.NaN };
      const { corner } = place.anchor;
      return { x: corner[1] === 'l' ? box.x0 : box.x1, y: corner[0] === 't' ? box.y0 + CORNER_INSET : box.y1 - CORNER_INSET };
    });
    showTouchPoints({ id, opacity: points.opacity, at }, size.width);
  }

  /**
   * The nebula for `path` at the ladder's tier, or the last one built while it is being made (null before the first):
   * its build is asked for on the first frame that needs it and made apart from the frame (a timeout), so its textures
   * and its points never stall a frame of the scroll; it is needed only from the fall's frame 50, seconds of scrolling
   * after the landing. A new path (a new aspect) or a lower tier asks for it afresh, and the new one takes the old one's
   * place, which is freed.
   */
  function nebulaFor(path: Path): NebulaModel | null {
    const kept = run.nebula;
    if (kept && kept.path === path && kept.tier === tier) return kept.model;
    const asked = run.nebulaAsked;
    if (!asked || asked.path !== path || asked.tier !== tier) {
      const ask = { path, tier };
      run.nebulaAsked = ask;
      setTimeout(() => {
        if (run.nebulaAsked !== ask) return;
        run.nebulaAsked = null;
        const made = { path, tier: ask.tier, model: buildNebula(cloudLayout(path, ask.tier), path, ask.tier) };
        const old = run.nebula;
        if (old) {
          scene.remove(old.model.group);
          old.model.dispose();
        }
        scene.add(made.model.group);
        void warm(gl, made.model.group, camera, 'the nebula', scene);
        run.nebula = made;
        invalidate();
      }, 0);
    }
    return kept?.model ?? null;
  }

  /** The engraved way for `path` at the ladder's tier, built afresh for another path (a new aspect) or a lower tier. */
  function engravedFor(path: Path): NonNullable<VoidRun['engraved']> {
    const kept = run.engraved;
    if (kept && kept.path === path && kept.tier === tier) return kept;
    if (kept) {
      scene.remove(kept.model.group);
      kept.model.dispose();
    }
    const made = { path, tier, model: buildEngraved(shaftRings(), tripPoints(path), tier) };
    scene.add(made.model.group);
    // Built at the home, hidden until the light ignites: its shaders compiled now, so that frame does not stall.
    void warm(gl, made.model.group, camera, 'the engraved way', scene);
    run.engraved = made;
    return made;
  }

  /** The look back's line and the lights off the way for `path`, built afresh when the path is another (a new aspect). */
  function wayFor(path: Path): NonNullable<VoidRun['way']> {
    const kept = run.way;
    if (kept !== null && kept.path === path) return kept;
    if (kept !== null) {
      scene.remove(kept.line.mesh, kept.lights.points);
      kept.line.dispose();
      kept.lights.dispose();
    }
    const places = offPathPlaces(path.wayPoints, projects.offPath().length);
    const way = { path, line: buildWayLine(path.wayPoints), lights: buildOffPathLights(places), places };
    scene.add(way.line.mesh, way.lights.points);
    run.way = way;
    return way;
  }
  return null;
}
