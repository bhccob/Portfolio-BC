/**
 * Free turn: a drag spins the dial about its face normal without limit, it
 * keeps turning after release and eases to rest on a whole turn; a mouse or pen
 * drag also tips the dial a little, within a limit the caller sets, and the tip
 * springs back on release. Pure and DOM-free: the caller feeds it pointer
 * positions and reads the angles on every frame.
 *
 * Angles are radians. A drag to the right turns the dial clockwise as seen,
 * which is a negative spin. `spin` is not wrapped: it is the sum of every turn
 * so far and comes to rest on a multiple of 2 PI, so the caller wraps it.
 */

export type PointerKind = 'mouse' | 'pen' | 'touch';

/** Distance in pixels from the press before a drag counts as a turn. */
const ENGAGE_DISTANCE = 8;

/** A drag across 0.8 of the canvas's width turns the dial once. */
const WIDTHS_PER_TURN = 0.8;

/** Radians of tip for a vertical drag of the canvas's full height. */
const TIP_PER_HEIGHT = 1.2;

/** The velocity at release is measured over the moves this many seconds back. */
const VELOCITY_WINDOW = 0.1;

/**
 * The fastest the dial may leave a release at, in rad/s (about 6 turns a
 * second): a phone is nearly four times as sensitive per pixel as a desktop,
 * and a hard flick would otherwise spin for seconds.
 */
const MAX_RELEASE_SPEED = 40;

/**
 * The shortest span, in seconds, the release velocity is divided over: moves
 * bunched together by a stalled main thread must not read as an instant flick.
 */
const MIN_VELOCITY_SPAN = 1 / 60;

/** The spin slows by e^(-FRICTION dt) after release. */
const FRICTION = 3;

/** The dial starts easing to a whole turn below this speed (rad/s) and after this long (s) since release. */
const SETTLE_SPEED = 0.3;
const SETTLE_AFTER = 1;

/** Natural frequencies of the critically damped springs that bring the spin to rest and the tip back. */
const SETTLE_OMEGA = 4;
const TIP_OMEGA = 6;

const TAU = Math.PI * 2;

