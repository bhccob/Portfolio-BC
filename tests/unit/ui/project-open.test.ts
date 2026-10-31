import { NavigationType, type NavigateFunction } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusesMain } from '~/app/navigationFocus';
import { FLIGHT_MS, FOCUS_AT_REST, moveFocus } from '~/scene/bob/focus';
import { INSIDE_STATE } from '~/scene/bob/inside';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { frame } from '~/state/frame';
import { insideInHistory, noteOpenedFrom, placeForProject, resetRouteSync, stopForProject, syncRoute } from '~/state/routeSync';
import { useScene } from '~/state/store';
import { clickOnWorld, closeInside, lendOpener, openInside, turnInside, viewInside } from '~/ui/projectOpen';

// An open project through the history (src/ui/projectOpen.tsx): its own entry on the home, every way out, the arrows
// round the end, and its page from it; the page over it is src/ui/ProjectView.tsx's.
describe('openInside, turnInside, closeInside and viewInside: an open project through the history', () => {
  const doc = (globalThis as { document?: unknown }).document;
  const attributes = new Set<string>();
  const root = {
    setAttribute: (name: string) => void attributes.add(name),
    removeAttribute: (name: string) => void attributes.delete(name),
    toggleAttribute: (name: string, on: boolean) => (on ? attributes.add(name) : attributes.delete(name), on)
  };
  const A0 = stopForProject('steady');
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
    useScene.setState({ phase: { kind: 'PROJECTS', category: 'app' }, scene: 'home' });
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
    expect(openInside('steady')).toBe(true);
    expect(useScene.getState().inside).toBe('steady');
    expect(frame.focus.move).toMatchObject({ to: 'steady', mode: 'fly' });
    expect(went).toEqual([['/', { state: { [INSIDE_STATE]: 'steady' }, preventScrollReset: true }]]);
    // A second click while open opens nothing more.
    expect(openInside('steady')).toBe(false);
    // The push lands as a navigation of its own: no focus is taken to <main>, the controls keep it.
    expect(focusesMain(NavigationType.Push, '', { [INSIDE_STATE]: 'steady' })).toBe(false);
    expect(focusesMain(NavigationType.Push, '', null)).toBe(true);
  });

  it('opens a project clicked on the world only at rest; while the camera glides between two stops a click does nothing', () => {
    frame.target = stopForProject('jontai-energy'); // on its way to the next area
    expect(clickOnWorld('steady')).toBe(false);
    expect(useScene.getState().inside).toBeNull();
    expect(frame.focus.opening).toBeNull();
    vi.advanceTimersByTime(FLIGHT_MS * 2);
    expect(went).toEqual([]);
    frame.target = frame.progress; // at rest
    expect(clickOnWorld('steady')).toBe(true);
    expect(useScene.getState().inside).toBe('steady');
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
    openInside('steady');
    syncRoute({ pathname: '/', key: 'k1', state: { [INSIDE_STATE]: 'steady' } }, NavigationType.Push);
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
    useScene.getState().setInside('steady');
    closeInside();
    expect(useScene.getState().inside).toBeNull();
    expect(went).toEqual([-1]);
  });

  it('opens the project\'s page from "Bekijk project"', () => {
    noteOpenedFrom('steady', A0);
    frame.focus.move = moveFocus(frame.focus.move, 'steady', performance.now() - 2 * FLIGHT_MS, 'fly'); // flown in
    useScene.getState().setInside('steady');
    expect(viewInside()).toBe(true);
    vi.advanceTimersByTime(0); // the camera is already there: the page comes at once
    expect(went).toEqual(['/projects/steady/']);
    expect(attributes.has('data-bead-open')).toBe(true); // its text fades in with its scrim
    // With no project open there is nothing to view.
    useScene.getState().setInside(null);
    frame.focus.opening = null;
    expect(viewInside()).toBe(false);
  });
});
