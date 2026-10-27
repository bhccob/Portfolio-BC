import { type JSX, useEffect, useRef } from 'react';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import { ContactForm } from './ContactForm';
import { watchFinal } from './endFinal';
import { Markup } from './Markup';

/** Whether a question's answer is there to show: a string with something in it. Anything else is a missing answer. */
const given = (answer: string | null | undefined): answer is string => typeof answer === 'string' && answer.trim() !== '';

/**
 * The end of the home: the questions as the end credits of a film (spec 2026-10-27-bob-light-path-design.md, goal 8).
 * One narrow column on black: a small "Q&A", the six questions about Bob each as a small line of gold capitals with its
 * answer under it in plain reading text, a short gold rule and his name, then the message part, which is the contact
 * page's own (`ContactForm`, its direct links) under a small "Stuur een bericht.".
 *
 * It is in the home's HTML, server-rendered, so the questions and the links exist without script and for crawlers.
 * Every answer is simply there: nothing opens or closes. An answer that Bob has not sent is `null` and shows the
 * placeholder with a small tag (one left out of a translation, or empty, is missing too, and shows the same: never a
 * blank); an answer that is there replaces it with no other change.
 *
 * Here it only sits in the flow, and marks itself while its message part is up (./endFinal.ts), so the credits' edge
 * fades lift off the form. The scene's hold on it, its rise and its roll (the document's own scroll) are the scroll's
 * and the stylesheet's, not this component's.
 */
export function EndPage(): JSX.Element {
  const { t } = useTranslator();
  const end = t.end;
  const section = useRef<HTMLElement>(null);
  useEffect(() => watchFinal(section.current), []);
  // The Web3Forms access key (a public key, set in the deploy), the contact page's own source. Without it the form is
  // left out of the prerendered HTML and shown once the page has hydrated, as on /contact/.
  const accessKey: string | undefined = import.meta.env.PUBLIC_WEB3FORMS_KEY;

  return (
    <section ref={section} className="end-page" id="end" aria-labelledby="end-title">
      <div className="end-roll">
        {/* Focusable by script alone: the skip button and the failed void's link focus it on arrival (src/ui/endArrival.ts). */}
        <h2 id="end-title" className="end-head" tabIndex={-1}>
          {end.head}
        </h2>

        {end.questions.map(({ question, answer }) => (
          <div key={question} className="end-block">
            <h3 className="end-q">{question}</h3>
            {given(answer) ? (
              <p className="end-a">{answer}</p>
            ) : (
              <p className="end-a is-placeholder">
                {end.placeholder}{' '}
                <span className="end-tag">{end.placeholderTag}</span>
              </p>
            )}
          </div>
        ))}

        <div className="end-sign">
          <span className="end-line" aria-hidden="true" />
          <p className="end-name">{profile.name}</p>
        </div>

        <div className="end-final">
          <h2 className="end-message-title">
            <Markup text={end.messageTitle} />
          </h2>

          {/* Its title an h3, under the message part's own h2 just above. */}
          <ContactForm accessKey={accessKey} level={3} />

          <ul className="links" aria-label={t.contact.direct}>
            {profile.socials.map((social) => (
              <li key={social.id}>
                <a href={social.url} {...(social.url.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
                  {social.label} · {social.handle}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
