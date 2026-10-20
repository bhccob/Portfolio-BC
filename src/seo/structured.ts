import { profile } from '../data/profile';
import { projects, type Project } from '../data/projects';
import { Translator, type Locale } from '../i18n/Translator';

// Structured data (schema.org JSON-LD) for the pages' heads: only facts the site already states.

const PERSON_ID = `${profile.site}/#person`;

const absolute = (locale: Locale, route: string): string => `${profile.site}${new Translator(locale).path(route)}`;

/** Bob, with his public profiles. No email address, no birth date. */
export function personLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: profile.name,
    givenName: profile.givenName,
    familyName: profile.familyName,
    url: profile.site,
    image: `${profile.site}/og.jpg`,
    jobTitle: 'Student Software Engineer',
    birthPlace: { '@type': 'Place', name: 'Aruba' },
    homeLocation: { '@type': 'Place', name: 'Rotterdam, Netherlands' },
    sameAs: profile.socials.filter((social) => social.id !== 'email').map((social) => social.url)
  };
}

export function websiteLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${profile.site}/#website`,
    url: profile.site,
    name: profile.name,
    inLanguage: ['nl', 'en'],
    author: { '@id': PERSON_ID }
  };
}

/**
 * A project as source code, with its repository. Its stack is `keywords` (schema.org: comma-separated text):
 * it names frameworks, libraries and services as well as languages, so it is not `programmingLanguage`.
 */
export function projectLd(project: Project, locale: Locale): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: project.title,
    description: project.copy(locale).summary,
    url: absolute(locale, projects.route(project)),
    ...(project.links.repo ? { codeRepository: project.links.repo } : {}),
    keywords: project.stack.join(', '),
    dateCreated: String(project.year),
    inLanguage: locale,
    author: { '@id': PERSON_ID }
  };
}

/** A breadcrumb trail; each crumb is a route (`/`, `/projects/funcial/`) in this locale. */
export function breadcrumbLd(locale: Locale, crumbs: { name: string; route: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absolute(locale, crumb.route)
    }))
  };
}
