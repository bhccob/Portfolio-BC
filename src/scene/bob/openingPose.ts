/**
 * The BOB opening's choreography as plain numbers: from where the loader's clock
 * stands (~/engine/bob/loaderTimeline) to how every object of the loader and
 * the home is posed, and where the camera is. Pure, so the tests read the very
 * pose the Opening applies, and a clock held still or sought (the debug
 * bridge's `seekLoader`) poses the scene exactly as the live clock did at that
 * moment: nothing here remembers the frame before. It imports nothing from
 * React.
 *
 * The three paths (spec section 2.1, the timeline's header):
 * - full: the Blender preview at its own pace. The probe cuts the circle, the
 *   one mark of the loader, the ticks and the outer ring grow, the glass inside
 *   the circle opens like an iris, the warm light comes up the tunnel, the
 *   compass rises, the camera pushes in from the wide shot and the needle swings
 *   in. No B letter is drawn: the four B strokes stay at 0 on every path (they
 *   come in on the scroll).
 * - quick (the loader was seen before): the circle is cut already, so the
 *   engraving and the compass fade in, the iris opens, the compass rises and the
 *   camera settles in from just beyond the home shot.
 * - reduced motion: the circle cut, the iris open and the compass risen from the
 *   first frame; the engraving and the compass fade in, and the camera is the
 *   home shot throughout.
 *
 * Every path lands on the same home (`HOME_POSE`), so the Home takes over from
 * a pose it did not have to guess at.
 *
 * The clock's shares are linear in the script's time; the curves are made here,
 * the preview's own (tools/blender/bob_animate_o.py): the ticks ease out, the
 * outer ring and the warm light ease in and out (smoothstep), the iris eases in
 * (so the cap stays nearly shut and then drops), and the engraving's glow
 * eases out as the world comes up from black. The same curves play on the quick
 * path's spans, as the clock's shares are the same fields. Each is exactly 0 at
 * 0 and exactly 1 at 1, so every path lands on `HOME_POSE`. What is not curved
 * here has its curve elsewhere: the cut is at constant speed, the compass's
 * rise is baked into the GLB clip, and the needle's settle is `settleAngle`. The
 * fades from black (the traces, the smoke) and the camera's flight use `ease`.
 */
import { TRACES_LOOK } from '~/engine/bob/build/traces';
import { type LoaderClock, type LoaderPath } from '~/engine/bob/loaderTimeline';
import { PROBE, type ProbeState, probeAt } from '~/engine/bob/probePath';
import { type CameraShot, homeShotFor, lerpCameraShot, wideShotFor } from '~/engine/bob/shots';

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * The opening's easing: Perlin's smootherstep, held to 0..1. It leaves and
 * arrives with no speed at all, so a camera move is heavy and damped (spec
 * section 4, motion) and a fade ends without a visible edge.
 */
