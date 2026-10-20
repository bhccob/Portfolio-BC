import { describe, expect, it } from 'vitest';
import { pagePaths } from '../../src/data/pages';
import { redirects } from '../../src/data/redirects';
import { applyCsp } from '../../tools/build/csp.mjs';
import { stubFile, stubHtml } from '../../tools/build/redirects.mjs';

const pages = new Set(pagePaths());
const froms = new Set(redirects.map((redirect) => redirect.from));
const withoutHash = (to: string) => to.split('#')[0];

describe('redirects', () => {
  it('lists each old URL once', () => {
    expect(froms.size).toBe(redirects.length);
  });

  it('never shadows a real page', () => {
    for (const { from } of redirects) expect(pages.has(from), from).toBe(false);
  });

  it('points every redirect at a real page', () => {
    for (const { from, to } of redirects) expect(pages.has(withoutHash(to)), `${from} -> ${to}`).toBe(true);
  });

  it('has no chains', () => {
    for (const { from, to } of redirects) expect(froms.has(withoutHash(to)), `${from} -> ${to}`).toBe(false);
  });

  it('names the locale of the page it points at', () => {
    for (const { from, to, locale } of redirects) {
      expect(locale, `${from} -> ${to}`).toBe(to.startsWith('/en/') ? 'en' : 'nl');
    }
  });

  it('writes a folder URL as .../ and a legacy file as .html', () => {
    for (const { from } of redirects) {
      expect(from.startsWith('/'), from).toBe(true);
      expect(from.endsWith('/') || from.endsWith('.html'), from).toBe(true);
    }
  });

  it('keeps the old project categories reachable in both languages', () => {
    const targets = new Map(redirects.map((redirect) => [redirect.from, redirect.to]));
    expect(targets.get('/projects/web-development/')).toBe('/projects/jontai-energy/');
    expect(targets.get('/en/projects/game-development/cookies-clicker/')).toBe('/en/projects/cookies-clicker/');
    expect(targets.get('/lab/compass/')).toBe('/');
    expect(targets.get('/en/lab/compass/')).toBe('/en/');
    expect(targets.get('/career/cybersecurity.html')).toBe('/lite/#career');
    expect(targets.get('/jontai-energy.html')).toBe('/projects/jontai-energy/');
    expect(targets.get('/nl/contact/')).toBe('/contact/');
  });

  it('does not redirect the pages that are real now', () => {
    for (const from of ['/projects/jontai-energy/', '/projects/cookies-clicker/', '/en/projects/jontai-energy/', '/en/projects/cookies-clicker/']) {
      expect(froms.has(from), from).toBe(false);
    }
  });
});

describe('redirect stubs', () => {
  const dutch = { from: '/nl/contact/', to: '/contact/', locale: 'nl' } as const;
  const english = { from: '/en/lab/compass/', to: '/en/', locale: 'en' } as const;
  const legacy = { from: '/career/cybersecurity.html', to: '/lite/#career', locale: 'nl' } as const;

  it('follows the locale in <html lang> and the wording', () => {
    expect(stubHtml(dutch)).toContain('<html lang="nl">');
    expect(stubHtml(dutch)).toContain('Verplaatst | Bob Chung');
    expect(stubHtml(english)).toContain('<html lang="en">');
    expect(stubHtml(english)).toContain('Moved | Bob Chung');
  });

  it('points the canonical, the refresh and the link at the target', () => {
    const html = stubHtml(legacy);
    expect(html).toContain('<link rel="canonical" href="https://bhccob.me/lite/#career" />');
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=/lite/#career" />');
    expect(html).toContain('<a href="/lite/#career">');
  });

  it('stays out of search results', () => {
    expect(stubHtml(dutch)).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it('takes a policy like any page: the placeholder, no script, and its style hashed', () => {
    for (const redirect of redirects) {
      const html = applyCsp(stubHtml(redirect));
      expect(html, redirect.from).not.toContain('__CSP__');
      expect(html, redirect.from).toMatch(/style-src 'self' 'sha256-[A-Za-z0-9+/=]+';/);
    }
  });

  it('puts a folder URL in its index.html and a legacy file where it was', () => {
    expect(stubFile('/nl/contact/')).toBe('nl/contact/index.html');
    expect(stubFile('/career/cybersecurity.html')).toBe('career/cybersecurity.html');
  });
});
