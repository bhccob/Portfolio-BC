/**
 * The loader's laser probe as three.js objects: the slim brass probe that
 * comes down from above and engraves the name, with a warm light and a bright
 * point at its tip while it cuts, a few small sparks and a wisp of smoke (spec
 * §2.1). It ports v3's laser (milestone 2's build/laser.ts) to the metre
 * world of the Blender preview (tools/blender/bob_animate.py, `bob_probe`): a
 * 9 m shaft on a 0.22 taper, its tip nearly touching the glass as it cuts. No
 * React: the Opening (src/scene/bob/Opening.tsx) mounts the group and moves it
 * along ~/engine/bob/probePath's `probeAt`.
 *
 * The group stands at the tip, so `setTip` moves one position. What lights the
 * cut (the point, the sparks and the wisp) stands on the glass under the tip,
 * the plane y = 0 of the frame the group is in, and the beam spans the gap
 * between the two. The sparks are computed from the time alone, never from
 * Math.random, so a still of the same moment is the same picture every time.
 */
import * as THREE from 'three';
import { glowTexture, smokeTexture } from '~/engine/studio/noise';
import { palette } from '~/engine/palette';

/**
 * How the probe looks and moves, in metres, seconds and multiples of a palette
 * colour in linear light. The point, the sparks and the wisp are v3's
 * LASER_LOOK four times over (their lengths and the sparks' speeds and
 * gravity, so each spark flies the same arc four times as large in the same
 * 0.3 s); the probe is the preview's; glows, counts and times are v3's.
 *
 * - `body`: the profile the probe is turned from (radius, height above the
 *   tip): a cone from 0.003 at the tip to the shaft's 0.018 at 0.22, then the
 *   9 m shaft (the preview's `bob_probe`). Brass, with a little light of its
 *   own (`emissive`, of the brass) so the metal still reads in the dark.
 * - `beam`: its radius and glow; it runs from the tip down to the glass.
 * - `nozzle`: the hot amber glow at the tip while it cuts (the preview's
 *   emissive `bob_probe_tip`, 0.028 across).
 * - `point`: the glow at the cut, its size and its lift off the glass; its
 *   amber is taken `whiten` of the way to cream (`core`), the white-hot heart.
 * - `sparks`: at most `max` at once, each living `life` seconds, flung out at
 *   `out` and up at `up` (ranges, metres a second), pulled down by `gravity`,
 *   never below `floor` over the glass; `size` is PointsMaterial's.
 * - `smoke`: one soft sprite rising `rise` over the cut, faint: the dim lilac
 *   darkened by `shade`, so it reads as the scene's violet haze.
 * - `light`: the warm point light `y` above the tip (the preview's
 *   `bob_probe_light`), the amber `whiten` of the way to cream, at `intensity`
 *   while cutting and 0 otherwise, reaching `distance` with three's physical
 *   `decay`.
 */
export const PROBE_LOOK = {
  colour: palette.amber,
  body: {
    profile: [
      [0, 0],
      [0.003, 0],
      [0.018, 0.22],
      [0.018, 9.22],
      [0, 9.22]
    ],
    segments: 24,
    colour: palette.brass,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0.08
  },
  beam: { radius: 0.0011, glow: 3 },
  nozzle: { size: 0.028, glow: 1.4 },
  point: { size: 0.14, lift: 0.032, glow: 4, core: palette.cream, whiten: 0.35 },
  sparks: { max: 24, life: 0.3, out: [1, 2.4], up: [0.6, 1.8], gravity: 8.8, floor: 0.008, size: 0.056, glow: 3 },
  smoke: { size: 0.4, rise: 0.14, opacity: 0.22, colour: palette.dim, shade: 0.45, turn: 0.4 },
  light: { y: 0.04, intensity: 1.5, distance: 3, decay: 2, whiten: 0.35 }
} as const;

