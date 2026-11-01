import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDial, DIAL, dialRepeats, dialText } from '~/engine/bob/build/dial';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

// Round 16 (spec 2026-11-01-bob-round16-design.md; Bob picked "Dial (C)"): Bob's name and line run slowly round the
// compass's base on the glass, in gold, like an engraving on a dial.

/** A canvas as a test hands it over: every drawing call does nothing, its size is kept. */
function canvas(): HTMLCanvasElement {
  const noop = () => {};
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : noop),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    }
  }) as unknown as CanvasRenderingContext2D;
  return { width: 0, height: 0, getContext: (kind: string) => (kind === '2d' ? ctx : null) } as unknown as HTMLCanvasElement;
}

const ringOf = (group: THREE.Group): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> => {
  const found = group.getObjectByName('dial:ring');
  if (!found) throw new Error('no dial ring');
  return found as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
};

describe('the dial', () => {
  it("says Bob's name and his line, in each language, in capitals", () => {
    expect(dialText(nl.needle.hero.name, nl.hero.badge)).toBe('BOB CHUNG • STUDENT SOFTWARE ENGINEER • GEBOREN OP ARUBA • WOONT IN ROTTERDAM • ');
    expect(dialText(en.needle.hero.name, en.hero.badge)).toBe('BOB CHUNG • STUDENT SOFTWARE ENGINEER • BORN IN ARUBA • BASED IN ROTTERDAM • ');
  });

  it('repeats the words a whole number of times round the ring, so the join never cuts a word', () => {
    expect(dialRepeats(3, 12.88)).toBe(4);
    expect(dialRepeats(20, 12.88)).toBe(1);
    expect(dialRepeats(0, 12.88)).toBe(1);
    expect(dialRepeats(Number.NaN, 12.88)).toBe(1);
  });

  it("lies on the glass round the compass, just outside its outer ring", () => {
    expect(DIAL).toEqual({ radius: 2.05, letter: 0.06, band: 0.1, turn: 0.035, far: 0.3, fadeIn: 0.8, lift: 0.004 });
    const dial = buildDial(canvas());
    const position = ringOf(dial.group).geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      expect(Math.abs(position.getY(i) - DIAL.lift)).toBeLessThan(1e-6);
      const r = Math.hypot(position.getX(i), position.getZ(i));
      expect(Math.abs(r - DIAL.radius)).toBeLessThanOrEqual(DIAL.band / 2 + 1e-6);
    }
    dial.dispose();
  });

  it('is dimmer on its far side, as a dial lying in depth', () => {
    const dial = buildDial(canvas());
    const geometry = ringOf(dial.group).geometry;
    const position = geometry.getAttribute('position');
    const colour = geometry.getAttribute('color');
    let near = 0;
    let far = 1;
    for (let i = 0; i < position.count; i++) {
      if (position.getZ(i) > DIAL.radius * 0.99) near = Math.max(near, colour.getX(i));
      if (position.getZ(i) < -DIAL.radius * 0.99) far = Math.min(far, colour.getX(i));
    }
    expect(near).toBeCloseTo(1, 2);
    expect(far).toBeCloseTo(DIAL.far, 2);
    dial.dispose();
  });

  it('shows at its level and turns its words by the angle', () => {
    const dial = buildDial(canvas());
    const ring = ringOf(dial.group);
    dial.pose(0, 0);
    expect(dial.group.visible).toBe(false);
    dial.pose(1, 0.4);
    expect(dial.group.visible).toBe(true);
    expect(ring.material.opacity).toBe(1);
    expect(ring.material.map!.offset.x).toBeCloseTo(0.4 / (2 * Math.PI), 12);
    dial.pose(0.5, 0.4);
    expect(ring.material.opacity).toBe(0.5);
    dial.dispose();
  });

  it('draws its words again only when they change', () => {
    const dial = buildDial(canvas());
    const map = ringOf(dial.group).material.map!;
    dial.setText(dialText(nl.needle.hero.name, nl.hero.badge));
    const once = map.version;
    dial.setText(dialText(nl.needle.hero.name, nl.hero.badge));
    expect(map.version).toBe(once);
    dial.setText(dialText(en.needle.hero.name, en.hero.badge));
    expect(map.version).toBeGreaterThan(once);
    dial.dispose();
  });
});
