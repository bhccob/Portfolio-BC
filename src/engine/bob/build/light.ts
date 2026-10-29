/**
 * The falling light as one three.js object, a signal on a chip (spec 2026-10-29-bob-stack-2-design.md, goal 4: "give the
 * light a better design in general and also the trail like it belongs to the tech domain"; the fall mock-up Bob chose,
 * `circuit`): a hot point inside a small square frame with corner brackets and pins on each side, turning slowly, and a
 * fine dial of ticks round it; its trail five circuit traces routed beside its way (src/scene/bob/circuit.ts), straight
 * runs that jog at 45°, a via at each jog's end, bright pulses running down them into the light. Gold only: the palette's
 * gold and gold light, strong enough that the tone mapping and the bloom whiten the hot point. No React: the Void poses it
 * from the journey each frame.
 *
 * Nothing in it writes depth or takes a ray: it is light added to what is behind (additive), so it never hides a project
 * and the pointer picks through it. Its body is in the light's own units, the frame's half-width 1, posed by `setPose` to
 * the light's place and size, facing the camera; the traces are in the world, laid in place each frame from the
 * journey's trail. The lamp stands apart from the body and is never hidden, only dimmed, so the scene's light count stays
 * the same from the first frame to the last (three compiles every lit material for it).
 */
import * as THREE from 'three';
import { clamp01 } from '~/engine/bob/build/haze';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { circuitLanes, LANES, MOCK_HALF } from '~/scene/bob/circuit';
import type { LightPose } from '~/scene/bob/journey';

/** The mock-up's metres in the light's own units (its frame's half-width, 0.62 m there). */
const M = 1 / MOCK_HALF;

/**
 * How the light looks, in its own units (the frame's half-width 1), the mock-up's sizes over its 0.62 m, in the glow
 * Bob picked (spec 2026-10-29-bob-stack-3-design.md, goal 3, "B · Glow": the site's deep gold, not the pale gold light):
 * - `core`: the hot point, a sprite `size` across in gold times `gain`, `level` its strength;
 * - `halo`: a soft sprite `size` across in gold, breathing a little;
 * - `aura`: a wide soft glow round it all, `size` across in gold at `level`, breathing slowly at `breathe` rad/s;
 * - `frame`: corner brackets `corner` long at the half-width 1, five pins a side `pin` apart from `pinFrom` to `pinTo`
 *   out, a faint square `inner` across inside; its lines gold times `gain`, so they glow; turning `turn` rad/s;
 * - `dial`: 72 ticks at `radius`, every `long`th longer, and a dashed ring at `dash`, 9 of every 12 of 96; gold times
 *   `gain`; turning `turn`;
 * - `traces`: the lanes' gold, their pulses gold light times `hotGain`, each lane's light (the middle full), at most
 *   `capacity` points a lane;
 * - `vias`: a small ring with a dot, `size` (and four times a lane's width more) across in the mock-up's metres, at most
 *   `most` a lane;
 * - `lamp`: a point light in gold, `distance` its reach;
 * - `stretch`: drawn out along its axis as it becomes the needle (`along` times its stretch), thinned `across` times it.
 */
export const LIGHT_LOOK = {
  core: { size: 2.6 * M, colour: palette.gold, gain: 3.8, level: 1 },
  halo: { size: 4.2 * M * 1.5, colour: palette.gold, level: 0.95 },
  aura: { size: 4.2 * M * 3.4, colour: palette.gold, level: 0.34, breathe: 1.6 },
  frame: { corner: 0.22 * M, pin: 0.16 * M, pinFrom: 1 + 0.06 * M, pinTo: 1 + 0.2 * M, inner: 1.2, colour: palette.gold, gain: 2.2, level: 1, innerLevel: 0.1, turn: 0.35 },
  dial: { radius: 1.05 * M, long: 6, longLength: 0.14 * M, shortLength: 0.06 * M, dash: 0.94 * M, colour: palette.gold, gain: 1.8, level: 1, turn: -0.12 },
  traces: { colour: palette.gold, hot: palette.goldLight, hotGain: 2.4, levels: [1, 0.8, 0.8, 0.8, 0.8] as const, capacity: 400 },
  vias: { size: 0.12, colour: palette.goldLight, level: 0.75, most: 24 },
  lamp: { colour: palette.gold, level: 5, distance: 8 },
  stretch: { along: 3, across: 0.65 }
} as const;

