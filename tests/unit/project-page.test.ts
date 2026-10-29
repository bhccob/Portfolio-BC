import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import ProjectPage from '../../src/app/routes/project';
import { nl } from '../../src/i18n/nl';

const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ProjectPage)));

describe('a project page', () => {
  it('lists the stack and the links a project has', () => {
    const html = render('/projects/steady/');
    expect(html).toContain(`<dt class="label">${nl.work.stack}</dt>`);
    expect(html).toContain('<li>Expo (SDK 58)</li>');
    expect(html).toContain('href="https://github.com/bhccob/steady"');
  });

  it('gives a project with no live site no link to one', () => {
    expect(render('/projects/steady/')).not.toContain(nl.needle.project.site);
  });
});
