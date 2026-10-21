import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { paletteCss } from '~/engine/palette';

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const tokens = read('../../src/styles/tokens.css');
const base = read('../../src/styles/base.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  for (const match of base.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1].trim() === selector) return match[2];
  throw new Error(`no rule for ${selector}`);
}

/** A token's value in tokens.css. */
function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i'));
  if (!match) throw new Error(`no token --${name}`);
  return match[1].toLowerCase();
}

/** WCAG relative luminance of a #rrggbb colour. */
function relative(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast of `hex` at `alpha` over the night (#040209). */
function contrast(hex: string, alpha = 1): number {
  const night = paletteCss.night;
  const mixed = `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * alpha + parseInt(night.slice(i, i + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
  const [a, b] = [relative(mixed), relative(night)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe("the hero's colours (Ruling 11, prototype ui-02)", () => {
  it('give the tokens the palette\'s cream and gold, as the scene has them', () => {
    expect(token('cream')).toBe(paletteCss.cream);
    expect(token('gold')).toBe(paletteCss.gold);
    expect(token('dim')).toBe(paletteCss.dim);
  });

  it('set the name in cream, the tagline in gold and the cue dim', () => {
    expect(rule('.hero-name')).toMatch(/color:\s*var\(--cream\)/);
    expect(rule('.hero-tagline')).toMatch(/color:\s*var\(--gold\)/);
    expect(rule('.hero-cue')).toMatch(/color:\s*var\(--dim\)/);
  });

  it('keep every line at 4.5 : 1 or more on the night, the cue at the lowest of its pulse too', () => {
    expect(contrast(paletteCss.cream)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(paletteCss.gold)).toBeGreaterThanOrEqual(4.5);
    const pulse = base.match(/@keyframes hero-cue-pulse\s*\{([\s\S]*?)\n\}/)![1];
    const lowest = Math.min(...[...pulse.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1])));
    expect(lowest).toBeLessThan(1);
    expect(contrast(paletteCss.dim, lowest)).toBeGreaterThanOrEqual(4.5);
  });
});
