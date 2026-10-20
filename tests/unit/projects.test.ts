import { describe, expect, it } from 'vitest';
import { categories } from '../../src/data/categories';
import { PAGES } from '../../src/data/pages';
import { projects } from '../../src/data/projects';
import { locales } from '../../src/i18n/Translator';

const all = projects.all();
const project = (id: string) => {
  const found = projects.byId(id);
  if (!found) throw new Error(`no project ${id}`);
  return found;
};

describe('categories', () => {
  it('are the three approved void categories, in order', () => {
    expect(categories.all().map((category) => [category.id, category.number, category.label('en')])).toEqual([
      ['secure-element', 1, 'SECURE ELEMENT'],
      ['front-panel', 2, 'FRONT PANEL'],
      ['oscillator', 3, 'OSCILLATOR'],
    ]);
  });

  it('are translated in Dutch, in the style of the copy budget', () => {
    expect(categories.all().map((category) => category.label('nl'))).toEqual(['BEVEILIGD ELEMENT', 'FRONTPANEEL', 'OSCILLATOR']);
  });

  it('write a heading as "01 — LABEL"', () => {
    expect(categories.byId('secure-element').heading('en')).toBe('01 — SECURE ELEMENT');
    expect(categories.byId('secure-element').heading('nl')).toBe('01 — BEVEILIGD ELEMENT');
    expect(categories.byId('oscillator').heading('en')).toBe('03 — OSCILLATOR');
  });
});

