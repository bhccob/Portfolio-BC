import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { PAGES, type PageId } from '../data/pages';
import { defaultLocale, locales, Translator } from '../i18n/Translator';

// The module that renders each page. The three countries share one module, as do the
// three projects: it reads which one from the URL, and the same module serves both
// locales, so every route names its own id.
const MODULES: Record<PageId, string> = {
  home: 'routes/home.tsx',
  'about-china': 'routes/country.tsx',
  'about-netherlands': 'routes/country.tsx',
  'about-aruba': 'routes/country.tsx',
  'project-funcial': 'routes/project.tsx',
  'project-jontai-energy': 'routes/project.tsx',
  'project-cookies-clicker': 'routes/project.tsx',
  lite: 'routes/lite.tsx',
  contact: 'routes/contact.tsx',
};

// NL is the default locale at the root; EN repeats every page under /en/. The list comes
// from PAGES (src/data/pages.ts), the same list that drives the prerender and the sitemap.
const ordered = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];

const pages = ordered.flatMap((locale) =>
  (Object.keys(PAGES) as PageId[]).map((page) => {
    const id = `${page}-${locale}`;
    const path = Translator.pathFor(locale, PAGES[page]); // '/', '/en/about/china/', ...
    return path === '/' ? index(MODULES[page], { id }) : route(path.slice(1), MODULES[page], { id });
  }),
);

export default [...pages, route('*', 'routes/not-found.tsx', { id: 'not-found' })] satisfies RouteConfig;
