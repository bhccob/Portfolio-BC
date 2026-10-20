/**
 * Waits on `work` for at most `ms` milliseconds: answers true once it has
 * settled (resolved or rejected) in time, false at the deadline. It never
 * rejects, and the work carries on either way: what it does after the
 * deadline is the caller's to handle. Imports nothing, so the entry bundle
 * (compass-main) can use it before three.js has arrived.
 */
export function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    const settled = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    work.then(settled, settled);
  });
}
