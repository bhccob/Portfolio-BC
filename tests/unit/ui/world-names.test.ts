import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { registerWorldHint, registerWorldName, showWorldNames, WorldNames } from '~/ui/WorldNames';

/** A stand-in element: its style and attributes as plain maps, its width given. */
function fake(width = 90) {
  const attributes = new Map<string, string>();
  const style: Record<string, string> = {};
  return {
    style,
    attributes,
    offsetWidth: width,
    tabIndex: 0,
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    removeAttribute: (k: string) => attributes.delete(k),
    toggleAttribute: (k: string, on: boolean) => (on ? attributes.set(k, '') : attributes.delete(k))
  };
}

const SIZE = { width: 1440, height: 900 };
const done: (() => void)[] = [];
afterEach(() => {
  for (const undo of done.splice(0)) undo();
});

describe("the projects' names on the world", () => {
  it('are a link to each project and a line for each, and the hint, in both languages', () => {
    for (const [path, t] of [
      ['/', nl],
      ['/en/', en]
    ] as const) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(WorldNames)));
      for (const id of WORLD_PROJECTS) {
        expect(html, id).toContain(`data-project="${id}"`);
        expect(html, id).toMatch(new RegExp(`class="world-name"[^>]*href="${path === '/' ? '' : '/en'}/projects/${id}/"|href="${path === '/' ? '' : '/en'}/projects/${id}/"[^>]*class="world-name"`));
      }
      expect(html.match(/<polyline/g)).toHaveLength(WORLD_PROJECTS.length);
      expect(html).toContain(t.needle.world.hint.click);
      expect(html).toContain(t.needle.world.hint.tap);
    }
  });

  it('show with the hint only where the world shows them, each by its object, reachable by Tab only then', () => {
    const name = fake();
    const line = fake();
    const hint = fake();
    done.push(registerWorldName('funcial', { root: name as never, line: line as never }), registerWorldHint(hint as never));
    showWorldNames({ opacity: 1, names: [{ id: 'funcial', anchor: { x: 500, y: 400 }, category: 'secure-element', hot: false }] }, SIZE);
    expect(name.style.opacity).toBe('1');
    expect(line.style.opacity).toBe('1');
    expect(hint.style.opacity).toBe('1');
    expect(name.tabIndex).toBe(0);
    expect(line.attributes.get('points')).toBe(`500,400 ${500 - 190 * 0.22},322 310,322`);
    expect(name.style.transform).toBe('translate3d(310px, 322px, 0) translateY(-100%)');
    showWorldNames(null, SIZE);
    expect(name.style.opacity).toBe('0');
    expect(hint.style.opacity).toBe('0');
    expect(name.tabIndex).toBe(-1);
  });

  it('light the project under the pointer', () => {
    const name = fake();
    const line = fake();
    done.push(registerWorldName('jontai-energy', { root: name as never, line: line as never }));
    showWorldNames({ opacity: 1, names: [{ id: 'jontai-energy', anchor: { x: 900, y: 400 }, category: 'front-panel', hot: true }] }, SIZE);
    expect(name.attributes.has('data-hot')).toBe(true);
    showWorldNames({ opacity: 1, names: [{ id: 'jontai-energy', anchor: { x: 900, y: 400 }, category: 'front-panel', hot: false }] }, SIZE);
    expect(name.attributes.has('data-hot')).toBe(false);
  });
});
