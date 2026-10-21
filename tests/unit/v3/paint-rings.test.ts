import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIAL_ART } from '~/engine/instrument/dialSpec';
import { GLYPHS } from '~/engine/instrument/glyphs';
import { GLASS_RINGS } from '~/engine/v3/compassSpec';
import { paintRingStrip, RING_STRIP } from '~/engine/v3/paintRings';

function recorder() {
  const calls: Record<string, number> = {};
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : (..._: unknown[]) => { calls[k as string] = (calls[k as string] ?? 0) + 1; }),
    set: (t, k, v) => { t[k as string] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
globalThis.Path2D ??= class { constructor(public d?: string) {} } as unknown as typeof Path2D;
const ring = (id: string) => GLASS_RINGS.find((r) => r.id === id)!;
const marks = (c: Record<string, number>) => (c.fillRect ?? 0) + (c.fill ?? 0);

describe('paintRingStrip', () => {
  it('trigram ring: one fill per whole line, two per broken line (24 lines, 12 broken)', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('trigram'), 2048, 128);
    expect(marks(calls)).toBe(12 + 12 * 2);
  });
  it('direction ring: the four characters', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('direction'), 2048, 128);
    expect(calls.fill).toBe(4);
  });
  it('degree ring: 360 ticks', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('degree'), 2048, 128);
    expect(marks(calls)).toBe(360);
  });
  it('hexagram ring: 384 lines, half of them broken', () => {
    const { ctx, calls } = recorder();
    paintRingStrip(ctx, ring('hexagram'), 4096, 256);
    expect(marks(calls)).toBe(192 + 192 * 2);
  });
});

/** One mark as it is filled: its rectangles (a bar or a tick, with its wrapped copy across the seam), or the path of a character. */
interface Mark {
  rects: (readonly [x: number, y: number, w: number, h: number])[];
  path?: string;
}

/** A context that keeps what is filled and where it is placed, and a Path2D that keeps its path data. */
function tracer() {
  const marks: Mark[] = [];
  const translates: [number, number][] = [];
  const scales: [number, number][] = [];
  let open: Mark['rects'] = [];
  const methods: Record<string, (...args: never[]) => void> = {
    fillRect: ((x: number, y: number, w: number, h: number) => marks.push({ rects: [[x, y, w, h]] })) as never,
    beginPath: (() => { open = []; }) as never,
    rect: ((x: number, y: number, w: number, h: number) => { open = [...open, [x, y, w, h]]; }) as never,
    fill: ((path?: { d: string }) => {
      marks.push(path ? { rects: [], path: path.d } : { rects: open });
      open = [];
    }) as never,
    translate: ((x: number, z: number) => translates.push([x, z])) as never,
    scale: ((x: number, z: number) => scales.push([x, z])) as never,
  };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : methods[k as string] ?? (() => {})),
    set: (t, k, v) => { t[k as string] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, marks, translates, scales };
}

class RecordedPath2D { constructor(public d: string) {} }

afterEach(() => { vi.unstubAllGlobals(); });

/** The share of a rectangle's width that lies on the strip. */
const visible = (x: number, w: number, strip: number) => Math.max(0, Math.min(x + w, strip) - Math.max(x, 0));

