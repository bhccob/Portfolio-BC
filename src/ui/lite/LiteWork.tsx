import type { JSX } from 'react';
import { Link } from 'react-router';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { Markup } from '../Markup';
import { LiteSection } from './LiteSection';

/**
 * Work, as the old home page's Projects section told it: the heading and the intro, the projects in the
 * order of the void (each with its category, its year, its line and a link to its page), the slot for the
 * next category (it points on to the career, where the roadmap is) and what is held back.
 */
export function LiteWork(): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;

  return (
    <LiteSection id="work" title={t.work.title}>
      <p className="lead">{t.work.intro}</p>

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
        <li className="is-next">
          <h3 className="lite-item-title">
            <Markup text={t.work.nextTitle} />
          </h3>
          <p>{t.work.nextText}</p>
          <a className="lite-more" href="#career">
            {t.work.nextLink}
          </a>
        </li>
      </ul>

      <p className="held">
        <strong>{t.work.heldTitle}.</strong> {t.work.heldText}
      </p>
    </LiteSection>
  );
}
