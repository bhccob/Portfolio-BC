import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { TOUCH_POINTS, touchBox } from '~/scene/bob/touchPoints';
import { TouchPoints } from '~/ui/TouchPoints';

describe("the touch points: a bead's own test points, on the parts they name", () => {
  it('names a touch point for every test point of each project', () => {
    for (const p of projects.all()) expect(TOUCH_POINTS[p.id], p.id).toHaveLength(p.testPoints.length);
  });

  it("pins Funcial's to its four pins and the abacus's fifth bead, Jontai Energy's to its tablet's corners, Cookies Clicker's to its loop, train and screen", () => {
    expect(TOUCH_POINTS.funcial.map((p) => [p.anchor, p.place])).toEqual([
      [{ node: 'funcial_pin_1' }, 'below'],
      [{ node: 'funcial_pin_2' }, 'below2'],
      [{ node: 'funcial_pin_3' }, 'below'],
      [{ node: 'funcial_pin_4' }, 'below2'],
      [{ node: 'funcial_bead_5' }, 'above']
    ]);
    expect(TOUCH_POINTS['jontai-energy'].map((p) => [p.anchor, p.place])).toEqual([
      [{ corner: 'tl' }, 'left'],
      [{ corner: 'bl' }, 'left'],
      [{ corner: 'tr' }, 'right'],
      [{ corner: 'br' }, 'right']
    ]);
    expect(TOUCH_POINTS['cookies-clicker'].map((p) => [p.anchor, p.place])).toEqual([
      [{ node: 'cookies_balance' }, 'above'],
      [{ node: 'cookies_wheel_4' }, 'below'],
      [{ node: 'cookies_wheel_8' }, 'below2'],
      [{ corner: 'bl' }, 'below'],
      [{ corner: 'tr' }, 'right']
    ]);
  });

  it('places a touch point by its side, inside the screen', () => {
    expect(touchBox({ x: 500, y: 300 }, 'below2', { w: 80, h: 16 }, 1440)).toEqual({ x: 460, y: 340 });
    expect(touchBox({ x: 500, y: 300 }, 'left', { w: 80, h: 16 }, 1440)).toEqual({ x: 408, y: 292 });
    expect(touchBox({ x: 500, y: 300 }, 'right', { w: 80, h: 16 }, 1440)).toEqual({ x: 512, y: 292 });
    expect(touchBox({ x: 500, y: 300 }, 'above', { w: 80, h: 16 }, 1440)).toEqual({ x: 460, y: 268 });
    expect(touchBox({ x: 500, y: 300 }, 'below', { w: 80, h: 16 }, 1440)).toEqual({ x: 460, y: 316 });
    expect(touchBox({ x: 5, y: 300 }, 'below', { w: 80, h: 16 }, 1440).x).toBe(10);
    expect(touchBox({ x: 1430, y: 300 }, 'right', { w: 80, h: 16 }, 1440).x).toBe(1350);
  });

  it("renders each project's test points in its page's words, hidden from a screen reader, which reads them on the project's page", () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TouchPoints)));
    expect(html.match(/class="touch-points"/g)).toHaveLength(projects.all().length);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(projects.all().length);
    const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (const p of projects.all()) for (const label of p.testPointLabels('nl')) expect(html).toContain(`>${escaped(label)}<`);
  });
});
