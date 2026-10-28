import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, NavigationType, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { focusesMain } from '~/app/navigationFocus';
import { projects } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { FLIGHT_MS, FOCUS_AT_REST, focusOpensAt, moveFocus } from '~/scene/bob/focus';
import { INSIDE_STATE } from '~/scene/bob/inside';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { frame } from '~/state/frame';
import { insideInHistory, noteOpenedFrom, placeForProject, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';
import { clickOnWorld, closeInside, lendOpener, openInside, turnInside, viewInside } from '~/ui/projectOpen';
import {
  INSIDE_ATTRIBUTE,
  leaveInsideOn,
  panelKeepOut,
  panelLevels,
  ProjectPanel,
  registerInsideControls,
  registerProjectPanel,
  SWIPE_OUT_PX
} from '~/ui/ProjectPanel';

const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose whole selector is `selector`, outside any @media. */
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1]!.trim() === selector) return match[2]!;
  throw new Error(`no rule for ${selector}`);
}

function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}): Event {
  const event = new Event(type, { cancelable: true, bubbles: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

const key = (k: string, tagName = 'BODY') => ({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, target: { tagName } });
const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

describe('ProjectPanel: an open project, Overworld\'s way', () => {
  it("shows the project's category, name, summary, role and year", () => {
    expect(nl.needle.inside).toEqual({ view: 'Bekijk project', back: 'Terug', previous: 'Vorig project', next: 'Volgend project' });
    expect(en.needle.inside).toEqual({ view: 'View project', back: 'Back', previous: 'Previous project', next: 'Next project' });
    for (const [path, t, locale] of [
      ['/', nl, 'nl'],
      ['/en/', en, 'en']
    ] as const) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ProjectPanel)));
      for (const id of WORLD_PROJECTS) {
        const project = projects.byId(id)!;
        const copy = project.copy(locale);
        const panel = new RegExp(`<section class="project-panel" data-project="${id}"[^>]*inert=""[^>]*>(.*?)</section>`).exec(html)?.[1];
        expect(panel, id).toBeDefined();
        expect(panel).toContain(escaped(project.category.heading(locale)));
        expect(panel).toContain(`>${escaped(project.title)}</h2>`);
        expect(panel).toContain(escaped(copy.summary));
        expect(panel).toContain(escaped(`${copy.role} · ${project.year}`));
        // "Bekijk project": a real link to the project's page.
        expect(panel).toMatch(new RegExp(`href="${path === '/' ? '' : '/en'}/projects/${id}/"[^>]*>${t.needle.inside.view}`));
      }
      // Terug at the left, the arrows with "n / N" at the right, each named; Terug first, so Tab reaches the way out first.
      const controls = /<div class="inside-controls">(.*)<\/div>$/.exec(html)![1]!;
      expect(controls.indexOf(t.needle.inside.back)).toBeLessThan(controls.indexOf(t.needle.inside.previous));
      expect(controls).toContain(`aria-label="${t.needle.inside.previous}"`);
      expect(controls).toContain(`aria-label="${t.needle.inside.next}"`);
      expect(controls).toContain(`1 / ${WORLD_PROJECTS.length}`);
      // A turn is said to a screen reader: the count is a polite live region with the open project's name in it.
      expect(controls).toMatch(new RegExp(`<span class="inside-count" aria-live="polite"><span class="visually-hidden">${escaped(projects.byId(WORLD_PROJECTS[0]!)!.title)}, </span>1 / ${WORLD_PROJECTS.length}</span>`));
    }
    expect(Number.parseFloat(/min-height:\s*([\d.]+)px/.exec(rule('.inside-button'))![1]!)).toBeGreaterThanOrEqual(48);
    expect(Number.parseFloat(/height:\s*([\d.]+)px/.exec(rule('.inside-round'))![1]!)).toBeGreaterThanOrEqual(48);
    // Hidden, and out of Tab's reach, unless a project is open (<html data-inside>, on the home with 3D on).
    expect(INSIDE_ATTRIBUTE).toBe('data-inside');
    expect(rule('.inside-controls')).toMatch(/visibility:\s*hidden/);
    expect(rule("html[data-route='home'][data-3d='on'][data-inside] .inside-controls")).toMatch(/visibility:\s*visible/);
  });

  it("fades its words out before they change to the next project's", () => {
    const funcial = moveFocus(FOCUS_AT_REST, 'funcial', 0, 'fly');
    // Opened: its words come once the camera is all but there.
    expect(panelLevels('funcial', focusOpensAt(funcial, FLIGHT_MS * 0.3))).toEqual({ funcial: 0 });
    expect(panelLevels('funcial', focusOpensAt(funcial, FLIGHT_MS))).toEqual({ funcial: 1 });
    // On to the next: the words of the one left are gone before the next one's come, at every moment of the flight.
    const turn = moveFocus(funcial, 'jontai-energy', 5000, 'fly');
    let gone = false;
    for (let k = 0; k <= 200; k++) {
      const levels = panelLevels('jontai-energy', focusOpensAt(turn, 5000 + (FLIGHT_MS * k) / 200));
      const left = levels.funcial ?? 0;
      const next = levels['jontai-energy'] ?? 0;
      expect(left > 0 && next > 0, `both at ${k}`).toBe(false);
      if (left === 0) gone = true;
      if (next > 0) expect(gone).toBe(true);
    }
    expect(panelLevels('jontai-energy', focusOpensAt(turn, 5000 + FLIGHT_MS))).toEqual({ 'jontai-energy': 1 });
    expect(panelLevels(null, { open: 0, leaving: null })).toEqual({});
  });

  it('keeps the touch points clear of its words: right of them beside it, above them below it, and above the controls', () => {
    const box = (r: { left: number; top: number; right: number; bottom: number }) => ({
      style: {} as Record<string, string>,
      toggleAttribute: () => true,
      getBoundingClientRect: () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top })
    });
    const undo = [
      registerProjectPanel('funcial', box({ left: 80, top: 300, right: 510, bottom: 600 }) as never),
      registerProjectPanel('jontai-energy', box({ left: 20, top: 430, right: 370, bottom: 740 }) as never),
      registerInsideControls(box({ left: 64, top: 800, right: 1376, bottom: 852 }) as never)
    ];
    expect(panelKeepOut('funcial', { width: 1440, height: 900 })).toEqual({ left: 510, bottom: 800 });
    expect(panelKeepOut('jontai-energy', { width: 390, height: 844 })).toEqual({ left: 0, bottom: 430 });
    expect(panelKeepOut('cookies-clicker', { width: 1440, height: 900 })).toEqual({ left: 0, bottom: 800 });
    for (const done of undo) done();
    expect(panelKeepOut('funcial', { width: 1440, height: 900 })).toEqual({ left: 0, bottom: 900 });
  });
});