/** The light as the scene holds it. */
export interface LightModel {
  /**
   * `light`: `light:body` (`light:halo`, `light:dial`, `light:frame`, `light:core`), `light:traces` (`light:trace:<k>`),
   * `light:vias` and `light:lamp`. It builds dark: the body and the traces hidden, the lamp at 0.
   */
  group: THREE.Group;
  /**
   * Poses the light at the journey's `pose` (src/scene/bob/journey.ts `LightPose`): the body at its place, `radius` in
   * size, facing the camera, drawn out along its axis by its `stretch`, every part's strength times its `glow` (at 0 the
   * body and the traces are hidden, the lamp at 0); the traces laid from its `trail` at its `trailLevel`, beside it as the
   * camera sees it. `clock` (s) turns the frame and the dial and runs the pulses.
   */
  setPose(pose: LightPose, camera: THREE.Camera, clock?: number): void;
  /** Steps the light down to `tier`'s: the low tier drops the vias, and nothing climbs back. */
  setTier(tier: QualityTier): void;
  /** Frees every geometry, material and texture the light made. */
  dispose(): void;
}

/** Nothing: the light ignores the pointer. */
function ignoreRays(object: THREE.Object3D): void {
  object.raycast = () => {};
}

/** A white texture `size` across whose alpha at each pixel is `alpha(x, y)`, x and y -1..1 from the middle. */
function made(size: number, alpha: (x: number, y: number) => number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const a = Math.min(1, Math.max(0, alpha((i / (size - 1)) * 2 - 1, (j / (size - 1)) * 2 - 1)));
      data.set([255, 255, 255, Math.round(255 * a)], (j * size + i) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Additive light that writes no depth: what every part of the light is drawn with. */
const ADDED = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false } as const;

const TRACE_VERTEX = /* glsl */ `
  attribute float aAbove;
  attribute float aSide;
  varying float vAbove;
  varying float vSide;
  void main() {
    vAbove = aAbove;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * A trace's light: gold, a little brighter down its middle, fading up the way from the light (\`uLen\`), packets of gold
 * light running down it into the light (spaced in the mock-up's metres, \`uScale\` site metres each).
 */
const TRACE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uLen;
  uniform float uScale;
  uniform float uTime;
  uniform float uLevel;
  uniform float uPhase;
  varying float vAbove;
  varying float vSide;
  void main() {
    float fade = exp(-vAbove / uLen);
    float packet = smoothstep(0.9, 1.0, fract(vAbove / uScale * 0.07 + uTime * 0.55 + uPhase));
    float edge = 1.0 - abs(vSide) * 0.5;
    vec3 c = uColor * (0.32 + 0.22 * edge) + uHot * packet * 1.8;
    gl_FragColor = vec4(c * fade * uLevel, 1.0);
  }
`;

// Scratch for the traces: nothing is made per frame.
/** The upright line the traces are laid beside: this many points from the light up. */
const UPRIGHT = 24;
const upright: { point: [number, number, number]; u: number }[] = Array.from({ length: UPRIGHT }, () => ({ point: [0, 0, 0], u: 0 }));
const toCamera = new THREE.Vector3();
const along = new THREE.Vector3();
const across = new THREE.Vector3();
const rightOf = new THREE.Vector3();

/** Builds the light for `tier`, dark. */
export function buildLight(tier: QualityTier): LightModel {
  const look = LIGHT_LOOK;
  let standing: QualityTier = tier;
  const group = new THREE.Group();
  group.name = 'light';
  const body = new THREE.Group();
  body.name = 'light:body';
  body.visible = false;
  const textures = {
    core: made(128, (x, y) => {
      const r = Math.hypot(x, y);
      return r < 0.035 ? 1 : r < 0.09 ? 1 - ((r - 0.035) / 0.055) * 0.5 : r < 0.22 ? 0.5 - ((r - 0.09) / 0.13) * 0.39 : Math.max(0, 0.11 * (1 - (r - 0.22) / 0.78));
    }),
    glow: made(64, (x, y) => Math.pow(Math.max(0, 1 - Math.hypot(x, y)), 2.4)),
    // A via: a small ring with a dot.
    via: made(64, (x, y) => {
      const r = Math.hypot(x, y);
      return Math.abs(r - 0.62) < 0.08 ? 1 : r < 0.19 ? 0.8 : 0;
    })
  };

  const coreMaterial = new THREE.SpriteMaterial({ name: 'light:core', map: textures.core, color: new THREE.Color(look.core.colour).multiplyScalar(look.core.gain), ...ADDED });
  const core = new THREE.Sprite(coreMaterial);
  core.name = 'light:core';
  core.scale.setScalar(look.core.size);
  const haloMaterial = new THREE.SpriteMaterial({ name: 'light:halo', map: textures.glow, color: look.halo.colour, ...ADDED });
  const auraMaterial = new THREE.SpriteMaterial({ name: 'light:aura', map: textures.glow, color: look.aura.colour, ...ADDED });
  const aura = new THREE.Sprite(auraMaterial);
  aura.name = 'light:aura';
  aura.scale.setScalar(look.aura.size);
  const halo = new THREE.Sprite(haloMaterial);
  halo.name = 'light:halo';
  halo.scale.setScalar(look.halo.size);

  // The frame: corner brackets, five pins a side, a faint square inside; it turns about its face.
  const frame = new THREE.Group();
  frame.name = 'light:frame';
  const strokes: number[] = [];
  const c = look.frame.corner;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ] as const) {
    strokes.push(sx, sy, 0, sx * (1 - c), sy, 0, sx, sy, 0, sx, sy * (1 - c), 0);
  }
  for (let i = -2; i <= 2; i++) {
    const t = i * look.frame.pin;
    const [a, b] = [look.frame.pinFrom, look.frame.pinTo];
    strokes.push(t, a, 0, t, b, 0, t, -a, 0, t, -b, 0, a, t, 0, b, t, 0, -a, t, 0, -b, t, 0);
  }
  const frameGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(strokes, 3));
  const frameMaterial = new THREE.LineBasicMaterial({ name: 'light:frame', color: new THREE.Color(look.frame.colour).multiplyScalar(look.frame.gain), ...ADDED });
  const frameLines = new THREE.LineSegments(frameGeometry, frameMaterial);
  frameLines.name = 'light:frame:lines';
  const innerGeometry = new THREE.PlaneGeometry(look.frame.inner, look.frame.inner);
  const innerMaterial = new THREE.MeshBasicMaterial({ name: 'light:frame:inner', color: palette.gold, ...ADDED, side: THREE.DoubleSide });
  const inner = new THREE.Mesh(innerGeometry, innerMaterial);
  inner.name = 'light:frame:inner';
  frame.add(frameLines, inner);

  // The dial: 72 ticks, every sixth longer, and a dashed ring inside them.
  const dial = new THREE.Group();
  dial.name = 'light:dial';
  const marks: number[] = [];
  const R = look.dial.radius;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const l = i % look.dial.long === 0 ? look.dial.longLength : look.dial.shortLength;
    marks.push(Math.cos(a) * R, Math.sin(a) * R, 0, Math.cos(a) * (R + l), Math.sin(a) * (R + l), 0);
  }
  for (let i = 0; i < 96; i++) {
    if (i % 12 >= 9) continue;
    const a = (i / 96) * Math.PI * 2;
    const b = ((i + 0.5) / 96) * Math.PI * 2;
    const r = look.dial.dash;
    marks.push(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(b) * r, Math.sin(b) * r, 0);
  }
  const dialGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
  const dialMaterial = new THREE.LineBasicMaterial({ name: 'light:dial', color: new THREE.Color(look.dial.colour).multiplyScalar(look.dial.gain), ...ADDED });
  dial.add(new THREE.LineSegments(dialGeometry, dialMaterial));
  body.add(aura, halo, dial, frame, core);

  // The traces: a ribbon per lane, laid in place each frame; and the vias on them.
  const traces = new THREE.Group();
  traces.name = 'light:traces';
  const cap = look.traces.capacity;
  const lanes = LANES.map((_, k) => {
    const positions = new THREE.BufferAttribute(new Float32Array(cap * 2 * 3), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    const aboves = new THREE.BufferAttribute(new Float32Array(cap * 2), 1);
    aboves.setUsage(THREE.DynamicDrawUsage);
    const sides = new THREE.BufferAttribute(new Float32Array(Array.from({ length: cap * 2 }, (_, v) => (v % 2 === 0 ? -1 : 1))), 1);
    const index: number[] = [];
    for (let i = 0; i < cap - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', positions);
    geometry.setAttribute('aAbove', aboves);
    geometry.setAttribute('aSide', sides);
    geometry.setIndex(index);
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      name: `light:trace:${k}`,
      vertexShader: TRACE_VERTEX,
      fragmentShader: TRACE_FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color(look.traces.colour) },
        uHot: { value: new THREE.Color(look.traces.hot).multiplyScalar(look.traces.hotGain) },
        uLen: { value: 1 },
        uScale: { value: 1 },
        uTime: { value: 0 },
        uLevel: { value: 0 },
        uPhase: { value: k * 0.37 }
      },
      ...ADDED,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `light:trace:${k}`;
    mesh.frustumCulled = false;
    mesh.visible = false;
    traces.add(mesh);
    return { mesh, geometry, positions, aboves, material };
  });
  const vias = new THREE.Group();
  vias.name = 'light:vias';
  const viaSprites = LANES.map(() =>
    Array.from({ length: look.vias.most }, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ name: 'light:via', map: textures.via, color: look.vias.colour, opacity: 0, ...ADDED }));
      sprite.visible = false;
      vias.add(sprite);
      return sprite;
    })
  );

  const lamp = new THREE.PointLight(look.lamp.colour, 0, look.lamp.distance, 2);
  lamp.name = 'light:lamp';
  group.add(body, traces, vias, lamp);
  group.traverse(ignoreRays);

  const hideTrail = (): void => {
    for (const lane of lanes) lane.mesh.visible = false;
    vias.visible = false;
  };

  return {
    group,
    setPose(pose, camera, clock = 0) {
      const glow = clamp01(pose.glow);
      const lit = glow > 0;
      body.visible = lit;
      lamp.position.set(pose.position[0], pose.position[1], pose.position[2]);
      lamp.intensity = look.lamp.level * glow;
      if (!lit) {
        hideTrail();
        return;
      }
      const r = Math.max(pose.radius, 1e-6);
      const s = clamp01(pose.stretch);
      body.position.set(pose.position[0], pose.position[1], pose.position[2]);
      body.quaternion.copy(camera.quaternion);
      body.scale.set(r * (1 - look.stretch.across * s), r * (1 + look.stretch.along * s), r * (1 - look.stretch.across * s));
      frame.rotation.z = clock * look.frame.turn;
      dial.rotation.z = clock * look.dial.turn;
      coreMaterial.opacity = look.core.level * glow;
      haloMaterial.opacity = look.halo.level * glow * (0.9 + 0.1 * Math.sin(clock * 4));
      auraMaterial.opacity = look.aura.level * glow * (0.92 + 0.08 * Math.sin(clock * look.aura.breathe));
      frameMaterial.opacity = look.frame.level * glow;
      innerMaterial.opacity = look.frame.innerLevel * glow;
      dialMaterial.opacity = look.dial.level * glow;

      // The traces beside the light's way as the camera sees it.
      const level = clamp01(pose.trailLevel) * glow;
      if (level <= 0 || pose.trail.length < 2) {
        hideTrail();
        return;
      }
      rightOf.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      // Straight up from the light, as tall as its tail stands above it: the traces are routed on the world's height,
      // runs and 45° jogs (the mock-up's), not along a tail that leans.
      let height = 0;
      for (const p of pose.trail) height = Math.max(height, p.point[1] - pose.position[1]);
      for (let i = 0; i < UPRIGHT; i++) {
        const u = i / (UPRIGHT - 1);
        upright[i]!.point = [pose.position[0], pose.position[1] + u * height, pose.position[2]];
        upright[i]!.u = u;
      }
      const laid = circuitLanes(upright, r, [rightOf.x, rightOf.y, rightOf.z]);
      const scale = r / MOCK_HALF;
      const showVias = standing !== 'low';
      vias.visible = showVias;
      laid.forEach((lane, k) => {
        const target = lanes[k]!;
        const n = Math.min(lane.points.length, cap);
        const out = target.positions.array as Float32Array;
        const ups = target.aboves.array as Float32Array;
        const half = lane.width / 2;
        for (let i = 0; i < n; i++) {
          const p = lane.points[i]!;
          const q = lane.points[Math.min(i + 1, n - 1)]!;
          const o = lane.points[Math.max(i - 1, 0)]!;
          along.set(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
          toCamera.set(camera.position.x - p[0], camera.position.y - p[1], camera.position.z - p[2]).normalize();
          across.crossVectors(along, toCamera).normalize().multiplyScalar(half);
          for (const [v, sign] of [
            [i * 2, -1],
            [i * 2 + 1, 1]
          ] as const) {
            out[v * 3] = p[0] + across.x * sign;
            out[v * 3 + 1] = p[1] + across.y * sign;
            out[v * 3 + 2] = p[2] + across.z * sign;
            ups[v] = lane.above[i]!;
          }
        }
        target.positions.needsUpdate = true;
        target.aboves.needsUpdate = true;
        target.geometry.setDrawRange(0, Math.max(n - 1, 0) * 6);
        target.mesh.visible = n >= 2;
        const u = target.material.uniforms;
        u.uLen!.value = lane.fade;
        u.uScale!.value = scale;
        u.uTime!.value = clock;
        u.uLevel!.value = look.traces.levels[k]! * level;
        // Its vias, each fading up the way as its trace does.
        const sprites = viaSprites[k]!;
        sprites.forEach((sprite, j) => {
          const via = showVias ? lane.vias[j] : undefined;
          sprite.visible = via !== undefined;
          if (!via) return;
          sprite.position.set(via[0], via[1], via[2]);
          sprite.scale.setScalar((look.vias.size + LANES[k]![2] * 4) * scale);
          const up = Math.max(0, via[1] - pose.position[1]);
          (sprite.material as THREE.SpriteMaterial).opacity = look.vias.level * Math.exp(-up / Math.max(lane.fade, 1e-6)) * level;
        });
      });
    },
    setTier(next) {
      standing = lowerTier(standing, next);
      if (standing === 'low') vias.visible = false;
    },
    dispose() {
      for (const geometry of [frameGeometry, innerGeometry, dialGeometry, ...lanes.map((l) => l.geometry)]) geometry.dispose();
      for (const material of [coreMaterial, haloMaterial, auraMaterial, frameMaterial, innerMaterial, dialMaterial, ...lanes.map((l) => l.material)]) material.dispose();
      for (const sprite of viaSprites.flat()) (sprite.material as THREE.SpriteMaterial).dispose();
      core.geometry.dispose();
      halo.geometry.dispose();
      for (const sprite of viaSprites.flat()) sprite.geometry.dispose();
      textures.core.dispose();
      textures.glow.dispose();
      textures.via.dispose();
    }
  };
}

