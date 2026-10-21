import '@fontsource-variable/martian-mono';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/unbounded';
import montserratLatin from '@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url';
import { type ReactNode, useEffect } from 'react';
import { Links, type LinksFunction, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from 'react-router';
import { localeFromPath } from '~/i18n/locale';
import { cfBeacon } from '~/seo/analytics';
import '~/styles/tokens.css';
import '~/styles/base.css';
import { Shell } from './Shell';

export const links: LinksFunction = () => [
  // Without an icon link the browser asks for /favicon.ico, which does not exist.
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { rel: 'manifest', href: '/site.webmanifest' },
  // The name is set in Montserrat's latin file, so the hero never swaps its font. (The poster is a CSS panel and
  // loads nothing.)
  { rel: 'preload', href: montserratLatin, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
];

/** Cloudflare Web Analytics, when the build has a site token (PUBLIC_CF_ANALYTICS_TOKEN); without one, nothing. */
const BEACON = cfBeacon(import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN);

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = localeFromPath(pathname);

  // The 404 page is one file for every unknown URL, written in Dutch. React does not
  // patch a differing attribute when it hydrates, so /en/... would keep lang="nl".
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        {/* The build fills in __CSP__ (hashes of the page's inline scripts). Only the
            prerender writes this tag: React hoists <meta> and matches it by content
            when hydrating, so a client copy would be appended as a second, unfilled
            policy once the build has rewritten the first. */}
        {import.meta.env.PROD && import.meta.env.SSR && (
          <meta httpEquiv="Content-Security-Policy" content="__CSP__" />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0510" />
        <meta name="color-scheme" content="dark" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        {/* The scroll on a client navigation: a push starts at the top (or at its #place), Back and Forward return to
            the place saved when the page was left (the router saves it before the page changes, so a shorter page in
            between cannot clamp it), and a replace marked preventScrollReset stays put. The focus is the Shell's
            (useNavigationFocus). */}
        <ScrollRestoration />
        <Scripts />
        {BEACON && <script defer {...BEACON} />}
      </body>
    </html>
  );
}

// What dist/client/404.html shows until the router has matched the URL (the SPA
// fallback renders the root alone). Static and in both languages, as the file
// cannot know which one the URL was meant for. Its <title> goes when the
// not-found route takes over, so the route's own title never doubles it.
export function HydrateFallback() {
  return (
    <>
      <title>Pagina niet gevonden · Page not found | Bob Chung</title>
      <main>
        <h1>
          Pagina niet gevonden · <span lang="en">Page not found</span>
        </h1>
      </main>
    </>
  );
}

export default function App() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
