import { describe, expect, it } from 'vitest';
import { SECTIONS, compassPoseAt, locate, nominalSpans, poseAt, spansFromOffsets, tipLimit, visibleHome } from '../../src/scripts/three/Choreography';
import { DRIVE, TRACKS } from '../../src/scripts/three/instrument/drive';
const NUMERIC = (p: ReturnType<typeof poseAt>) => [p.framing.tilt, p.framing.zoom, p.framing.near, p.framing.side, p.needle.weight, p.needle.lift,
  p.portrait, p.threads, p.wire.show, p.wire.lift, p.wire.wind, ...Object.values(p.drive), p.head, p.park, p.platter, ...Object.values(p.tracks.lit), p.dim];
const boundaries = nominalSpans().slice(1).map((s) => s.start);
describe('compass choreography', () => {
  it('tiles the sections in order', () => {
    expect(locate(0)).toEqual({ id: 'hero', local: 0 }); expect(locate(1)).toEqual({ id: 'hello', local: 1 });
    expect(locate(Number.NaN)).toEqual(locate(0)); expect(locate(-3)).toEqual(locate(0)); expect(locate(9)).toEqual(locate(1));
    expect(nominalSpans().map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
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
    const at = poseAt;
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
  const at = poseAt;
  it('eases the dive in the about section and holds it after the ramp', () => {
    const half = at('about', 0.225);
    expect(half.framing.tilt).toBeCloseTo(14, 6); expect(half.framing.zoom).toBeCloseTo(2.4, 6); expect(half.framing.near).toBeCloseTo(0.075, 6);
    const held = at('about', 0.9); expect(held.framing).toEqual({ tilt: 6, zoom: 3.8, near: 0.05, side: 0 });
    expect(held.needle.lift).toBe(1); expect(held.threads).toBeCloseTo(0.15, 6); expect(held.portrait).toBe(1);
  });
  it('surfaces again in china, then hands the needle to the page', () => {
    expect(at('china', 0).framing).toEqual({ tilt: 6, zoom: 3.8, near: 0.05, side: 0 });
    expect(at('china', 0.3).framing).toEqual({ tilt: 18, zoom: 1, near: 0.1, side: 0 });
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
    expect(at('rotterdam', 1).framing).toEqual({ tilt: 18, zoom: 1, near: 0.1, side: 0 });
  });
  it('fades each section\'s text in and out over its own ranges', () => {
    expect(at('hero', 0).text.hero).toBe(1); expect(at('hero', 0.6).text.hero).toBe(1); expect(at('hero', 0.725).text.hero).toBeCloseTo(0.5, 6); expect(at('hero', 0.9).text.hero).toBe(0);
    expect(at('about', 0.3).text.about).toBe(0); expect(at('about', 0.45).text.about).toBeCloseTo(0.5, 6); expect(at('about', 0.7).text.about).toBe(1); expect(at('about', 1).text.about).toBe(0);
    expect(at('china', 0.55).text.china).toBe(1); expect(at('aruba', 0.5).text.aruba).toBe(1); expect(at('rotterdam', 0.45).text.rotterdam).toBe(1);
    // It fades out like the others, so it does not hard-cut when the current's section takes over.
    expect(at('rotterdam', 0.925).text.rotterdam).toBeCloseTo(0.5, 6); expect(at('rotterdam', 1).text.rotterdam).toBe(0);
  });
  it('reads out-of-range and NaN progress as the ends', () => {
    expect(compassPoseAt(Number.NaN)).toEqual(compassPoseAt(0)); expect(compassPoseAt(-1)).toEqual(compassPoseAt(0)); expect(compassPoseAt(2)).toEqual(compassPoseAt(1));
    expect(compassPoseAt(0).section).toBe('hero'); expect(compassPoseAt(1).section).toBe('hello');
  });
});

describe('the whole story', () => {
  it('lists the sections in order with their lengths', () => {
    expect(SECTIONS.map((s) => `${s.id}:${s.length}`)).toEqual(['hero:100', 'about:100', 'china:100', 'aruba:100', 'rotterdam:150', 'current:100', 'stack:100', 'ai:100',
      'change:200', 'funcial:150', 'jontai-energy:150', 'cookies-clicker:150', 'next:100', 'offduty:150', 'qa:null', 'hello:150']);
  });
  it('is continuous across every boundary, every numeric field', () => {
    for (let k = 1; k < SECTIONS.length; k++) {
      const a = poseAt(SECTIONS[k - 1].id, 1); const b = poseAt(SECTIONS[k].id, 0);
      NUMERIC(a).forEach((v, i) => expect(v).toBeCloseTo(NUMERIC(b)[i], 6));
      // The bearing only matters where the page scripts the needle (weight > 0).
      if (a.needle.weight > 0 && b.needle.weight > 0) expect(((a.needle.bearing % 360) + 360) % 360).toBeCloseTo(((b.needle.bearing % 360) + 360) % 360, 6);
      expect(visibleHome(a)).toBe(visibleHome(b));
    }
  });
  it('forms the drive in the change and folds it back at hello', () => {
    expect(Object.values(poseAt('change', 1).drive).every((v) => v === 1)).toBe(true);
    expect(Object.values(poseAt('hello', 1).drive).every((v) => v === 0)).toBe(true);
    expect(poseAt('hello', 1).platter % 360).toBe(0); expect(poseAt('hello', 1).portrait).toBe(1);
  });
  it('turns each track under the head one test point at a time', () => {
    expect(poseAt('funcial', 0.3).tracks.tp).toBe(0); expect(poseAt('funcial', 0.45).tracks.tp).toBe(1);
    expect(poseAt('funcial', 0.6).tracks.tp).toBe(2); expect(poseAt('funcial', 0.75).tracks.tp).toBe(3);
    expect(poseAt('funcial', 0.36).tracks.tp).toBeNull();
    expect(poseAt('funcial', 0.75).platter).toBeCloseTo(270); expect(poseAt('jontai-energy', 0.3).head).toBeCloseTo(DRIVE.tracks['jontai-energy']);
    expect(poseAt('cookies-clicker', 0.3).tracks.current).toBe('cookies-clicker');
  });
  it('lets the tracks answer the pointer only in the track sections', () => {
    for (const s of SECTIONS) for (const local of [0, 0.5, 1]) {
      expect(poseAt(s.id, local).interactive).toBe((TRACKS as readonly string[]).includes(s.id));
    }
  });
  it('maps measured offsets to spans that tile the scroll, and a taller Q&A moves only what follows it', () => {
    const tops = (qa: number) => { let y = 0; return SECTIONS.map((s) => { const t = { id: s.id, top: y }; y += (s.length ?? qa) * 9; return t; }); };
    const a = spansFromOffsets(tops(100), 20000); const b = spansFromOffsets(tops(300), 21800);
    expect(a[0].start).toBe(0); expect(a.at(-1)!.start + a.at(-1)!.length).toBeCloseTo(1);
    const qa = a.findIndex((s) => s.id === 'qa');
    for (let k = 0; k <= qa; k++) expect(b[k].start * 21800).toBeCloseTo(a[k].start * 20000, 3);
    expect(spansFromOffsets([{ id: 'hero', top: 0 }], 0)[0].length).toBeGreaterThan(0);
  });
  it('divides the last section by the same guarded scroll range as every start', () => {
    expect(spansFromOffsets([{ id: 'hero', top: 0 }], 0)).toEqual([{ id: 'hero', start: 0, length: 1 }]);
    expect(spansFromOffsets([{ id: 'hero', top: 0 }, { id: 'about', top: 3 }], 0)[1].start).toBeCloseTo(3e6, 0);
  });
  it('keeps the pose a pure function of position', () => {
    const spans = nominalSpans(); const p = spans.find((s) => s.id === 'cookies-clicker')!;
    expect(compassPoseAt(p.start + p.length * 0.3, spans)).toEqual(poseAt('cookies-clicker', locate(p.start + p.length * 0.3, spans).local));
  });
});

describe('the spans', () => {
  it('tile the whole scroll from the SECTIONS lengths, the Q&A as tall as it is asked to be', () => {
    const spans = nominalSpans();
    expect(spans.length).toBe(SECTIONS.length); expect(spans[0].start).toBe(0);
    for (let k = 1; k < spans.length; k++) expect(spans[k].start).toBeCloseTo(spans[k - 1].start + spans[k - 1].length, 12);
    expect(spans.at(-1)!.start + spans.at(-1)!.length).toBeCloseTo(1, 12);
    const total = SECTIONS.reduce((sum, s) => sum + (s.length ?? 100), 0);
    expect(spans.find((s) => s.id === 'hero')!.length).toBeCloseTo(100 / total, 12); expect(spans.find((s) => s.id === 'qa')!.length).toBeCloseTo(100 / total, 12);
    const tall = nominalSpans(300); const grown = total + 200;
    expect(tall.find((s) => s.id === 'qa')!.length).toBeCloseTo(300 / grown, 12); expect(tall.find((s) => s.id === 'hello')!.length).toBeCloseTo(150 / grown, 12);
  });
  it('are measured from tops in the order given, the last running to the end of the scroll', () => {
    const spans = spansFromOffsets([{ id: 'hero', top: 0 }, { id: 'about', top: 900 }, { id: 'china', top: 2000 }], 4000);
    expect(spans).toEqual([{ id: 'hero', start: 0, length: 0.225 }, { id: 'about', start: 0.225, length: 0.275 }, { id: 'china', start: 0.5, length: 0.5 }]);
  });
  it('never give a section no length, whatever was measured', () => {
    const odd = spansFromOffsets([{ id: 'hero', top: 100 }, { id: 'about', top: 100 }, { id: 'china', top: 50 }], -5);
    for (const s of odd) { expect(s.length).toBeGreaterThan(0); expect(Number.isFinite(s.start)).toBe(true); expect(Number.isFinite(s.length)).toBe(true); }
    expect(spansFromOffsets([{ id: 'hero', top: 0 }, { id: 'about', top: 10 }], Number.NaN).every((s) => s.length > 0)).toBe(true);
    expect(spansFromOffsets([], 100)).toEqual([]);
  });
  it('locate the section by the measured starts, and every pose follows', () => {
    const spans = spansFromOffsets([{ id: 'hero', top: 0 }, { id: 'about', top: 300 }, { id: 'hello', top: 700 }], 1000);
    expect(locate(0.25, spans).id).toBe('hero'); expect(locate(0.25, spans).local).toBeCloseTo(0.25 / 0.3, 9);
    expect(locate(0.3, spans)).toEqual({ id: 'about', local: 0 });
    expect(locate(0.5, spans).id).toBe('about'); expect(locate(0.5, spans).local).toBeCloseTo(0.5, 9); expect(locate(1, spans)).toEqual({ id: 'hello', local: 1 });
    expect(locate(0.7, spans)).toEqual({ id: 'hello', local: 0 }); expect(locate(Number.NaN, spans)).toEqual({ id: 'hero', local: 0 });
    expect(compassPoseAt(0.5, spans)).toEqual(poseAt('about', locate(0.5, spans).local));
  });
  it('end the page exactly on the last section\'s bottom', () => {
    for (const spans of [nominalSpans(), nominalSpans(237), spansFromOffsets(SECTIONS.map((s, k) => ({ id: s.id, top: k * 913.7 })), 16 * 913.7 + 77)]) {
      expect(locate(1, spans)).toEqual({ id: 'hello', local: 1 });
    }
  });
});

describe('the new sections, ramp by ramp', () => {
  it('leaves the new fields at their defaults through the milestone 3 sections', () => {
    for (const id of ['hero', 'about', 'china', 'aruba', 'rotterdam'] as const) for (const local of [0, 0.4, 1]) {
      const p = poseAt(id, local);
      expect(p.wire).toEqual({ show: 0, lift: 0, wind: 0, pulse: -1 }); expect(Object.values(p.drive).every((v) => v === 0)).toBe(true);
      expect(p.head).toBe(DRIVE.tracks.funcial); expect(p.park).toBe(0); expect(p.platter).toBe(0); expect(p.dim).toBe(0); expect(p.interactive).toBe(false);
      expect(p.tracks).toEqual({ lit: { funcial: 0, 'jontai-energy': 0, 'cookies-clicker': 0, next: 0 }, tp: null, current: null }); expect(p.framing.side).toBe(0);
    }
  });
  it('lays Ørsted\'s wire over the needle in the current, then swings it in the stack and the ai', () => {
    expect(poseAt('current', 0)).toMatchObject({ framing: { tilt: 18, zoom: 1, near: 0.1, side: 0 }, pattern: { from: 'rotterdam', to: 'rotterdam', sweep: 1, origin: 180 }, portrait: 1, threads: 1 });
    expect(poseAt('current', 0.2).framing.tilt).toBeCloseTo(18 + 6 * 0.5, 6);
    expect(poseAt('current', 0.4).framing).toEqual({ tilt: 24, zoom: 1.1, near: 0.1, side: 0 });
    expect(poseAt('current', 0.05).wire.show).toBe(0.5); expect(poseAt('current', 0.1).wire.show).toBe(1); expect(poseAt('current', 0.1).wire.lift).toBe(0); expect(poseAt('current', 0.6).wire.lift).toBe(1);
    expect(poseAt('current', 0.175).needle.weight).toBeCloseTo(0.5, 6); expect(poseAt('current', 0.3).needle.weight).toBe(1); expect(poseAt('current', 1).needle.bearing).toBe(0);
    expect(poseAt('current', 0.525).text.current).toBeCloseTo(0.5, 6); expect(poseAt('current', 0.7).text.current).toBe(1); expect(poseAt('current', 1).text.current).toBe(0);
    for (const id of ['stack', 'ai'] as const) {
      expect(poseAt(id, 0.5).wire).toMatchObject({ show: 1, lift: 1, wind: 0 }); expect(poseAt(id, 0.5).wire.pulse).toBeCloseTo(0.8, 6);
      expect(poseAt(id, 0.1).wire.pulse).toBeCloseTo(0, 6); expect(poseAt(id, 0.6).wire.pulse).toBeCloseTo(1, 6);
      expect(poseAt(id, 0.09).wire.pulse).toBe(-1); expect(poseAt(id, 0.61).wire.pulse).toBe(-1); expect(poseAt(id, 0).wire.pulse).toBe(-1); expect(poseAt(id, 1).wire.pulse).toBe(-1);
      expect(poseAt(id, 0.25).text[id]).toBeCloseTo(0, 6); expect(poseAt(id, 0.4).text[id]).toBe(1); expect(poseAt(id, 0.925).text[id]).toBeCloseTo(0.5, 6);
    }
    expect(poseAt('stack', 0.35).needle.bearing).toBe(72); expect(poseAt('stack', 0.5).needle.bearing).toBe(72); expect(poseAt('stack', 0.85).needle.bearing).toBe(0);
    expect(poseAt('stack', 0.5).needle.weight).toBe(1); expect(poseAt('stack', 0.725).needle.weight).toBeCloseTo(0.8, 6); expect(poseAt('stack', 0.85).needle.weight).toBe(0.6);
    expect(poseAt('ai', 0.35).needle.bearing).toBe(-72); expect(poseAt('ai', 0.25).needle.bearing).toBeCloseTo(-36, 6); expect(poseAt('ai', 0.85).needle.bearing).toBe(0);
    expect(poseAt('ai', 0).needle.weight).toBe(0.6); expect(poseAt('ai', 0.1).needle.weight).toBe(1); expect(poseAt('ai', 0.85).needle.weight).toBe(0.6);
    expect(poseAt('ai', 0.5).framing).toEqual({ tilt: 24, zoom: 1.1, near: 0.1, side: 0 });
  });
  it('never wraps a bearing in the choreography', () => {
    for (let i = 0; i <= 100; i++) { const b = poseAt('ai', i / 100).needle.bearing; expect(b).toBeGreaterThanOrEqual(-72); expect(b).toBeLessThanOrEqual(0); }
  });
  it('winds the wire and forms the drive part by part in the change', () => {
    const d = (local: number) => poseAt('change', local).drive;
    expect(d(0)).toEqual({ stack: 0, mirror: 0, grow: 0, clamp: 0, arm: 0, chassis: 0 });
    expect(d(0.05).stack).toBe(0); expect(d(0.175).stack).toBeCloseTo(0.5, 6); expect(d(0.3).stack).toBe(1);
    expect(d(0.15).mirror).toBe(0); expect(d(0.5).mirror).toBe(1); expect(d(0.45).grow).toBe(0); expect(d(0.75).grow).toBe(1);
    expect(d(0.4).clamp).toBe(0); expect(d(0.7).clamp).toBe(1); expect(d(0.3).arm).toBe(0); expect(d(0.8).arm).toBe(1); expect(d(0.55).chassis).toBe(0); expect(d(0.9).chassis).toBe(1);
    expect(poseAt('change', 0.35).wire).toEqual({ show: 1, lift: 1, wind: 1, pulse: -1 }); expect(poseAt('change', 0.175).wire.wind).toBeCloseTo(0.5, 6);
    expect(poseAt('change', 0.3).framing.tilt).toBeCloseTo(24 + 4 * 0.5, 6); expect(poseAt('change', 0.6).framing).toEqual({ tilt: 28, zoom: 0.92, near: 0.1, side: 0 });
    expect(poseAt('change', 0.1).threads).toBeCloseTo(0.5, 6); expect(poseAt('change', 0.2).threads).toBe(0); expect(poseAt('change', 0.125).portrait).toBeCloseTo(0.5, 6); expect(poseAt('change', 0.25).portrait).toBe(0);
    expect(poseAt('change', 0.05).needle.weight).toBeCloseTo(0.8, 6); expect(poseAt('change', 0.1).needle.weight).toBe(1);
    expect(poseAt('change', 0.9).tracks.lit.funcial).toBeCloseTo(0.15, 6); expect(poseAt('change', 1).tracks.lit).toEqual({ funcial: 0.3, 'jontai-energy': 0.3, 'cookies-clicker': 0.3, next: 0.3 });
    expect(poseAt('change', 0.425).text.change).toBeCloseTo(0.5, 6); expect(poseAt('change', 0.6).text.change).toBe(1); expect(poseAt('change', 1).text.change).toBe(0);
  });
  it('steps the arm from track to track and lights the one under the head', () => {
    expect(poseAt('funcial', 0).framing).toEqual({ tilt: 28, zoom: 0.92, near: 0.1, side: 0 }); expect(poseAt('funcial', 0.25).framing).toEqual({ tilt: 26, zoom: 1.15, near: 0.1, side: 0 });
    expect(poseAt('jontai-energy', 0).framing).toEqual({ tilt: 26, zoom: 1.15, near: 0.1, side: 0 });
    expect(poseAt('funcial', 0.1).head).toBe(DRIVE.tracks.funcial);
    expect(poseAt('jontai-energy', 0).head).toBe(DRIVE.tracks.funcial); expect(poseAt('jontai-energy', 0.125).head).toBeCloseTo((DRIVE.tracks.funcial + DRIVE.tracks['jontai-energy']) / 2, 6);
    expect(poseAt('cookies-clicker', 0.125).head).toBeCloseTo((DRIVE.tracks['jontai-energy'] + DRIVE.tracks['cookies-clicker']) / 2, 6);
    expect(poseAt('next', 0.15).head).toBeCloseTo((DRIVE.tracks['cookies-clicker'] + DRIVE.tracks.next) / 2, 6); expect(poseAt('next', 0.3).head).toBe(DRIVE.tracks.next);
    expect(poseAt('jontai-energy', 0.2).platter).toBe(360); expect(poseAt('jontai-energy', 0.75).platter).toBeCloseTo(630, 6); expect(poseAt('cookies-clicker', 1).platter).toBeCloseTo(1080, 6);
    expect(poseAt('next', 0).platter).toBe(1080); expect(poseAt('next', 0.65).platter).toBeCloseTo(1260, 6); expect(poseAt('next', 1).platter).toBe(1440);
    expect(poseAt('funcial', 0.25).tracks.tp).toBe(0); expect(poseAt('funcial', 0.33).tracks.tp).toBeNull(); expect(poseAt('funcial', 0.4).tracks.tp).toBe(1); expect(poseAt('funcial', 0.48).tracks.tp).toBeNull();
    expect(poseAt('funcial', 0.7).tracks.tp).toBe(3); expect(poseAt('funcial', 0.8).tracks.tp).toBeNull(); expect(poseAt('funcial', 0.1).tracks.tp).toBeNull();
    for (const local of [0, 0.3, 0.6, 1]) expect(poseAt('next', local).tracks.tp).toBeNull();
    expect(poseAt('funcial', 0.1).tracks.lit.funcial).toBeCloseTo(0.3, 6); expect(poseAt('funcial', 0.25).tracks.lit.funcial).toBe(1); expect(poseAt('funcial', 0.175).tracks.lit.funcial).toBeCloseTo(0.65, 6);
    expect(poseAt('jontai-energy', 0.15).tracks.lit.funcial).toBeCloseTo(0.3, 6); expect(poseAt('jontai-energy', 0).tracks.lit.funcial).toBe(1); expect(poseAt('jontai-energy', 0.075).tracks.lit.funcial).toBeCloseTo(0.65, 6);
    expect(poseAt('jontai-energy', 0.5).tracks.lit).toEqual({ funcial: 0.3, 'jontai-energy': 1, 'cookies-clicker': 0.3, next: 0.3 });
    expect(poseAt('next', 0.1).tracks.lit.next).toBeCloseTo(0.3, 6); expect(poseAt('next', 0.3).tracks.lit.next).toBe(1); expect(poseAt('next', 0.15).tracks.lit['cookies-clicker']).toBeCloseTo(0.3, 6);
    expect(poseAt('next', 0.5).tracks.current).toBe('next'); expect(poseAt('funcial', 0.5).tracks.current).toBe('funcial');
    expect(poseAt('funcial', 0.325).text.funcial).toBeCloseTo(0.5, 6); expect(poseAt('next', 0.375).text.next).toBeCloseTo(0.5, 6); expect(poseAt('next', 0.5).text.next).toBe(1); expect(poseAt('next', 1).text.next).toBe(0);
    for (const id of TRACKS) { const p = poseAt(id, 0.5); expect(Object.values(p.drive).every((v) => v === 1)).toBe(true); expect(p.wire).toEqual({ show: 1, lift: 1, wind: 1, pulse: -1 }); expect(p.threads).toBe(0); expect(p.portrait).toBe(0); }
  });
  it('parks the arm, spins the platter down the spindle and dims the drive in off duty', () => {
    expect(poseAt('offduty', 0).tracks.current).toBeNull(); expect(poseAt('offduty', 0).head).toBe(DRIVE.tracks.next);
    expect(poseAt('offduty', 0.15).park).toBeCloseTo(0.5, 6); expect(poseAt('offduty', 0.3).park).toBe(1);
    expect(poseAt('offduty', 0).platter).toBe(1440); expect(poseAt('offduty', 0.5).platter).toBeCloseTo(1980, 6); expect(poseAt('offduty', 1).platter).toBeCloseTo(2520, 6);
    expect(poseAt('offduty', 0.1).tracks.lit.next).toBeCloseTo(0.65, 6); expect(poseAt('offduty', 0.2).tracks.lit.next).toBeCloseTo(0.3, 6);
    expect(poseAt('offduty', 0).framing).toEqual({ tilt: 26, zoom: 1.15, near: 0.1, side: 0 });
    expect(poseAt('offduty', 0.275).framing.zoom).toBeCloseTo((1.15 + 2.6) / 2, 6); expect(poseAt('offduty', 0.45).framing).toEqual({ tilt: 30, zoom: 2.6, near: 0.05, side: 0 });
    expect(poseAt('offduty', 0.85).framing).toEqual({ tilt: 30, zoom: 2.6, near: 0.05, side: 0 });
    expect(poseAt('offduty', 0.925).framing.side).toBeCloseTo(0.5, 6); expect(poseAt('offduty', 1).framing).toEqual({ tilt: 22, zoom: 1, near: 0.1, side: 1 });
    expect(poseAt('offduty', 0.925).dim).toBeCloseTo(0.5, 6); expect(poseAt('offduty', 1).dim).toBe(1); expect(poseAt('offduty', 0.5).dim).toBe(0);
    expect(poseAt('offduty', 0.475).text.offduty).toBeCloseTo(0.5, 6); expect(poseAt('offduty', 0.7).text.offduty).toBe(1); expect(poseAt('offduty', 0.85).text.offduty).toBeCloseTo(0.5, 6); expect(poseAt('offduty', 0.9).text.offduty).toBe(0);
    expect(poseAt('offduty', 0.5).interactive).toBe(false);
  });
  it('holds the Q&A beside the small, dimmed drive with its text up throughout', () => {
    for (const local of [0, 0.5, 1]) {
      const p = poseAt('qa', local);
      expect(p).toMatchObject({ framing: { tilt: 22, zoom: 1, near: 0.1, side: 1 }, park: 1, platter: 2520, dim: 1, head: DRIVE.tracks.next, interactive: false, wire: { show: 1, lift: 1, wind: 1, pulse: -1 } });
      expect(p.tracks).toEqual({ lit: { funcial: 0.3, 'jontai-energy': 0.3, 'cookies-clicker': 0.3, next: 0.3 }, tp: null, current: null });
      expect(Object.values(p.drive).every((v) => v === 1)).toBe(true); expect(p.text.qa).toBe(1); expect(p.needle).toEqual({ weight: 1, bearing: 0, lift: 0 });
    }
  });
  it('folds the drive back into the compass from where the arm parked at hello', () => {
    const h = (local: number) => poseAt('hello', local);
    expect(h(0.175).framing.side).toBeCloseTo(0.5, 6); expect(h(0.35).framing).toEqual({ tilt: 22, zoom: 1, near: 0.1, side: 0 }); expect(h(0.175).dim).toBeCloseTo(0.5, 6); expect(h(0.35).dim).toBe(0);
    expect(h(0.125).wire.show).toBeCloseTo(0.5, 6); expect(h(0.25).wire).toEqual({ show: 0, lift: 1, wind: 1, pulse: -1 }); expect(h(0.075).park).toBeCloseTo(0.5, 6); expect(h(0.15).park).toBe(0);
    expect(h(0.2).drive.chassis).toBeCloseTo(0.5, 6); expect(h(0.35).drive.chassis).toBe(0); expect(h(0.55).drive.arm).toBe(0); expect(h(0.45).drive.grow).toBe(0); expect(h(0.5).drive.clamp).toBe(0);
    expect(h(0.7).drive.mirror).toBe(0); expect(h(0.8).drive.stack).toBe(0); expect(h(0.5).drive.mirror).toBeGreaterThan(0); expect(h(0.7).drive.stack).toBeGreaterThan(0);
    // The parts let go in the reverse of the order they formed: the chassis first, the stack last.
    expect(h(0.15).drive).toMatchObject({ stack: 1, mirror: 1, grow: 1, clamp: 1 }); expect(h(0.15).drive.arm).toBeLessThan(1); expect(h(0.15).drive.chassis).toBeLessThan(1);
    expect(h(0.15).tracks.lit.next).toBeCloseTo(0.15, 6); expect(h(0.3).tracks.lit.next).toBe(0);
    expect(h(0.5).needle.weight).toBe(1); expect(h(0.65).needle.weight).toBeCloseTo(0.5, 6); expect(h(0.8).needle.weight).toBe(0); expect(h(1).needle.bearing).toBe(0);
    expect(h(0.725).portrait).toBeCloseTo(0.5, 6); expect(h(0.725).threads).toBeCloseTo(0.5, 6); expect(h(0.85).portrait).toBe(1); expect(h(0.85).threads).toBe(1);
    expect(h(0.5).head).toBe(DRIVE.tracks.next); expect(h(1).platter).toBe(2520);
    expect(h(0.55).text.hello).toBe(0); expect(h(0.625).text.hello).toBeCloseTo(0.5, 6); expect(h(0.7).text.hello).toBe(1); expect(h(1).text.hello).toBe(1);
  });
  it('gives a section\'s text to that section alone', () => {
    for (const s of SECTIONS) for (const local of [0, 0.25, 0.5, 0.75, 1]) {
      const p = poseAt(s.id, local); expect(p.section).toBe(s.id); expect(p.local).toBe(local);
      for (const id of SECTIONS.map((x) => x.id)) if (id !== s.id) expect(p.text[id]).toBe(0);
    }
    expect(Object.keys(poseAt('hero', 0).text).sort()).toEqual(SECTIONS.map((s) => s.id).sort());
  });
  it('clamps a local outside 0..1 and returns a fresh pose each time', () => {
    expect(poseAt('funcial', 1.7)).toEqual(poseAt('funcial', 1)); expect(poseAt('funcial', -1)).toEqual(poseAt('funcial', 0)); expect(poseAt('funcial', Number.NaN)).toEqual(poseAt('funcial', 0));
    const p = poseAt('funcial', 0.5); p.framing.tilt = 99; p.tracks.lit.funcial = 99; p.drive.arm = 99; p.text.funcial = 99;
    const q = poseAt('funcial', 0.5); expect(q.framing.tilt).toBe(26); expect(q.tracks.lit.funcial).toBe(1); expect(q.drive.arm).toBe(1); expect(q.text.funcial).toBe(1);
  });
});
