import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dutch is the default language at the site root; English lives under /en/.
// Old addresses (the /nl/ pages, and one page per project before projects were
// grouped by category) are kept alive by small redirect pages in public/.

const site = 'https://bhccob.me';
const dist = new URL('./dist/', import.meta.url);

/**
 * The sitemap lists only pages that are their own canonical address. A project
 * shown in a second category (e.g. Cookies Clicker under web development) points
 * its canonical to its home category, so that copy is left out. The built HTML
 * is the source of truth: the sitemap is written after every page exists.
 * The lab's review pages (noindex) stay out as well.
 */
function isCanonical(page) {
  try {
    const path = new URL(page).pathname.replace(/\/?$/, '/');
    const html = readFileSync(fileURLToPath(new URL(`.${path}index.html`, dist)), 'utf8');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    return !canonical || canonical === page;
  } catch {
    return true;
  }
}

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'nl',
        locales: { nl: 'nl', en: 'en' }
      },
      filter: (page) => !page.includes('/404') && !page.includes('/lab/') && isCanonical(page)
    })
  ],
  security: {
    /*
     * GitHub Pages cannot send response headers, so the policy ships as a
     * <meta> tag that Astro fills with hashes of every script and style it
     * emits. That covers everything except what only headers can do
     * (frame-ancestors, HSTS); see README.
     */
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://api.web3forms.com https://cloudflareinsights.com",
        "manifest-src 'self'",
        "form-action 'self' https://api.web3forms.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-src 'none'",
        'upgrade-insecure-requests'
      ],
      scriptDirective: {
        // The analytics beacon is the one third-party script.
        resources: ["'self'", 'https://static.cloudflareinsights.com']
      },
      styleDirective: {
        // Components pass CSS custom properties through style attributes (e.g. a card's tilt).
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }]
      }
    }
  },
  vite: {
    // Fonts ship as files, never inlined as data: URIs: the CSP only allows fonts
    // from 'self', and inlining every unicode-range subset bloated the CSS.
    build: { assetsInlineLimit: 0 }
  },
  devToolbar: { enabled: false }
});
