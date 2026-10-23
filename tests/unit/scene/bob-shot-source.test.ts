import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LoaderStage } from '~/engine/bob/loaderTimeline';
import { SHOT_PRIORITY, type ShotSource, shotSourceFor, shownProgressFor } from '~/scene/bob/shotSource';
import { HOME_CHAPTERS, stops } from '~/state/chapters';

const STAGES: readonly LoaderStage[] = ['dark', 'engrave', 'open', 'rise', 'home'];
const LOADER_STAGES = STAGES.filter((stage) => stage !== 'home');
const HELD: readonly (number | null)[] = [null, 0, 1.75, 5, 8.25];
const STOPS = stops(HOME_CHAPTERS);

describe('shotSourceFor: who writes the camera shot', () => {
  it('is the loader on every stage before the home, whether or not a seek holds the clock and whether or not Home was live', () => {
    for (const stage of LOADER_STAGES) {
      for (const held of HELD) {
        for (const live of [false, true]) expect(shotSourceFor(stage, held, live), `${stage} held ${held} live ${live}`).toBe('loader');
      }
    }
  });

  it('is the held seek at the home while the bridge holds the clock, live or not: the seek poses the scene from the held moment and knows nothing of the scroll', () => {
    for (const held of HELD.filter((seconds): seconds is number => seconds !== null)) {
      for (const live of [false, true]) expect(shotSourceFor('home', held, live), `held ${held} live ${live}`).toBe('held');
    }
  });

  it('is the home at the home until Home has taken the scene over, and the journey from then on', () => {
    expect(shotSourceFor('home', null, false)).toBe('home');
    expect(shotSourceFor('home', null, true)).toBe('journey');
  });

  it('puts the loader before the held seek before the home before the journey, for every input', () => {
    // The order in one table: a held seek at a loader stage is still the loader's; a held seek beats a live Home.
    const answers = new Set<ShotSource>();
    for (const stage of STAGES) {
      for (const held of HELD) {
        for (const live of [false, true]) {
          const source = shotSourceFor(stage, held, live);
          answers.add(source);
          const expected: ShotSource = stage !== 'home' ? 'loader' : held !== null ? 'held' : live ? 'journey' : 'home';
          expect(source, `${stage} held ${held} live ${live}`).toBe(expected);
        }
      }
    }
    expect([...answers].sort()).toEqual(['held', 'home', 'journey', 'loader']);
  });

  it('reads a held time of 0 as held: 0 is a moment of the loader, not "no seek"', () => {
    expect(shotSourceFor('home', 0, true)).toBe('held');
  });
});

describe('shownProgressFor: the progress the home and the journey pose the shot at', () => {
  it('is the damped progress without reduced motion, for both, whatever the target and the step fade say', () => {
    for (const source of ['home', 'journey'] as const) {
      expect(shownProgressFor(source, false, 0.37, 4, 2)).toBe(0.37);
      expect(shownProgressFor(source, false, 1.6, 0, 5)).toBe(1.6);
    }
  });

  it('with reduced motion is the stop the step fade shows once Home drives the scene (the journey)', () => {
    expect(shownProgressFor('journey', true, 2.31, 3, 2)).toBe(2);
    expect(shownProgressFor('journey', true, 0.4, 0, 0)).toBe(0);
    expect(shownProgressFor('journey', true, 5, 6, 3)).toBe(3);
  });

  it('with reduced motion is the stop the target is nearest at the hand-over (the home), as Home poses it with no fade', () => {
    expect(shownProgressFor('home', true, 0.2, 0, 4)).toBe(0);
    expect(shownProgressFor('home', true, 2.9, 3, 0)).toBe(3);
    // The progress is mid-travel, the target at a stop: the stop it is going to.
    expect(shownProgressFor('home', true, 1.4, 2, 0)).toBe(2);
    expect(shownProgressFor('home', true, 4.9, 5.2, 0)).toBe(5);
  });

  it('is one of the story\'s stops whenever reduced motion poses a stop', () => {
    for (let target = 0; target <= HOME_CHAPTERS.total; target += 0.25) {
      expect(STOPS).toContain(shownProgressFor('home', true, 0, target, 0));
    }
  });
});

