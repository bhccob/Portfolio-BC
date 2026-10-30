import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildRoom, ROOM_LOOK, roomScene } from '~/engine/bob/build/room';
import { palette } from '~/engine/palette';

type Drawn = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;

/** Every mesh, line, points and sprite object under `root`. */
function drawn(root: THREE.Object3D): Drawn[] {
  const out: Drawn[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) out.push(o as Drawn);
  });
  return out;
}

describe('the reflection room (ported unchanged from v3)', () => {
  it("is milestone 1's room of light cards at half its radiance, in the palette's colours", () => {
    const room = roomScene();
    const cards = room.scene.children.filter((o) => o.name.startsWith('room:card:')) as THREE.Mesh[];
    expect(cards).toHaveLength(ROOM_LOOK.cards.length);
    expect(ROOM_LOOK.radiance).toBe(0.5);
    // Milestone 1's radiances, halved.
    expect(ROOM_LOOK.cards.map((card) => card.radiance * ROOM_LOOK.radiance)).toEqual([1.2, 0.4, 0.6, 0.3]);
    // Round 8 (spec 2026-10-30-bob-moonlit-3d-design.md): the card behind is the moon's, a pale violet, for the rims.
    const back = ROOM_LOOK.cards.find((card) => card.azimuth === 180)!;
    expect(back.colour).toBe(palette.lilac);
    cards.forEach((card, k) => {
      const spec = ROOM_LOOK.cards[k];
      const colour = (card.material as THREE.MeshBasicMaterial).color;
      expect(colour.equals(new THREE.Color(spec.colour).multiplyScalar(spec.radiance * ROOM_LOOK.radiance))).toBe(true);
      expect(Object.values(palette)).toContain(spec.colour);
      // Ten out, facing the middle.
      expect(card.position.length()).toBeCloseTo(10, 6);
      const facing = card.getWorldDirection(new THREE.Vector3());
      expect(facing.dot(card.position.clone().normalize())).toBeCloseTo(-1, 6);
    });
    const walls = room.scene.getObjectByName('room:walls') as THREE.Mesh;
    expect(walls).toBeDefined();
    expect((walls.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
    expect((walls.material as THREE.MeshBasicMaterial).color.getHex()).toBe(palette.ink);
    const parts = drawn(room.scene);
    const spies = [...new Set([...parts.map((o) => o.geometry), ...parts.map((o) => o.material as THREE.Material)])].map((part) => vi.spyOn(part, 'dispose'));
    room.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });

  it('prefilters the room through PMREM once, frees the room and the generator straight away, and its result on dispose', () => {
    const target = new THREE.WebGLRenderTarget(1, 1);
    const fromScene = vi.fn((_scene: THREE.Scene, _sigma?: number) => target);
    const generatorDispose = vi.fn();
    const generator = vi.fn(() => ({ fromScene, dispose: generatorDispose }));
    const renderer = {} as THREE.WebGLRenderer;
    const freed = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const room = buildRoom(renderer, generator);
    expect(generator).toHaveBeenCalledWith(renderer);
    expect(fromScene).toHaveBeenCalledTimes(1);
    expect(fromScene.mock.calls[0][0]).toBeInstanceOf(THREE.Scene);
    expect(fromScene.mock.calls[0][1]).toBe(ROOM_LOOK.blur);
    expect(room.environment).toBe(target.texture);
    expect(generatorDispose).toHaveBeenCalled();
    // The shell and the cards' plane.
    expect(freed.mock.calls.length).toBeGreaterThanOrEqual(2);
    freed.mockRestore();
    const released = vi.spyOn(target, 'dispose');
    room.dispose();
    expect(released).toHaveBeenCalled();
  });
});
