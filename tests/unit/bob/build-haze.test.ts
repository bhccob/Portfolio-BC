import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildHaze, clamp01, type HazeLook, type HazeModel, type HazeSpec, mix } from '~/engine/bob/build/haze';
import { palette } from '~/engine/palette';
import type { QualityTier } from '~/engine/quality';

/** A small look of its own: the module is data in, so a test needs none of the smoke's or the void's. */
const LOOK: HazeLook = {
  colour: palette.haze,
  dim: 0.5,
  puffs: 2,
  box: { x: 10, y: [-6, -2] },
  width: [4, 6],
  height: [1, 2],
  opacity: [0.1, 0.2],
  sway: { x: 1, z: 0.5 },
  period: 40,
  breathe: 0.25,
  seed: 5
};

/** Four layers on high, three on medium, none on low. */
const LAYERS: Record<QualityTier, number> = { high: 4, medium: 3, low: 0 };

function spec(over: Partial<HazeSpec> = {}): HazeSpec {
  return { name: 'test:haze', look: LOOK, depths: [-5, -10, -15, -20], keeps: (tier, layer) => layer < LAYERS[tier], textureSeed: 9, order: 3, level: 1, ...over };
}

/** The sprites a haze holds, in the order its group holds them. */
function sprites(h: HazeModel): THREE.Sprite[] {
  return h.group.children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);
}

/** Everything that says where the haze is and how it looks, as numbers. */
function picture(h: HazeModel): number[] {
  return sprites(h).flatMap((o) => [o.userData.layer as number, ...o.position.toArray(), o.material.opacity, o.scale.x, o.scale.y, o.material.rotation, o.visible ? 1 : 0]);
}

describe('clamp01 and mix', () => {
  it('hold a number to 0..1 (NaN is 0) and mix two linearly', () => {
    expect([clamp01(-3), clamp01(0.25), clamp01(7), clamp01(Number.NaN)]).toEqual([0, 0.25, 1, 0]);
    expect([mix(2, 6, 0), mix(2, 6, 0.25), mix(2, 6, 1)]).toEqual([2, 3, 6]);
  });
});

