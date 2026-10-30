/**
 * The floor's glow (round 10, spec 2026-10-30-bob-qa-list-floors-design.md; Bob, 2026-10-30: "project glows so users know
 * where to hover theior mouse over"): at a floor's stop its projects' light breathes softly up and down, so a visitor sees
 * where to point. Pure: the same time, the same glow.
 *
 * - `pulse`: how much the light rises at the top of a breath (1 + pulse times its own);
 * - `period`: s from one top to the next.
 */
export const FLOOR_GLOW = { pulse: 0.35, period: 2.8 } as const;

/** The light's multiplier at time `t` (s): 1 to 1 + pulse, a smooth sine; half way, still, with reduced motion. */
export function floorGlow(t: number, reduced: boolean): number {
  if (reduced) return 1 + FLOOR_GLOW.pulse / 2;
  return 1 + FLOOR_GLOW.pulse * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / FLOOR_GLOW.period));
}
