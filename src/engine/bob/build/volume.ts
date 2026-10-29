/**
 * The nebula in 3D (spec 2026-10-28-bob-quantum-stack-design.md, goal 9; Bob, 2026-10-28: "i want the dimension and cloud
 * to have more 3d effect on it so its more cinematic and realistic"; after the mock-up he approved,
 * .superpowers/holo-world-4-mockup/volume.ts): no flat cards turned to the camera, but a volume of gas each pixel's ray
 * marches through. Every step takes up light, so dark dust lanes hide what lies behind them, stars included, and gives
 * off its own glow: violet in the body, its edges lit gold on the side facing the CPU's light (the falling light's in
 * the fall) and pale on the side facing a far star. Its shapes come from a tiling 3D noise, warped, drifting very
 * slowly on the world's clock; more gas below, banks round it, and a clear space kept round the stack's spine (or along
 * the fall's line) and along the camera's line to what it looks at.
 *
 * Part of the stack, not a backdrop behind it (Bob, 2026-10-29: "i want the cloud to be more 3 and less blurry to be part
 * of the main object model so they blend"): it is a pass in the post chain (src/scene/Effects.tsx), after the scene is
 * drawn and before the bloom. Each ray stops where it meets what the scene drew, read off the composer's depth, so the
 * gas drifts in front of the boards, between their rims and behind them, and thins into what it meets. It is marched at
 * two thirds of the screen's size on the high tier and half on medium into its own target, then laid over the scene by
 * its own cover with a light five-tap. The low tier has none: its stars and dust stay (./nebula.ts).
 */
import { Pass } from 'postprocessing';
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';
import { seeded } from './plate';

type Vec3 = readonly [number, number, number];

/** The gas's look (the mock-up's): its colours, and its march's steps by tier. */
export const VOLUME_LOOK = {
  colour: { deep: 0x2a1250, wisp: 0x7d4fc4, gold: 0xe2a54a, pale: 0xb7a6e8, rose: 0x9c3f8a },
  steps: { high: 84, medium: 56 },
  /** The far star whose light rims the gas's far side, a way into the dark. */
  key: [-0.55, 0.45, -0.7]
} as const;

/** How much smaller than the screen the gas is drawn, and how many steps its rays take, by tier: none on low. */
export function volumeTier(tier: QualityTier): { scale: 1.5 | 2; steps: 84 | 56 } | null {
  if (tier === 'high') return { scale: 1.5, steps: VOLUME_LOOK.steps.high };
  if (tier === 'medium') return { scale: 2, steps: VOLUME_LOOK.steps.medium };
  return null;
}

const NOISE = 64;
/** The noise's voxels, made once: they are the same for every volume, and take a while to make. */
let voxels: Uint8Array | null = null;

/** A tiling 64³ noise: R a smooth fractal noise, G a billowy cellular one, B and A the first shifted, for warping. */
function noiseVoxels(): Uint8Array {
  if (voxels !== null) return voxels;
  const S = NOISE;
  const random = seeded(4242);
  const lattice = (f: number): Float32Array => Float32Array.from({ length: f * f * f }, () => random());
  const octaves = [4, 8, 16, 32].map((f) => ({ f, v: lattice(f) }));
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const value = (x: number, y: number, z: number, f: number, v: Float32Array): number => {
    const X = x * f;
    const Y = y * f;
    const Z = z * f;
    const xi = Math.floor(X);
    const yi = Math.floor(Y);
    const zi = Math.floor(Z);
    const u = smooth(X - xi);
    const w = smooth(Y - yi);
    const t = smooth(Z - zi);
    const at = (i: number, j: number, k: number): number => v[((k % f) * f + (j % f)) * f + (i % f)]!;
    const l = (a: number, b: number, s: number): number => a + (b - a) * s;
    return l(
      l(l(at(xi, yi, zi), at(xi + 1, yi, zi), u), l(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), u), w),
      l(l(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), u), l(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), u), w),
      t
    );
  };
  const points = (c: number): Float32Array => Float32Array.from({ length: c * c * c * 3 }, () => random());
  const cells = [
    { c: 6, p: points(6) },
    { c: 12, p: points(12) }
  ];
  const worley = (x: number, y: number, z: number, c: number, p: Float32Array): number => {
    const X = x * c;
    const Y = y * c;
    const Z = z * c;
    const xi = Math.floor(X);
    const yi = Math.floor(Y);
    const zi = Math.floor(Z);
    let best = 9;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = xi + dx;
          const j = yi + dy;
          const k = zi + dz;
          const n = ((((k + c) % c) * c + ((j + c) % c)) * c + ((i + c) % c)) * 3;
          const d = Math.hypot(i + p[n]! - X, j + p[n + 1]! - Y, k + p[n + 2]! - Z);
          if (d < best) best = d;
        }
      }
    }
    return Math.min(1, best);
  };
  const r = new Float32Array(S * S * S);
  const data = new Uint8Array(S * S * S * 4);
  for (let z = 0; z < S; z++) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S;
        const v = y / S;
        const w = z / S;
        let fbm = 0;
        let amp = 0.5;
        let norm = 0;
        for (const o of octaves) {
          fbm += amp * value(u, v, w, o.f, o.v);
          norm += amp;
          amp *= 0.5;
        }
        fbm = Math.min(1, Math.max(0, (fbm / norm - 0.5) * 1.9 + 0.5));
        const billow = 0.65 * (1 - worley(u, v, w, cells[0]!.c, cells[0]!.p)) + 0.35 * (1 - worley(u, v, w, cells[1]!.c, cells[1]!.p));
        const i = (z * S + y) * S + x;
        r[i] = fbm;
        data[i * 4] = Math.round(fbm * 255);
        data[i * 4 + 1] = Math.round(Math.min(1, billow) * 255);
      }
    }
  }
  const shifted = (x: number, y: number, z: number): number => r[((z % S) * S + (y % S)) * S + (x % S)]!;
  for (let z = 0; z < S; z++) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = ((z * S + y) * S + x) * 4;
        data[i + 2] = Math.round(shifted(x + 21, y + 13, z + 37) * 255);
        data[i + 3] = Math.round(shifted(x + 43, y + 29, z + 7) * 255);
      }
    }
  }
  voxels = data;
  return data;
}