describe('leaveInsideOn: the keys, the wheel and a swipe on an open project', () => {
  let target: EventTarget;
  let leave: Mock<() => void>;
  let turn: Mock<(dir: 1 | -1) => void>;
  let stop: () => void;
  beforeEach(() => {
    target = new EventTarget();
    leave = vi.fn<() => void>();
    turn = vi.fn<(dir: 1 | -1) => void>();
    stop = leaveInsideOn(target, leave, turn);
  });
  afterEach(() => stop());

  it('turns with the arrow keys and leaves with Escape, a scroll or the up and down keys', () => {
    fire(target, 'keydown', key('ArrowRight'));
    fire(target, 'keydown', key('ArrowLeft'));
    expect(turn.mock.calls).toEqual([[1], [-1]]);
    expect(leave).not.toHaveBeenCalled();
    fire(target, 'keydown', key('Escape'));
    expect(leave).toHaveBeenCalledTimes(1);
    // The scrolling keys leave too; Space on a button presses it, and other keys do nothing.
    for (const k of ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End']) fire(target, 'keydown', key(k));
    expect(leave).toHaveBeenCalledTimes(8);
    fire(target, 'keydown', key(' ', 'BUTTON'));
    fire(target, 'keydown', key('Tab'));
    fire(target, 'keydown', key('a'));
    fire(target, 'keydown', { ...key('ArrowDown'), ctrlKey: true });
    fire(target, 'keydown', { ...key('ArrowRight'), altKey: true }); // the browser's Forward
    expect(leave).toHaveBeenCalledTimes(8);
    expect(turn).toHaveBeenCalledTimes(2);
    // A wheel, either way; not the browser's zoom (ctrl) and not a sideways one.
    fire(target, 'wheel', { deltaY: 3, deltaX: 0, ctrlKey: false });
    fire(target, 'wheel', { deltaY: -100, deltaX: 0, ctrlKey: false });
    expect(leave).toHaveBeenCalledTimes(10);
    fire(target, 'wheel', { deltaY: 100, deltaX: 0, ctrlKey: true });
    fire(target, 'wheel', { deltaY: 0, deltaX: 40, ctrlKey: false });
    expect(leave).toHaveBeenCalledTimes(10);
  });

  it(`leaves on a swipe of ${40} px up or down the glass, once, and never on a tap or a sideways swipe`, () => {
    expect(SWIPE_OUT_PX).toBe(40);
    const swipe = (dx: number, dy: number): void => {
      fire(target, 'touchstart', { touches: [{ clientX: 100, clientY: 300 }] });
      for (let i = 1; i <= 5; i++) fire(target, 'touchmove', { touches: [{ clientX: 100 + (dx * i) / 5, clientY: 300 + (dy * i) / 5 }] });
      fire(target, 'touchend', { touches: [] });
    };
    swipe(0, 8); // a tap that wavers
    swipe(120, 20); // sideways
    expect(leave).not.toHaveBeenCalled();
    swipe(0, -200);
    expect(leave).toHaveBeenCalledTimes(1);
    swipe(0, 60);
    expect(leave).toHaveBeenCalledTimes(2);
    // A second finger is a pinch.
    fire(target, 'touchstart', { touches: [{ clientX: 0, clientY: 0 }, { clientX: 50, clientY: 50 }] });
    fire(target, 'touchmove', { touches: [{ clientX: 0, clientY: 100 }, { clientX: 50, clientY: 150 }] });
    expect(leave).toHaveBeenCalledTimes(2);
  });

  it('hears nothing once taken down', () => {
    stop();
    fire(target, 'keydown', key('Escape'));
    fire(target, 'keydown', key('ArrowRight'));
    fire(target, 'wheel', { deltaY: 100, deltaX: 0, ctrlKey: false });
    expect(leave).not.toHaveBeenCalled();
    expect(turn).not.toHaveBeenCalled();
  });
});

describe('openInside, turnInside, closeInside and viewInside: an open project through the history', () => {
  const doc = (globalThis as { document?: unknown }).document;
  const attributes = new Set<string>();
  const root = {
    setAttribute: (name: string) => void attributes.add(name),
    removeAttribute: (name: string) => void attributes.delete(name),
    toggleAttribute: (name: string, on: boolean) => (on ? attributes.add(name) : attributes.delete(name), on)
  };
  const A0 = stopForProject('funcial');
  let went: unknown[];
  let release: () => void;
  const reset = (): void => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = frame.target = frame.velocity = frame.chapterIndex = 0;
    frame.focus.move = { ...FOCUS_AT_REST, from: { ...FOCUS_AT_REST.from } };
    frame.focus.opening = null;
    frame.shot = null;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as { document?: unknown }).document = { documentElement: root };
    reset();
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'secure-element' }, scene: 'home' });
    frame.progress = frame.target = A0;
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    went = [];
    release = lendOpener({ navigate: ((to: unknown, options?: unknown) => void went.push(options === undefined ? to : [to, options])) as NavigateFunction, path: (id) => `/projects/${id}/` });
  });
  afterEach(() => {
    release();
    vi.useRealTimers();
    (globalThis as { document?: unknown }).document = doc;
    reset();
  });

  it('flies to the project on a click and pushes it on the home, where Back comes back out', () => {
    expect(openInside('funcial')).toBe(true);
    expect(useScene.getState().inside).toBe('funcial');
    expect(frame.focus.move).toMatchObject({ to: 'funcial', mode: 'fly' });
    expect(went).toEqual([['/', { state: { [INSIDE_STATE]: 'funcial' }, preventScrollReset: true }]]);
    // A second click while open opens nothing more.
    expect(openInside('funcial')).toBe(false);
    // The push lands as a navigation of its own: no focus is taken to <main>, the controls keep it.
    expect(focusesMain(NavigationType.Push, '', { [INSIDE_STATE]: 'funcial' })).toBe(false);
    expect(focusesMain(NavigationType.Push, '', null)).toBe(true);
  });

  it('opens a project clicked on the world only at rest; while the camera glides between two stops a click does nothing', () => {
    frame.target = stopForProject('jontai-energy'); // on its way to the next area
    expect(clickOnWorld('funcial')).toBe(false);
    expect(useScene.getState().inside).toBeNull();
    expect(frame.focus.opening).toBeNull();
    vi.advanceTimersByTime(FLIGHT_MS * 2);
    expect(went).toEqual([]);
    frame.target = frame.progress; // at rest
    expect(clickOnWorld('funcial')).toBe(true);
    expect(useScene.getState().inside).toBe('funcial');
  });

  it('goes to the next and the previous project, round the end', () => {
    const [first, second] = WORLD_PROJECTS;
    const last = WORLD_PROJECTS[WORLD_PROJECTS.length - 1]!;
    expect(turnInside(1)).toBe(false); // none open: nothing to turn
    openInside(first!);
    syncRoute({ pathname: '/', key: 'k1', state: { [INSIDE_STATE]: first } }, NavigationType.Push);
    went.length = 0;
    vi.advanceTimersByTime(FLIGHT_MS);
    frame.shot = { position: [1, 2, 3], target: [0, 0, 0], fov: 40 };
    expect(turnInside(1)).toBe(true);
    // The entry is replaced, not pushed: Back still comes out to where the project was opened from.
    expect(went).toEqual([['/', { state: { [INSIDE_STATE]: second }, preventScrollReset: true, replace: true }]]);
    expect(useScene.getState().inside).toBe(second);
    // The camera flies on from where it stands, round the board.
    expect(frame.focus.move).toMatchObject({ to: second, mode: 'fly', shot: frame.shot });
    syncRoute({ pathname: '/', key: 'k2', state: { [INSIDE_STATE]: second } }, NavigationType.Replace);
    expect(insideInHistory()).toBe(true);
    // Opened from an area, it comes back out at the new project's area (the mock-up's way).
    expect(placeForProject(second!)).toBe(stopForProject(second!));
    expect(frame.progress).toBe(stopForProject(second!));
    // Back round the end: the first's previous is the last.
    went.length = 0;
    turnInside(-1);
    turnInside(-1);
    expect(useScene.getState().inside).toBe(last);
    // With reduced motion it fades.
    useScene.setState({ reducedMotion: true });
    turnInside(1);
    expect(frame.focus.move.mode).toBe('fade');
  });

  it('goes back out on Terug through the history when the project has its own entry, and at once otherwise', () => {
    openInside('funcial');
    syncRoute({ pathname: '/', key: 'k1', state: { [INSIDE_STATE]: 'funcial' } }, NavigationType.Push);
    went.length = 0;
    closeInside();
    expect(went).toEqual([-1]); // Back: the entry before is where it was opened from
    expect(useScene.getState().inside).toBeNull(); // the way out starts now, not once the router has popped
    closeInside(); // a second Escape before the pop lands goes nowhere further back
    expect(went).toEqual([-1]);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    expect(useScene.getState().inside).toBeNull();
    // An open project with no entry of its own (no router lent): let go at once.
    release();
    useScene.getState().setInside('funcial');
    closeInside();
    expect(useScene.getState().inside).toBeNull();
    expect(went).toEqual([-1]);
  });

  it('opens the project\'s page from "Bekijk project"', () => {
    noteOpenedFrom('funcial', A0);
    frame.focus.move = moveFocus(frame.focus.move, 'funcial', performance.now() - 2 * FLIGHT_MS, 'fly'); // flown in
    useScene.getState().setInside('funcial');
    expect(viewInside()).toBe(true);
    vi.advanceTimersByTime(0); // the camera is already there: the page comes at once
    expect(went).toEqual(['/projects/funcial/']);
    expect(attributes.has('data-bead-open')).toBe(true); // its text fades in with its scrim
    // With no project open there is nothing to view.
    useScene.getState().setInside(null);
    frame.focus.opening = null;
    expect(viewInside()).toBe(false);
  });
});
