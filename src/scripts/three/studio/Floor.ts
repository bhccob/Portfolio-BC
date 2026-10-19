import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/**
 * The studio floor, a wet black gloss, in three sheets a hair apart:
 *   - the mirror: a Reflector drawing the scene upside down at half the
 *     canvas's resolution, dark-tinted and smeared downwards in streaks, as
 *     light lies on a wet surface; it fades out towards the disc's edge;
 *   - the gloss: a dark, partly clear sheet whose alpha is streaky noise, so
 *     the mirror shows through in runs rather than as a clean pane. With the
 *     reflection off (the quality ladder) it is the whole floor, opaque, with
 *     a soft warm pool where the beam lands;
 *   - the shadow catcher: a ShadowMaterial taking the device's shadow.
 * The floor is a disc with a soft edge, so the studio's backdrop shows past
 * it rather than a floor running to the horizon.
 */

export interface FloorOptions {
  /** World height of the floor. */
  y: number;
  /** Where the beam lands (x, z), the middle of the warm pool. */
  pool: readonly [number, number];
  /** Draw size of the canvas in device pixels; the mirror renders at half. */
  width: number;
  height: number;
  /** Shared noise (studio/noise.ts), not disposed by the floor. */
  noise: THREE.Texture;
}

export interface Floor {
  group: THREE.Group;
  /** The mirror (hidden while the reflection is off); its render target holds the reflected view. */
  readonly mirror: Reflector;
  /** Leaves these out of the mirror's view as well as the floor's own sheets (which lie just above it). */
  exclude(...objects: THREE.Object3D[]): void;
  setReflection(on: boolean): void;
  /** The canvas's draw size in device pixels changed. */
  setSize(width: number, height: number): void;
  dispose(): void;
}

export const FLOOR = {
  /** The disc's radius; the mirror and the gloss fade out over its outer part. */
  radius: 9,
  /** The mirror's tint (multiplied into what it reflects). */
  tint: 0x6e6884,
  /** The gloss sheet's colour where it is opaque. */
  gloss: 0x0a0612,
  /** The warm pool where the beam lands, and its strength over the mirror and on the plain floor. */
  pool: 0xffd98a,
  poolStrength: [0.22, 0.16] as const,
  /** The shadow's darkness. */
  shadow: 0.4
} as const;

const SEGMENTS = 64;