function clampTo(limit: number, value: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * One axis of a critically damped spring (x'' = -w²x - 2wx') to 0 after `dt`
 * seconds, from the closed-form solution so any step length is stable.
 */
function settle(x: number, v: number, omega: number, dt: number): [number, number] {
  const decay = Math.exp(-omega * dt);
  const carry = v + omega * x;
  return [(x + carry * dt) * decay, (v - omega * carry * dt) * decay];
}

export class FreeTurn {
  private pressed = false;
  private isEngaged = false;
  private kind: PointerKind = 'mouse';
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  /** The tip when the press began: a drag continues from it, so a quick re-grab does not pop. */
  private tipAtPress = 0;
  /** The tip the press asks for before it is held to the limit. */
  private tipAsked = 0;
  /** Recent (time, spin) pairs from the drag's moves, for the velocity at release. */
  private samples: { time: number; spin: number }[] = [];

  private spin = 0;
  private spinVelocity = 0;
  private tip = 0;
  private tipVelocity = 0;
  /** Seconds since release; the dial starts at rest, long since released. */
  private sinceRelease = Infinity;
  /** The whole turn the spin is easing to, once it is easing. */
  private restAt: number | null = null;

  /** True once a press has moved far enough to count as a turn, until it is released. */
  get engaged(): boolean {
    return this.isEngaged;
  }

  /** A press begins at (x, y). It takes hold of the dial: any spin it had stops, and the tip stays where it is. */
  down(x: number, y: number, kind: PointerKind): void {
    this.pressed = true;
    this.isEngaged = false;
    this.kind = kind;
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    this.tipAtPress = this.tip;
    this.tipAsked = this.tip;
    this.samples = [];
    this.spinVelocity = 0;
    this.restAt = null;
  }

  /**
   * The pointer moves to (x, y) over a `width` by `height` canvas at `time`
   * seconds. A mouse or pen takes hold after 8 px in any direction; a touch
   * only when the move is more sideways than up, since a vertical swipe scrolls
   * the page. The dial then follows the pointer from where it was pressed.
   */
  move(x: number, y: number, width: number, height: number, time: number): void {
    if (!this.pressed || !(width > 0) || !(height > 0)) return;
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    if (!this.isEngaged) {
      if (Math.hypot(dx, dy) < ENGAGE_DISTANCE) return;
      if (this.kind === 'touch' && Math.abs(dx) <= Math.abs(dy)) return;
      this.isEngaged = true;
    }

    this.spin -= ((x - this.lastX) / (WIDTHS_PER_TURN * width)) * TAU;
    this.lastX = x;
    if (this.kind !== 'touch') this.tipAsked = this.tipAtPress + (dy / height) * TIP_PER_HEIGHT;

    if (Number.isFinite(time)) {
      this.samples.push({ time, spin: this.spin });
      // Only the last tenth of a second can matter at release, which is never earlier than this move.
      while (this.samples.length > 1 && time - this.samples[0].time > VELOCITY_WINDOW) this.samples.shift();
    }
  }

  /**
   * The press ends at `time` seconds: the dial keeps the speed it was moving
   * at over the last tenth of a second (at most 40 rad/s), and slows from there.
   */
  up(time: number): void {
    if (!this.pressed) return;
    let velocity = 0;
    if (this.isEngaged && Number.isFinite(time)) {
      const first = this.samples.find((s) => time - s.time <= VELOCITY_WINDOW);
      if (first) velocity = (this.spin - first.spin) / Math.max(time - first.time, MIN_VELOCITY_SPAN);
    }
    this.release(Number.isFinite(velocity) ? clampTo(MAX_RELEASE_SPEED, velocity) : 0);
  }

  /**
   * The press is taken away (a lost pointer, a scroll): released with no
   * speed. Without a press it does nothing, so a pointer-capture event that
   * follows `up` leaves a coasting dial alone.
   */
  cancel(): void {
    if (!this.pressed) return;
    this.release(0);
  }

  /** Advances `dt` seconds; answers the spin and the tip to draw at, in radians. */
  step(dt: number, tipLimit: number): { spin: number; tip: number } {
    const limit = Number.isFinite(tipLimit) && tipLimit > 0 ? tipLimit : 0;
    const live = Number.isFinite(dt) && dt > 0;

    if (live && !this.pressed) this.coast(dt);

    if (this.pressed) {
      this.tip = clampTo(limit, this.tipAsked);
      this.tipVelocity = 0;
    } else if (live) {
      [this.tip, this.tipVelocity] = settle(this.tip, this.tipVelocity, TIP_OMEGA, dt);
    }
    // The limit can shrink while the tip is out, as the camera tilts.
    this.tip = clampTo(limit, this.tip);

    return { spin: this.spin, tip: this.tip };
  }

  private release(velocity: number): void {
    this.pressed = false;
    this.isEngaged = false;
    this.samples = [];
    this.spinVelocity = velocity;
    this.sinceRelease = 0;
    this.restAt = null;
  }

  /** After release: friction while it is fast or soon after, then a spring to the nearest whole turn. */
  private coast(dt: number): void {
    this.sinceRelease += dt;

    if (this.restAt === null && Math.abs(this.spinVelocity) < SETTLE_SPEED && this.sinceRelease >= SETTLE_AFTER) {
      this.restAt = Math.round(this.spin / TAU) * TAU;
    }

    if (this.restAt === null) {
      // Exact for any step: the speed decays by e^(-FRICTION dt) and the spin gains what that decay covered.
      const decay = Math.exp(-FRICTION * dt);
      this.spin += (this.spinVelocity * (1 - decay)) / FRICTION;
      this.spinVelocity *= decay;
      return;
    }

    const [off, velocity] = settle(this.spin - this.restAt, this.spinVelocity, SETTLE_OMEGA, dt);
    this.spin = this.restAt + off;
    this.spinVelocity = velocity;
  }
}
