import { type MetaFunction, useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { projects } from '~/data/projects';
import { localeFromPath, routeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { notFoundMeta } from '~/seo/notFound';
import { breadcrumbLd, projectLd } from '~/seo/structured';
import { BackLink } from '~/ui/BackLink';
import { NotFoundPage } from '~/ui/NotFoundPage';
import { HANDLES, type RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  // The three projects share this module, so the path says which. A path that names none of them
  // (a real page under another spelling) gets the not-found page, never an error.
  const project = projects.byRoute(routeFromPath(location.pathname));
  if (!project) return notFoundMeta(locale);
  const route = projects.route(project);
  return head({
    locale,
    route,
    // "Funcial · Work": the same project page in both languages needs a title of its own in each.
    title: `${project.title} · ${t.nav.work}`,
    description: project.copy(locale).metaDescription,
    jsonLd: [
      projectLd(project, locale),
      breadcrumbLd(locale, [
        { name: profile.name, route: PAGES.home },
        { name: project.title, route },
      ]),
    ],
  });
};

export const handle: RouteHandle = HANDLES.project;

export default function ProjectPage() {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const project = projects.byRoute(routeFromPath(useLocation().pathname));
  if (!project) return <NotFoundPage />;
  const copy = project.copy(locale);
  const sections = [
    { title: t.project.overview, text: copy.overview },
    { title: t.project.build, text: copy.build },
    { title: t.project.focus, text: copy.focus },
  ];

  return (
    <article className="page">
      <BackLink />
      <p className="label">{project.category.heading(locale)}</p>
      <h1 className="page-title">{project.title}</h1>
      <p className="lead">{copy.summary}</p>

      <dl className="facts">
        <div>
          <dt className="label">{t.work.type}</dt>
          <dd>{copy.type}</dd>
        </div>
        <div>
          <dt className="label">{t.work.year}</dt>
          <dd>{project.year}</dd>
        </div>
        <div>
          <dt className="label">{t.work.role}</dt>
          <dd>{copy.role}</dd>
        </div>
        <div>
          <dt className="label">{t.work.stack}</dt>
          <dd>
            <ul className="tags">
              {project.stack.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      <ol className="test-points">
        {project.testPoints.map((point) => {
          const number = /^tp(\d+)$/.exec(point.id)?.[1];
          const label = point.label[locale];
          return <li key={point.id}>{number ? i18n.format(t.compass.tp, { n: number, label }) : label}</li>;
        })}
      </ol>

      <ul className="links">
        {project.links.live && (
          <li>
            <a href={project.links.live}>{t.needle.project.download}</a>
          </li>
        )}
        {project.links.repo && (
          <li>
            <a href={project.links.repo}>{t.needle.project.code}</a>
          </li>
        )}
      </ul>

      {sections.map(
        ({ title, text }) =>
          text && (
            <section key={title} className="case">
              <h2 className="case-title">{title}</h2>
              <p>{text}</p>
            </section>
          ),
      )}
    </article>
  );
}
