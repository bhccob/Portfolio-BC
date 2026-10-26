import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import cookiesScreen from '~/assets/beads/cookies-clicker.webp';
import funcialScreen from '~/assets/beads/funcial.webp';
import jontaiScreen from '~/assets/beads/jontai-energy.webp';
import type { ProjectId } from '~/data/projects';
import { type BeadsModel, loadBeads } from '~/engine/bob/build/beads';
import type { CompassModel } from '~/engine/bob/build/compass';
import { buildVoid, type VoidModel } from '~/engine/bob/build/void';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { frame } from '~/state/frame';
import { useScene, type VoidState } from '~/state/store';
import { showBeadLabel } from '~/ui/BeadLabel';
import { motion } from '../motion';
import type { Handover } from './Home';
import { BEADS } from './journey';
import { beadClocks, easeHover, hoverEase, hoversAt, selectedBead, stepBeadClocks, voidShownFor } from './voidPose';
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

/** How far along its own axis the reduced-motion hover's point stands: the bead brightens and turns not at all. */
const OWN_AXIS = 10;

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

/** The void and the beads once built, and what the frame poses of them. */
interface VoidParts {
  void: VoidModel;
  beads: BeadsModel;
  file: GLTF;
  screens: Record<ProjectId, THREE.Texture>;
  /** The beads' drawn parts (`drawnParts`), in no order. */
  drawn: THREE.Object3D[];
  /** Each bead's inner light and its own intensity (the file's), in `BEADS` order. */
  inner: THREE.PointLight[];
  innerIntensity: number[];
  /** The beads' lacquer shells, for the pointer's ray, in `BEADS` order. */
  bodies: THREE.Mesh[];
  /** The tier the parts stand at: built at the ladder's, stepped down since, never up. */
  standing: QualityTier;
  /** Whether the void and the beads are shown now (`show`); null before the first frame poses them. */
  shown: boolean | null;
}

/** The Void's running state: plain values, written per frame and by the load. */
interface VoidRun {
  state: VoidState;
  parts: VoidParts | null;
  clocks: ReturnType<typeof beadClocks>;
  hover: ReturnType<typeof hoverEase>;
  /** The bead under the pointer on the last frame, or null. */
  pointed: number | null;
  /** The selected bead on the last frame, or null. */
  selected: number | null;
  /** The void's drift clock (its mist and dust), seconds of frames drawn while it showed. */
  time: number;
  /** The void is shown over the home's scene and no bead is close (`handover.focus`): the selected bead's label shows. */
  reading: boolean;
  /**
   * The pointer is read: it may hover a bead, and a click may open the selected one. The void is read (`reading`) and the
   * end page has not begun to slide up (`hoversAt`): from there on the page covers the scene and lets the pointer through
   * while it moves, and a pointer there neither turns a bead, nor wakes the canvas, nor opens one.
   */
  hovering: boolean;
}

/** No screen: the label is taken away. */
const NO_SIZE = { width: 0, height: 0 };

const DEG = Math.PI / 180;

/** Shows or hides the void and the beads' drawn parts, and lights or darkens the beads' inner lights with them. */
function show(parts: VoidParts, shown: boolean): void {
  if (parts.shown === shown) return;
  parts.shown = shown;
  parts.void.group.visible = shown;
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
const ownAxis = new THREE.Vector3();

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
  /** The compass, whose needle the Void holds in the void (`setNeedleWorld`) once the dive starts. */
  compass: CompassModel;
  /** The Opening's hand-over: whether the journey is live, and the one pose of this frame (`pose`). */
  handover: Handover;
  /** The ladder's tier now: the void and the beads are built at it and step down with it after, never up. */
  tier: QualityTier;
  /** The Opening's stand-ins for the beads' inner lights (`beadLightStandIns`), in the scene until the beads are. */
  standIns: readonly THREE.PointLight[];
  /**
   * A click (or tap) on the selected bead, the bead of the current project stop, with the void shown over the home:
   * the Opening hands it `openBead` (src/ui/BeadLabel.tsx), the label's own way in, which flies into the porthole and
   * then goes to the project's page. Without it, a click does nothing.
   */
  onOpen?(id: ProjectId): void;
}

