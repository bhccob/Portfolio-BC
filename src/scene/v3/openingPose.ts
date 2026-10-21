/**
 * The v3 opening's choreography as plain numbers: from where the loader's clock stands (src/engine/v3/loaderTimeline.ts)
 * to where the camera is and how every object of the loader and the home is posed. Pure, so the tests read the very
 * pose the Opening (Opening.tsx) applies, and a clock held still or sought back (Task 12b's `seekLoader`) poses the scene
 * exactly as the live clock did at that moment: nothing here remembers the frame before.
 *
 * The three paths (spec §2.1, the timeline's header):
 * - full: the laser engraves ON as the pins fill; power-on lifts the probe and glides it over the centre while the pins
 *   and the traces glow; the circuit bends the traces into the rings as the camera rises and the glass forms in its
 *   second half; the landing grows the needle out of the probe, dims the chip and lets the constellations in as the
 *   camera settles on the home.
 * - quick (seen this session): the night until the load is done, then a short landing onto the home, already formed.
 * - reduced motion: a static engraved ON with the pins filling, then a dip through the night with the camera cut to
 *   the home at its midpoint (Ruling 4): no laser and no camera flight. A quick path under reduced motion dips too.
 *
 * Every path lands on the same home (Ruling 3): the chip dimmed under the hub, ON whole and cool, all 64 pins lit.
 */
