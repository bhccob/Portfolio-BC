import { describe, expect, it } from 'vitest';
import type { ChapterId } from '../../../src/state/chapters';
import { SCROLL_PHASES, samePhase, transition, type Phase, type SceneEvent } from '../../../src/state/machine';

const LOADING: Phase = { kind: 'LOADING' };
const HOME: Phase = { kind: 'HOME_IDLE' };
const LIGHT: Phase = { kind: 'LIGHT' };
const PROJECTS: Phase = { kind: 'PROJECTS', category: 'front-panel' };
const END: Phase = { kind: 'END' };
const PROJECT: Phase = { kind: 'PROJECT_FOCUS', id: 'funcial' };

const ALL: Phase[] = [LOADING, HOME, LIGHT, PROJECTS, END, PROJECT];
const chapter = (id: ChapterId, category: string | null = null): SceneEvent => ({ type: 'CHAPTER', chapter: id, category });

describe('LOADED', () => {
  it('takes LOADING to HOME_IDLE', () => {
    expect(transition(LOADING, { type: 'LOADED' })).toEqual({ kind: 'HOME_IDLE' });
  });

  it('is ignored everywhere else', () => {
    for (const phase of ALL.filter((p) => p.kind !== 'LOADING')) expect(transition(phase, { type: 'LOADED' }), phase.kind).toBe(phase);
  });
});

describe('CHAPTER', () => {
  it('maps each chapter to its phase from the home phases', () => {
    expect(transition(HOME, chapter('LIGHT'))).toEqual({ kind: 'LIGHT' });
    expect(transition(LIGHT, chapter('HOME'))).toEqual({ kind: 'HOME_IDLE' });
  });

  it("takes a travel, an orbit and an inside to PROJECTS with the unit's project, and follows it from one to the next", () => {
    expect(transition(LIGHT, chapter('TRAVEL', 'secure-element'))).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
    expect(transition(LIGHT, chapter('ORBIT', 'front-panel'))).toEqual({ kind: 'PROJECTS', category: 'front-panel' });
    expect(transition(PROJECTS, chapter('INSIDE', 'oscillator'))).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
  });

  it("maps the path's chapters to the projects phase: the look back and the sheet with no project", () => {
    expect(transition({ kind: 'LIGHT' }, chapter('ORBIT', 'front-panel'))).toEqual({ kind: 'PROJECTS', category: 'front-panel' });
    expect(transition({ kind: 'PROJECTS', category: 'oscillator' }, chapter('LOOK'))).toEqual({ kind: 'PROJECTS', category: null });
    expect(transition({ kind: 'PROJECTS', category: null }, chapter('SHEET'))).toEqual({ kind: 'PROJECTS', category: null });
  });

  it('takes the sheet to the end page and back', () => {
    const sheet: Phase = { kind: 'PROJECTS', category: null };
    expect(transition(sheet, chapter('END'))).toEqual({ kind: 'END' });
    expect(transition(END, chapter('SHEET'))).toEqual({ kind: 'PROJECTS', category: null });
    expect(transition(END, chapter('HOME'))).toEqual({ kind: 'HOME_IDLE' });
  });

  it('applies from HOME_IDLE, LIGHT, PROJECTS and END', () => {
    for (const phase of [HOME, PROJECTS, END]) expect(transition(phase, chapter('LIGHT')), phase.kind).toEqual({ kind: 'LIGHT' });
    for (const phase of [HOME, LIGHT, PROJECTS, END]) {
      expect(transition(phase, chapter('ORBIT', 'oscillator')), phase.kind).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
    }
  });

  it('is ignored while loading and on a page', () => {
    for (const phase of [LOADING, PROJECT]) expect(transition(phase, chapter('LIGHT')), phase.kind).toBe(phase);
  });

  it('returns the same object when the chapter is the one already shown', () => {
    expect(transition(HOME, chapter('HOME'))).toBe(HOME);
    expect(transition(LIGHT, chapter('LIGHT'))).toBe(LIGHT);
    expect(transition(PROJECTS, chapter('ORBIT', 'front-panel'))).toBe(PROJECTS);
    expect(transition(END, chapter('END'))).toBe(END);
  });
});

describe('SCROLL_PHASES', () => {
  it('are the phases the scroll moves through: HOME_IDLE, LIGHT, PROJECTS and END', () => {
    expect([...SCROLL_PHASES].sort()).toEqual(['END', 'HOME_IDLE', 'LIGHT', 'PROJECTS']);
    expect(SCROLL_PHASES.has('END')).toBe(true);
  });

  it('are the phases a CHAPTER event applies from, and no others', () => {
    // A CHAPTER event for the last project takes every scroll phase there and leaves the others (LOADING, a project page) where they are.
    for (const phase of ALL) {
      const next = transition(phase, chapter('ORBIT', 'oscillator'));
      expect(samePhase(next, { kind: 'PROJECTS', category: 'oscillator' }), phase.kind).toBe(SCROLL_PHASES.has(phase.kind));
    }
  });
});

