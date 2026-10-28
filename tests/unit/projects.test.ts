import { describe, expect, it } from 'vitest';
import { categories } from '../../src/data/categories';
import { PAGES } from '../../src/data/pages';
import { type ProjectData, ProjectCatalog, projects } from '../../src/data/projects';
import { locales } from '../../src/i18n/Translator';

const all = projects.all();
const project = (id: string) => {
  const found = projects.byId(id);
  if (!found) throw new Error(`no project ${id}`);
  return found;
};

describe('categories', () => {
  it('are the kinds of work, in order (Bob, 2026-10-28: "Game Developement, Website, App")', () => {
    expect(categories.all().map((category) => [category.id, category.number, category.label('en')])).toEqual([
      ['app', 1, 'APP'],
      ['website', 2, 'WEBSITE'],
      ['game', 3, 'GAME DEVELOPMENT'],
    ]);
  });

  it('are translated in Dutch', () => {
    expect(categories.all().map((category) => category.label('nl'))).toEqual(['APP', 'WEBSITE', 'GAME-ONTWIKKELING']);
  });

  it('heads the categories by number and kind, in both languages', () => {
    expect(categories.byId('app').heading('en')).toBe('01 — APP');
    expect(categories.byId('website').heading('nl')).toBe('02 — WEBSITE');
    expect(categories.byId('game').heading('en')).toBe('03 — GAME DEVELOPMENT');
    expect(categories.byId('game').heading('nl')).toBe('03 — GAME-ONTWIKKELING');
  });
});

