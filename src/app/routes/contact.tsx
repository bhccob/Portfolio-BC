import type { MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { BackLink } from '~/ui/BackLink';
import { ContactForm } from '~/ui/ContactForm';
import { Markup } from '~/ui/Markup';
import type { RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({ locale, route: PAGES.contact, title: t.meta.contactTitle, description: t.meta.contactDescription });
};

export const handle: RouteHandle = { scene: null };

// The Web3Forms access key (a public key, set in the deploy). Without it the form opens the visitor's email app.
const ACCESS_KEY: string | undefined = import.meta.env.PUBLIC_WEB3FORMS_KEY;

export default function Contact() {
  const { t } = useTranslator();

  return (
    <article className="page contact">
      <BackLink />
      <h1 className="page-title">
        <Markup text={t.contact.title} />
      </h1>
      <p className="lead">{t.contact.intro}</p>

      <ContactForm accessKey={ACCESS_KEY} />

      <p className="label direct">{t.contact.direct}</p>
      <ul className="links">
        {profile.socials.map((social) => (
          <li key={social.id}>
            <a href={social.url} {...(social.url.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
              {social.label} · {social.handle}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
