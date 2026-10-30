import { describe, expect, it } from 'vitest';
import { NAME_OFFSET, nameLine, nameOffset } from '~/ui/nameLine';

describe("nameLine: a project's name on the world, on a thin line from its object", () => {
  it('runs up and out to an elbow, then level to the words, which stand over the level run', () => {
    const l = nameLine({ x: 500, y: 400 }, [-190, -78], 80, { width: 1440, height: 900 });
    expect(l.points).toEqual([
      [500, 400],
      [500 - 190 * 0.22, 322],
      [310, 322]
    ]);
    expect(l.text).toEqual({ left: 310, top: 322 });
    const r = nameLine({ x: 900, y: 400 }, [190, -78], 80, { width: 1440, height: 900 });
    expect(r.points[2]).toEqual([1090, 322]);
    expect(r.text).toEqual({ right: 1440 - 1090, top: 322 });
  });

  it('keeps the name on the screen, pulling its rule in toward the object', () => {
    const l = nameLine({ x: 100, y: 400 }, [-190, -78], 80, { width: 390, height: 844 });
    expect(l.points[2]![0]).toBe(12);
    expect(l.points[1]![0]).toBe(12 + 80 + 6);
    expect(l.text.left).toBe(12);
    const r = nameLine({ x: 380, y: 400 }, [190, -78], 80, { width: 390, height: 844 });
    expect(r.points[2]![0]).toBe(378);
    expect(r.points[1]![0]).toBe(378 - 80 - 6);
    expect(r.text.right).toBe(12);
  });

  // With the tower 25% nearer (Bob, 2026-10-30) an object can stand near the edge its name runs back from: an app's name,
  // out to the left, from an object at a phone's right edge, a website's, out to the right, from one at its left edge.
  it('keeps the words wholly on the screen when the object stands near the edge they run back from', () => {
    const phone = { width: 390, height: 844 };
    const l = nameLine({ x: 380, y: 400 }, [-80, -50], 113, phone);
    expect(l.text.left!).toBeGreaterThanOrEqual(12);
    expect(l.text.left! + 113).toBeLessThanOrEqual(390 - 12);
    const r = nameLine({ x: 10, y: 400 }, [80, -50], 113, phone);
    expect(390 - r.text.right! - 113).toBeGreaterThanOrEqual(12);
    expect(390 - r.text.right!).toBeLessThanOrEqual(390 - 12);
    // The line still ends where the words are.
    expect(l.points[2]![0]).toBe(l.text.left);
    expect(r.points[2]![0]).toBe(390 - r.text.right!);
  });

  it("scales its reach by the screen's width, and a little more on a phone", () => {
    expect(NAME_OFFSET).toEqual({ 'app': [-190, -78], 'website': [190, -78], game: [170, -70] });
    expect(nameOffset('app', 1440)).toEqual([-190, -78]);
    expect(nameOffset('website', 2000)).toEqual([190, -78]); // never more than at 1440
    expect(nameOffset('app', 720)).toEqual([-95, -39]);
    const phone = nameOffset('game', 390);
    expect(phone[0]).toBeCloseTo((170 * 390 * 1.45) / 1440, 9);
  });
});
