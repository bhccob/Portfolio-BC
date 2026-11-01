/**
 * The tower's breath (round 16, spec 2026-11-01-bob-round16-design.md; Bob: "Breathe (A) but make it so everytime it
 * breathes regardless if its not on that floor"): every project in the tower and the socket under it breathe brighter
 * and softer together, on every floor, all the time, so a visitor sees there is something to click. It took over from
 * round 10's floor glow, which breathed only the floor in view. Pure: the same time, the same breath.
 *
 * - `period`: s from one top of a breath to the next.
 *
 * How much each part rises with it is the world's (`WORLD_LOOK.breath`, ~/engine/bob/build/world.ts). It runs on the
 * page's time, as the floor glow did: at rest the storm's frames carry it, so the canvas draws nothing more for it.
 */
export const TOWER_BREATH = { period: 2.4 } as const;

/** The breath at time `t` (s), 0..1: a smooth sine from 0 up to 1 and back; half way, still, with reduced motion. */
export function towerBreath(t: number, reduced: boolean): number {
  if (reduced) return 0.5;
  if (!Number.isFinite(t)) return 0;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / TOWER_BREATH.period);
}
