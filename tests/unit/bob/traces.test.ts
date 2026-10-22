import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildGlass, GLASS_LOOK, GLASS_RENDER_ORDER, MIRROR_RENDER_ORDER } from '~/engine/bob/build/glassFloor';
import { buildTraces, TRACES_LOOK, TRACES_RENDER_ORDER, tracesUnder } from '~/engine/bob/build/traces';
import { clearOfWordmark, segmentClear, TRACE, traceLayout } from '~/engine/bob/traces';
import { palette } from '~/engine/palette';
import { WORDMARK } from '~/engine/bob/wordmark';

describe('traceLayout', () => {
  it('walks 70 traces at multiples of 45 degrees, the same every time', () => {
    const a = traceLayout();
    const b = traceLayout();
    expect(a.traces).toHaveLength(70);
    expect(a).toEqual(b);
    for (const t of a.traces) {
      for (let i = 1; i < t.length; i++) {
        const ang = Math.atan2(t[i][1] - t[i - 1][1], t[i][0] - t[i - 1][0]) / (Math.PI / 4);
        expect(Math.abs(ang - Math.round(ang))).toBeLessThan(1e-9);
      }
    }
  });

  it('keeps every trace clear of the letters and the circle', () => {
    for (const t of traceLayout().traces) for (const p of t) expect(clearOfWordmark(p, 0.25)).toBe(true);
  });

  it('keeps the whole length of every segment clear, not only its ends', () => {
    for (const t of traceLayout().traces) {
      for (let i = 1; i < t.length; i++) expect(segmentClear(t[i - 1], t[i], TRACE.margin)).toBe(true);
    }
  });

  it('runs each trace in 2 to 7 segments of 0.5 to 2.6 and ends each on a pad', () => {
    const { traces, pads } = traceLayout();
    expect(pads).toHaveLength(traces.length * 2);
    traces.forEach((t, k) => {
      expect(t.length).toBeGreaterThanOrEqual(3);
      expect(t.length).toBeLessThanOrEqual(TRACE.steps[1] + 1);
      for (let i = 1; i < t.length; i++) {
        const length = Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1]);
        expect(length).toBeGreaterThanOrEqual(TRACE.segment[0] - 1e-9);
        expect(length).toBeLessThanOrEqual(TRACE.segment[1] + 1e-9);
      }
      expect(pads[2 * k]).toEqual(t[0]);
      expect(pads[2 * k + 1]).toEqual(t[t.length - 1]);
    });
  });

  it('starts every trace inside the preview field, on the far side of the glass more than the near', () => {
    const { x, z } = TRACE.field;
    for (const t of traceLayout().traces) {
      expect(t[0][0]).toBeGreaterThanOrEqual(x[0]);
      expect(t[0][0]).toBeLessThanOrEqual(x[1]);
      expect(t[0][1]).toBeGreaterThanOrEqual(z[0]);
      expect(t[0][1]).toBeLessThanOrEqual(z[1]);
    }
    // The preview scatters from y -7 to 22, and its y becomes -z here.
    expect(z).toEqual([-22, 7]);
  });

  it('lays out another seed differently, and still lays out 70 clear traces', () => {
    const base = traceLayout();
    const other = traceLayout(7);
    expect(other).not.toEqual(base);
    expect(other.traces).toHaveLength(70);
    for (const t of other.traces) for (const p of t) expect(clearOfWordmark(p, 0.25)).toBe(true);
    expect(traceLayout(2006)).toEqual(base);
  });
});

