import type { ChapterId } from './chapters';

/**
 * Where the story is, as a discrete state. Scroll progress is not part of it: that is a number
 * that changes every frame and lives in `frame.ts`; the phase changes when progress crosses a chapter.
 */
export type Phase =
  | { kind: 'LOADING' }
  | { kind: 'HOME_IDLE' }
  | { kind: 'LIGHT' }
  | { kind: 'PROJECTS'; category: string | null }
  | { kind: 'END' }
  | { kind: 'PROJECT_FOCUS'; id: string };

export type SceneEvent =
  | { type: 'LOADED' }
  | { type: 'CHAPTER'; chapter: ChapterId; category: string | null }
  | { type: 'OPEN_PROJECT'; id: string }
  | { type: 'BACK' }
  | { type: 'ROUTE'; phase: Phase };

/** True where two phases are the same state, whether or not they are the same object. */
export function samePhase(a: Phase, b: Phase): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'PROJECTS':
      return a.category === (b as typeof a).category;
    case 'PROJECT_FOCUS':
      return a.id === (b as typeof a).id;
    default:
      return true;
  }
}

/** The phases the scroll moves through: CHAPTER events apply from these and nowhere else, and the scroll input takes the wheel only in these. */
export const SCROLL_PHASES: ReadonlySet<Phase['kind']> = new Set<Phase['kind']>(['HOME_IDLE', 'LIGHT', 'PROJECTS', 'END']);

function phaseOfChapter(chapter: ChapterId, category: string | null): Phase {
  switch (chapter) {
    case 'HOME':
      return { kind: 'HOME_IDLE' };
    case 'LIGHT':
      return { kind: 'LIGHT' };
    case 'LAND':
      // the world, every project on it: the projects' phase with no one project
      return { kind: 'PROJECTS', category: null };
    case 'AREA':
      // an area is the projects' phase, with its category
      return { kind: 'PROJECTS', category };
    case 'LOOK':
    case 'QA':
      // the look back and the ring's questions round the stack: the projects' phase with no one project
      return { kind: 'PROJECTS', category: null };
    case 'END':
      return { kind: 'END' };
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

    case 'OPEN_PROJECT':
      return phase.kind === 'PROJECTS' ? { kind: 'PROJECT_FOCUS', id: event.id } : phase;

    case 'BACK':
      switch (phase.kind) {
        case 'PROJECT_FOCUS':
          return { kind: 'PROJECTS', category: null };
        default:
          return phase;
      }
  }
}
