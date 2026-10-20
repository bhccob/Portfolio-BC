import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { PAGES, type PageId } from '../data/pages';
import { defaultLocale, locales, Translator } from '../i18n/Translator';
import { PAGE_KINDS } from './handle';

// The module that renders each page is the one of its kind (src/app/handle.ts). The three
// countries share one module, as do the three projects: it reads which one from the URL,
// and the same module serves both locales, so every route names its own id.
const moduleOf = (page: PageId): string => `routes/${PAGE_KINDS[page]}.tsx`;

// NL is the default locale at the root; EN repeats every page under /en/. The list comes
// from PAGES (src/data/pages.ts), the same list that drives the prerender and the sitemap.
const ordered = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];

const pages = ordered.flatMap((locale) =>
  (Object.keys(PAGES) as PageId[]).map((page) => {
    const id = `${page}-${locale}`;
    const path = Translator.pathFor(locale, PAGES[page]); // '/', '/en/about/china/', ...
    // Case-sensitive, like the host: GitHub Pages has no /About/China/, so the router must not match one
    // either (it falls through to the not-found route, and its scene is none).
    return path === '/' ? index(moduleOf(page), { id }) : route(path.slice(1), moduleOf(page), { id, caseSensitive: true });
  }),
);

export default [...pages, route('*', 'routes/not-found.tsx', { id: 'not-found' })] satisfies RouteConfig;
