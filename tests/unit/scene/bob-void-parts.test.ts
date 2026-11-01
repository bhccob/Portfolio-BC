import { describe, expect, it } from 'vitest';
import { easeInOutQuart } from '~/input/scrollLoop';
import { WAY_OUT, wayOutAt } from '~/scene/bob/wayOut';
import { towerStands } from '~/scene/bob/worldPath';

/** The place in the Q&A `g` seconds into the dissolve. */
const inDissolve = (g: number): number => -1 + easeInOutQuart(g / WAY_OUT.dissolve);
const at = (place: number) => ({ place, out: wayOutAt(place) });

describe('the solid tower in the scene (round 15)', () => {
  it('the tower stands off the way out: before the door, at it and while the dissolve has not let it go', () => {
    expect(towerStands(null)).toBe(true);
    expect(towerStands(at(-1))).toBe(true);
    expect(towerStands(at(inDissolve(3.2)))).toBe(true);
  });

  it('is gone once the dissolve lets it go, through the Q&A to the end', () => {
    expect(towerStands(at(inDissolve(3.3)))).toBe(false);
    expect(towerStands(at(3))).toBe(false);
    expect(towerStands(at(6))).toBe(false);
  });
});
