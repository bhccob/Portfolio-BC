import type { CountryId } from '~/data/directions';
import type { ChapterId } from './chapters';

/**
 * Where the story is, as a discrete state. Scroll progress is not part of it: that is a number
 * that changes every frame and lives in `frame.ts`; the phase changes when progress crosses a chapter.
 */
export type Phase =
  | { kind: 'LOADING' }
  | { kind: 'HOME_IDLE' }
  | { kind: 'FOCUS_COUNTRY'; dir: CountryId }
  | { kind: 'COUNTRY_PAGE'; dir: CountryId }
  | { kind: 'DISSECT' }
  | { kind: 'MORPH' }
  | { kind: 'VOID_ENTRY' }
  | { kind: 'PROJECTS'; category: string | null }
  | { kind: 'PROJECT_FOCUS'; id: string };

export type SceneEvent =
  | { type: 'LOADED' }
  | { type: 'CHAPTER'; chapter: ChapterId; category: string | null }
  | { type: 'FOCUS_COUNTRY'; dir: CountryId }
  | { type: 'OPEN_COUNTRY' }
  | { type: 'OPEN_PROJECT'; id: string }
  | { type: 'BACK' }
  | { type: 'ROUTE'; phase: Phase };

/** True where two phases are the same state, whether or not they are the same object. */
export function samePhase(a: Phase, b: Phase): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'FOCUS_COUNTRY':
    case 'COUNTRY_PAGE':
      return a.dir === (b as typeof a).dir;
    case 'PROJECTS':
      return a.category === (b as typeof a).category;
    case 'PROJECT_FOCUS':
      return a.id === (b as typeof a).id;
    default:
      return true;
  }
}

/** The phases the scroll moves through: CHAPTER events apply from these and nowhere else. */
const SCROLL_PHASES: ReadonlySet<Phase['kind']> = new Set<Phase['kind']>(['HOME_IDLE', 'DISSECT', 'MORPH', 'VOID_ENTRY', 'PROJECTS']);

function phaseOfChapter(chapter: ChapterId, category: string | null): Phase {
  switch (chapter) {
    case 'HOME':
      return { kind: 'HOME_IDLE' };
    case 'DISSECT':
      return { kind: 'DISSECT' };
    case 'MORPH':
      return { kind: 'MORPH' };
    case 'VOID_ENTRY':
      return { kind: 'VOID_ENTRY' };
    case 'PROJECTS':
      return { kind: 'PROJECTS', category };
  }
}

/**
 * The next phase for an event. An event that does not apply to the phase (or would give the phase it
 * is already in) returns the same object, so a caller can tell "nothing happened" by identity.
 */
export function transition(phase: Phase, event: SceneEvent): Phase {
  switch (event.type) {
    case 'ROUTE':
      return event.phase;

    case 'LOADED':
      return phase.kind === 'LOADING' ? { kind: 'HOME_IDLE' } : phase;

    case 'CHAPTER': {
      if (!SCROLL_PHASES.has(phase.kind)) return phase;
      const next = phaseOfChapter(event.chapter, event.category);
      return samePhase(phase, next) ? phase : next;
    }

    case 'FOCUS_COUNTRY': {
      if (phase.kind !== 'HOME_IDLE' && phase.kind !== 'FOCUS_COUNTRY') return phase;
      const next: Phase = { kind: 'FOCUS_COUNTRY', dir: event.dir };
      return samePhase(phase, next) ? phase : next;
    }

    case 'OPEN_COUNTRY':
      return phase.kind === 'FOCUS_COUNTRY' ? { kind: 'COUNTRY_PAGE', dir: phase.dir } : phase;

    case 'OPEN_PROJECT':
      return phase.kind === 'PROJECTS' ? { kind: 'PROJECT_FOCUS', id: event.id } : phase;

    case 'BACK':
      switch (phase.kind) {
        case 'FOCUS_COUNTRY':
          return { kind: 'HOME_IDLE' };
        case 'COUNTRY_PAGE':
          return { kind: 'FOCUS_COUNTRY', dir: phase.dir };
        case 'PROJECT_FOCUS':
          return { kind: 'PROJECTS', category: null };
        default:
          return phase;
      }
  }
}
