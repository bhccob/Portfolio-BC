/**
 * The three bead objects' motion as plain numbers: from a time in seconds to the pose of each object's moving parts
 * (spec §2.4, "Each moves its own way", from the discovery's motion signatures, docs/projects-discovery.md). Pure: it
 * imports nothing, keeps no state, and every function reads a time that is not finite as 0, so the same time is the
 * same picture. The beads (./build/beads.ts) write these numbers to the GLB's parts; the time runs only while a bead
 * is selected or hovered (Task 11), so at rest the space is still, and 0 is each object's rest pose, as the file has it.
 *
 * Each function writes into the object it is handed, if any, and hands it back, so a frame makes no object of its
 * own; with none it makes a new one.
 */

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

/**
 * How the objects move, in seconds and radians.
 *
 * - `funcial`: the platter turns once every `turn` seconds; a light pulse runs the track from TP1 to TP4 every `pulse`
 *   seconds; the five abacus beads slide up their rods one after another, each in its own share of `abacus.span`
 *   seconds, eased, and stay at the top.
 * - `jontai`: a pass of light every `period` seconds. Within it the light crosses the 16 cells in page order over the
 *   first `cross` of the pass, each cell charging while the light moves on `ramp` cells, eased; the charged module
 *   holds, and from `fade` of the pass to its end every cell lets go together, so the next pass starts from dark cells
 *   and none pops. The module tilts after the light, `tilt.lag` seconds behind it, at most `tilt.max`.
 * - `cookies`: a tick every `beat` seconds, stop and start: the train moves only in the `ease` seconds after each
 *   beat, smoothstepped, so it starts and stops with no speed and holds still in between. Wheel k (0 for
 *   cookies_wheel_1) turns 360°/(`teeth`·(k+1)) a beat, each the other way from its neighbour, as meshed wheels turn.
 *   The balance swings to and fro, `balance` either side of its rest, through its rest at every beat, where the
 *   escapement releases the train.
 */
export const BEAD_MOTION = {
  funcial: { turn: 40, pulse: 3, abacus: { beads: 5, span: 2 } },
  jontai: { period: 6, cells: 16, cross: 0.8, ramp: 2, fade: 0.88, tilt: { max: 4 * DEG, lag: 0.5 } },
  cookies: { beat: 1, ease: 0.12, wheels: 8, teeth: 12, balance: Math.PI / 4 }
} as const;

/** Funcial's platter, its track's pulse and its abacus. */
export interface FuncialMotion {
  /** The platter's turn about its own up, radians: 0 at rest, 2π after one turn (it is not wrapped). */
  platter: number;
  /** Where the pulse is along the track, 0 (TP1) to 1 (TP4), wrapping to 0 for the next run. */
  pulse: number;
  /** Each abacus bead's slide up its rod, 0 (resting on the base rail) to 1 (at the top rail), bead 1 first. */
  abacus: number[];
}

/** Jontai Energy's light, its cells' charge and its module's tilt. */
export interface JontaiMotion {
  /** How far through its pass the light is, 0..1, wrapping to 0 for the next pass. */
  sweep: number;
  /** Each cell's charge, 0..1, in page order (cell 1 first): never more charged than the cell before it. */
  cells: number[];
  /** The module's tilt about its own x, radians, at most 4 degrees either way: positive brings its top edge forward. */
  tilt: number;
}

/** Cookies Clicker's train of wheels and its balance. */
export interface CookiesMotion {
  /** The whole beats ticked: `floor(t)` at 1 Hz. */
  beat: number;
  /** Each wheel's turn about its own z, radians, wheel 1 first. */
  wheels: number[];
  /** The balance's swing about its own z, radians. */
  balance: number;
}