describe('SHOT_PRIORITY: the writer runs before the Rig', () => {
  it("is below 0, the Rig's (the default): R3F runs subscribers from the lowest priority up", () => {
    expect(SHOT_PRIORITY).toBeLessThan(0);
  });

  it('is not above 0: only a positive priority takes the render from R3F, and this writer does not render', () => {
    expect(SHOT_PRIORITY).not.toBeGreaterThan(0);
    expect(Number.isInteger(SHOT_PRIORITY)).toBe(true);
  });
});

/** `source` without its comments (and so without the parentheses and braces they talk of). */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * The priority argument of every `useFrame(` call in `source`, as written, `'0'` where there is none (the default):
 * the call's top-level arguments are split at its commas, outside any bracket, string or template.
 */
function frameCallbackPriorities(source: string): string[] {
  const text = code(source);
  const found: string[] = [];
  let at = text.indexOf('useFrame(');
  while (at !== -1) {
    let depth = 0;
    let quote: string | null = null;
    const args: string[] = [''];
    for (let i = at + 'useFrame('.length; i < text.length; i++) {
      const ch = text[i]!;
      if (quote !== null) {
        if (ch === '\\') {
          args[args.length - 1] += ch + text[++i];
          continue;
        }
        if (ch === quote) quote = null;
      } else if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
      } else if ('([{'.includes(ch)) {
        depth++;
      } else if (')]}'.includes(ch)) {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) {
        args.push('');
        continue;
      }
      args[args.length - 1] += ch;
    }
    found.push((args[1] ?? '0').trim());
    at = text.indexOf('useFrame(', at + 1);
  }
  return found;
}

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../../../src/${path}`, import.meta.url)), 'utf8');

describe('the wiring: one writer of frame.shot, before the Rig', () => {
  it('reads the priorities of the frame callbacks (the helper of these checks)', () => {
    expect(frameCallbackPriorities('useFrame((s, d) => { a(b, c); }, 3); useFrame(() => {}); useFrame(() => f(1, 2), -1);')).toEqual(['3', '0', '-1']);
    expect(frameCallbackPriorities("useFrame(() => { const t = 'a, (b'; }, X);")).toEqual(['X']);
  });

  it("gives the Opening's frame callback SHOT_PRIORITY and the Rig, Home and the Heartbeat the default, so the Opening runs strictly before the Rig", () => {
    expect(frameCallbackPriorities(read('scene/bob/Opening.tsx'))).toEqual(['SHOT_PRIORITY']);
    expect(frameCallbackPriorities(read('scene/Rig.tsx'))).toEqual(['0']);
    expect(frameCallbackPriorities(read('scene/bob/Home.tsx'))).toEqual(['0']);
    expect(frameCallbackPriorities(read('scene/Heartbeat.tsx'))).toEqual(['0']);
    // The Void poses the void, the beads and the held needle after Home, at the default: it writes no shot.
    expect(frameCallbackPriorities(read('scene/bob/Void.tsx'))).toEqual(['0']);
  });

  it('has Home write no shot: the Opening is the only module of the site that assigns frame.shot (and clears it on unmount)', () => {
    // Every module under src, so a new one (the Void, the beads) is read too.
    const writers = sourceFiles(SRC)
      .map((file) => relative(SRC, file).replaceAll('\\', '/'))
      .filter((path) => /\bframe\.shot\s*=(?!=)/.test(code(read(path))));
    expect(writers).toEqual(['scene/bob/Opening.tsx']);
  });

  it('reads every module of src for that (the helper of the check)', () => {
    const paths = sourceFiles(SRC).map((file) => relative(SRC, file).replaceAll('\\', '/'));
    for (const path of ['scene/bob/Opening.tsx', 'scene/bob/Home.tsx', 'scene/bob/Void.tsx', 'scene/Rig.tsx', 'engine/bob/build/beads.ts', 'state/frame.ts']) expect(paths).toContain(path);
  });
});

const SRC = fileURLToPath(new URL('../../../src', import.meta.url));

/** Every .ts and .tsx file under `dir`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}
