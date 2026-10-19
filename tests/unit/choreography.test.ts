import { describe, expect, it } from 'vitest';
import { SECTIONS, compassPoseAt, locate, tipLimit, visibleHome } from '../../src/scripts/three/Choreography';
const total = SECTIONS.reduce((s, x) => s + x.length, 0);
const boundaries = SECTIONS.slice(0, -1).map((_, k) => SECTIONS.slice(0, k + 1).reduce((s, x) => s + x.length, 0) / total);
describe('compass choreography', () => {
  it('tiles the sections in order', () => {
    expect(SECTIONS.map((s) => `${s.id}:${s.length}`)).toEqual(['hero:100', 'about:100', 'china:100', 'aruba:100', 'rotterdam:150']);
    expect(locate(0)).toEqual({ id: 'hero', local: 0 }); expect(locate(1)).toEqual({ id: 'rotterdam', local: 1 });
    expect(locate(Number.NaN)).toEqual(locate(0)); expect(locate(-3)).toEqual(locate(0)); expect(locate(9)).toEqual(locate(1));
  });
  it('is continuous across every section boundary', () => {
    boundaries.forEach((b) => {
      const a = compassPoseAt(b - 1e-7); const c = compassPoseAt(b + 1e-7);
      expect(a.framing.tilt).toBeCloseTo(c.framing.tilt, 4); expect(a.framing.zoom).toBeCloseTo(c.framing.zoom, 4);
      expect(a.needle.weight).toBeCloseTo(c.needle.weight, 4); expect(a.needle.lift).toBeCloseTo(c.needle.lift, 4);
      expect(a.portrait).toBeCloseTo(c.portrait, 4); expect(a.threads).toBeCloseTo(c.threads, 4);
      expect(visibleHome(a)).toBe(visibleHome(c));
    });
  });
  it('shows each home where its section settles, and the portrait from the pool on', () => {
    const at = (id: string, local: number) => { const start = SECTIONS.slice(0, SECTIONS.findIndex((s) => s.id === id)).reduce((s, x) => s + x.length, 0);
      return compassPoseAt((start + local * SECTIONS.find((s) => s.id === id)!.length) / total); };
    expect(visibleHome(at('hero', 0.5))).toBe('plain'); expect(visibleHome(at('china', 1))).toBe('china');
    expect(visibleHome(at('aruba', 1))).toBe('aruba'); expect(visibleHome(at('rotterdam', 1))).toBe('rotterdam');
    expect(at('about', 1).portrait).toBe(1); expect(at('about', 1).framing.zoom).toBeCloseTo(3.8);
    expect(at('aruba', 0.2).needle.bearing).toBeGreaterThan(90); expect(at('aruba', 0.2).needle.bearing).toBeLessThan(270);
    expect(at('rotterdam', 1).needle.weight).toBe(0);
  });
  it('keeps one section\'s text at a time', () => {
    for (let i = 0; i <= 1000; i++) { const t = compassPoseAt(i / 1000).text; expect(Object.values(t).filter((v) => v > 0).length).toBeLessThanOrEqual(1); }
  });
  it('never lets tilt, lean and tip pass 35 degrees', () => {
    expect(tipLimit(22)).toBeCloseTo((8 * Math.PI) / 180); expect(tipLimit(40)).toBe(0);
  });
});

describe('compass choreography, ramp by ramp', () => {
  const at = (id: string, local: number) => { const start = SECTIONS.slice(0, SECTIONS.findIndex((s) => s.id === id)).reduce((s, x) => s + x.length, 0);
    return compassPoseAt((start + local * SECTIONS.find((s) => s.id === id)!.length) / total); };
  it('eases the dive in the about section and holds it after the ramp', () => {
    const half = at('about', 0.225);
    expect(half.framing.tilt).toBeCloseTo(14, 6); expect(half.framing.zoom).toBeCloseTo(2.4, 6); expect(half.framing.near).toBeCloseTo(0.075, 6);
    const held = at('about', 0.9); expect(held.framing).toEqual({ tilt: 6, zoom: 3.8, near: 0.05 });
    expect(held.needle.lift).toBe(1); expect(held.threads).toBeCloseTo(0.15, 6); expect(held.portrait).toBe(1);
  });
  it('surfaces again in china, then hands the needle to the page', () => {
    expect(at('china', 0).framing).toEqual({ tilt: 6, zoom: 3.8, near: 0.05 });
    expect(at('china', 0.3).framing).toEqual({ tilt: 18, zoom: 1, near: 0.1 });
    expect(at('china', 0.3).needle.lift).toBe(0); expect(at('china', 0.3).threads).toBe(1);
    expect(at('china', 0.2).needle.weight).toBe(0); expect(at('china', 0.45).needle.weight).toBe(1);
    expect(at('china', 0.5).pattern).toMatchObject({ from: 'plain', to: 'china', origin: 90 }); expect(at('china', 0.35).pattern.sweep).toBe(0);
  });
  it('swings the needle east to west the long way round, through south', () => {
    expect(at('aruba', 0).needle.bearing).toBe(90); expect(at('aruba', 0.2).needle.bearing).toBeCloseTo(180, 6); expect(at('aruba', 0.4).needle.bearing).toBe(270);
    expect(at('aruba', 0.1).needle.bearing).toBeGreaterThan(90); expect(at('aruba', 0.1).needle.bearing).toBeLessThan(180);
    expect(at('aruba', 0.6).pattern).toMatchObject({ from: 'china', to: 'aruba', origin: 270 }); expect(at('aruba', 0.2).pattern.sweep).toBe(0);
  });
  it('gives the needle back to the pearl in rotterdam and holds the finished view', () => {
    expect(at('rotterdam', 0).needle).toEqual({ weight: 1, bearing: 270, lift: 0 }); expect(at('rotterdam', 0.15).needle.weight).toBeCloseTo(0.5, 6);
    expect(at('rotterdam', 0.5).pattern).toMatchObject({ from: 'aruba', to: 'rotterdam', origin: 180 });
    expect(visibleHome(at('rotterdam', 0.45))).toBe('mixed'); expect(at('rotterdam', 0.7).pattern.sweep).toBe(1);
    expect(at('rotterdam', 1).framing).toEqual({ tilt: 18, zoom: 1, near: 0.1 });
  });
  it('fades each section\'s text in and out over its own ranges', () => {
    expect(at('hero', 0).text.hero).toBe(1); expect(at('hero', 0.6).text.hero).toBe(1); expect(at('hero', 0.725).text.hero).toBeCloseTo(0.5, 6); expect(at('hero', 0.9).text.hero).toBe(0);
    expect(at('about', 0.3).text.about).toBe(0); expect(at('about', 0.45).text.about).toBeCloseTo(0.5, 6); expect(at('about', 0.7).text.about).toBe(1); expect(at('about', 1).text.about).toBe(0);
    expect(at('china', 0.55).text.china).toBe(1); expect(at('aruba', 0.5).text.aruba).toBe(1); expect(at('rotterdam', 0.45).text.rotterdam).toBe(1); expect(at('rotterdam', 1).text.rotterdam).toBe(1);
  });
  it('reads out-of-range and NaN progress as the ends', () => {
    expect(compassPoseAt(Number.NaN)).toEqual(compassPoseAt(0)); expect(compassPoseAt(-1)).toEqual(compassPoseAt(0)); expect(compassPoseAt(2)).toEqual(compassPoseAt(1));
    expect(compassPoseAt(0).section).toBe('hero'); expect(compassPoseAt(1).section).toBe('rotterdam');
  });
});