describe('OPEN_PROJECT', () => {
  it('gives the project focus from PROJECTS', () => {
    expect(transition(PROJECTS, { type: 'OPEN_PROJECT', id: 'jontai-energy' })).toEqual({ kind: 'PROJECT_FOCUS', id: 'jontai-energy' });
  });

  it('is ignored from every other phase (a URL arrives as ROUTE)', () => {
    for (const phase of ALL.filter((p) => p.kind !== 'PROJECTS')) expect(transition(phase, { type: 'OPEN_PROJECT', id: 'funcial' }), phase.kind).toBe(phase);
  });
});

describe('BACK', () => {
  it('takes a project back to PROJECTS with no category', () => {
    expect(transition(PROJECT, { type: 'BACK' })).toEqual({ kind: 'PROJECTS', category: null });
  });

  it('is ignored from the scroll phases', () => {
    for (const phase of [LOADING, HOME, LIGHT, PROJECTS, END]) expect(transition(phase, { type: 'BACK' }), phase.kind).toBe(phase);
  });
});

describe('ROUTE', () => {
  it('always gives its phase, from every phase', () => {
    const target: Phase = { kind: 'PROJECT_FOCUS', id: 'jontai-energy' };
    for (const phase of ALL) expect(transition(phase, { type: 'ROUTE', phase: target }), phase.kind).toBe(target);
  });
});

describe('ignored events', () => {
  it('return the identical object', () => {
    expect(transition(PROJECT, { type: 'LOADED' })).toBe(PROJECT);
    expect(transition(HOME, { type: 'OPEN_PROJECT', id: 'funcial' })).toBe(HOME);
    expect(transition(LIGHT, { type: 'BACK' })).toBe(LIGHT);
  });

  it('leave the phase it was given untouched', () => {
    const phase: Phase = { kind: 'LIGHT' };
    transition(phase, { type: 'OPEN_PROJECT', id: 'funcial' });
    transition(phase, { type: 'BACK' });
    expect(phase).toEqual({ kind: 'LIGHT' });
  });
});

describe('samePhase', () => {
  it('compares kind and the fields the kind carries', () => {
    expect(samePhase({ kind: 'HOME_IDLE' }, { kind: 'HOME_IDLE' })).toBe(true);
    expect(samePhase({ kind: 'HOME_IDLE' }, { kind: 'LIGHT' })).toBe(false);
    expect(samePhase({ kind: 'LIGHT' }, { kind: 'LIGHT' })).toBe(true);
    expect(samePhase({ kind: 'END' }, { kind: 'END' })).toBe(true);
    expect(samePhase({ kind: 'END' }, { kind: 'PROJECTS', category: 'oscillator' })).toBe(false);
    expect(samePhase({ kind: 'PROJECTS', category: null }, { kind: 'PROJECTS', category: 'oscillator' })).toBe(false);
    expect(samePhase({ kind: 'PROJECT_FOCUS', id: 'funcial' }, { kind: 'PROJECT_FOCUS', id: 'funcial' })).toBe(true);
    expect(samePhase({ kind: 'PROJECT_FOCUS', id: 'funcial' }, { kind: 'PROJECT_FOCUS', id: 'jontai-energy' })).toBe(false);
  });
});

describe('the old chapters are gone', () => {
  it('has no phase for the old parts-dissect or the morph (this file does not compile otherwise)', () => {
    // @ts-expect-error DISSECT is history: it is no phase any more, the stretches are BOB's (rise, dive, overview, projects)
    const dissect: Phase = { kind: 'DISSECT' };
    // @ts-expect-error MORPH is history: it is no phase any more
    const morph: Phase = { kind: 'MORPH' };
    expect([dissect, morph]).toHaveLength(2);
  });

  it('has no chapter id for them either', () => {
    // @ts-expect-error DISSECT is history: no chapter any more
    const dissect: ChapterId = 'DISSECT';
    // @ts-expect-error MORPH is history: no chapter any more
    const morph: ChapterId = 'MORPH';
    expect([dissect, morph]).toHaveLength(2);
  });
});

describe('the countries are gone', () => {
  it('has no country phases: Back from the home phase stays on it', () => {
    expect(transition({ kind: 'HOME_IDLE' }, { type: 'BACK' })).toEqual({ kind: 'HOME_IDLE' });
  });

  it('has no country phase and no country event in its types (this file does not compile otherwise)', () => {
    // @ts-expect-error FOCUS_COUNTRY is no phase any more
    const focus: Phase = { kind: 'FOCUS_COUNTRY', dir: 'china' };
    // @ts-expect-error COUNTRY_PAGE is no phase any more
    const page: Phase = { kind: 'COUNTRY_PAGE', dir: 'china' };
    // @ts-expect-error FOCUS_COUNTRY is no event any more
    const focusEvent: SceneEvent = { type: 'FOCUS_COUNTRY', dir: 'china' };
    // @ts-expect-error OPEN_COUNTRY is no event any more
    const openEvent: SceneEvent = { type: 'OPEN_COUNTRY' };
    expect([focus, page, focusEvent, openEvent]).toHaveLength(4);
  });
});
