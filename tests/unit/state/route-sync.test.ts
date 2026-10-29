import { createMemoryRouter, NavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projects } from '../../../src/data/projects';
import { areaStop, chapterAt, HOME_CHAPTERS, keyStops, pathStart, lookStop } from '../../../src/state/chapters';
import { frame } from '../../../src/state/frame';
import {
  arrivedDirectly,
  BACK_STATE,
  backTarget,
  isBackState,
  noteOpenedFrom,
  pathForPhase,
  phaseForPath,
  placeForProject,
  resetRouteSync,
  stopForProject,
  syncRoute
} from '../../../src/state/routeSync';
import { useScene } from '../../../src/state/store';

/** The path's start (way frame 256), and each project's area stop: the camera at rest on its area. */
const L = pathStart(HOME_CHAPTERS);
const F = L + 2.78;
const J = L + 4.18;
const C = L + 5.58;

describe('phaseForPath', () => {
  it('has no phase for the old country addresses: they are no page now', () => {
    expect(phaseForPath('/about/china/')).toBeNull();
    expect(phaseForPath('/en/about/aruba/')).toBeNull();
    expect(phaseForPath('/about/netherlands/')).toBeNull();
  });

  it('reads a project page', () => {
    expect(phaseForPath('/projects/steady/')).toEqual({ kind: 'PROJECT_FOCUS', id: 'steady' });
    expect(phaseForPath('/en/projects/jontai-energy/')).toEqual({ kind: 'PROJECT_FOCUS', id: 'jontai-energy' });
  });

  it('leaves the home page to the scroll', () => {
    expect(phaseForPath('/')).toBeNull();
    expect(phaseForPath('/en/')).toBeNull();
  });

  it('has no phase for the pages without a scene', () => {
    expect(phaseForPath('/lite/')).toBeNull();
    expect(phaseForPath('/en/contact/')).toBeNull();
    expect(phaseForPath('/does-not-exist/')).toBeNull();
  });

  it('does not take a page under another spelling for the page, and does not throw', () => {
    expect(phaseForPath('/Projects/Steady/')).toBeNull();
    expect(phaseForPath('/en/projects/FUNCIAL/')).toBeNull();
    expect(phaseForPath('/about/')).toBeNull();
    expect(phaseForPath('/projects/')).toBeNull();
  });

  it('reads a path without its trailing slash', () => {
    expect(phaseForPath('/projects/steady')).toEqual({ kind: 'PROJECT_FOCUS', id: 'steady' });
  });
});

describe('pathForPhase', () => {
  it('gives the page of a project', () => {
    expect(pathForPhase({ kind: 'PROJECT_FOCUS', id: 'steady' }, 'nl')).toBe('/projects/steady/');
    expect(pathForPhase({ kind: 'PROJECT_FOCUS', id: 'cookies-clicker' }, 'en')).toBe('/en/projects/cookies-clicker/');
  });

  it('gives nothing for a project that has no page', () => {
    expect(pathForPhase({ kind: 'PROJECT_FOCUS', id: 'nope' }, 'nl')).toBeNull();
  });

  it('gives nothing for the phases that live on the home page', () => {
    expect(pathForPhase({ kind: 'LOADING' }, 'nl')).toBeNull();
    expect(pathForPhase({ kind: 'HOME_IDLE' }, 'nl')).toBeNull();
    expect(pathForPhase({ kind: 'LIGHT' }, 'en')).toBeNull();
    expect(pathForPhase({ kind: 'PROJECTS', category: null }, 'en')).toBeNull();
  });

  it('is the inverse of phaseForPath for the pages', () => {
    for (const locale of ['nl', 'en'] as const) {
      for (const phase of [phaseForPath('/projects/steady/'), phaseForPath('/projects/jontai-energy/')]) {
        const path = pathForPhase(phase!, locale);
        expect(path).not.toBeNull();
        expect(phaseForPath(path!)).toEqual(phase);
      }
    }
  });
});

describe('backTarget', () => {
  it('goes home after a direct arrival and back through the history otherwise', () => {
    expect(backTarget(true)).toBe('home');
    expect(backTarget(false)).toBe('history');
  });
});

