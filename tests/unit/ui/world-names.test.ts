import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { project } from '~/scene/bob/fit';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { STACK } from '~/scene/bob/worldLayout';
import { makeWorldPath } from '~/scene/bob/worldPath';
import { buildChapters } from '~/state/chapters';
import { captionHover, nameLevel, placeNames, registerWorldHint, registerWorldName, setCaptionHover, showWorldNames, WorldNames } from '~/ui/WorldNames';

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
    done.push(registerWorldName('steady', { root: name as never, line: line as never }), registerWorldHint(hint as never));
    showWorldNames({ opacity: 1, names: [{ id: 'steady', anchor: { x: 500, y: 400 }, category: 'app', hot: false, level: 1 }] }, SIZE);
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
    showWorldNames({ opacity: 1, names: [{ id: 'jontai-energy', anchor: { x: 900, y: 400 }, category: 'website', hot: true, level: 1 }] }, SIZE);
    expect(name.attributes.has('data-hot')).toBe(true);
    showWorldNames({ opacity: 1, names: [{ id: 'jontai-energy', anchor: { x: 900, y: 400 }, category: 'website', hot: false, level: 1 }] }, SIZE);
    expect(name.attributes.has('data-hot')).toBe(false);
  });
});

describe('names only under the mouse; a touch screen has a board\'s at its stop', () => {
  it('show only the name whose project the pointer is on', () => {
    const steady = { root: fake(), line: fake() };
    const porfael = { root: fake(), line: fake() };
    done.push(registerWorldName('steady', { root: steady.root as never, line: steady.line as never }));
    done.push(registerWorldName('porfael', { root: porfael.root as never, line: porfael.line as never }));
    const names = [
      { id: 'steady' as const, anchor: { x: 500, y: 400 }, category: 'app' as const, hot: true, level: nameLevel('steady', { touch: false, hover: { id: 'steady', amount: 1 }, caption: null, board: null }) },
      { id: 'porfael' as const, anchor: { x: 700, y: 400 }, category: 'app' as const, hot: false, level: nameLevel('porfael', { touch: false, hover: { id: 'steady', amount: 1 }, caption: null, board: null }) }
    ];
    showWorldNames({ opacity: 1, names }, SIZE);
    expect(steady.root.style.opacity).toBe('1');
    expect(steady.root.tabIndex).toBe(0);
    expect(porfael.root.style.opacity).toBe('0');
    expect(porfael.line.style.opacity).toBe('0');
    expect(porfael.root.tabIndex).toBe(-1);
    expect(porfael.root.style.pointerEvents).toBe('none');
    // Half way in as the hover eases, at half the view's opacity.
    expect(nameLevel('steady', { touch: false, hover: { id: 'steady', amount: 0.5 }, caption: null, board: null })).toBe(0.5);
    showWorldNames({ opacity: 0.8, names: [{ ...names[0]!, level: 0.5 }, names[1]!] }, SIZE);
    expect(steady.root.style.opacity).toBe('0.4');
    // No pointer on any: no name at all, the hint still there.
    expect(nameLevel('steady', { touch: false, hover: { id: null, amount: 0 }, caption: null, board: null })).toBe(0);
  });

  it("show a board's names at its stop on a touch screen, and none at the world's stop", () => {
    const board = ['steady', 'porfael'] as const;
    for (const id of board) expect(nameLevel(id, { touch: true, hover: { id: null, amount: 0 }, caption: null, board })).toBe(1);
    expect(nameLevel('jontai-energy', { touch: true, hover: { id: null, amount: 0 }, caption: null, board })).toBe(0);
    for (const id of WORLD_PROJECTS) expect(nameLevel(id, { touch: true, hover: { id: null, amount: 0 }, caption: null, board: null })).toBe(0);
    // A touch screen's names do not follow a pointer it does not have.
    expect(nameLevel('jontai-energy', { touch: true, hover: { id: 'jontai-energy', amount: 1 }, caption: null, board })).toBe(0);
  });

  it('light a name from its caption as from its object', () => {
    expect(captionHover()).toBeNull();
    setCaptionHover('porfael');
    expect(captionHover()).toBe('porfael');
    expect(nameLevel('porfael', { touch: false, hover: { id: null, amount: 0 }, caption: captionHover(), board: null })).toBe(1);
    expect(nameLevel('steady', { touch: false, hover: { id: null, amount: 0 }, caption: captionHover(), board: null })).toBe(0);
    setCaptionHover(null);
    expect(captionHover()).toBeNull();
    // The caption's names set it as the pointer comes on and off them.
    const source = readFileSync(fileURLToPath(new URL('../../../src/ui/AreaCaption.tsx', import.meta.url)), 'utf8');
    expect(source).toMatch(/onPointerEnter=\{\(\) => setCaptionHover\(id\)\}/);
    expect(source).toMatch(/onPointerLeave=\{\(\) => setCaptionHover\(null\)\}/);
  });

  it("a touch screen's names at a board with three projects stand apart", () => {
    const phone = { width: 390, height: 844 };
    const areas = [
      { category: 'app', projects: ['steady', 'porfael', 'jontai-energy'] },
      { category: 'website', projects: ['cookies-clicker'] }
    ] as never;
    const c = buildChapters({ areas });
    const path = makeWorldPath(phone.width / phone.height, c);
    const board = path.places[1]!;
    const shot = path.areaShot(0);
    const items = board.sockets.map((s) => {
      const p = project([path.centre[0] + s.at[0], board.top + STACK.hover + 1.0, path.centre[2] + s.at[1]], shot, phone.width / phone.height);
      const title = projects.byId(s.id)!.title.toUpperCase();
      return { id: s.id, anchor: { x: ((p.x + 1) / 2) * phone.width, y: ((1 - p.y) / 2) * phone.height }, category: 'app' as const, width: title.length * 8.4 + 4, height: 18 };
    });
    const placed = placeNames(items, phone);
    const boxes = [...placed.values()].map((p) => p.box);
    expect(boxes).toHaveLength(3);
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a]!;
        const B = boxes[b]!;
        const apart = A.left + A.width <= B.left || B.left + B.width <= A.left || A.top + A.height <= B.top || B.top + B.height <= A.top;
        expect(apart, `${JSON.stringify(A)} and ${JSON.stringify(B)}`).toBe(true);
      }
    }
    // Each still on the screen.
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(phone.width);
      expect(box.top).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the hint under the whole machine", () => {
  it("shows at the whole machine's stop only, not at a board's, where the board's own words say how to open", () => {
    const hint = fake();
    done.push(registerWorldHint(hint as never));
    showWorldNames({ opacity: 1, hint: 1, names: [] }, SIZE);
    expect(hint.style.opacity).toBe('1');
    // At a board's stop the names may show (under the mouse, or a touch screen's), the hint not.
    showWorldNames({ opacity: 1, hint: 0, names: [] }, SIZE);
    expect(hint.style.opacity).toBe('0');
  });
});
