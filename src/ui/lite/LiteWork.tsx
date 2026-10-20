import type { JSX } from 'react';
import { Link } from 'react-router';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** The projects in the order of the void, each with its category, its year, its line and a link to its page. */
export function LiteWork(): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;

  return (
    <LiteSection id="work" title={t.nav.work}>
      <ul className="lite-list">
        {projects.all().map((project) => (
          <li key={project.id}>
            <h3 className="lite-item-title">
              <Link to={i18n.path(projects.route(project))}>{project.title}</Link>
            </h3>
            <p className="label">{`${project.category.label(locale)} · ${project.year}`}</p>
            <p>{project.copy(locale).summary}</p>
          </li>
        ))}
      </ul>
    </LiteSection>
  );
}
