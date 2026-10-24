import { describe, expect, it } from 'vitest';
import type { ChapterId } from '../../../src/state/chapters';
import { SCROLL_PHASES, samePhase, transition, type Phase, type SceneEvent } from '../../../src/state/machine';

const LOADING: Phase = { kind: 'LOADING' };
const HOME: Phase = { kind: 'HOME_IDLE' };
const DIVE: Phase = { kind: 'DIVE' };
const VOID: Phase = { kind: 'VOID_ENTRY' };
const PROJECTS: Phase = { kind: 'PROJECTS', category: 'front-panel' };
const END: Phase = { kind: 'END' };
const PROJECT: Phase = { kind: 'PROJECT_FOCUS', id: 'funcial' };

const ALL: Phase[] = [LOADING, HOME, DIVE, VOID, PROJECTS, END, PROJECT];
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
    expect(transition(HOME, chapter('DIVE'))).toEqual({ kind: 'DIVE' });
    expect(transition(DIVE, chapter('VOID_ENTRY'))).toEqual({ kind: 'VOID_ENTRY' });
    expect(transition(VOID, chapter('HOME'))).toEqual({ kind: 'HOME_IDLE' });
    expect(transition(DIVE, chapter('HOME'))).toEqual({ kind: 'HOME_IDLE' });
    expect(transition(VOID, chapter('DIVE'))).toEqual({ kind: 'DIVE' });
  });

  it('carries the category into PROJECTS and follows it from one category to the next', () => {
    expect(transition(VOID, chapter('PROJECTS', 'secure-element'))).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
    expect(transition(PROJECTS, chapter('PROJECTS', 'oscillator'))).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
  });

  it('takes the last project to the end page and back', () => {
    const oscillator: Phase = { kind: 'PROJECTS', category: 'oscillator' };
    expect(transition(oscillator, chapter('END'))).toEqual({ kind: 'END' });
    expect(transition(END, chapter('PROJECTS', 'oscillator'))).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
    expect(transition(END, chapter('HOME'))).toEqual({ kind: 'HOME_IDLE' });
  });

  it('applies from HOME_IDLE, DIVE, VOID_ENTRY, PROJECTS and END', () => {
    for (const phase of [HOME, VOID, PROJECTS, END]) {
      expect(transition(phase, chapter('DIVE')), phase.kind).toEqual({ kind: 'DIVE' });
    }
    for (const phase of [HOME, DIVE, VOID, PROJECTS, END]) {
      expect(transition(phase, chapter('PROJECTS', 'oscillator')), phase.kind).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
    }
  });

  it('is ignored while loading and on a page', () => {
    for (const phase of [LOADING, PROJECT]) expect(transition(phase, chapter('DIVE')), phase.kind).toBe(phase);
  });

  it('returns the same object when the chapter is the one already shown', () => {
    expect(transition(HOME, chapter('HOME'))).toBe(HOME);
    expect(transition(DIVE, chapter('DIVE'))).toBe(DIVE);
    expect(transition(VOID, chapter('VOID_ENTRY'))).toBe(VOID);
    expect(transition(PROJECTS, chapter('PROJECTS', 'front-panel'))).toBe(PROJECTS);
    expect(transition(END, chapter('END'))).toBe(END);
  });
});

describe('SCROLL_PHASES', () => {
  it('are the phases the scroll moves through: HOME_IDLE, DIVE, VOID_ENTRY, PROJECTS and END', () => {
    expect([...SCROLL_PHASES].sort()).toEqual(['DIVE', 'END', 'HOME_IDLE', 'PROJECTS', 'VOID_ENTRY']);
    expect(SCROLL_PHASES.has('END')).toBe(true);
  });

  it('are the phases a CHAPTER event applies from, and no others', () => {
    // A CHAPTER event for the last project takes every scroll phase there and leaves the others (LOADING, a project page) where they are.
    for (const phase of ALL) {
      const next = transition(phase, chapter('PROJECTS', 'oscillator'));
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
    for (const phase of [LOADING, HOME, DIVE, VOID, PROJECTS, END]) expect(transition(phase, { type: 'BACK' }), phase.kind).toBe(phase);
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
    expect(transition(DIVE, { type: 'BACK' })).toBe(DIVE);
  });

  it('leave the phase it was given untouched', () => {
    const phase: Phase = { kind: 'DIVE' };
    transition(phase, { type: 'OPEN_PROJECT', id: 'funcial' });
    transition(phase, { type: 'BACK' });
    expect(phase).toEqual({ kind: 'DIVE' });
  });
});

describe('samePhase', () => {
  it('compares kind and the fields the kind carries', () => {
    expect(samePhase({ kind: 'HOME_IDLE' }, { kind: 'HOME_IDLE' })).toBe(true);
    expect(samePhase({ kind: 'HOME_IDLE' }, { kind: 'DIVE' })).toBe(false);
    expect(samePhase({ kind: 'DIVE' }, { kind: 'DIVE' })).toBe(true);
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