export function ease(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** The preview's `ease_out`: fast at first, then slowing to a stop; held to 0..1. */
function easeOut(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

/** The preview's `ease_in`: slow at first, then quickening; held to 0..1. */
function easeIn(t: number): number {
  const x = clamp01(t);
  return x ** 3;
}

/** The preview's `ease_io`: smoothstep, held to 0..1. */
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** How long the smoke takes to thicken from nothing, in script seconds: the preview's frames 1 to 60 at 24 fps. */
const SMOKE_SECONDS = 2.5;

/** How many times as far from its target as the home shot the quick path's camera starts. */
const QUICK_START_DISTANCE = 1.08;

/** Every object of the opening, posed: each field is what one setter of the builders is handed. */
export interface OpeningPose {
  /** How much of each stroke is cut, in `STROKE_ORDER` (`EngravingModel.setStroke`). */
  strokes: readonly number[];
  /** How far the ticks have grown (`setTicks`), on the preview's ease-out. */
  ticks: number;
  /** How far the outer ring is drawn (`setOuter`), on smoothstep. */
  outer: number;
  /** The engraving's glow (`setGlow`): 1 is the engraving at rest, less is it fading in from black. */
  engraveGlow: number;
  /** The traces' level (`TracesModel.setLevel`), up to `TRACES_LOOK.level` at rest. */
  traces: number;
  /** The laser probe: where its tip is, whether it cuts and whether it is in the picture. */
  probe: ProbeState;
  /** How far the iris has opened (`GlassModel.setIris`), on the preview's ease-in. */
  iris: number;
  /** The tunnel's warm light (`GlassModel.setGlow`), on smoothstep. */
  wellGlow: number;
  /** How far the compass has risen out of the opening (`CompassModel.setRise`). */
  rise: number;
  /** How much of the compass shows (`CompassModel.setReveal`): all of it on the full path, where the glass hides it. */
  reveal: number;
  /** How far the needle's swing has settled, 0..1: the angle is `settleAngle` of it (~/engine/bob/needle). */
  needleSettle: number;
  /** How thick the smoke is (`SmokeModel.setDensity`). */
  smoke: number;
}

/**
 * The home every path lands on: the circle cut and no B letter drawn (the
 * four B strokes are 0), open and risen, the traces at rest, the smoke thick
 * and the probe away (parked, as `probeAt` parks it once it is out of the
 * picture), the needle settled. Frozen all through, so the Home can hold it
 * without a copy.
 */
export const HOME_POSE: Readonly<OpeningPose> = Object.freeze({
  strokes: Object.freeze([0, 0, 0, 0, 1]),
  ticks: 1,
  outer: 1,
  engraveGlow: 1,
  traces: TRACES_LOOK.level,
  probe: Object.freeze({ x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false }),
  iris: 1,
  wellGlow: 1,
  rise: 1,
  reveal: 1,
  needleSettle: 1,
  smoke: 1
});

/**
 * Every object's pose at this moment of the opening. The path decides little
 * beyond what the clock already says, as the clock's shares are the path's:
 * - the cut marks, the rise and the needle's settle are the clock's own shares;
 * - the ticks, the outer ring, the iris and the light are the clock's shares
 *   through the preview's curves (see the header);
 * - the probe is `probeAt`'s, which parks it on the quick and reduced paths,
 *   where the script stands at its end;
 * - the engraving's glow is the clock's fade on the ease-out: the full path's
 *   fade is over by the time the circle starts, so the cut is lit throughout,
 *   and on the other two it is the engraving glowing in;
 * - the traces come up from nothing to `TRACES_LOOK.level` with the fade,
 *   eased: the world rising from black;
 * - the smoke thickens from nothing over the script's first 2.5 s, eased, on
 *   the full path; on the quick and reduced paths, whose script stands at its
 *   end, it comes up with the clock's fade, eased, like everything else there
 *   (Ruling 33), so their dark first frame has no smoke at full density;
 * - the compass shows whole on the full path, where it is hidden by the glass
 *   until it rises, and fades in with the clock's fade on the other two.
 */
export function openingPoseAt(clock: LoaderClock, path: LoaderPath): OpeningPose {
  return {
    strokes: clock.strokes,
    ticks: easeOut(clock.ticks),
    outer: smoothstep(clock.outer),
    engraveGlow: easeOut(clock.fade),
    traces: TRACES_LOOK.level * ease(clock.fade),
    probe: probeAt(clock),
    iris: easeIn(clock.iris),
    wellGlow: smoothstep(clock.glow),
    rise: clock.rise,
    reveal: path === 'full' ? 1 : clock.fade,
    needleSettle: clock.settle,
    smoke: ease(path === 'full' ? clock.script / SMOKE_SECONDS : clock.fade)
  };
}

/**
 * Where the camera is at this moment of the opening, for a screen of this
 * aspect (width over height):
 * - full: the wide shot, the whole name, until the push-in starts; then the
 *   wide shot to the home by `ease(clock.camera)`; the home shot once it ends;
 * - quick: from the home shot stood back, 1.08 times as far from its target
 *   on the same line at the same field of view, to the home shot over the same
 *   share, eased. The start is made from the finished home shot, not from its
 *   frame, so it is a real push on every screen, including a narrow one where
 *   `shotFor` holds the field of view at its widest and sets the distance from
 *   the width;
 * - reduced: the home shot throughout, no flight.
 *
 * Both ends are the very shots `wideShotFor` and `homeShotFor` give, to the
 * last digit, so the Home that takes the camera over finds it where it
 * expects it.
 */
export function cameraShotAt(clock: LoaderClock, path: LoaderPath, aspect: number): CameraShot {
  const home = homeShotFor(aspect);
  if (path === 'reduced') return home;
  const t = clock.camera;
  if (t >= 1) return home;
  const from = path === 'quick' ? stoodBack(home, QUICK_START_DISTANCE) : wideShotFor(aspect);
  if (!(t > 0)) return from;
  return lerpCameraShot(from, home, ease(t));
}

/** `shot` with its camera `factor` times as far from its target, on the same line and at the same field of view. */
function stoodBack(shot: CameraShot, factor: number): CameraShot {
  const [tx, ty, tz] = shot.target;
  const [px, py, pz] = shot.position;
  return { position: [tx + (px - tx) * factor, ty + (py - ty) * factor, tz + (pz - tz) * factor], target: [tx, ty, tz], fov: shot.fov };
}

/**
 * The two parts of the home's load, by their share of the loader's progress:
 * the band strips painted (`paint`), then the compass's file loaded and its
 * programs compiled (`warm`). The glass, the engraving, the traces, the probe
 * and the smoke are built before the loader shows at all, so they have no
 * share.
 */
export const LOAD_SHARES = { paint: 0.6, warm: 0.4 } as const;

/** How much of the home's load is done, 0..1, from which parts are; exactly 1 when both are, so the loader can end whole. */
export function loadShare(done: { paint: boolean; warm: boolean }): number {
  if (done.paint && done.warm) return 1;
  return (done.paint ? LOAD_SHARES.paint : 0) + (done.warm ? LOAD_SHARES.warm : 0);
}
