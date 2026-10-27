import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, NavigationType, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { focusesMain } from '~/app/navigationFocus';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { FLIGHT_MS, FOCUS_AT_REST, moveFocus } from '~/scene/bob/focus';
import { INSIDE_STATE } from '~/scene/bob/inside';
import { frame } from '~/state/frame';
import { noteOpenedFrom, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';
import { closeInside, lendOpener, openInside, viewInside } from '~/ui/BeadLabel';
import { INSIDE_ATTRIBUTE, InsideControls, leaveInsideOn, SWIPE_OUT_PX } from '~/ui/InsideControls';

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

describe('InsideControls: the two buttons inside a bead', () => {
  it('shows two buttons inside, named by the dictionary, at least 48 px tall', () => {
    expect(nl.needle.inside).toEqual({ view: 'Bekijk project', back: 'Terug' });
    expect(en.needle.inside).toEqual({ view: 'View project', back: 'Back' });
    for (const [path, t] of [
      ['/', nl],
      ['/en/', en]
    ] as const) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(InsideControls)));
      // Terug first, so Tab reaches the way out first.
      expect(html).toBe(
        `<div class="inside-controls"><button type="button" class="inside-button inside-back">${t.needle.inside.back}</button>` +
          `<button type="button" class="inside-button inside-view">${t.needle.inside.view}</button></div>`
      );
    }
    expect(Number.parseFloat(/min-height:\s*([\d.]+)px/.exec(rule('.inside-button'))![1]!)).toBeGreaterThanOrEqual(48);
    // At the foot of the screen, centred, over the scene.
    expect(rule('.inside-controls')).toMatch(/position:\s*fixed/);
    expect(rule('.inside-controls')).toMatch(/left:\s*50%/);
    expect(rule('.inside-controls')).toMatch(/bottom:/);
    // Hidden, and out of Tab's reach, unless a bead is open inside (<html data-inside>, on the home with 3D on).
    expect(INSIDE_ATTRIBUTE).toBe('data-inside');
    expect(rule('.inside-controls')).toMatch(/visibility:\s*hidden/);
    expect(rule("html[data-route='home'][data-3d='on'][data-inside] .inside-controls")).toMatch(/visibility:\s*visible/);
  });
});

describe('leaveInsideOn: every other way out of the inside', () => {
  let target: EventTarget;
  let leave: Mock<() => void>;
  let stop: () => void;
  beforeEach(() => {
    target = new EventTarget();
    leave = vi.fn<() => void>();
    stop = leaveInsideOn(target, leave);
  });
  afterEach(() => stop());

  it('goes back out on Terug, on Escape and on a wheel or a swipe', () => {
    fire(target, 'keydown', key('Escape'));
    expect(leave).toHaveBeenCalledTimes(1);
    // The scrolling keys leave too; Space on a button presses it, and other keys do nothing.
    for (const k of ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End']) fire(target, 'keydown', key(k));
    expect(leave).toHaveBeenCalledTimes(8);
    fire(target, 'keydown', key(' ', 'BUTTON'));
    fire(target, 'keydown', key('Tab'));
    fire(target, 'keydown', key('a'));
    fire(target, 'keydown', { ...key('ArrowDown'), ctrlKey: true });
    expect(leave).toHaveBeenCalledTimes(8);
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
    fire(target, 'wheel', { deltaY: 100, deltaX: 0, ctrlKey: false });
    expect(leave).not.toHaveBeenCalled();
  });
});

describe('openInside, closeInside and viewInside: the inside through the history', () => {
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

  it('flies into the bead on a click and pushes the inside on the home, where Back comes back out', () => {
    expect(openInside('funcial')).toBe(true);
    expect(useScene.getState().inside).toBe('funcial');
    expect(frame.focus.move).toMatchObject({ to: 'funcial', mode: 'fly' });
    expect(went).toEqual([['/', { state: { [INSIDE_STATE]: 'funcial' }, preventScrollReset: true }]]);
    // A second click while inside opens nothing more.
    expect(openInside('funcial')).toBe(false);
    // The push lands as a navigation of its own: no focus is taken to <main>, the controls keep it.
    expect(focusesMain(NavigationType.Push, '', { [INSIDE_STATE]: 'funcial' })).toBe(false);
    expect(focusesMain(NavigationType.Push, '', null)).toBe(true);
  });

  it('goes back out on Terug through the history when the inside has its own entry, and at once otherwise', () => {
    openInside('funcial');
    syncRoute({ pathname: '/', key: 'k1', state: { [INSIDE_STATE]: 'funcial' } }, NavigationType.Push);
    went.length = 0;
    closeInside();
    expect(went).toEqual([-1]); // Back: the entry before is the arrival's
    expect(useScene.getState().inside).toBeNull(); // the way out starts now, not once the router has popped
    closeInside(); // a second Escape before the pop lands goes nowhere further back
    expect(went).toEqual([-1]);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    expect(useScene.getState().inside).toBeNull();
    // An inside with no entry of its own (no router lent): let go at once.
    release();
    useScene.getState().setInside('funcial');
    closeInside();
    expect(useScene.getState().inside).toBeNull();
    expect(went).toEqual([-1]);
  });

  it('opens the project page on Bekijk project', () => {
    noteOpenedFrom('funcial', A0);
    frame.focus.move = moveFocus(frame.focus.move, 'funcial', performance.now() - 2 * FLIGHT_MS, 'fly'); // flown in
    useScene.getState().setInside('funcial');
    expect(viewInside()).toBe(true);
    vi.advanceTimersByTime(0); // the camera is already inside: the page comes at once
    expect(went).toEqual(['/projects/funcial/']);
    expect(attributes.has('data-bead-open')).toBe(true); // its text fades in with its scrim
    // With no bead open inside there is nothing to view.
    useScene.getState().setInside(null);
    frame.focus.opening = null;
    expect(viewInside()).toBe(false);
  });
});
