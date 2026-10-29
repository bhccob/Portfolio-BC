/**
 * The Q&A's stars round it all, for decoration alone (spec 2026-10-29-bob-stack-2-design.md, goal 1: "can the stars in
 * background be more 3D"; the mock-up Bob chose, .superpowers/qa-mockup, its `decor`): each a solid star in space, a
 * bright core with six long points along its three axes and four short ones between, turning slowly on its own; at many
 * distances round the machine, never in the questions' way (the near side's middle, where the ring and the answer are);
 * about one in three with two thin gold gyroscope rings turning round it. A star whose place on the screen falls behind
 * the answer's words steps back while they show. Nothing in it takes a ray.
 *
 * No React: the Void builds it with the world and poses it in the Q&A, on the world's clock (so it stands still while the
 * canvas sleeps and with reduced motion). The low tier makes half the stars and no rings.
 */
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';

type Vec3 = readonly [number, number, number];

/** The decor's measures, the mock-up's: how many, how far, how big, its tints and its gold. */
export const DECOR_LOOK = {
  count: 30,
  near: 20,
  reach: 55,
  size: [2, 6.5] as const,
  tints: [0xfff1da, 0xffcd85, 0xcdbcff, 0xdbe6ff, 0xffe2b0] as const,
  haze: 0x8a6cf2,
  gold: 0xe2a54a,
  /** A star within this many CSS px of the answer's box steps back, at `hideRate` a second. */
  margin: 70,
  hideRate: 6
} as const;

/** What the decor is posed by, each frame. */
export interface DecorPose {
  /** Its light, 0..1: 0 hides it. */
  level: number;
  /** The world's clock, s: the turns and the twinkle. */
  clock: number;
  /** The frame's step, s, for the stepping back. */
  dt: number;
  camera: THREE.Camera;
  /** The answer's box on the screen, CSS px; null while none shows. */
  keepOut: { x: number; y: number; w: number; h: number } | null;
  size: { width: number; height: number };
}

export interface DecorModel {
  /** `decor`: each star (`decor:star:<k>`), its halo, and its rings' pivots (`decor:ring:<k>:<j>`). */
  group: THREE.Group;
  pose(p: DecorPose): void;
  dispose(): void;
}

/** A seeded generator, 0..1 (the mock-up's). */
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

/** A soft round light, made on the CPU. */
function glowTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.min(1, Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2);
      data.set([255, 255, 255, Math.round(255 * Math.pow(Math.max(0, 1 - r), 2.4))], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const ADDED = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } as const;

/**
 * Builds the decor for `tier`, round the stack at `centre`, its shell's middle a share of the way down to the machine's
 * `middle` (world y), seeded by `seed`, dark.
 */