/**
 * The probe group's draw order: after the glass (GLASS_RENDER_ORDER, -5) and
 * the engraving (0), so the beam, the point and the sparks always add their
 * light on top of the cut, and before the smoke (SMOKE_RENDER_ORDER, 2): v3's
 * laser order.
 */
export const PROBE_RENDER_ORDER = 1;

/** The probe as the scene holds it. */
export interface ProbeModel {
  /**
   * `probe`, standing at the tip: the `probe:body`, the tip's glow
   * `probe:nozzle` and its `probe:light`, and on the glass under it
   * (`probe:cut`) the `probe:beam`, the `probe:point`, the `probe:sparks` and
   * the wisp `probe:smoke`.
   */
  group: THREE.Group;
  /** Puts the tip at (x, y, z), `y` its height over the glass; a coordinate that is not finite is ignored. */
  setTip(x: number, y: number, z: number): void;
  /**
   * Turns the cutting on or off: off hides the beam, the tip's glow, the
   * point, the sparks and the wisp, puts the light out, and leaves the probe.
   *
   * The light stays in the scene at intensity 0 rather than hiding (Ruling
   * 15): a light that came and went would change the number of lights, and so
   * every lit material's program, at each cut's start and end.
   */
  setOn(on: boolean): void;
  /**
   * Shows or hides the probe's shaft (`probe:body`), which builds shown: the Opening hides it once the probe has
   * left the picture, as a parked probe can still hang into a far camera's frame. The light is the group's own child,
   * not the shaft's, so it stays in the scene either way (Ruling 15); the rest of the probe goes dark through `setOn`.
   */
  setShown(shown: boolean): void;
  /** How hard it cuts, 0..1 (how many of the sparks fly, and how thick the wisp), at `time` seconds. */
  setSparks(intensity: number, time: number): void;
  /** Frees every geometry, material and texture the probe made, and its light. */
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
 * cut) and `colours` (its glow, fading with age). Spark `k` lives in rounds of
 * `life` seconds, offset by `k / max` of a round so their ages are spread
 * evenly; round `n` of spark `k` flies in its own direction (`hash`), out and
 * up, and falls under gravity, held at `floor` over the glass so it skitters
 * across it rather than through it.
 */
