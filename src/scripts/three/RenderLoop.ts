/**
 * A requestAnimationFrame loop that can be switched on and off: on while its
 * canvas is on screen, off otherwise, so a page scrolled past the device or a
 * hidden tab schedules no frames. However often it is switched on, there is
 * only ever one loop. The frame functions can be swapped for tests.
 */
export class RenderLoop {
  /** The frame now scheduled, or null while the loop is off. */
  private frame: number | null = null;
  /** The time of the last frame, or null before the first one since switching on. */
  private last: number | null = null;

  constructor(
    private readonly tick: (dtSeconds: number) => void,
    private readonly raf: (cb: FrameRequestCallback) => number = (cb) => requestAnimationFrame(cb),
    private readonly caf: (id: number) => void = (id) => cancelAnimationFrame(id)
  ) {}

  /** Switches the loop on or off; asking for the state it is already in does nothing. */
  setActive(active: boolean): void {
    if (active === this.running) return;
    if (active) {
      this.last = null;
      this.frame = this.raf(this.step);
    } else {
      this.caf(this.frame!);
      this.frame = null;
    }
  }

  get running(): boolean {
    return this.frame !== null;
  }

  /**
   * One frame. The next is scheduled before the tick runs, so a tick that
   * switches the loop off cancels it. The first frame after switching on
   * has no time to measure from, so it ticks by 0.
   */
  private readonly step = (time: number): void => {
    const dt = this.last === null ? 0 : Math.max(0, time - this.last) / 1000;
    this.last = time;
    this.frame = this.raf(this.step);
    this.tick(dt);
  };
}
