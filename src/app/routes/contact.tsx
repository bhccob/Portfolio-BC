import type { MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { BackLink } from '~/ui/BackLink';
import type { RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({ locale, route: PAGES.contact, title: t.meta.contactTitle, description: t.meta.contactDescription });
};

export const handle: RouteHandle = { scene: null };

// A placeholder until Task 4b builds the contact form. Until then the page shows the direct ways to reach Bob.
export default function Contact() {
  const { t } = useTranslator();

  return (
    <article className="page">
      <BackLink />
      <h1 className="page-title">{t.nav.contact}</h1>
      <p className="lead">{t.contact.intro}</p>
      <p className="label">{t.contact.direct}</p>
      <ul className="links">
        {profile.socials.map((social) => (
          <li key={social.id}>
            <a href={social.url}>
              {social.label} · {social.handle}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
