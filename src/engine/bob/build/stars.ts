/**
 * The realistic stars Bob approved with the rings (2026-10-29: "more realistic like unique stars"; spec
 * 2026-10-29-bob-stack-2-design.md, goals 3 and 4; the mock-ups' stars, .superpowers/rings-mockup and fall-mockup): each
 * its own colour by its temperature, from blue-white to deep orange, the cooler and smaller ones most common; its own size,
 * brightness and twinkle; the brightest with a telescope's six-pointed spikes; a few in pairs, a smaller companion of
 * another colour close beside one; and up to a few in a faint shell of gas. One field round the stack (`starsRound`), one
 * along the fall (`starsFall`), kept far enough out that none crosses the light.
 *
 * No React: the Void builds them and poses them on the world's clock, so they stand still while the canvas sleeps and with
 * reduced motion. The low tier makes half the stars. The textures are made on the CPU, so the node tests build them.
 */
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';

type Vec3 = readonly [number, number, number];

/**
 * A field of stars: `count` of them (the pairs' companions among them) round `centre`, `inner` to `outer` m out from its
 * axis; on a shell round it (`height` null: up and down as much as 0.9 rad, the axis kept `clear` m clear), or round its
 * vertical line between the heights `height` (top, bottom). At most `pairs` companions and `shells` shells of gas.
 */
export interface StarField {
  count: number;
  centre: Vec3;
  inner: number;
  outer: number;
  height: readonly [number, number] | null;
  clear: number;
  pairs: number;
  shells: number;
  seed: number;
}

/** The stars round the stack (the rings mock-up's), round its axis through `centre`, their shell's middle at `middle` (world y). */
export function starsRound(centre: Vec3, middle: number): StarField {
  return { count: 44, centre: [centre[0], middle, centre[2]], inner: 26, outer: 112, height: null, clear: 22, pairs: 4, shells: 2, seed: 2026 };
}

/** The stars along the fall (the fall mock-up's): round the light's line `line` (x, z), from `top` down to `bottom`. */
export function starsFall(top: number, bottom: number, line: readonly [number, number]): StarField {
  return { count: 170, centre: [line[0], 0, line[1]], inner: 42, outer: 120, height: [top, bottom], clear: 0, pairs: 6, shells: 3, seed: 2026 };
}

/** The stars' colours by temperature and how common each is (the mock-ups'): blue-white to deep orange. */
const SPECTRA: readonly [number, number][] = [
  [0x9db4ff, 0.06],
  [0xaabfff, 0.1],
  [0xd5e0ff, 0.13],
  [0xf6f4ff, 0.15],
  [0xfff1dc, 0.17],
  [0xffdcae, 0.21],
  [0xffbd82, 0.18]
];

/** Brighter than this, a star has spikes. */
const SPIKED = 0.72;

/** What the stars are posed by, each frame. */
export interface StarsPose {
  /** Their light, 0..1: 0 hides them. */
  level: number;
  /** The world's clock, s: each twinkles at its own pace on it. */
  clock: number;
}

export interface StarsModel {
  /** `stars`: each star's core (`stars:star:<k>`, a companion `stars:pair:<k>`), its glow, its spikes and its shell. */
  group: THREE.Group;
  pose(p: StarsPose): void;
  dispose(): void;
}

/** A seeded generator, 0..1. */
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

/** Linear between the stops [r, alpha], r ascending. */
function stops(r: number, at: readonly (readonly [number, number])[]): number {
  if (r <= at[0]![0]) return at[0]![1];
  for (let k = 1; k < at.length; k++) {
    const [r1, a1] = at[k]!;
    const [r0, a0] = at[k - 1]!;
    if (r <= r1) return a0 + ((a1 - a0) * (r - r0)) / (r1 - r0);
  }
  return at[at.length - 1]![1];
}

/** The core's light: white-hot in the middle, falling fast (the mock-ups' radial gradient). */
const coreTexture = (): THREE.DataTexture =>
  made(128, (x, y) =>
    stops(Math.hypot(x, y), [
      [0, 1],
      [0.035, 1],
      [0.09, 0.5],
      [0.22, 0.11],
      [0.5, 0.025],
      [1, 0]
    ])
  );

/** The telescope's spikes: three long thin lines through the middle at 90°, 30° and 150°, and a short one across. */
const spikeTexture = (): THREE.DataTexture => {
  const spikes = [
    { angle: Math.PI / 2, length: 0.98, width: 0.0086, alpha: 0.9 },
    { angle: Math.PI / 6, length: 0.98, width: 0.0086, alpha: 0.9 },
    { angle: (5 * Math.PI) / 6, length: 0.98, width: 0.0086, alpha: 0.9 },
    { angle: 0, length: 0.47, width: 0.0062, alpha: 0.55 }
  ];
  return made(256, (x, y) => {
    let a = 0;
    for (const s of spikes) {
      const along = x * Math.cos(s.angle) + y * Math.sin(s.angle);
      const across = -x * Math.sin(s.angle) + y * Math.cos(s.angle);
      if (Math.abs(across) > s.width || Math.abs(along) > s.length) continue;
      const u = Math.abs(along) / s.length;
      const fall = u < 0.16 ? 1 - u * (0.65 / 0.16) : 0.35 * (1 - (u - 0.16) / 0.84);
      a += s.alpha * fall;
    }
    return a;
  });
};

/** A soft round light. */
const glowTexture = (): THREE.DataTexture => made(64, (x, y) => Math.pow(Math.max(0, 1 - Math.hypot(x, y)), 2.4));

const ADDED = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } as const;

