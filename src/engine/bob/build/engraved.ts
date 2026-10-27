/**
 * The engraved way in three.js (spec 2026-10-27-bob-engraved-way-design.md): the shaft's rings round the light's fall
 * and each trip's line with a few faint orbit arcs round it, all one engraving of gold marks (scale ticks, small glyphs)
 * that glows where the light is and falls into the dark and the fog elsewhere. Where and how much of each shows is
 * src/scene/bob/engravedWay.ts's; this draws it, as the engraved-way mock-up Bob approved on 2026-10-27 did.
 *
 * Every part draws additively and writes no depth, so it only ever adds light behind and around the light and its facts.
 * On a medium tier the shaft keeps every other ring and each trip two arcs; on a low one, every other ring and no arcs.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import type { QualityTier } from '~/engine/quality';
import type { EngravedLevels, RingSpec } from '~/scene/bob/engravedWay';

type Vec3 = readonly [number, number, number];

/** The look of each kind of part: the glow's base, its height by the light and its reach (m), and its sizes. */
export const ENGRAVED_LOOK = {
  /** Seen from above, deep down the shaft: by height near the light, with its own long fog. */
  throat: { base: 0.12, glow: 1.2, reach: 1.1, axes: [0, 1, 0], fog: [14, 40] },
  hall: { base: 0.14, glow: 0.95, reach: 1.4, axes: [0, 1, 0] },
  line: { base: 0.34, glow: 1.4, reach: 1.1, width: 0.07 },
  arc: { base: 0.14, glow: 0.3, reach: 3, width: 0.05, count: 3 }
} as const;

/** The engraving's strip (px): fine ticks every `tick`, a long one every fifth, a glyph every `glyph`. */
const STRIP = { width: 2048, height: 64, tick: 12, glyph: 230 } as const;

/**
 * The engraving: two edge lines, fine ticks, longer ticks every fifth, and a small glyph now and then with a short run
 * of marks beside it, like scale numbers. White on black: the shader reads it as how much of the gold shows.
 *
 * @throws TypeError when the canvas gives no 2D context.
 */
function engravingTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const { width: w, height: h } = STRIP;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new TypeError('the engraved way needs a 2D canvas context, and the canvas gave none');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 2;
  for (const y of [5, h - 5]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.lineWidth = 1.5;
  for (let x = 0, k = 0; x < w; x += STRIP.tick, k++) {
    const long = k % 5 === 0;
    g.globalAlpha = long ? 0.95 : 0.55;
    g.beginPath();
    g.moveTo(x, 6);
    g.lineTo(x, long ? 26 : 16);
    g.stroke();
  }
  g.globalAlpha = 0.8;
  const glyphs = ['circle', 'cross', 'diamond', 'star'] as const;
  for (let x = 90, k = 0; x < w; x += STRIP.glyph, k++) {
    const kind = glyphs[k % glyphs.length]!;
    const cy = 44;
    g.beginPath();
    if (kind === 'circle') g.arc(x, cy, 6, 0, Math.PI * 2);
    if (kind === 'cross') {
      g.moveTo(x - 7, cy);
      g.lineTo(x + 7, cy);
      g.moveTo(x, cy - 7);
      g.lineTo(x, cy + 7);
    }
    if (kind === 'diamond') {
      g.moveTo(x, cy - 7);
      g.lineTo(x + 7, cy);
      g.lineTo(x, cy + 7);
      g.lineTo(x - 7, cy);
      g.closePath();
    }
    if (kind === 'star') {
      for (let a = 0; a < 4; a++) {
        const t = (a / 4) * Math.PI;
        g.moveTo(x - Math.cos(t) * 8, cy - Math.sin(t) * 8);
        g.lineTo(x + Math.cos(t) * 8, cy + Math.sin(t) * 8);
      }
    }
    g.stroke();
    g.globalAlpha = 0.45;
    for (let m = 0; m < 4; m++) g.fillRect(x + 14 + m * 7, cy - 2, 4, 4);
    g.globalAlpha = 0.8;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'engraved:marks';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

/** The marks, as gold: a faint base everywhere, more near the light (along `uAxes` only), into the fog by view depth. */
const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColour;
  uniform vec3 uLight;
  uniform vec3 uAxes;
  uniform float uBase;
  uniform float uGlow;
  uniform float uReach;
  uniform float uLevel;
  uniform vec2 uFog;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    float mark = texture2D(uMap, vUv).r;
    vec3 d = (vWorld - uLight) * uAxes;
    float near = exp(-dot(d, d) / (uReach * uReach));
    float fog = 1.0 - smoothstep(uFog.x, uFog.y, vDepth);
    float a = mark * (uBase + uGlow * near) * uLevel * fog;
    gl_FragColor = vec4(uColour * a, 1.0);
  }
`;

function engravedMaterial(map: THREE.Texture, look: { base: number; glow: number; reach: number }, axes: Vec3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uMap: { value: map },
      uColour: { value: new THREE.Color(palette.goldLight) },
      uLight: { value: new THREE.Vector3() },
      uAxes: { value: new THREE.Vector3(...axes) },
      uBase: { value: look.base },
      uGlow: { value: look.glow },
      uReach: { value: look.reach },
      uLevel: { value: 0 },
      uFog: { value: new THREE.Vector2(6, 40) }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/** A flat level ring band of radius r and width w: u runs round it (`repeat` engravings), v across. */
function ringGeometry(r: number, w: number, repeat: number): THREE.BufferGeometry {
  const n = 256;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * (r - w / 2), 0, s * (r - w / 2), c * (r + w / 2), 0, s * (r + w / 2));
    uv.push((k / n) * repeat, 0, (k / n) * repeat, 1);
    if (k < n) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A ribbon of width w along the points, laid across the cross of the way's direction and up (x where the way runs straight up or down), u by length. */
function ribbonGeometry(points: readonly Vec3[], w: number, metresPerRepeat: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const v = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);
  let along = 0;
  for (let k = 0; k < points.length; k++) {
    const p = v(points[k]!);
    const tangent = v(points[Math.min(points.length - 1, k + 1)]!).sub(v(points[Math.max(0, k - 1)]!)).normalize();
    let side = new THREE.Vector3().crossVectors(tangent, up);
    if (side.lengthSq() < 1e-4) side = new THREE.Vector3(1, 0, 0);
    side.normalize().multiplyScalar(w / 2);
    if (k > 0) along += p.distanceTo(v(points[k - 1]!));
    const l = p.clone().sub(side);
    const r = p.clone().add(side);
    pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
    uv.push(along / metresPerRepeat, 0, along / metresPerRepeat, 1);
    if (k < points.length - 1) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A seeded generator (mulberry32), so the arcs are the same every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The points of `count` faint orbit arcs round `mid`, the same for every tier (a tier keeps the first few). */
function arcsRound(mid: Vec3, count: number, random: () => number): Vec3[][] {
  return Array.from({ length: count }, () => {
    const r = 3.2 + random() * 4.5;
    const span = (0.55 + random() * 0.45) * Math.PI * 2;
    const start = random() * Math.PI * 2;
    const tilt = new THREE.Euler((random() - 0.5) * 1.1, random() * Math.PI, (random() - 0.5) * 0.9);
    return Array.from({ length: 161 }, (_, k): Vec3 => {
      const th = start + (k / 160) * span;
      const p = new THREE.Vector3(Math.cos(th) * r, 0, Math.sin(th) * r).applyEuler(tilt);
      return [mid[0] + p.x, mid[1] + p.y - 0.6, mid[2] + p.z];
    });
  });
}

export interface EngravedModel {
  group: THREE.Group;
  /** Each part's level, the light's place (null keeps the last), and the scene's fog for every part but the throat. */
  update(levels: EngravedLevels, light: Vec3 | null, fog: { near: number; far: number }): void;
  dispose(): void;
}

/**
 * The shaft's rings and each trip's line and arcs, hidden until a level is above 0.
 *
 * @throws TypeError when the canvas gives no 2D context.
 */
export function buildEngraved(
  rings: readonly RingSpec[],
  trips: readonly (readonly Vec3[])[],
  tier: QualityTier,
  canvas: HTMLCanvasElement = document.createElement('canvas')
): EngravedModel {
  const map = engravingTexture(canvas);
  const group = new THREE.Group();
  group.name = 'engraved-way';
  group.visible = false;
  const geometries: THREE.BufferGeometry[] = [];
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const thin = tier !== 'high';

  const throatMat = engravedMaterial(map, ENGRAVED_LOOK.throat, ENGRAVED_LOOK.throat.axes);
  throatMat.uniforms.uFog!.value.set(...ENGRAVED_LOOK.throat.fog);
  const hallMat = engravedMaterial(map, ENGRAVED_LOOK.hall, ENGRAVED_LOOK.hall.axes);
  for (const zone of ['throat', 'hall'] as const) {
    const zoneRings = rings.filter((ring) => ring.zone === zone);
    zoneRings.forEach((ring, k) => {
      if (thin && k % 2 === 1) return;
      const repeat = Math.round((2 * Math.PI * ring.radius) / (zone === 'throat' ? 1.2 : 1.6));
      const mesh = add(`engraved:${zone}`, ringGeometry(ring.radius, ring.width, repeat), zone === 'throat' ? throatMat : hallMat);
      mesh.position.set(0, ring.y, 0);
      mesh.rotation.set(ring.tilt[0], 0, ring.tilt[1]);
    });
  }

  const lineMats: THREE.ShaderMaterial[] = [];
  const arcMats: THREE.ShaderMaterial[] = [];
  const arcs = tier === 'high' ? ENGRAVED_LOOK.arc.count : tier === 'medium' ? 2 : 0;
  const random = seeded(7);
  trips.forEach((points, k) => {
    const lineMat = engravedMaterial(map, ENGRAVED_LOOK.line, [1, 1, 1]);
    lineMats.push(lineMat);
    add(`engraved:line:${k}`, ribbonGeometry(points, ENGRAVED_LOOK.line.width, 1.1), lineMat);
    const arcMat = engravedMaterial(map, ENGRAVED_LOOK.arc, [1, 1, 1]);
    arcMats.push(arcMat);
    const mid = points[Math.floor(points.length / 2)] ?? [0, 0, 0];
    for (const arc of arcsRound(mid, ENGRAVED_LOOK.arc.count, random).slice(0, arcs)) add(`engraved:arc:${k}`, ribbonGeometry(arc, ENGRAVED_LOOK.arc.width, 1.3), arcMat);
  });
  const materials = [throatMat, hallMat, ...lineMats, ...arcMats];

  return {
    group,
    update(levels, light, fog) {
      for (const m of materials) {
        if (light) m.uniforms.uLight!.value.set(light[0], light[1], light[2]);
        if (m !== throatMat) m.uniforms.uFog!.value.set(Math.max(2, fog.near * 0.6), Math.max(10, fog.far));
      }
      throatMat.uniforms.uLevel!.value = levels.throat;
      hallMat.uniforms.uLevel!.value = levels.hall;
      lineMats.forEach((m, i) => (m.uniforms.uLevel!.value = levels.trips[i] ?? 0));
      arcMats.forEach((m, i) => (m.uniforms.uLevel!.value = levels.trips[i] ?? 0));
      group.visible = levels.throat > 0 || levels.hall > 0 || levels.trips.some((l) => l > 0);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      map.dispose();
    }
  };
}
