/**
 * The dial (round 16, spec 2026-11-01-bob-round16-design.md; Bob picked "Dial (C)" from the mock-ups): Bob's name and his
 * line run slowly round the compass's base on the glass, in the engraving's gold, like an engraving on a dial. A flat band
 * lying on the glass round the compass, just outside its outer ring (1.88 m) and inside where the B letters' backs stand
 * (2.15 m), its words a canvas texture that turns round it; the far side dimmer, as a dial lying in depth.
 *
 * - `radius`: the band's middle from the compass's axis, m; `band` its width across, m; `letter` the letters' height, m;
 * - `turn`: how fast the words go round, rad/s (once in about three minutes);
 * - `far`: the far side's light, of the near side's (toward the home camera, +z);
 * - `fadeIn`: s the dial takes to come in once the home is handed over;
 * - `lift`: how far over the glass it lies, m, as the engraving lifts its ticks.
 */
import * as THREE from 'three';
import { ENGRAVING_LOOK } from '~/engine/bob/build/engraving';

export const DIAL = { radius: 2.05, letter: 0.06, band: 0.1, turn: 0.035, far: 0.3, fadeIn: 0.8, lift: 0.004 } as const;

/** Steps round the ring, and the words' canvas: wide enough for a texel per pixel at the home, as tall as the band is for that. */
const SEGMENTS = 256;
const WIDE = 8192;
const TALL = Math.round((WIDE * DIAL.band) / (2 * Math.PI * DIAL.radius));
/** The font, its size in canvas pixels for the letters' height (a capital is about 0.72 of the size), and its spacing. */
const FONT = '"Martian Mono Variable", ui-monospace, monospace';
const SIZE = Math.round(((DIAL.letter / DIAL.band) * TALL) / 0.72);
const SPACING = Math.round(SIZE * 0.18);

/** The dial's words: the name and the line, joined and in capitals (the line already ends on its own separator). */
export function dialText(name: string, badge: string): string {
  return `${name} • ${badge}`.toUpperCase();
}

/** How many times words `textWidth` long go round a ring `circumference` long, whole: at least once; a bad width reads as once. */
export function dialRepeats(textWidth: number, circumference: number): number {
  if (!(textWidth > 0) || !Number.isFinite(textWidth)) return 1;
  return Math.max(1, Math.round(circumference / textWidth));
}

export interface DialModel {
  /** `dial`: the band (`dial:ring`) on the glass, centred on the compass's axis. */
  group: THREE.Group;
  /** Writes `text` round the ring, a whole number of times; the same words again draw nothing. */
  setText(text: string): void;
  /** Shows the dial at `shown` (0..1, hidden at 0) with its words turned `angle` radians round. */
  pose(shown: number, angle: number): void;
  dispose(): void;
}

/** The band: a strip round the circle, its texture's u running round (so the words read left to right on the near side) and v across, the far side dimmer. */
function bandGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colours: number[] = [];
  const inner = DIAL.radius - DIAL.band / 2;
  const outer = DIAL.radius + DIAL.band / 2;
  for (let k = 0; k <= SEGMENTS; k++) {
    const a = (2 * Math.PI * k) / SEGMENTS;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Near the home camera (+z, a = π/2) at its full light, the far side (−z) at `far`.
    const light = DIAL.far + (1 - DIAL.far) * (0.5 + 0.5 * s);
    // u falls as a rises, so on the near side the words run from left (−x) to right (+x); a glyph's top toward the axis.
    const u = 1 - k / SEGMENTS;
    positions.push(inner * c, DIAL.lift, inner * s, outer * c, DIAL.lift, outer * s);
    uvs.push(u, 1, u, 0);
    colours.push(light, light, light, light, light, light);
  }
  const index: number[] = [];
  for (let k = 0; k < SEGMENTS; k++) {
    const i = k * 2;
    index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(index);
  return geometry;
}

/**
 * Builds the dial, hidden and with no words yet. Its material is basic and additive, not depth-writing, the engraving's
 * tick gold, fogged as the engraving is; the words are white on a clear canvas, the gold their tint.
 */
export function buildDial(canvas: HTMLCanvasElement = document.createElement('canvas')): DialModel {
  canvas.width = WIDE;
  canvas.height = TALL;
  const ctx = canvas.getContext('2d');
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const gold = new THREE.Color(ENGRAVING_LOOK.colour).multiplyScalar(ENGRAVING_LOOK.gain * ENGRAVING_LOOK.share.ticks);
  const material = new THREE.MeshBasicMaterial({
    name: 'dial',
    map,
    color: gold,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(bandGeometry(), material);
  ring.name = 'dial:ring';
  ring.renderOrder = 2;
  const group = new THREE.Group();
  group.name = 'dial';
  group.visible = false;
  group.add(ring);

  let written: string | null = null;
  const draw = (text: string) => {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WIDE, TALL);
    ctx.font = `500 ${SIZE}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${SPACING}px`;
    const measured = ctx.measureText?.(text)?.width;
    const width = Number.isFinite(measured) && (measured ?? 0) > 0 ? measured! : text.length * (SIZE * 0.62 + SPACING);
    const times = dialRepeats(width, WIDE);
    // Each time stretched a little to its share of the ring, so the last ends where the first begins.
    const step = WIDE / times;
    for (let k = 0; k < times; k++) {
      ctx.setTransform(step / width, 0, 0, 1, k * step, 0);
      ctx.fillText(text, 0, TALL / 2);
    }
    map.needsUpdate = true;
  };

  const model: DialModel = {
    group,
    setText(text) {
      if (text === written) return;
      written = text;
      draw(text);
      // Drawn again once the font is in, if it was not yet (the words would be in the fallback face until then).
      if (typeof document !== 'undefined' && document.fonts?.load) {
        void document.fonts.load(`500 ${SIZE}px ${FONT}`, text).then(() => {
          if (written === text) draw(text);
        });
      }
    },
    pose(shown, angle) {
      const level = Number.isFinite(shown) ? Math.min(1, Math.max(0, shown)) : 0;
      group.visible = level > 0;
      material.opacity = level;
      map.offset.x = (Number.isFinite(angle) ? angle : 0) / (2 * Math.PI);
    },
    dispose() {
      ring.geometry.dispose();
      material.dispose();
      map.dispose();
    }
  };
  return model;
}
