import { useFrame, useThree } from '@react-three/fiber';
import { type JSX, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bandStrip, COMPASS_PARTS, type CompassModel, loadCompass } from '~/engine/bob/build/compass';
import { buildEngraving, type EngravingModel } from '~/engine/bob/build/engraving';
import { buildGlass, type GlassModel } from '~/engine/bob/build/glassFloor';
import { buildLight, type LightModel } from '~/engine/bob/build/light';
import { buildProbe, type ProbeModel } from '~/engine/bob/build/probe';
import { buildSmoke, type SmokeModel } from '~/engine/bob/build/smoke';
import { buildTraces, tracesUnder, type TracesModel } from '~/engine/bob/build/traces';
import { advanceClock, LOADER, type LoaderClock, type LoaderPath, loaderAt, loaderGaveUp, loaderSeen, markLoaderSeen } from '~/engine/bob/loaderTimeline';
import { settleAngle } from '~/engine/bob/needle';
import { traceLayout } from '~/engine/bob/traces';
import { STROKE_ORDER } from '~/engine/bob/wordmark';
import { SafeStorage } from '~/engine/core/SafeStorage';
import { readout } from '~/engine/loading';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { useLoaderSkip } from '~/input/loaderSkip';
import { frame } from '~/state/frame';
import { placeForProject } from '~/state/routeSync';
import { useScene } from '~/state/store';
import { openAt } from '~/ui/BeadLabel';
import { motion } from '../motion';
import { settleLoad } from '../settleLoad';
import { visibleTimeout } from '../timeouts';
import { FOCUS_AT_REST, type FocusPose, stepFocus } from './focus';
import { type Handover, Home, type HomeModels } from './Home';
import { focusShotFor, journeyPoseAt, shotToward } from './journey';
import { cameraShotAt, loadShare, type OpeningPose, openingPoseAt } from './openingPose';
import { SHOT_PRIORITY, shotSourceFor, shownProgressFor } from './shotSource';
import {
  HOME_CLOCK,
  heldLoaderInput,
  listensForSkip,
  marksSeen,
  openingReadiness,
  openingStartFor,
  SKIPPED_HOME_BUDGET_MS,
  skipAtFor,
  skipsLoader,
} from './openingStart';
import { beadLightStandIns, Void } from './Void';
import { writeJourney } from './voidPose';
import { uploadTextures, warm } from './warm';

/** Why the opening fails when its home has not loaded in time: the loader's give-up, and a skipped home's budget. */
const GAVE_UP = `the compass did not load within ${LOADER.giveUp} s of the page being visible`;

/**
 * How long the sparks keep flying after the cut last moved, in the loader's seconds: a probe that waits on a slow load
 * creeps along the circle, and once a held still or a stopped cut keeps it on one spot its sparks die down rather than
 * spray there.
 */
const SPARKS_FADE = 0.4;

/** Where the compass's file is served from: public/models/bob-compass.glb, under the site's base. */
const COMPASS_URL = `${import.meta.env.BASE_URL}models/bob-compass.glb`;

/** How many bands the compass has, each with its own painted strip: band_1 to band_4 in the GLB. */
const BANDS = COMPASS_PARTS.filter((name) => name.startsWith('band_')).length;

/**
 * The compass's glTF (src/engine/bob/build/compass.ts reads it), fetched and parsed at most once a page view: a Stage
 * mounted again (3D off and on, a scene that failed and is tried again) builds its compass from the same file without
 * fetching it again. A load that fails is forgotten, so the next mount tries again.
 *
 * **Who frees the file's geometries.** `loadCompass` copies the file's scene and shares its eleven geometries, and the
 * compass's own `dispose` leaves them alone (they are the loader's). The Opening that built the compass frees them on
 * unmount (`freeFileGeometries`), as it is the only one drawing them: only one Stage, so one Opening, is ever up.
 * `dispose` frees a geometry's buffers on the GPU and keeps its arrays, so the cached file stays whole, and a later
 * Opening's first frame uploads the same geometries again.
 */
let compassFile: Promise<GLTF> | null = null;

function loadCompassFile(): Promise<GLTF> {
  compassFile ??= new GLTFLoader().loadAsync(COMPASS_URL).catch((error: unknown) => {
    compassFile = null;
    throw error;
  });
  return compassFile;
}

/** Frees the GPU side of the file's geometries (see `compassFile`). */
function freeFileGeometries(file: GLTF): void {
  file.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
}