export function buildDecorStars(tier: QualityTier, centre: Vec3, middle: number, seed = 77): DecorModel {
  const look = DECOR_LOOK;
  const group = new THREE.Group();
  group.name = 'decor';
  group.visible = false;
  const random = seeded(seed);
  const point = new THREE.OctahedronGeometry(1, 0);
  const core = new THREE.IcosahedronGeometry(1, 2);
  const gyro = new THREE.TorusGeometry(1, 0.018, 6, 128);
  const glow = glowTexture(64);
  const white = new THREE.Color(0xffffff);
  const low = tier === 'low';
  const count = low ? Math.round(look.count / 2) : look.count;
  const shellY = centre[1] + (middle - centre[1]) * 0.4;
  const materials: THREE.Material[] = [];

  const stars: {
    body: THREE.Group;
    halo: THREE.Sprite;
    rings: { mesh: THREE.Mesh; speed: number }[];
    light: THREE.MeshBasicMaterial[];
    gold: THREE.MeshBasicMaterial | null;
    base: number;
    rate: number;
    phase: number;
    spin: THREE.Vector3;
    hide: number;
  }[] = [];
  while (stars.length < count) {
    const az = random() * Math.PI * 2;
    const el = (random() * 2 - 1) * 0.75;
    const r = look.near + random() ** 0.8 * look.reach;
    // Never in the questions' way: the near side's middle, the look back's and the ring's side.
    const front = Math.abs(((az - 0.5 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.45 && Math.abs(el) < 0.35;
    if (front) continue;
    const k = stars.length;
    const at = new THREE.Vector3(centre[0] + Math.sin(az) * Math.cos(el) * r, shellY + Math.sin(el) * r, centre[2] + Math.cos(az) * Math.cos(el) * r);
    const tint = new THREE.Color(look.tints[Math.floor(random() * look.tints.length)]!);
    const size = look.size[0] + random() ** 2.2 * look.size[1];
    const body = new THREE.Group();
    body.name = `decor:star:${k}`;
    body.position.copy(at);
    const pointLight = new THREE.MeshBasicMaterial({ color: tint, opacity: 0.85, ...ADDED });
    const coreLight = new THREE.MeshBasicMaterial({ color: tint.clone().lerp(white, 0.65), opacity: 1, ...ADDED });
    materials.push(pointLight, coreLight);
    // Six long points along its three axes, and four short ones between them, so it is a solid star from every side.
    const long = size * 0.46;
    const thin = long * 0.034;
    for (const axis of ['x', 'y', 'z'] as const) {
      const p = new THREE.Mesh(point, pointLight);
      p.scale.set(axis === 'x' ? long : thin, axis === 'y' ? long : thin, axis === 'z' ? long : thin);
      body.add(p);
    }
    for (const turn of [Math.PI / 4, -Math.PI / 4]) {
      const p = new THREE.Mesh(point, pointLight);
      p.scale.set(long * 0.42, thin * 0.8, thin * 0.8);
      p.rotation.z = turn;
      body.add(p);
    }
    const middleLight = new THREE.Mesh(core, coreLight);
    middleLight.scale.setScalar(size * 0.05);
    body.add(middleLight);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tint.clone().lerp(new THREE.Color(look.haze), 0.5), opacity: 0.16, ...ADDED }));
    materials.push(halo.material);
    halo.scale.setScalar(size * 1.1);
    halo.position.copy(at);
    group.add(halo, body);
    const rings: { mesh: THREE.Mesh; speed: number }[] = [];
    let gold: THREE.MeshBasicMaterial | null = null;
    // The rings' turns are drawn for every third star on every tier, so a tier does not move the others' places.
    const tilt = [random() * 3.1, random() * 3.1, random() * 3.1, random() * 3.1];
    const speeds = [0.15 + random() * 0.25, -(0.15 + random() * 0.25)];
    if (!low && k % 3 === 1) {
      gold = new THREE.MeshBasicMaterial({ color: look.gold, opacity: 0.6, ...ADDED });
      materials.push(gold);
      [size * 0.2, size * 0.27].forEach((radius, j) => {
        const pivot = new THREE.Group();
        pivot.name = `decor:ring:${k}:${j}`;
        pivot.position.copy(at);
        pivot.rotation.set(tilt[j * 2]!, tilt[j * 2 + 1]!, 0);
        const mesh = new THREE.Mesh(gyro, gold!);
        mesh.scale.setScalar(radius);
        pivot.add(mesh);
        group.add(pivot);
        rings.push({ mesh, speed: speeds[j]! });
      });
    }
    stars.push({
      body,
      halo,
      rings,
      light: [pointLight, coreLight],
      gold,
      base: 0.6 + random() * 0.4,
      rate: 0.6 + random() * 1.6,
      phase: random() * 10,
      spin: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(0.18),
      hide: 0
    });
  }

  const onScreen = new THREE.Vector3();
  return {
    group,
    pose({ level, clock, dt, camera, keepOut, size }) {
      const shown = Math.min(Math.max(level, 0), 1);
      group.visible = shown > 0.001;
      if (!group.visible) return;
      const step = Math.min(1, Math.max(0, dt) * look.hideRate);
      for (const s of stars) {
        // Behind the answer's words: it steps back while they show.
        let behind = false;
        if (keepOut !== null) {
          onScreen.copy(s.body.position).project(camera);
          const x = ((onScreen.x + 1) / 2) * size.width;
          const y = ((1 - onScreen.y) / 2) * size.height;
          const m = look.margin;
          behind = onScreen.z < 1 && x > keepOut.x - m && x < keepOut.x + keepOut.w + m && y > keepOut.y - m && y < keepOut.y + keepOut.h + m;
        }
        s.hide += ((behind ? 1 : 0) - s.hide) * step;
        const twinkle = s.base * (0.78 + 0.22 * Math.sin(clock * s.rate + s.phase)) * (1 - 0.92 * s.hide) * shown;
        for (const m of s.light) m.opacity = twinkle;
        (s.halo.material as THREE.SpriteMaterial).opacity = 0.16 * twinkle;
        if (s.gold) s.gold.opacity = 0.6 * shown * (1 - 0.92 * s.hide);
        s.body.rotation.set(s.phase + s.spin.x * clock, s.phase * 2 + s.spin.y * clock, s.spin.z * clock);
        for (const r of s.rings) r.mesh.rotation.y = s.phase + clock * r.speed;
      }
    },
    dispose() {
      point.dispose();
      core.dispose();
      gyro.dispose();
      glow.dispose();
      for (const m of materials) m.dispose();
    }
  };
}
