/**
 * Long work done between the frames instead of in one go. A scene part that takes a few hundred ms to make (the gas's
 * noise, a board's maps, the stars of a whole field) is written as a generator that says `yield` wherever it may stop;
 * `paced` runs it a few ms a frame, right after each paint, so the page keeps its frame rate and its input meanwhile, and
 * `drain` runs it in one go, for the tests and for whoever needs the result right now. It imports nothing.
 */

/** Long work a frame, ms: under half of a 60 Hz frame, so what the scene itself needs still fits. */
export const SLICE_MS = 6;

/** The most a pause waits for a frame that may never come (a covered window paints no frames), ms. */
const PAUSE_MOST_MS = 100;

/** Runs `steps` to its end now and answers its result. */
export function drain<T>(steps: Generator<void, T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/** Whether anybody can see the page: a hidden one has no frames to keep, and no frames to wait for either. */
function seen(): boolean {
  return typeof document !== 'undefined' && document.visibilityState !== 'hidden' && typeof requestAnimationFrame === 'function';
}

/** Answers just after the next paint, the moment furthest from the next frame's work; or a while on, if no frame comes. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      channel.port1.close();
      clearTimeout(most);
      resolve();
    };
    channel.port1.onmessage = finish;
    const most = setTimeout(finish, PAUSE_MOST_MS);
    requestAnimationFrame(() => channel.port2.postMessage(0));
  });
}

function* oneStop(): Generator<void, void> {
  yield;
}

/** Answers once the page has had a paint, in the queue with the rest: for a build too small to be worth writing as steps. */
export function nextSlice(): Promise<void> {
  return paced(oneStop(), 0);
}

/** The last piece of long work asked for: the next waits for it, so several never add up within one frame. */
let queue: Promise<unknown> = Promise.resolve();

async function run<T>(steps: Generator<void, T>, sliceMs: number): Promise<T> {
  let began = performance.now();
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
    if (performance.now() - began >= sliceMs && seen()) {
      await afterPaint();
      began = performance.now();
    }
  }
}

/** Runs `steps` at most `sliceMs` ms a frame, after whatever long work came before it, and answers its result; a throw in it rejects. */
export function paced<T>(steps: Generator<void, T>, sliceMs: number = SLICE_MS): Promise<T> {
  const mine = queue.then(() => run(steps, sliceMs));
  queue = mine.catch(() => {});
  return mine;
}
