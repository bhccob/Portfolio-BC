import { describe, expect, it } from 'vitest';
import { stageWanted } from '../../../src/scene/gate';

const at = (scene: 'home' | 'country' | 'project' | null, more: Partial<Parameters<typeof stageWanted>[0]> = {}) =>
  stageWanted({ hydrated: true, threeD: true, scene, up: false, ...more });

describe('stageWanted: when the page asks for the WebGL Stage', () => {
  it('mounts the first Stage only on a page with a scene', () => {
    expect(at('home')).toBe(true);
    expect(at('country')).toBe(true);
    expect(at('project')).toBe(true);
  });

  it('loads none for a visit that begins on a page of text alone (Lite, contact, not found)', () => {
    expect(at(null)).toBe(false);
  });

  it('keeps a Stage that is up on a page without a scene, so the canvas persists from page to page', () => {
    expect(at(null, { up: true })).toBe(true);
  });

  it('wants none before hydration or with 3D off, whatever the page', () => {
    expect(at('home', { hydrated: false })).toBe(false);
    expect(at('home', { threeD: false })).toBe(false);
    expect(at(null, { up: true, threeD: false })).toBe(false);
  });
});
