import { describe, expect, it } from 'vitest';
import { PAGES, pagePaths } from '../../src/data/pages';

describe('pagePaths', () => {
  const paths = pagePaths();

  it('lists every page in both locales', () => {
    expect(paths).toHaveLength(Object.keys(PAGES).length * 2);
    expect(paths).toHaveLength(18);
  });

  it('has no duplicates', () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ends every path in a slash', () => {
    for (const path of paths) expect(path.endsWith('/'), path).toBe(true);
  });

  it('puts half of them under /en/', () => {
    expect(paths.filter((path) => path.startsWith('/en/'))).toHaveLength(paths.length / 2);
  });

  it('keeps Dutch at the root and English under /en/', () => {
    expect(paths).toContain('/');
    expect(paths).toContain('/en/');
    expect(paths).toContain('/projects/funcial/');
    expect(paths).toContain('/en/projects/funcial/');
    expect(paths).toContain('/en/lite/');
  });
});
