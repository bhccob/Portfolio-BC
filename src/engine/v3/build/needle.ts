/**
 * The v3 needle as three.js objects: a long gold lozenge on an ornate turned
 * pivot over the hub, its tip glowing faintly (spec §2.2, frame 05). Its
 * lengths are the dial's (DIAL.needle), so it reaches the hexagram ring as
 * milestone 1's did. While the loader lands it grows out of the laser's probe:
 * the slim gold spike standing over the chip swings up, lengthens and settles
 * on the pivot as the needle. No React: Task 12b turns it to the bearing the
 * aim gives.
 */
import * as THREE from 'three';
import { DIAL } from '~/engine/instrument/dialSpec';
import { palette } from '~/engine/palette';
import { LASER_LOOK } from '~/engine/v3/build/laser';
import { CHIP } from '~/engine/v3/chipSpec';
import { HUB } from '~/engine/v3/compassSpec';

/** The laser probe's length and its widest, from the profile it is turned from. */
const PROBE_PROFILE = LASER_LOOK.probe.profile;
const PROBE_LENGTH = PROBE_PROFILE[PROBE_PROFILE.length - 1][1];
const PROBE_WIDTH = 2 * Math.max(...PROBE_PROFILE.map(([radius]) => radius));

/** Where the probe's nozzle points from: its gap over the chip's top. */
const NOZZLE = CHIP.board + CHIP.height + LASER_LOOK.probe.gap;

/**
 * How the needle looks.
 *
 * - `pivot`: the height of the needle's centre line at home, just clear of
 *   the hub's top (HUB.y) under its cap and of the rings' glass under its
 *   blade.
 * - `roughness` and `emissive`: one gold for the blade and the pivot, metal,
 *   lit by the room. Rough enough that a light behind the compass glinting
 *   off a flat facet (the home's low camera looks along the blade toward the
 *   rim light) spreads into a sheen instead of flooding the facet; and a
 *   little light of its own, as the compass's gold has, for a needle lying
 *   flat mostly mirrors the room's dark horizon and would read as black.
 * - `tip`: the glow at the very point, as a multiple of the gold (about 0.67
 *   in luminance, under the bloom's threshold of 1 before the light on the
 *   metal), rising from nothing at `from` of the way along the tip half: a
 *   warm point, not a lamp.
 * - `cap`: the pivot's profile (radius, height about the centre line): a
 *   collar of beads round the blade's root and a finial over it, wider than
 *   the blade so the blade seems to pass through it.
 * - `probe`: the pose the needle grows from, the laser's probe as it stands
 *   (LASER_LOOK): its top `top` over the board, `length` long and `width`
 *   across, pointing down at the chip, with the cap at `cap` of its size.
 */
export const NEEDLE_LOOK = {
  pivot: HUB.y + 0.032,
  colour: palette.gold,
  metalness: 1,
  roughness: 0.4,
  emissive: 0.1,
  tip: { glow: 1.6, from: 0.7 },
  cap: [
    [0, -0.03],
    [0.02, -0.03],
    [0.031, -0.024],
    [0.035, -0.014],
    [0.031, -0.008],
    [0.035, -0.002],
    [0.035, 0.004],
    [0.031, 0.01],
    [0.035, 0.016],
    [0.028, 0.026],
    [0.016, 0.034],
    [0.009, 0.046],
    [0.005, 0.058],
    [0, 0.066]
  ] as readonly (readonly [radius: number, height: number])[],
  probe: { top: NOZZLE + PROBE_LENGTH, length: PROBE_LENGTH, width: PROBE_WIDTH, cap: 0.45 }
} as const;

