/** The samples that count towards the speed of a release: the last 100 ms of the drag. */
const WINDOW_MS = 100;
/** How fast the speed dies: it is multiplied by exp(-DECAY * dt), so it halves about every 0.17 s. */
const DECAY = 4;
/** Below this speed, in px/s, the glide is over. */
const MIN_SPEED = 5;
/** The fastest glide a release may start, in px/s: with the decay it carries about 1500 px, under two screens. */
const MAX_SPEED = 6000;
/** What a lone sample is taken to have lasted, in ms: about one frame. */
const FRAME_MS = 16;

interface Sample {
  t: number;
  px: number;
}

/**
 * The glide of a flick: a finger that lets go while it is still moving keeps the scroll going, slower and
 * slower. `track` it while the finger moves (the pixels it moved at a time), `release` it when the finger
 * lifts, then `step` it every frame for the pixels to apply until it is no longer `active`.
 *
 * It is a plain object with no clock of its own: the caller gives it the times, so it behaves the same under
 * a test as in a browser.
 */
export class Inertia {
  private samples: Sample[] = [];
  private velocity = 0; // px/s
  private running = false;

  /** True while a glide is going. */
  get active(): boolean {
    return this.running;
  }

  /** The finger moved `px` pixels (signed, in the direction the scroll should go), at `timeMs`. */
  track(timeMs: number, px: number): void {
    this.samples.push({ t: timeMs, px });
    // A drag may be long: only the last 100 ms ever matter, and a release happens at or after the last sample.
    const first = this.samples.findIndex((sample) => sample.t >= timeMs - WINDOW_MS);
    if (first > 0) this.samples.splice(0, first);
  }

  /**
   * The finger lifted at `timeMs`. The glide starts at the speed of the last 100 ms of the drag; a finger that
   * had stopped (no sample in that window) glides nowhere.
   */
  release(timeMs: number): void {
    const recent = this.samples.filter((sample) => sample.t >= timeMs - WINDOW_MS);
    this.samples = [];
    this.running = false;
    this.velocity = 0;
    if (recent.length === 0) return;

    let distance: number;
    let duration: number;
    if (recent.length === 1) {
      // One sample says how far, not for how long: call it a frame.
      distance = recent[0]!.px;
      duration = FRAME_MS;
    } else {
      // Each sample is the distance moved since the one before, so the first only marks where the window begins.
      distance = recent.slice(1).reduce((sum, sample) => sum + sample.px, 0);
      duration = Math.max(recent[recent.length - 1]!.t - recent[0]!.t, 1);
    }
    const speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (distance / duration) * 1000));
    if (Math.abs(speed) < MIN_SPEED) return;
    this.velocity = speed;
    this.running = true;
  }

  /** The pixels to apply for this frame of `dtSec` seconds; 0 when nothing is gliding. */
  step(dtSec: number): number {
    if (!this.running) return 0;
    const px = this.velocity * dtSec;
    this.velocity *= Math.exp(-DECAY * dtSec);
    if (Math.abs(this.velocity) < MIN_SPEED) this.stop();
    return px;
  }

  /** Ends the glide, and forgets the drag in progress. */
  stop(): void {
    this.samples = [];
    this.velocity = 0;
    this.running = false;
  }
}
