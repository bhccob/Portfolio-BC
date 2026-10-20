import type { JSX } from 'react';
import { qaEntries } from '~/data/qa';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** The five questions, each a `<details>` that opens on its answer (the career copy, as the compass page reads it). */
export function LiteQa(): JSX.Element {
  const { t } = useTranslator();

  return (
    <LiteSection id="questions" title={t.compass.qa.title}>
      <div className="qa">
        {qaEntries(t).map(({ question, answer }) => (
          <details key={question} className="lite-details">
            <summary>
              <span className="summary-text">
                <span>{question}</span>
              </span>
            </summary>
            <div className="details-body">
              {answer.label && <p className="label">{answer.label}</p>}
              {answer.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {answer.terms && (
                <dl className="terms">
                  {answer.terms.map(({ term, text, sector }) => (
                    <div key={term} className={sector ? 'is-sector' : undefined}>
                      <dt>{term}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </details>
        ))}
      </div>
    </LiteSection>
  );
}
