import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { COUNTRY_IDS } from '~/data/directions';
import { SafeStorage } from '~/engine/core/SafeStorage';
import { readout } from '~/engine/loading';
import { buildChip, type ChipModel } from '~/engine/v3/build/chip';
import { buildCity, type CityModel } from '~/engine/v3/build/city';
import { buildConstellations, type ConstellationsModel, STARS_LOOK } from '~/engine/v3/build/constellations';
import { buildGlassCompass, type GlassCompassModel } from '~/engine/v3/build/glassCompass';
import { buildLaser, type LaserModel } from '~/engine/v3/build/laser';
import { buildMist, type MistModel } from '~/engine/v3/build/mist';
import { buildNeedle, type NeedleModel } from '~/engine/v3/build/needle';
import { buildTraces, type TracesModel } from '~/engine/v3/build/traces';
import { CITY_BLOCKS, cityLayout } from '~/engine/v3/chipCity';
import { CHIP, engraved, ON_STROKES } from '~/engine/v3/chipSpec';
import { GLASS_RINGS, type RingId } from '~/engine/v3/compassSpec';
import { advanceClock, LOADER, loaderAt, loaderGaveUp, loaderSeen, markLoaderSeen } from '~/engine/v3/loaderTimeline';
import { paintRingStrip, RING_STRIP } from '~/engine/v3/paintRings';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { motion } from '../motion';
import { settleLoad } from '../settleLoad';
import { LOOK } from './look';
import { cameraShotAt, loadShare, type OpeningPath, type OpeningPose, openingPoseAt, tipAt } from './openingPose';

/** The longest step the mist's drift takes in one frame, seconds: a scene waking from sleep does not jump it. */
const MAX_STEP = 0.1;

/**
 * How long the sparks keep flying after the cut last moved, in the loader's seconds: the laser waiting on a slow load
 * holds its point on the cut, and its sparks die down rather than spray on one spot.
 */
const SPARKS_FADE = 0.4;

/**
 * The veil's draw order, as a group's: after every other group of the scene (the laser's 1, the mist's 2), so the night
 * it lays over the frame covers all of it.
 */
const VEIL_RENDER_ORDER = 100;

/** The loader's own objects: built, compiled and shown before the loader says it can show. */
interface LoaderParts {
  chip: ChipModel;
  laser: LaserModel;
  traces: TracesModel;
  mist: MistModel;
  veil: Veil;
  /** The laser group's height as built, on the chip's top: its lift is added to it. */
  laserBase: number;
}

/** The home's objects (Task 11), built while the loader engraves, and the four painted ring masks, the Opening's to free. */
interface HomeParts {
  compass: GlassCompassModel;
  needle: NeedleModel;
  city: CityModel;
  constellations: ConstellationsModel;
  masks: THREE.CanvasTexture[];
}

/** The night laid over the whole frame: the quick path's dark and the reduced landing's dip (Ruling 4). */
interface Veil {
  group: THREE.Group;
  /** How much of the night covers the frame, 0..1; 0 draws nothing. */
  set(level: number): void;
  dispose(): void;
}

/**
 * A quad over the whole picture in the night's colour (LOOK.background) at `level` opacity, drawn after everything
 * (its group's VEIL_RENDER_ORDER), with no depth and no fog. It lies in the scene, so it goes through the post chain
 * like the rest and is tone-mapped as the sky's night is: under it nothing blooms, and the premultiplied noise adds
 * next to no grain to the near-black.
 */
