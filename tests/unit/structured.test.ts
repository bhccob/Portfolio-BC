import { describe, expect, it } from 'vitest';
import { projects } from '../../src/data/projects';
import { breadcrumbLd, personLd, projectLd, websiteLd } from '../../src/seo/structured';

const funcial = projects.byId('funcial');
if (!funcial) throw new Error('no Funcial');

describe('structured data', () => {
  it('describes Bob as a Person, with his real profiles and no email address', () => {
    const person = personLd();
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('Bob Chung');
    expect(person.url).toBe('https://bhccob.me');
    expect(person.jobTitle).toBe('Student Software Engineer');
    expect(person.sameAs).toEqual(['https://github.com/bhccob', 'https://www.instagram.com/bhccob/']);
    expect(JSON.stringify(person)).not.toMatch(/mailto|@gmail/);
  });

  it('describes the site, written by that Person', () => {
    const site = websiteLd();
    expect(site['@type']).toBe('WebSite');
    expect(site.inLanguage).toEqual(['nl', 'en']);
    expect(site.author).toEqual({ '@id': personLd()['@id'] });
  });

  it('describes a project as source code, with its repository and no AI in its keywords', () => {
    const ld = projectLd(funcial, 'en');
    expect(ld['@type']).toBe('SoftwareSourceCode');
    expect(ld.name).toBe('Funcial');
    expect(ld.url).toBe('https://bhccob.me/en/projects/funcial/');
    expect(ld.codeRepository).toBe('https://github.com/bhccob/Funcial');
    expect(ld.dateCreated).toBe('2026');
    expect(ld.inLanguage).toBe('en');
    expect(JSON.stringify(ld.keywords)).not.toMatch(/\bAI\b|Claude/);
  });

  it('lists the stack as keywords, not as programming languages (React, Tailwind and Vercel are not languages)', () => {
    for (const project of projects.all()) {
      const ld = projectLd(project, 'nl');
      expect(ld.keywords, project.id).toBe(project.stack.join(', '));
      expect(ld, project.id).not.toHaveProperty('programmingLanguage');
    }
  });

  it('writes a breadcrumb trail of absolute URLs', () => {
    const trail = breadcrumbLd('nl', [
      { name: 'Bob Chung', route: '/' },
      { name: 'Funcial', route: '/projects/funcial/' },
    ]);
    expect(trail['@type']).toBe('BreadcrumbList');
    expect(trail.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Bob Chung', item: 'https://bhccob.me/' },
      { '@type': 'ListItem', position: 2, name: 'Funcial', item: 'https://bhccob.me/projects/funcial/' },
    ]);
  });
});