/** The loader's own objects: built, compiled and shown before the loader says it can show. */
interface LoaderParts {
  glass: GlassModel;
  engraving: EngravingModel;
  traces: TracesModel;
  probe: ProbeModel;
  smoke: SmokeModel;
  /**
   * The beads' light stand-ins (src/scene/bob/Void.tsx `beadLightStandIns`): in the scene from the first frame, at
   * intensity 0, so every program the loader and the home compile counts the beads' lights; the Void swaps the beads'
   * own lights in for them. The Opening's to free.
   */
  standIns: THREE.PointLight[];
  /**
   * The light the needle becomes in the light dive (~/engine/bob/build/light): built here, dark, so it is compiled with
   * the loader and its lamp is in the scene's light count from the first frame; the Void poses it. The Opening's to free.
   */
  light: LightModel;
}

/** What the Opening mounts Home and the Void with, once the compass exists. */
interface Mounted {
  home: HomeModels;
  standIns: readonly THREE.PointLight[];
  light: LightModel;
}

/** The home's part, the compass, built while the loader engraves: the Opening's to free with its strips and its file's geometries. */
interface HomeParts {
  /** The four bands' painted strips, the Opening's until the compass takes them, and their canvases the Opening's to empty. */
  strips: THREE.CanvasTexture[];
  /** The compass's file, once it has arrived, whose geometries the Opening frees. */
  file: GLTF | null;
  compass: CompassModel | null;
}

/** Lets a frame go by between two pieces of the load, so the loader keeps drawing while the strips paint. */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** No close view: the frame of the loader, of a held seek, or of a home with no bead close. */
const NO_FOCUS: Readonly<FocusPose> = Object.freeze({ id: null, amount: 0, dark: false, moving: false, engaged: false });

/** The attribute on <html> that fades the scene host down for a fade to or from a bead's close view (src/styles/base.css). */
const FOCUS_FADE_ATTRIBUTE = 'data-focus-fade';

/** `<html data-focus-fade>` as last written, so a frame writes the DOM only when it changes. */
let focusFaded = false;

/** Sets or takes away `<html data-focus-fade>`, writing the DOM only when it changes. */
function showFocusFade(on: boolean): void {
  if (focusFaded === on) return;
  focusFaded = on;
  document.documentElement.toggleAttribute(FOCUS_FADE_ATTRIBUTE, on);
}

/** The close view on this frame: `stepFocus` (src/scene/bob/focus.ts) of `frame.focus`, from the store and the story. */
function focusNow(now: number): FocusPose {
  const { phase, scene, reducedMotion, inside } = useScene.getState();
  return stepFocus(frame.focus, { phase, scene, reducedMotion, inside, progress: frame.progress, target: frame.target }, now);
}

/** Frees strips' GPU side and empties their canvases (4096 x 96 each). Freeing one twice is harmless. */
function freeStrips(strips: THREE.CanvasTexture[]): void {
  for (const strip of strips) {
    strip.dispose();
    const canvas = strip.image as HTMLCanvasElement;
    canvas.width = canvas.height = 0;
  }
}

/**
 * Paints the four bands' strips (`bandStrip`: the ticks and the trigrams, src/engine/bob/paintBand.ts), one a frame,
 * into `into`, which the caller frees whatever happens. A canvas that gives no 2D context throws: the compass is not
 * shown blank. Answers false if the opening went away meanwhile.
 */
async function paintStrips(into: THREE.CanvasTexture[], cancelled: () => boolean): Promise<boolean> {
  for (let band = 0; band < BANDS; band++) {
    if (cancelled()) return false;
    into.push(bandStrip(band));
    await breathe();
  }
  return !cancelled();
}

/** The opening's running state: its clock, its load and what it has done. Plain values, written per frame. */
interface Run {
  /** The Stage's onReady has been called: the loader is built and compiled, and the clock runs. */
  ready: boolean;
  /** The opening has given up or its load failed: it says nothing more. */
  failed: boolean;
  /** Visible seconds since the loader began (advanceClock). */
  elapsed: number;
  /** The smoothed load share (readout), and the parts loaded. */
  shown: number;
  done: { paint: boolean; warm: boolean };
  /** The `elapsed` at which `shown` reached 1, or null while loading. */
  loadedAt: number | null;
  /** The `elapsed` at which the visitor asked to skip (the first ask), or null. */
  skipAt: number | null;
  /** Which path plays: read once at mount. */
  path: LoaderPath;
  /**
   * The loader is skipped: the clock stands at home (HOME_CLOCK). Set at mount when the home page has already
   * left LOADING (`openingStartFor`), so the canvas shows only once the home is loaded, straight onto it; or mid-opening,
   * once the load is done, when the visitor comes back to the home page (`skipsLoader`), whose hero now shows.
   */
  skip: boolean;
  /** The skip input is listening (`useLoaderSkip`): from the full show's first frame until it lands, never on the other paths. */
  listening: boolean;
  /** The visitor's skip has landed: `frame.loaderSkipEndsMs` is written, once. */
  skipLanded: boolean;
  /** How much of the engraving was cut, and when it last moved (loader seconds): the sparks fly while it moves. */
  cut: number;
  cutAt: number;
  /** The landing has happened: LOADED is sent and the loader marked seen, once. A skipped opening has none to announce. */
  landed: boolean;
  /** The home's pose has been applied since the clock last reached `home`: the home's parts are Home's from there. */
  posedHome: boolean;
  /** Fails the opening, once, unless it is gone: the load's throw and the give-up both end here. */
  fail(reason: string, error?: unknown): void;
}

