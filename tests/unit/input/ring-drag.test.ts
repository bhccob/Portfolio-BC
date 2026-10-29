import { describe, expect, it } from 'vitest';
import { RING_DRAG_PX, ringDragOn } from '../../../src/input/ringDrag';

function fire(target: EventTarget, type: string, props: Record<string, unknown>): void {
  const event = new Event(type, { cancelable: true, bubbles: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
}

/** A pointer of `kind` pressed at x 500, moved `dx` px in ten moves, let go; what the drag was told. */
function dragBy(dx: number, kind = 'mouse', active = true): { units: number; drags: number; releases: number } {
  const target = new EventTarget();
  const told = { units: 0, drags: 0, releases: 0 };
  const stop = ringDragOn(
    target,
    {
      drag: (units) => {
        told.units += units;
        told.drags++;
      },
      release: () => {
        told.releases++;
      }
    },
    () => active
  );
  fire(target, 'pointerdown', { pointerType: kind, clientX: 500, clientY: 400, button: 0 });
  for (let i = 1; i <= 10; i++) fire(target, 'pointermove', { pointerType: kind, clientX: 500 + (dx * i) / 10, clientY: 400 });
  fire(target, 'pointerup', { pointerType: kind, clientX: 500 + dx, clientY: 400 });
  stop();
  return told;
}

// The Q&A's ring by hand (spec 2026-10-29-bob-stack-2-design.md, goal 1): "A drag turns it by hand and lets go onto the
// nearest question." The mouse only: on a touch screen a swipe is the scroll's step.
describe('ringDragOn', () => {
  it('turns by a drag and lets go onto the nearest question', () => {
    expect(RING_DRAG_PX).toBe(160);
    // To the left brings the next question round to the front, as the mock-up's ring turns under the hand.
    const left = dragBy(-RING_DRAG_PX);
    expect(left.units).toBeCloseTo(1, 9);
    expect(left.releases).toBe(1);
    expect(dragBy(RING_DRAG_PX / 2).units).toBeCloseTo(-0.5, 9);
  });

  it('is no drag for a press that hardly moves, so a click on a mark stays a click', () => {
    expect(dragBy(4)).toEqual({ units: 0, drags: 0, releases: 0 });
  });

  it('ignores a touch', () => {
    expect(dragBy(-RING_DRAG_PX, 'touch')).toEqual({ units: 0, drags: 0, releases: 0 });
  });

  it('does nothing outside the Q&A', () => {
    expect(dragBy(-RING_DRAG_PX, 'mouse', false)).toEqual({ units: 0, drags: 0, releases: 0 });
  });
});
