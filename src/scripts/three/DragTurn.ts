/**
 * Drag-to-turn: a horizontal drag turns the device a little about its upright
 * axis and tips it slightly; on release it springs back to rest. Pure and
 * DOM-free: the caller feeds it pointer positions and reads the angles on every
 * frame.
 */

export interface TurnLimits {
  /** Largest turn either way about the upright axis, in radians. */
  yaw: number;
  /** Largest tip either way, in radians. */
  pitch: number;
}

/** 25 degrees of yaw and 8 degrees of pitch. */
const DEFAULT_LIMITS: TurnLimits = { yaw: 0.436, pitch: 0.14 };

/** Distance in pixels from the press before a drag counts as a turn. */
const ENGAGE_DISTANCE = 8;

/** Radians of turn and tip for a drag of the full width of the canvas. */
const YAW_PER_WIDTH = 1.6;
const PITCH_PER_WIDTH = 0.6;

/** Natural frequency of the critically damped spring that returns to rest. */
const OMEGA = 6;

function clampTo(limit: number, value: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

export class DragTurn {
  private readonly limits: TurnLimits;
  private pressed = false;
  private isEngaged = false;
  private startX = 0;
  private startY = 0;
  private yaw = 0;
  private pitch = 0;
  private yawVelocity = 0;
  private pitchVelocity = 0;

  constructor(limits: TurnLimits = DEFAULT_LIMITS) {
    this.limits = limits;
  }

  /** True once a press has moved far enough sideways to count as a turn, until it is released. */
  get engaged(): boolean {
    return this.isEngaged;
  }

  /** A press begins at (x, y). */
  down(x: number, y: number): void {
    this.pressed = true;
    this.isEngaged = false;
    this.startX = x;
    this.startY = y;
  }

  /** The pointer moves to (x, y) over a canvas `width` pixels wide. */
  move(x: number, y: number, width: number): void {
    if (!this.pressed || !(width > 0)) return;
    const dx = x - this.startX;
    const dy = y - this.startY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

    if (!this.isEngaged) {
      if (Math.hypot(dx, dy) < ENGAGE_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return;
      this.isEngaged = true;
    }

    this.yaw = clampTo(this.limits.yaw, (dx / width) * YAW_PER_WIDTH);
    this.pitch = clampTo(this.limits.pitch, (dy / width) * PITCH_PER_WIDTH);
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
  }

  /** The press ends: the device springs back from wherever it was turned to. */
  up(): void {
    this.pressed = false;
    this.isEngaged = false;
  }

  /** Advances `dt` seconds; answers the angles to draw at, in radians. */
  step(dt: number): { yaw: number; pitch: number } {
    if (!this.isEngaged && Number.isFinite(dt) && dt > 0) {
      [this.yaw, this.yawVelocity] = settle(this.yaw, this.yawVelocity, dt);
      [this.pitch, this.pitchVelocity] = settle(this.pitch, this.pitchVelocity, dt);
    }
    return { yaw: this.yaw, pitch: this.pitch };
  }
}

/**
 * One axis of a critically damped spring (x'' = -w²x - 2wx') back to 0 after
 * `dt` seconds, from the closed-form solution so any step length is stable.
 */
function settle(x: number, v: number, dt: number): [number, number] {
  const decay = Math.exp(-OMEGA * dt);
  const carry = v + OMEGA * x;
  return [(x + carry * dt) * decay, (v - OMEGA * carry * dt) * decay];
}
