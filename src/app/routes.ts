import { type RouteConfig, index, prefix, route } from '@react-router/dev/routes';

// NL is the default locale at the root; EN repeats every page under /en/.
// One module serves both locales, so every route names its own id.
export default [
  index('routes/home.tsx', { id: 'home-nl' }),
  route('probe/', 'routes/probe.tsx', { id: 'probe-nl' }),
  ...prefix('en', [
    index('routes/home.tsx', { id: 'home-en' }),
    route('probe/', 'routes/probe.tsx', { id: 'probe-en' }),
  ]),
  route('*', 'routes/not-found.tsx', { id: 'not-found' }),
] satisfies RouteConfig;