/** The needle as the scene holds it. */
export interface NeedleModel {
  /**
   * `needle`: its origin is the pivot on the compass's axis. It holds the
   * blade (`needle:blade`, with the halves `needle:tip` and `needle:tail`)
   * and the cap (`needle:pivot`).
   */
  group: THREE.Group;
  /** Points the tip at a bearing in radians, clockwise from north (the dial's frame); one that is not finite is ignored. */
  setBearing(rad: number): void;
  /**
   * Grows the needle out of the laser's probe, 0..1 (NaN reads as 0): 0 is
   * the probe standing on its nozzle over the chip, pointing down; 1 is the
   * needle on its pivot. Its tip stays at or over the nozzle all the way, so
   * it never cuts into the chip.
   */
  setForm(t: number): void;
  /**
   * The tip's glow as a share of its own, 1 as built (NaN reads as 1, and none is below 0): the home's idle motion
   * breathes it (src/scene/v3/homePose.ts, ±10 % over 4 s). The form still scales it, so the probe never glows.
   */
  setTipGlow(share: number): void;
  /** Frees the three geometries and the material. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** From `a` at 0 to `b` at 1, exact at both ends. */
function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

/**
 * One half of the lozenge: four flat faces from the apex at `z` to the
 * diamond round the pivot (half-width w, half-height h), wound to face out.
 * Flat shaded, so each face catches the light as one facet.
 */
function half(z: number, w: number, h: number): THREE.BufferGeometry {
  const apex = [0, 0, z];
  const ring = [
    [0, h, 0],
    [w, 0, 0],
    [0, -h, 0],
    [-w, 0, 0]
  ];
  const faces: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    // The tail half takes each pair the other way round, so both halves' faces look outward.
    faces.push(...apex, ...(z < 0 ? a : b), ...(z < 0 ? b : a));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The tip's glow, in the emitted light: `vNeedleAlong` runs from 0 at the
 * pivot to 1 at the point along the tip half (the tail and the cap stay at or
 * under 0, so they never glow), and the gold glows by `uTipGlow` from
 * `uTipFrom` of the way out to the point.
 */
function tipGlow(uniforms: { uTipGlow: THREE.IUniform<number>; uTipFrom: THREE.IUniform<number> }) {
  const tip = DIAL.needle.tip.toFixed(4);
  return (shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): void => {
    shader.uniforms.uTipGlow = uniforms.uTipGlow;
    shader.uniforms.uTipFrom = uniforms.uTipFrom;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vNeedleAlong;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n\tvNeedleAlong = -position.z / ${tip};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTipGlow;\nuniform float uTipFrom;\nvarying float vNeedleAlong;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uTipGlow * smoothstep( uTipFrom, 1.0, vNeedleAlong );'
      );
  };
}

/**
 * Builds the needle formed, pointing north, on its pivot over the hub. It is
 * built pointing at -Z (north) and turned about its pivot by
 * `rotation.y = -bearing`, which puts the tip at (sin b, -cos b) as the dial
 * frame has it.
 */
export function buildNeedle(): NeedleModel {
  const { tip, tail, width, height } = DIAL.needle;
  const look = NEEDLE_LOOK;
  const group = new THREE.Group();
  group.name = 'needle';

  const uniforms = { uTipGlow: { value: 0 }, uTipFrom: { value: look.tip.from } };
  const material = new THREE.MeshStandardMaterial({
    name: 'needle',
    color: look.colour,
    metalness: look.metalness,
    roughness: look.roughness,
    emissive: look.colour,
    emissiveIntensity: look.emissive
  });
  material.onBeforeCompile = tipGlow(uniforms);
  material.customProgramCacheKey = () => 'needle';

  // The blade pitches about the pivot as it grows; the cap stays upright round it.
  const blade = new THREE.Object3D();
  blade.name = 'needle:blade';
  const tipHalf = new THREE.Mesh(half(-tip, width / 2, height / 2), material);
  tipHalf.name = 'needle:tip';
  const tailHalf = new THREE.Mesh(half(tail, width / 2, height / 2), material);
  tailHalf.name = 'needle:tail';
  blade.add(tipHalf, tailHalf);

  const capGeometry = new THREE.LatheGeometry(
    look.cap.map(([radius, y]) => new THREE.Vector2(radius, y)),
    48
  );
  capGeometry.normalizeNormals();
  const cap = new THREE.Mesh(capGeometry, material);
  cap.name = 'needle:pivot';
  group.add(blade, cap);

  /** How far the needle has grown (the pose's `late`), and the tip's breath, which the tip's glow is the product of. */
  let grown = 1;
  let breath = 1;
  const glow = (): void => {
    uniforms.uTipGlow.value = look.tip.glow * grown * breath;
  };

  /**
   * The pose at form `t`. On an eased `s`, the blade swings up from pointing
   * down early (its pitch falls with (1 - s)^2), while the pivot sinks and the
   * blade lengthens late (with s^2): so the tip, which starts on the nozzle,
   * only ever rises from it, and the tail grows out once the blade is nearly
   * level.
   */
  const pose = (t: number): void => {
    const f = clamp01(t);
    const s = f * f * (3 - 2 * f);
    const late = s * s;
    group.position.y = mix(look.probe.top, look.pivot, late);
    blade.rotation.x = -(Math.PI / 2) * (1 - s) * (1 - s);
    const across = mix(look.probe.width / width, 1, s);
    tipHalf.scale.set(across, across, mix(look.probe.length / tip, 1, late));
    // Never a zero scale: its normal matrix would be singular.
    tailHalf.scale.set(across, across, Math.max(late, 1e-4));
    tailHalf.visible = late > 0;
    cap.scale.setScalar(mix(look.probe.cap, 1, s));
    grown = late;
    glow();
  };
  pose(1);

  return {
    group,
    setBearing(rad) {
      if (Number.isFinite(rad)) group.rotation.y = -rad;
    },
    setForm: pose,
    setTipGlow(share) {
      breath = Number.isNaN(share) ? 1 : Math.max(0, share);
      glow();
    },
    dispose() {
      tipHalf.geometry.dispose();
      tailHalf.geometry.dispose();
      capGeometry.dispose();
      material.dispose();
    }
  };
}
