import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const tokens = read('../../src/styles/tokens.css');
const base = read('../../src/styles/base.css');

/** Each CSS rule's selector and declarations (no nesting beyond @media, which this file's rules sit in at most). */
function rules(css: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) found.push({ selector: match[1].trim(), body: match[2] });
  return found;
}

describe('the title font (Unbounded)', () => {
  it("turns off its Dutch locl, which draws I + J as one glyph that reads as a U ('KWUT')", () => {
    expect(tokens).toMatch(/--font-title-features:\s*'locl'\s+0\s*;/);
  });

  it('gets those features in every rule that sets it', () => {
    const titled = rules(base).filter((rule) => /font-family:\s*var\(--font-title\)/.test(rule.body));
    expect(titled.length).toBeGreaterThanOrEqual(8);
    const missing = titled.filter((rule) => !/font-feature-settings:\s*var\(--font-title-features\)/.test(rule.body)).map((rule) => rule.selector);
    expect(missing).toEqual([]);
  });
});
