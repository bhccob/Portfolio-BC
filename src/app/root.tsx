import type { ReactNode } from 'react';
import { Links, type LinksFunction, Meta, Outlet, Scripts, useLocation } from 'react-router';
import { Shell } from './Shell';

// Without an icon link the browser asks for /favicon.ico, which does not exist.
export const links: LinksFunction = () => [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }];

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'nl';

  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        {/* The build fills in __CSP__ (hashes of the page's inline scripts). Only the
            prerender writes this tag: React hoists <meta> and matches it by content
            when hydrating, so a client copy would be appended as a second, unfilled
            policy once the build has rewritten the first. */}
        {import.meta.env.PROD && import.meta.env.SSR && (
          <meta httpEquiv="Content-Security-Policy" content="__CSP__" suppressHydrationWarning />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