const mirrorShader = {
  name: 'studio:wet-mirror',
  uniforms: {
    color: { value: null as THREE.Color | null },
    tDiffuse: { value: null as THREE.Texture | null },
    textureMatrix: { value: null as THREE.Matrix4 | null },
    tNoise: { value: null as THREE.Texture | null },
    uRadius: { value: FLOOR.radius },
    uSmear: { value: 0.006 }
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D tNoise;
    uniform float uRadius;
    uniform float uSmear;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      // Streaks run towards the viewer, as light smears on a wet floor: noise fine across the view, long along it.
      vec2 view = normalize(cameraPosition.xz + vec2(1e-4, 0.0));
      vec2 q = vec2(dot(vWorld.xz, vec2(view.y, -view.x)), dot(vWorld.xz, view));
      float streak = texture2D(tNoise, q * vec2(1.1, 0.04)).g;
      float ripple = texture2D(tNoise, q * vec2(2.6, 0.12)).b;
      vec4 p = vUv;
      p.x += (ripple - 0.5) * 0.02 * p.w;
      vec2 uv = p.xy / p.w;
      // Smear down the screen: gather from above, longer where the streak is strong.
      float reach = uSmear * mix(0.35, 1.6, streak);
      vec3 sum = vec3(0.0);
      float weight = 0.0;
      for (int i = 0; i < 7; i++) {
        float k = float(i);
        float w = 1.0 - k / 7.0;
        sum += texture2D(tDiffuse, uv + vec2(0.0, k * reach)).rgb * w;
        weight += w;
      }
      vec3 reflected = sum / weight;
      vec3 V = normalize(cameraPosition - vWorld);
      float fresnel = 0.25 + 0.75 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
      float fade = 1.0 - smoothstep(uRadius * 0.25, uRadius * 0.7, length(vWorld.xz));
      gl_FragColor = vec4(reflected * color * fresnel * mix(0.7, 1.15, streak), fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

const glossVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const glossFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D tNoise;
  uniform vec3 uColor;
  uniform vec3 uPoolColor;
  uniform vec2 uPool;
  uniform vec2 uPoolStrength;
  uniform float uMirror;
  uniform float uRadius;
  varying vec3 vWorld;
  void main() {
    // Across the view and along it (see the mirror): the wet runs point at the viewer.
    vec2 view = normalize(cameraPosition.xz + vec2(1e-4, 0.0));
    vec2 q = vec2(dot(vWorld.xz, vec2(view.y, -view.x)), dot(vWorld.xz, view));
    float broad = texture2D(tNoise, q * vec2(0.9, 0.04)).r;
    float fine = texture2D(tNoise, q * vec2(3.1, 0.13)).g;
    float wet = smoothstep(0.3, 0.75, broad * 0.6 + fine * 0.4);
    // Over the mirror: clear in the wet runs, a dark film between them.
    float alpha = mix(1.0, mix(0.72, 0.28, wet), uMirror);
    // The warm pool where the beam lands, broken into wet runs like the mirror.
    float d = length(vWorld.xz - uPool);
    float runs = wet * fine;
    float pool = exp(-d * d / 2.4) * mix(uPoolStrength.y, uPoolStrength.x, uMirror) * (0.2 + 2.2 * runs * sqrt(runs));
    // Premultiplied: what shows is film + (1 - alpha) × the mirror beneath.
    vec3 film = uColor * alpha + uPoolColor * pool;
    #if defined( USE_FOG ) && defined( FOG_EXP2 )
      // Fog the floor as a whole, mirror included: the haze covers the film and what shows through it alike.
      // At half the scene's strength: the far floor goes dark, not purple.
      float fogFactor = 0.5 * (1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth));
      film = mix(film, fogColor, fogFactor);
      alpha = alpha + fogFactor * (1.0 - alpha);
    #endif
    // The disc's edge: the whole floor fades away, so the backdrop shows beyond it.
    float edge = 1.0 - smoothstep(uRadius * 0.3, uRadius * 0.75, length(vWorld.xz));
    gl_FragColor = vec4(film * edge, alpha * edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildFloor(options: FloorOptions): Floor {
  const group = new THREE.Group();
  group.name = 'studio:floor';
  group.position.y = options.y;

  const disc = (lift: number): THREE.BufferGeometry => {
    const geometry = new THREE.CircleGeometry(FLOOR.radius, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, lift, 0);
    return geometry;
  };

  // The Reflector mirrors about its local +Z, so its geometry stays upright and the mesh is laid flat.
  const mirrorGeometry = new THREE.CircleGeometry(FLOOR.radius, SEGMENTS);
  const mirror = new Reflector(mirrorGeometry, {
    textureWidth: Math.max(1, Math.round(options.width / 2)),
    textureHeight: Math.max(1, Math.round(options.height / 2)),
    color: FLOOR.tint,
    clipBias: 0.003,
    multisample: 0,
    shader: mirrorShader
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.name = 'studio:mirror';
  const mirrorMaterial = mirror.material as THREE.ShaderMaterial;
  mirrorMaterial.uniforms.tNoise.value = options.noise;
  mirrorMaterial.transparent = true;
  mirrorMaterial.depthWrite = false;
  mirror.renderOrder = -5;
  mirror.raycast = () => {};

  const glossMaterial = new THREE.ShaderMaterial({
    name: 'studio:gloss',
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        tNoise: { value: null },
        uColor: { value: new THREE.Color(FLOOR.gloss) },
        uPoolColor: { value: new THREE.Color(FLOOR.pool) },
        uPool: { value: new THREE.Vector2(...options.pool) },
        uPoolStrength: { value: new THREE.Vector2(...FLOOR.poolStrength) },
        uMirror: { value: 1 },
        uRadius: { value: FLOOR.radius }
      }
    ]),
    vertexShader: glossVertex,
    fragmentShader: glossFragment,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    fog: true
  });
  glossMaterial.uniforms.tNoise.value = options.noise;
  const gloss = new THREE.Mesh(disc(0.002), glossMaterial);
  gloss.name = 'studio:gloss';
  gloss.renderOrder = -4;
  gloss.raycast = () => {};

  const shadowMaterial = new THREE.ShadowMaterial({ name: 'studio:shadow', opacity: FLOOR.shadow, depthWrite: false });
  const shadow = new THREE.Mesh(disc(0.004), shadowMaterial);
  shadow.name = 'studio:shadow';
  shadow.receiveShadow = true;
  shadow.renderOrder = -3;
  shadow.raycast = () => {};

  group.add(mirror, gloss, shadow);

  // The sheets above the mirror would cover its view from below the floor: hidden while it renders,
  // with whatever else the caller leaves out of the reflection.
  const hidden: THREE.Object3D[] = [gloss, shadow];
  const reflect = mirror.onBeforeRender;
  mirror.onBeforeRender = function (this: Reflector, ...args: Parameters<THREE.Object3D['onBeforeRender']>) {
    const shown = hidden.map((object) => object.visible);
    hidden.forEach((object) => (object.visible = false));
    try {
      reflect.apply(this, args);
    } finally {
      hidden.forEach((object, i) => (object.visible = shown[i]));
    }
  };
  const exclude = (...objects: THREE.Object3D[]): void => {
    hidden.push(...objects);
  };

  const setReflection = (on: boolean): void => {
    mirror.visible = on;
    glossMaterial.uniforms.uMirror.value = on ? 1 : 0;
  };

  const setSize = (width: number, height: number): void => {
    mirror.getRenderTarget().setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
  };

  const dispose = (): void => {
    mirror.dispose();
    mirrorGeometry.dispose();
    gloss.geometry.dispose();
    glossMaterial.dispose();
    shadow.geometry.dispose();
    shadowMaterial.dispose();
    group.removeFromParent();
  };

  return { group, mirror, exclude, setReflection, setSize, dispose };
}