/** `t` if it is finite, else 0. */
function finite(t: number): number {
  return Number.isFinite(t) ? t : 0;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `x` held to [0, 1] and eased in and out, 3x² - 2x³: 0 and 1 are exact, and it leaves and arrives with no speed. */
function smoothstep01(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/** The fractional part of `x`, in [0, 1). */
function frac(x: number): number {
  return x - Math.floor(x);
}

/** An array of `length` zeros, or `into` when it is one. */
function slots(into: number[] | undefined, length: number): number[] {
  if (into && into.length === length) return into;
  return new Array<number>(length).fill(0);
}

/**
 * Funcial at `t` seconds: the platter turns once every 40 s, the pulse runs TP1 → TP4 every 3 s, and the abacus beads
 * slide up one after another over the first 2 s (Task 11 starts the clock when the bead is selected or hovered).
 */
export function funcialMotion(t: number, out?: FuncialMotion): FuncialMotion {
  const time = finite(t);
  const look = BEAD_MOTION.funcial;
  const abacus = slots(out?.abacus, look.abacus.beads);
  const share = look.abacus.span / look.abacus.beads;
  for (let k = 0; k < abacus.length; k++) abacus[k] = smoothstep01((time - k * share) / share);
  const motion = out ?? { platter: 0, pulse: 0, abacus };
  motion.platter = (TAU * time) / look.turn;
  motion.pulse = frac(time / look.pulse);
  motion.abacus = abacus;
  return motion;
}

/**
 * Jontai Energy at `t` seconds: the light passes every 6 s, the cells charge in page order behind it and let go
 * together at the pass's end, and the module tilts after the light, up to 4°, 0.5 s behind.
 *
 * The tilt is `-max · sin(2π · sweep(t - lag))`, the clock held at 0 for the first `lag` seconds, so the module rests
 * until the light has started and follows it as a tracker would: while the light crosses the top rows its face turns
 * up (a negative tilt), while it crosses the bottom rows down, and through the dark between passes back to its rest.
 */
export function jontaiMotion(t: number, out?: JontaiMotion): JontaiMotion {
  const time = finite(t);
  const look = BEAD_MOTION.jontai;
  const sweep = frac(time / look.period);
  const cells = slots(out?.cells, look.cells);
  // The light's place in page order, in cells: the last cell is full as the crossing ends.
  const head = (sweep / look.cross) * (look.cells - 1 + look.ramp);
  const hold = 1 - smoothstep01((sweep - look.fade) / (1 - look.fade));
  for (let k = 0; k < cells.length; k++) cells[k] = smoothstep01((head - k) / look.ramp) * hold;
  const swing = Math.sin(TAU * frac(Math.max(0, time - look.tilt.lag) / look.period));
  const motion = out ?? { sweep: 0, cells, tilt: 0 };
  motion.sweep = sweep;
  motion.cells = cells;
  // At rest exactly 0, not -0.
  motion.tilt = swing === 0 ? 0 : -look.tilt.max * swing;
  return motion;
}

/**
 * Cookies Clicker at `t` seconds: a 1 Hz tick, stop and start (`floor(t)` plus a 0.12 s ease), wheel k turning
 * 360°/(12·(k+1)) a beat, and the balance swinging through its rest at every beat.
 */
export function cookiesMotion(t: number, out?: CookiesMotion): CookiesMotion {
  const time = finite(t);
  const look = BEAD_MOTION.cookies;
  const beats = time / look.beat;
  const beat = Math.floor(beats);
  // The train's place in steps: the beats ticked, and the one under way eased over its first `ease` seconds.
  const steps = beat + smoothstep01(((beats - beat) * look.beat) / look.ease);
  const wheels = slots(out?.wheels, look.wheels);
  for (let k = 0; k < wheels.length; k++) {
    const turn = (steps * TAU) / (look.teeth * (k + 1));
    // Every other wheel the other way (`0 - turn`, so a wheel at rest is 0, not -0).
    wheels[k] = k % 2 === 0 ? turn : 0 - turn;
  }
  const motion = out ?? { beat: 0, wheels, balance: 0 };
  motion.beat = beat;
  motion.wheels = wheels;
  motion.balance = look.balance * Math.sin(Math.PI * beats);
  return motion;
}
