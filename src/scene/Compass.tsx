import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import { applyPose } from '~/engine/applyPose';
import { type CompassPose, compassPoseAt, nominalSpans } from '~/engine/Choreography';
import { settlesWithin } from '~/engine/core/deadline';
import { buildInstrument, type InstrumentModel } from '~/engine/instrument/Instrument';
import { type Painted, PaintCancelled, paintedMaps, paintInstrument } from '~/engine/instrument/paint';
import { type InstrumentTextures, loadInstrumentTextures } from '~/engine/instrument/textures';
import { buildTracks, type TracksModel } from '~/engine/instrument/Tracks';
import { buildWire, type WireModel } from '~/engine/instrument/Wire';
import { warmScene } from '~/engine/TextureWarmup';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { motion } from './motion';
import { settleLoad } from './settleLoad';

/**
 * Milestone 1's subject: the top of revision 4's story, the luopan lying wide in the studio with its red threads.
 * A placeholder: milestone 2 replaces it with a compass rebuilt from named parts.
 */
export const HERO_POSE: CompassPose = compassPoseAt(0, nominalSpans());

/**
 * How long the load waits for the image files before it goes on with what has arrived (a map that lands later is
 * swapped in on its own): revision 4's 7 s, well inside the Stage's load timeout.
 */
const TEXTURE_WAIT_MS = 7_000;

/** Anisotropic filtering for the image maps and the painted canvases, seen at a slant. */
const ANISOTROPY = 8;

/** The longest step the needle takes in one frame, seconds: a scene waking from sleep does not fling it. */
const MAX_STEP = 0.1;

/**
 * The needle's idle drift, in place of revision 4's pearl. It rests at `bearing` (radians clockwise from north on
 * the dial, its glowing tip to the lower right as in the hero render) and wanders `amplitude` radians either side,
 * slowly, for `seconds` after the scene last stirred (it became ready, the story scrolled, the phase changed; the
 * pointer only moves the parallax). Then it settles and the scene sleeps. On reveal it swings in from `find` radians off, finding its
 * bearing. Reduced motion: no drift and no swing, the needle simply rests.
 */
export const DRIFT = { bearing: (142 * Math.PI) / 180, amplitude: 0.12, seconds: 10, find: -0.55 } as const;

/** Where the drift has wandered at `t` seconds of drift: two slow sines, so it never quite repeats. */
function drifted(t: number): number {
  return DRIFT.bearing + DRIFT.amplitude * (0.7 * Math.sin(t * 0.29) + 0.3 * Math.sin(t * 0.83 + 1.7));
}

interface Model {
  instrument: InstrumentModel;
  wire: WireModel;
  tracks: TracksModel;
  /** The image maps that have arrived: the Compass's to free (the model never frees what it is handed). */
  textures: InstrumentTextures;
  painted: Painted | null;
  /** The clearcoat-off stand-ins' release (warmScene), held while the lacquer still has its clearcoat. */
  release: (() => void) | null;
  /** The load stopped waiting for the image files: a map arriving now is swapped in on its own. */
  waited: boolean;
  ready: boolean;
}

/** Every map the model holds: the image textures and the painted canvases. */
function mapsOf(model: Model): THREE.Texture[] {
  return [...Object.values(model.textures), ...paintedMaps(model.painted)].filter((map): map is THREE.Texture => !!map);
}

/** Frees every map's GPU side and empties the painted canvases (some 35 MB on a fine pointer). */
function freeMaps(model: Model): void {
  for (const map of mapsOf(model)) map.dispose();
  for (const map of paintedMaps(model.painted)) {
    const canvas = map.image as HTMLCanvasElement;
    canvas.width = canvas.height = 0;
  }
  model.textures = {};
  model.painted = null;
}