describe('the haze', () => {
  it('is a group of sprites, one per puff of each layer the tier keeps, named after the haze', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const h = buildHaze(spec(), tier);
      expect(h.group.isGroup).toBe(true);
      expect(h.group.name).toBe('test:haze');
      expect(sprites(h)).toHaveLength(LAYERS[tier] * LOOK.puffs);
      sprites(h).forEach((o, i) => {
        expect(o.name).toBe(`test:haze:${i}`);
        expect(o.material.name).toBe(`test:haze:${i}`);
        expect(o.userData.layer).toBeLessThan(LAYERS[tier]);
      });
      h.dispose();
    }
  });

  it('draws at the order it is given, as one group', () => {
    const h = buildHaze(spec({ order: -4 }), 'high');
    expect(h.group.renderOrder).toBe(-4);
    h.dispose();
  });

  it('is the high tier thinned: a lower tier keeps the same puffs where it keeps them, from the same seed', () => {
    const high = buildHaze(spec(), 'high');
    const medium = buildHaze(spec(), 'medium');
    const again = buildHaze(spec(), 'high');
    expect(picture(again)).toEqual(picture(high));
    expect(picture(medium)).toEqual(picture(high).slice(0, picture(medium).length));
    // A different seed is a different haze.
    const other = buildHaze(spec({ look: { ...LOOK, seed: 6 } }), 'high');
    expect(picture(other)).not.toEqual(picture(high));
    for (const h of [high, medium, again, other]) h.dispose();
  });

  it('lays each layer at its depth and its puffs in the box, wholly between its floor and its top, at every moment', () => {
    const h = buildHaze(spec(), 'high');
    const depths = [-5, -10, -15, -20];
    for (let t = 0; t <= 80; t += 5) {
      h.setTime(t);
      for (const o of sprites(h)) {
        expect(Math.abs(o.position.z - depths[o.userData.layer as number]!)).toBeLessThanOrEqual(LOOK.sway.z + 1e-9);
        expect(Math.abs(o.position.x)).toBeLessThanOrEqual(LOOK.box.x + 1e-9);
        expect(o.position.y - o.scale.y / 2).toBeGreaterThanOrEqual(LOOK.box.y[0] - 1e-9);
        expect(o.position.y + o.scale.y / 2).toBeLessThanOrEqual(LOOK.box.y[1] + 1e-9);
        expect(o.scale.x).toBeGreaterThanOrEqual(LOOK.width[0]);
        expect(o.scale.x).toBeLessThanOrEqual(LOOK.width[1]);
      }
    }
    h.dispose();
  });

  it('is the haze dimmed, added to what is behind, testing depth but writing none, out of the fog, with one texture and no pointer', () => {
    const h = buildHaze(spec(), 'high');
    const expected = new THREE.Color(LOOK.colour).multiplyScalar(LOOK.dim);
    const textures = new Set<THREE.Texture | null>();
    for (const o of sprites(h)) {
      const m = o.material;
      expect(m.color.equals(expected)).toBe(true);
      expect(m.blending).toBe(THREE.AdditiveBlending);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.depthTest).toBe(true);
      expect(m.fog).toBe(false);
      textures.add(m.map);
      const hits: THREE.Intersection[] = [];
      const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 30), new THREE.Vector3(0, 0, -1));
      raycaster.camera = new THREE.PerspectiveCamera();
      o.raycast(raycaster, hits);
      expect(hits).toHaveLength(0);
    }
    expect(textures.size).toBe(1);
    expect([...textures][0]).toBeInstanceOf(THREE.DataTexture);
    h.dispose();
  });

  it('starts at the level it is given (held to 0..1) and scales its opacity with setLevel, held to 0..1 (NaN is 0)', () => {
    const opacities = (h: HazeModel) => sprites(h).map((o) => o.material.opacity);
    const full = buildHaze(spec({ level: 1 }), 'high');
    const dark = buildHaze(spec({ level: 0 }), 'high');
    const over = buildHaze(spec({ level: 9 }), 'high');
    for (const o of opacities(full)) {
      expect(o).toBeGreaterThan(LOOK.opacity[0] * (1 - LOOK.breathe) - 1e-9);
      expect(o).toBeLessThanOrEqual(LOOK.opacity[1] + 1e-9);
    }
    expect(opacities(dark).every((o) => o === 0)).toBe(true);
    expect(opacities(over)).toEqual(opacities(full));
    const base = opacities(full);
    full.setLevel(0.5);
    opacities(full).forEach((o, i) => expect(o).toBeCloseTo(base[i]! / 2, 9));
    full.setTime(9);
    full.setLevel(1);
    const at9 = opacities(full);
    full.setLevel(0.5);
    opacities(full).forEach((o, i) => expect(o).toBeCloseTo(at9[i]! / 2, 9));
    full.setLevel(4);
    expect(opacities(full)).toEqual(at9);
    for (const bad of [Number.NaN, -1]) {
      full.setLevel(bad);
      expect(opacities(full).every((o) => o === 0)).toBe(true);
    }
    for (const h of [full, dark, over]) h.dispose();
  });

  it('keeps its sprites drawn at level 0 unless it was told to hide them there', () => {
    const shown = buildHaze(spec({ level: 0 }), 'high');
    expect(sprites(shown).every((o) => o.visible)).toBe(true);
    const hidden = buildHaze(spec({ level: 0, hideAtZero: true }), 'high');
    expect(sprites(hidden).every((o) => !o.visible)).toBe(true);
    hidden.setLevel(0.2);
    expect(sprites(hidden).every((o) => o.visible)).toBe(true);
    hidden.setLevel(0);
    expect(sprites(hidden).every((o) => !o.visible)).toBe(true);
    // Still moving while hidden, so showing it again shows the picture of that time.
    hidden.setTime(13);
    hidden.setLevel(1);
    const later = buildHaze(spec({ level: 1 }), 'high');
    later.setTime(13);
    expect(picture(hidden)).toEqual(picture(later));
    for (const h of [shown, hidden, later]) h.dispose();
  });

  it('drifts on its period: the same picture a period on, a different one in between, from the time alone (NaN is 0)', () => {
    const h = buildHaze(spec(), 'high');
    const random = vi.spyOn(Math, 'random');
    h.setTime(17);
    const first = picture(h);
    h.setTime(17 + LOOK.period / 2.5);
    const between = picture(h);
    h.setTime(17 + LOOK.period);
    const later = picture(h);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    later.forEach((x, i) => expect(x).toBeCloseTo(first[i]!, 6));
    expect(between).not.toEqual(first);
    h.setTime(0);
    const zero = picture(h);
    h.setTime(Number.NaN);
    expect(picture(h)).toEqual(zero);
    h.dispose();
  });
});

