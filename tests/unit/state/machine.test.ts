import { describe, expect, it } from 'vitest';
import type { ChapterId } from '../../../src/state/chapters';
import { samePhase, transition, type Phase, type SceneEvent } from '../../../src/state/machine';

const LOADING: Phase = { kind: 'LOADING' };
const HOME: Phase = { kind: 'HOME_IDLE' };
const DISSECT: Phase = { kind: 'DISSECT' };
const MORPH: Phase = { kind: 'MORPH' };
const VOID: Phase = { kind: 'VOID_ENTRY' };
const PROJECTS: Phase = { kind: 'PROJECTS', category: 'front-panel' };
const PROJECT: Phase = { kind: 'PROJECT_FOCUS', id: 'funcial' };

const ALL: Phase[] = [LOADING, HOME, DISSECT, MORPH, VOID, PROJECTS, PROJECT];
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
    expect(transition(HOME, chapter('DISSECT'))).toEqual({ kind: 'DISSECT' });
    expect(transition(DISSECT, chapter('MORPH'))).toEqual({ kind: 'MORPH' });
    expect(transition(MORPH, chapter('VOID_ENTRY'))).toEqual({ kind: 'VOID_ENTRY' });
    expect(transition(VOID, chapter('HOME'))).toEqual({ kind: 'HOME_IDLE' });
  });

  it('carries the category into PROJECTS and follows it from one category to the next', () => {
    expect(transition(VOID, chapter('PROJECTS', 'secure-element'))).toEqual({ kind: 'PROJECTS', category: 'secure-element' });
    expect(transition(PROJECTS, chapter('PROJECTS', 'oscillator'))).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
  });

  it('applies from HOME_IDLE, DISSECT, MORPH, VOID_ENTRY and PROJECTS', () => {
    for (const phase of [HOME, MORPH, VOID, PROJECTS]) {
      expect(transition(phase, chapter('DISSECT')), phase.kind).toEqual({ kind: 'DISSECT' });
    }
    for (const phase of [HOME, DISSECT, MORPH, VOID, PROJECTS]) {
      expect(transition(phase, chapter('PROJECTS', 'oscillator')), phase.kind).toEqual({ kind: 'PROJECTS', category: 'oscillator' });
    }
  });

  it('is ignored while loading and on a page', () => {
    for (const phase of [LOADING, PROJECT]) expect(transition(phase, chapter('DISSECT')), phase.kind).toBe(phase);
  });

  it('returns the same object when the chapter is the one already shown', () => {
    expect(transition(HOME, chapter('HOME'))).toBe(HOME);
    expect(transition(DISSECT, chapter('DISSECT'))).toBe(DISSECT);
    expect(transition(PROJECTS, chapter('PROJECTS', 'front-panel'))).toBe(PROJECTS);
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
    for (const phase of [LOADING, HOME, DISSECT, MORPH, VOID, PROJECTS]) expect(transition(phase, { type: 'BACK' }), phase.kind).toBe(phase);
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
    expect(transition(DISSECT, { type: 'BACK' })).toBe(DISSECT);
  });

  it('leave the phase it was given untouched', () => {
    const phase: Phase = { kind: 'DISSECT' };
    transition(phase, { type: 'OPEN_PROJECT', id: 'funcial' });
    transition(phase, { type: 'BACK' });
    expect(phase).toEqual({ kind: 'DISSECT' });
  });
});

describe('samePhase', () => {
  it('compares kind and the fields the kind carries', () => {
    expect(samePhase({ kind: 'HOME_IDLE' }, { kind: 'HOME_IDLE' })).toBe(true);
    expect(samePhase({ kind: 'HOME_IDLE' }, { kind: 'DISSECT' })).toBe(false);
    expect(samePhase({ kind: 'PROJECTS', category: null }, { kind: 'PROJECTS', category: 'oscillator' })).toBe(false);
    expect(samePhase({ kind: 'PROJECT_FOCUS', id: 'funcial' }, { kind: 'PROJECT_FOCUS', id: 'funcial' })).toBe(true);
    expect(samePhase({ kind: 'PROJECT_FOCUS', id: 'funcial' }, { kind: 'PROJECT_FOCUS', id: 'jontai-energy' })).toBe(false);
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