/**
 * The void under the glass and the project beads in it (spec §2.3 step 4 "the dive", §2.4), on the home's scroll.
 *
 * **Loading.** It mounts with Home, once the compass is there, and does nothing until the home has landed (the first
 * frame `handover.live` is true: the Opening has posed the home and handed it over; never during the loader). Then it
 * loads `bob-beads.glb` (three's GLTFLoader, once a page view) and the three screenshots, builds the void
 * (`buildVoid`) and the beads (`loadBeads`) at the ladder's tier, and warms them up: their textures uploaded, and their
 * programs compiled lit and shown, as the scene will draw them (`warm` into the scene, which still holds the beads'
 * light stand-ins, the beads' own lights hidden meanwhile, so the count compiled for is the count drawn with). Then, in
 * one step between two frames, the stand-ins go out and the void and the beads go in: no lit material is compiled
 * again. `voidState` (the store, `frame.journey`, `<html data-void>`) says `loading`, then `ready`; any throw of the load
 * or the build (a file that does not load, a GLB that lacks a part, a screen that does not decode) says `failed`
 * instead, logged as a warning (the browser's own report of a failed file is the one console error), and what was built
 * is freed. The home's scroll holds by it (src/scene/bob/diveHold.ts): over the tunnel's opening while it loads (d01), at BOB from above
 * if it failed, where the home's project links show (src/styles/base.css). A failed warm-up only costs a stall.
 *
 * **Each frame** (after Home's, so after the Rig has placed the camera and Home has posed the compass) it applies the
 * Opening's one pose of the frame (`handover.pose`, the journey at the progress the camera stands at):
 * - the needle: `setNeedleWorld(pose.needle)`, null on the rise (a no-op while not held), the override from the dive on;
 *   null again while the Opening poses the scene itself (the loader, a held seek) and on unmount;
 * - the void and the beads show only once the camera is under the glass (`voidShownFor`): hidden on the rise, at BOB
 *   from above and down to the opening, where on the high tier the floor would show the void's traces under the home's
 *   and its reflector would draw them again; the beads' inner lights go dark with them, by intensity;
 * - the void's light (`setLight`, the ring's mist, until the void's own pose replaces it) and its drift (`setTime`, on
 *   a clock that runs only on frames drawn while it shows, and not with reduced motion);
 * - each bead's light (`setLit`, the light dive's `lit`); no drift forward (`setForward(id, 0)`);
 * - the hover: on a pointer device (a mouse or pen that has moved, `frame.pointerAt`), the bead whose shell the pointer
 *   is over (a ray against `beads[id].body`), eased in and out one bead at a time (`easeHover`) and turned toward the
 *   camera, its position handed in every frame; with reduced motion it brightens at once and does not turn; never once the
 *   end page has begun to slide up (`hoversAt`: the sheet and the end page), where a pointer over the rising page or
 *   behind it turns no bead and wakes nothing;
 * - the objects' motion: each bead's clock runs only while it is the selected bead (the bead of the current project
 *   stop, `selectedBead`) or the hovered one, and not with reduced motion, and goes on from where it stopped
 *   (`stepBeadClocks`); Funcial's abacus has a clock of its own that counts back down while the bead is neither, so its
 *   beads slide back down calmly and up again from where they are, never snapping;
 * - the selected bead's label (src/ui/BeadLabel.tsx `showBeadLabel`): on its project stretch, beside the bead where the
 *   camera puts it on the screen (its centre projected, its radius from its distance and the field), in full at its stop
 *   and clear between stops; none anywhere else.
 * A pointer move over the page wakes the canvas only when it moves the hover onto another bead or off one; the hover,
 * the label and a click read nothing on a page without the home's scene, nor while a bead is seen close or the camera
 * flies to or from one (`handover.focus`); a click on the selected bead opens it (`onOpen`), placed by the window's
 * size, which is the canvas's (it fills the window), where the hover may be read: never once the night has begun, where
 * a click on the rising end page, which lets the pointer through to the scene while it moves, lands on Cookies Clicker's
 * place and must open nothing.
 *
 * **Sleeping.** It keeps the canvas drawing (`motion.beads`, and a frame asked for as it starts) while an object that
 * moves (its clock runs, or Funcial's abacus slides back down) is in the camera's view, or the hover is easing; otherwise it asks for nothing, so the canvas sleeps once
 * the scroll rests at the home, at BOB from above, at the overview (no bead is selected there) or with reduced motion,
 * and draws on at a bead's stop while its object moves.
 *
 * Unmounting frees the void, the beads, the screens' and the file's GPU side, gives the needle back and says `idle`.
 */
