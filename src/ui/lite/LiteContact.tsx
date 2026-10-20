import type { JSX } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** The last section: the way to the contact page, and the places Bob can be found (the email is on the contact page). */
export function LiteContact(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;

  return (
    <LiteSection id="contact" title={t.cta.title}>
      <p>{t.cta.text}</p>
      <ul className="links">
        <li>
          <Link to={i18n.path(PAGES.contact)}>{t.cta.button}</Link>
        </li>
      </ul>
      <p className="label">{t.cta.or}</p>
      <ul className="links">
        {profile.socials
          .filter((social) => social.id !== 'email')
          .map((social) => (
            <li key={social.id}>
              <a href={social.url} target="_blank" rel="noopener noreferrer">
                {social.label}
              </a>
            </li>
          ))}
      </ul>
    </LiteSection>
  );
}
