import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { FallbackCard } from '~/scene/SceneHost';

// With the header's light-version link gone (spec 2026-10-29-bob-stack-3-design.md, goal 2), the card that shows where
// 3D cannot run is the one way to the light version: it must stay.
describe('the card where 3D cannot run', () => {
  it('still offers the light version where 3D cannot run', () => {
    for (const [path, t, lite] of [
      ['/', nl, '/lite/'],
      ['/en/', en, '/en/lite/']
    ] as const) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(FallbackCard)));
      expect(html).toContain(t.needle.fallback.title);
      expect(html).toContain(`href="${lite}"`);
      expect(html).toContain(t.needle.fallback.lite);
    }
  });
});
