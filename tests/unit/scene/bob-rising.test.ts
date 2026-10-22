import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { riseAt, risingFor } from '~/scene/bob/scrollPose';

describe('risingFor: the scroll cue leaves while the camera is up the rise', () => {
  it('is false at the home (u = 0) and true above it, to the very top', () => {
    expect(risingFor(0)).toBe(false);
    expect(risingFor(1e-9)).toBe(true);
    expect(risingFor(0.25)).toBe(true);
    expect(risingFor(0.6)).toBe(true);
    expect(risingFor(1)).toBe(true);
  });

  it('reads a rise that is not a number, or below the home, as the home', () => {
    expect(risingFor(Number.NaN)).toBe(false);
    expect(risingFor(-0.5)).toBe(false);
    expect(risingFor(-0)).toBe(false);
    expect(risingFor(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it("agrees with the pose's own rise: the wheel's float residue at the home is snapped to 0, so the cue comes back", () => {
    // Three notches down and three back leave 5.55e-17 of progress, which riseAt snaps to exactly 0 (Ruling 8).
    expect(risingFor(riseAt(5.55e-17))).toBe(false);
    expect(risingFor(riseAt(Number.NaN))).toBe(false);
    expect(risingFor(riseAt(0.001))).toBe(true);
    expect(risingFor(riseAt(5))).toBe(true);
  });
});

describe('the cue that leaves with the rise, in the stylesheet', () => {
  const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  /** A style rule of base.css: the at-rules it sits in (outermost first), its selectors and its declarations. */
  interface Rule {
    groups: string[];
    selectors: string[];
    declarations: Map<string, string>;
  }

  /** The style rules of a stylesheet with no nesting, read as tests/unit/scene/bob-step-fade.test.ts reads them. */
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
  const REDUCED = ['@media (prefers-reduced-motion: reduce)'];

  /** The value `property` takes for `selector` inside exactly `groups`, from the last rule that sets it. */
  function valueOf(selector: string, property: string, groups: string[] = []): string | undefined {
    return RULES.filter((rule) => rule.selectors.includes(selector) && JSON.stringify(rule.groups) === JSON.stringify(groups))
      .map((rule) => rule.declarations.get(property))
      .filter((value) => value !== undefined)
      .at(-1);
  }

  it('hides the cue by opacity alone while <html data-rising> is set, so it stays in the page for a screen reader', () => {
    expect(valueOf('html[data-rising] .hero-cue', 'opacity')).toBe('0');
    const rising = RULES.filter((rule) => rule.selectors.some((s) => s.includes('data-rising')));
    expect(rising.length).toBe(1);
    expect(rising[0]!.selectors).toEqual(['html[data-rising] .hero-cue']);
    expect([...rising[0]!.declarations.keys()]).toEqual(['opacity']);
    expect(rising[0]!.groups).toEqual([]);
  });

  it('moves the cue’s opacity over 0.4 s, out and back', () => {
    expect(valueOf('.hero-cue', 'transition')).toMatch(/^opacity 0\.4s\b/);
  });

  it('has no transition on the cue with reduced motion: it goes and returns at once', () => {
    expect(valueOf('.hero-cue', 'transition', REDUCED)).toBe('none');
  });

  it('puts the pulse on the word and the hairline, never on the cue itself, whose opacity the fade owns', () => {
    // An animation beats a plain declaration, so a pulse on the cue's own opacity would hold it up through the fade.
    expect(valueOf('.hero-cue', 'animation')).toBeUndefined();
    expect(valueOf('.hero-cue-word', 'animation')).toMatch(/^hero-cue-pulse 2\.4s\b.*\binfinite$/);
    expect(valueOf('.hero-cue::after', 'animation')).toMatch(/^hero-cue-line 2\.4s\b.*\binfinite$/);
    // Nothing the pulse animates (opacity, in both keyframes) is set on those two as a plain declaration either.
    expect(valueOf('.hero-cue-word', 'opacity')).toBeUndefined();
    expect(valueOf('.hero-cue::after', 'opacity')).toBeUndefined();
  });

  it('stops both pulses with reduced motion', () => {
    expect(valueOf('.hero-cue-word', 'animation', REDUCED)).toBe('none');
    expect(valueOf('.hero-cue::after', 'animation', REDUCED)).toBe('none');
  });

  it('never takes the cue out of the page: nothing on it or its word hides it but the opacity', () => {
    for (const rule of RULES) {
      if (!rule.selectors.some((s) => /\.hero-cue(-word)?$/.test(s))) continue;
      const label = rule.selectors.join(', ');
      expect(rule.declarations.get('display'), label).not.toBe('none');
      expect(rule.declarations.get('visibility'), label).toBeUndefined();
      expect(rule.declarations.get('clip-path'), label).toBeUndefined();
    }
  });
});
