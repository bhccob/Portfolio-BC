import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nl } from '~/i18n/nl';
import { areaStop, areasOnPath, HOME_CHAPTERS } from '~/state/chapters';

const goToPlace = vi.fn((_place: number) => true);
vi.mock('~/input/useHomeScroll', () => ({ goToPlace: (place: number) => goToPlace(place) }));

const { AreaDots, goToArea, registerAreaDots, showAreaDots } = await import('~/ui/AreaDots');

function fake() {
  const style: Record<string, string> = {};
  const attributes = new Map<string, string>();
  return {
    style,
    attributes,
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    removeAttribute: (k: string) => attributes.delete(k),
    toggleAttribute: (k: string, on: boolean) => (on ? attributes.set(k, '') : attributes.delete(k))
  };
}

const done: (() => void)[] = [];
afterEach(() => {
  for (const undo of done.splice(0)) undo();
  goToPlace.mockClear();
});

describe("the areas' dots on the right", () => {
  it('are a named button for each area in a named nav', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(AreaDots)));
    expect(html).toContain(`aria-label="${nl.needle.world.areas}"`);
    expect(html.match(/<button/g)).toHaveLength(areasOnPath().length);
    expect(html).toContain('aria-label="01 — APP: Steady, Porfael"');
  });

  it('light the area in view', () => {
    const nav = fake();
    const dots = [fake(), fake(), fake()];
    done.push(registerAreaDots(nav as never, dots as never));
    showAreaDots({ opacity: 1, lit: 1 });
    expect(nav.style.opacity).toBe('1');
    expect(dots.map((d) => d.attributes.get('aria-current') ?? null)).toEqual([null, 'true', null]);
    showAreaDots({ opacity: 0, lit: null });
    expect(nav.style.opacity).toBe('0');
    expect(nav.attributes.has('inert')).toBe(true);
    expect(dots.every((d) => !d.attributes.has('aria-current'))).toBe(true);
  });

  it("go to an area's stop when pressed", () => {
    expect(goToArea('website')).toBe(true);
    expect(goToPlace).toHaveBeenCalledWith(areaStop(HOME_CHAPTERS, 'website'));
  });
});
