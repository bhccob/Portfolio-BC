import * as THREE from 'three';

/**
 * Procedural noise for the studio, made on the CPU once and DOM-free: a
 * seeded, tileable fractal value noise. The floor's wet streaks, the beam's
 * drifting rays and the smoke all sample one of these textures instead of
 * computing noise per pixel, which a weak GPU could not afford across the
 * whole screen.
 */

/** A small, fast, seeded PRNG (mulberry32): the same seed, the same studio. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `size` × `size` samples of fractal value noise that tile seamlessly,
 * normalised to 0..1: `octaves` layers, the first with `period` cells across,
 * each next one twice as fine at half the weight.
 */
export function fractalNoise(size: number, period: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const next = random(seed);
  let amplitude = 1;
  for (let octave = 0, cells = period; octave < octaves; octave++, cells *= 2, amplitude *= 0.5) {
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = next();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const row0 = (y0 % cells) * cells;
      const row1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % cells;
        const c1 = (x0 + 1) % cells;
        const top = lattice[row0 + c0] + (lattice[row0 + c1] - lattice[row0 + c0]) * sx;
        const bottom = lattice[row1 + c0] + (lattice[row1 + c1] - lattice[row1 + c0]) * sx;
        out[y * size + x] += (top + (bottom - top) * sy) * amplitude;
      }
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of out) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const range = max - min || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / range;
  return out;
}

/**
 * A repeating noise texture: red is broad, green finer and blue finer still,
 * each from its own seed. Linear data, not a colour.
 */
export function noiseTexture(size = 256, seed = 7): THREE.DataTexture {
  const channels = [fractalNoise(size, 4, 5, seed), fractalNoise(size, 8, 5, seed + 1), fractalNoise(size, 16, 4, seed + 2)];
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round(channels[0][i] * 255);
    data[i * 4 + 1] = Math.round(channels[1][i] * 255);
    data[i * 4 + 2] = Math.round(channels[2][i] * 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'studio:noise';
  return texture;
}

/**
 * A soft puff of smoke: white, its alpha a billow of noise that thins to
 * nothing at the edge of a circle. For the haze sprites.
 */
export function smokeTexture(size = 128, seed = 21): THREE.DataTexture {
  const billow = fractalNoise(size, 3, 5, seed);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const r = Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2;
      const edge = Math.max(0, 1 - r);
      const falloff = edge * edge * (3 - 2 * edge);
      const density = Math.min(1, Math.max(0, billow[i] * 1.9 - 0.55));
      data.set([255, 255, 255, Math.round(255 * density * falloff)], i * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'studio:smoke';
  return texture;
}

/** A soft round glow: white, its alpha falling from the middle to nothing at the edge. */
export function glowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.min(1, Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2);
      const fall = Math.pow(1 - r, 2.2);
      data.set([255, 255, 255, Math.round(255 * fall)], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'studio:glow';
  return texture;
}