/**
 * The renderer as the warm-up sees it. While the post chain is on, the composer's render pass draws the scene into
 * a half-float target, and three builds a different program for that (linear output, no tone mapping) than for the
 * screen. The warm-up compiles against such a target then, so the programs it readies are the ones the first frame
 * uses. Everything else is the renderer's own. `dispose` frees the target.
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

export interface CompassProps {
  /** Clearcoat on the lacquer and the pattern ring (the quality ladder's `clearcoat`). */
  clearcoat: boolean;
  /** A mouse or trackpad: the finer paint (2048² face instead of 1024²). */
  finePointer: boolean;
  /** The model is built, painted, its textures settled (or waited for 7 s) and its programs compiled. */
  onReady(): void;
  /** The model could not be built. */
  onFail(reason: string, error?: unknown): void;
}

/**
 * The ported luopan (engine/instrument) hosted in R3F, posed in revision 4's hero pose (HERO_POSE). Its load is
 * revision 4's, in its order: build the instrument, the wire and the tracks; load the image maps (7 s at most);
 * paint the face and the ring's strips; upload every map and compile every program (warmScene); then it shows and
 * says it is ready. Nothing is drawn of it before. Unmounting frees all of it, maps and canvases included.
 *
 * Each frame drawn steps the needle's spring toward its drift and poses the parts (applyPose); it writes its
 * stillness to `motion.compass`, so the Heartbeat stops drawing once the drift is over and the needle is still.
 */
