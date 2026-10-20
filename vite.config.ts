import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
  // PUBLIC_ keeps the CI variable names (PUBLIC_WEB3FORMS_KEY, PUBLIC_CF_ANALYTICS_TOKEN).
  envPrefix: ['VITE_', 'PUBLIC_'],
  resolve: { alias: { '~': '/src' } },
  build: {
    // Every asset stays a file, never a data: URI, which the CSP's font-src and
    // media-src ('self') would block.
    assetsInlineLimit: 0,
    // three.js gets a chunk of its own (core and WebGL renderer), shared by the
    // scene and by the scroll's lazily loaded maath easing. It is one library of
    // about 700 KB minified that does not split further, fetched only after
    // hydration and only while 3D is on, so its chunk is the one allowed over
    // Vite's default 500 KB warning; anything else that size still warns.
    chunkSizeWarningLimit: 760,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
});
