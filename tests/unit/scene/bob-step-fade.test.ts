import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { stopsFor } from '~/input/target';
import { journeyPoseAt } from '~/scene/bob/journey';
import { heldAtLanding, LANDING_HOLD } from '~/scene/bob/landingHold';
import { nearestStop, STEP_FADE_MS, type StepFade, stepFadeAt, stepFadeFor, stepFadeFrom, stepStopFor } from '~/scene/bob/stepFade';
import { arrivalStop, HOME_CHAPTERS, insideStop, keyStops, pathStart, placeOfFrame, scrollEnd, stops } from '~/state/chapters';

describe('stepStopFor: reduced motion stands on keyStops with no frame between', () => {
  const KEY = keyStops(HOME_CHAPTERS);
  const END = scrollEnd(HOME_CHAPTERS);
  /** The path's start, the hand-over: the light path's places are counted from it. */
  const L = pathStart(HOME_CHAPTERS);

  it('is always one of the key stops: BOB from above, each fact at its peak, each arrival and inside, the look back, the end', () => {
    for (let target = 0; target <= END; target += 0.01) expect(KEY, `at ${target}`).toContain(stepStopFor(target, 'ready'));
    for (const stop of KEY) expect(stepStopFor(stop, 'ready')).toBe(stop);
    expect(stepStopFor(3, 'ready')).toBe(placeOfFrame(201)); // fact 04's peak
    expect(stepStopFor(3, 'loading')).toBe(placeOfFrame(201));
  });

  it('steps reduced motion through the arrivals, the insides and the look back', () => {
    // Each project's arrival (its label whole) and inside (its objects built), then the look back's start and its own stop.
    expect(KEY.filter((stop) => stop > L)).toEqual([
      expect.closeTo(L + 2.7, 9),
      expect.closeTo(L + 4.05, 9),
      expect.closeTo(L + 6.95, 9),
      expect.closeTo(L + 8.3, 9),
      expect.closeTo(L + 11.3, 9),
      expect.closeTo(L + 12.65, 9),
      expect.closeTo(L + 14.55, 9),
      expect.closeTo(L + 15.55, 9),
    ]);
    expect(stepStopFor(L + 3.0, 'ready')).toBeCloseTo(L + 2.7, 9);
    expect(stepStopFor(L + 13.5, 'ready')).toBeCloseTo(L + 12.65, 9);
    expect(stepStopFor(L + 14.6, 'ready')).toBeCloseTo(L + 14.55, 9);
    // No travel or orbit is ever posed: a target in Funcial's travel stands on its arrival.
    expect(stepStopFor(L + 2.0, 'ready')).toBeCloseTo(L + 2.7, 9);
  });

  it('poses each arrival with its label whole and each inside with its objects built, from the pose alone', () => {
    for (const [k, project] of projects.onPath().entries()) {
      const arrival = journeyPoseAt(arrivalStop(HOME_CHAPTERS, project.categoryId), 16 / 9);
      expect(arrival.path?.label, project.id).toEqual({ index: k, opacity: 1 });
      const inside = journeyPoseAt(insideStop(HOME_CHAPTERS, project.categoryId), 16 / 9);
      expect(inside.path?.beads[k].build, project.id).toBe(1);
    }
  });

  it("is one of a failed void's stops, the facts among them, with the void failed", () => {
    const failed = stopsFor(HOME_CHAPTERS, 'failed');
    for (let target = 0; target <= END; target += 0.01) expect(failed, `at ${target}`).toContain(stepStopFor(target, 'failed'));
    expect(stepStopFor(placeOfFrame(121), 'failed')).toBe(placeOfFrame(121));
    expect(stepStopFor(LANDING_HOLD + 0.1, 'failed')).toBe(LANDING_HOLD);
  });

  it('holds a failed void at the hand-over, with no projects after it', () => {
    expect(LANDING_HOLD).toBe(L);
    expect(heldAtLanding(L, 'failed')).toBe(true);
    expect(stepStopFor(L + 5, 'failed')).toBeCloseTo(L, 9);
    // The failed void's stops past the fall: the hold and the credits, nothing of the path.
    expect(stopsFor(HOME_CHAPTERS, 'failed').filter((stop) => stop >= L)).toEqual([L, END]);
  });

  it('shows a step from BOB from above to fact 01 as the two stops alone: nothing of the fall between', () => {
    const fade = stepFadeFrom(1);
    const shown = new Set<number>();
    for (let t = 0; t <= 400; t += 16) {
      stepFadeAt(fade, stepStopFor(placeOfFrame(81), 'ready'), true, t);
      shown.add(fade.shown);
    }
    expect([...shown]).toEqual([1, placeOfFrame(81)]);
  });
});

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
    expect(nearestStop(PLACES, HOME_CHAPTERS.total + 5)).toBe(scrollEnd(HOME_CHAPTERS)); // the last stop, the end page's
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

  it('fades the scene host down while <html data-step-fade> is set, by opacity alone, and the end page with it', () => {
    expect(valueOf('html[data-step-fade] .scene-host', 'opacity')).toBe('0');
    expect(valueOf("html[data-route='home'][data-step-fade] .end-page", 'opacity')).toBe('0');
    const fading = RULES.filter((rule) => rule.selectors.some((s) => s.includes('data-step-fade')));
    expect(fading.map((rule) => rule.selectors)).toEqual([
      ['html[data-step-fade] .scene-host'],
      ['html[data-step-fade] .light-fact-layer'],
      ['html[data-step-fade] .bead-label', 'html[data-step-fade] .touch-points'],
      ["html[data-route='home'][data-step-fade] .end-page"]
    ]);
    for (const rule of fading) expect([...rule.declarations.keys()]).toEqual(['opacity']);
  });

  it("fades the facts beside the light, the beads' labels and the touch points with the host, as fast, so a step shows no words of the stop it left", () => {
    expect(valueOf('html[data-step-fade] .light-fact-layer', 'opacity')).toBe('0');
    // The labels' and the touch points' own opacity is written on them: the fade's wins outright.
    expect(valueOf('html[data-step-fade] .bead-label', 'opacity')).toBe('0 !important');
    expect(valueOf('html[data-step-fade] .touch-points', 'opacity')).toBe('0 !important');
    for (const selector of ['.light-fact-layer', '.bead-label', '.touch-points']) {
      expect(valueOf(selector, 'transition', REDUCED), selector).toBe(valueOf('.scene-host', 'transition', REDUCED));
    }
  });

  /** A selector's weight as far as these rules go: its attribute and class selectors. */
  const weight = (selector: string): number => (selector.match(/\[/g)?.length ?? 0) + (selector.match(/\./g)?.length ?? 0);

  it('takes the end page down with the host whatever the sheet says, so a fade out of the end page takes the page down too', () => {
    // Leaving the end page by a fade, Home writes `moving` with `--end` still 1 while the host goes dark. The sheet has
    // no opacity of its own (it slides, opaque), and the fade's rule outweighs the move's anyway.
    expect(valueOf("html[data-end='moving'] .end-page", 'opacity')).toBeUndefined();
    expect(weight("html[data-route='home'][data-step-fade] .end-page")).toBeGreaterThan(weight("html[data-end='moving'] .end-page"));
  });

  it("eases the end page's opacity as the host's, 150 ms, only where no move of way A runs: a failed void, and reduced motion", () => {
    expect(valueOf("html[data-void='failed'] .end-page", 'transition')).toBe(valueOf('.scene-host', 'transition'));
    expect(valueOf('.end-page', 'transition', REDUCED)).toBe(valueOf('.scene-host', 'transition', REDUCED));
    expect(valueOf('.end-page', 'transition', REDUCED)).toMatch(new RegExp(`^opacity ${STEP_FADE_MS}ms\\b.*!important$`));
    // Nowhere else: the move's `--end-black` and `--end-rise`, written each frame, are never eased.
    const easing = RULES.filter((rule) => rule.selectors.some((s) => /\.end-page$/.test(s)) && [...rule.declarations.keys()].some((key) => key.startsWith('transition')));
    expect(easing.map((rule) => [rule.groups, rule.selectors])).toEqual([
      [[], ["html[data-void='failed'] .end-page"]],
      [REDUCED, ['.end-page']],
    ]);
  });

  it('starts the end page at 0 as it comes back from display: none, so a fade in eases from there rather than cutting in', () => {
    // With 3D on the page takes no room until data-end shows it, and a transition never starts from display: none: its
    // first style after that must be 0, or the frame that shows it shows it whole (reduced motion lifts its fade in that frame).
    const shown = "html[data-route='home'][data-3d='on'][data-end] .end-page";
    expect(valueOf(shown, 'opacity', ['@starting-style'])).toBe('0');
    const starting = RULES.filter((rule) => rule.groups.includes('@starting-style') && rule.selectors.some((s) => /\.end-page$/.test(s)));
    expect(starting.map((rule) => [rule.selectors, [...rule.declarations.keys()]])).toEqual([[[shown], ['opacity']]]);
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
