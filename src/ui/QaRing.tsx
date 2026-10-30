import { type JSX, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import type { EndQuestions } from '~/i18n/en';
import { useTranslator } from '~/i18n/useTranslator';
import { goToQa, goToTop } from '~/input/useHomeScroll';
import { useScene } from '~/state/store';
import { Markup } from './Markup';

/** Whether a question's answer is there to show: a string with something in it (as the end page reads it). */
const given = (answer: string | null | undefined): answer is string => typeof answer === 'string' && answer.trim() !== '';

/** A number on the ring, two digits. */
const two = (n: number): string => String(n).padStart(2, '0');

/**
 * The Q&A's words beside the gold ring round the stack (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up Bob
 * chose, "mix"; round 10, spec 2026-10-30-bob-qa-list-floors-design.md: Bob picked "A · One list"): every question in
 * one list beside the tower, each a button that turns the ring to its mark (`goToQa`), its reply under it, the count over
 * the answer ("Q&A · 02 / 06") and the answer in reading text (or the end page's placeholder with its tag for one Bob has
 * not sent); the end's mark's words, "Einde van de site", "Stuur een bericht.", Bob's line and two buttons, to the contact
 * page and back to the start; and, for the end, the dark that comes up over the scene and the gold circle that draws
 * itself round (spec 2026-10-29-bob-stack-3-design.md, goal 4).
 *
 * All of it is hidden and out of reach until the scene shows it (src/ui/qaWriters.ts): each reply `hidden` but the open
 * question's, the end's words but at the end, the section `inert` while the Q&A does not show. `questions` are the
 * dictionary's unless given.
 */
export function QaRingParts({ questions }: { questions?: EndQuestions }): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const list = questions ?? t.end.questions;
  const ring = t.end.ring;
  const count = (k: number): string => ring.count.replace('{n}', two(k + 1)).replace('{total}', two(list.length));

  return (
    <section id="qa" className="qa" aria-labelledby="qa-title" inert>
      <span className="qa-veil" aria-hidden="true" />
      <span className="qa-seal" aria-hidden="true" />
      <h2 id="qa-title" className="visually-hidden">
        {t.end.head}
      </h2>
      <div className="qa-frame">
        <ol className="qa-list">
          {list.map(({ question, answer }, k) => (
            <li key={question} className="qa-item" data-k={k}>
              <button type="button" className="qa-ask" id={`qa-ask-${k}`} aria-expanded="false" aria-controls={`qa-reply-${k}`} onClick={() => goToQa(k)}>
                {question}
              </button>
              <div className="qa-reply" id={`qa-reply-${k}`} hidden>
                <p className="qa-count">{count(k)}</p>
                {given(answer) ? (
                  <p className="qa-text">{answer}</p>
                ) : (
                  <p className="qa-text is-placeholder">
                    {t.end.placeholder} <span className="end-tag">{t.end.placeholderTag}</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        <article className="qa-answer qa-end" data-k={list.length} hidden>
          <p className="qa-count">{ring.endKicker}</p>
          {/* Focusable by script alone: the nav's link and the skip button focus it on arrival (src/ui/endArrival.ts). */}
          <h2 id="qa-end-title" className="qa-question" tabIndex={-1}>
            <Markup text={t.end.messageTitle} />
          </h2>
          <p className="qa-text">{ring.endLine}</p>
          <div className="qa-buttons">
            <Link className="button" to={i18n.path(PAGES.contact)}>
              {ring.toContact} <span aria-hidden="true">→</span>
            </Link>
            <button className="button again" type="button" onClick={() => goToTop()}>
              <span aria-hidden="true">↑</span> {ring.toStart}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

const subscribeNever = (): (() => void) => () => undefined;

/**
 * The ring's words on the home page: only on the client with 3D on (`QaRingParts`), so they are not in the prerendered
 * HTML, where crawlers and a page with 3D off read the questions once, in the end page (src/ui/EndPage.tsx).
 */
export function QaRing(): JSX.Element | null {
  const threeD = useScene((state) => state.threeD);
  const client = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  return client && threeD ? <QaRingParts /> : null;
}
