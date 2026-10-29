import type { Locale } from '../i18n/Translator';

export interface Redirect {
  /** The old URL: a folder URL ending in `/`, or a legacy `.html` file. */
  from: string;
  /** The page that replaced it, with an optional `#fragment`. */
  to: string;
  /** The language of the target page; it sets the stub's `<html lang>` and its wording. */
  locale: Locale;
}

/** Folder routes of the old Astro site that no longer exist; the same five exist under `/en/`. */
const OLD_PROJECT_ROUTES: readonly (readonly [string, string])[] = [
  ['/projects/web-development/', '/projects/jontai-energy/'],
  ['/projects/web-development/jontai-energy/', '/projects/jontai-energy/'],
  ['/projects/web-development/cookies-clicker/', '/projects/cookies-clicker/'],
  ['/projects/game-development/', '/projects/cookies-clicker/'],
  ['/projects/game-development/cookies-clicker/', '/projects/cookies-clicker/'],
];

/**
 * Old URLs and where they went. The build writes one static redirect page for
 * each (tools/build/redirects.mjs); GitHub Pages cannot send a 301.
 *
 * `/projects/{jontai-energy,cookies-clicker}/` and their `/en/` twins are real
 * pages now, so they are not listed. A `to` must be a real page and never
 * another entry's `from` (tests/unit/redirects.test.ts).
 */
export const redirects: readonly Redirect[] = [
  ...OLD_PROJECT_ROUTES.map(([from, to]): Redirect => ({ from, to, locale: 'nl' })),
  ...OLD_PROJECT_ROUTES.map(([from, to]): Redirect => ({ from: `/en${from}`, to: `/en${to}`, locale: 'en' })),

  // Porfael was renamed Portle (2026-10-29).
  { from: '/projects/porfael/', to: '/projects/portle/', locale: 'nl' },
  { from: '/en/projects/porfael/', to: '/en/projects/portle/', locale: 'en' },

  { from: '/lab/compass/', to: '/', locale: 'nl' },
  { from: '/en/lab/compass/', to: '/en/', locale: 'en' },

  { from: '/career/cybersecurity.html', to: '/lite/#career', locale: 'nl' },
  { from: '/career/game-development.html', to: '/lite/#career', locale: 'nl' },
  { from: '/career/ui-ux-design.html', to: '/lite/#career', locale: 'nl' },
  { from: '/career/web-development.html', to: '/lite/#career', locale: 'nl' },

  { from: '/jontai-energy.html', to: '/projects/jontai-energy/', locale: 'nl' },
  { from: '/cookies-clicker.html', to: '/projects/cookies-clicker/', locale: 'nl' },

  // Dutch used to live under /nl/.
  { from: '/nl/', to: '/', locale: 'nl' },
  { from: '/nl/contact/', to: '/contact/', locale: 'nl' },
  { from: '/nl/projects/jontai-energy/', to: '/projects/jontai-energy/', locale: 'nl' },
  { from: '/nl/projects/cookies-clicker/', to: '/projects/cookies-clicker/', locale: 'nl' },
];
