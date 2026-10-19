/**
 * The needle's damped angular spring, and the two angle helpers it needs. Pure
 * and DOM-free, and it imports nothing from three, gsap or lenis, so the tiny
 * loader bundle can run the same spring before three.js has loaded.
 *
 * Angles are radians. The spring always takes the short way round: the error
 * is the wrapped difference to the target and the value is kept wrapped, so a
 * target just across the +-PI seam is a short hop and not a full turn back.
 */

const TAU = Math.PI * 2;

/** The longest single step the spring will integrate; a stalled frame cannot fling it. */
const MAX_DT = 0.1;

/** Semi-implicit Euler runs in substeps no longer than this. */
const SUBSTEP = 1 / 120;

/** An angle in radians, wrapped into (-PI, PI]. A non-finite angle reads as 0. */
export function wrapAngle(a: number): number {
  if (!Number.isFinite(a)) return 0;
  const wrapped = a - TAU * Math.floor((a + Math.PI) / TAU);
  // The formula answers [-PI, PI); the range wanted is (-PI, PI], so due south is +PI.
  return wrapped <= -Math.PI ? Math.PI : wrapped;
}

/**
 * Blends two bearings (radians) along the shortest arc between them: `weight`
 * 0 is `pearl`, 1 is `scripted`. The result is wrapped into (-PI, PI].
 */
export function blendBearing(pearl: number, scripted: number, weight: number): number {
  const w = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  return wrapAngle(pearl + wrapAngle(scripted - pearl) * w);
}

export class AngleSpring {
  /** The angle in radians, wrapped into (-PI, PI]. */
  value = 0;
  /** Radians per second. */
  velocity = 0;

  private readonly zeta: number;
  private readonly omega: number;

  /**
   * @param zeta damping ratio; below 1 the needle overshoots a little before it settles
   * @param omega natural frequency in radians per second
   */
  constructor(zeta = 0.4, omega = 7) {
    this.zeta = zeta;
    this.omega = omega;
  }

  /** Puts the spring at `value` (radians) moving at `velocity` (radians per second). */
  set(value: number, velocity = 0): void {
    this.value = wrapAngle(value);
    this.velocity = Number.isFinite(velocity) ? velocity : 0;
  }

  /**
   * Advances `dt` seconds towards `target` and answers the new value. A step is
   * clamped to 0.1 s, a zero, negative or non-finite one changes nothing, and a
   * non-finite target is ignored.
   */
  step(target: number, dt: number): number {
    if (!Number.isFinite(target) || !Number.isFinite(dt) || dt <= 0) return this.value;
    const total = Math.min(dt, MAX_DT);
    // The small allowance keeps 1/60 s at two substeps and not three through rounding.
    const count = Math.max(1, Math.ceil(total / SUBSTEP - 1e-9));
    const h = total / count;
    const stiffness = this.omega * this.omega;
    const damping = 2 * this.zeta * this.omega;

    let value = this.value;
    let velocity = this.velocity;
    for (let i = 0; i < count; i++) {
      const error = wrapAngle(target - value);
      velocity += (stiffness * error - damping * velocity) * h;
      value = wrapAngle(value + velocity * h);
    }
    this.value = value;
    this.velocity = velocity;
    return value;
  }
}
