import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** Skills: the statement as one sentence, then the four rows from what is solid today to what comes next. */
export function LiteSkills(): JSX.Element {
  const { t } = useTranslator();
  const s = t.skills;

  return (
    <LiteSection id="skills" title={s.title}>
      <p className="lead">{s.statementSpoken}</p>
      <ol className="lite-rows">
        {s.rows.map((row) => (
          <li key={row.title}>
            <p className="label">{row.status}</p>
            <h3 className="lite-item-title">{row.title}</h3>
            <p>{row.text}</p>
          </li>
        ))}
      </ol>
    </LiteSection>
  );
}
