import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildChip, CHIP_LOOK } from '~/engine/v3/build/chip';
import { buildLaser, LASER_LOOK } from '~/engine/v3/build/laser';
import { buildTraces, TRACES_LOOK } from '~/engine/v3/build/traces';
import { palette } from '~/engine/palette';
import { CHIP, engraved, ON_STROKES, pinPosition, strokeLengths } from '~/engine/v3/chipSpec';
import { boardPath, ringPath, TRACE, tracePoints } from '~/engine/v3/traces';

describe('buildChip', () => {
  it('lights exactly as many pins as asked', () => {
    const chip = buildChip();
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    expect(pins.count).toBe(64);
    chip.setPins(10);
    const lit = [...Array(64).keys()].filter((i) => { const c = new THREE.Color(); pins.getColorAt(i, c); return c.r > 0.05; });
    expect(lit).toHaveLength(10);
    chip.dispose();
  });
  it('frees its geometries and materials', () => {
    const chip = buildChip();
    const spies: unknown[] = [];
    chip.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) spies.push(vi.spyOn(m.geometry, 'dispose')); });
    chip.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});

describe('buildTraces', () => {
  it('draws the board at 0 and the rings at 1', () => {
    const traces = buildTraces();
    const pos = () => traces.lines.geometry.getAttribute('position').array as Float32Array;
    traces.setT(0);
    expect(pos().slice(0, 3)).toEqual(boardPath(0).slice(0, 3));
    traces.setT(1);
    expect(pos().slice(0, 3)).toEqual(ringPath(0).slice(0, 3));
    expect(pos().length).toBe(TRACE.count * (TRACE.points - 1) * 2 * 3);
    traces.dispose();
  });
});

/** Rec. 709 luminance in linear light: what the scene's bloom thresholds at 1. */
function luminance(c: THREE.Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Every mesh, line and points object under `root`, with its geometry and its material(s). */
function drawn(root: THREE.Object3D): (THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite)[] {
  const out: (THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite)[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) out.push(o as THREE.Mesh);
  });
  return out;
}

const TOP = CHIP.board + CHIP.height;

