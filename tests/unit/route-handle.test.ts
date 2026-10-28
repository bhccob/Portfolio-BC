import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RouteConfigEntry } from '@react-router/dev/routes';
import { describe, expect, it } from 'vitest';
import { HANDLES, handleOf, PAGE_KINDS, type RouteName } from '../../src/app/handle';
import routes from '../../src/app/routes';
import { PAGES, type PageId } from '../../src/data/pages';
import { locales } from '../../src/i18n/Translator';

const config: RouteConfigEntry[] = await routes;
const NAMES = Object.keys(HANDLES) as RouteName[];

/** The route module behind a route entry (`routes/lite.tsx`), as the router loads it. */
const moduleOf = (entry: RouteConfigEntry): Promise<{ handle?: unknown }> => import(fileURLToPath(new URL(`../../src/app/${entry.file}`, import.meta.url)));

describe('the route handle: one table for every kind of page', () => {
  it('names each kind of page once, with the scene it shows; Lite, contact and not found show none', () => {
    expect(NAMES.sort()).toEqual(['contact', 'home', 'lite', 'not-found', 'project']);
    for (const name of NAMES) expect(HANDLES[name].route, name).toBe(name);
    expect(NAMES.filter((name) => HANDLES[name].scene === null).sort()).toEqual(['contact', 'lite', 'not-found']);
    expect(HANDLES.home.scene).toBe('home');
    expect(HANDLES.project.scene).toBe('project');
  });

  it('gives every page of the site a kind, and no page is the not-found kind', () => {
    expect(Object.keys(PAGE_KINDS).sort()).toEqual(Object.keys(PAGES).sort());
    for (const page of Object.keys(PAGE_KINDS) as PageId[]) expect(PAGE_KINDS[page], page).not.toBe('not-found');
  });

  it('has no country kind of page, and no country route module', () => {
    expect(NAMES).not.toContain('country');
    expect(Object.values(PAGE_KINDS)).not.toContain('country');
    expect(existsSync(fileURLToPath(new URL('../../src/app/routes/country.tsx', import.meta.url)))).toBe(false);
  });

  it('has a route module for every kind, named after it', () => {
    for (const name of NAMES) expect(existsSync(fileURLToPath(new URL(`../../src/app/routes/${name}.tsx`, import.meta.url))), name).toBe(true);
  });

  it('routes every page, in each language, to the module of its kind (src/app/routes.ts reads the table)', () => {
    for (const locale of locales) {
      for (const page of Object.keys(PAGES) as PageId[]) {
        const entry = config.find((candidate) => candidate.id === `${page}-${locale}`);
        expect(entry?.file, `${page}-${locale}`).toBe(`routes/${PAGE_KINDS[page]}.tsx`);
      }
    }
    expect(config.at(-1)?.file).toBe('routes/not-found.tsx');
  });

  it("exports from every route module the table's own handle for its kind", async () => {
    for (const entry of config) {
      const kind = /^routes\/(.+)\.tsx$/.exec(entry.file)?.[1] as RouteName;
      const module = await moduleOf(entry);
      expect(module.handle, entry.file).toBe(HANDLES[kind]);
    }
  });
});

describe('handleOf', () => {
  const root = { handle: undefined, pathname: '/' };

  it("reads the deepest matched route's handle", () => {
    expect(handleOf([root, { handle: HANDLES.lite, pathname: '/lite/' }])).toBe(HANDLES.lite);
    expect(handleOf([root, { handle: HANDLES.project, pathname: '/en/projects/steady/' }])).toBe(HANDLES.project);
    expect(handleOf([root, { handle: HANDLES.home, pathname: '/' }])).toBe(HANDLES.home);
    expect(handleOf([root, { handle: HANDLES['not-found'], pathname: '/does-not-exist/' }])).toBe(HANDLES['not-found']);
  });

  it('gives not found for the root alone (the 404 file before the router has matched), and for a handle it does not know', () => {
    expect(handleOf([])).toBe(HANDLES['not-found']);
    expect(handleOf([root])).toBe(HANDLES['not-found']);
    expect(handleOf([{ handle: { scene: 'home' }, pathname: '/' }])).toBe(HANDLES['not-found']);
    expect(handleOf([{ handle: { route: 'gallery', scene: null }, pathname: '/' }])).toBe(HANDLES['not-found']);
  });

  it("gives not found, with no scene, for a page's route matched under another spelling (the client router ignores case)", () => {
    for (const pathname of ['/en/Projects/Steady/', '/EN/projects/steady/', '/Projects/Steady/', '/en/projects/FUNCIAL/', '/Lite/']) {
      const handle = /lite/i.test(pathname) ? HANDLES.lite : HANDLES.project;
      expect(handleOf([root, { handle, pathname }]), pathname).toBe(HANDLES['not-found']);
    }
  });
});
