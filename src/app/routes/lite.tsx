import type { MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { BackLink } from '~/ui/BackLink';
import { LiteAbout } from '~/ui/lite/LiteAbout';
import { LiteCareer } from '~/ui/lite/LiteCareer';
import { LiteContact } from '~/ui/lite/LiteContact';
import { LiteOffDuty } from '~/ui/lite/LiteOffDuty';
import { LiteQa } from '~/ui/lite/LiteQa';
import { LiteSkills } from '~/ui/lite/LiteSkills';
import { LiteWork } from '~/ui/lite/LiteWork';
import { HANDLES, type RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({ locale, route: PAGES.lite, title: t.needle.liteLink, description: t.meta.liteDescription });
};

export const handle: RouteHandle = HANDLES.lite;

/**
 * The Lite version: the whole portfolio as one page of text, with no 3D. It is where a visitor lands
 * when 3D is off or WebGL fails, so it carries all the site's copy: the work, then about (the header's
 * Work and About open it at these two), skills, career, off duty, the questions and the way to write.
 */
export default function Lite() {
  const { t } = useTranslator();

  return (
    <article className="page lite">
      <BackLink />
      <h1 className="page-title">{t.needle.liteLink}</h1>
      <p className="lead">{t.meta.liteDescription}</p>

      <LiteWork />
      <LiteAbout />
      <LiteSkills />
      <LiteCareer />
      <LiteOffDuty />
      <LiteQa />
      <LiteContact />
    </article>
  );
}
