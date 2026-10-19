import { describe, expect, it } from 'vitest';
import { DIAL, DIRECTIONS, HOMES, TRIGRAMS, bearingOf, onDial } from '../../src/scripts/three/instrument/dialSpec';
import { GLYPHS, GLYPH_CREDIT } from '../../src/scripts/three/instrument/glyphs';
import { dialSvg } from '../../src/scripts/three/instrument/dialSvg';
describe('dialSpec', () => {
  it('nests the rings without overlap, inside the rim', () => {
    const r = DIAL.rings; const order = [[0, DIAL.pool], r.trigram, r.direction, r.degree, r.pattern];
    order.slice(1).forEach((ring, k) => expect(ring[0]).toBeGreaterThan(order[k][1]));
    expect(r.pattern[1]).toBeLessThan(DIAL.rim); expect(r.degree[1]).toBeLessThanOrEqual(DIAL.face);
  });
  it('places bearings north-up, east-right, and reads them back', () => {
    const [x0, z0] = onDial(0, 1); expect(x0).toBeCloseTo(0); expect(z0).toBeCloseTo(-1);
    const [x90, z90] = onDial(90, 1); expect(x90).toBeCloseTo(1); expect(z90).toBeCloseTo(0);
    for (const b of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const [x, z] = onDial(b, 0.5); const back = (bearingOf(x, z) * 180) / Math.PI;
      expect(((back % 360) + 360) % 360).toBeCloseTo(b % 360);
    }
  });
  it('holds the Later Heaven trigrams and the four directions exactly', () => {
    expect(TRIGRAMS.map((t) => [t.bearing, t.name, t.lines.join('')])).toEqual([
      [0, 'Kan', '010'], [45, 'Gen', '001'], [90, 'Zhen', '100'], [135, 'Xun', '011'],
      [180, 'Li', '101'], [225, 'Kun', '000'], [270, 'Dui', '110'], [315, 'Qian', '111']]);
    expect(DIRECTIONS.map((d) => `${d.bearing}${d.char}`)).toEqual(['0北', '90東', '180南', '270西']);
    expect(HOMES).toEqual({ china: { needle: 90, sweepFrom: 90 }, aruba: { needle: 270, sweepFrom: 270 }, rotterdam: { needle: null, sweepFrom: 180 } });
  });
  it('has the four glyph outlines and their credit', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual(['北', '南', '東', '西'].sort());
    Object.values(GLYPHS).forEach((d) => expect(d).toMatch(/^M[\d.\- ]/));
    expect(GLYPH_CREDIT).toMatch(/Open Font License/i);
  });
  it('draws the dial as plain SVG', () => {
    const svg = dialSvg();
    expect(svg).toMatch(/^<svg[^>]*viewBox="-1\.2 -1\.2 2\.4 2\.4"/);
    expect(svg.match(/data-dial-rim[^>]*r="1\.04"|r="1\.04"[^>]*data-dial-rim/g)).toHaveLength(1);
    expect(svg.match(/data-trigram/g)).toHaveLength(8);
    expect(svg.match(/data-glyph/g)).toHaveLength(4);
    expect(svg.match(/data-loader-needle/g)).toHaveLength(1);
    expect(svg).not.toMatch(/style=|<text|<script/);
  });
  it('draws each trigram with its broken bars on the right lines, bottom line innermost', () => {
    const groups = [...dialSvg().matchAll(/<g data-trigram="(\w+)" transform="rotate\(([\d.]+)\)"[^>]*>(.*?)<\/g>/g)];
    expect(groups).toHaveLength(TRIGRAMS.length);
    groups.forEach(([, name, bearing, bars], k) => {
      expect([name, Number(bearing)]).toEqual([TRIGRAMS[k].name, TRIGRAMS[k].bearing]);
      const paths = [...bars.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
      // A whole bar is one rectangle, a broken one is two.
      expect(paths.map((d) => ((d.match(/M/g) ?? []).length === 1 ? 1 : 0))).toEqual([...TRIGRAMS[k].lines]);
      // A bar starts at y = -(r + half its thickness), north of the centre: the bottom line comes first and is nearest.
      const y = paths.map((d) => Number(d.match(/^M-?[\d.]+ (-[\d.]+)h/)![1]));
      expect(y).toEqual([...y].sort((a, b) => b - a));
    });
  });
  it('stands each direction character with its top outward', () => {
    const svg = dialSvg();
    DIRECTIONS.forEach(({ bearing, char }) => {
      const turn = `data-glyph="${char}"[^>]*transform="rotate\\(${bearing}\\) translate\\(0 -0\\.49\\)`;
      expect(svg).toMatch(new RegExp(turn));
    });
  });
});
