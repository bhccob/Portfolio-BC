import type { RouteConfigEntry } from '@react-router/dev/routes';
import { describe, expect, it } from 'vitest';
import routes from '../../src/app/routes';
import { pagePaths } from '../../src/data/pages';

const config: RouteConfigEntry[] = await routes;

const slashed = (path: string): string => `/${path}/`.replace(/\/+/g, '/');

/** The URL path of every route entry, the way the router builds it: parent path + own path, ending in a slash. */
function urlPaths(entries: readonly RouteConfigEntry[], parent = ''): string[] {
  return entries.flatMap((entry) => {
    const path = entry.path ? `${parent}/${entry.path}` : parent;
    const own = entry.index || entry.path ? [slashed(path)] : [];
    return [...own, ...urlPaths(entry.children ?? [], path)];
  });
}

describe('routes', () => {
  it('has a route for every page of the site, in both languages, and no other page route', () => {
    const real = urlPaths(config).filter((path) => path !== '/*/');
    expect([...real].sort()).toEqual([...pagePaths()].sort());
  });

  it('ends with a route for anything else, so an unknown URL gets the not-found page', () => {
    expect(config.at(-1)?.path).toBe('*');
  });

  it('matches every page route case-sensitively, so /Projects/Steady/ is no page (the host has none either)', () => {
    const pageRoutes = config.filter((entry) => !entry.index && entry.path !== '*');
    expect(pageRoutes).toHaveLength(pagePaths().length - 1); // all but the Dutch home page, which is the index route
    for (const entry of pageRoutes) expect(entry.caseSensitive, entry.path).toBe(true);
  });

  it('gives every route an id of its own', () => {
    const ids = config.map((entry) => entry.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no country route: the old /about/<country>/ addresses fall through to the not-found route', () => {
    expect(urlPaths(config).filter((path) => path.includes('/about/'))).toEqual([]);
    expect(config.some((entry) => entry.file.includes('country'))).toBe(false);
  });

  it('has no leftover probe page', () => {
    expect(config.some((entry) => entry.file.includes('probe'))).toBe(false);
  });
});
