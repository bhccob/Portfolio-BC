import { describe, expect, it } from 'vitest';
import { DragTurn } from '../../src/scripts/three/DragTurn';
describe('DragTurn', () => {
  it('ignores small and mostly vertical moves', () => {
    const d = new DragTurn(); d.down(100, 100); d.move(104, 100, 1000); expect(d.engaged).toBe(false);
    d.move(110, 160, 1000); expect(d.engaged).toBe(false);
  });
  it('turns within the limits while dragging and springs back after release', () => {
    const d = new DragTurn(); d.down(0, 0); d.move(5000, 0, 1000);
    expect(d.engaged).toBe(true);
    expect(Math.abs(d.step(1 / 60).yaw)).toBeLessThanOrEqual(0.436 + 1e-9);
    d.up(); let t = { yaw: 1, pitch: 1 };
    for (let i = 0; i < 90; i++) t = d.step(1 / 60);
    expect(Math.abs(t.yaw)).toBeLessThan(0.01);
  });
  it('stays finite for a zero time step', () => {
    const d = new DragTurn(); const t = d.step(0); expect(Number.isFinite(t.yaw) && Number.isFinite(t.pitch)).toBe(true);
  });
  it('measures from the press, follows the drag with no lag and stays engaged until release', () => {
    const d = new DragTurn(); d.down(200, 50); d.move(300, 50, 1000);
    expect(d.engaged).toBe(true);
    expect(d.step(1 / 60).yaw).toBeCloseTo(0.16, 9);
    d.move(250, 50, 1000); expect(d.engaged).toBe(true); expect(d.step(1 / 60).yaw).toBeCloseTo(0.08, 9);
    d.up(); expect(d.engaged).toBe(false);
  });
  it('clamps the tip to the pitch limit', () => {
    const d = new DragTurn(); d.down(0, 0); d.move(900, 800, 1000);
    expect(d.engaged).toBe(true); expect(d.step(1 / 60).pitch).toBeCloseTo(0.14, 9);
  });
  it('ignores moves before a press, after a release and over a zero-width canvas', () => {
    const d = new DragTurn(); d.move(500, 0, 1000); expect(d.engaged).toBe(false);
    d.down(0, 0); d.move(500, 0, 0); d.move(500, 0, -10); expect(d.engaged).toBe(false);
    d.move(500, 0, 1000); expect(d.engaged).toBe(true); d.up(); d.move(900, 0, 1000);
    expect(d.engaged).toBe(false);
    for (let i = 0; i < 120; i++) d.step(1 / 60);
    expect(d.step(0).yaw).toBeCloseTo(0, 3);
  });
});
