import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import ProjectPage from '~/app/routes/project';
import { projects } from '~/data/projects';
import { ProjectViews } from '~/ui/ProjectView';

// Bob (2026-10-30): "the picture of jontai energy should be changed to new one", then, asked, "Yes, and update its
// text": Jontai Energy is now his concept redesign of the store's site (github.com/bhccob/Jontai-Energy, 9546f43), so its
// picture is the redesign's first screen and its words and tools come from that repository's own notes (PRODUCT.md,
// its design spec, package.json), nothing added.

const render = (path: string, page: ComponentType): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(page)));
/** Jontai Energy's view over the stack in the markup. */
const viewOf = (html: string): string => {
  const start = html.indexOf('data-project="jontai-energy"');
  const end = html.indexOf('data-project="', start + 20);
  return html.slice(start, end < 0 ? undefined : end);
};

describe('Jontai Energy, the concept redesign', () => {
  const jontai = projects.byId('jontai-energy')!;

  it("shows the redesign's first screen as its one picture", () => {
    expect(jontai.pictureKind).toBe('wide');
    expect(jontai.pictures).toEqual([
      {
        file: 'jontai-dawn.webp',
        alt: {
          nl: 'Herontwerp van Jontai Energy: “Aruba sunlight, made useful.” naast een zonnepaneel op een gestucte muur bij zonsopgang',
          en: 'Jontai Energy redesign: “Aruba sunlight, made useful.” beside a solar panel on a plaster wall at dawn'
        }
      }
    ]);
    expect(jontai.pictureCaption('nl')).toBe('Het eerste scherm van het herontwerp, bij zonsopgang');
    expect(jontai.pictureCaption('en')).toBe("The redesign's first screen, at dawn");
    expect(typeof jontai.pictureUrl('jontai-dawn.webp')).toBe('string');
    const view = viewOf(render('/', ProjectViews));
    expect((view.match(/class="pv-card pv-wide"/g) ?? []).length).toBe(1);
    expect(view).toContain('alt="Herontwerp van Jontai Energy: “Aruba sunlight, made useful.” naast een zonnepaneel op een gestucte muur bij zonsopgang"');
    expect(view).not.toContain('jontai-home');
  });

  it("lists the redesign's own tools", () => {
    expect(jontai.stack).toEqual(['Next.js', 'React', 'TypeScript', 'GSAP', 'Lenis', 'Blender']);
  });

  it('calls it a concept redesign and a personal project', () => {
    expect(jontai.copy('en').type).toBe('Concept website redesign · Personal project');
    expect(jontai.copy('nl').type).toBe('Concept-herontwerp van een website · Eigen project');
    expect(jontai.copy('en').summary).toBe(
      'A concept redesign of the website for Jontai Energy, a store in Oranjestad, Aruba, for solar, power, lighting and furniture: its home page is one Aruban day that plays as you scroll.'
    );
    expect(jontai.copy('nl').summary).toBe(
      'Een concept-herontwerp van de website van Jontai Energy, een winkel in Oranjestad, Aruba, voor zonne-energie, stroom, verlichting en meubels: de homepagina is één Arubaanse dag die meespeelt terwijl je scrolt.'
    );
  });

  it('labels its points with what the redesign has', () => {
    expect(jontai.testPointLabels('en')).toEqual(['DAY FILM', 'PRODUCT PANELS', 'LIGHT SLIDER', 'QUOTE PATH']);
    expect(jontai.testPointLabels('nl')).toEqual(['DAGFILM', 'PRODUCTPANELEN', 'LICHTSCHUIF', 'OFFERTEPAD']);
  });

  it('says nothing more of the old static site', () => {
    for (const locale of ['en', 'nl'] as const) {
      // Every word the site shows of it (its old screenshot's alt text goes with that screenshot, which no page shows).
      const copy = jontai.copy(locale);
      const words = [copy.type, copy.role, copy.summary, copy.overview, copy.build, copy.focus, copy.metaDescription, ...jontai.testPointLabels(locale)].join(' ');
      expect(words, locale).not.toMatch(/Tailwind|PowerShell|HTML|three languages|drie talen|Spanish|Spaans|Chinese|Chinees|fifteen|vijftien|16 pages|16 pagina/i);
      expect(words, locale).not.toMatch(/official|officiële|we install|installeren/i);
    }
  });

  it('shows its new words and tools on its own page', () => {
    for (const [path, locale] of [
      ['/projects/jontai-energy/', 'nl'],
      ['/en/projects/jontai-energy/', 'en']
    ] as const) {
      const html = render(path, ProjectPage);
      const copy = jontai.copy(locale);
      for (const text of [copy.summary, copy.type, copy.overview!, copy.build!, copy.focus!]) expect(html, locale).toContain(text.replace(/'/g, '&#x27;'));
      for (const tool of jontai.stack) expect(html, `${locale} ${tool}`).toContain(`<li>${tool}</li>`);
    }
  });
});
