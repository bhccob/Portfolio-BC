import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bhccob.me',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', nl: 'nl' }
      },
      filter: (page) => !page.includes('/404')
    })
  ],
  devToolbar: { enabled: false }
});
