import { describe, expect, it } from 'vitest';
import { GESTURE_GAP_MS, GestureGroup } from '../../../src/input/gesture';

describe('GestureGroup', () => {
  it('waits a quarter of a second of quiet between gestures', () => {
    expect(GESTURE_GAP_MS).toBe(250);
  });

  it('starts a gesture on the first event', () => {
    expect(new GestureGroup().begins(1000)).toBe(true);
  });

  it('keeps one trackpad gesture, many events 16 ms apart, as one', () => {
    const group = new GestureGroup();
    let begun = 0;
    for (let t = 1000; t < 3000; t += 16) if (group.begins(t)) begun++;
    expect(begun).toBe(1);
  });

  it('starts another after a quiet gap of 250 ms, but not after a shorter one', () => {
    const group = new GestureGroup();
    expect(group.begins(0)).toBe(true);
    expect(group.begins(249)).toBe(false);
    expect(group.begins(249 + 249)).toBe(false); // the gap is counted from the last event, not from the start
    expect(group.begins(249 + 249 + 250)).toBe(true);
  });

  it('counts a mouse wheel notched a second apart as a gesture a notch', () => {
    const group = new GestureGroup();
    expect([0, 1000, 2000].map((t) => group.begins(t))).toEqual([true, true, true]);
  });

  it('starts a gesture when the clock goes backwards', () => {
    const group = new GestureGroup();
    group.begins(5000);
    expect(group.begins(10)).toBe(true);
  });

  it('can be told to forget', () => {
    const group = new GestureGroup();
    group.begins(0);
    group.reset();
    expect(group.begins(10)).toBe(true);
  });
});
