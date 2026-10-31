/**
 * The Q&A's gold ring round the stack as one three.js object (spec 2026-10-29-bob-stack-2-design.md, goal 1; the mock-up
 * Bob chose, .superpowers/qa-mockup, "mix"): a gold band of the ring's radius with a fine line inside it and one outside,
 * a dial of ticks between the band and the inner line, and a mark per question across the band, a light over each; the
 * last mark, the end's, bigger, with a gold ring standing on it. No React: the Void builds it with the world and poses it
 * from the path each frame (src/scene/bob/worldPath.ts `RingFrame`, `QaFrame`).
 *
 * It lies flat in its own frame, tipped `RING.tilt` toward the side its front faces (`RING.azimuth`), so the dial reads as
 * a ring rather than a line; its turn is about its own axis (./../../scene/bob/qaRing.ts `ringTurnFor`): mark `k` comes
 * round to the front at place `k`. Nothing in it takes a ray: the marks' buttons are the page's (src/ui/QaRing.tsx).
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';
import { markAngle, RING } from '~/scene/bob/qaRing';

type Vec3 = readonly [number, number, number];

/**
 * How the ring looks, the mock-up's:
 * - `gold`: the band's, the dial's and the marks' metal, its glow `level` at rest, `qa` more once the stack has closed
 *   under it, `end` more as the whole ring lights at the end;
 * - `fine`: the two fine lines' offsets from the band and their tubes, their light `level`, `end` more at the end;
 * - `dial`: `count` ticks round it, every `long`th longer, `inset` in from the band;
 * - `mark`: each plate (x, y, z), the end's bigger; the light `face` above it, its halo's size, and the end's `seal`;
 * - `light`: a mark's light at rest (`other`), the one the ring is at (`here`); `flash` the most a landing adds.
 */
export const RING_LOOK = {
  gold: { colour: 0xd9a520, roughness: 0.32, emissive: 0x6a4210, level: 0.5, qa: 0.35, end: 1.1 },
  band: { tube: 0.075, radial: 12, tubular: 480 },
  fine: { lines: [{ offset: -0.62, tube: 0.022 }, { offset: 0.42, tube: 0.016 }], level: 0.5, end: 0.4 },
  dial: { count: 180, long: 5, longLength: 0.5, shortLength: 0.22, width: 0.03, height: 0.012, inset: 0.1 },
  mark: { plate: [0.62, 0.06, 1.25] as const, last: [0.9, 0.09, 1.7] as const, face: 0.45, halo: 3.4, seal: { radius: 0.55, tube: 0.03 } },
  light: { other: 0.22, inQa: 0.32, here: 1, flash: 0.8 }
} as const;

/** What the ring is posed by, each frame. */
export interface RingPose {
  /** Its middle, world m, and its size against `RING.radius`. */
  centre: Vec3;
  scale: number;
  /** Its turn about its own axis, rad (`ringTurnFor`, with its drift in the Q&A added, `ringDriftAt`). */
  turn: number;
  /** How much more than `RING.tilt` it is tipped, rad (its drift's sway in the Q&A; 0 elsewhere). */
  tip: number;
  /** Its light, 0..1: 0 hides it. */
  level: number;
  /** How far the stack has closed under it, 0..1: it brightens in the questions. */
  close: number;
  /** Where on it the story stands (-1 at the look back, `k` at mark `k`): that mark is the lit one. */
  place: number;
  /** How much the whole ring lights round at the end, 0..1. */
  lit: number;
  /** The mark it has just landed on, and how much of the landing's flash is left; null for none. */
  flash: { mark: number; amount: number } | null;
  /** The world's clock, s: the marks' lights breathe a little on it. */
  clock: number;
}

export interface RingModel {
  /** `ring`: the tipped frame, its turning part (`ring:spin`) with the band, the lines, the dial and the marks. */
  group: THREE.Group;
  pose(p: RingPose): void;
  /** Mark `k`'s light's place in the world, into `out`, as the ring was last posed (for its button on the page). */
  markAt(k: number, out: THREE.Vector3): THREE.Vector3;
  /** Frees every geometry, material and texture the ring made. */
  dispose(): void;
}

/** A soft round light, white, its alpha falling to the edge, made on the CPU so the node tests build it. */
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

