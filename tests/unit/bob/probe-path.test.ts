import { describe, expect, it } from 'vitest';
import { HOLD_AT, loaderAt, type LoaderPath, SCRIPT } from '~/engine/bob/loaderTimeline';
import { PROBE, probeAt } from '~/engine/bob/probePath';

// Round 17 (Bob: "B · Signal"): the signal's line takes the place of the probe's descent and its cut, so the probe never
// comes down. It stays built (its lamp is one of the scene's lights, whose count must not change mid-show), parked out of
// the picture, dark.

const parked = { x: 0, y: PROBE.outY, z: 0, cutting: false, shown: false };

describe('the probe, parked', () => {
  it('stays parked through the whole full show, held or not, skipped or not', () => {
    for (const input of [
      { loadedAt: 0.1, skipAt: null },
      { loadedAt: null, skipAt: null },
      { loadedAt: HOLD_AT + 3, skipAt: null },
      { loadedAt: 0.1, skipAt: 1.5 },
      { loadedAt: null, skipAt: 1.5 }
    ])
      for (let t = 0; t <= SCRIPT.home + 2; t += 0.05) expect(probeAt(loaderAt({ elapsed: t, path: 'full', ...input })), `at ${t.toFixed(2)}, ${JSON.stringify(input)}`).toEqual(parked);
  });

  it('stays parked on the quick path and the reduced path', () => {
    for (const path of ['quick', 'reduced'] as LoaderPath[])
      for (const t of [0, 0.5, 1, 2, 3, 9]) expect(probeAt(loaderAt({ elapsed: t, loadedAt: 0.2, skipAt: null, path })), `${path} at ${t}`).toEqual(parked);
  });

  it('is parked from a clock that is not a time', () => {
    expect(probeAt(loaderAt({ elapsed: Number.NaN, loadedAt: null, skipAt: null, path: 'full' }))).toEqual(parked);
  });
});
