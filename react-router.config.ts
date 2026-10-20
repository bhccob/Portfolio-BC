import type { Config } from '@react-router/dev/config';

// A static site: no runtime server. Every listed path is prerendered to
// dist/client/<path>/index.html; anything else gets the SPA fallback.
export default {
  appDirectory: 'src/app',
  buildDirectory: 'dist',
  ssr: false,
  // Task 4a switches this to pagePaths() (src/data/pages.ts) once those pages exist.
  prerender: ['/', '/probe/', '/en/', '/en/probe/'],
} satisfies Config;