/** The light as the proof bridge reads it (src/state/frame.ts `journey.circuit`): its shown parts, its traces and their top. */
export interface CircuitOnScreen {
  /** The names of the parts that draw something now (a part, or a part in it, shown and with something to draw), in the group's order. */
  parts: string[];
  /** How many traces are drawn. */
  traces: number;
  /** The highest point of the drawn traces on the screen (NDC, +y up); null with none drawn. */
  top: { x: number; y: number } | null;
}

const topAt = new THREE.Vector3();

/** Whether `o`, shown, or a shown part in it draws anything: a mesh, a sprite, a line or points with something in range. */
function draws(o: THREE.Object3D): boolean {
  let found = false;
  o.traverseVisible((p) => {
    const drawn = p as THREE.Mesh;
    if (found || !(drawn.isMesh || (p as THREE.Sprite).isSprite || (p as THREE.Line).isLine || (p as THREE.Points).isPoints)) return;
    found = (p as THREE.Sprite).isSprite || drawn.geometry.drawRange.count !== 0;
  });
  return found;
}

/**
 * What `light` shows now through `camera` (for the proof bridge alone: it walks the parts and the traces' points): the
 * shown parts' names, the traces drawn and the highest of their points, projected.
 */
export function circuitOnScreen(light: LightModel, camera: THREE.Camera): CircuitOnScreen {
  const parts: string[] = [];
  let traces = 0;
  let top: { x: number; y: number } | null = null;
  let highest = Number.NEGATIVE_INFINITY;
  light.group.traverseVisible((o) => {
    if (o === light.group || o.name === '' || !draws(o)) return;
    parts.push(o.name);
    const mesh = o as THREE.Mesh;
    if (!/^light:trace:\d+$/.test(o.name) || mesh.geometry === undefined) return;
    traces++;
    // A drawn step is two triangles over a pair of points, so n points draw (n - 1) × 6 indices: its first 2n vertices.
    const at = mesh.geometry.getAttribute('position');
    const drawn = Math.min(at.count, (mesh.geometry.drawRange.count / 6 + 1) * 2);
    o.updateWorldMatrix(true, false);
    for (let v = 0; v < drawn; v++) {
      topAt.fromBufferAttribute(at, v).applyMatrix4(o.matrixWorld);
      if (topAt.y <= highest) continue;
      highest = topAt.y;
      topAt.project(camera);
      top = { x: topAt.x, y: topAt.y };
    }
  });
  return { parts, traces, top };
}