describe('projects', () => {
  it('are four, in the order steady, porfael, jontai-energy, cookies-clicker', () => {
    expect(all.map((entry) => entry.id)).toEqual(['steady', 'porfael', 'jontai-energy', 'cookies-clicker']);
    expect(all.map((entry) => entry.order)).toEqual([1, 2, 3, 4]);
  });

  it('has no Funcial anywhere: no project, page or route by that id (Bob, 2026-10-28)', () => {
    expect(projects.byId('funcial')).toBeUndefined();
    expect(Object.keys(PAGES).some((page) => page.includes('funcial'))).toBe(false);
    expect(Object.values(PAGES).some((route) => route.includes('funcial'))).toBe(false);
    expect(projects.byRoute('/projects/funcial/')).toBeUndefined();
  });

  it('have unique ids', () => {
    expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length);
  });

  it('files each project under the kind of work it is', () => {
    const known = categories.all().map((category) => category.id);
    for (const entry of all) expect(known, entry.id).toContain(entry.categoryId);
    expect(all.map((entry) => entry.categoryId)).toEqual(['app', 'app', 'website', 'game']);
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

  it('translate the test point labels', () => {
    expect(project('steady').testPointLabels('en')).toEqual(['REMINDERS', 'STREAK PATH', 'INSIGHTS', 'SUPPORT LEVELS', 'PRIVACY']);
    expect(project('steady').testPointLabels('nl')).toEqual(['HERINNERINGEN', 'STREAKPAD', 'INZICHTEN', 'STEUNNIVEAUS', 'PRIVACY']);
    expect(project('porfael').testPointLabels('en')).toEqual(['PORTFOLIO', 'PAPER TRADES', 'THESES', 'GUILDS', 'RELICS']);
    expect(project('porfael').testPointLabels('nl')).toEqual(['PORTEFEUILLE', 'OEFENTRADES', 'THESES', 'GILDES', 'RELICS']);
    expect(project('jontai-energy').testPointLabels('en')).toEqual(['16 PAGES', 'DESIGN SYSTEM', 'THREE LANGUAGES', 'QUOTE PATH']);
    expect(project('jontai-energy').testPointLabels('nl')).toEqual(['16 PAGINA’S', 'DESIGNSYSTEEM', 'DRIE TALEN', 'OFFERTEPAD']);
    expect(project('cookies-clicker').testPointLabels('en')).toEqual(['CLICK LOOP', '8 PRODUCERS', 'BOOSTS & EVENTS', 'SAVE', 'STATS']);
    expect(project('cookies-clicker').testPointLabels('nl')).toEqual(['KLIKLUS', '8 PRODUCENTEN', 'BOOSTS & EVENTS', 'OPSLAG', 'STATISTIEKEN']);
  });

  it('keep the approved placeholder positions', () => {
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
    expect(project('steady').object.fallbackGeometry).toBe('streak-path-7-blocks+trophy');
    expect(project('porfael').object.fallbackGeometry).toBe('allocation-ring-5+relic');
    expect(project('jontai-energy').object.fallbackGeometry).toBe('pv-module-4x4+junction-box');
    expect(project('cookies-clicker').object.fallbackGeometry).toBe('clockwork-movement-8-wheels');
    // Steady's own brand colours (its logo kit): Mark Bronze and Steady Beige.
    expect(project('steady').palette).toEqual({ accent: '#7f6440', glow: '#e8d5b5' });
    expect(project('jontai-energy').palette).toEqual({ accent: '#00a650', glow: '#00d16a' });
    expect(project('cookies-clicker').palette).toEqual({ accent: '#c69255', glow: '#ff8a3d' });
    expect(project('steady').links).toEqual({ repo: 'https://github.com/bhccob/steady' });
    // In development: no link until Bob gives one.
    expect(project('porfael').links).toEqual({});
    expect(project('jontai-energy').links).toEqual({ repo: 'https://github.com/bhccob/JE' });
    expect(project('cookies-clicker').links).toEqual({ repo: 'https://github.com/bhccob/Cookies-Clicker' });
    for (const entry of all) expect(entry.motion.length, entry.id).toBeGreaterThan(0);
  });

  it('gives Steady and Porfael their own words, in both languages', () => {
    // Steady's README: "A calm, private medication reminder for people working through hard things."
    expect(project('steady').copy('en').summary).toBe('A calm, private medication reminder for people working through hard things.');
    expect(project('steady').copy('nl').summary).toBe('Een rustige, privé medicatieherinnering voor mensen die door moeilijke dingen gaan.');
    // Porfael is being built (Bob, 2026-10-28): it says so.
    expect(project('porfael').copy('en').summary).toMatch(/In development\.$/);
    expect(project('porfael').copy('nl').summary).toMatch(/In ontwikkeling\.$/);
    for (const id of ['steady', 'porfael']) {
      expect(project(id).copy('en').role, id).toBe('Sole developer');
      expect(project(id).copy('nl').role, id).toBe('Enige ontwikkelaar');
      expect(project(id).year, id).toBe(2026);
    }
  });

  it('never list AI or Claude in a stack, nor describe a project with AI', () => {
    for (const entry of all) {
      for (const tool of entry.stack) expect(tool, entry.id).not.toMatch(/\b(AI|Claude)\b/i);
      for (const locale of locales) {
        const copy = entry.copy(locale);
        expect([copy.summary, copy.type, copy.metaDescription].join(' '), `${entry.id} ${locale}`).not.toMatch(/\bAI\b|artificial|kunstmatig|Claude/i);
      }
    }
  });

  it('list the stacks their own sources give, and none for Porfael until Bob gives it', () => {
    expect(project('steady').stack).toEqual(['Expo (SDK 58)', 'React Native', 'TypeScript', 'SQLite']);
    expect(project('porfael').stack).toEqual([]);
    expect(project('jontai-energy').stack).toEqual(['HTML', 'Tailwind CSS v4', 'JavaScript', 'PowerShell']);
    expect(project('cookies-clicker').stack).toEqual(['HTML', 'CSS', 'JavaScript', 'Bootstrap 5', 'localStorage']);
  });

  it('give Steady and Porfael no screenshot', () => {
    expect(project('steady').image).toBeUndefined();
    expect(project('porfael').image).toBeUndefined();
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
    expect(projects.byRoute('/projects/steady/')?.id).toBe('steady');
    expect(projects.byRoute('/projects/porfael/')?.id).toBe('porfael');
    expect(projects.byRoute('/projects/jontai-energy/')?.id).toBe('jontai-energy');
    expect(projects.byRoute('/projects/cookies-clicker/')?.id).toBe('cookies-clicker');
    expect(projects.byRoute('/Projects/Steady/')).toBeUndefined();
    expect(projects.byRoute('/projects/STEADY/')).toBeUndefined();
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

describe('the projects on the way (spec 2026-10-27-bob-light-path-design.md, goal 6: Way 2)', () => {
  /** Seven copies of the first project's data, ordered 1 to 7, flagged on the way where listed. */
  const sevenStubs = ({ flagged }: { flagged: number[] }): ProjectData[] => {
    const first = (projects as unknown as { items: { data: ProjectData }[] }).items[0]!.data;
    return Array.from({ length: 7 }, (_, k) => ({ ...first, order: k + 1, onPath: flagged.includes(k + 1) }));
  };

  it('puts every project on the way while there are five or fewer', () => {
    expect(projects.onPath().map((p) => p.id)).toEqual(['steady', 'porfael', 'jontai-energy', 'cookies-clicker']);
    expect(projects.offPath()).toEqual([]);
  });

  it('takes the flagged projects onto the way when there are more than five', () => {
    const seven = new ProjectCatalog(sevenStubs({ flagged: [1, 2, 4, 5, 7] }));
    expect(seven.onPath().map((p) => p.order)).toEqual([1, 2, 4, 5, 7]);
    expect(seven.offPath().map((p) => p.order)).toEqual([3, 6]);
  });

  it('refuses more than five flagged, or none, past five projects', () => {
    expect(() => new ProjectCatalog(sevenStubs({ flagged: [1, 2, 3, 4, 5, 6] })).onPath()).toThrow(/at most 5/);
    expect(() => new ProjectCatalog(sevenStubs({ flagged: [] })).onPath()).toThrow(/at most 5/);
  });
});
