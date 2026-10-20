import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** Off duty: what Bob does now (with a line each) and what he did before. */
export function LiteOffDuty(): JSX.Element {
  const { t } = useTranslator();
  const l = t.life;
  const hobbies = [
    { title: l.hobbies.running, text: l.hobbies.runningText, status: l.current },
    { title: l.hobbies.gym, text: l.hobbies.gymText, status: l.current },
    { title: l.hobbies.gaming, text: l.hobbies.gamingText, status: l.current },
    { title: l.hobbies.powerlifting, text: null, status: l.former },
    { title: l.hobbies.tableTennis, text: null, status: l.former },
  ];

  return (
    <LiteSection id="off-duty" title={l.title}>
      <p className="lead">{l.text}</p>
      <ul className="lite-hobbies">
        {hobbies.map(({ title, text, status }) => (
          <li key={title}>
            <span className="hobby-name">{title}</span>
            <span className="label">{status}</span>
            {text && <span className="hobby-text">{text}</span>}
          </li>
        ))}
      </ul>
    </LiteSection>
  );
}
