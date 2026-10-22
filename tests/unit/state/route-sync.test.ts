import { createMemoryRouter, NavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { frame } from '../../../src/state/frame';
import { arrivedDirectly, backTarget, pathForPhase, phaseForPath, resetRouteSync, syncRoute } from '../../../src/state/routeSync';
import { useScene } from '../../../src/state/store';

describe('phaseForPath', () => {
  it('has no phase for the old country addresses: they are no page now', () => {
    expect(phaseForPath('/about/china/')).toBeNull();
    expect(phaseForPath('/en/about/aruba/')).toBeNull();
    expect(phaseForPath('/about/netherlands/')).toBeNull();
  });

  it('reads a project page', () => {
    expect(phaseForPath('/projects/funcial/')).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
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
    expect(phaseForPath('/Projects/Funcial/')).toBeNull();
    expect(phaseForPath('/en/projects/FUNCIAL/')).toBeNull();
    expect(phaseForPath('/about/')).toBeNull();
    expect(phaseForPath('/projects/')).toBeNull();
  });

  it('reads a path without its trailing slash', () => {
    expect(phaseForPath('/projects/funcial')).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
  });
});

describe('pathForPhase', () => {
  it('gives the page of a project', () => {
    expect(pathForPhase({ kind: 'PROJECT_FOCUS', id: 'funcial' }, 'nl')).toBe('/projects/funcial/');
    expect(pathForPhase({ kind: 'PROJECT_FOCUS', id: 'cookies-clicker' }, 'en')).toBe('/en/projects/cookies-clicker/');
  });

  it('gives nothing for a project that has no page', () => {
    expect(pathForPhase({ kind: 'PROJECT_FOCUS', id: 'nope' }, 'nl')).toBeNull();
  });

  it('gives nothing for the phases that live on the home page', () => {
    expect(pathForPhase({ kind: 'LOADING' }, 'nl')).toBeNull();
    expect(pathForPhase({ kind: 'HOME_IDLE' }, 'nl')).toBeNull();
    expect(pathForPhase({ kind: 'DIVE' }, 'en')).toBeNull();
    expect(pathForPhase({ kind: 'VOID_ENTRY' }, 'nl')).toBeNull();
    expect(pathForPhase({ kind: 'PROJECTS', category: null }, 'en')).toBeNull();
  });

  it('is the inverse of phaseForPath for the pages', () => {
    for (const locale of ['nl', 'en'] as const) {
      for (const phase of [phaseForPath('/projects/funcial/'), phaseForPath('/projects/jontai-energy/')]) {
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
    syncRoute({ pathname: '/en/projects/funcial/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
    expect(useScene.getState().transitionId).toBe(1);
  });

  it('does nothing for an old country address: it is no page, and the scene stays loading', () => {
    syncRoute({ pathname: '/about/china/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'LOADING' });
    expect(useScene.getState().transitionId).toBe(0);
  });

  it('keeps the phase, and the transition, when only the language changes', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'a' });
    const phase = useScene.getState().phase;
    const id = useScene.getState().transitionId;
    syncRoute({ pathname: '/en/projects/funcial/', key: 'b' });
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

  it('lets the scroll decide when a page is left for the home page', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'a' });
    syncRoute({ pathname: '/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it('puts the scene back on the chapter the scroll is in', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'a' });
    frame.progress = 4.2;
    frame.chapterIndex = 4;
    syncRoute({ pathname: '/en/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'front-panel' });
  });

  it('puts the scene in the dive when the scroll is part way through it (progress 1.5)', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'a' });
    frame.progress = 1.5;
    frame.chapterIndex = 1;
    syncRoute({ pathname: '/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'DIVE' });
  });

  it('puts the scene in the overview when the scroll rests at its stop (progress 2)', () => {
    syncRoute({ pathname: '/projects/cookies-clicker/', key: 'a' });
    frame.progress = 2;
    frame.chapterIndex = 2;
    syncRoute({ pathname: '/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'VOID_ENTRY' });
  });

  it('lets the scroll decide when a page is left for a page without a scene', () => {
    syncRoute({ pathname: '/projects/cookies-clicker/', key: 'a' });
    syncRoute({ pathname: '/contact/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it('moves from one page to another', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'a' });
    syncRoute({ pathname: '/projects/cookies-clicker/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'cookies-clicker' });
  });
});

describe('arrivedDirectly', () => {
  beforeEach(resetRouteSync);
  afterEach(resetRouteSync);

  it('is true before anything has been shown, and on the page the document loaded on', () => {
    expect(arrivedDirectly()).toBe(true);
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('is false on a page reached by client navigation', () => {
    syncRoute({ pathname: '/', key: 'default' });
    syncRoute({ pathname: '/projects/funcial/', key: 'k1' });
    expect(arrivedDirectly()).toBe(false);
  });

  it('is true again on the entry the document loaded on, after going back to it', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    syncRoute({ pathname: '/', key: 'k1' });
    expect(arrivedDirectly()).toBe(false);
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('counts a reload on a later history entry as a direct arrival', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'k7' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('does not change when the same location is synced again', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
    syncRoute({ pathname: '/projects/funcial/', key: 'default' });
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
      syncRoute({ pathname: '/projects/funcial/', key: 'default' }, NavigationType.Pop);
      syncRoute({ pathname: '/en/projects/funcial/', key: 'r1' }, NavigationType.Replace);
      syncRoute({ pathname: '/projects/funcial/', key: 'r2' }, NavigationType.Replace);
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
      syncRoute({ pathname: '/projects/funcial/', key: 'k1' }, NavigationType.Push);
      syncRoute({ pathname: '/en/projects/funcial/', key: 'r1' }, NavigationType.Replace);
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
      syncRoute({ pathname: '/projects/funcial/', key: 'k1' });
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
    await router.navigate('/projects/funcial/');
    expect(router.state.historyAction).toBe('PUSH');
    expect(router.state.location.key).not.toBe(first);
    router.dispose();
  });
});