describe('syncRoute', () => {
  beforeEach(() => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = 0;
    frame.target = 0;
    frame.chapterIndex = 0;
  });
  afterEach(resetRouteSync);

  it('dispatches the page phase of a project page', () => {
    syncRoute({ pathname: '/en/projects/steady/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'steady' });
    expect(useScene.getState().transitionId).toBe(1);
  });

  it('does nothing for an old country address: it is no page, and the scene stays loading', () => {
    syncRoute({ pathname: '/about/china/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'LOADING' });
    expect(useScene.getState().transitionId).toBe(0);
  });

  it('keeps the phase, and the transition, when only the language changes', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    const phase = useScene.getState().phase;
    const id = useScene.getState().transitionId;
    syncRoute({ pathname: '/en/projects/steady/', key: 'b' });
    expect(useScene.getState().phase).toBe(phase);
    expect(useScene.getState().transitionId).toBe(id);
  });

  it('does nothing on the home page of a fresh load', () => {
    syncRoute({ pathname: '/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'LOADING' });
    expect(useScene.getState().transitionId).toBe(0);
  });

  it('does nothing for a page without a scene while the scene is not on a page', () => {
    useScene.getState().dispatch({ type: 'LOADED' });
    const phase = useScene.getState().phase;
    syncRoute({ pathname: '/lite/', key: 'x' });
    expect(useScene.getState().phase).toBe(phase);
  });

  it("puts the scene at the project's own stop when its page is left for the home page by Back (a history pop)", () => {
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    syncRoute({ pathname: '/', key: 'b' }, NavigationType.Pop);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'app' });
    expect(frame.target).toBeCloseTo(F, 9);
  });

  it('lets the scroll start at the home when a page is left for the home page by a link', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    syncRoute({ pathname: '/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
    expect(frame.target).toBe(0);
  });

  it('puts the scene back on the chapter the scroll is in when a page is left for a page without a scene', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    frame.progress = L + 4.0; // Jontai Energy's arrival
    frame.chapterIndex = 5;
    syncRoute({ pathname: '/en/lite/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'website' });
    expect(frame.progress).toBe(L + 4.0);
  });

  it('puts the scene in the light dive when the scroll is part way through it (progress 2.5) and a page is left for Lite', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    frame.progress = 2.5;
    frame.chapterIndex = 1;
    syncRoute({ pathname: '/lite/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'LIGHT' });
  });

  it('puts the scene on the sheet when the scroll is part way up it (the fade to black) and a page is left for contact', () => {
    syncRoute({ pathname: '/projects/cookies-clicker/', key: 'a' });
    frame.progress = lookStop(HOME_CHAPTERS) + 0.5;
    frame.chapterIndex = 9;
    syncRoute({ pathname: '/contact/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: null });
  });

  it('lets the scroll decide when a page is left for a page without a scene', () => {
    syncRoute({ pathname: '/projects/cookies-clicker/', key: 'a' });
    syncRoute({ pathname: '/contact/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it('moves from one page to another', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    syncRoute({ pathname: '/projects/cookies-clicker/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'cookies-clicker' });
  });
});

describe('stopForProject', () => {
  it("gives each project on the way its area's stop: in its area, the camera at rest on it", () => {
    expect(stopForProject('steady')).toBeCloseTo(F, 9);
    expect(stopForProject('jontai-energy')).toBeCloseTo(J, 9);
    expect(stopForProject('cookies-clicker')).toBeCloseTo(C, 9);
  });

  it("reads them from the chapters, each one of the keys' stops", () => {
    for (const project of projects.all()) {
      expect(stopForProject(project.id)).toBe(areaStop(HOME_CHAPTERS, project.categoryId));
      expect(keyStops(HOME_CHAPTERS)).toContain(stopForProject(project.id));
    }
  });
});

describe('placeForProject', () => {
  beforeEach(resetRouteSync);
  afterEach(resetRouteSync);

  it('comes back to the place a bead was opened from, else to its arrival', () => {
    expect(placeForProject('jontai-energy')).toBeCloseTo(J, 9);
    noteOpenedFrom('jontai-energy', L + 4.3);
    expect(placeForProject('jontai-energy')).toBeCloseTo(L + 4.3, 9);
    expect(placeForProject('steady')).toBeCloseTo(F, 9);
    noteOpenedFrom('steady', L + 7.6);
    expect(placeForProject('jontai-energy')).toBeCloseTo(J, 9);
  });

  it('brings Back from a page opened at a bead to that very place', () => {
    useScene.setState(useScene.getInitialState(), true);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    useScene.getState().dispatch({ type: 'LOADED' });
    noteOpenedFrom('jontai-energy', L + 4.0); // at Jontai Energy's arrival
    syncRoute({ pathname: '/projects/jontai-energy/', key: 'k1' }, NavigationType.Push);
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    expect([frame.target, frame.progress]).toEqual([L + 4.0, L + 4.0]);
  });
});

describe('syncRoute: Back from a project page', () => {
  beforeEach(() => {
    resetRouteSync();
    useScene.setState(useScene.getInitialState(), true);
    frame.progress = 0;
    frame.target = 0;
    frame.velocity = 0;
    frame.chapterIndex = 0;
    frame.focus.opening = null;
  });
  afterEach(resetRouteSync);

  it("puts the target and the progress at that project's stop when the visit began elsewhere (the home, at its start)", () => {
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop); // the visit began at the home, at 0
    useScene.getState().dispatch({ type: 'LOADED' });
    syncRoute({ pathname: '/projects/jontai-energy/', key: 'k1' }, NavigationType.Push); // the home's link
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop); // Back
    expect(frame.target).toBeCloseTo(J, 9);
    expect(frame.progress).toBeCloseTo(J, 9);
    expect(frame.velocity).toBe(0);
    expect(frame.chapterIndex).toBe(chapterAt(HOME_CHAPTERS, J).index);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'website' });
  });

  it("does the same for the page's own Escape after a direct arrival, which pushes the home page with BACK_STATE", () => {
    syncRoute({ pathname: '/en/projects/cookies-clicker/', key: 'default' }, NavigationType.Pop);
    syncRoute({ pathname: '/en/', key: 'k1', state: BACK_STATE }, NavigationType.Push);
    expect(frame.target).toBeCloseTo(C, 9);
    expect(frame.progress).toBeCloseTo(C, 9);
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'game' });
  });

  it("lands on the stop of the page's own project, wherever the scroll was before it", () => {
    frame.progress = frame.target = 1.2;
    frame.chapterIndex = 1;
    syncRoute({ pathname: '/', key: 'default' });
    syncRoute({ pathname: '/projects/steady/', key: 'k1' });
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    expect(frame.target).toBeCloseTo(F, 9);
    expect(frame.progress).toBe(frame.target);
  });

  it("lands the header's name link, and any other link home, at the home: stop 0, wherever the story was", () => {
    // A bead opened from its stop: the story is at Jontai Energy's 5 while its page is up.
    syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
    useScene.getState().dispatch({ type: 'LOADED' });
    frame.progress = frame.target = 5;
    frame.chapterIndex = 3;
    syncRoute({ pathname: '/projects/jontai-energy/', key: 'k1' }, NavigationType.Push);
    syncRoute({ pathname: '/', key: 'k2' }, NavigationType.Push); // the name link: a push, no BACK_STATE
    expect([frame.target, frame.progress, frame.chapterIndex]).toEqual([0, 0, 0]);
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
    // A replace, or a state that is not the page's own Back, is a link too.
    syncRoute({ pathname: '/projects/steady/', key: 'k3' }, NavigationType.Push);
    syncRoute({ pathname: '/en/', key: 'k4', state: { back: 'yes' } }, NavigationType.Push);
    expect(frame.target).toBe(0);
  });

  it('tells the page\'s own Back state apart from any other state', () => {
    expect(isBackState(BACK_STATE)).toBe(true);
    expect(isBackState({ back: true })).toBe(true);
    for (const other of [null, undefined, 'back', { back: 'yes' }, {}, 1]) expect(isBackState(other)).toBe(false);
  });

  it('leaves the story where it is when a project page is left for a page without a scene', () => {
    frame.progress = frame.target = 0.5;
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    syncRoute({ pathname: '/lite/', key: 'b' });
    expect([frame.target, frame.progress]).toEqual([0.5, 0.5]);
  });

  it('moves nothing when the home page is reached from a page that is not a project page', () => {
    frame.progress = frame.target = 2;
    frame.chapterIndex = 2;
    syncRoute({ pathname: '/contact/', key: 'a' });
    useScene.getState().dispatch({ type: 'LOADED' });
    syncRoute({ pathname: '/', key: 'b' });
    expect([frame.target, frame.progress]).toEqual([2, 2]);
  });

  it("lets go of a bead being opened at any navigation: its flight has landed on the page, or the visit went elsewhere", () => {
    frame.focus.opening = 'steady';
    syncRoute({ pathname: '/projects/steady/', key: 'a' });
    expect(frame.focus.opening).toBeNull();
  });
});

describe('arrivedDirectly', () => {
  beforeEach(resetRouteSync);
  afterEach(resetRouteSync);

  it('is true before anything has been shown, and on the page the document loaded on', () => {
    expect(arrivedDirectly()).toBe(true);
    syncRoute({ pathname: '/projects/steady/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('is false on a page reached by client navigation', () => {
    syncRoute({ pathname: '/', key: 'default' });
    syncRoute({ pathname: '/projects/steady/', key: 'k1' });
    expect(arrivedDirectly()).toBe(false);
  });

  it('is true again on the entry the document loaded on, after going back to it', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'default' });
    syncRoute({ pathname: '/', key: 'k1' });
    expect(arrivedDirectly()).toBe(false);
    syncRoute({ pathname: '/projects/steady/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('counts a reload on a later history entry as a direct arrival', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'k7' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('does not change when the same location is synced again', () => {
    syncRoute({ pathname: '/projects/steady/', key: 'default' });
    syncRoute({ pathname: '/projects/steady/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  describe('a replace navigation (the entry keeps its place in the history and gets a new key)', () => {
    it('keeps a direct arrival direct when it replaces the entry the document loaded on', () => {
      // The contact form's ?sent=1 to /contact/, and the language switch.
      syncRoute({ pathname: '/contact/', key: 'default' }, NavigationType.Pop);
      syncRoute({ pathname: '/contact/', key: 'r1' }, NavigationType.Replace);
      expect(arrivedDirectly()).toBe(true);
    });

    it('follows the loaded entry through several replaces', () => {
      syncRoute({ pathname: '/projects/steady/', key: 'default' }, NavigationType.Pop);
      syncRoute({ pathname: '/en/projects/steady/', key: 'r1' }, NavigationType.Replace);
      syncRoute({ pathname: '/projects/steady/', key: 'r2' }, NavigationType.Replace);
      expect(arrivedDirectly()).toBe(true);
    });

    it('is still the entry the document loaded on after leaving it and coming back', () => {
      syncRoute({ pathname: '/contact/', key: 'default' }, NavigationType.Pop);
      syncRoute({ pathname: '/contact/', key: 'r1' }, NavigationType.Replace);
      syncRoute({ pathname: '/', key: 'k2' }, NavigationType.Push);
      expect(arrivedDirectly()).toBe(false);
      syncRoute({ pathname: '/contact/', key: 'r1' }, NavigationType.Pop);
      expect(arrivedDirectly()).toBe(true);
    });

    it('does not move the loaded entry when some other entry is replaced', () => {
      syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
      syncRoute({ pathname: '/projects/steady/', key: 'k1' }, NavigationType.Push);
      syncRoute({ pathname: '/en/projects/steady/', key: 'r1' }, NavigationType.Replace);
      expect(arrivedDirectly()).toBe(false);
      syncRoute({ pathname: '/', key: 'default' }, NavigationType.Pop);
      expect(arrivedDirectly()).toBe(true);
    });

    it('takes a replace on the very first sync for the first entry', () => {
      syncRoute({ pathname: '/contact/', key: 'r1' }, NavigationType.Replace);
      expect(arrivedDirectly()).toBe(true);
    });

    it('is not told apart from a push when the type is not given', () => {
      syncRoute({ pathname: '/', key: 'default' });
      syncRoute({ pathname: '/projects/steady/', key: 'k1' });
      expect(arrivedDirectly()).toBe(false);
    });
  });
});

describe('React Router and the entry key', () => {
  it('gives a replaced entry a new key and reports REPLACE, which is why syncRoute needs the navigation type', async () => {
    const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: ['/contact/?sent=1'] });
    const first = router.state.location.key;
    await router.navigate({ pathname: '/contact/', search: '' }, { replace: true });
    expect(router.state.historyAction).toBe('REPLACE');
    expect(router.state.location.key).not.toBe(first);
    expect(router.state.location.pathname).toBe('/contact/');
    router.dispose();
  });

  it('gives a pushed entry a new key and reports PUSH', async () => {
    const router = createMemoryRouter([{ path: '*', element: null }], { initialEntries: ['/'] });
    const first = router.state.location.key;
    await router.navigate('/projects/steady/');
    expect(router.state.historyAction).toBe('PUSH');
    expect(router.state.location.key).not.toBe(first);
    router.dispose();
  });
});