function sparksAt(time: number, positions: Float32Array, colours: Float32Array, hot: THREE.Color): void {
  const { max, life, out, up, gravity, floor, glow } = PROBE_LOOK.sparks;
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

/** The shortest beam: a tip on the glass leaves no gap, and a beam of no length would have no matrix to invert. */
const NO_GAP = 1e-4;

/**
 * Builds the probe with its tip at the origin, on, with no sparks drawn yet.
 * The parts that light the cut stand in `probe:cut`, a plain Object3D: three
 * sorts a draw by the nearest Group above it, and a Group there would lose
 * the probe's render order.
 */
export function buildProbe(): ProbeModel {
  const look = PROBE_LOOK;
  const group = new THREE.Group();
  group.name = 'probe';
  // three sorts see-through objects back to front by their centres, and the engraving is often nearer the camera
  // than the tip, so it would be drawn after the additive point and sparks and wipe their glow along the cut. The
  // group's renderOrder sorts all it holds as one, after the engraving's 0.
  group.renderOrder = PROBE_RENDER_ORDER;
  const hot = new THREE.Color(look.colour);
  const cream = new THREE.Color(look.point.core);

  const bodyGeometry = new THREE.LatheGeometry(
    look.body.profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    look.body.segments
  );
  // three's lathe leaves the last point's normal as long as the profile's last step.
  bodyGeometry.normalizeNormals();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    name: 'probe:body',
    color: look.body.colour,
    metalness: look.body.metalness,
    roughness: look.body.roughness,
    emissive: look.body.colour,
    emissiveIntensity: look.body.emissive
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.name = 'probe:body';

  const glow = glowTexture(32);
  const nozzleMaterial = new THREE.SpriteMaterial({
    name: 'probe:nozzle',
    map: glow,
    color: hot.clone().multiplyScalar(look.nozzle.glow),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const nozzle = new THREE.Sprite(nozzleMaterial);
  nozzle.name = 'probe:nozzle';
  nozzle.scale.set(look.nozzle.size, look.nozzle.size, 1);

  const light = new THREE.PointLight(hot.clone().lerp(cream, look.light.whiten), look.light.intensity, look.light.distance, look.light.decay);
  light.name = 'probe:light';
  light.position.y = look.light.y;

  const cut = new THREE.Object3D();
  cut.name = 'probe:cut';

  // A unit beam standing on the glass, scaled to the gap by setTip.
  const beamGeometry = new THREE.CylinderGeometry(look.beam.radius, look.beam.radius, 1, 8, 1, true);
  beamGeometry.translate(0, 0.5, 0);
  const beamMaterial = new THREE.MeshBasicMaterial({
    name: 'probe:beam',
    color: hot.clone().multiplyScalar(look.beam.glow),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.name = 'probe:beam';

  const pointMaterial = new THREE.SpriteMaterial({
    name: 'probe:point',
    map: glow,
    color: hot.clone().lerp(cream, look.point.whiten).multiplyScalar(look.point.glow),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const point = new THREE.Sprite(pointMaterial);
  point.name = 'probe:point';
  point.scale.set(look.point.size, look.point.size, 1);
  point.position.y = look.point.lift;

  const { sparks: sparkLook } = look;
  const sparkPositions = new Float32Array(sparkLook.max * 3);
  const sparkColours = new Float32Array(sparkLook.max * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const colourAttribute = new THREE.BufferAttribute(sparkColours, 3).setUsage(THREE.DynamicDrawUsage);
  sparkGeometry.setAttribute('position', positionAttribute);
  sparkGeometry.setAttribute('color', colourAttribute);
  // The farthest a spark gets from the cut in its life, so the bounds never need recomputing.
  sparkGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(sparkLook.out[1], sparkLook.up[1]) * sparkLook.life);
  sparkGeometry.setDrawRange(0, 0);
  const sparkMaterial = new THREE.PointsMaterial({
    name: 'probe:sparks',
    size: sparkLook.size,
    map: glow,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = 'probe:sparks';

  const smokeMap = smokeTexture(64, 33);
  const { smoke: smokeLook } = look;
  const smokeMaterial = new THREE.SpriteMaterial({
    name: 'probe:smoke',
    map: smokeMap,
    color: new THREE.Color(smokeLook.colour).multiplyScalar(smokeLook.shade),
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const smoke = new THREE.Sprite(smokeMaterial);
  smoke.name = 'probe:smoke';
  smoke.scale.set(smokeLook.size, smokeLook.size, 1);
  smoke.position.y = smokeLook.rise;

  cut.add(beam, point, sparks, smoke);
  group.add(body, nozzle, light, cut);

  const model: ProbeModel = {
    group,
    setTip(x, y, z) {
      if (Number.isFinite(x)) group.position.x = x;
      if (Number.isFinite(y)) group.position.y = y;
      if (Number.isFinite(z)) group.position.z = z;
      const gap = Math.max(0, group.position.y);
      cut.position.y = -gap;
      beam.scale.y = Math.max(gap, NO_GAP);
    },
    setOn(on) {
      beam.visible = on;
      nozzle.visible = on;
      point.visible = on;
      sparks.visible = on;
      smoke.visible = on;
      light.intensity = on ? look.light.intensity : 0;
    },
    setShown(shown) {
      body.visible = shown;
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
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
      nozzleMaterial.dispose();
      pointMaterial.dispose();
      sparkGeometry.dispose();
      sparkMaterial.dispose();
      smokeMaterial.dispose();
      glow.dispose();
      smokeMap.dispose();
      light.dispose();
      // The sprites' quad is three's own, shared by every sprite, and is not ours to free.
    }
  };
  model.setTip(0, 0, 0);
  model.setOn(true);
  return model;
}
