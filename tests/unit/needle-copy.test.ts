import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';
import type { Locale } from '../../src/i18n/Translator';

// The `needle` copy is copied verbatim from the NL and EN columns of
// docs/art-direction.md § Copy budget (Bob approved it on 2026-10-20). This test
// reads that table and compares, so a typo cannot slip into the dictionary.
const doc = readFileSync(fileURLToPath(new URL('../../docs/art-direction.md', import.meta.url)), 'utf8');

const dictionaries = { en, nl } as const;
const locales = ['nl', 'en'] as const;

/** The text of one `### ` section of the copy budget. */
function section(prefix: string): string {
  const start = doc.indexOf(`### ${prefix}`);
  if (start === -1) throw new Error(`no section "${prefix}" in docs/art-direction.md`);
  const rest = doc.slice(start + 4);
  const end = rest.search(/\n(?:#{2,3} |---)/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The rows of the section's table, each as its trimmed cells. */
function rows(prefix: string): string[][] {
  return section(prefix)
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => !cells.every((cell) => /^-+$/.test(cell)));
}

/** The NL and EN cells of the row whose first cell is `label`. */
function pair(prefix: string, label: string): Record<Locale, string> {
  const row = rows(prefix).find((cells) => cells[0] === label);
  if (!row) throw new Error(`no row "${label}" in "${prefix}"`);
  return { nl: row[1], en: row[2] };
}

describe('the needle copy equals the copy budget', () => {
  it('loader and failure', () => {
    for (const locale of locales) {
      const { loader, fallback } = dictionaries[locale].needle;
      expect(loader.caption).toBe(pair('Loader', 'Caption')[locale]);
      expect(loader.enterSilent).toBe(pair('Loader', 'Primary button')[locale]);
      expect(loader.enterSound).toBe(pair('Loader', 'Secondary button')[locale]);
      expect(fallback.title).toBe(pair('Loader', 'Failure (themed)')[locale]);
      expect(fallback.lite).toBe(pair('Loader', 'Failure action')[locale]);
    }
    expect(en.needle.fallback.title).toBe('THE NEEDLE LOST NORTH');
  });

  it('hero', () => {
    for (const locale of locales) {
      const { hero } = dictionaries[locale].needle;
      expect(hero.name).toBe(pair('Hero', 'Name')[locale]);
      expect(hero.tagline).toBe(pair('Hero', 'Tagline')[locale]);
      expect(hero.scrollCue).toBe(pair('Hero', 'Scroll cue')[locale]);
    }
    expect(nl.needle.hero.tagline).toBe('VOLG DE NAALD');
    expect(en.needle.hero.tagline).toBe('FOLLOW THE NEEDLE');
    expect(en.needle.hero.name).toBe('BOB CHUNG');
  });

  it('the morph line', () => {
    const line = doc.split('\n').find((text) => text.startsWith('**Morph beat**'));
    const match = /NL \*(.+?)\* \(\d+\) · EN \*(.+?)\* \(\d+\)/.exec(line ?? '');
    expect(match).not.toBeNull();
    expect(nl.needle.morph).toBe(match?.[1]);
    expect(en.needle.morph).toBe(match?.[2]);
  });

  it('the always-on words', () => {
    for (const locale of locales) {
      const { liteLink, project } = dictionaries[locale].needle;
      expect(liteLink).toBe(pair('Always-on UI', 'Lite link')[locale]);
      expect(project.back).toBe(pair('Always-on UI', 'Back hint')[locale]);
      expect(project.open).toBe(/touch: (.+)$/.exec(pair('Country focus card', 'Action')[locale])?.[1]);
    }
  });

  it('the project words: download and code', () => {
    const links = pair('Projects', 'Focus: links');
    expect(nl.needle.project.download).toBe(/^(\S+) \(/.exec(links.nl)?.[1]);
    expect(nl.needle.project.code).toBe(/ · (\S+) \(/.exec(links.nl)?.[1]);
    const [download, code] = links.en.split(' · ');
    expect([en.needle.project.download, en.needle.project.code]).toEqual([download, code]);
  });
});

describe('the needle dictionary', () => {
  it('has no [FILL] left: the pages never show one', () => {
    for (const locale of locales) expect(JSON.stringify(dictionaries[locale].needle)).not.toMatch(/\[FILL/);
  });

  it('has no country copy left: the countries are gone', () => {
    for (const locale of locales) expect(dictionaries[locale].needle).not.toHaveProperty('countries');
  });

  it('never links the other company’s site as Bob’s', () => {
    for (const locale of locales) expect(JSON.stringify(dictionaries[locale].needle).toLowerCase()).not.toContain('jontaienergy.com');
  });
});

// Bob's five facts and the skip button's words, verbatim from the light dive's spec (Bob approved it on 2026-10-26).
const lightDiveSpec = readFileSync(fileURLToPath(new URL('../../docs/superpowers/specs/2026-10-25-bob-light-dive-design.md', import.meta.url)), 'utf8');

describe('the light dive copy', () => {
  it("the facts are the table's, verbatim, NL and EN, in its order", () => {
    const table = [...lightDiveSpec.matchAll(/^\s*\| (0[1-5]) \| (.+?) \| (.+?) \|\s*$/gm)];
    expect(table.map((row) => row[1])).toEqual(['01', '02', '03', '04', '05']);
    expect([...nl.lightDive.facts]).toEqual(table.map((row) => row[2]));
    expect([...en.lightDive.facts]).toEqual(table.map((row) => row[3]));
  });

  it("the skip button's words are the spec's, NL and EN", () => {
    const [, nlSkip, enSkip] = lightDiveSpec.match(/The skip button: "(.+?)" \/ "(.+?)"/) ?? [];
    expect(nl.lightDive.skip).toBe(nlSkip);
    expect(en.lightDive.skip).toBe(enSkip);
    expect(nl.lightDive.skip).toBe('Snel naar vragen ↓');
  });
});
