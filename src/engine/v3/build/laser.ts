/**
 * The loader's laser as three.js objects: a slim gold probe over the chip, the
 * thin beam from its nozzle to the chip's top, the bright point where it cuts,
 * a few sparks and a wisp of smoke (spec §2.1, frame 01). No React: Task 12a
 * mounts the group and drives it from the loader's clock, the tip following
 * the stroke being cut.
 *
 * Everything is placed relative to the tip: the group stands on the chip's top
 * at the tip's x and z, so `setTip` moves one position. The sparks are
 * computed from the time alone, never from Math.random, so a still of the same
 * moment is the same picture every time.
 */
import * as THREE from 'three';
import { glowTexture, smokeTexture } from '~/engine/studio/noise';
import { palette } from '~/engine/palette';
import { CHIP } from '~/engine/v3/chipSpec';

/**
 * How the laser looks and moves, in world units, seconds and multiples of a
 * colour in linear light (the scene's bloom starts at a luminance of 1; the
 * hot amber has about 0.35 per unit). Only the point blooms clearly: it is the
 * strongest light in the loader. The beam reaches just past the threshold, a
 * fine bright thread, and the sparks are small and short-lived.
 *
 * - `probe`: the nozzle's height over the chip's top, and the profile it is
 *   turned from (radius, height above the nozzle's tip), slim and gold.
 * - `beam`: its radius and glow.
 * - `point`: the glow at the cut, its size and its lift off the top, so the
 *   chip's face does not clip its lower half.
 * - `sparks`: at most `max` at once, each living `life` seconds, flung out
 *   at `out` and up at `up` (ranges), pulled down by `gravity`, never below
 *   `floor` over the top; `size` is PointsMaterial's (world size times half
 *   the buffer's height over depth, about 5 px at the loader's macro shot).
 * - `smoke`: one soft sprite rising `rise` over the tip, faint and grey-violet.
 */
export const LASER_LOOK = {
  colour: 0xff7a1e,
  probe: {
    gap: 0.13,
    profile: [
      [0, 0],
      [0.0025, 0],
      [0.006, 0.012],
      [0.0105, 0.026],
      [0.0105, 0.05],
      [0.014, 0.054],
      [0.014, 0.075],
      [0.0115, 0.079],
      [0.0115, 0.32]
    ],
    metalness: 1,
    roughness: 0.32
  },
  beam: { radius: 0.0011, glow: 3 },
  point: { size: 0.035, lift: 0.008, glow: 4 },
  sparks: { max: 24, life: 0.3, out: [0.25, 0.6], up: [0.15, 0.45], gravity: 2.2, floor: 0.002, size: 0.014, glow: 3 },
  smoke: { size: 0.1, rise: 0.035, opacity: 0.22, colour: 0x6b5a66, turn: 0.4 }
} as const;

