import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { frame } from '../../../src/state/frame';
import { arrivedDirectly, backTarget, pathForPhase, phaseForPath, resetRouteSync, syncRoute } from '../../../src/state/routeSync';
import { useScene } from '../../../src/state/store';

describe('phaseForPath', () => {
  it('reads a country page', () => {
    expect(phaseForPath('/about/china/')).toEqual({ kind: 'COUNTRY_PAGE', dir: 'china' });
    expect(phaseForPath('/en/about/aruba/')).toEqual({ kind: 'COUNTRY_PAGE', dir: 'aruba' });
    expect(phaseForPath('/about/netherlands/')).toEqual({ kind: 'COUNTRY_PAGE', dir: 'netherlands' });
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
    expect(phaseForPath('/About/China/')).toBeNull();
    expect(phaseForPath('/en/projects/FUNCIAL/')).toBeNull();
    expect(phaseForPath('/about/')).toBeNull();
    expect(phaseForPath('/projects/')).toBeNull();
  });

  it('reads a path without its trailing slash', () => {
    expect(phaseForPath('/about/china')).toEqual({ kind: 'COUNTRY_PAGE', dir: 'china' });
  });
});

describe('pathForPhase', () => {
  it('gives the page of a country in the locale asked', () => {
    expect(pathForPhase({ kind: 'COUNTRY_PAGE', dir: 'china' }, 'en')).toBe('/en/about/china/');
    expect(pathForPhase({ kind: 'COUNTRY_PAGE', dir: 'aruba' }, 'nl')).toBe('/about/aruba/');
  });

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
    expect(pathForPhase({ kind: 'FOCUS_COUNTRY', dir: 'china' }, 'nl')).toBeNull();
    expect(pathForPhase({ kind: 'DISSECT' }, 'en')).toBeNull();
    expect(pathForPhase({ kind: 'PROJECTS', category: null }, 'en')).toBeNull();
  });

  it('is the inverse of phaseForPath for the pages', () => {
    for (const locale of ['nl', 'en'] as const) {
      for (const phase of [phaseForPath('/about/netherlands/'), phaseForPath('/projects/jontai-energy/')]) {
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

  it('dispatches the page phase of a country page', () => {
    syncRoute({ pathname: '/about/china/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'COUNTRY_PAGE', dir: 'china' });
    expect(useScene.getState().transitionId).toBe(1);
  });

  it('dispatches the page phase of a project page', () => {
    syncRoute({ pathname: '/en/projects/funcial/', key: 'default' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECT_FOCUS', id: 'funcial' });
  });

  it('keeps the phase, and the transition, when only the language changes', () => {
    syncRoute({ pathname: '/about/china/', key: 'a' });
    const phase = useScene.getState().phase;
    const id = useScene.getState().transitionId;
    syncRoute({ pathname: '/en/about/china/', key: 'b' });
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
    syncRoute({ pathname: '/about/china/', key: 'a' });
    syncRoute({ pathname: '/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it('puts the scene back on the chapter the scroll is in', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'a' });
    frame.progress = 16.2;
    frame.chapterIndex = 5;
    syncRoute({ pathname: '/en/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'PROJECTS', category: 'front-panel' });
  });

  it('lets the scroll decide when a page is left for a page without a scene', () => {
    syncRoute({ pathname: '/about/aruba/', key: 'a' });
    syncRoute({ pathname: '/contact/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'HOME_IDLE' });
  });

  it('moves from one page to another', () => {
    syncRoute({ pathname: '/about/china/', key: 'a' });
    syncRoute({ pathname: '/about/aruba/', key: 'b' });
    expect(useScene.getState().phase).toEqual({ kind: 'COUNTRY_PAGE', dir: 'aruba' });
  });
});

describe('arrivedDirectly', () => {
  beforeEach(resetRouteSync);
  afterEach(resetRouteSync);

  it('is true before anything has been shown, and on the page the document loaded on', () => {
    expect(arrivedDirectly()).toBe(true);
    syncRoute({ pathname: '/about/china/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('is false on a page reached by client navigation', () => {
    syncRoute({ pathname: '/', key: 'default' });
    syncRoute({ pathname: '/about/china/', key: 'k1' });
    expect(arrivedDirectly()).toBe(false);
  });

  it('is true again on the entry the document loaded on, after going back to it', () => {
    syncRoute({ pathname: '/about/china/', key: 'default' });
    syncRoute({ pathname: '/', key: 'k1' });
    expect(arrivedDirectly()).toBe(false);
    syncRoute({ pathname: '/about/china/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('counts a reload on a later history entry as a direct arrival', () => {
    syncRoute({ pathname: '/projects/funcial/', key: 'k7' });
    expect(arrivedDirectly()).toBe(true);
  });

  it('does not change when the same location is synced again', () => {
    syncRoute({ pathname: '/about/china/', key: 'default' });
    syncRoute({ pathname: '/about/china/', key: 'default' });
    expect(arrivedDirectly()).toBe(true);
  });
});
