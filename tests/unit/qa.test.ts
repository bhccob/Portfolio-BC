import { describe, expect, expectTypeOf, it } from 'vitest';
import { qaEntries, type QaEntry, RING_MARKS, RING_QUESTIONS } from '../../src/data/qa';
import { en, type Dictionary, type QaItems } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';

type Items = Dictionary['compass']['qa']['items'];

const entry: QaEntry = { question: 'q', answer: { paragraphs: ['a'] } };

describe('the Q&A', () => {
  it('is five questions, in both languages, each with its answer', () => {
    for (const [name, dictionary] of [['en', en], ['nl', nl]] as const) {
      const entries = qaEntries(dictionary);
      expect(entries, name).toHaveLength(5);
      expect(dictionary.compass.qa.items, name).toHaveLength(5);
      entries.forEach(({ question, answer }, k) => {
        expect(question, `${name} ${k}`).toBe(dictionary.compass.qa.items[k]);
        expect(question.length, `${name} ${k}`).toBeGreaterThan(0);
        expect(answer.paragraphs.length, `${name} ${k}`).toBeGreaterThan(0);
        for (const paragraph of answer.paragraphs) expect(paragraph.length, `${name} ${k}`).toBeGreaterThan(0);
      });
    }
  });

  it('answers each question from its own part of the career copy', () => {
    for (const dictionary of [en, nl]) {
      const [current, hbo, roles, why, goal] = qaEntries(dictionary);
      const { career } = dictionary;
      expect(current.answer.label).toBe(`${career.currentRole} · ${career.currentOrg}`);
      expect(current.answer.paragraphs).toEqual([career.currentText]);
      expect(hbo.answer.paragraphs).toEqual([career.hboText]);
      expect(roles.answer.paragraphs).toEqual([career.roadmapNote]);
      expect(roles.answer.terms?.at(-1)).toEqual({ term: career.sector.title, text: career.sector.text, sector: true });
      expect(roles.answer.terms?.filter((term) => term.sector)).toHaveLength(1);
      expect(why.answer.paragraphs).toEqual(career.why);
      expect(goal.answer.paragraphs).toEqual([career.goalText]);
    }
  });

  it('is typed as a five-tuple, so a sixth or a missing fifth question fails type-checking (tsc)', () => {
    expectTypeOf<Items>().toEqualTypeOf<QaItems>();
    expectTypeOf<Items['length']>().toEqualTypeOf<5>();
    expectTypeOf<ReturnType<typeof qaEntries>['length']>().toEqualTypeOf<5>();
    // Each of these must not compile: the directive itself fails tsc where the line does compile.
    // @ts-expect-error a sixth question is no translation's
    const sixth: Items = ['1', '2', '3', '4', '5', '6'];
    // @ts-expect-error a translation missing its fifth question
    const missing: Items = ['1', '2', '3', '4'];
    // @ts-expect-error a sixth answer for the five questions
    const answers: ReturnType<typeof qaEntries> = [entry, entry, entry, entry, entry, entry];
    // @ts-expect-error a missing fifth answer
    const fewer: ReturnType<typeof qaEntries> = [entry, entry, entry, entry];
    expect([sixth, missing, answers, fewer]).toHaveLength(4);
  });
});

describe('the ring of questions', () => {
  it('has as many questions on the ring as both dictionaries', () => {
    expect(RING_QUESTIONS).toBe(en.end.questions.length);
    expect(nl.end.questions.length).toBe(RING_QUESTIONS);
    expect(RING_MARKS).toBe(RING_QUESTIONS + 1);
  });
});
