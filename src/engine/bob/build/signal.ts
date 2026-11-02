/**
 * The signal (round 17, spec 2026-11-01-bob-signal-loader-design.md; Bob picked "B · Signal"): the loader's first act on
 * a first visit. One gold line lies on the glass along x through the compass's centre, a wire as a logic analyzer draws
 * it: noise at first; a cursor reads it left to right, and behind it the line is the real UART frames of the hero's name
 * (./signalFrames.ts), its high levels standing `SIGNAL.high` off the glass; read whole, it flattens onto the glass and
 * curls round into the circle the engraving cuts (`WORDMARK.circle`), where the engraving's own circle takes over.
 *
 * The line is a ribbon as wide as the engraving's stroke, in its gold, unlit and fogged as the engraving's circle is,
 * its width turned toward the wide shot's camera (elevation 19°, ~/engine/bob/shots `FRAMES.wide`), which holds through
 * the whole signal. Its points are written in place each pose: nothing is made per frame.
 */
import * as THREE from 'three';
import { ENGRAVING_LOOK } from '~/engine/bob/build/engraving';
import { bitX, SIGNAL, signalBits } from '~/engine/bob/signalFrames';
import { WORDMARK } from '~/engine/bob/wordmark';

/** The ribbon's width (the engraving's stroke, a tube of radius `WORDMARK.engrave`), the step between its points, and the most it holds. */
const WIDTH = 2 * WORDMARK.engrave;
const STEP = 0.012;
const MAX = 1400;
/** How far a low level lies over the glass (as the engraving lifts its ticks), and the noise's reach round the middle. */
const LOW = 0.004;
const NOISE = 0.05;
/** Toward the wide shot's camera: the ribbon's width turns square to it. */
const TOWARD = new THREE.Vector3(0, Math.sin((19 * Math.PI) / 180), Math.cos((19 * Math.PI) / 180));
/** The cursor: how tall it stands over the glass, its width, and its light at full. */
const CURSOR = { height: SIGNAL.high + 0.3, width: 0.012, glowWidth: 0.07, light: 0.35, glow: 0.12 } as const;

export interface SignalModel {
  /** `signal`: the line (`signal:line`) and the cursor (`signal:cursor`). */
  group: THREE.Group;
  /**
   * Poses the signal: read to `decode` (0..1, the cursor's share of the line), curled to `curl` (0..1), at `level`
   * of its light (0 hides it), its noise moving with `time` (s). Hidden once curled whole.
   */
  pose(decode: number, curl: number, level: number, time: number): void;
  dispose(): void;
}

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/** The noise's height at `x` and `time`: a soft, small jitter round the line's middle, moving. */
function noiseAt(x: number, time: number): number {
  const n = 0.5 * Math.sin(x * 37 + time * 23) + 0.3 * Math.sin(x * 113 - time * 31) + 0.2 * Math.sin(x * 290 + time * 47);
  return SIGNAL.high / 2 + n * NOISE;
}

/** A thin upright ribbon `width` wide and `height` tall, its foot at the origin, facing +z: the cursor's parts. */
function upright(width: number, height: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(width, height).translate(0, height / 2 - 0.05, 0);
}