export function Void({ compass, handover, tier, standIns, onOpen }: VoidProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const [run] = useState<VoidRun>(() => ({
    state: 'idle',
    parts: null,
    clocks: beadClocks(),
    hover: hoverEase(),
    pointed: null,
    selected: null,
    time: 0,
    reading: false,
    hovering: false,
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

    /** Frees what the load built, and the GPU side of the files it built from. */
    const free = (parts: VoidParts): void => {
      parts.void.dispose();
      parts.beads.dispose();
      freeFileGpu(parts.file);
      for (const texture of Object.values(parts.screens)) texture.dispose();
    };

    const load = async (): Promise<void> => {
      const [file, screens] = await Promise.all([loadBeadsFile(), loadScreens()]);
      if (disposed) return;
      const built = latest.current.tier;
      const voidModel = buildVoid(built);
      let beads: BeadsModel;
      try {
        beads = loadBeads(file, built, screens);
      } catch (error) {
        voidModel.dispose();
        throw error;
      }
      const roots = BEADS.map(({ id }) => beads.beads[id].root);
      const inner = BEADS.map(({ id }, i) => roots[i]!.getObjectByName(`bead_${id}_inner`) as THREE.PointLight);
      const parts: VoidParts = {
        void: voidModel,
        beads,
        file,
        screens,
        drawn: roots.flatMap(drawnParts),
        inner,
        innerIntensity: inner.map((light) => light.intensity),
        bodies: BEADS.map(({ id }) => beads.beads[id].body),
        standing: built,
        shown: null,
      };

      // The warm-up: everything shown and lit, compiled as the scene will draw it, beside the scene. The beads' own
      // lights are hidden for it: the scene's stand-ins count for them (or, where BEAD_LIGHTS drops them, nothing does).
      const holder = new THREE.Group();
      holder.add(voidModel.group, beads.group);
      voidModel.group.visible = true;
      voidModel.setLight(1, 1);
      for (const light of inner) light.visible = false;
      try {
        uploadTextures(gl, texturesUnder(holder));
        await warm(gl, holder, camera, 'the void', scene);
      } catch (error) {
        free(parts);
        throw error;
      }
      if (disposed) {
        free(parts);
        return;
      }
      holder.remove(voidModel.group, beads.group);
      voidModel.setLight(0, 0);

      // In, between two frames: the stand-ins out and the beads' own lights in, so the light count stays.
      const lights = latest.current.standIns.length > 0;
      scene.remove(...latest.current.standIns);
      for (const light of inner) light.visible = lights;
      show(parts, false);
      scene.add(voidModel.group, beads.group);
      run.parts = parts;
      // The ladder may have stepped down while it loaded.
      const now = lowerTier(built, latest.current.tier);
      if (now !== built) {
        parts.standing = now;
        voidModel.setTier(now);
        beads.setTier(now);
      }
      say('ready');
      // A camera already under the glass (held in the tunnel) sees the void now; nothing draws on a page without a scene.
      if (useScene.getState().scene !== null) invalidate();
    };

    start.current = () => {
      if (run.state !== 'idle' || disposed) return;
      say('loading');
      load().catch((error: unknown) => {
        if (disposed) return;
        console.warn('[needle] the void could not be loaded: the scroll holds at BOB from above, where the home links show', error);
        say('failed');
      });
    };

    return () => {
      disposed = true;
      start.current = () => {};
      const parts = run.parts;
      run.parts = null;
      run.reading = run.hovering = false;
      motion.beads = false;
      showBeadLabel(null, NO_SIZE);
      compass.setNeedleWorld(null);
      if (parts) {
        scene.remove(parts.void.group, parts.beads.group);
        free(parts);
      }
      say('idle');
      document.documentElement.removeAttribute('data-void');
    };
  }, [gl, scene, camera, invalidate, compass, run]);

  // The ladder steps down while the scene is up: the void sheds its mist's layers and dust, the beads' glass
  // drops to the tier's, in place; never back up.
  useEffect(() => {
    const parts = run.parts;
    if (!parts) return;
    const to = lowerTier(parts.standing, tier);
    if (to === parts.standing) return;
    parts.standing = to;
    parts.void.setTier(to);
    parts.beads.setTier(to);
    invalidate();
  }, [tier, invalidate, run]);

  // A pointer move wakes the canvas only when it moves the hover onto a bead, off one or to another: the frame eases it.
  // The Rig's listener, added first, has put the pointer in `frame.pointer`.
  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const parts = run.parts;
      if (event.pointerType === 'touch' || !parts || !run.hovering || useScene.getState().scene !== 'home') return;
      if (pick(parts, frame.pointer, camera) !== run.pointed) invalidate();
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [camera, invalidate, run]);

  // A click on the selected bead opens its project, where a hook is given (Task 12), wherever the pointer is read
  // (`hovering`: not once the night has begun, where the click went through the rising end page). A click on a control
  // of the page (a link, a button, a field) is the control's.
  useEffect(() => {
    if (!onOpen) return;
    const click = (event: MouseEvent): void => {
      const parts = run.parts;
      if (!parts || !run.hovering || run.selected === null || useScene.getState().scene !== 'home') return;
      if ((event.target as Element | null)?.closest?.('a, button, input, select, textarea, summary, label')) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!(w > 0 && h > 0)) return;
      const at = { x: (event.clientX / w) * 2 - 1, y: 1 - (event.clientY / h) * 2 };
      if (pick(parts, at, camera) === run.selected) latest.current.onOpen?.(BEADS[run.selected]!.id);
    };
    window.addEventListener('click', click);
    return () => window.removeEventListener('click', click);
  }, [onOpen, camera, run]);

  useFrame(({ size }, delta) => {
    const pose = handover.pose;
    const parts = run.parts;
    if (!handover.live || pose === null) {
      // The Opening poses the scene itself (the loader, a held seek): the needle is the armillary's, the void is not there.
      compass.setNeedleWorld(null);
      if (parts) show(parts, false);
      run.reading = run.hovering = false;
      motion.beads = false;
      showBeadLabel(null, size);
      return;
    }
    // The home has landed: the void loads now, once.
    start.current();
    // The needle leaves the compass from the dive on (null on the rise: the compass holds it), after Home has posed it.
    compass.setNeedleWorld(pose.needle);
    if (!parts) {
      motion.beads = false;
      showBeadLabel(null, size);
      return;
    }

    const shown = voidShownFor(pose.shot);
    show(parts, shown);
    const { reducedMotion: reduced, scene: page } = useScene.getState();
    const home = shown && page === 'home';
    // A bead seen close, or the camera on its way to or from one: no label, and the pointer opens and hovers nothing.
    run.reading = home && !handover.focus;
    // Nor once the night has begun: a pointer over the rising page, or behind it, turns no bead and opens none.
    run.hovering = run.reading && hoversAt(pose);
    if (!shown) {
      Object.assign(run.hover, hoverEase());
      run.pointed = run.selected = null;
      stepBeadClocks(run.clocks, null, null, 0, reduced);
      motion.beads = false;
      showBeadLabel(null, size);
      return;
    }
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);
    const { void: space, beads } = parts;

    // The void's light, from the opening, and its slow drift.
    space.setLight(0, pose.void?.ringMist ?? 0);
    if (!reduced) run.time += dt;
    space.setTime(run.time);

    // Each bead's place in the journey.
    for (let i = 0; i < BEADS.length; i++) {
      const { id } = BEADS[i]!;
      beads.setForward(id, 0);
      beads.setLit(id, pose.beads?.find((bead) => bead.id === id)?.lit ?? 0);
    }

    // The hover, on a pointer device: the bead under the pointer, eased one at a time, turned toward the camera.
    camera.updateMatrixWorld();
    beads.group.updateMatrixWorld();
    const pointed = run.hovering && Number.isFinite(frame.pointerAt) ? pick(parts, frame.pointer, camera) : null;
    run.pointed = pointed;
    const easing = easeHover(run.hover, pointed, dt, reduced || !home);
    const hovered = run.hover.id;
    if (hovered === null || run.hover.amount <= 0) {
      beads.setHover(null);
    } else {
      const root = beads.beads[BEADS[hovered]!.id].root;
      // With reduced motion a point on its own axis (a bead faces +z at rest): it brightens and does not turn.
      const towards = reduced ? ownAxis.set(0, 0, OWN_AXIS).add(root.position) : camera.position;
      beads.setHover(BEADS[hovered]!.id, run.hover.amount, towards);
    }

    // The objects: each moves only while its bead is selected or hovered, but for Funcial's abacus sliding back down.
    const selected = home ? selectedBead(pose.at) : null;
    run.selected = selected;

    // The selected bead's label beside it, on its project stretch: in full at its stop, clear between stops.
    const labelled = run.reading ? selected : null;
    if (labelled === null) {
      showBeadLabel(null, size);
    } else {
      const { id, radius } = BEADS[labelled]!;
      beads.beads[id].root.getWorldPosition(centre);
      const distance = centre.distanceTo(camera.position);
      centre.project(camera);
      const fov = (camera as THREE.PerspectiveCamera).fov;
      const onScreen = (radius / (distance * Math.tan((fov * DEG) / 2))) * (size.height / 2);
      showBeadLabel({ id, ndc: { x: centre.x, y: centre.y }, radius: onScreen, rest: pose.at.local === 0 }, size);
    }
    stepBeadClocks(run.clocks, selected, pointed, dt, reduced);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    let moving = easing && home;
    for (let i = 0; i < BEADS.length; i++) {
      if (!run.clocks.moving[i]) continue;
      const { id, radius } = BEADS[i]!;
      // Funcial's abacus by its own clock, which counts back down, so its beads slide back rather than snap.
      beads.setMotion(id, run.clocks.time[i]!, id === 'funcial' ? run.clocks.abacus : undefined);
      const root = beads.beads[id].root;
      moving ||= frustum.intersectsSphere(sphere.set(root.getWorldPosition(centre), radius));
    }
    // The first frame of a motion asks for the next itself: the Heartbeat has run this frame already.
    if (moving && !motion.beads) invalidate();
    motion.beads = moving;
  });

  return null;
}