/** The laser as the scene holds it. */
export interface LaserModel {
  /** The probe, the beam (`laser:beam`), the point, the sparks and the smoke; it stands on the chip's top at the tip. */
  group: THREE.Group;
  /** Puts the beam's point on the chip's top at (x, z); a coordinate that is not finite is ignored. */
  setTip(x: number, z: number): void;
  /** Turns the laser on or off: off hides the beam, the point, the sparks and the smoke, and leaves the probe. */
  setOn(on: boolean): void;
  /** How hard it cuts, 0..1 (how many of the sparks fly, and how thick the smoke), at `time` seconds. */
  setSparks(intensity: number, time: number): void;
  /** Frees every geometry, material and texture the laser made. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * A number in [0, 1) from two integers, the same every time: an integer hash
 * (murmur3's finaliser over the pair), so each spark of each round gets its
 * own fixed direction and speed without a random source.
 */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Where every spark is at `time`, written into `positions` (x, y, z from the
 * tip) and `colours` (its glow, fading with age). Spark `k` lives in rounds of
 * `life` seconds, offset by `k / max` of a round so their ages are spread
 * evenly; round `n` of spark `k` flies in its own direction (`hash`), out and
 * up, and falls under gravity, held at `floor` over the chip so it skitters
 * across the top rather than through it.
 */
function sparksAt(time: number, positions: Float32Array, colours: Float32Array, hot: THREE.Color): void {
  const { max, life, out, up, gravity, floor, glow } = LASER_LOOK.sparks;
  const t = Number.isFinite(time) ? time : 0;
  for (let k = 0; k < max; k++) {
    const rounds = t / life + k / max;
    const n = Math.floor(rounds);
    const age = (rounds - n) * life;
    const angle = hash(k * 3, n) * 2 * Math.PI;
    const outward = out[0] + (out[1] - out[0]) * hash(k * 3 + 1, n);
    const upward = up[0] + (up[1] - up[0]) * hash(k * 3 + 2, n);
    positions[k * 3] = Math.cos(angle) * outward * age;
    positions[k * 3 + 1] = Math.max(floor, upward * age - 0.5 * gravity * age * age);
    positions[k * 3 + 2] = Math.sin(angle) * outward * age;
    const fade = (1 - age / life) ** 2 * glow;
    colours[k * 3] = hot.r * fade;
    colours[k * 3 + 1] = hot.g * fade;
    colours[k * 3 + 2] = hot.b * fade;
  }
}

/**
 * Builds the laser over the chip's centre, on, with no sparks drawn yet. The
 * group stands on the chip's top (`CHIP.board + CHIP.height`); lifting it
 * (`group.position.y`) lifts the probe off, as the power-on wants.
 */
export function buildLaser(): LaserModel {
  const group = new THREE.Group();
  group.name = 'laser';
  group.position.y = CHIP.board + CHIP.height;
  const hot = new THREE.Color(LASER_LOOK.colour);

  const { probe: probeLook } = LASER_LOOK;
  const probeGeometry = new THREE.LatheGeometry(
    probeLook.profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    24
  );
  const probeMaterial = new THREE.MeshStandardMaterial({
    name: 'laser:probe',
    color: palette.gold,
    metalness: probeLook.metalness,
    roughness: probeLook.roughness
  });
  const probe = new THREE.Mesh(probeGeometry, probeMaterial);
  probe.name = 'laser:probe';
  probe.position.y = probeLook.gap;

  const beamGeometry = new THREE.CylinderGeometry(LASER_LOOK.beam.radius, LASER_LOOK.beam.radius, probeLook.gap, 8, 1, true);
  beamGeometry.translate(0, probeLook.gap / 2, 0);
  const beamMaterial = new THREE.MeshBasicMaterial({
    name: 'laser:beam',
    color: hot.clone().multiplyScalar(LASER_LOOK.beam.glow),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.name = 'laser:beam';

  const glow = glowTexture(32);
  const pointMaterial = new THREE.SpriteMaterial({
    name: 'laser:point',
    map: glow,
    color: hot.clone().lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(LASER_LOOK.point.glow),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const point = new THREE.Sprite(pointMaterial);
  point.name = 'laser:point';
  point.scale.set(LASER_LOOK.point.size, LASER_LOOK.point.size, 1);
  point.position.y = LASER_LOOK.point.lift;

  const { sparks: sparkLook } = LASER_LOOK;
  const sparkPositions = new Float32Array(sparkLook.max * 3);
  const sparkColours = new Float32Array(sparkLook.max * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const colourAttribute = new THREE.BufferAttribute(sparkColours, 3).setUsage(THREE.DynamicDrawUsage);
  sparkGeometry.setAttribute('position', positionAttribute);
  sparkGeometry.setAttribute('color', colourAttribute);
  // The farthest a spark gets from the tip in its life, so the bounds never need recomputing.
  sparkGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(sparkLook.out[1], sparkLook.up[1]) * sparkLook.life);
  sparkGeometry.setDrawRange(0, 0);
  const sparkMaterial = new THREE.PointsMaterial({
    name: 'laser:sparks',
    size: sparkLook.size,
    map: glow,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = 'laser:sparks';

  const smokeMap = smokeTexture(64, 33);
  const { smoke: smokeLook } = LASER_LOOK;
  const smokeMaterial = new THREE.SpriteMaterial({
    name: 'laser:smoke',
    map: smokeMap,
    color: smokeLook.colour,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const smoke = new THREE.Sprite(smokeMaterial);
  smoke.name = 'laser:smoke';
  smoke.scale.set(smokeLook.size, smokeLook.size, 1);
  smoke.position.y = smokeLook.rise;

  group.add(probe, beam, point, sparks, smoke);

  return {
    group,
    setTip(x, z) {
      if (Number.isFinite(x)) group.position.x = x;
      if (Number.isFinite(z)) group.position.z = z;
    },
    setOn(on) {
      beam.visible = on;
      point.visible = on;
      sparks.visible = on;
      smoke.visible = on;
    },
    setSparks(intensity, time) {
      const amount = clamp01(intensity);
      sparksAt(time, sparkPositions, sparkColours, hot);
      positionAttribute.needsUpdate = true;
      colourAttribute.needsUpdate = true;
      sparkGeometry.setDrawRange(0, Math.round(sparkLook.max * amount));
      // The wisp turns slowly with the time and thins as the cutting eases off.
      smokeMaterial.opacity = smokeLook.opacity * amount;
      smokeMaterial.rotation = Number.isFinite(time) ? time * smokeLook.turn : 0;
    },
    dispose() {
      probeGeometry.dispose();
      probeMaterial.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
      pointMaterial.dispose();
      sparkGeometry.dispose();
      sparkMaterial.dispose();
      smokeMaterial.dispose();
      glow.dispose();
      smokeMap.dispose();
      // The sprites' quad is three's own, shared by every sprite, and is not ours to free.
    }
  };
}
