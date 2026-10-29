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
 * chose, "mix"): each question's answer with its count over it ("Q&A · 02 / 06"), its question in gold capitals and its
 * answer in reading text (or the end page's placeholder with its tag for one Bob has not sent); the end's mark's words,
 * "Einde van de site", "Stuur een bericht.", Bob's line and two buttons, to the contact page and back to the start; and a
 * button for each mark, named by its question, which turns the ring to it.
 *
 * All of it is hidden and out of reach until the scene shows it (src/ui/qaWriters.ts): each answer `hidden` but the one
 * the ring stands at, the section `inert` while the Q&A does not show. The marks' buttons stand where the scene puts them,
 * over their marks. `questions` are the dictionary's unless given.
 */
export function QaRingParts({ questions }: { questions?: EndQuestions }): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const list = questions ?? t.end.questions;
  const ring = t.end.ring;
  const count = (k: number): string => ring.count.replace('{n}', two(k + 1)).replace('{total}', two(list.length));
  const names = [...list.map(({ question }) => question), ring.endKicker];

  return (
    <section id="qa" className="qa" aria-labelledby="qa-title" inert>
      <h2 id="qa-title" className="visually-hidden">
        {t.end.head}
      </h2>
      <div className="qa-frame" aria-live="polite">
        {list.map(({ question, answer }, k) => (
          <article key={question} className="qa-answer" data-k={k} hidden>
            <p className="qa-count">{count(k)}</p>
            <h3 className="qa-question">{question}</h3>
            {given(answer) ? (
              <p className="qa-text">{answer}</p>
            ) : (
              <p className="qa-text is-placeholder">
                {t.end.placeholder} <span className="end-tag">{t.end.placeholderTag}</span>
              </p>
            )}
          </article>
        ))}
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
      <ol className="qa-marks" aria-label={ring.marks}>
        {names.map((name, k) => (
          <li key={name}>
            <button type="button" className="qa-mark" id={`qa-mark-${k}`} aria-label={name} hidden onClick={() => goToQa(k)}>
              <span aria-hidden="true">{k < list.length ? two(k + 1) : ''}</span>
            </button>
          </li>
        ))}
      </ol>
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
