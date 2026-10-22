import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nearestStop, STEP_FADE_MS, type StepFade, stepFadeAt, stepFadeFor, stepFadeFrom } from '~/scene/bob/stepFade';
import { HOME_CHAPTERS, stops } from '~/state/chapters';

describe('stepFadeFor', () => {
  it('fades only when a reduced-motion visitor moved to another stop', () => {
    expect(stepFadeFor(0, 1, true)).toBe(true);
    expect(stepFadeFor(1, 1, true)).toBe(false);
    expect(stepFadeFor(0, 1, false)).toBe(false);
    expect(stepFadeFor(1, 0, true)).toBe(true);
    expect(stepFadeFor(1, 0, false)).toBe(false);
  });

  it('is 150 ms each way', () => {
    expect(STEP_FADE_MS).toBe(150);
  });
});

describe('nearestStop', () => {
  const PLACES = stops(HOME_CHAPTERS);

  it('is the stop itself on a stop, and the nearer one between two', () => {
    for (const stop of PLACES) expect(nearestStop(PLACES, stop)).toBe(stop);
    expect(nearestStop(PLACES, 0.4)).toBe(0);
    expect(nearestStop(PLACES, 0.6)).toBe(1);
    expect(nearestStop(PLACES, 1 + 1e-7)).toBe(1);
  });

  it('holds a place outside the story to its ends, and reads NaN as the first stop', () => {
    expect(nearestStop(PLACES, -3)).toBe(0);
    expect(nearestStop(PLACES, HOME_CHAPTERS.total + 5)).toBe(HOME_CHAPTERS.total);
    expect(nearestStop(PLACES, Number.NaN)).toBe(0);
  });

  it('answers 0 for no stops at all', () => {
    expect(nearestStop([], 3)).toBe(0);
  });
});

describe('stepFadeAt: the fade a reduced-motion step runs', () => {
  /** The fade after a frame at `now` with the target nearest `stop`: a copy, so a test can keep the frames apart. */
  const at = (fade: StepFade, stop: number, reduced: boolean, now: number): StepFade => ({ ...stepFadeAt(fade, stop, reduced, now) });

  it('starts at rest at the stop it is given', () => {
    expect(stepFadeFrom(1)).toEqual({ shown: 1, next: 1, darkAt: null });
  });

  it('holds the pose at the old stop while it fades down, jumps once it is dark, then lets it fade back', () => {
    const fade = stepFadeFrom(0);
    expect(at(fade, 1, true, 1000)).toEqual({ shown: 0, next: 1, darkAt: 1150 });
    // Fading down: the scene still shows the home.
    expect(at(fade, 1, true, 1100)).toEqual({ shown: 0, next: 1, darkAt: 1150 });
    expect(at(fade, 1, true, 1149.9)).toMatchObject({ shown: 0, darkAt: 1150 });
    // Dark: the pose jumps to the new stop and the fade goes, so the host fades back in.
    expect(at(fade, 1, true, 1150)).toEqual({ shown: 1, next: 1, darkAt: null });
    // At rest there: nothing more.
    expect(at(fade, 1, true, 2000)).toEqual({ shown: 1, next: 1, darkAt: null });
  });

  it('takes a step back the same way', () => {
    const fade = stepFadeFrom(1);
    expect(at(fade, 0, true, 0)).toEqual({ shown: 1, next: 0, darkAt: STEP_FADE_MS });
    expect(at(fade, 0, true, STEP_FADE_MS + 16)).toEqual({ shown: 0, next: 0, darkAt: null });
  });

  it('lands on the latest stop asked for while it fades down, with no wait of its own', () => {
    const fade = stepFadeFrom(0);
    stepFadeAt(fade, 1, true, 0);
    expect(at(fade, 12, true, 80)).toEqual({ shown: 0, next: 12, darkAt: STEP_FADE_MS });
    expect(at(fade, 12, true, STEP_FADE_MS)).toEqual({ shown: 12, next: 12, darkAt: null });
  });

  it('lets go at once when the target comes back to the stop it shows before it is dark: nothing jumps', () => {
    const fade = stepFadeFrom(0);
    stepFadeAt(fade, 1, true, 0);
    expect(at(fade, 0, true, 60)).toEqual({ shown: 0, next: 0, darkAt: null });
  });

  it('fades again for a step taken while it fades back in', () => {
    const fade = stepFadeFrom(0);
    stepFadeAt(fade, 1, true, 0);
    stepFadeAt(fade, 1, true, STEP_FADE_MS); // dark: shows 1, fading back in
    expect(at(fade, 12, true, STEP_FADE_MS + 50)).toEqual({ shown: 1, next: 12, darkAt: 2 * STEP_FADE_MS + 50 });
  });

  it('never fades without reduced motion: the stop shown is the one asked for, at once', () => {
    const fade = stepFadeFrom(0);
    expect(at(fade, 1, false, 0)).toEqual({ shown: 1, next: 1, darkAt: null });
    expect(at(fade, 12, false, 16)).toEqual({ shown: 12, next: 12, darkAt: null });
    // A fade under way when reduced motion goes is let go.
    const reduced = stepFadeFrom(0);
    stepFadeAt(reduced, 1, true, 0);
    expect(at(reduced, 1, false, 16)).toEqual({ shown: 1, next: 1, darkAt: null });
  });

  it('never stays dark on a clock that is not a number', () => {
    const fade = stepFadeFrom(0);
    stepFadeAt(fade, 1, true, Number.NaN);
    expect(at(fade, 1, true, Number.NaN)).toEqual({ shown: 1, next: 1, darkAt: null });
  });
});

describe('the step fade in the stylesheet', () => {
  const base = readFileSync(fileURLToPath(new URL('../../../src/styles/base.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  /** A style rule of base.css: the at-rules it sits in (outermost first), its selectors and its declarations. */
  interface Rule {
    groups: string[];
    selectors: string[];
    declarations: Map<string, string>;
  }

  /** The style rules of a stylesheet with no nesting, read as tests/unit/header-loading.test.ts reads them. */
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

  it('fades the scene host down while <html data-step-fade> is set, by opacity alone', () => {
    expect(valueOf('html[data-step-fade] .scene-host', 'opacity')).toBe('0');
    const fading = RULES.filter((rule) => rule.selectors.some((s) => s.includes('data-step-fade')));
    expect(fading.length).toBe(1);
    expect([...fading[0].declarations.keys()]).toEqual(['opacity']);
    expect(fading[0].selectors).toEqual(['html[data-step-fade] .scene-host']);
  });

  it("moves the host's opacity over 150 ms, down and back", () => {
    expect(valueOf('.scene-host', 'transition')).toMatch(new RegExp(`^opacity ${STEP_FADE_MS}ms\\b`));
  });

  it("keeps the 150 ms with reduced motion, the fade's only case, over the sheet's rule that cuts every transition short", () => {
    const reduced = valueOf('.scene-host', 'transition', REDUCED);
    expect(reduced).toMatch(new RegExp(`^opacity ${STEP_FADE_MS}ms\\b.*!important$`));
    // The rule it has to win against is still there (so the !important is needed), and it does not name the host.
    expect(valueOf('*', 'transition-duration', REDUCED)).toBe('0.001ms !important');
  });

  it('never sets the host to transition: none, in or out of reduced motion', () => {
    for (const rule of RULES) {
      if (!rule.selectors.some((s) => /\.scene-host$/.test(s))) continue;
      expect(rule.declarations.get('transition'), rule.selectors.join(', ')).not.toBe('none');
    }
  });
});