describe('the strip layout', () => {
  const sizes = [[2048, 128], [4096, 256]] as const;

  it('has the two sizes the builders ask for', () => {
    expect(RING_STRIP).toEqual({ fine: [4096, 256], coarse: [2048, 128] });
  });

  it('paints white, and only marks: no fill covers the strip', () => {
    for (const r of GLASS_RINGS) {
      const { ctx, marks } = tracer();
      paintRingStrip(ctx, r, 2048, 128);
      expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('#ffffff');
      for (const m of marks) for (const [, , w, h] of m.rects) expect(w * h).toBeLessThan(2048 * 128 * 0.01);
    }
  });

  it('keeps every bar and tick on the strip across the ring, and loses nothing across the seam', () => {
    for (const r of GLASS_RINGS) {
      for (const [w, h] of sizes) {
        const { ctx, marks } = tracer();
        paintRingStrip(ctx, r, w, h);
        for (const m of marks.filter((mark) => mark.rects.length > 0)) {
          for (const [, y, , height] of m.rects) {
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y + height).toBeLessThanOrEqual(h + 1e-9);
          }
          // A mark that crosses the seam is one fill of the bar and its copy a turn away: together they show all of the bar.
          const [first, ...rest] = m.rects;
          expect(rest.length).toBeLessThanOrEqual(1);
          const shown = m.rects.reduce((sum, [x, , width]) => sum + visible(x, width, w), 0);
          expect(shown).toBeCloseTo(first[2], 9);
          if (rest.length === 1) expect(Math.abs(rest[0][0] - first[0])).toBeCloseTo(w, 9);
        }
      }
    }
  });

  it('places the trigrams by bearing, bottom line innermost: Zhen at east has one whole line at the bottom and two broken above', () => {
    const { ctx, marks } = tracer();
    paintRingStrip(ctx, ring('trigram'), 2048, 128);
    // East is a quarter of the way round (u = 0.25), so a quarter of the strip across; the next trigrams stand an eighth away.
    const east = marks.filter((m) => m.rects.every(([x, , w]) => Math.abs(x + w / 2 - 512) < 80));
    const rows = [...new Set(east.map((m) => m.rects[0][1]))].sort((a, b) => b - a);
    // The strip's top is the ring's outer edge, so the lowest row on the strip is the innermost line.
    expect(rows).toHaveLength(3);
    expect(east.filter((m) => m.rects[0][1] === rows[0])).toHaveLength(1);
    expect(east.filter((m) => m.rects[0][1] === rows[1])).toHaveLength(2);
    expect(east.filter((m) => m.rects[0][1] === rows[2])).toHaveLength(2);
    // Each line is a bar centred on DIAL_ART.bar.at[i], the radius the painted face and the loader's drawing centre it on (face.ts, dialSvg.ts),
    // and DIAL_ART.bar.thick deep: on the strip that is (outer - at) down from the top of the ring's depth, centre to centre.
    const { outer, inner } = ring('trigram');
    const { at, thick } = DIAL_ART.bar;
    rows.forEach((row, i) => {
      const [, y, , height] = east.find((m) => m.rects[0][1] === row)!.rects[0];
      expect(y + height / 2).toBeCloseTo(((outer - at[i]) / (outer - inner)) * 128, 9);
      expect(height).toBeCloseTo((thick / (outer - inner)) * 128, 9);
    });
    // The bottom line is whole and centred on the bearing.
    const whole = east.find((m) => m.rects[0][1] === rows[0])!.rects[0];
    expect(whole[0] + whole[2] / 2).toBeCloseTo(512, 6);
  });

  it('places the hexagrams by number, bottom line innermost: hexagram 1 is whole at the bottom only', () => {
    const { ctx, marks } = tracer();
    paintRingStrip(ctx, ring('hexagram'), 4096, 256);
    // Hexagram 1 stands one 64th of the way round: u = 1/64, so 64 px across.
    const one = marks.filter((m) => m.rects.every(([x, , w]) => Math.abs(x + w / 2 - 64) < 30));
    const rows = [...new Set(one.map((m) => m.rects[0][1]))].sort((a, b) => b - a);
    expect(rows).toHaveLength(6);
    expect(one.filter((m) => m.rects[0][1] === rows[0])).toHaveLength(1);
    for (const row of rows.slice(1)) expect(one.filter((m) => m.rects[0][1] === row)).toHaveLength(2);
  });

  it('draws each degree tick longer every 5 and again every 15, on the ring\'s outer edge', () => {
    const { ctx, marks } = tracer();
    paintRingStrip(ctx, ring('degree'), 4096, 256);
    const ticks = marks.map((m) => m.rects[0]);
    // Tick n is the n-th mark; the wrapped copy of tick 0 comes second in its own mark, so the first rectangle of tick 0 is the one at the seam.
    const long = (n: number) => ticks[n][3];
    expect(long(1)).toBeLessThan(long(5));
    expect(long(5)).toBeLessThan(long(15));
    expect(long(6)).toBe(long(1));
    expect(long(10)).toBe(long(5));
    expect(long(30)).toBe(long(15));
    expect(long(0)).toBe(long(15));
    // They hang from the outer edge, the top of the strip.
    for (const n of [0, 1, 5, 15, 100, 359]) expect(ticks[n][1]).toBe(0);
  });

  it('turns each character with its top outward, at its bearing and at the middle of its ring', () => {
    vi.stubGlobal('Path2D', RecordedPath2D);
    const { ctx, marks, translates, scales } = tracer();
    paintRingStrip(ctx, ring('direction'), 2048, 128);
    expect(marks.map((m) => m.path)).toHaveLength(4);
    // Each character is placed by its centre: a translate to the bearing and radius, then one to the middle of the em box.
    const centres = translates.filter((_, i) => i % 2 === 0);
    expect(centres.map(([x]) => x)).toEqual([0, 512, 1024, 1536]);
    // Their radius and size are DIAL_ART.glyph's, as the face and the loader's drawing place them: (outer - at) down the ring's depth, one em deep.
    const { outer, inner } = ring('direction');
    const { at, em } = DIAL_ART.glyph;
    for (const [, y] of centres) expect(y).toBeCloseTo(((outer - at) / (outer - inner)) * 128, 9);
    // A positive scale keeps the glyph's top (y = 0 in its em box) toward the strip's top, the outer edge.
    for (const [sx, sy] of scales) {
      expect(sx).toBeCloseTo((em * 2048) / (2 * Math.PI * at), 9);
      expect(sy).toBeCloseTo((em / (outer - inner)) * 128, 9);
    }
    expect(translates.filter((_, i) => i % 2 === 1)).toEqual([[-0.5, -0.5], [-0.5, -0.5], [-0.5, -0.5], [-0.5, -0.5]]);
    expect(marks[1].path).toBe(GLYPHS['東']);
    expect(marks[2].path).toBe(GLYPHS['南']);
    expect(marks[3].path).toBe(GLYPHS['西']);
  });

  it('draws north across the seam: the character that straddles the strip\'s edge comes with its copy a turn away, in the same fill', () => {
    vi.stubGlobal('Path2D', RecordedPath2D);
    const { ctx, marks } = tracer();
    paintRingStrip(ctx, ring('direction'), 2048, 128);
    const north = marks[0].path!;
    expect(north.startsWith(GLYPHS['北'])).toBe(true);
    // The copy is the same outline moved right by a turn of the ring at the characters' radius, in em widths: 2 PI * at / em.
    const numbers = (d: string) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const original = numbers(GLYPHS['北']);
    const copy = numbers(north.slice(GLYPHS['北'].length));
    expect(copy).toHaveLength(original.length);
    const turn = (2 * Math.PI * DIAL_ART.glyph.at) / DIAL_ART.glyph.em;
    original.forEach((n, i) => expect(copy[i]).toBeCloseTo(i % 2 === 0 ? n + turn : n, 3));
  });

  it('leaves the characters out where Path2D is missing, as the face does, and still paints the other rings', () => {
    vi.stubGlobal('Path2D', undefined);
    const { ctx, marks } = tracer();
    expect(() => paintRingStrip(ctx, ring('direction'), 2048, 128)).not.toThrow();
    expect(marks).toHaveLength(0);
    const { ctx: other, marks: bars } = tracer();
    paintRingStrip(other, ring('degree'), 2048, 128);
    expect(bars).toHaveLength(360);
  });
});