export interface OpeningProps {
  /**
   * The quality tier the ladder is on (`tierFor` of the Stage's rung, which the QualityGovernor also writes into the
   * store): the parts are built for it at mount and step down with it after. Handed in by the Stage, so
   * the first build has it before the governor's effect has written it into the store.
   */
  tier: QualityTier;
  /** The rung's glass-floor reflection (`Quality.reflector`): once false, the reflector goes for good. */
  reflector: boolean;
  /**
   * Its loader's objects are built and their programs compiled, but the canvas is not to show yet: said once, by an
   * opening that skips its loader, at the point a normal one says `onReady` (`openingReadiness`).
   */
  onStarted(): void;
  /** The canvas can show: the loader's first frame, or a skipped opening's warm home. Called once. */
  onReady(): void;
  /** The opening failed: its objects could not be built, its load threw, or the load did not finish in time. */
  onFail(reason: string, error?: unknown): void;
}

/**
 * The BOB opening (spec §2.1), in the persistent canvas: a laser engraves a circle into dark glass, the glass
 * inside the circle opens like an iris, and an armillary compass rises out of it as the O; then the Home.
 *
 * **Build.** On mount it builds the loader's parts at once for the ladder's tier (`tier`, from the Stage): the glass
 * (`buildGlass`, sized to the drawing buffer through `setRenderer`, again on every resize), the engraving, the traces
 * (`traceLayout()`), the probe and the smoke, and the beads' light stand-ins (`beadLightStandIns`, src/scene/bob/Void.tsx:
 * point lights at intensity 0 that hold the beads' place in the light count, so no program compiled from here on is
 * compiled again when the beads come in). It adds them, compiles their programs and calls `onReady`: the canvas
 * fades in over the poster and the loader begins. When the ladder steps down later, the parts step down in place
 * (`setReflector` and, with it, the traces' `setUnder` (they lie under the glass only while it is transparent), `setTier` on the compass and the smoke), never up.
 *
 * **Load.** Meanwhile it fetches the compass's GLB (`loadCompassFile`: three's GLTFLoader, once a page view) and paints
 * the four bands' strips (`bandStrip`), one a frame: `paint`, 0.6 of the load. Once the file is in, it builds the
 * compass (`loadCompass`), hidden as the clock has it, mounts Home and the Void, uploads the strips and compiles the
 * home's programs:
 * `warm`, the other 0.4. A throw anywhere in it (no 2D canvas, a file that does not load or lacks a part) fails the
 * scene; only a failed warm-up is let through, at the cost of a stall. The compass stays hidden until the iris starts
 * to open (no transmission pass runs under the shut cap), and below the high tier the transmission pass runs at half
 * resolution (`transmissionResolutionScale`).
 *
 * **Clock.** Each frame drawn: `elapsed = advanceClock(elapsed, delta)`, `shown = readout(shown, loadShare(done))`,
 * `loadedAt` once it reaches 1, then `loaderAt({ elapsed, loadedAt, skipAt, path })`, and everything is posed from the
 * result (openingPose.ts: `cameraShotAt` into `frame.shot`, which the Rig follows, and `openingPoseAt` for the objects;
 * the needle at `settleAngle(needleSettle)`; the bands' turn, the smoke's drift and the sparks at the loader's seconds).
 * The pose is a function of the clock alone, so a held clock poses the scene as the live one did.
 *
 * **The camera's one writer.** This frame callback writes `frame.shot` and nothing else does, and it runs at
 * `SHOT_PRIORITY`, below the Rig's default 0, so R3F runs it strictly before the Rig in the same frame: the camera is
 * placed on the shot of the frame it is drawn in. `shotSourceFor(stage, held, live)` says where the shot comes from:
 * the loader's own shots (`cameraShotAt`) while the loader plays and at a held seek; at home, once the clock is there,
 * the journey's (`journeyPoseAt(progress, aspect).shot`, src/scene/bob/journey.ts) on every frame drawn, at the progress
 * `shownProgressFor` gives. That pose is computed once a frame, here, and published: `handover.pose` for Home (the
 * rise) and the Void (the void, the beads, the needle out of the compass), which pose the scene from it and write no
 * shot, and `frame.journey` (`writeJourney`: its stretch, local and project) for the debug bridge. While the loader's
 * shots stand, `handover.pose` is null.
 *
 * The loader's path (full, quick or reduced) is `pathFor(loaderSeen(localStorage), reducedMotion)`, read once at mount
 * (reduced beats quick, quick beats full).
 * `motion.loader` keeps the Heartbeat drawing until `home`; `frame.loader` says where the opening stands.
 *
 * **Skip.** While the full show plays, any click, tap, wheel turn or key fast-forwards the rest of it to the home
 * (`useLoaderSkip`; `skipAtFor` keeps the first ask; the quick and reduced paths are short already and do not
 * listen). It listens only while the page shows a scene (`listensForSkip`): a page of text reached mid-show
 * draws no frame, so the show cannot land there, and its own scroll is left alone. The skip's own listener prevents the
 * input that would scroll the page until the home; on the frame a skipped loader reaches it, `frame.loaderSkipEndsMs`
 * is set to now, so the home's scroll input swallows the rest of the gesture for SKIP_SWALLOW_MS more. It is null from
 * each mount until then.
 *
 * **Landing.** At `home` it marks the loader seen in this browser (`markLoaderSeen(SafeStorage.local())`; on the full
 * and quick paths, not the reduced fade: `marksSeen`) and dispatches `LOADED` (the only place it is sent while a Stage
 * is up), once. From then on the Opening poses the home once each time the clock reaches `home`, asks for one more
 * frame, and hands it over (`handover`) to Home (Home.tsx), which drives the needle, the bands' turn,
 * the smoke, the needle's breath and the scroll's rise from there, starting where the Opening left them, and to the
 * Void (Void.tsx), which loads the void and the beads from then on and poses them, and the needle in the void. The camera
 * stays the Opening's (above): at the home it is the home shot at the rise's 0, up the rise to BOB from above, and on
 * into the dive (a resize reframes it in place, in the same frame). On a project page it lands, then fades to that
 * bead's close view under the page's scrim (src/scene/bob/focus.ts; the host stays dark until the void is in).
 *
 * **A bead seen close.** The shot is the journey's at the bead's stop moved toward `focusShotFor` (source
 * `flight`) while the close view is in it: a project page stands over it, and the label's flight in (`openBead`,
 * src/ui/BeadLabel.tsx, which the Void's click on the selected bead calls too, `onOpen`) and Back's flight out ease
 * between the two over `FLIGHT_MS`, on the document's clock (`frame.focus`), so a route change in the middle neither
 * restarts nor jumps it. A fade (`<html data-focus-fade>`, the step fade's 150 ms) stands in where no flight can be.
 *
 * **Skipped mount.** Mounted while the home page has already left LOADING (`openingStartFor`: 3D back on
 * after a failure or a toggle, a visit that began on Lite), it plays no loader under the hero that now shows: it builds
 * everything as before and says `onStarted` where a normal opening says `onReady` (`openingReadiness`, so SceneHost's
 * load timeout covers the same work either way), but says `onReady` only once the home is loaded too, and its clock
 * stands at home from the start (HOME_CLOCK), so the canvas fades in straight onto the home. Meanwhile, as no clock runs
 * to give up, its own budget does: SKIPPED_HOME_BUDGET_MS of the page being visible, then it fails as the give-up does.
 * It sends no LOADED and marks nothing seen. Back on the home page mid-opening (`skipsLoader`), it skips the rest once
 * the load is done.
 *
 * **Seek** (`?proof` only). While the debug bridge holds the loader's clock (`frame.loaderHold`), the live clock stops
 * and every frame poses the whole scene, camera included, from the held moment (`heldLoaderInput`: a load that had
 * landed from the start, on the visit's path). Home lets go of its parts meanwhile; the phase stays as it is. Let go,
 * the live clock (long at home) poses the home once more and hands it back.
 *
 * **Give-up.** If the load has not finished after LOADER.giveUp visible seconds it calls `onFail`, and SceneHost shows
 * its fallback card ("the needle lost north", with Lite one link away).
 *
 * Unmounting frees every object, material, texture, light and canvas it made, and the GPU side of the compass file's
 * geometries.
 */
