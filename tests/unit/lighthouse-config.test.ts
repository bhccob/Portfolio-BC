import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pagePaths } from '~/data/pages';

/** lighthouserc.json, which the deploy's Lighthouse step reads (.github/workflows/deploy.yml). */
const config = JSON.parse(readFileSync(fileURLToPath(new URL('../../lighthouserc.json', import.meta.url)), 'utf8')) as {
  ci: { collect: { url: string[] } };
};

// The go-live checks (2026-10-29) found Lighthouse stopping on /projects/funcial/, a 404 since Funcial left the site, which
// fails the deploy before it publishes anything.
describe("the deploy's Lighthouse pages", () => {
  it('are pages the site builds', () => {
    const built = new Set(pagePaths());
    const urls = config.ci.collect.url;
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(built.has(url), url).toBe(true);
  });
});