function buildVeil(): Veil {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const level = { value: 0 };
  const material = new THREE.ShaderMaterial({
    name: 'veil',
    uniforms: { uNight: { value: new THREE.Color(LOOK.background) }, uLevel: level },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform vec3 uNight;
uniform float uLevel;
void main() {
  gl_FragColor = vec4(uNight, uLevel);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'veil';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.visible = false;
  const group = new THREE.Group();
  group.name = 'veil';
  group.renderOrder = VEIL_RENDER_ORDER;
  group.add(mesh);
  return {
    group,
    set(value) {
      level.value = value;
      mesh.visible = value > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * The renderer as the warm-up sees it (milestone 1's pattern, src/scene/Compass.tsx). While the post chain is on, the
 * composer's render pass draws the scene into a half-float target, and three builds a different program for that
 * (linear output, no tone mapping) than for the screen; the warm-up compiles against such a target then, so the
 * programs it readies are the ones the first frame uses. `dispose` frees the target.
 */
function warmingRenderer(gl: THREE.WebGLRenderer, composer: boolean): { renderer: THREE.WebGLRenderer; dispose(): void } {
  if (!composer) return { renderer: gl, dispose: () => {} };
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const renderer = Object.create(gl) as THREE.WebGLRenderer;
  renderer.compileAsync = (scene, camera, targetScene) => {
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    try {
      // compile() reads the render target synchronously, before the returned promise settles.
      return gl.compileAsync(scene, camera, targetScene);
    } finally {
      gl.setRenderTarget(previous);
    }
  };
  return { renderer, dispose: () => target.dispose() };
}

/** Compiles every program of `scene` for the frames to come; a failure only costs the first frame a stall, so it is logged. */
async function warm(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, what: string): Promise<void> {
  const warming = warmingRenderer(gl, useScene.getState().tier !== 'low');
  try {
    await warming.renderer.compileAsync(scene, camera);
  } catch (error) {
    console.warn(`[needle] ${what} could not be warmed up; the first frame may stall`, error);
  } finally {
    warming.dispose();
  }
}

/** Lets a frame go by between two pieces of the load, so the loader keeps drawing while the masks paint. */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Paints the four rings' engraving (Task 9) into strips of this pointer's size, each as a CanvasTexture. A canvas that
 * gives no 2D context throws: the compass is not shown blank.
 */
async function paintMasks(finePointer: boolean, cancelled: () => boolean): Promise<Record<RingId, THREE.CanvasTexture> | null> {
  const [width, height] = RING_STRIP[finePointer ? 'fine' : 'coarse'];
  const masks = {} as Record<RingId, THREE.CanvasTexture>;
  for (const ring of GLASS_RINGS) {
    if (cancelled()) break;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      freeMasks(Object.values(masks));
      throw new Error('a ring mask has no 2D context to paint on');
    }
    paintRingStrip(ctx, ring, width, height);
    masks[ring.id] = new THREE.CanvasTexture(canvas);
    await breathe();
  }
  if (cancelled()) {
    freeMasks(Object.values(masks));
    return null;
  }
  return masks;
}

/** Frees the masks' GPU side and empties their canvases. */
function freeMasks(masks: THREE.CanvasTexture[]): void {
  for (const mask of masks) {
    mask.dispose();
    const canvas = mask.image as HTMLCanvasElement;
    canvas.width = canvas.height = 0;
  }
}

/** The opening's running state: its clock, its load and what it has done. Plain values, written per frame. */
interface Run {
  /** The Stage's onReady has been called: the loader is built and compiled, and the clock runs. */
  ready: boolean;
  /** The opening has given up or its load failed: it says nothing more. */
  failed: boolean;
  /** Visible seconds since the loader began (advanceClock). */
  elapsed: number;
  /** The smoothed load share (readout), and the share loaded. */
  shown: number;
  done: { paint: boolean; warm: boolean };
  /** The `elapsed` at which `shown` reached 1, or null while loading. */
  loadedAt: number | null;
  /** Which path plays: read once at mount. */
  path: OpeningPath;
  /** Where the cut stood, and when it last moved (loader seconds): the sparks fly while it moves. */
  cut: number;
  cutAt: number;
  /** The landing has happened: LOADED is sent and the loader marked seen, once. */
  landed: boolean;
  /** The home's pose has been applied since the clock last reached `home`: the home's parts are Home's (12b) from there. */
  posedHome: boolean;
  /** The aspect the home shot was last framed for, so a resize at home frames it again. */
  homeAspect: number;
  /** The mist's own clock, seconds of frames drawn. */
  mist: number;
  /** Fails the opening, once, unless it is gone: the load's throw and the give-up both end here. */
  fail(reason: string, error?: unknown): void;
}

export interface OpeningProps {
  /** Clearcoat on the glass rings (the quality ladder's `clearcoat`). */
  clearcoat: boolean;
  /** A mouse or trackpad: the finer ring masks and the larger city. */
  finePointer: boolean;
  /** The loader can show: its objects are built and their programs compiled. Called once. */
  onReady(): void;
  /** The opening failed: its objects could not be built, its load threw, or the load did not finish in time. */
  onFail(reason: string, error?: unknown): void;
}

/**
 * The v3 opening (spec §2.1), in the persistent canvas, in place of milestone 1's compass.
 *
 * **Build.** On mount it builds the chip (linked to the traces, so `setPower` drives their glow), the laser, the traces
 * and the mist, adds them, compiles their programs and calls `onReady`: the canvas fades in over the poster on a dark
 * board and the loader begins.
 *
 * **Load.** It then builds the home's objects (Task 11: the glass compass, the needle, the chip city, the
 * constellations), hidden, and paints the four ring masks (Task 9, the fine strips on a fine pointer): `paint`, 0.6 of
 * the load. Then it uploads the masks and compiles the home's programs (`renderer.compileAsync`): `warm`, the other 0.4.
 * A throw anywhere in it fails the scene (no partial compass); only a failed warm-up is let through, at the cost of a
 * stall.
 *
 * **Clock.** Each frame drawn: `elapsed = advanceClock(elapsed, delta)`, `shown = readout(shown, share, delta)`, then
 * `loaderAt`, and everything is posed from the result (openingPose.ts: `cameraShotAt` into `frame.shot`, which the Rig
 * follows, and `openingPoseAt` for the objects; the laser's tip at `tipAt`). The pose is a function of the clock alone,
 * so a held or sought clock (Task 12b) poses the scene as the live one did. The quick path is `loaderSeen` read once at
 * mount; reduced motion is the store's, read then too. `motion.loader` keeps the Heartbeat drawing until `home`;
 * `frame.loader` says where the opening stands.
 *
 * **Landing.** At `home` it dispatches `LOADED` (the only place it is sent while a Stage is up) and marks the loader
 * seen for the session, once. The laser is hidden, the chip lies dimmed under the hub with ON whole and all 64 pins lit,
 * the traces stay at t = 1 as the dim gilt rules, and from then on the Opening poses the home's parts once each time the
 * clock reaches `home`, leaving them to Home (12b) in between; it keeps the mist drifting and frames the home shot again
 * on a resize. On a country or project page it lands on the home view under that page's scrim, as milestone 1 did.
 *
 * **Give-up.** If the load has not finished after LOADER.giveUp visible seconds it calls `onFail`.
 *
 * Unmounting frees every object, material, texture and canvas it made.
 */
export function Opening({ clearcoat, finePointer, onReady, onFail }: OpeningProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const loader = useRef<LoaderParts | null>(null);
  const home = useRef<HomeParts | null>(null);
  const run = useRef<Run | null>(null);
  /** The latest props, for the load, which outlives the render that started it. */
  const latest = useRef({ clearcoat, onReady, onFail });
  useLayoutEffect(() => {
    latest.current = { clearcoat, onReady, onFail };
  });

  useEffect(() => {
    let disposed = false;
    let parts: LoaderParts;
    try {
      const traces = buildTraces();
      const chip = buildChip({ traces });
      const laser = buildLaser();
      const mist = buildMist();
      const veil = buildVeil();
      scene.add(traces.lines, chip.group, laser.group, mist.group, veil.group);
      parts = { chip, laser, traces, mist, veil, laserBase: laser.group.position.y };
    } catch (error) {
      latest.current.onFail('the compass could not be built', error);
      return;
    }
    loader.current = parts;

    const { reducedMotion } = useScene.getState();
    const state: Run = {
      ready: false,
      failed: false,
      elapsed: 0,
      shown: 0,
      done: { paint: false, warm: false },
      loadedAt: null,
      path: { quick: loaderSeen(SafeStorage.session()), reduced: reducedMotion },
      cut: 0,
      cutAt: Number.NEGATIVE_INFINITY,
      landed: false,
      posedHome: false,
      homeAspect: Number.NaN,
      mist: 0,
      fail: (reason, error) => {
        if (disposed || state.failed) return;
        state.failed = true;
        motion.loader = false;
        latest.current.onFail(reason, error);
      },
    };
    run.current = state;
    // The first moment of the opening, posed before anything is drawn: a dark board, or the night of the quick path.
    const first = loaderAt({ elapsed: 0, shown: 0, loadedAt: null, quick: state.path.quick, reduced: state.path.reduced });
    pose(parts, null, openingPoseAt(first, state.path), 0, state);
    frame.loader.stage = first.stage;

    const load = async (): Promise<void> => {
      // The loader's own programs first, so its first frame does not stall; then it can show.
      await warm(gl, scene, camera, 'the loader');
      if (disposed) return;
      state.ready = true;
      motion.loader = true;
      invalidate();
      latest.current.onReady();

      const blocks = cityLayout(CITY_BLOCKS[finePointer ? 'fine' : 'coarse']);
      const compass = buildGlassCompass();
      const needle = buildNeedle();
      const city = buildCity(blocks);
      const constellations = buildConstellations();
      compass.setClearcoat(latest.current.clearcoat);
      const built: HomeParts = { compass, needle, city, constellations, masks: [] };
      home.current = built;
      scene.add(compass.group, needle.group, city.mesh, constellations.group);
      // Hidden as the clock now has them, before a frame can show them.
      state.posedHome = false;
      pose(null, built, openingPoseAt(loaderAt(clockInput(state)), state.path), state.elapsed, state);

      const masks = await paintMasks(finePointer, () => disposed);
      if (!masks) return;
      if (disposed) return freeMasks(Object.values(masks));
      built.masks = Object.values(masks);
      compass.setRingMasks(masks);
      state.done.paint = true;
      invalidate();

      // The masks go up to the GPU now, not on the frame that first shows the glass, and the home's programs compile.
      for (const mask of built.masks) gl.initTexture(mask);
      await warm(gl, scene, camera, 'the compass');
      if (disposed) return;
      state.done.warm = true;
      invalidate();
    };

    void settleLoad(load, {
      disposed: () => disposed,
      ready: () => {},
      fail: (error) => state.fail('the compass load failed', error),
    });

    return () => {
      disposed = true;
      loader.current = null;
      run.current = null;
      motion.loader = false;
      frame.shot = null;
      frame.loader.stage = null;
      scene.remove(parts.traces.lines, parts.chip.group, parts.laser.group, parts.mist.group, parts.veil.group);
      parts.traces.dispose();
      parts.chip.dispose();
      parts.laser.dispose();
      parts.mist.dispose();
      parts.veil.dispose();
      const built = home.current;
      home.current = null;
      if (built) {
        scene.remove(built.compass.group, built.needle.group, built.city.mesh, built.constellations.group);
        built.compass.dispose();
        built.needle.dispose();
        built.city.dispose();
        built.constellations.dispose();
        freeMasks(built.masks);
      }
    };
  }, [gl, scene, camera, finePointer, invalidate]);

  // The quality ladder turns the clearcoat off (never back on): three compiles the glass once more.
  useEffect(() => {
    home.current?.compass.setClearcoat(clearcoat);
    invalidate();
  }, [clearcoat, invalidate]);

  useFrame((three, delta) => {
    const state = run.current;
    const parts = loader.current;
    if (!state?.ready || state.failed || !parts) return;

    state.elapsed = advanceClock(state.elapsed, delta);
    state.shown = readout(state.shown, loadShare(state.done), delta);
    if (state.loadedAt === null && state.shown >= 1) state.loadedAt = state.elapsed;
    if (loaderGaveUp(state.elapsed, state.loadedAt)) {
      state.fail(`the compass did not load within ${LOADER.giveUp} s of the page being visible`);
      return;
    }

    const clock = loaderAt(clockInput(state));
    const aspect = three.size.width / three.size.height;
    const atHome = clock.stage === 'home';
    frame.loader.stage = clock.stage;
    frame.loader.elapsed = state.elapsed;
    frame.loader.pins = clock.pins;
    motion.loader = !atHome;

    // The mist drifts on every frame drawn, at home too.
    state.mist += Math.min(Math.max(delta, 0), MAX_STEP);
    parts.mist.setTime(state.mist);

    if (!atHome || state.homeAspect !== aspect) {
      frame.shot = cameraShotAt(clock, aspect, state.path.reduced);
      state.homeAspect = atHome ? aspect : Number.NaN;
    }
    if (!atHome) state.posedHome = false;
    if (!state.posedHome) {
      pose(parts, home.current, openingPoseAt(clock, state.path), state.elapsed, state);
      // The home's pose is applied once, and only once its parts exist; then they are Home's.
      if (atHome && home.current) state.posedHome = true;
    }

    if (atHome && !state.landed) {
      state.landed = true;
      markLoaderSeen(SafeStorage.session());
      useScene.getState().dispatch({ type: 'LOADED' });
    }
  });

  return null;
}

/** What `loaderAt` is asked, from the running state. */
function clockInput(state: Run): Parameters<typeof loaderAt>[0] {
  return { elapsed: state.elapsed, shown: state.shown, loadedAt: state.loadedAt, quick: state.path.quick, reduced: state.path.reduced };
}

/**
 * Applies a pose to the loader's objects (`parts`; null for a home just built, which only takes the pose the loader
 * already shows) and, once they exist, the home's (`built`). The laser's tip stands at the cut (`tipAt`) and glides
 * from there to the chip's centre; its sparks fly while the cut moves, at the loader's `elapsed` seconds.
 */
function pose(parts: LoaderParts | null, built: HomeParts | null, at: OpeningPose, elapsed: number, state: Run): void {
  if (parts !== null) {
    const { chip, laser, traces, mist, veil } = parts;
    veil.set(at.veil);
    chip.setPins(at.pins);
    chip.setEngraving(engraved(ON_STROKES, at.engraving), at.cooled ? Number.NEGATIVE_INFINITY : elapsed);
    chip.setPower(at.power);
    chip.setRest(at.rest);
    traces.setT(at.traces);
    mist.setDensity(at.mist);

    laser.group.visible = at.laser.shown;
    if (at.laser.shown) {
      if (at.engraving !== state.cut) {
        state.cut = at.engraving;
        state.cutAt = elapsed;
      }
      const [x, z] = tipAt(at.engraving);
      const stay = 1 - at.laser.glide;
      laser.setTip(x * stay, z * stay);
      laser.group.position.y = parts.laserBase + at.laser.lift;
      laser.setOn(at.laser.on);
      const fresh = 1 - (elapsed - state.cutAt) / SPARKS_FADE;
      laser.setSparks(at.laser.on ? Math.min(1, Math.max(0, fresh)) : 0, elapsed);
    }
  }

  if (!built) return;
  built.compass.setFormed(at.formed);
  built.needle.group.visible = at.needle !== null;
  if (at.needle !== null) built.needle.setForm(at.needle);
  // The city rises out of the board plane: its height scaled about y = CHIP.board (never to zero, whose normal matrix
  // would be singular), its glow with it.
  const rise = Math.max(at.city, 1e-4);
  built.city.mesh.visible = at.city > 0;
  built.city.mesh.scale.y = rise;
  built.city.mesh.position.y = CHIP.board * (1 - rise);
  built.city.setGlow(LOOK.home.city * at.city);
  built.constellations.group.visible = at.stars > 0;
  for (const id of COUNTRY_IDS) built.constellations.setGlow(id, STARS_LOOK.rest * at.stars);
}