export function Opening({ tier, reflector, onStarted, onReady, onFail }: OpeningProps): JSX.Element | null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const loader = useRef<LoaderParts | null>(null);
  /** The tier the parts now stand at: built at the mount's, stepped down since (`lowerTier`), never up. */
  const standing = useRef<QualityTier>(tier);
  const home = useRef<HomeParts | null>(null);
  const run = useRef<Run | null>(null);
  /** The drawing buffer's size the glass's reflection was last sized for. */
  const buffer = useRef({ seen: new THREE.Vector2(-1, -1), now: new THREE.Vector2() });
  /** The home's parts once built, which mount Home; and what the Opening hands over to it, set on each frame drawn. */
  const [models, setModels] = useState<Mounted | null>(null);
  const [handover] = useState<Handover>(() => ({ live: false, time: 0, needle: settleAngle(1), shown: 0, pose: null, focus: false, close: { id: null, amount: 0 } }));
  /** The full show is playing, so any input skips it (`useLoaderSkip`) while a scene is shown. */
  const [skippable, setSkippable] = useState(false);
  /** The page shows a scene: on a page of text (Lite, contact) the canvas draws nothing, and the skip must not listen. */
  const sceneShown = useScene((s) => s.scene !== null);
  /** The latest props, for the load, which outlives the render that started it. */
  const latest = useRef({ tier, onStarted, onReady, onFail });
  useLayoutEffect(() => {
    latest.current = { tier, onStarted, onReady, onFail };
  });

  // Only while a scene is shown, so a page of text reached mid-show scrolls (`listensForSkip`).
  useLoaderSkip(listensForSkip(skippable, sceneShown), () => {
    const state = run.current;
    if (!state?.ready || state.failed || state.skip) return;
    state.skipAt = skipAtFor(state.elapsed, state.skipAt);
    invalidate();
  });

  // Below the high tier the band glass's transmission pass draws at half resolution; the low tier's bands
  // have none to draw. The quality ladder can step down while the scene is up, so this follows the Stage's `tier` prop.
  useEffect(() => {
    gl.transmissionResolutionScale = tier === 'high' ? 1 : 0.5;
    invalidate();
    return () => {
      gl.transmissionResolutionScale = 1;
    };
  }, [gl, tier, invalidate]);

  // The ladder steps down while the scene is up: the parts built for a better tier give up what the new one
  // lacks, in place, without the Opening mounting again (which would play the loader again). The smoke sheds its low
  // tier's layers and the band glass drops to the tier's (no transmission on low); the reflector goes with its rung.
  // Never back up: the ladder does not climb within a page view, and `lowerTier` holds the parts where they are if it did.
  useEffect(() => {
    const parts = loader.current;
    if (!parts) return;
    const to = lowerTier(standing.current, tier);
    if (to !== standing.current) {
      standing.current = to;
      parts.smoke.setTier(to);
      parts.light.setTier(to);
      home.current?.compass?.setTier(to);
    }
    if (!reflector) parts.glass.setReflector(false);
    // The traces lie under the glass only while the floor is transparent: with the reflector gone it is opaque, and
    // they come up onto it (render state only, no program changes).
    parts.traces.setUnder(tracesUnder(standing.current, reflector));
    invalidate();
  }, [tier, reflector, invalidate]);

  useEffect(() => {
    let disposed = false;
    // The tier the parts are built for: the ladder's at this mount (a mount after a step down starts there).
    const built: QualityTier = latest.current.tier;
    standing.current = built;
    let parts: LoaderParts;
    // What has been built so far, freed again if a later part throws.
    const made: { dispose(): void }[] = [];
    try {
      const glass = buildGlass(built);
      made.push(glass);
      const engraving = buildEngraving();
      made.push(engraving);
      // Under the glass where the floor is transparent: the high tier, built with its reflector (the glass above).
      const traces = buildTraces(traceLayout(), tracesUnder(built, true));
      made.push(traces);
      const probe = buildProbe();
      made.push(probe);
      const smoke = buildSmoke(built);
      made.push(smoke);
      const light = buildLight(built);
      made.push(light);
      const standIns = beadLightStandIns(built);
      scene.add(glass.group, traces.group, engraving.group, probe.group, smoke.group, light.group, ...standIns);
      parts = { glass, engraving, traces, probe, smoke, standIns, light };
    } catch (error) {
      for (const part of made) part.dispose();
      latest.current.onFail('the loader could not be built', error);
      return;
    }
    loader.current = parts;
    parts.glass.setRenderer(gl);
    gl.getDrawingBufferSize(buffer.current.seen);
    const homeParts: HomeParts = { strips: [], file: null, compass: null };
    home.current = homeParts;

    const { reducedMotion, phase } = useScene.getState();
    const start = openingStartFor(phase.kind, loaderSeen(SafeStorage.local()), reducedMotion);
    frame.loaderSkipEndsMs = null;
    const state: Run = {
      ready: false,
      failed: false,
      elapsed: 0,
      shown: 0,
      done: { paint: false, warm: false },
      loadedAt: null,
      skipAt: null,
      path: start.path,
      skip: start.skip,
      listening: false,
      skipLanded: false,
      cut: 0,
      cutAt: Number.NEGATIVE_INFINITY,
      landed: start.skip,
      posedHome: false,
      fail: (reason, error) => {
        if (disposed || state.failed) return;
        state.failed = true;
        motion.loader = false;
        handover.live = false;
        if (state.listening) {
          state.listening = false;
          setSkippable(false);
        }
        latest.current.onFail(reason, error);
      },
    };
    run.current = state;
    // The first moment of the opening, posed before anything is drawn: the dark glass, or the home for a skipped one.
    const first = clockOf(state);
    pose(parts, null, openingPoseAt(first, state.path), 0, state);
    frame.loader.stage = first.stage;
    frame.loader.elapsed = 0;
    frame.loader.strokes = first.strokes;

    /** The canvas can show and the clock runs: the loader's first frame, or a skipped opening's home. */
    const show = (): void => {
      state.ready = true;
      motion.loader = !state.skip;
      // Only the full show listens for a skip: the quick and reduced paths are short already.
      if (state.path === 'full' && !state.skip) {
        state.listening = true;
        setSkippable(true);
      }
      invalidate();
      latest.current.onReady();
    };

    // What SceneHost has been told (`openingReadiness`), and the skipped home's budget while it runs.
    let started = false;
    let budget: (() => void) | null = null;
    const reached = (warmed: { loader: boolean; home: boolean }): void => {
      const at = openingReadiness(state.skip, warmed);
      if (at.shown) {
        if (!state.ready) show();
      } else if (at.started && !started) {
        started = true;
        latest.current.onStarted();
      }
      if (at.budget && budget === null) budget = visibleTimeout(SKIPPED_HOME_BUDGET_MS, () => state.fail(GAVE_UP));
      if (!at.budget && budget !== null) {
        budget();
        budget = null;
      }
    };

    const load = async (): Promise<void> => {
      // The file is asked for now, while the loader warms up and the strips paint; awaited once they are done. Its
      // failure is the load's (below), and is seen as handled meanwhile, so an early end is no unhandled rejection.
      const file = loadCompassFile();
      file.catch(() => {});

      // The loader's own programs first, so its first frame does not stall; then it can show (a skipped opening has
      // only started: it waits for the home below, so it shows straight onto it).
      await warm(gl, scene, camera, 'the loader');
      if (disposed) return;
      reached({ loader: true, home: false });

      if (!(await paintStrips(homeParts.strips, () => disposed))) return;
      state.done.paint = true;
      invalidate();

      const gltf = await file;
      if (disposed) return;
      homeParts.file = gltf;
      // Built for the tier the parts stand at now: the ladder may have stepped down while the file was on its way.
      const compass = loadCompass(gltf, standing.current, (band) => homeParts.strips[band]);
      homeParts.compass = compass;
      scene.add(compass.group);
      // Posed as the clock now has it (hidden while the cap is shut), before a frame can show it.
      state.posedHome = false;
      const now = clockOf(state);
      pose(parts, compass, openingPoseAt(now, state.path), state.elapsed, state);
      // Home and the Void mount now; they drive nothing until the Opening hands the home over.
      setModels({ home: { compass, engraving: parts.engraving, smoke: parts.smoke, glass: parts.glass, traces: parts.traces }, standIns: parts.standIns, light: parts.light });

      // The strips go up to the GPU now, not on the frame that first shows the bands, and the home's programs compile.
      uploadTextures(gl, homeParts.strips);
      await warm(gl, scene, camera, 'the compass');
      if (disposed) return;
      state.done.warm = true;
      reached({ loader: true, home: true });
      invalidate();
    };

    void settleLoad(load, {
      disposed: () => disposed,
      ready: () => {},
      fail: (error) => state.fail('the compass load failed', error),
    });

    return () => {
      disposed = true;
      budget?.();
      loader.current = null;
      run.current = null;
      handover.live = false;
      handover.pose = null;
      handover.focus = false;
      handover.close.id = null;
      handover.close.amount = 0;
      setModels(null);
      setSkippable(false);
      motion.loader = false;
      motion.focus = false;
      showFocusFade(false);
      // The next Opening (3D back on) starts from no move: a stale one would be taken up by its first focus step.
      frame.focus.move = FOCUS_AT_REST;
      frame.shot = null;
      frame.loader.stage = null;
      frame.needleAngle = 0;
      scene.remove(parts.glass.group, parts.traces.group, parts.engraving.group, parts.probe.group, parts.smoke.group, parts.light.group);
      parts.light.dispose();
      parts.glass.dispose();
      parts.engraving.dispose();
      parts.traces.dispose();
      parts.probe.dispose();
      parts.smoke.dispose();
      scene.remove(...parts.standIns);
      for (const light of parts.standIns) light.dispose();
      home.current = null;
      if (homeParts.compass) {
        scene.remove(homeParts.compass.group);
        homeParts.compass.dispose();
      }
      freeStrips(homeParts.strips);
      if (homeParts.file) freeFileGeometries(homeParts.file);
    };
  }, [gl, scene, camera, invalidate, handover]);

  useFrame((three, delta) => {
    const parts = loader.current;
    // The reflection follows the drawing buffer: a resize, or the quality ladder lowering the pixel ratio.
    if (parts) {
      const { seen, now } = buffer.current;
      gl.getDrawingBufferSize(now);
      if (!now.equals(seen)) {
        seen.copy(now);
        parts.glass.setRenderer(gl);
      }
    }
    const state = run.current;
    if (!state?.ready || state.failed || !parts) return;

    // A seek holds the clock: the live one stops where it is until it is let go.
    const held = frame.loaderHold;
    if (held === null && !state.skip) {
      state.elapsed = advanceClock(state.elapsed, delta);
      state.shown = readout(state.shown, loadShare(state.done), delta);
      if (state.loadedAt === null && state.shown >= 1) state.loadedAt = state.elapsed;
      if (loaderGaveUp(state.elapsed, state.loadedAt)) {
        state.fail(GAVE_UP);
        return;
      }
      // Back on the home page mid-opening, whose hero now shows: the rest of the loader is skipped once the load is done.
      if (state.loadedAt !== null && skipsLoader(useScene.getState().phase.kind)) state.skip = true;
    }

    const clock = held === null ? clockOf(state) : loaderAt(heldLoaderInput(held, state.path));
    const time = held ?? state.elapsed;
    const aspect = three.size.width / three.size.height;
    const atHome = clock.stage === 'home';
    frame.loader.stage = clock.stage;
    frame.loader.elapsed = time;
    frame.loader.strokes = clock.strokes;
    motion.loader = !atHome;

    // The camera's shot: this callback is its one writer, and it runs before the Rig's in the same frame (SHOT_PRIORITY),
    // so the camera is placed on the very shot written here. The loader and a held seek keep the loader's own shots; at
    // home the shot is the journey's at the progress Home poses the scene at (src/scene/bob/shotSource.ts), every frame
    // drawn, so a scroll, a resize or a step of reduced motion all find the camera where the compass is. (`handover.live`
    // is still last frame's here: the Opening sets it below.) A bead's close view (src/scene/bob/focus.ts) is in the
    // shot only once the clock is at the home: a direct arrival at a project page plays its loader, then comes to the
    // close view by a fade once it has landed.
    const focus = atHome && held === null ? focusNow(performance.now()) : NO_FOCUS;
    const source = shotSourceFor(clock.stage, held, handover.live, focus.amount > 0);
    if (source === 'loader' || source === 'held') {
      frame.shot = cameraShotAt(clock, state.path, aspect);
      handover.pose = null;
    } else {
      // The one journey pose of this frame: the camera's shot, and what Home and the Void pose the scene from. A close
      // view poses the journey where its bead was opened from, else at its stop (the bead in view and lit), and moves the
      // shot toward the close view by the move's eased amount: the flight, or the page standing over it.
      const close = source === 'flight' ? focus.id : null;
      const reduced = useScene.getState().reducedMotion;
      const at = close === null ? shownProgressFor(source === 'home' ? 'home' : 'journey', reduced, frame.progress, frame.target, handover.shown) : placeForProject(close);
      const journey = journeyPoseAt(at, aspect);
      const pose = close === null ? journey : { ...journey, shot: shotToward(journey.shot, focusShotFor(close, aspect), focus.amount) };
      frame.shot = pose.shot;
      handover.pose = pose;
      writeJourney(frame.journey, pose);
    }
    // The close view's state for Home and the Void (no label, no pointer while it is in play), the host faded down for a
    // fade's dark half and over a close view whose void is not in yet (the page stands over the dark poster until the
    // bead is there to see), and the canvas kept drawing while a move goes on.
    handover.focus = focus.engaged;
    handover.close.id = focus.id;
    handover.close.amount = focus.amount;
    showFocusFade(focus.dark || (focus.amount > 0 && useScene.getState().voidState !== 'ready'));
    motion.focus = focus.moving;
    // A held clock poses every frame; the live one poses the home once, when it gets there.
    if (held !== null || !atHome) state.posedHome = false;
    const compass = home.current?.compass ?? null;
    if (!state.posedHome) {
      const needle = pose(parts, compass, openingPoseAt(clock, state.path), time, state);
      // The home's pose is applied once, and only once the compass exists; then the home is Home's, from here.
      if (atHome && held === null && compass) {
        state.posedHome = true;
        handover.time = time;
        handover.needle = needle;
        // One more frame, for Home's first: nothing else may ask for it (a skipped mount sends no LOADED, so no phase
        // change wakes the Heartbeat), and the Heartbeat has run this frame before Home could start its idle motion.
        invalidate();
      }
    }
    // Home's frame runs after this one (its priority is 0, this one's SHOT_PRIORITY), and reads this.
    handover.live = state.posedHome;

    if (atHome && held === null) {
      if (state.listening) {
        state.listening = false;
        setSkippable(false);
      }
      // A skip has landed: the home's scroll input swallows the tail of the gesture from now (src/input/loaderSkip.ts).
      if (state.skipAt !== null && !state.skipLanded) {
        state.skipLanded = true;
        frame.loaderSkipEndsMs = performance.now();
      }
      if (!state.landed) {
        state.landed = true;
        // A later visit is one after the show has played (spec §2.1): the reduced fade marks nothing.
        if (marksSeen(state.path)) markLoaderSeen(SafeStorage.local());
        useScene.getState().dispatch({ type: 'LOADED' });
      }
    }
  }, SHOT_PRIORITY);

  // Home first, then the Void: their frame callbacks run in that order (both at the default priority, after the Rig), so
  // the Void holds the needle in the void after Home has posed the compass.
  return models ? (
    <>
      <Home models={models.home} handover={handover} />
      <Void compass={models.home.compass} light={models.light} handover={handover} tier={tier} standIns={models.standIns} onOpen={openAt} />
    </>
  ) : null;
}

