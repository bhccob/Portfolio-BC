import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { links } from '~/app/root';

const path = (p: string): string => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string): string => readFileSync(path(p), 'utf8');

// Bob's logo, the chbc kit (2026-10-31: "my logo please add it also in favicon and readme keep the readme super simple
// no extra text"): the paper Bézier mark on its ink tile as every icon, and the README the logo alone.
describe("the site's icons and the README: Bob's logo", () => {
  it('links the logo as the tab icon, the .ico for browsers that ask for one, then the SVG', () => {
    const icons = links().filter((link) => 'rel' in link && link.rel === 'icon');
    expect(icons).toEqual([
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }
    ]);
  });

  it("ships the kit's icons: the paper mark on its ink tile", () => {
    const svg = read('public/favicon.svg');
    expect(svg).toContain('fill="#434842"');
    expect(svg).toContain('fill="#F4F5F0"');
    // An icon file starts 0, 0, 1, 0.
    expect([...readFileSync(path('public/favicon.ico')).subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    for (const file of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
      expect(existsSync(path(`public/${file}`)), file).toBe(true);
    }
  });

  it('is the README: the logo, for a light and a dark page, and the site', () => {
    const readme = read('README.md');
    expect(readme).toContain('<picture>');
    expect(readme).toContain('srcset="docs/brand/chbc-horizontal-white.svg"');
    expect(readme).toContain('src="docs/brand/chbc-horizontal-black.svg"');
    expect(readme).toContain('https://bhccob.com');
    for (const file of ['docs/brand/chbc-horizontal-white.svg', 'docs/brand/chbc-horizontal-black.svg']) {
      expect(existsSync(path(file)), file).toBe(true);
    }
    // Nothing else: no headings and no prose.
    expect(readme).not.toMatch(/^#/m);
    expect(readme.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).toBe('bhccob.com');
  });
});
