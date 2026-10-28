import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { touchColumns } from '~/scene/bob/touchColumns';
import { registerTouchPoints, showTouchPoints, TouchPoints } from '~/ui/TouchPoints';

/** A stand-in element: its style and attributes as plain maps, its width given. */
function fake(width = 0) {
  const attributes = new Map<string, string>();
  const style: Record<string, string> = {};
  return {
    style,
    attributes,
    offsetWidth: width,
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    removeAttribute: (k: string) => attributes.delete(k),
    toggleAttribute: (k: string, on: boolean) => (on ? attributes.set(k, '') : attributes.delete(k))
  };
}

const DESK = { width: 1440, height: 900 };
const done: (() => void)[] = [];
afterEach(() => {
  for (const undo of done.splice(0)) undo();
});

describe("the touch points: an open project's own test points, in two columns beside it", () => {
  it("follow the open project's anchors in two columns", () => {
    const count = projects.byId('funcial')!.testPointLabels('nl').length;
    const el = fake();
    const words = Array.from({ length: count }, (_, k) => fake(70 + 10 * k));
    const lines = Array.from({ length: count }, () => fake());
    done.push(registerTouchPoints('funcial', { el: el as never, words: words as never, lines: lines as never }));
    const at = Array.from({ length: count }, (_, k) => ({ x: 640 + 30 * k, y: 380 + 25 * (k % 3) }));
    showTouchPoints({ id: 'funcial', opacity: 0.8, at, centreX: 700, reach: 110 }, DESK, 1);
    const placed = touchColumns(
      at.map((p, k) => ({ ...p, w: words[k]!.offsetWidth })),
      700,
      110,
      DESK,
      1
    );
    expect(el.attributes.has('data-shown')).toBe(true);
    expect(el.style.opacity).toBe('0.8');
    words.forEach((word, k) => expect(word.style.transform).toBe(`translate3d(${placed[k]!.left}px, ${placed[k]!.top}px, 0) translateY(-100%)`));
    lines.forEach((line, k) => expect(line.attributes.get('points')).toBe(placed[k]!.points.map((p) => p.join(',')).join(' ')));
    // As the object moves, they follow it.
    const moved = at.map((p) => ({ x: p.x + 50, y: p.y }));
    showTouchPoints({ id: 'funcial', opacity: 1, at: moved, centreX: 750, reach: 110 }, DESK, 1);
    expect(lines[0]!.attributes.get('points')!.startsWith(`${moved[0]!.x},${moved[0]!.y} `)).toBe(true);
    // None open: hidden.
    showTouchPoints(null, DESK, 1);
    expect(el.attributes.has('data-shown')).toBe(false);
  });

  it("renders each world project's test points in its page's words, each with its line, hidden from a screen reader, which reads them on the project's page", () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TouchPoints)));
    expect(html.match(/class="touch-points"/g)).toHaveLength(WORLD_PROJECTS.length);
    expect(html.match(/class="touch-points"[^>]*aria-hidden="true"/g)).toHaveLength(WORLD_PROJECTS.length);
    const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (const id of WORLD_PROJECTS) {
      const labels = projects.byId(id)!.testPointLabels('nl');
      for (const label of labels) expect(html).toContain(`>${escaped(label)}<`);
    }
    expect(html.match(/<polyline/g)).toHaveLength(WORLD_PROJECTS.reduce((n, id) => n + projects.byId(id)!.testPointLabels('nl').length, 0));
  });
});