describe('projects', () => {
  it('are three, in the order funcial, jontai-energy, cookies-clicker', () => {
    expect(all).toHaveLength(3);
    expect(all.map((entry) => entry.id)).toEqual(['funcial', 'jontai-energy', 'cookies-clicker']);
    expect(all.map((entry) => entry.order)).toEqual([1, 2, 3]);
  });

  it('have unique ids', () => {
    expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length);
  });

  it('each name a category that exists', () => {
    const known = categories.all().map((category) => category.id);
    for (const entry of all) expect(known, entry.id).toContain(entry.categoryId);
    expect(all.map((entry) => entry.categoryId)).toEqual(['secure-element', 'front-panel', 'oscillator']);
  });

  it('each have a page of their own', () => {
    for (const entry of all) expect(projects.route(entry), entry.id).toBe(PAGES[`project-${entry.id}` as keyof typeof PAGES]);
  });

  it('each have 4 or 5 test points, labelled in both languages', () => {
    for (const entry of all) {
      expect(entry.testPoints.length, entry.id).toBeGreaterThanOrEqual(4);
      expect(entry.testPoints.length, entry.id).toBeLessThanOrEqual(5);
      for (const point of entry.testPoints) {
        for (const locale of locales) expect(point.label[locale].trim().length, `${entry.id} ${point.id} ${locale}`).toBeGreaterThan(0);
        expect(point.position).toHaveLength(3);
      }
      expect(new Set(entry.testPoints.map((point) => point.id)).size, entry.id).toBe(entry.testPoints.length);
    }
  });

  it('label Funcial’s test points LOG, GAME LAYER, MONEY RULES, VAULT, RESULT', () => {
    expect(project('funcial').testPoints.map((point) => point.label.en)).toEqual(['LOG', 'GAME LAYER', 'MONEY RULES', 'VAULT', 'RESULT']);
    expect(project('funcial').testPointLabels('en').join(', ')).toBe('LOG, GAME LAYER, MONEY RULES, VAULT, RESULT');
  });

  it('translate the test point labels', () => {
    expect(project('funcial').testPointLabels('nl')).toEqual(['LOG', 'SPELLAAG', 'GELDREGELS', 'KLUIS', 'UITKOMST']);
    expect(project('jontai-energy').testPointLabels('en')).toEqual(['16 PAGES', 'DESIGN SYSTEM', 'THREE LANGUAGES', 'QUOTE PATH']);
    expect(project('jontai-energy').testPointLabels('nl')).toEqual(['16 PAGINA’S', 'DESIGNSYSTEEM', 'DRIE TALEN', 'OFFERTEPAD']);
    expect(project('cookies-clicker').testPointLabels('en')).toEqual(['CLICK LOOP', '8 PRODUCERS', 'BOOSTS & EVENTS', 'SAVE', 'STATS']);
    expect(project('cookies-clicker').testPointLabels('nl')).toEqual(['KLIKLUS', '8 PRODUCENTEN', 'BOOSTS & EVENTS', 'OPSLAG', 'STATISTIEKEN']);
  });

  it('keep the approved placeholder positions', () => {
    expect(project('funcial').testPoints.map((point) => point.position)).toEqual([
      [-0.62, 0.02, 0.48],
      [-0.31, 0.02, 0.71],
      [0.05, 0.02, 0.78],
      [0.4, 0.02, 0.66],
      [0.7, 0.02, 0.38],
    ]);
    expect(project('jontai-energy').testPoints.map((point) => point.position)).toEqual([
      [-0.45, 0.03, -0.2],
      [0.0, 0.03, 0.05],
      [0.62, 0.06, 0.55],
      [0.95, 0.0, 0.8],
    ]);
    expect(project('cookies-clicker').testPoints.map((point) => point.position)).toEqual([
      [0.92, 0.0, 0.0],
      [-0.2, 0.08, 0.3],
      [0.35, 0.1, -0.45],
      [-0.55, 0.06, -0.35],
      [0.0, 0.14, 0.0],
    ]);
  });

  it('keep the approved objects, palettes and links', () => {
    expect(project('funcial').object.fallbackGeometry).toBe('platter-track+abacus+phone');
    expect(project('jontai-energy').object.fallbackGeometry).toBe('pv-module-4x4+junction-box');
    expect(project('cookies-clicker').object.fallbackGeometry).toBe('clockwork-movement-8-wheels');
    expect(project('funcial').palette).toEqual({ accent: '#7c5cff', glow: '#efb53d' });
    expect(project('jontai-energy').palette).toEqual({ accent: '#00a650', glow: '#00d16a' });
    expect(project('cookies-clicker').palette).toEqual({ accent: '#c69255', glow: '#ff8a3d' });
    expect(project('funcial').links).toEqual({ live: 'https://funcial.vercel.app/get', repo: 'https://github.com/bhccob/Funcial' });
    expect(project('jontai-energy').links).toEqual({ repo: 'https://github.com/bhccob/JE' });
    expect(project('cookies-clicker').links).toEqual({ repo: 'https://github.com/bhccob/Cookies-Clicker' });
    for (const entry of all) expect(entry.motion.length, entry.id).toBeGreaterThan(0);
  });

  it('spell Funcial exactly so, in every language', () => {
    expect(project('funcial').title).toBe('Funcial');
    for (const entry of all) {
      for (const locale of locales) {
        const copy = entry.copy(locale);
        expect(JSON.stringify(copy), `${entry.id} ${locale}`).not.toMatch(/funancial/i);
      }
    }
  });

  it('never list AI or Claude in a stack, and never describe Funcial with AI', () => {
    for (const entry of all) for (const tool of entry.stack) expect(tool, entry.id).not.toMatch(/\b(AI|Claude)\b/i);
    for (const locale of locales) {
      const funcial = project('funcial');
      const words = [funcial.copy(locale).summary, funcial.copy(locale).type, funcial.copy(locale).metaDescription, ...funcial.stack].join(' ');
      expect(words).not.toMatch(/\bAI\b|artificial|kunstmatig|Claude/i);
    }
  });

  it('list the stacks the discovery approved', () => {
    expect(project('funcial').stack).toEqual(['React 19', 'TypeScript', 'Tailwind CSS v4', 'Zustand', 'Capacitor', 'SQLCipher', 'Web Crypto', 'Vercel Functions']);
    expect(project('jontai-energy').stack).toEqual(['HTML', 'Tailwind CSS v4', 'JavaScript', 'PowerShell']);
    expect(project('cookies-clicker').stack).toEqual(['HTML', 'CSS', 'JavaScript', 'Bootstrap 5', 'localStorage']);
  });

  it('give Funcial no screenshot', () => {
    expect(project('funcial').image).toBeUndefined();
    expect(project('jontai-energy').image).toBeTypeOf('string');
    expect(project('cookies-clicker').image).toBeTypeOf('string');
  });

  it('never call Jontai Energy client work, and never link its company site or the unpublished Rewards work', () => {
    const jontai = project('jontai-energy');
    expect(jontai.links.live).toBeUndefined();
    for (const locale of locales) {
      const text = JSON.stringify(jontai.copy(locale));
      expect(text, locale).not.toMatch(/client work|for a client|klantwerk|voor een klant|opdracht/i);
      expect(text, locale).not.toMatch(/rewards/i);
    }
    expect(JSON.stringify(jontai)).not.toMatch(/jontaienergy\.com/i);
  });

  it('say Cookies Clicker is a school project for Web Game Development, made with "a classmate" at most', () => {
    const cookies = project('cookies-clicker');
    expect(cookies.copy('en').type).toMatch(/Web Game Development/);
    expect(cookies.copy('nl').type).toMatch(/Web Game Development/);
    // The classmate is never named (Bob has not decided): the only word for them is "classmate" / "klasgenoot".
    // His own part is not known either, so the role claims nothing about it.
    expect(cookies.copy('en').role).toBe('With a classmate');
    expect(cookies.copy('nl').role).toBe('Samen met een klasgenoot');
  });

  it('find a project by the route of its page, and none by a route that only differs in case', () => {
    expect(projects.byRoute('/projects/funcial/')?.id).toBe('funcial');
    expect(projects.byRoute('/projects/jontai-energy/')?.id).toBe('jontai-energy');
    expect(projects.byRoute('/projects/cookies-clicker/')?.id).toBe('cookies-clicker');
    expect(projects.byRoute('/Projects/Funcial/')).toBeUndefined();
    expect(projects.byRoute('/projects/FUNCIAL/')).toBeUndefined();
    expect(projects.byRoute('/projects/')).toBeUndefined();
  });

  it('write every project’s page copy in both languages', () => {
    for (const entry of all) {
      for (const locale of locales) {
        const copy = entry.copy(locale);
        for (const key of ['type', 'role', 'summary', 'metaDescription'] as const) expect(copy[key].trim().length, `${entry.id} ${locale} ${key}`).toBeGreaterThan(0);
        // The auditor wants a description of 50-170 characters.
        expect(copy.metaDescription.length, `${entry.id} ${locale}`).toBeGreaterThanOrEqual(50);
        expect(copy.metaDescription.length, `${entry.id} ${locale}`).toBeLessThanOrEqual(170);
      }
    }
  });
});