/** Builds the field `field` for `tier`, dark. */
export function buildStars(field: StarField, tier: QualityTier): StarsModel {
  const group = new THREE.Group();
  group.name = 'stars';
  group.visible = false;
  const textures = { core: coreTexture(), spikes: spikeTexture(), glow: glowTexture() };
  const random = seeded(field.seed);
  const white = new THREE.Color(1, 1, 1);
  const haze = new THREE.Color(0x8a6cf2);
  const low = tier === 'low';
  const count = low ? Math.round(field.count / 2) : field.count;
  const pairsMost = low ? Math.floor(field.pairs / 2) : field.pairs;
  const shellsMost = low ? Math.floor(field.shells / 2) : field.shells;
  const spectrum = (): THREE.Color => {
    let u = random();
    for (const [colour, weight] of SPECTRA) if ((u -= weight) <= 0) return new THREE.Color(colour);
    return new THREE.Color(SPECTRA[SPECTRA.length - 1]![0]);
  };
  const stars: { core: THREE.Sprite; glow: THREE.Sprite; spikes: THREE.Sprite | null; shell: THREE.Sprite | null; base: number; rate: number; phase: number; spike: number }[] = [];
  const sprite = (name: string, map: THREE.Texture, colour: THREE.Color): THREE.Sprite => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: colour, opacity: 0, ...ADDED }));
    s.name = name;
    return s;
  };
  let pairs = 0;
  let shells = 0;
  const add = (at: THREE.Vector3, size: number, tint: THREE.Color, bright: number, shell: boolean, pair: boolean): void => {
    const k = stars.length;
    const core = sprite(`stars:${pair ? 'pair' : 'star'}:${k}`, textures.core, tint.clone().lerp(white, 0.55));
    core.scale.setScalar(size);
    core.position.copy(at);
    const glow = sprite(`stars:glow:${k}`, textures.glow, tint.clone());
    glow.scale.setScalar(size * 2.6);
    glow.position.copy(at);
    group.add(glow, core);
    let spikes: THREE.Sprite | null = null;
    if (bright > SPIKED) {
      spikes = sprite(`stars:spikes:${k}`, textures.spikes, tint.clone().lerp(white, 0.3));
      spikes.scale.setScalar(size * (3.2 + bright * 3));
      spikes.position.copy(at);
      group.add(spikes);
    }
    let gas: THREE.Sprite | null = null;
    if (shell) {
      gas = sprite(`stars:shell:${k}`, textures.glow, tint.clone().lerp(haze, 0.4));
      gas.scale.setScalar(size * 11);
      gas.position.copy(at);
      group.add(gas);
    }
    stars.push({ core, glow, spikes, shell: gas, base: bright, rate: 0.6 + random() * 2.2, phase: random() * 9, spike: spikes ? spikes.scale.x : 0 });
  };

  const [cx, cy, cz] = field.centre;
  while (stars.length < count) {
    const az = random() * Math.PI * 2;
    const r = field.inner + random() ** 0.7 * (field.outer - field.inner);
    let at: THREE.Vector3;
    if (field.height === null) {
      // On a shell round the stack, up and down a little less than round, the axis kept clear.
      const el = (random() * 2 - 1) * 0.9;
      at = new THREE.Vector3(cx + Math.sin(az) * Math.cos(el) * r, cy + Math.sin(el) * r * 0.7, cz + Math.cos(az) * Math.cos(el) * r);
      if (Math.hypot(at.x - cx, at.z - cz) < field.clear) continue;
    } else {
      const [top, bottom] = field.height;
      at = new THREE.Vector3(cx + Math.sin(az) * r, bottom + random() * (top - bottom), cz + Math.cos(az) * r);
    }
    // Most stars are faint; the reach of a star's light grows a little with distance, so far ones are not lost.
    const bright = random() ** 2.2;
    const size = (0.9 + bright * 3.4) * (0.7 + r / 90);
    const shell = shells < shellsMost && bright > 0.6 && random() < 0.5;
    if (shell) shells++;
    add(at, size, spectrum(), 0.35 + bright * 0.65, shell, false);
    if (stars.length < count && pairs < pairsMost && bright > 0.4 && random() < 0.35) {
      pairs++;
      const off = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(size * 0.7);
      add(at.clone().add(off), size * 0.55, spectrum(), 0.3 + bright * 0.4, false, true);
    }
  }

  return {
    group,
    pose({ level, clock }) {
      const shown = Math.min(Math.max(level, 0), 1);
      group.visible = shown > 0.001;
      if (!group.visible) return;
      for (const star of stars) {
        const twinkle = 0.84 + 0.1 * Math.sin(clock * star.rate + star.phase) + 0.06 * Math.sin(clock * star.rate * 2.7 + star.phase * 1.3);
        const light = shown * star.base * twinkle;
        (star.core.material as THREE.SpriteMaterial).opacity = Math.min(1, light * 1.15);
        (star.glow.material as THREE.SpriteMaterial).opacity = light * 0.2;
        if (star.spikes) {
          (star.spikes.material as THREE.SpriteMaterial).opacity = light * 0.55;
          star.spikes.scale.setScalar(star.spike * (0.92 + 0.08 * twinkle));
        }
        if (star.shell) (star.shell.material as THREE.SpriteMaterial).opacity = shown * 0.05;
      }
    },
    dispose() {
      for (const star of stars) for (const s of [star.core, star.glow, star.spikes, star.shell]) (s?.material as THREE.SpriteMaterial | undefined)?.dispose();
      textures.core.dispose();
      textures.spikes.dispose();
      textures.glow.dispose();
    }
  };
}