describe('the chip', () => {
  const pinColour = (pins: THREE.InstancedMesh, i: number): THREE.Color => {
    const c = new THREE.Color();
    pins.getColorAt(i, c);
    return c;
  };
  const strokeMeshes = (chip: ReturnType<typeof buildChip>) =>
    (chip.group.getObjectByName('chip:engraving') as THREE.Group).children as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];

  it('stands its body on the board plane at the compass centre, near-black and matte', () => {
    const chip = buildChip();
    const body = chip.group.getObjectByName('chip:body') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(CHIP.board, 6);
    expect(box.max.y).toBeCloseTo(TOP, 6);
    expect(box.min.x).toBeCloseTo(-CHIP.size / 2, 6);
    expect(box.max.z).toBeCloseTo(CHIP.size / 2, 6);
    expect(luminance(body.material.color)).toBeLessThan(0.01);
    expect(body.material.roughness).toBeGreaterThan(0.8);
    chip.dispose();
  });

  it('puts each pin at its pinPosition, flat on the board, reaching from the body edge outward', () => {
    const chip = buildChip();
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    pins.geometry.computeBoundingBox();
    const matrix = new THREE.Matrix4();
    for (const i of [0, 15, 16, 31, 32, 47, 48, 63]) {
      pins.getMatrixAt(i, matrix);
      const box = pins.geometry.boundingBox!.clone().applyMatrix4(matrix);
      const { x, z, side } = pinPosition(i);
      const centre = box.getCenter(new THREE.Vector3());
      expect(centre.x).toBeCloseTo(x, 6);
      expect(centre.z).toBeCloseTo(z, 6);
      expect(box.min.y).toBeCloseTo(CHIP.board, 6);
      // The lead's length runs out from its side; its inner end meets the body's edge.
      const size = box.getSize(new THREE.Vector3());
      const outward = side === 'top' || side === 'bottom' ? size.z : size.x;
      expect(outward).toBeCloseTo(CHIP.pinLength, 6);
      const inner = { top: box.max.z, bottom: -box.min.z, left: box.max.x, right: -box.min.x }[side];
      expect(Math.abs(inner)).toBeCloseTo(CHIP.size / 2, 6);
    }
    chip.dispose();
  });

  it('lights the first pins in their clockwise order and holds the count to 0..64', () => {
    const chip = buildChip();
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    const litPins = () => [...Array(64).keys()].filter((i) => pinColour(pins, i).r > 0.05);
    chip.setPins(10);
    expect(litPins()).toEqual([...Array(10).keys()]);
    chip.setPins(10.7);
    expect(litPins()).toHaveLength(10);
    chip.setPins(100);
    expect(litPins()).toHaveLength(64);
    const version = pins.instanceColor!.version;
    chip.setPins(-3);
    expect(litPins()).toHaveLength(0);
    expect(pins.instanceColor!.version).toBeGreaterThan(version);
    chip.setPins(5);
    chip.setPins(Number.NaN);
    expect(litPins()).toHaveLength(0);
    chip.dispose();
  });

  it('glows its lit pins amber, low while loading', () => {
    const chip = buildChip();
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    chip.setPins(1);
    const lit = pinColour(pins, 0);
    const gold = new THREE.Color(palette.gold);
    expect(lit.r / gold.r).toBeCloseTo(CHIP_LOOK.glow.lit, 6);
    expect(lit.g / gold.g).toBeCloseTo(CHIP_LOOK.glow.lit, 6);
    expect(luminance(lit)).toBeLessThan(1);
    expect(pinColour(pins, 1).getHex()).toBe(0);
    chip.dispose();
  });

  it('powers the lit pins up to a soft glow, and the linked traces with them', () => {
    const traces = { setGlow: vi.fn() };
    const chip = buildChip({ traces });
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    chip.setPins(64);
    const before = luminance(pinColour(pins, 40));
    chip.setPower(1);
    const after = luminance(pinColour(pins, 40));
    expect(after / before).toBeCloseTo(CHIP_LOOK.glow.power / CHIP_LOOK.glow.lit, 6);
    // Just past the bloom's threshold: a soft glow, not a blown-out ring.
    expect(after).toBeGreaterThan(1);
    expect(after).toBeLessThan(1.2);
    expect(traces.setGlow).toHaveBeenLastCalledWith(1);
    chip.setPower(0.5);
    expect(traces.setGlow).toHaveBeenLastCalledWith(0.5);
    expect(luminance(pinColour(pins, 40))).toBeGreaterThan(before);
    expect(luminance(pinColour(pins, 40))).toBeLessThan(after);
    chip.setPower(Number.NaN);
    expect(traces.setGlow).toHaveBeenLastCalledWith(0);
    expect(luminance(pinColour(pins, 40))).toBeCloseTo(before, 9);
    chip.dispose();
  });

  it('keeps an unlit pin dark at full power', () => {
    const chip = buildChip();
    const pins = chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh;
    chip.setPins(3);
    chip.setPower(1);
    expect(pinColour(pins, 3).getHex()).toBe(0);
    chip.dispose();
  });

  it("moves a pin's instance colour from its paint to its glow, so the lead stays brass", () => {
    const chip = buildChip();
    const material = (chip.group.getObjectByName('chip:pins') as THREE.InstancedMesh).material as THREE.MeshStandardMaterial;
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    expect(shader.fragmentShader).toContain('#include <color_fragment>');
    expect(shader.fragmentShader).toContain('#include <emissivemap_fragment>');
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += vColor.rgb;');
    expect(material.customProgramCacheKey()).toBe('chip:pins');
    chip.dispose();
  });

  it('draws each stroke of ON as an upward-facing ribbon a hair over the top, its along running 0..1', () => {
    const chip = buildChip();
    const meshes = strokeMeshes(chip);
    expect(meshes).toHaveLength(ON_STROKES.length);
    meshes.forEach((mesh, k) => {
      const position = mesh.geometry.getAttribute('position');
      const along = mesh.geometry.getAttribute('along');
      expect(along.count).toBe(position.count);
      const values = Array.from(along.array as Float32Array);
      expect(Math.min(...values)).toBe(0);
      expect(Math.max(...values)).toBe(1);
      for (let v = 2; v < values.length; v++) expect(values[v]).toBeGreaterThanOrEqual(values[v - 2]);
      // Flat, a hair over the top, within the stroke's reach.
      const xs = ON_STROKES[k].points.map((p) => p[0]);
      const zs = ON_STROKES[k].points.map((p) => p[1]);
      for (let v = 0; v < position.count; v++) {
        expect(position.getY(v)).toBeCloseTo(TOP + CHIP_LOOK.engraving.lift, 6);
        expect(position.getX(v)).toBeGreaterThanOrEqual(Math.min(...xs) - CHIP_LOOK.engraving.width);
        expect(position.getX(v)).toBeLessThanOrEqual(Math.max(...xs) + CHIP_LOOK.engraving.width);
        expect(position.getZ(v)).toBeGreaterThanOrEqual(Math.min(...zs) - CHIP_LOOK.engraving.width);
        expect(position.getZ(v)).toBeLessThanOrEqual(Math.max(...zs) + CHIP_LOOK.engraving.width);
      }
      // Each station's two vertices are the ribbon's width apart (a little more where the O mitres).
      for (let s = 0; s < position.count; s += 2) {
        const across = Math.hypot(position.getX(s) - position.getX(s + 1), position.getZ(s) - position.getZ(s + 1));
        expect(across).toBeGreaterThanOrEqual(CHIP_LOOK.engraving.width - 1e-6);
        expect(across).toBeLessThan(CHIP_LOOK.engraving.width * 1.01);
      }
      // Every triangle looks up.
      const index = mesh.geometry.getIndex()!;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      for (let t = 0; t < index.count; t += 3) {
        a.fromBufferAttribute(position, index.getX(t));
        b.fromBufferAttribute(position, index.getX(t + 1));
        c.fromBufferAttribute(position, index.getX(t + 2));
        expect(new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()).y).toBeCloseTo(1, 6);
      }
    });
    chip.dispose();
  });

  it('shows each stroke as far as it is cut, and draws nothing of a stroke not started', () => {
    const chip = buildChip();
    const meshes = strokeMeshes(chip);
    expect(meshes.every((mesh) => !mesh.visible)).toBe(true);
    chip.setEngraving([1, 0.5, 0, 0], 1);
    expect(meshes.map((mesh) => mesh.material.uniforms.uFraction.value)).toEqual([1, 0.5, 0, 0]);
    expect(meshes.map((mesh) => mesh.visible)).toEqual([true, true, false, false]);
    chip.setEngraving([2, Number.NaN, -1], 1);
    expect(meshes.map((mesh) => mesh.material.uniforms.uFraction.value)).toEqual([1, 0, 0, 0]);
    // The shader hides the ribbon past the cut.
    expect(meshes[0].material.fragmentShader).toContain('vAlong > uFraction');
    expect(meshes[0].material.fragmentShader).toContain('discard');
    chip.dispose();
  });

  it('glows hot at the cut and cools to gold over 0.6 s', () => {
    const chip = buildChip();
    const uniforms = strokeMeshes(chip)[0].material.uniforms;
    const lengths = strokeLengths(ON_STROKES);
    const fractions = engraved(ON_STROKES, 0.3);
    chip.setEngraving(fractions, 1);
    expect(uniforms.uCut.value).toBeCloseTo(0.3 * lengths.reduce((a, b) => a + b, 0), 9);
    expect(uniforms.uFrontAge.value).toBe(0);
    chip.setEngraving(fractions, 1.25);
    expect(uniforms.uFrontAge.value).toBeCloseTo(0.25, 9);
    chip.setEngraving(fractions, 9);
    expect(uniforms.uFrontAge.value).toBe(CHIP_LOOK.engraving.cool);
    chip.setEngraving(engraved(ON_STROKES, 0.31), 9.02);
    expect(uniforms.uFrontAge.value).toBe(0);
    // The cut's place and age are one for the whole ON, so the glow runs on across a stroke's end.
    const meshes = strokeMeshes(chip);
    for (const mesh of meshes) expect(mesh.material.uniforms.uCut).toBe(uniforms.uCut);
    expect(meshes.map((mesh) => mesh.material.uniforms.uStart.value)).toEqual([0, lengths[0], lengths[0] + lengths[1], lengths[0] + lengths[1] + lengths[2]]);
    // Hot amber at the cut, gold once cooled; the cooled ON never blooms, the hot tip only softly.
    expect(luminance(uniforms.uCold.value)).toBeLessThan(1);
    expect(luminance(uniforms.uHot.value)).toBeGreaterThan(1);
    expect(luminance(uniforms.uHot.value)).toBeLessThan(1.25);
    expect(uniforms.uHot.value.r).toBeGreaterThan(uniforms.uHot.value.g * 3);
    expect(uniforms.uCoolSeconds.value).toBe(0.6);
    chip.dispose();
  });

  it('shows a finished ON already cool when set at a time of -Infinity, and a seek back as a fresh cut', () => {
    const chip = buildChip();
    const uniforms = strokeMeshes(chip)[0].material.uniforms;
    chip.setEngraving([1, 1, 1, 1], -Infinity);
    expect(uniforms.uFrontAge.value).toBe(CHIP_LOOK.engraving.cool);
    chip.setEngraving([1, 1, 1, 1], 3);
    expect(uniforms.uFrontAge.value).toBe(CHIP_LOOK.engraving.cool);
    chip.setEngraving(engraved(ON_STROKES, 0.4), 1.5);
    expect(uniforms.uFrontAge.value).toBe(0);
    chip.dispose();
  });

  it('frees its materials as well as its geometries', () => {
    const chip = buildChip();
    const spies = drawn(chip.group).map((o) => vi.spyOn(o.material as THREE.Material, 'dispose'));
    expect(spies.length).toBe(2 + ON_STROKES.length);
    chip.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('the traces', () => {
  const positions = (traces: ReturnType<typeof buildTraces>) => traces.lines.geometry.getAttribute('position').array as Float32Array;

  it('writes every trace as 47 segments, point k to point k + 1, through tracePoints', () => {
    const traces = buildTraces();
    expect(traces.lines.name).toBe('traces:lines');
    expect(traces.lines).toBeInstanceOf(THREE.LineSegments);
    traces.setT(0.37);
    const path = new Float32Array(TRACE.points * 3);
    for (const i of [0, 21, 63]) {
      tracePoints(i, 0.37, path);
      for (const k of [0, 23, 46]) {
        const vertex = (i * (TRACE.points - 1) + k) * 2;
        expect(Array.from(positions(traces).slice(vertex * 3, vertex * 3 + 6))).toEqual(Array.from(path.slice(k * 3, k * 3 + 6)));
      }
    }
    traces.dispose();
  });

  it('keeps every pose inside its bounds, and uploads the buffer only when t moves', () => {
    const traces = buildTraces();
    const sphere = traces.lines.geometry.boundingSphere!;
    const point = new THREE.Vector3();
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      traces.setT(t);
      const array = positions(traces);
      for (let v = 0; v < array.length; v += 3) expect(sphere.containsPoint(point.fromArray(array, v))).toBe(true);
    }
    const attribute = traces.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const version = attribute.version;
    traces.setT(1);
    expect(attribute.version).toBe(version);
    traces.setT(0.5);
    expect(attribute.version).toBeGreaterThan(version);
    traces.dispose();
  });

  it('glows from dark brass to a dim amber that never blooms', () => {
    const traces = buildTraces();
    const material = traces.lines.material as THREE.LineBasicMaterial;
    const rest = new THREE.Color(TRACES_LOOK.rest.colour).multiplyScalar(TRACES_LOOK.rest.level);
    const lit = new THREE.Color(TRACES_LOOK.lit.colour).multiplyScalar(TRACES_LOOK.lit.level);
    expect(material.color.equals(rest)).toBe(true);
    traces.setGlow(1);
    expect(material.color.equals(lit)).toBe(true);
    expect(luminance(material.color)).toBeLessThan(1);
    traces.setGlow(0.5);
    expect(luminance(material.color)).toBeGreaterThan(luminance(rest));
    expect(luminance(material.color)).toBeLessThan(luminance(lit));
    traces.setGlow(4);
    expect(material.color.equals(lit)).toBe(true);
    traces.setGlow(Number.NaN);
    expect(material.color.equals(rest)).toBe(true);
    traces.dispose();
  });

  it('frees its buffer and its material', () => {
    const traces = buildTraces();
    const geometry = vi.spyOn(traces.lines.geometry, 'dispose');
    const material = vi.spyOn(traces.lines.material as THREE.Material, 'dispose');
    traces.dispose();
    expect(geometry).toHaveBeenCalled();
    expect(material).toHaveBeenCalled();
  });
});

describe('the laser', () => {
  const named = <T extends THREE.Object3D>(laser: ReturnType<typeof buildLaser>, name: string): T => {
    const found = laser.group.getObjectByName(name);
    expect(found, name).toBeDefined();
    return found as T;
  };
  const sparkPositions = (laser: ReturnType<typeof buildLaser>) =>
    Array.from(named<THREE.Points>(laser, 'laser:sparks').geometry.getAttribute('position').array as Float32Array);
  const sparkColours = (laser: ReturnType<typeof buildLaser>) =>
    Array.from(named<THREE.Points>(laser, 'laser:sparks').geometry.getAttribute('color').array as Float32Array);

  it('puts the beam from the nozzle down to the point on the chip top at the tip', () => {
    const laser = buildLaser();
    laser.setTip(0.05, -0.03);
    laser.group.updateMatrixWorld(true);
    const beam = named<THREE.Mesh>(laser, 'laser:beam');
    beam.geometry.computeBoundingBox();
    const box = beam.geometry.boundingBox!.clone().applyMatrix4(beam.matrixWorld);
    const centre = box.getCenter(new THREE.Vector3());
    expect(centre.x).toBeCloseTo(0.05, 6);
    expect(centre.z).toBeCloseTo(-0.03, 6);
    expect(box.min.y).toBeCloseTo(TOP, 6);
    const probe = named<THREE.Mesh>(laser, 'laser:probe');
    expect(box.max.y).toBeCloseTo(probe.getWorldPosition(new THREE.Vector3()).y, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(LASER_LOOK.probe.gap, 6);
    // A thin beam: under a hundredth of the gap across.
    expect(box.max.x - box.min.x).toBeLessThan(LASER_LOOK.probe.gap / 50);
    laser.setTip(Number.NaN, Infinity);
    expect(laser.group.position.x).toBe(0.05);
    expect(laser.group.position.z).toBe(-0.03);
    laser.dispose();
  });

  it('turns off the beam, the point, the sparks and the smoke, and leaves the probe', () => {
    const laser = buildLaser();
    const parts = ['laser:beam', 'laser:point', 'laser:sparks', 'laser:smoke'].map((name) => named(laser, name));
    laser.setOn(false);
    expect(parts.map((part) => part.visible)).toEqual([false, false, false, false]);
    expect(named(laser, 'laser:probe').visible).toBe(true);
    laser.setOn(true);
    expect(parts.map((part) => part.visible)).toEqual([true, true, true, true]);
    laser.dispose();
  });

  it('flies at most 24 sparks, as many as the intensity asks, and thickens the smoke with it', () => {
    const laser = buildLaser();
    const sparks = named<THREE.Points>(laser, 'laser:sparks');
    const smoke = named<THREE.Sprite>(laser, 'laser:smoke');
    expect(sparks.geometry.getAttribute('position').count).toBe(24);
    expect(sparks.geometry.drawRange.count).toBe(0);
    laser.setSparks(0.5, 1);
    expect(sparks.geometry.drawRange.count).toBe(12);
    expect(smoke.material.opacity).toBeCloseTo(LASER_LOOK.smoke.opacity / 2, 9);
    laser.setSparks(3, 1);
    expect(sparks.geometry.drawRange.count).toBe(24);
    laser.setSparks(Number.NaN, 1);
    expect(sparks.geometry.drawRange.count).toBe(0);
    expect(smoke.material.opacity).toBe(0);
    laser.dispose();
  });

  it('flies the sparks from the time alone, never from Math.random, inside their bounds and over the top', () => {
    const a = buildLaser();
    const b = buildLaser();
    // Building does call it (three gives every object a random uuid); a frame must not.
    const random = vi.spyOn(Math, 'random');
    a.setSparks(1, 2.345);
    b.setSparks(1, 7);
    b.setSparks(1, 2.345);
    expect(sparkPositions(a)).toEqual(sparkPositions(b));
    expect(sparkColours(a)).toEqual(sparkColours(b));
    b.setSparks(1, 2.4);
    expect(sparkPositions(b)).not.toEqual(sparkPositions(a));
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    const sphere = named<THREE.Points>(a, 'laser:sparks').geometry.boundingSphere!;
    const point = new THREE.Vector3();
    for (const time of [0, 0.05, 0.13, 0.29, 1.7, 40.2]) {
      a.setSparks(1, time);
      const positions = sparkPositions(a);
      for (let v = 0; v < positions.length; v += 3) {
        expect(sphere.containsPoint(point.fromArray(positions, v))).toBe(true);
        expect(positions[v + 1]).toBeGreaterThanOrEqual(LASER_LOOK.sparks.floor);
      }
    }
    a.dispose();
    b.dispose();
  });

  it('lets each spark live 0.3 s: born at the tip at full glow, faded to nothing as it dies, then born again', () => {
    const laser = buildLaser();
    const hot = new THREE.Color(LASER_LOOK.colour).multiplyScalar(LASER_LOOK.sparks.glow);
    const atTip = () => {
      const [x, y, z] = sparkPositions(laser);
      expect(Math.hypot(x, z)).toBe(0);
      expect(y).toBeCloseTo(LASER_LOOK.sparks.floor, 6);
    };
    // Spark 0 is born on every whole round of 0.3 s.
    laser.setSparks(1, 0);
    atTip();
    expect(sparkColours(laser)[0]).toBeCloseTo(hot.r, 5);
    laser.setSparks(1, 0.2999);
    const dying = sparkPositions(laser).slice(0, 3);
    expect(Math.hypot(dying[0], dying[2])).toBeGreaterThan(0.05);
    expect(sparkColours(laser)[0]).toBeLessThan(1e-4);
    laser.setSparks(1, 0.3);
    atTip();
    laser.dispose();
  });

  it('frees every geometry, material and texture it made, and not the sprites shared quad', () => {
    const laser = buildLaser();
    const parts = drawn(laser.group);
    const geometries = parts.filter((o) => !(o as THREE.Sprite).isSprite).map((o) => vi.spyOn(o.geometry, 'dispose'));
    const materials = parts.map((o) => vi.spyOn(o.material as THREE.Material, 'dispose'));
    const textures = new Set<THREE.Texture>();
    for (const o of parts) {
      const map = (o.material as THREE.SpriteMaterial).map;
      if (map) textures.add(map);
    }
    const textureSpies = [...textures].map((texture) => vi.spyOn(texture, 'dispose'));
    const shared = vi.spyOn(named<THREE.Sprite>(laser, 'laser:smoke').geometry, 'dispose');
    expect(geometries).toHaveLength(3);
    expect(materials).toHaveLength(5);
    expect(textureSpies).toHaveLength(2);
    laser.dispose();
    for (const spy of [...geometries, ...materials, ...textureSpies]) expect(spy).toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
  });
});