describe('clearOfWordmark', () => {
  it('refuses the opening, the circle, the outer ring and its margin', () => {
    expect(clearOfWordmark([0, 0], 0.25)).toBe(false);
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.2)], 0.25)).toBe(false);
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.3)], 0.25)).toBe(true);
    expect(clearOfWordmark([WORDMARK.outer + 0.3, 9], 0.25)).toBe(true);
  });

  it('refuses each letter box grown by the margin, and nothing outside it', () => {
    const { leftX, rightX, width, nearZ } = WORDMARK.b;
    for (const ox of [leftX, rightX]) {
      expect(clearOfWordmark([ox + width / 2, 0], 0.25)).toBe(false);
      expect(clearOfWordmark([ox - 0.2, nearZ], 0.25)).toBe(false);
      expect(clearOfWordmark([ox - 0.3, nearZ], 0.25)).toBe(true);
      expect(clearOfWordmark([ox + width + 0.2, nearZ], 0.25)).toBe(false);
      expect(clearOfWordmark([ox + width + 0.3, nearZ], 0.25)).toBe(true);
      expect(clearOfWordmark([ox + width / 2, nearZ + 0.2], 0.25)).toBe(false);
      expect(clearOfWordmark([ox + width / 2, nearZ + 0.3], 0.25)).toBe(true);
      expect(clearOfWordmark([ox + width / 2, -nearZ - 0.3], 0.25)).toBe(true);
    }
  });

  it('grows with the margin it is given', () => {
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.3)], 0.25)).toBe(true);
    expect(clearOfWordmark([0, -(WORDMARK.outer + 0.3)], 0.5)).toBe(false);
  });
});

describe('segmentClear', () => {
  it('sees a segment that grazes the keep-out between its clear ends', () => {
    // Both ends are clear; the middle runs through the opening.
    expect(clearOfWordmark([0, -3], 0.25) && clearOfWordmark([0, 3], 0.25)).toBe(true);
    expect(segmentClear([0, -3], [0, 3], 0.25)).toBe(false);
    expect(segmentClear([0, -3], [0, -2.5], 0.25)).toBe(true);
  });
});

describe('the traces under the glass', () => {
  const layout = traceLayout();

  it('lies TRACES_LOOK.depth, 0.015, under the glass: the lines at y -0.015, from the build on', () => {
    expect(TRACES_LOOK.depth).toBe(0.015);
    const t = buildTraces(layout);
    t.group.updateMatrixWorld(true);
    const lines = t.group.getObjectByName('traces:lines') as THREE.LineSegments;
    expect(lines.position.y).toBe(-TRACES_LOOK.depth);
    expect(new THREE.Vector3().setFromMatrixPosition(lines.matrixWorld).y).toBeCloseTo(-0.015, 12);
    // The group stays on the glass's plane and the lines carry the depth, so the layout's own y stays 0.
    expect(t.group.position.y).toBe(0);
    const position = lines.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 97) expect(position.getY(i)).toBe(0);
    t.dispose();
  });

  it("draws before the glass, so the floor's tint dims them, and after the sky", () => {
    const t = buildTraces(layout);
    const lines = t.group.getObjectByName('traces:lines') as THREE.LineSegments;
    expect(lines.renderOrder).toBe(TRACES_RENDER_ORDER);
    expect(lines.renderOrder).toBeLessThan(GLASS_RENDER_ORDER);
    // The sky draws at -10 and the glass at -5: the traces sit between, never before the sky.
    expect(lines.renderOrder).toBeGreaterThan(-10);
    t.dispose();
  });

  it('draws over the mirror and under the floor: the mirror first, then the traces, then the glass, which writes depth', () => {
    // The floor is transparent glass on the high tier, so it draws after every opaque thing, whatever its order, and it
    // writes depth like any material: the traces under it must be down before it, and its tint then dims them.
    const high = buildGlass('high');
    const floor = high.group.getObjectByName('floor') as THREE.Mesh;
    const material = floor.material as THREE.MeshPhysicalMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(true);
    // The mirror lies at -0.003, nearer the glass than the traces' -0.015 and opaque: it would paint over them if it drew
    // after them, and fail them in the depth test if it drew before. So it draws first and the traces draw without depth.
    const mirror = high.group.getObjectByName('floor:reflector') as THREE.Mesh;
    expect(mirror.position.y).toBeGreaterThan(-TRACES_LOOK.depth);
    expect((mirror.material as THREE.ShaderMaterial).transparent).toBe(false);
    expect(mirror.renderOrder).toBe(MIRROR_RENDER_ORDER);
    expect(MIRROR_RENDER_ORDER).toBeLessThan(TRACES_RENDER_ORDER);
    expect(TRACES_RENDER_ORDER).toBeLessThan(floor.renderOrder);
    expect(MIRROR_RENDER_ORDER).toBeGreaterThan(-10);
    expect(GLASS_LOOK.reflection.opacity).toBeLessThan(1);
    const t = buildTraces(layout);
    const lines = t.group.getObjectByName('traces:lines') as THREE.LineSegments;
    const line = lines.material as THREE.LineBasicMaterial;
    expect(line.depthTest).toBe(false);
    expect(line.depthWrite).toBe(false);
    expect(line.transparent).toBe(false);
    t.dispose();
    high.dispose();
  });

  it('still scales with setLevel from the level it is built at', () => {
    const t = buildTraces(layout);
    const material = (t.group.getObjectByName('traces:lines') as THREE.LineSegments).material as THREE.LineBasicMaterial;
    const gold = new THREE.Color(palette.gold);
    expect(material.color.r).toBeCloseTo(gold.r * TRACES_LOOK.level, 6);
    t.setLevel(0.5);
    expect(material.color.r).toBeCloseTo(gold.r * 0.5, 6);
    expect(material.color.g).toBeCloseTo(gold.g * 0.5, 6);
    expect(material.color.b).toBeCloseTo(gold.b * 0.5, 6);
    t.setLevel(0);
    expect(material.color.r + material.color.g + material.color.b).toBe(0);
    t.setLevel(Number.NaN);
    expect(material.color.r).toBe(0);
    t.dispose();
  });
});

