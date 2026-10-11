import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Dutch is the default language at the site root; English lives under /en/.
// The Dutch pages used to live under /nl/: public/nl/ holds redirect pages for them.

export default defineConfig({
  site: 'https://bhccob.me',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'nl',
        locales: { nl: 'nl', en: 'en' }
      },
      filter: (page) => !page.includes('/404')
    })
  ],
  devToolbar: { enabled: false }
});
