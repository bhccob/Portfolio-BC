import type { JSX } from 'react';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import { ContactForm } from './ContactForm';
import { Markup } from './Markup';

/** Whether a question's answer is there to show: a string with something in it. Anything else is a missing answer. */
const given = (answer: string | null | undefined): answer is string => typeof answer === 'string' && answer.trim() !== '';

/**
 * The end of the home: an ordinary page after the last bead. A label and a title, six questions about Bob that open and
 * close, then the message part, which is the contact page's own (its intro, `ContactForm`, its direct links).
 *
 * It is in the home's HTML, server-rendered, so the questions and the links exist without script and for crawlers. The
 * questions are `<details>` of one name, which the browser keeps to one open at a time with no script, and none is
 * open on arrival. An answer that Bob has not sent is `null` and shows the placeholder with a small tag (one left out of
 * a translation, or empty, is missing too, and shows the same: never a blank); an answer that is there replaces it with
 * no other change.
 *
 * Here it only sits in the flow. The scene's hold on it (hidden while 3D is on and the story is elsewhere) is the
 * scroll's, not this component's.
 */
export function EndPage(): JSX.Element {
  const { t } = useTranslator();
  const end = t.end;
  // The Web3Forms access key (a public key, set in the deploy), the contact page's own source. Without it the form is
  // left out of the prerendered HTML and shown once the page has hydrated, as on /contact/.
  const accessKey: string | undefined = import.meta.env.PUBLIC_WEB3FORMS_KEY;

  return (
    <section className="end-page" id="end" aria-labelledby="end-title">
      <p className="label">{end.label}</p>
      {/* Focusable by script alone: the failed void's link to this page focuses it on arrival (src/ui/endArrival.ts). */}
      <h2 id="end-title" className="page-title" tabIndex={-1}>
        <Markup text={end.title} />
      </h2>

      <div className="end-qa">
        {end.questions.map(({ question, answer }) => (
          <details key={question} name="end-qa" className="end-q">
            <summary>{question}</summary>
            {given(answer) ? (
              <p className="end-a">{answer}</p>
            ) : (
              <p className="end-a is-placeholder">
                {end.placeholder}{' '}
                <span className="end-tag">{end.placeholderTag}</span>
              </p>
            )}
          </details>
        ))}
      </div>

      <h2 className="end-message-title">
        <Markup text={end.messageTitle} />
      </h2>
      <p className="lead">{t.contact.intro}</p>

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
    </section>
  );
}
