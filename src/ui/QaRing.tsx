import { type JSX, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import type { EndQuestions } from '~/i18n/en';
import { useTranslator } from '~/i18n/useTranslator';
import { goToTop } from '~/input/useHomeScroll';
import { useScene } from '~/state/store';
import { ChbcMark } from './ChbcMark';
import { Markup } from './Markup';

/** Whether a question's answer is there to show: a string with something in it (as the end page reads it). */
const given = (answer: string | null | undefined): answer is string => typeof answer === 'string' && answer.trim() !== '';

/**
 * The Q&A's words (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; Bob: "i want the Q&A also the be just very
 * simple and blend in to scroll"): every question and its answer, plain words in one column at the left (across a
 * phone), no box, no numbers, the column going with the scroll like a page (the scene moves its track, src/ui/qaWriters.ts);
 * the answer in reading text, or the end page's placeholder with its tag for one Bob has not sent. Under it the LED
 * screen's canvas (the digitize, src/ui/ledSky.ts) and a dark band behind the words. Apart from it, in the middle of the
 * screen, the end: Bob's chbc mark, "Einde van de site", "Stuur een bericht.", Bob's line and two buttons, to the contact
 * page and back to the start.
 *
 * All of it is out of reach until the scene shows it: the section `inert` while the Q&A does not show, the end's words
 * hidden but at the end. A question's heading is focusable by script alone (the skip button lands on the first,
 * src/ui/endArrival.ts). `questions` are the dictionary's unless given.
 */
export function QaRingParts({ questions }: { questions?: EndQuestions }): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const list = questions ?? t.end.questions;
  const ring = t.end.ring;

  return (
    <section id="qa" className="qa" aria-labelledby="qa-title" inert>
      <canvas className="qa-leds" aria-hidden="true" />
      <div className="qa-band" aria-hidden="true" />
      <h2 id="qa-title" className="visually-hidden">
        {t.end.head}
      </h2>
      <div className="qa-column">
        <div className="qa-track">
          {list.map(({ question, answer }, k) => (
            <article key={question} className="qa-block" data-k={k}>
              <h3 className="qa-question" id={`qa-ask-${k}`} tabIndex={-1}>
                {question}
              </h3>
              {given(answer) ? (
                <p className="qa-text">{answer}</p>
              ) : (
                <p className="qa-text is-placeholder">
                  {t.end.placeholder} <span className="end-tag">{t.end.placeholderTag}</span>
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
      <article className="qa-answer qa-end" data-k={list.length} hidden>
        <span className="qa-end-mark" aria-hidden="true">
          <ChbcMark />
        </span>
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
