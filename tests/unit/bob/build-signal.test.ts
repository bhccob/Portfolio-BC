import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildSignal } from '~/engine/bob/build/signal';
import { bitX, SIGNAL, signalBits } from '~/engine/bob/signalFrames';
import { WORDMARK } from '~/engine/bob/wordmark';

// Round 17 (Bob: "B · Signal"): the line on the glass, read left to right, then curled into the circle.

const WORD = 'BOB CHUNG';
const BITS = signalBits(WORD).length;

const part = (group: THREE.Group, name: string): THREE.Mesh => {
  const found = group.getObjectByName(name);
  if (!found) throw new Error(`no ${name}`);
  return found as THREE.Mesh;
};

/** The line's vertices it draws (those its index reaches within its draw range), as [x, y, z]. */
function vertices(group: THREE.Group): [number, number, number][] {
  const geometry = part(group, 'signal:line').geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex()!;
  const { start, count } = geometry.drawRange;
  const used = new Set<number>();
  for (let k = start; k < Math.min(index.count, start + count); k++) used.add(index.getX(k));
  return [...used].map((i) => [position.getX(i), position.getY(i), position.getZ(i)] as [number, number, number]);
}

describe('the signal', () => {
  it('is hidden with no light', () => {
    const signal = buildSignal(WORD);
    signal.pose(0, 0, 0, 0);
    expect(signal.group.visible).toBe(false);
    signal.dispose();
  });

  it('lies along the glass, its pulses standing up off it, once read whole', () => {
    const signal = buildSignal(WORD);
    signal.pose(1, 0, 1, 0);
    expect(signal.group.visible).toBe(true);
    const v = vertices(signal.group);
    expect(v.length).toBeGreaterThan(200);
    for (const [x, y, z] of v) {
      expect(Math.abs(x)).toBeLessThanOrEqual(SIGNAL.half + 0.02);
      expect(y).toBeGreaterThanOrEqual(-0.02);
      expect(y).toBeLessThanOrEqual(SIGNAL.high + 0.02);
      expect(Math.abs(z)).toBeLessThanOrEqual(0.02);
    }
    signal.dispose();
  });

  it('is clean pulses left of the cursor, the cursor shown while it reads', () => {
    const signal = buildSignal(WORD);
    signal.pose(0.5, 0, 1, 2.3);
    const cursor = bitX(BITS / 2, BITS);
    // Away from the edges (where a vertical step runs between the levels), a vertex left of the cursor sits on a level.
    const clean = vertices(signal.group).filter(([x]) => x < cursor - 0.05);
    expect(clean.length).toBeGreaterThan(50);
    const onLevel = clean.filter(([, y]) => Math.abs(y) <= 0.02 || Math.abs(y - SIGNAL.high) <= 0.02);
    expect(onLevel.length / clean.length).toBeGreaterThan(0.85);
    expect(part(signal.group, 'signal:cursor').visible).toBe(true);
    signal.pose(1, 0, 1, 2.3);
    expect(part(signal.group, 'signal:cursor').visible).toBe(false);
    signal.dispose();
  });

  it('curls into the circle on the glass', () => {
    const signal = buildSignal(WORD);
    signal.pose(1, 1, 1, 0);
    // Curled whole it is the circle itself: the engraving's circle takes over and the line goes.
    expect(signal.group.visible).toBe(false);
    signal.pose(1, 0.999, 1, 0);
    for (const [x, y, z] of vertices(signal.group)) {
      expect(Math.abs(Math.hypot(x, z) - WORDMARK.circle)).toBeLessThan(0.03);
      expect(Math.abs(y)).toBeLessThan(0.03);
    }
    signal.dispose();
  });

  it('frees what it made', () => {
    const signal = buildSignal(WORD);
    const line = part(signal.group, 'signal:line');
    let freed = 0;
    line.geometry.addEventListener('dispose', () => freed++);
    (line.material as THREE.Material).addEventListener('dispose', () => freed++);
    signal.dispose();
    expect(freed).toBe(2);
  });
});
