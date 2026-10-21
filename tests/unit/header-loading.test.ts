import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const base = readFileSync(fileURLToPath(new URL('../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** A style rule of base.css: the at-rules it sits in (outermost first), its selectors and its declarations. */
interface Rule {
  groups: string[];
  selectors: string[];
  declarations: Map<string, string>;
}

/**
 * The style rules of a stylesheet with no nesting: each `{` after an at-rule's prelude opens a group, each after a
 * selector list opens a rule, read to its `}`. Whitespace in a selector is folded to single spaces.
 */
function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  const groups: string[] = [];
  let mark = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = css.slice(mark, i).trim().replace(/\s+/g, ' ');
      if (prelude.startsWith('@')) {
        groups.push(prelude);
        mark = i + 1;
        continue;
      }
      const end = css.indexOf('}', i);
      const declarations = new Map<string, string>();
      for (const part of css.slice(i + 1, end).split(';')) {
        const colon = part.indexOf(':');
        if (colon > 0) declarations.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '));
      }
      rules.push({ groups: [...groups], selectors: prelude.split(',').map((s) => s.trim()), declarations });
      i = end;
      mark = end + 1;
    } else if (ch === '}') {
      groups.pop();
      mark = i + 1;
    } else if (ch === ';') {
      mark = i + 1;
    }
  }
  return rules;
}

const RULES = rulesOf(base);

/** The rules that list `selector` among their selectors, inside exactly the at-rules `groups`. */
function rulesFor(selector: string, groups: string[] = []): Rule[] {
  return RULES.filter((rule) => rule.selectors.includes(selector) && JSON.stringify(rule.groups) === JSON.stringify(groups));
}

/** The value `property` takes for `selector` inside `groups`, from the last rule that sets it (the cascade's winner among equals). */
function valueOf(selector: string, property: string, groups: string[] = []): string | undefined {
  return rulesFor(selector, groups)
    .map((rule) => rule.declarations.get(property))
    .filter((value) => value !== undefined)
    .at(-1);
}

const REDUCED = ['@media (prefers-reduced-motion: reduce)'];
const SCRIPTING = ['@media (scripting: enabled)'];

describe('the header while the opening plays (the loader has no text but its engraved ON)', () => {
  it('is hidden with the hero while <html data-loading> is set, by opacity alone, and takes no click while hidden', () => {
    expect(valueOf('html[data-loading] .hero', 'opacity')).toBe('0');
    expect(valueOf('html[data-loading] .site-header:not(:focus-within)', 'opacity')).toBe('0');
    expect(valueOf('html[data-loading] .site-header:not(:focus-within)', 'transition')).toBe('none');
    expect(valueOf('html[data-loading] .site-header:not(:focus-within)', 'pointer-events')).toBe('none');
  });

  it('shows at once whenever the keyboard is in it: every rule that hides it spares :focus-within', () => {
    const hiding = RULES.filter((rule) => rule.declarations.get('opacity') === '0').flatMap((rule) => rule.selectors.filter((s) => s.includes('.site-header')));
    expect(hiding.length).toBeGreaterThanOrEqual(2);
    for (const selector of hiding) expect(selector, selector).toMatch(/\.site-header:not\(:focus-within\)$/);
    expect(valueOf('.site-header:focus-within', 'transition')).toBe('none');
  });

  it('never hides the header, its links or the skip link with display or visibility, so Tab still reaches them', () => {
    const header = /\.(site-header|header-nav|header-control|site-name|skip-link)\b/;
    for (const rule of RULES) {
      if (!rule.selectors.some((s) => header.test(s))) continue;
      expect(rule.declarations.get('display'), rule.selectors.join(', ')).not.toBe('none');
      expect(rule.declarations.get('visibility'), rule.selectors.join(', ')).not.toBe('hidden');
    }
    // The skip link is not hidden for the loader at all: it stays where its own rule puts it until it has focus.
    expect(RULES.some((rule) => rule.selectors.some((s) => /data-loading|data-route\]\)/.test(s) && s.includes('.skip-link')))).toBe(false);
  });

  it('fades in with the hero as the loader lands, over the same 0.9 s, and at once with reduced motion', () => {
    const hero = valueOf('.hero', 'transition');
    expect(hero).toBe('opacity 0.9s var(--ease-reveal)');
    expect(valueOf('.site-header', 'transition')).toBe(hero);
    expect(valueOf('.hero', 'transition', REDUCED)).toBe('none');
    expect(valueOf('.site-header', 'transition', REDUCED)).toBe('none');
  });

  it("is covered by the hero's CSS fail-safe on the home page: hidden until the page hydrates, shown 8 s in if it never does", () => {
    const failsafe = 'html:not([data-route]):has(.hero) .site-header:not(:focus-within)';
    expect(valueOf('html:not([data-route]) .hero', 'animation', SCRIPTING)).toBe('hero-late 0.9s var(--ease-reveal) 8s forwards');
    expect(valueOf(failsafe, 'opacity', SCRIPTING)).toBe('0');
    expect(valueOf(failsafe, 'animation', SCRIPTING)).toBe(valueOf('html:not([data-route]) .hero', 'animation', SCRIPTING));
    // At once with reduced motion, as the hero.
    expect(valueOf('html:not([data-route]) .hero', 'animation-duration', REDUCED)).toBe('0s');
    expect(valueOf(failsafe, 'animation-duration', REDUCED)).toBe('0s');
  });

  it('waits for the bundle only on the home page: a page without a hero shows its header from the first paint', () => {
    for (const rule of RULES) {
      for (const selector of rule.selectors) {
        if (selector.includes('html:not([data-route])') && selector.includes('.site-header')) expect(selector).toContain(':has(.hero)');
      }
    }
  });
});