/** Builds the ring with `marks` marks (the questions and the end's), lit by `room` (the scene's reflections, or none), dark. */
export function buildRing(marks: number, room: THREE.Texture | null): RingModel {
  const look = RING_LOOK;
  const group = new THREE.Group();
  group.name = 'ring';
  group.visible = false;
  const tipped = new THREE.Group();
  tipped.name = 'ring:tipped';
  const tipAxis = new THREE.Vector3(Math.cos(RING.azimuth), 0, -Math.sin(RING.azimuth));
  tipped.quaternion.setFromAxisAngle(tipAxis, RING.tilt);
  group.add(tipped);
  const spin = new THREE.Group();
  spin.name = 'ring:spin';
  tipped.add(spin);

  const gold = new THREE.MeshStandardMaterial({
    name: 'ring:gold',
    color: look.gold.colour,
    metalness: 1,
    roughness: look.gold.roughness,
    emissive: new THREE.Color(look.gold.emissive),
    emissiveIntensity: look.gold.level,
    envMap: room
  });
  const fine = new THREE.MeshBasicMaterial({ name: 'ring:fine', color: palette.gold, opacity: look.fine.level, ...ADDED });
  const glow = glowTexture(64);
  const flat = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(Math.PI / 2);

  const band = new THREE.Mesh(flat(new THREE.TorusGeometry(RING.radius, look.band.tube, look.band.radial, look.band.tubular)), gold);
  band.name = 'ring:band';
  spin.add(band);
  look.fine.lines.forEach(({ offset, tube }, k) => {
    const line = new THREE.Mesh(flat(new THREE.TorusGeometry(RING.radius + offset, tube, 6, look.band.tubular)), fine);
    line.name = `ring:fine:${k}`;
    spin.add(line);
  });

  // The dial: a tick every 2°, longer every 10°, between the band and the inner line.
  const { count, long, longLength, shortLength, width, height, inset } = look.dial;
  const dial = new THREE.InstancedMesh(new THREE.BoxGeometry(width, height, 1), gold, count);
  dial.name = 'ring:dial';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const length = i % long === 0 ? longLength : shortLength;
    const r = RING.radius - inset - length / 2;
    dial.setMatrixAt(i, m.compose(p.set(Math.sin(t) * r, 0, Math.cos(t) * r), q.setFromAxisAngle(up, t), s.set(1, 1, length)));
  }
  dial.instanceMatrix.needsUpdate = true;
  spin.add(dial);

  // A mark per question across the band, a light over it; the end's bigger, with a gold ring standing on it.
  const marked = Array.from({ length: marks }, (_, k) => {
    const last = k === marks - 1;
    const mark = new THREE.Group();
    mark.name = `ring:mark:${k}`;
    const a = markAngle(k, marks);
    mark.position.set(Math.sin(a) * RING.radius, 0, Math.cos(a) * RING.radius);
    mark.rotation.y = a;
    const [x, y, z] = last ? look.mark.last : look.mark.plate;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), gold);
    plate.name = `ring:mark:${k}:plate`;
    mark.add(plate);
    const face = new THREE.Group();
    face.position.y = look.mark.face;
    mark.add(face);
    const light = new THREE.Sprite(new THREE.SpriteMaterial({ name: `ring:mark:${k}:glow`, map: glow, color: palette.goldLight, ...ADDED }));
    light.name = `ring:mark:${k}:glow`;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ name: `ring:mark:${k}:halo`, map: glow, color: 0x8a6cf2, opacity: 0.4, ...ADDED }));
    halo.scale.setScalar(look.mark.halo);
    face.add(halo, light);
    if (last) {
      const seal = new THREE.Mesh(new THREE.TorusGeometry(look.mark.seal.radius, look.mark.seal.tube, 8, 96), gold);
      seal.name = `ring:mark:${k}:seal`;
      seal.position.y = look.mark.face;
      seal.rotation.y = Math.PI / 2;
      mark.add(seal);
    }
    spin.add(mark);
    return { face, light, halo };
  });

  return {
    group,
    pose({ centre, scale, turn, tip, level, close, place, lit, flash, clock }) {
      const shown = Math.min(Math.max(level, 0), 1);
      group.visible = shown > 0.001;
      if (!group.visible) return;
      group.position.set(centre[0], centre[1], centre[2]);
      group.scale.setScalar(scale);
      tipped.quaternion.setFromAxisAngle(tipAxis, RING.tilt + tip);
      spin.rotation.y = turn;
      const end = Math.min(Math.max(lit, 0), 1);
      gold.emissiveIntensity = (look.gold.level + look.gold.qa * close + look.gold.end * end) * shown;
      fine.opacity = (look.fine.level + look.fine.end * end) * shown;
      const here = Math.round(place);
      marked.forEach(({ light, halo }, k) => {
        const rest = place >= -0.5 ? look.light.inQa : look.light.other;
        const at = Math.max(k === here ? look.light.here : rest, end);
        const flashed = flash !== null && flash.mark === k ? flash.amount * look.light.flash : 0;
        const amount = (at + flashed) * shown;
        light.scale.setScalar((0.5 + 1.1 * amount) * (0.92 + 0.08 * Math.sin(clock * 1.6 + k)));
        (light.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.25 * shown + 0.75 * amount);
        (halo.material as THREE.SpriteMaterial).opacity = 0.05 * shown + 0.28 * amount;
      });
    },
    markAt(k, out) {
      const mark = marked[k];
      if (!mark) return out.set(Number.NaN, Number.NaN, Number.NaN);
      group.updateMatrixWorld(true);
      return mark.face.getWorldPosition(out);
    },
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      gold.dispose();
      fine.dispose();
      for (const { light, halo } of marked) {
        (light.material as THREE.SpriteMaterial).dispose();
        (halo.material as THREE.SpriteMaterial).dispose();
      }
      glow.dispose();
    }
  };
}
