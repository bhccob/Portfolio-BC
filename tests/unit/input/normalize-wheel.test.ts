import { describe, expect, it } from 'vitest';
import { LINE_PX, MAX_EVENT_PX, normalizeWheel } from '../../../src/input/normalizeWheel';

describe('normalizeWheel', () => {
  it('has the constants the scroll is tuned with', () => {
    expect(LINE_PX).toBe(16);
    expect(MAX_EVENT_PX).toBe(240);
  });

  it('turns lines into pixels', () => {
    expect(normalizeWheel({ deltaY: 3, deltaMode: 1 }, 800)).toEqual({ px: 48, device: 'mouse' });
  });

  it('turns pages into viewport heights', () => {
    expect(normalizeWheel({ deltaY: 0.25, deltaMode: 2 }, 800)).toEqual({ px: 200, device: 'mouse' });
  });

  it('takes a notch of a mouse wheel (a whole number, 50 px or more) for a mouse', () => {
    expect(normalizeWheel({ deltaY: 100, deltaMode: 0 }, 800)).toEqual({ px: 100, device: 'mouse' });
    expect(normalizeWheel({ deltaY: -100, deltaMode: 0 }, 800)).toEqual({ px: -100, device: 'mouse' });
    expect(normalizeWheel({ deltaY: 50, deltaMode: 0 }, 800).device).toBe('mouse');
  });

  it('takes small or fractional pixel steps for a trackpad', () => {
    expect(normalizeWheel({ deltaY: 4.5, deltaMode: 0 }, 800)).toEqual({ px: 4.5, device: 'trackpad' });
    expect(normalizeWheel({ deltaY: 4, deltaMode: 0 }, 800).device).toBe('trackpad');
    expect(normalizeWheel({ deltaY: 120.5, deltaMode: 0 }, 800).device).toBe('trackpad');
  });

  it('clamps one event to MAX_EVENT_PX either way', () => {
    expect(normalizeWheel({ deltaY: 1, deltaMode: 2 }, 800).px).toBe(240);
    expect(normalizeWheel({ deltaY: -1, deltaMode: 2 }, 800).px).toBe(-240);
    expect(normalizeWheel({ deltaY: 900, deltaMode: 0 }, 800).px).toBe(240);
  });

  it('never gives a negative zero', () => {
    expect(Object.is(normalizeWheel({ deltaY: -0, deltaMode: 0 }, 800).px, 0)).toBe(true);
  });

  it('keeps a trackpad gesture and a mouse notch of the same order of magnitude', () => {
    let gesture = 0;
    for (let i = 0; i < 30; i++) gesture += normalizeWheel({ deltaY: 4, deltaMode: 0 }, 800).px;
    const notch = normalizeWheel({ deltaY: 100, deltaMode: 0 }, 800).px;
    expect(gesture).toBe(120);
    expect(notch).toBe(100);
    expect(gesture / notch).toBeGreaterThan(0.5);
    expect(gesture / notch).toBeLessThan(2);
  });
});