/** Where the live opening stands: at home once it skips its loader, else as the loader's timeline says. */
function clockOf(state: Run): LoaderClock {
  if (state.skip) return HOME_CLOCK;
  return loaderAt({ elapsed: state.elapsed, loadedAt: state.loadedAt, skipAt: state.skipAt, path: state.path });
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * Applies a pose to the loader's parts and, once it exists, the compass, at `time` seconds of the loader (the bands'
 * turn, the smoke's drift and the sparks; held, the held moment's). Answers the needle's angle, which it writes into
 * `frame.needleAngle` too.
 *
 * - The engraving's five strokes in `STROKE_ORDER`, its ticks, outer ring and glow; the traces; the iris and the
 *   tunnel's light, and the lip, shown from the iris's start (`setLip`); the smoke.
 * - The probe stands where `probeAt` puts it, and its shaft is drawn only while it is shown (`setShown`); its light is
 *   the probe group's own and never hidden, so it stays in the scene and goes dark by intensity, and the number of
 *   lights never changes. Its sparks fly while it cuts and the cut is moving.
 * - The compass is hidden until the iris starts to open, then risen, revealed and turned as the pose says, the needle at
 *   `settleAngle` of its settle.
 */
function pose(parts: LoaderParts, compass: CompassModel | null, at: OpeningPose, time: number, state: Run): number {
  const { glass, engraving, traces, probe, smoke } = parts;
  let cut = 0;
  for (let i = 0; i < STROKE_ORDER.length; i++) {
    engraving.setStroke(STROKE_ORDER[i], at.strokes[i]);
    cut += at.strokes[i];
  }
  engraving.setTicks(at.ticks);
  engraving.setOuter(at.outer);
  engraving.setGlow(at.engraveGlow);
  traces.setLevel(at.traces);
  glass.setIris(at.iris);
  glass.setGlow(at.wellGlow);
  // The lip is the opening's: shown from the iris's start, not before, where it would draw the O as a lit gold ring
  // before the laser has cut the circle (the preview's p02 and p03 show no lip until the opening).
  glass.setLip(at.iris > 0);
  smoke.setDensity(at.smoke);
  smoke.setTime(time);

  const tip = at.probe;
  probe.setTip(tip.x, tip.y, tip.z);
  probe.setOn(tip.cutting);
  // Parked at PROBE.outY the probe is out of the landscape shots, but a phone's home camera stands far enough back
  // (about 23 m, at a 50 degree field) to see its 9 m shaft hang into the top of the picture.
  probe.setShown(tip.shown);
  if (cut !== state.cut) {
    state.cut = cut;
    state.cutAt = time;
  }
  probe.setSparks(tip.cutting ? clamp01(1 - (time - state.cutAt) / SPARKS_FADE) : 0, time);

  const needle = settleAngle(at.needleSettle);
  frame.needleAngle = needle;
  if (compass) {
    // No transmission pass under the shut cap: the compass shows once the iris has started to open.
    compass.group.visible = at.iris > 0;
    compass.setRise(at.rise);
    compass.setReveal(at.reveal);
    compass.setSpin(time);
    compass.setNeedle(needle);
  }
  return needle;
}