export function buildSignal(word: string): SignalModel {
  const bits = signalBits(word);
  const look = ENGRAVING_LOOK;
  const base = new THREE.Color(look.colour);
  const full = look.gain * look.share.stroke;

  const positions = new Float32Array(MAX * 2 * 3);
  const index = new Uint32Array((MAX - 1) * 6);
  for (let i = 0; i < MAX - 1; i++) index.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], i * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setDrawRange(0, 0);
  const material = new THREE.MeshBasicMaterial({ name: 'signal:line', color: base.clone(), side: THREE.DoubleSide });
  const line = new THREE.Mesh(geometry, material);
  line.name = 'signal:line';
  line.frustumCulled = false;

  const additive = (opacity: number) =>
    new THREE.MeshBasicMaterial({ color: base.clone(), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cursorMaterial = additive(CURSOR.light);
  const glowMaterial = additive(CURSOR.glow);
  const cursor = new THREE.Group();
  cursor.name = 'signal:cursor';
  const cursorLine = new THREE.Mesh(upright(CURSOR.width, CURSOR.height), cursorMaterial);
  const cursorGlow = new THREE.Mesh(upright(CURSOR.glowWidth, CURSOR.height), glowMaterial);
  cursor.add(cursorGlow, cursorLine);

  const group = new THREE.Group();
  group.name = 'signal';
  group.visible = false;
  group.add(line, cursor);

  // Scratch, reused every pose.
  const xs = new Float32Array(MAX);
  const ys = new Float32Array(MAX);
  const point = new THREE.Vector3();
  const along = new THREE.Vector3();
  const side = new THREE.Vector3();
  const at = (i: number, out: THREE.Vector3, e: number): THREE.Vector3 => {
    const x = xs[i]!;
    const u = (x + SIGNAL.half) / (2 * SIGNAL.half);
    const a = Math.PI / 2 + 2 * Math.PI * u;
    return out.set(x + (Math.cos(a) * WORDMARK.circle - x) * e, ys[i]! * (1 - e), Math.sin(a) * WORDMARK.circle * e);
  };

  const model: SignalModel = {
    group,
    pose(decode, curl, level, time) {
      const shown = level > 0 && curl < 1;
      group.visible = shown;
      if (!shown) return;
      const read = clamp01(decode);
      const sweep = -SIGNAL.half + 2 * SIGNAL.half * read;
      // The points: the clean levels left of the cursor, with an upright step at each change, the noise right of it.
      let n = 0;
      let lastBit = -1;
      for (let x = -SIGNAL.half; x <= SIGNAL.half + 1e-9 && n < MAX - 2; x += STEP) {
        if (x <= sweep) {
          const bit = Math.min(bits.length - 1, Math.floor(((x + SIGNAL.half) / (2 * SIGNAL.half)) * bits.length));
          const y = bits[bit] ? SIGNAL.high : LOW;
          if (lastBit >= 0 && bit !== lastBit && bits[bit] !== bits[lastBit]) {
            const edge = bitX(bit, bits.length);
            xs[n] = edge;
            ys[n++] = bits[lastBit] ? SIGNAL.high : LOW;
            xs[n] = edge;
            ys[n++] = y;
          }
          lastBit = bit;
          xs[n] = x;
          ys[n++] = y;
        } else {
          lastBit = -1;
          xs[n] = x;
          ys[n++] = noiseAt(x, time);
        }
      }
      // Each point to the glass and round onto the circle by the curl, its width square to the tangent and the camera.
      const e = smooth(curl);
      for (let i = 0; i < n; i++) {
        at(Math.min(n - 1, i + 1), along, e).sub(at(Math.max(0, i - 1), side, e));
        if (along.lengthSq() < 1e-12) along.set(1, 0, 0);
        side.crossVectors(along.normalize(), TOWARD);
        if (side.lengthSq() < 1e-12) side.set(0, 1, 0);
        side.normalize().multiplyScalar(WIDTH / 2);
        at(i, point, e);
        positions.set([point.x + side.x, point.y + side.y, point.z + side.z, point.x - side.x, point.y - side.y, point.z - side.z], i * 6);
      }
      geometry.attributes.position!.needsUpdate = true;
      geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
      material.color.copy(base).multiplyScalar(full * level);
      // The cursor while it reads, at the sweep, gone by the curl.
      cursor.visible = read > 0 && read < 1 && curl <= 0;
      cursor.position.set(sweep, 0, 0);
      cursorMaterial.opacity = CURSOR.light * level;
      glowMaterial.opacity = CURSOR.glow * level;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      cursorLine.geometry.dispose();
      cursorGlow.geometry.dispose();
      cursorMaterial.dispose();
      glowMaterial.dispose();
    }
  };
  return model;
}
