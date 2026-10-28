import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildNebula, NEBULA_LOOK, type NebulaModel } from '~/engine/bob/build/nebula';
import { makeWorldPath } from '~/scene/bob/worldPath';

/** A canvas as a test hands it over: a 2D context that draws nothing, and pixels to write. */
function canvas(): HTMLCanvasElement {
  const noop = () => {};
  const ctx = {
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    arc: noop,
    closePath: noop,
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop
  } as unknown as CanvasRenderingContext2D;
  return { width: 0, height: 0, getContext: (kind: string) => (kind === '2d' ? ctx : null) } as unknown as HTMLCanvasElement;
}

const PATH = makeWorldPath(16 / 9);
const LEVELS = { clouds: 1, bands: 1, rings: 0 };

function build(tier: 'high' | 'medium' | 'low' = 'high'): NebulaModel {
  return buildNebula(PATH.centre, tier, canvas);
}

function drawn(model: NebulaModel): (THREE.Mesh | THREE.Points)[] {
  const out: (THREE.Mesh | THREE.Points)[] = [];
  model.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) out.push(o as THREE.Mesh | THREE.Points);
  });
  return out;
}

const level = (o: THREE.Mesh | THREE.Points): number => ((o.material as THREE.ShaderMaterial).uniforms.uLevel!.value as number);

describe('the nebula round the gas: a faint far shell, stars, dust and far gold bands', () => {
  it('builds no cloud cards; the stars, dust and shell stay, additive, writing no depth, under the gas', () => {
    const model = build();
    const parts = drawn(model);
    const named = (prefix: string) => parts.filter((o) => o.name.startsWith(prefix));
    expect(named('nebula:clouds')).toHaveLength(0);
    expect(named('nebula:shell')).toHaveLength(1);
    expect(named('nebula:stars')).toHaveLength(2);
    expect(named('nebula:dust')).toHaveLength(2);
    expect(named('nebula:band').length).toBe(NEBULA_LOOK.bands.count.high);
    for (const o of parts) {
      const m = o.material as THREE.Material;
      expect(m.blending, o.name).toBe(THREE.AdditiveBlending);
      expect(m.depthWrite, o.name).toBe(false);
      expect(m.transparent, o.name).toBe(true);
    }
    // Drawn before the gas's layer (renderOrder -5), so the gas's dark lanes hide the stars behind them.
    for (const o of [...named('nebula:shell'), ...named('nebula:stars'), ...named('nebula:dust')]) expect(o.renderOrder, o.name).toBeLessThan(-5);
    expect(NEBULA_LOOK).not.toHaveProperty('clouds');
    model.dispose();
  });

  it('thins out on the lower tiers: fewer bands, stars and dust', () => {
    const count = (model: NebulaModel, prefix: string) =>
      drawn(model)
        .filter((o) => o.name.startsWith(prefix))
        .reduce((sum, o) => sum + (o.geometry.getAttribute('position')?.count ?? 0), 0);
    const high = build('high');
    const medium = build('medium');
    expect(count(medium, 'nebula:dust')).toBeLessThan(count(high, 'nebula:dust'));
    expect(count(medium, 'nebula:stars')).toBeLessThan(count(high, 'nebula:stars'));
    expect(drawn(medium).filter((o) => o.name.startsWith('nebula:band')).length).toBe(NEBULA_LOOK.bands.count.medium);
    high.dispose();
    medium.dispose();
  });

  it('hides all at level 0', () => {
    const model = build();
    model.update({ clouds: 0, bands: 0, rings: 0 }, 0);
    expect(model.group.visible).toBe(false);
    model.update({ clouds: 0.5, bands: 0, rings: 0 }, 0);
    expect(model.group.visible).toBe(true);
    for (const o of drawn(model)) {
      if (o.name.startsWith('nebula:band')) expect(level(o), o.name).toBe(0);
      else expect(level(o), o.name).toBeGreaterThan(0);
    }
    model.update({ clouds: 0, bands: 0, rings: 0 }, 0);
    expect(model.group.visible).toBe(false);
    model.dispose();
  });

  it('turns the bands with the place, not the clock', () => {
    const model = build();
    const pivots = () => drawn(model).filter((o) => o.name.startsWith('nebula:band')).map((o) => o.parent!.rotation.y);
    model.update(LEVELS, 8);
    const at8 = pivots();
    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);
    model.update(LEVELS, 8);
    expect(pivots()).toEqual(at8);
    vi.useRealTimers();
    model.update(LEVELS, 9);
    const at9 = pivots();
    for (const [k, y] of at9.entries()) expect(y).not.toBeCloseTo(at8[k]!, 4);
    // Slowly: a whole unit of the scroll turns a band less than a tenth of a turn.
    for (const [k, y] of at9.entries()) expect(Math.abs(y - at8[k]!)).toBeLessThan(0.1 * 2 * Math.PI);
    model.dispose();
  });

  it('fades a band out as the camera sees it edge on, where it would be a line across the picture', () => {
    const model = build();
    const rings = drawn(model).filter((o) => o.name.startsWith('nebula:band'));
    model.update(LEVELS, 8);
    model.group.updateMatrixWorld(true);
    for (const ring of rings) {
      const centre = ring.getWorldPosition(new THREE.Vector3());
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(ring.getWorldQuaternion(new THREE.Quaternion()));
      // Square on (along its axis): its whole level. In its own plane: none.
      model.update(LEVELS, 8, centre.clone().addScaledVector(normal, 30).toArray() as [number, number, number]);
      expect(level(ring), ring.name).toBeCloseTo(NEBULA_LOOK.bands.level, 9);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(ring.getWorldQuaternion(new THREE.Quaternion()));
      model.update(LEVELS, 8, centre.clone().addScaledVector(side, 30).toArray() as [number, number, number]);
      expect(level(ring), ring.name).toBe(0);
    }
    model.dispose();
  });

  it('frees everything', () => {
    const model = build();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const o of drawn(model)) {
      geometries.add(o.geometry);
      const m = o.material as THREE.ShaderMaterial;
      materials.add(m);
      for (const u of Object.values(m.uniforms)) if ((u.value as THREE.Texture)?.isTexture) textures.add(u.value as THREE.Texture);
    }
    expect(textures.size).toBeGreaterThanOrEqual(1); // the bands' engraving
    const spies = [...geometries, ...materials, ...textures].map((d) => vi.spyOn(d, 'dispose'));
    model.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('names a canvas that gives no 2D context', () => {
    const none = () => ({ width: 0, height: 0, getContext: () => null }) as unknown as HTMLCanvasElement;
    expect(() => buildNebula(PATH.centre, 'high', none)).toThrow(/2D canvas context/);
  });
});
