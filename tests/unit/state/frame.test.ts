import { describe, expect, it } from 'vitest';
import { FOCUS_AT_REST, focusLiftsAt, focusPoseAt, moveFocus } from '~/scene/bob/focus';
import { frame } from '~/state/frame';

describe("the frame's first focus move", () => {
  it('is the move at rest, whole, so the first click lifts a project with no error', () => {
    expect(frame.focus.move).toEqual(FOCUS_AT_REST);
    expect(frame.focus.move.from.leaving).toBeNull();
    // The page's first click: a move from the first one.
    const open = moveFocus(frame.focus.move, 'steady', 1000, 'fly', null);
    expect(focusPoseAt(open, 1000 + 750).amount).toBeCloseTo(0.5, 9);
    expect(focusLiftsAt(open, 1000 + 750)).toEqual({ steady: expect.closeTo(0.5, 9) });
  });
});