import { MIST_LOOK } from '~/engine/v3/build/mist';
import { ON_STROKES, PIN_COUNT, type Point2, strokeLengths } from '~/engine/v3/chipSpec';
import type { LoaderClock } from '~/engine/v3/loaderTimeline';
import { type CameraShot, homeShotFor, lerpCameraShot, loaderShotFor } from '~/engine/v3/shots';
import { LOOK } from './look';

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * The opening's easing: Perlin's smootherstep, held to 0..1. It leaves and arrives with no speed at all, so a camera
 * move is heavy and damped (spec §4, motion) and two moves that meet (the circuit's rise and the landing) join without
 * a jolt.
 */
export function ease(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** From `a` at 0 to `b` at 1, exact at both ends, so a stage ends on precisely the value the next one starts from. */
function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

/**
 * Where the camera is at this moment of the opening, for a screen of this aspect (width over height). The loader's two
 * shots come from `loaderShotFor` (Ruling 8), so a phone frames the chip, and the home from `homeShotFor`:
 * - `engrave` and `power`: the macro shot of the chip (frame 01);
 * - `circuit`: from the macro up to the high shot over the rings (frame 03), eased;
 * - `land`: from the high shot down to the home (frame 04), eased; with `reduced` motion it is no flight but a cut, the
 *   macro shot until the landing's midpoint (where the night has covered the frame) and the home from then on;
 * - `home`: the home shot;
 * - `dark` (the quick path, under the night): the high shot, where its landing sets off from.
 */
export function cameraShotAt(clock: LoaderClock, aspect: number, reduced = false): CameraShot {
  const macro = (): CameraShot => loaderShotFor('loaderMacro', aspect);
  const rise = (): CameraShot => loaderShotFor('loaderRise', aspect);
  switch (clock.stage) {
    case 'dark':
      return rise();
    case 'engrave':
    case 'power':
      return macro();
    case 'circuit':
      return lerpCameraShot(macro(), rise(), ease(clock.local));
    case 'land':
      if (reduced) return clock.local < 0.5 ? macro() : homeShotFor(aspect);
      return lerpCameraShot(rise(), homeShotFor(aspect), ease(clock.local));
    default:
      return homeShotFor(aspect);
  }
}

/**
 * How high the probe lifts off its nozzle's gap as the chip powers up, world units: a clear step up from the cut, small
 * against the chip (0.28 across), so the beam is plainly off and the probe stays in the macro shot.
 */
export const PROBE_LIFT = 0.05;

/** The laser's pose: whether it is drawn at all, whether its beam is on, its lift off the nozzle's gap and its glide. */
export interface LaserPose {
  /** The probe is drawn (false hides the whole laser: the reduced path, and from the landing on, when the needle has grown out of it). */
  shown: boolean;
  /** The beam, the point, the sparks and the smoke: only while it cuts. */
  on: boolean;
  /** How far the probe has lifted, world units over its cutting height. */
  lift: number;
  /** From the cut's end (0) to standing over the chip's centre (1), where the needle grows from (NEEDLE_LOOK.probe). */
  glide: number;
}

/** Every object of the opening, posed: each field is what one setter of the builders is handed. */
export interface OpeningPose {
  /** The night laid over the whole frame, 0..1: the quick path's dark, the reduced landing's dip, the quick landing's lift. */
  veil: number;
  /** How much of ON is cut, 0..1 (the chip's `setEngraving` through `engraved`). */
  engraving: number;
  /** The ON is shown already whole and long cooled (`setEngraving` at a time of -Infinity), so no hot stroke flashes. */
  cooled: boolean;
  /** How many of the 64 pins are lit (`setPins`). */
  pins: number;
  /** The chip's power (`setPower`): the pins' glow and the traces', which it drives. */
  power: number;
  /** The chip's own light (`setRest`): 1 in the loader, LOOK.home.chip under the hub. */
  rest: number;
  laser: LaserPose;
  /** The traces' move from board to ring (`setT`). */
  traces: number;
  /** The glass compass's fade (`setFormed`). */
  formed: number;
  /** The needle's growth out of the probe (`setForm`), or null while it is not drawn. */
  needle: number | null;
  /**
   * How far the chip city has risen out of the board, 0..1 (0 hides it): its blocks' height and its glow, which is
   * LOOK.home.city at 1. It rises with the circuit, not before: in the loader's close shot its blocks would stand as
   * towers round the chip and hide its pins.
   */
  city: number;
  /** The constellations' share of their resting glow, 0..1; 0 hides them. */
  stars: number;
  /** The mist's density (`setDensity`): 1 in the loader, MIST_LOOK.home at home. */
  mist: number;
}

/** Which path the opening plays: the quick one (the loader was seen this session), and under reduced motion. */
export interface OpeningPath {
  quick: boolean;
  reduced: boolean;
}

const NO_LASER: LaserPose = { shown: false, on: false, lift: 0, glide: 1 };

/** The home's ground, which every path lands on (Ruling 3). */
function home(veil = 0): OpeningPose {
  return {
    veil,
    engraving: 1,
    cooled: true,
    pins: PIN_COUNT,
    power: LOOK.home.current,
    rest: LOOK.home.chip,
    laser: NO_LASER,
    traces: 1,
    formed: 1,
    needle: 1,
    city: 1,
    stars: 1,
    mist: MIST_LOOK.home,
  };
}

/** The chip alone on the dark board, as the loader opens: nothing of the compass, the city or the stars yet. */
function board(engraving: number, cooled: boolean, pins: number, laser: LaserPose): OpeningPose {
  return { veil: 0, engraving, cooled, pins, power: 0, rest: 1, laser, traces: 0, formed: 0, needle: null, city: 0, stars: 0, mist: 1 };
}

/** The mist over the circuit and the landing, one eased fall from the loader's 1 to the home's: `p` is 0..1 across both. */
function thinning(p: number): number {
  return mix(1, MIST_LOOK.home, ease(p));
}

/**
 * The reduced landing's dip through the night, 0 to 1 at the midpoint and back to 0, eased each way; `from` is the
 * night it starts under (the quick path's dark is already all night, so it holds there until the midpoint).
 */
function dip(local: number, from: number): number {
  return local < 0.5 ? mix(from, 1, ease(local * 2)) : 1 - ease(local * 2 - 1);
}

/**
 * Every object's pose at this moment of the opening, on this path. The camera is `cameraShotAt`'s; the laser's tip, on
 * the full path's engraving, is `tipAt(engraving)`.
 */
export function openingPoseAt(clock: LoaderClock, path: OpeningPath): OpeningPose {
  const { stage, local } = clock;
  if (stage === 'home') return home();

  if (path.quick) {
    if (stage === 'dark') return home(1);
    // The landing: the home's ground under a lifting night; under reduced motion the night holds until the midpoint.
    return home(path.reduced ? dip(local, 1) : 1 - ease(local));
  }

  if (path.reduced) {
    // A static, whole ON (no laser), the pins filling with the load; then the dip, cutting to the home under the night.
    if (stage === 'land' && local >= 0.5) return home(dip(local, 0));
    const still = board(1, true, clock.pins, NO_LASER);
    if (stage === 'land') still.veil = dip(local, 0);
    return still;
  }

  switch (stage) {
    case 'engrave':
      return board(clock.engraving, false, clock.pins, { shown: true, on: true, lift: 0, glide: 0 });
    case 'power': {
      const s = ease(local);
      return { ...board(1, false, PIN_COUNT, { shown: true, on: false, lift: PROBE_LIFT * s, glide: s }), power: s };
    }
    case 'circuit': {
      const s = ease(local);
      return {
        ...board(1, false, PIN_COUNT, { shown: true, on: false, lift: PROBE_LIFT * (1 - s), glide: 1 }),
        power: 1,
        traces: local,
        // The glass forms only in the circuit's second half, as the traces reach the rings' heights.
        formed: ease((local - 0.5) * 2),
        city: s,
        mist: thinning(local / 2),
      };
    }
    case 'land': {
      const s = ease(local);
      return {
        veil: 0,
        engraving: 1,
        cooled: false,
        pins: PIN_COUNT,
        power: mix(1, LOOK.home.current, s),
        rest: mix(1, LOOK.home.chip, s),
        laser: NO_LASER,
        traces: 1,
        formed: 1,
        needle: local,
        city: 1,
        stars: s,
        mist: thinning(0.5 + local / 2),
      };
    }
    default:
      // `dark` belongs to the quick path; on the others the night is all there is to draw.
      return { ...board(0, true, 0, NO_LASER), veil: 1 };
  }
}

/** The strokes' lengths and the whole ON's, for the tip. */
const LENGTHS = strokeLengths(ON_STROKES);
const TOTAL = LENGTHS.reduce((sum, length) => sum + length, 0);

/**
 * Where the laser's tip stands on the chip's top when `engraving` (0..1, NaN reads as 0) of ON is cut: the point that
 * far along the strokes, in the order the laser cuts them (the O from its top, then the N's three strokes), as
 * `engraved` reckons the cut, so the beam meets the engraving exactly at its end. 0 is the O's first point, 1 the N's
 * last.
 */
export function tipAt(engraving: number): Point2 {
  const share = clamp01(engraving);
  if (share >= 1) {
    const last = ON_STROKES[ON_STROKES.length - 1].points;
    return last[last.length - 1];
  }
  let left = share * TOTAL;
  for (let k = 0; k < ON_STROKES.length; k++) {
    const points = ON_STROKES[k].points;
    if (left > LENGTHS[k] && k < ON_STROKES.length - 1) {
      left -= LENGTHS[k];
      continue;
    }
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      const step = Math.hypot(bx - ax, bz - az);
      if (left <= step || i === points.length - 1) {
        const f = step > 0 ? Math.min(1, left / step) : 0;
        return f >= 1 ? points[i] : f <= 0 ? points[i - 1] : [ax + (bx - ax) * f, az + (bz - az) * f];
      }
      left -= step;
    }
  }
  return ON_STROKES[0].points[0];
}

/**
 * The two parts of the home's load, by their share of the loader's progress: the four ring masks painted (`paint`),
 * then the home's programs compiled and its masks uploaded (`warm`). The chip, the laser, the traces and the mist are
 * built before the loader shows at all, so they have no share.
 */
export const LOAD_SHARES = { paint: 0.6, warm: 0.4 } as const;

/** How much of the home's load is done, 0..1, from which parts are; exactly 1 when both are, so the pins can all light. */
export function loadShare(done: { paint: boolean; warm: boolean }): number {
  if (done.paint && done.warm) return 1;
  return (done.paint ? LOAD_SHARES.paint : 0) + (done.warm ? LOAD_SHARES.warm : 0);
}