function noiseTexture(): THREE.Data3DTexture {
  const t = new THREE.Data3DTexture(noiseVoxels(), NOISE, NOISE, NOISE);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

const MARCH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const MARCH_FRAGMENT = /* glsl */ `
  precision highp sampler3D;
  #include <packing>
  uniform sampler3D uNoise;
  uniform sampler2D uDepth;
  uniform float uNear;
  uniform float uFar;
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  uniform vec3 uCam;
  uniform vec3 uAim;
  uniform vec3 uCore;
  uniform float uMiddle;
  uniform float uClear;
  uniform float uTime;
  uniform float uPower;
  uniform int uSteps;
  uniform vec3 uDeep;
  uniform vec3 uWisp;
  uniform vec3 uGold;
  uniform vec3 uPale;
  uniform vec3 uKey;
  uniform vec3 uRose;
  uniform vec2 uSize;
  varying vec2 vUv;

  // Where the gas may be at all: never in the clear space, never on the camera's line close to what it looks at, never
  // right at the camera; more of it below, fading out far away, with big empty reaches between the clouds, so the dark
  // stays the most of it.
  float shape(vec3 p) {
    vec3 q = p - vec3(0.0, uMiddle, 0.0);
    // On the stack the space kept clear is a column round the spine, so the gas drifts between the boards' rims.
    float column = smoothstep(4.0, 9.0, length(p.xz));
    // In the fall, the fall's line and a ball round the light.
    float line = smoothstep(5.0, 11.0, length(p.xz)) * smoothstep(4.0, 9.0, length(q));
    float world = mix(column, line, uClear);
    vec3 toCam = uCam - uAim;
    float t = clamp(dot(p - uAim, toCam) / dot(toCam, toCam), 0.0, 1.0);
    float off = length(p - uAim - toCam * t);
    float sight = smoothstep(mix(5.0, 0.6, t), mix(10.0, 4.5, t), off);
    float near = smoothstep(1.5, 6.0, length(p - uCam));
    float layer = 0.3 + 0.7 * smoothstep(16.0, -16.0, q.y);
    float far = 1.0 - smoothstep(70.0, 110.0, length(q));
    float big = smoothstep(0.53, 0.67, texture(uNoise, p * 0.0065 + vec3(0.31, 0.07, 0.53)).r);
    return world * sight * near * layer * far * big;
  }

  vec4 w;
  float density(vec3 p, out float tint) {
    vec3 q = p * 0.019 + vec3(uTime * 0.0016, 0.0, uTime * 0.0011);
    w = texture(uNoise, q * 0.43 + 0.17);
    vec3 warp = (w.gba - 0.5) * 0.6;
    vec4 n = texture(uNoise, q + warp);
    float detail = texture(uNoise, q * 4.6 + warp * 1.8).r;
    float fine = texture(uNoise, q * 12.5 - warp * 2.5).g;
    tint = n.b;
    float body = n.r * 0.6 + n.g * 0.4;
    // The edges eaten away by finer noise and cut steep: wisps and filaments with an edge to them, not soft blobs.
    float edge = clamp((body - 0.46) * 6.0, 0.0, 1.0);
    return max(0.0, (body - 0.5) * 5.5 - (1.0 - edge) * (detail * 0.8 + fine * 0.4) + edge * 0.12);
  }

  float densityAt(vec3 p) {
    float tint;
    return density(p, tint) * shape(p);
  }

  void main() {
    vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 view = normalize(v.xyz / v.w);
    vec3 dir = normalize((uCamWorld * vec4(view, 0.0)).xyz);
    // How far the ray goes before it meets what the scene drew (the composer's depth; where nothing was drawn it reads 1,
    // the far plane): the gas stops there, so it stands in front of the boards and between them, never over them.
    float depth = texture2D(uDepth, vUv).r;
    float surface = depth < 1.0 ? perspectiveDepthToViewZ(depth, uNear, uFar) / view.z : 1e6;
    // A fixed, even scatter of where in each step a ray samples (the R2 sequence), so the steps never band and the
    // scatter melts away under the light five-tap.
    vec2 px = floor(vUv * uSize);
    float jitter = fract(px.x * 0.7548776662 + px.y * 0.5698402910);
    // Fewer steps reach as far, each a little longer.
    float stride = 84.0 / float(uSteps);
    float t = 0.5;
    vec3 colour = vec3(0.0);
    float through = 1.0;
    for (int i = 0; i < 84; i++) {
      if (i >= uSteps) break;
      if (t > surface) break;
      float dt = max(0.9, t * 0.045) * stride;
      // The last step only as far as the surface: the gas thins into what it meets instead of ending a step behind it.
      float open = min(dt, surface - t);
      vec3 p = uCam + dir * (t + jitter * open);
      float s = shape(p);
      if (s > 0.002) {
        float tint;
        float d = density(p, tint) * s;
        if (d > 0.003) {
          // Lit edges: thinner gas toward a light means this side faces it.
          vec3 toCore = normalize(uCore - p);
          float core = clamp((d - densityAt(p + toCore * 1.8)) * 1.3 + 0.06, 0.0, 1.0);
          float star = clamp((d - densityAt(p + uKey * 2.6)) * 1.1 + 0.03, 0.0, 1.0);
          vec3 fromCore = p - uCore;
          float reach = 1.0 / (1.0 + dot(fromCore, fromCore) * 0.005);
          // Glowing gas where the tint is high, dark dust where it is low: the dust only takes light away.
          float gas = smoothstep(0.35, 0.8, tint);
          vec3 hue = mix(mix(uDeep, uWisp, gas), uRose, smoothstep(0.55, 0.9, w.a) * 0.35);
          // Its own shade: the side away from the far star darker, as a cloud is in its own shadow, so it has a form.
          float shade = exp(-densityAt(p + uKey * 3.5) * 3.0);
          vec3 glow = hue * (0.025 + 0.26 * gas * gas) * (0.3 + 0.7 * shade)
                    + uGold * core * reach * gas * (0.08 + 0.7 * uPower)
                    + uPale * star * star * (0.04 + 0.32 * gas);
          float a = 1.0 - exp(-d * open);
          colour += through * a * glow * 0.45;
          through *= 1.0 - a;
          if (through < 0.03) break;
        }
      }
      t += dt;
      if (t > 140.0) break;
    }
    gl_FragColor = vec4(colour, 1.0 - through);
  }
`;

const COMPOSITE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D inputBuffer;
  uniform sampler2D uGas;
  uniform vec2 uTexel;
  uniform float uLevel;
  varying vec2 vUv;
  void main() {
    vec4 scene = texture2D(inputBuffer, vUv);
    // A light five-tap over the smaller picture, a little over half a texel out: the scatter of the steps melts away and
    // the wisps keep their edges (the old 3 × 3 tent smeared them).
    vec2 o = uTexel * 0.6;
    vec4 gas = texture2D(uGas, vUv) * 0.5
             + (texture2D(uGas, vUv + o) + texture2D(uGas, vUv - o)
              + texture2D(uGas, vUv + vec2(o.x, -o.y)) + texture2D(uGas, vUv + vec2(-o.x, o.y))) * 0.125;
    gas *= uLevel;
    // The gas is premultiplied: it covers the scene by its own cover and adds its glow.
    gl_FragColor = vec4(scene.rgb * (1.0 - gas.a) + gas.rgb, scene.a);
  }
`;

/** What the gas is marched by, each frame. */
export interface VolumeInput {
  /** The world's clock, s: the gas drifts on it, so it stands still while the canvas sleeps. */
  clock: number;
  /** The gas's whole strength, 0..1 (`nebulaLevels`' clouds); at 0 the pass is off. */
  level: number;
  /** The CPU's power, 0..1: how gold the gas's near edges are lit. */
  power: number;
  /** What the camera looks at: the line to it stays clear. */
  aim: Vec3;
  /** The height the clear space stands round: the machine's middle, or the light's place in the fall. */
  middle: number;
  /** The clear space: round the stack's spine, or along the fall's line. */
  clear: 'stack' | 'fall';
  /** Where the gold light is that lights the gas's near edges: the CPU, or the falling light. */
  core: Vec3;
}

export interface VolumeModel {
  /**
   * The pass in the post chain (src/scene/Effects.tsx): it needs the composer's depth, marches the gas into its own
   * target at the composer's size over the tier's scale, and lays the scene with the gas over it into the chain's output.
   */
  pass: Pass;
  /** The march's material (its uniforms say what it marches). */
  march: THREE.ShaderMaterial;
  /** The composite's material: the scene, and the gas over it. */
  composite: THREE.ShaderMaterial;
  /** Sets what the gas is marched by, for `camera`, this frame; the pass is off at level 0. */
  update(camera: THREE.PerspectiveCamera, input: VolumeInput): void;
  dispose(): void;
}

/** The gas at this tier, or none on low. */
export function buildVolume(tier: QualityTier): VolumeModel | null {
  const look = volumeTier(tier);
  if (look === null) return null;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const c = VOLUME_LOOK.colour;
  const march = new THREE.ShaderMaterial({
    vertexShader: MARCH_VERTEX,
    fragmentShader: MARCH_FRAGMENT,
    uniforms: {
      uNoise: { value: noiseTexture() },
      uDepth: { value: null },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCam: { value: new THREE.Vector3() },
      uAim: { value: new THREE.Vector3() },
      uCore: { value: new THREE.Vector3() },
      uMiddle: { value: 0 },
      uClear: { value: 0 },
      uTime: { value: 0 },
      uPower: { value: 0 },
      uSteps: { value: look.steps },
      uDeep: { value: new THREE.Color(c.deep) },
      uWisp: { value: new THREE.Color(c.wisp) },
      uGold: { value: new THREE.Color(c.gold) },
      uPale: { value: new THREE.Color(c.pale) },
      uKey: { value: new THREE.Vector3(...VOLUME_LOOK.key).normalize() },
      uRose: { value: new THREE.Color(c.rose) },
      uSize: { value: new THREE.Vector2(1, 1) }
    },
    depthTest: false,
    depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), march);
  quad.frustumCulled = false;
  const marchScene = new THREE.Scene();
  marchScene.add(quad);
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const composite = new THREE.ShaderMaterial({
    vertexShader: COMPOSITE_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    uniforms: { inputBuffer: { value: null }, uGas: { value: target.texture }, uTexel: { value: new THREE.Vector2(1, 1) }, uLevel: { value: 0 } },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false
  });

  const u = march.uniforms;
  const pass = new (class GasPass extends Pass {
    constructor() {
      super('GasPass');
      this.needsDepthTexture = true;
      this.fullscreenMaterial = composite;
    }

    override getDepthTexture(): THREE.Texture {
      return u.uDepth!.value as THREE.Texture;
    }

    override setDepthTexture(depth: THREE.Texture | null): void {
      u.uDepth!.value = depth;
    }

    override setSize(width: number, height: number): void {
      const w = Math.max(1, Math.ceil(width / look.scale));
      const h = Math.max(1, Math.ceil(height / look.scale));
      target.setSize(w, h);
      u.uSize!.value.set(w, h);
      composite.uniforms.uTexel!.value.set(1 / w, 1 / h);
    }

    override render(gl: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget | null, output: THREE.WebGLRenderTarget | null): void {
      gl.setRenderTarget(target);
      gl.render(marchScene, flat);
      composite.uniforms.inputBuffer!.value = input?.texture ?? null;
      gl.setRenderTarget(this.renderToScreen ? null : output);
      gl.render(this.scene, this.camera);
    }
  })();
  pass.name = 'nebula:volume';

  return {
    pass,
    march,
    composite,
    update(camera, input) {
      const level = Number.isFinite(input.level) ? Math.min(1, Math.max(0, input.level)) : 0;
      composite.uniforms.uLevel!.value = level;
      pass.enabled = level > 0;
      u.uAim!.value.set(...input.aim);
      u.uCore!.value.set(...input.core);
      u.uMiddle!.value = input.middle;
      u.uClear!.value = input.clear === 'fall' ? 1 : 0;
      u.uTime!.value = input.clock;
      u.uPower!.value = input.power;
      if (level <= 0) return;
      camera.updateMatrixWorld();
      u.uInvProj!.value.copy(camera.projectionMatrixInverse);
      u.uCamWorld!.value.copy(camera.matrixWorld);
      u.uCam!.value.copy(camera.position);
      u.uNear!.value = camera.near;
      u.uFar!.value = camera.far;
    },
    dispose() {
      (u.uNoise!.value as THREE.Texture).dispose();
      target.dispose();
      target.texture.dispose();
      march.dispose();
      composite.dispose();
      quad.geometry.dispose();
    }
  };
}
