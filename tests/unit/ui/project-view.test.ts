import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { type ProjectId, projects } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { useScene } from '~/state/store';
import { leaveViewOn, ProjectViews, watchProjectViews } from '~/ui/ProjectView';

const LOCALES = [
  ['/', nl, ''],
  ['/en/', en, '/en']
] as const;

/** The views as the server renders them on the page at `path`. */
const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ProjectViews)));
/** One project's view in the markup. */
const viewOf = (html: string, id: ProjectId): string => {
  const start = html.indexOf(`data-project="${id}"`);
  const end = html.indexOf('data-project="', start + 20);
  return html.slice(start, end < 0 ? undefined : end);
};
const textOf = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}): Event {
  const event = new Event(type, { cancelable: true, bubbles: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}

// A project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, goal 2; the mock-up Bob chose, version 4):
// the torn hole, the words to the side, one picture or an app's phones, the next project quiet, the way back pinned.
describe("a project's own page", () => {
  it('renders the words to the side, in both languages', () => {
    for (const [path, t] of LOCALES) {
      const html = render(path);
      for (const id of WORLD_PROJECTS) {
        const project = projects.byId(id)!;
        const copy = project.copy(path === '/' ? 'nl' : 'en');
        const view = viewOf(html, id);
        expect(view).toContain('role="dialog"');
        expect(view).toContain(`aria-labelledby="pv-title-${id}"`);
        expect(textOf(view)).toContain(project.title);
        expect(textOf(view)).toContain(copy.summary);
        expect(textOf(view)).toContain(`${t.work.year} ${project.year}`);
        expect(textOf(view)).toContain(`${t.work.role} ${copy.role}`);
        expect(textOf(view)).toContain(`${t.work.type} ${copy.type}`);
        for (const tool of project.stack) expect(textOf(view)).toContain(tool);
      }
      // The way back, pinned, once.
      expect(textOf(html)).toContain(t.needle.page.back);
    }
  });

  it('tears its hole and its blots with masks drawn ahead of time, nothing drawn as the page loads', () => {
    const view = viewOf(render('/'), 'steady');
    for (const mask of ['hole', 'blot', 'tall']) expect(view).toMatch(new RegExp(`--${mask}:url\\([^)]*${mask}[^)]*\\.png\\)`));
  });

  it('links to GitHub and to the longer page', () => {
    for (const [path, t, prefix] of LOCALES) {
      const view = viewOf(render(path), 'jontai-energy');
      expect(view).toContain('href="https://github.com/bhccob/Jontai-Energy"');
      expect(textOf(view)).toContain(t.work.github);
      expect(view).toContain(`href="${prefix}/projects/jontai-energy/"`);
      expect(textOf(view)).toContain(t.needle.page.readMore);
    }
    // Porfael has no repository yet: no GitHub link, but its longer page.
    const porfael = viewOf(render('/'), 'porfael');
    expect(porfael).not.toContain('github.com');
    expect(porfael).toContain('href="/projects/porfael/"');
  });

  it('shows Steady as three phones and Jontai Energy as one card', () => {
    const html = render('/');
    const steady = viewOf(html, 'steady');
    expect((steady.match(/class="pv-phone( pv-front)?"/g) ?? []).length).toBe(3);
    // The middle one forward, and a dot for each, for a phone's swipe.
    expect(steady).toMatch(/class="pv-phone pv-front"/);
    expect((steady.match(/class="pv-dot( pv-on)?"/g) ?? []).length).toBe(3);
    expect(steady).toContain(projects.byId('steady')!.pictureCaption('nl'));
    const jontai = viewOf(html, 'jontai-energy');
    expect((jontai.match(/class="pv-card pv-wide"/g) ?? []).length).toBe(1);
    expect(jontai).toContain(`alt="${projects.byId('jontai-energy')!.pictures[0]!.alt.nl}"`);
  });

  it("goes from Porfael's words to the next project", () => {
    const porfael = viewOf(render('/'), 'porfael');
    expect(porfael).not.toContain('pv-media');
    expect(porfael).toContain('pv-next');
  });

  it('names the next project, and the first after the last', () => {
    const html = render('/');
    WORLD_PROJECTS.forEach((id, k) => {
      const next = projects.byId(WORLD_PROJECTS[(k + 1) % WORLD_PROJECTS.length]!)!;
      const view = viewOf(html, id);
      const onward = view.slice(view.indexOf('pv-next'));
      expect(textOf(onward)).toContain(nl.needle.inside.next);
      expect(textOf(onward)).toContain(next.title);
    });
  });

  it('leaves on Escape, turns on the arrows, and scrolls on the wheel', () => {
    const target = new EventTarget();
    const leave = vi.fn();
    const turn = vi.fn();
    const stop = leaveViewOn(target, leave, turn);
    const key = (k: string) => fire(target, 'keydown', { key: k, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, target: { tagName: 'BODY' } });
    key('ArrowRight');
    key('ArrowLeft');
    expect(turn.mock.calls).toEqual([[1], [-1]]);
    // The wheel, the arrows up and down, Space and a swipe scroll the page: none leaves.
    fire(target, 'wheel', { deltaY: 120, deltaX: 0, ctrlKey: false });
    key('ArrowDown');
    key('PageDown');
    key(' ');
    fire(target, 'touchstart', { touches: [{ clientX: 100, clientY: 600 }] });
    fire(target, 'touchmove', { touches: [{ clientX: 100, clientY: 300 }] });
    expect(leave).not.toHaveBeenCalled();
    key('Escape');
    expect(leave).toHaveBeenCalledTimes(1);
    // Alt with an arrow is the browser's Back: not the view's.
    fire(target, 'keydown', { key: 'ArrowLeft', altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false });
    expect(turn).toHaveBeenCalledTimes(2);
    stop();
    key('Escape');
    expect(leave).toHaveBeenCalledTimes(1);
  });
});

describe('the open page as the store has it', () => {
  it('marks the page open, puts the focus on the way back, and closes when 3D is switched off', () => {
    const attributes = new Set<string>();
    const root = {
      toggleAttribute: (name: string, on: boolean) => (on ? attributes.add(name) : attributes.delete(name), on),
      removeAttribute: (name: string) => void attributes.delete(name),
      style: { removeProperty: () => '' }
    };
    const back = { focus: vi.fn(), contains: () => false };
    useScene.setState({ inside: null, threeD: true });
    const stop = watchProjectViews(root, () => back, { activeElement: null, getElementById: () => null }, new EventTarget());
    useScene.setState({ inside: 'steady' });
    expect(attributes.has('data-inside')).toBe(true);
    expect(back.focus).toHaveBeenCalledWith({ preventScroll: true });
    // 3D off with the page open: it closes, and nothing of it is left on <html>.
    useScene.setState({ threeD: false });
    expect(useScene.getState().inside).toBeNull();
    expect(attributes.has('data-inside')).toBe(false);
    stop();
    useScene.setState({ threeD: true });
  });
});
