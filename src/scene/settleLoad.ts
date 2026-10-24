export interface LoadOutcome {
  /** The scene is gone (unmounted): its load says nothing any more. */
  disposed(): boolean;
  /** The load has finished: show the scene. */
  ready(): void;
  /** The load threw: the scene is not shown at all (SceneHost falls back to the poster). */
  fail(error: unknown): void;
}

/**
 * Runs a scene's load and settles it one way or the other, once: `ready` when it has finished, `fail` when it threw.
 * A throw is a failure, never a partial scene; the soft failures a load means to survive (a canvas that
 * stays plain, a warm-up that only costs a stall) are the load's own to catch. Neither is called for a scene that is
 * already gone. It never rejects: an outcome that throws is logged.
 */
export async function settleLoad(load: () => Promise<void>, outcome: LoadOutcome): Promise<void> {
  let failure: { error: unknown } | null = null;
  try {
    await load();
  } catch (error) {
    failure = { error };
  }
  if (outcome.disposed()) return;
  try {
    if (failure) outcome.fail(failure.error);
    else outcome.ready();
  } catch (error) {
    console.error('[needle] the scene could not settle its load', error);
  }
}
