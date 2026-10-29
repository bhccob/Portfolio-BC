import { type Dictionary, en } from '../i18n/en';

/** An answer on the compass page: an optional label, paragraphs, then terms with their text (`sector`: the one the financial-sector note is). */
export interface QaAnswer {
  label?: string;
  paragraphs: readonly string[];
  terms?: { term: string; text: string; sector?: boolean }[];
}

/** A question of the Q&A and the answer under it. */
export interface QaEntry {
  question: string;
  answer: QaAnswer;
}

/** One entry for each of a tuple's elements, as a tuple of the same length (a generic mapped type keeps the tuple). */
type EntriesFor<Questions extends readonly string[]> = { [K in keyof Questions]: QaEntry };

/**
 * The Q&A of the compass page: each question of `compass.qa.items` with its
 * answer, from the career copy. The answers are tied to the questions by
 * position, so the copy types the questions as a tuple and this returns a
 * tuple of the same length: a question added to or dropped from the copy
 * fails type-checking here until its answer is written or removed, instead
 * of reading `undefined` at build time.
 */
export function qaEntries(t: Dictionary): EntriesFor<Dictionary['compass']['qa']['items']> {
  const { career } = t;
  const [current, next, roles, why, goal] = t.compass.qa.items;
  return [
    { question: current, answer: { label: `${career.currentRole} · ${career.currentOrg}`, paragraphs: [career.currentText] } },
    { question: next, answer: { paragraphs: [career.hboText] } },
    {
      question: roles,
      answer: {
        paragraphs: [career.roadmapNote],
        terms: [
          ...career.roleGroups.flatMap((group) => group.roles.map((role) => ({ term: role.title, text: role.text }))),
          { term: career.sector.title, text: career.sector.text, sector: true }
        ]
      }
    },
    { question: why, answer: { paragraphs: career.why } },
    { question: goal, answer: { paragraphs: [career.goalText] } }
  ];
}

/**
 * How many questions stand on the Q&A's gold ring round the stack (spec 2026-10-29-bob-stack-2-design.md, goal 1): the
 * end page's (`end.questions`), the same in both languages (the Q&A test holds Dutch to it). The ring has one mark more,
 * the end's (`RING_MARKS`), and the home's scroll a stop for each (src/state/chapters.ts).
 */
export const RING_QUESTIONS: number = en.end.questions.length;

/** The ring's marks: one per question and the end's. */
export const RING_MARKS: number = RING_QUESTIONS + 1;