export function Compass({ clearcoat, finePointer, onReady, onFail }: CompassProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const model = useRef<Model | null>(null);
  const spring = useRef(new AngleSpring());
  /** The drift's own clock (seconds of drift so far) and when it ends (performance.now() ms). */
  const drift = useRef({ time: 0, until: 0 });
  /** What the scene last saw of the things that stir it. */
  const seen = useRef({ target: 0, transition: -1 });
  /** The latest props, for the load, which outlives the render that started it. */
  const latest = useRef({ clearcoat, onReady, onFail });
  useLayoutEffect(() => {
    latest.current = { clearcoat, onReady, onFail };
  });

  useEffect(() => {
    let disposed = false;
    let built: Model;
    try {
      const instrument = buildInstrument();
      const wire = buildWire();
      const tracks = buildTracks();
      // In the scene from the start, hidden until the load is done, so the warm-up compiles their programs with the rest.
      instrument.dial.add(wire.mesh);
      instrument.topPlatter().add(tracks.group);
      instrument.root.visible = false;
      instrument.setClearcoat(latest.current.clearcoat);
      applyPose(instrument, wire, tracks, HERO_POSE, DRIFT.bearing, null);
      scene.add(instrument.root);
      built = { instrument, wire, tracks, textures: {}, painted: null, release: null, waited: false, ready: false };
    } catch (error) {
      latest.current.onFail('the compass could not be built', error);
      return;
    }
    model.current = built;
    const anisotropy = Math.min(ANISOTROPY, gl.capabilities.getMaxAnisotropy());

    // An image map has loaded: the Compass's to free from now on, or freed at once if it is already gone. Within the
    // load's wait the load applies it with the others; after it, it is swapped in here (the material already has a
    // map, so nothing recompiles).
    const arrived = (key: keyof InstrumentTextures, texture: THREE.Texture): void => {
      if (disposed) {
        texture.dispose();
        return;
      }
      built.textures[key] = texture;
      if (!built.waited) return;
      texture.anisotropy = anisotropy;
      built.instrument.setTextures({ [key]: texture });
      invalidate();
    };

    // Two soft failures are the load's own: a face that cannot be painted stays plain, and a warm-up that fails only
    // costs the first frame a stall. Anything else that throws fails the scene (settleLoad): no partial compass.
    const load = async (): Promise<void> => {
      const inTime = await settlesWithin(loadInstrumentTextures(undefined, undefined, arrived), TEXTURE_WAIT_MS);
      if (disposed) return freeMaps(built);
      if (!inTime) console.warn(`[needle] the compass textures took over ${TEXTURE_WAIT_MS / 1000} s; going on without those still loading`);
      built.waited = true;
      built.instrument.setTextures(built.textures);
      try {
        const lacquer = built.textures.lacquer?.image as CanvasImageSource | undefined;
        built.painted = await paintInstrument(finePointer, lacquer, { cancelled: () => disposed });
      } catch (error) {
        // The face and the ring keep their plain placeholders.
        if (!(error instanceof PaintCancelled)) console.warn('[needle] the compass face and ring could not be painted; they stay plain', error);
      }
      if (disposed) return freeMaps(built);
      for (const map of mapsOf(built)) map.anisotropy = anisotropy;
      if (built.painted) {
        built.instrument.setFace(built.painted.face, built.painted.mr);
        built.instrument.setStrips(built.painted.strips);
      }
      const coated = latest.current.clearcoat;
      const warming = warmingRenderer(gl, useScene.getState().tier !== 'low');
      try {
        const release = await warmScene(warming.renderer, scene, camera, mapsOf(built), coated, () => disposed);
        if (disposed || !coated || !latest.current.clearcoat) release();
        else built.release = release;
      } catch (error) {
        console.warn('[needle] the compass could not be warmed up; the first frame may stall', error);
      } finally {
        warming.dispose();
      }
    };

    void settleLoad(load, {
      disposed: () => disposed,
      ready: () => {
        built.ready = true;
        built.instrument.root.visible = true;
        const reduced = useScene.getState().reducedMotion;
        // It finds its bearing as the canvas fades in, and drifts for a while after.
        spring.current.set(reduced ? DRIFT.bearing : DRIFT.bearing + DRIFT.find, 0);
        drift.current.until = performance.now() + DRIFT.seconds * 1000;
        invalidate();
        latest.current.onReady();
      },
      fail: (error) => latest.current.onFail('the compass load failed', error),
    });

    return () => {
      disposed = true;
      model.current = null;
      // The wire and the tracks first, out of the model, so each frees its own once.
      built.wire.mesh.removeFromParent();
      built.wire.dispose();
      built.tracks.dispose();
      built.instrument.dispose();
      freeMaps(built);
      built.release?.();
      built.release = null;
    };
  }, [gl, scene, camera, finePointer, invalidate]);

  // The quality ladder turns the clearcoat off (never back on): the stand-ins held its programs, and let go of them
  // once the lacquer has drawn with them.
  useEffect(() => {
    const built = model.current;
    if (!built) return;
    built.instrument.setClearcoat(clearcoat);
    if (!clearcoat && built.release) {
      const release = built.release;
      built.release = null;
      const unsubscribe = addAfterEffect(() => {
        unsubscribe();
        release();
      });
    }
    invalidate();
  }, [clearcoat, invalidate]);

  useFrame((_, delta) => {
    const built = model.current;
    if (!built?.ready) return;
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);
    const now = performance.now();
    const { reducedMotion, transitionId } = useScene.getState();

    // The story moving or the phase changing starts the drift's while again. The pointer does not: it wakes only the
    // parallax (Rig), about a second, so a mouse idling over a page of text does not keep the scene drawing.
    const last = seen.current;
    if (last.target !== frame.target || last.transition !== transitionId) {
      if (last.transition !== -1) drift.current.until = now + DRIFT.seconds * 1000;
      Object.assign(last, { target: frame.target, transition: transitionId });
    }

    const drifting = !reducedMotion && now < drift.current.until;
    if (drifting) drift.current.time += dt;
    const heading = reducedMotion ? DRIFT.bearing : drifted(drift.current.time);
    if (reducedMotion) spring.current.set(heading, 0);
    const needle = spring.current.step(heading, dt);
    applyPose(built.instrument, built.wire, built.tracks, HERO_POSE, wrapAngle(needle), null);

    const still = motion.compass;
    still.idle = !drifting;
    still.needle = wrapAngle(heading - spring.current.value);
    still.needleSpeed = spring.current.velocity;
  });

  return null;
}