describe('the haze by tier', () => {
  it('steps down to a tier as a haze built for it: the same picture, the shed sprites out of the group', () => {
    for (const [from, to] of [['high', 'medium'], ['high', 'low'], ['medium', 'low']] as const) {
      const h = buildHaze(spec(), from);
      const shed = sprites(h).filter((o) => (o.userData.layer as number) >= LAYERS[to]);
      h.setTier(to);
      for (const o of shed) expect(o.parent).toBeNull();
      const built = buildHaze(spec(), to);
      for (const x of [h, built]) {
        x.setLevel(0.6);
        x.setTime(23);
      }
      // Names count from the build, not from the layer, so compare what is drawn.
      expect(picture(h), `${from} to ${to}`).toEqual(picture(built));
      h.dispose();
      built.dispose();
    }
  });

  it('says which tier it stands at, and only steps down: a tier above it changes nothing', () => {
    const h = buildHaze(spec(), 'high');
    expect(h.setTier('high')).toBe('high');
    expect(h.setTier('medium')).toBe('medium');
    expect(sprites(h)).toHaveLength(3 * LOOK.puffs);
    expect(h.setTier('high')).toBe('medium');
    expect(sprites(h)).toHaveLength(3 * LOOK.puffs);
    expect(h.setTier('low')).toBe('low');
    expect(h.setTier('medium')).toBe('low');
    expect(sprites(h)).toHaveLength(0);
    h.dispose();
  });

  it('frees what it sheds once, the texture with the last sprite, and nothing a second time on dispose', () => {
    const h = buildHaze(spec(), 'high');
    const all = sprites(h);
    const shedOnMedium = all.filter((o) => o.userData.layer === 3);
    const kept = all.filter((o) => o.userData.layer !== 3);
    const texture = vi.spyOn(all[0]!.material.map!, 'dispose');
    const shedSpies = shedOnMedium.map((o) => vi.spyOn(o.material, 'dispose'));
    const keptSpies = kept.map((o) => vi.spyOn(o.material, 'dispose'));
    h.setTier('medium');
    for (const spy of shedSpies) expect(spy).toHaveBeenCalledOnce();
    for (const spy of keptSpies) expect(spy).not.toHaveBeenCalled();
    expect(texture).not.toHaveBeenCalled();
    h.setTier('low');
    for (const spy of keptSpies) expect(spy).toHaveBeenCalledOnce();
    expect(texture).toHaveBeenCalledOnce();
    h.dispose();
    for (const spy of [...shedSpies, ...keptSpies, texture]) expect(spy).toHaveBeenCalledOnce();
  });

  it('makes no texture where it keeps no layer, and frees every material and its texture otherwise, and not the sprites\' quad', () => {
    const none = buildHaze(spec(), 'low');
    expect(sprites(none)).toHaveLength(0);
    none.dispose();
    const h = buildHaze(spec(), 'high');
    const materials = sprites(h).map((o) => vi.spyOn(o.material, 'dispose'));
    const texture = vi.spyOn(sprites(h)[0]!.material.map!, 'dispose');
    const quad = vi.spyOn(sprites(h)[0]!.geometry, 'dispose');
    h.dispose();
    for (const spy of [...materials, texture]) expect(spy).toHaveBeenCalledOnce();
    expect(quad).not.toHaveBeenCalled();
  });
});
