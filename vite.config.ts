import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
  // PUBLIC_ keeps the CI variable names (PUBLIC_WEB3FORMS_KEY, PUBLIC_CF_ANALYTICS_TOKEN).
  envPrefix: ['VITE_', 'PUBLIC_'],
  resolve: { alias: { '~': '/src' } },
  // Every asset stays a file, never a data: URI, which the CSP's font-src and
  // media-src ('self') would block.
  build: { assetsInlineLimit: 0 },
});
