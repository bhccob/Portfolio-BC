/**
 * One grab of the frame on the screen (round 14; round 15, the digitize): the Q&A's scene asks for it each frame the LED
 * screen draws (src/scene/bob/qaScene.ts, src/ui/ledSky.ts), and the effects hand it over right after the next frame is drawn
 * (./Effects.tsx `FrameGrab`), while the canvas's buffer still holds it (it is not kept past the frame).
 */

type Take = (source: HTMLCanvasElement, width: number, height: number) => void;

let wanted: Take | null = null;

/** Asks for the next frame drawn, for `take`; a later ask replaces it. */
export function requestGrab(take: Take): void {
  wanted = take;
}

/** Whether a grab is asked for. */
export function grabWanted(): boolean {
  return wanted !== null;
}

/** Hands the frame just drawn on `canvas` to the ask, if there is one, once; a taker's error never breaks the frame. */
export function grabNow(canvas: HTMLCanvasElement): void {
  const take = wanted;
  if (take === null) return;
  wanted = null;
  try {
    take(canvas, canvas.width, canvas.height);
  } catch {
    // A frame it could not read (a lost context): the LEDs wait for the next.
  }
}
