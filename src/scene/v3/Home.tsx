import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { type ComponentProps, type JSX, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { COUNTRY_IDS, type CountryId } from '~/data/directions';
import { AngleSpring, wrapAngle } from '~/engine/AngleSpring';
import { AT_REST } from '~/engine/stillness';
import { AIM_SHELL, NEEDLE_SPRING, pointerBearing, touchDrift, touchDriftRests } from '~/engine/v3/aim';
import type { CityModel } from '~/engine/v3/build/city';
import { type ConstellationsModel, STARS_LOOK } from '~/engine/v3/build/constellations';
import type { NeedleModel } from '~/engine/v3/build/needle';
import { pointedAt, starPositions } from '~/engine/v3/constellations';
import { useTranslator } from '~/i18n/useTranslator';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { motion } from '../motion';
import { aimSource, breathAt, clearOfHero, glowToward, IDLE_SECONDS, idleRuns, isAiming, type LabelSide, labelSide, labelSpot, pulseAt, type ScreenBox } from './homePose';
import { LOOK } from './look';
import { LANDING_BEARING } from './openingPose';

/** The longest step the needle, the glows and the idle clock take in one frame, seconds: a wake from sleep jumps none. */
const MAX_STEP = 0.1;

/** The labels' z-index range for drei's Html: flat, so a label never lifts over anything the page lays on the scene. */
const LABEL_Z = [0, 0];

/** The home's objects Home drives: built, posed through the opening and freed by the Opening, which owns them. */
export interface HomeModels {
  needle: NeedleModel;
  constellations: ConstellationsModel;
  city: CityModel;
}

/**
 * What the Opening tells Home on each frame it draws, before Home's own frame: whether Home drives the home's objects
 * now. True once the opening has landed and posed the home; false before, and while the proof bridge holds the
 * loader's clock (`seekLoader`), when the Opening poses every object from the held moment and Home keeps its hands off.
 */
export interface Handover {
  live: boolean;
}

export interface HomeProps {
  models: HomeModels;
  handover: Handover;
  /** A mouse or trackpad: the needle follows it once it moves. On a touch screen the needle drifts instead. */
  finePointer: boolean;
}

type Placer = NonNullable<ComponentProps<typeof Html>['calculatePosition']>;

/** Scratch for the labels' placing, which runs in drei's frame and makes no objects of its own (the hero's boxes below are the browser's, read as they stand). */
const probe = new THREE.Vector3();
const box: ScreenBox = { left: 0, top: 0, right: 0, bottom: 0 };
const anchor = { x: 0, y: 0 };
const measured = { width: 0, height: 0 };

/**
 * The hero's three lines (base.css): the name and the tagline at the upper left, the scroll cue at the foot. A name
 * keeps clear of them (`clearOfHero`). The scene host covers the viewport (`.scene-host`), so the page's pixels are the
 * canvas's and a line's box is read as it stands.
 */
const HERO_LINES = ['.hero-name', '.hero-tagline', '.hero-cue'] as const;
const heroElements: (Element | null)[] = HERO_LINES.map(() => null);
const heroBoxes: ScreenBox[] = HERO_LINES.map(() => ({ left: 0, top: 0, right: 0, bottom: 0 }));

/** Reads the hero's lines' boxes into `heroBoxes`: each as it is on the page now, or a box that meets nothing where it is not. */
function readHero(): readonly ScreenBox[] {
  for (let i = 0; i < HERO_LINES.length; i++) {
    let element = heroElements[i];
    if (!element?.isConnected) element = heroElements[i] = document.querySelector(HERO_LINES[i]);
    const line = heroBoxes[i];
    if (element) {
      const rect = element.getBoundingClientRect();
      line.left = rect.left;
      line.top = rect.top;
      line.right = rect.right;
      line.bottom = rect.bottom;
    } else {
      line.left = line.top = Number.POSITIVE_INFINITY;
      line.right = line.bottom = Number.NEGATIVE_INFINITY;
    }
  }
  return heroBoxes;
}

/** Puts the world point `probe` on the screen of `size`, CSS px from the canvas's top left, into `into`. */
function onScreen(camera: THREE.Camera, size: { width: number; height: number }, into: { x: number; y: number }): void {
  probe.project(camera);
  into.x = ((probe.x + 1) / 2) * size.width;
  into.y = ((1 - probe.y) / 2) * size.height;
}

/** What Home keeps from frame to frame. Plain values, written per frame. */
interface HomeState {
  /** Home drove the objects last frame; false until the hand-over, and again while a seek holds the clock. */
  live: boolean;
  /** The bearing the needle's spring is pulled toward, radians: the pointer's, the drift's, or the last one held. */
  target: number;
  /** When the idle motion's while ends (performance.now() ms): IDLE_SECONDS after the last stir. */
  idleUntil: number;
  /** Seconds of idle motion so far: the clock of the twinkle, the breath, the pulse and the touch drift. */
  idleTime: number;
  /** The pointer move and the transition Home last saw, to tell a new one. */
  pointerAt: number;
  transition: number;
  /** Each constellation's glow as drawn, STARS_LOOK.rest to STARS_LOOK.pointed. */
  glow: Record<CountryId, number>;
}

/**
 * The home (spec §2.2), once the opening has landed: the needle follows the cursor with a heavy lag, the constellation
 * it points at brightens and shows its name, and the world idles for a while, then sleeps. The Opening builds the
 * objects, poses them through the opening and frees them; it mounts Home as soon as they exist and hands them over
 * (`handover.live`) once it has posed the home, and takes them back while a seek holds its clock.
 *
 * **Aim.** At home at rest (`isAiming`: HOME_IDLE on the home page) a mouse or trackpad that has moved aims the needle
 * at `pointerBearing(frame.pointer, camera, AIM_SHELL)`; before its first move, and always on a touch screen, the needle
 * follows `touchDrift`, which visits the three constellations. A pointer that finds no bearing, or has left the window
 * (it sends no more moves), keeps the last target; anywhere else the needle holds where it points. The needle follows
 * its target through `new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega)`, from north (LANDING_BEARING, where it
 * grew) at each hand-over; with reduced motion the spring is set straight to the target, with no animation.
 *
 * **Pointing.** `pointedAt(needle)` goes into `frame.pointed`; that constellation's glow fades to STARS_LOOK.pointed
 * over 0.4 s (`glowToward`) and the others' to STARS_LOOK.rest (at once with reduced motion). At home at rest its name
 * shows beside it on its outer side (`labelSpot`), from `t.needle.countries[id].name`, in a drei Html label that is
 * aria-hidden, takes no pointer and fades in and out over 0.3 s (base.css `.constellation-label`). Nothing else is
 * named. A name that would stand within `HERO_ROOM` of the hero's text (the name and tagline at the upper left, the
 * scroll cue below) stands under its figure instead (`clearOfHero`), so it never reads as a word of the hero's.
 *
 * **Idle.** For IDLE_SECONDS after the last stir (the hand-over, a phase change, a pointer move at home) and on until
 * the touch drift rests on a constellation, the stars twinkle, the needle's tip breathes (±10 %, 4 s) and the city
 * glows in a slow pulse (±5 %, 9 s), all on one clock that stops with them, so a sleeping scene is a still frame of
 * them and a wake goes on from there. None of it under reduced motion. Each frame it writes `motion.compass`
 * (`idle`, `needle`, `needleSpeed`) as milestone 1's compass did, so the Heartbeat lets the canvas sleep once the idle
 * while is over, the needle has settled and the glows have arrived. The mist drifts on the Opening's clock.
 */
export function Home({ models, handover, finePointer }: HomeProps): JSX.Element {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((state) => state.invalidate);
  const { t } = useTranslator();
  const [spring] = useState(() => new AngleSpring(NEEDLE_SPRING.zeta, NEEDLE_SPRING.omega));
  const [state] = useState<HomeState>(() => ({
    live: false,
    target: LANDING_BEARING,
    idleUntil: 0,
    idleTime: 0,
    pointerAt: frame.pointerAt,
    transition: useScene.getState().transitionId,
    glow: { china: STARS_LOOK.rest, netherlands: STARS_LOOK.rest, aruba: STARS_LOOK.rest },
  }));
  /** The three labels' elements (drei's Html forwards its ref to the label's own element). */
  const labels = useRef<Record<CountryId, HTMLDivElement | null>>({ china: null, netherlands: null, aruba: null });

  /** Each label's ref (it marks the element aria-hidden) and its placer, made once. */
  const each = useMemo(() => {
    const made = {} as Record<CountryId, { ref: (element: HTMLDivElement | null) => void; place: Placer; at: [number, number, number] }>;
    for (const id of COUNTRY_IDS) {
      const stars = starPositions(id);
      const side: LabelSide = labelSide(id);
      // drei moves a label only when its spot differs from the last it was given, so it is handed two pairs in turn.
      const pairs: [[number, number], [number, number]] = [
        [0, 0],
        [0, 0],
      ];
      let turn = 0;
      const centre = models.constellations.anchor(id);
      made[id] = {
        ref: (element) => {
          element?.setAttribute('aria-hidden', 'true');
          labels.current[id] = element;
        },
        at: [centre.x, centre.y, centre.z],
        // The box round the figure's stars on the screen and its anchor there, then the spot beside it.
        place: (_group, eye, size) => {
          const world = models.constellations.group.matrixWorld;
          box.left = box.top = Number.POSITIVE_INFINITY;
          box.right = box.bottom = Number.NEGATIVE_INFINITY;
          for (let k = 0; k < stars.length; k += 3) {
            probe.set(stars[k], stars[k + 1], stars[k + 2]).applyMatrix4(world);
            onScreen(eye, size, anchor);
            box.left = Math.min(box.left, anchor.x);
            box.right = Math.max(box.right, anchor.x);
            box.top = Math.min(box.top, anchor.y);
            box.bottom = Math.max(box.bottom, anchor.y);
          }
          models.constellations.anchor(id, probe).applyMatrix4(world);
          onScreen(eye, size, anchor);
          const element = labels.current[id];
          measured.width = element?.offsetWidth ?? 0;
          measured.height = element?.offsetHeight ?? 0;
          turn ^= 1;
          const spot = labelSpot(side, box, anchor, measured, size, pairs[turn]);
          return clearOfHero(spot, box, anchor, measured, size, readHero(), spot);
        },
      };
    }
    return made;
  }, [models]);

  // A name in another language is another width: its label is placed again on a frame.
  useEffect(() => invalidate(), [t, invalidate]);

  // Gone: no needle points at anything, and nothing of the home's keeps the canvas drawing.
  useEffect(
    () => () => {
      frame.pointed = null;
      Object.assign(motion.compass, AT_REST);
    },
    [],
  );

  useFrame((_, delta) => {
    if (!handover.live) {
      if (state.live) {
        state.live = false;
        frame.pointed = null;
        showLabel(labels.current, null);
      }
      return;
    }
    const now = performance.now();
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);
    const { reducedMotion: reduced, transitionId, phase, scene } = useScene.getState();
    const aiming = isAiming(phase.kind, scene);

    // What stirs the idle motion: the hand-over (the needle starts as the opening left it, pointing north, still, and
    // the glows at rest), a phase change, and a pointer move at home. A pointer anywhere else wakes only the parallax.
    let stirred = false;
    if (!state.live) {
      state.live = true;
      stirred = true;
      state.target = LANDING_BEARING;
      spring.set(LANDING_BEARING, 0);
      for (const id of COUNTRY_IDS) state.glow[id] = STARS_LOOK.rest;
    }
    if (state.transition !== transitionId) {
      state.transition = transitionId;
      stirred = true;
    }
    if (state.pointerAt !== frame.pointerAt) {
      state.pointerAt = frame.pointerAt;
      if (aiming) stirred = true;
    }
    if (stirred) state.idleUntil = now + IDLE_SECONDS * 1000;

    const source = aimSource(aiming, finePointer, Number.isFinite(frame.pointerAt));
    const runs = idleRuns({ now, until: state.idleUntil, reduced, drifting: source === 'drift', resting: touchDriftRests(state.idleTime) });
    if (runs) state.idleTime += dt;

    if (source === 'pointer') {
      const bearing = pointerBearing(frame.pointer, camera, AIM_SHELL);
      if (bearing !== null) state.target = bearing;
    } else if (source === 'drift') {
      state.target = touchDrift(state.idleTime);
    }
    if (reduced) spring.set(state.target, 0);
    const needle = spring.step(state.target, dt);
    models.needle.setBearing(needle);

    const pointed = pointedAt(needle);
    frame.pointed = pointed;
    let arrived = true;
    for (const id of COUNTRY_IDS) {
      const goal = id === pointed ? STARS_LOOK.pointed : STARS_LOOK.rest;
      const level = reduced ? goal : glowToward(state.glow[id], goal, dt);
      state.glow[id] = level;
      if (level !== goal) arrived = false;
      models.constellations.setGlow(id, level);
    }
    showLabel(labels.current, aiming ? pointed : null);

    models.constellations.setTwinkle(state.idleTime, !reduced);
    models.needle.setTipGlow(reduced ? 1 : breathAt(state.idleTime));
    models.city.setGlow(LOOK.home.city * (reduced ? 1 : pulseAt(state.idleTime)));

    const still = motion.compass;
    still.idle = !runs && arrived;
    still.needle = wrapAngle(state.target - spring.value);
    still.needleSpeed = spring.velocity;
  });

  return (
    <>
      {COUNTRY_IDS.map((id) => (
        <Html
          key={id}
          ref={each[id].ref}
          position={each[id].at}
          calculatePosition={each[id].place}
          zIndexRange={LABEL_Z}
          wrapperClass="constellation-label-anchor"
          className="constellation-label"
        >
          {t.needle.countries[id].name}
        </Html>
      ))}
    </>
  );
}

/** Shows the label of `shown` and hides the others (base.css fades them), touching only a label whose state changes. */
function showLabel(labels: Record<CountryId, HTMLDivElement | null>, shown: CountryId | null): void {
  for (const id of COUNTRY_IDS) {
    const element = labels[id];
    if (element && element.hasAttribute('data-shown') !== (id === shown)) element.toggleAttribute('data-shown', id === shown);
  }
}
