import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

describe('the domain files', () => {
  it('name bhccob.com as the custom domain, at the root and in what the build publishes', () => {
    expect(read('CNAME').trim()).toBe('bhccob.com');
    expect(read('public/CNAME').trim()).toBe('bhccob.com');
  });

  it('point robots.txt and security.txt at bhccob.com, and nowhere at bhccob.me', () => {
    const robots = read('public/robots.txt');
    const security = read('public/.well-known/security.txt');
    expect(robots).toContain('Sitemap: https://bhccob.com/sitemap-index.xml');
    expect(security).toContain('Canonical: https://bhccob.com/.well-known/security.txt');
    expect(robots + security).not.toContain('bhccob.me');
  });
});
