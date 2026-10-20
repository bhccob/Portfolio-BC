import type { Config } from '@react-router/dev/config';
import { pagePaths } from './src/data/pages';

// A static site: no runtime server. Every page of src/data/pages.ts, in both locales, is
// prerendered to dist/client/<path>/index.html; anything else gets the SPA fallback.
export default {
  appDirectory: 'src/app',
  buildDirectory: 'dist',
  ssr: false,
  prerender: pagePaths(),
} satisfies Config;