describe('the traces over opaque glass (Ruling 11)', () => {
  const layout = traceLayout();
  const gold = new THREE.Color(palette.gold);
  const linesOf = (t: ReturnType<typeof buildTraces>): THREE.LineSegments => t.group.getObjectByName('traces:lines') as THREE.LineSegments;
  const colourOf = (t: ReturnType<typeof buildTraces>): THREE.Color => (linesOf(t).material as THREE.LineBasicMaterial).color;

  it('is a hair above the glass, as M1 had it, and dim: the level over the glass is its own', () => {
    expect(TRACES_LOOK.lift).toBeGreaterThan(0);
    expect(TRACES_LOOK.lift).toBeLessThan(0.002);
    expect(TRACES_LOOK.levelOver).toBeGreaterThan(0);
    expect(TRACES_LOOK.levelOver).toBeLessThan(TRACES_LOOK.level);
  });

  it('setUnder(false) lays the traces on the glass: at +lift, the default order, depth tested and written, at the over level', () => {
    const t = buildTraces(layout);
    const lines = linesOf(t);
    const material = lines.material as THREE.LineBasicMaterial;
    const version = material.version;
    t.setLevel(TRACES_LOOK.level);
    t.setUnder(false);
    t.group.updateMatrixWorld(true);
    expect(new THREE.Vector3().setFromMatrixPosition(lines.matrixWorld).y).toBeCloseTo(TRACES_LOOK.lift, 12);
    expect(lines.renderOrder).toBe(0);
    // Drawn after the opaque floor (GLASS_RENDER_ORDER), where the depth test keeps the glass from covering them.
    expect(lines.renderOrder).toBeGreaterThan(GLASS_RENDER_ORDER);
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(true);
    expect(colourOf(t).r).toBeCloseTo(gold.r * TRACES_LOOK.levelOver, 9);
    expect(colourOf(t).g).toBeCloseTo(gold.g * TRACES_LOOK.levelOver, 9);
    expect(colourOf(t).b).toBeCloseTo(gold.b * TRACES_LOOK.levelOver, 9);
    // Render state only: no program is rebuilt by the switch.
    expect(material.version).toBe(version);
    t.dispose();
  });

  it('setUnder(true) puts them back under it: at -depth, order -6, no depth test, no depth write, the under level', () => {
    const t = buildTraces(layout);
    const lines = linesOf(t);
    const material = lines.material as THREE.LineBasicMaterial;
    const version = material.version;
    t.setLevel(TRACES_LOOK.level);
    t.setUnder(false);
    t.setUnder(true);
    t.group.updateMatrixWorld(true);
    expect(new THREE.Vector3().setFromMatrixPosition(lines.matrixWorld).y).toBeCloseTo(-TRACES_LOOK.depth, 12);
    expect(lines.renderOrder).toBe(TRACES_RENDER_ORDER);
    expect(lines.renderOrder).toBe(-6);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(colourOf(t).r).toBeCloseTo(gold.r * TRACES_LOOK.level, 9);
    expect(material.version).toBe(version);
    t.dispose();
  });

  it('builds under by default and over when asked, from the same layout', () => {
    const under = buildTraces(layout);
    const over = buildTraces(layout, false);
    expect(linesOf(under).position.y).toBe(-TRACES_LOOK.depth);
    expect(linesOf(over).position.y).toBe(TRACES_LOOK.lift);
    expect(linesOf(over).renderOrder).toBe(0);
    expect((linesOf(over).material as THREE.LineBasicMaterial).depthTest).toBe(true);
    // Built over, the level at build is the over level, and the fade (setLevel) scales from there.
    expect(colourOf(over).r).toBeCloseTo(gold.r * TRACES_LOOK.levelOver, 9);
    under.dispose();
    over.dispose();
  });

  it('keeps the fade across the switch: setLevel is in under-level units, and over the glass it reads as the same share of the over level', () => {
    const t = buildTraces(layout);
    t.setLevel(TRACES_LOOK.level / 2);
    t.setUnder(false);
    expect(colourOf(t).r).toBeCloseTo((gold.r * TRACES_LOOK.levelOver) / 2, 9);
    t.setLevel(TRACES_LOOK.level / 4);
    expect(colourOf(t).g).toBeCloseTo((gold.g * TRACES_LOOK.levelOver) / 4, 9);
    t.setUnder(true);
    expect(colourOf(t).g).toBeCloseTo((gold.g * TRACES_LOOK.level) / 4, 9);
    t.setUnder(false);
    t.setLevel(0);
    expect(colourOf(t).r + colourOf(t).g + colourOf(t).b).toBe(0);
    t.setLevel(Number.NaN);
    expect(colourOf(t).r).toBe(0);
    t.setLevel(-1);
    expect(colourOf(t).r).toBe(0);
    t.setUnder(true);
    expect(colourOf(t).r).toBe(0);
    t.dispose();
  });
});

describe('tracesUnder', () => {
  it('lays the traces under the glass only where the floor is transparent: the high tier with the reflector on', () => {
    expect(tracesUnder('high', true)).toBe(true);
    // The reflector off (a step down) makes the floor opaque, whatever the tier says.
    expect(tracesUnder('high', false)).toBe(false);
    for (const tier of ['medium', 'low'] as const) {
      expect(tracesUnder(tier, true), `${tier} with a reflector flag`).toBe(false);
      expect(tracesUnder(tier, false), tier).toBe(false);
    }
  });

  it("agrees with what buildGlass builds: transparent glass exactly where the traces go under", () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const glass = buildGlass(tier);
      const floor = glass.group.getObjectByName('floor') as THREE.Mesh;
      expect((floor.material as THREE.MeshPhysicalMaterial).transparent, tier).toBe(tracesUnder(tier, true));
      glass.setReflector(false);
      expect((floor.material as THREE.MeshPhysicalMaterial).transparent, `${tier} after the reflector goes`).toBe(tracesUnder(tier, false));
      glass.dispose();
    }
  });
});
