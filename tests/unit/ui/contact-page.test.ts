import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Bob (2026-10-30): the contact page "more simple and in the middle"; shown two trial layouts he picked "A · Centred":
// the same parts as before, in one centred column (.superpowers/r7/contact-options.png).

/** base.css's top-level rules (outside any at-rule): each selector list and its declarations. */
function topRules(): { selectors: string[]; body: string }[] {
  const css = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: { selectors: string[]; body: string }[] = [];
  let depth = 0;
  let mark = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      const prelude = css.slice(mark, i).trim().replace(/\s+/g, ' ');
      if (depth === 0 && !prelude.startsWith('@')) {
        const end = css.indexOf('}', i);
        rules.push({ selectors: prelude.split(',').map((s) => s.trim()), body: css.slice(i + 1, end) });
        i = end;
        mark = i + 1;
        continue;
      }
      depth++;
      mark = i + 1;
    } else if (css[i] === '}') {
      depth = Math.max(0, depth - 1);
      mark = i + 1;
    }
  }
  return rules;
}
const rules = topRules();
const body = (selector: string): string => rules.filter((r) => r.selectors.includes(selector)).map((r) => r.body).join(';');

describe('the contact page: one centred column', () => {
  it('stands in the middle of the screen, its words centred, in a column 34rem wide', () => {
    expect(body('.page.contact')).toMatch(/max-width:\s*calc\(34rem \+ 2 \* var\(--gutter\)\)/);
    expect(body('.page.contact')).toMatch(/margin-inline:\s*auto/);
    expect(body('.page.contact')).toMatch(/text-align:\s*center/);
  });

  it('keeps its title a little smaller than a page title, and its lead under it in the middle', () => {
    expect(body('.contact .page-title')).toMatch(/font-size:\s*clamp\(2\.2rem, 5vw, 3\.2rem\)/);
    expect(body('.contact .lead')).toMatch(/margin-inline:\s*auto/);
  });

  it('keeps the form in the middle, its labels and fields read from the left', () => {
    expect(body('.contact .form')).toMatch(/margin-inline:\s*auto/);
    expect(body('.contact .form')).toMatch(/text-align:\s*left/);
  });

  it('puts the direct links in the middle under it', () => {
    expect(body('.contact .links')).toMatch(/justify-content:\s*center/);
  });
});
